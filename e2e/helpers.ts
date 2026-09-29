import type { Page } from '@playwright/test';

/** 各テストの前にIndexedDBを空にして、記録・進捗を初期状態に戻す。 */
export async function resetAppData(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('kenshou-lab');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

/** Pyodideの初回読み込み(数十秒かかることがある)が終わり、実行/提出ボタンが押せる状態になるまで待つ。 */
export async function waitForRunReady(page: Page, timeout = 90_000): Promise<void> {
  const button = page.getByRole('button', { name: /^(実行|回答して確かめる)$/ }).first();
  await button.waitFor({ state: 'visible', timeout });
  await page.waitForFunction(
    (el) => el instanceof HTMLButtonElement && !el.disabled,
    await button.elementHandle(),
    { timeout },
  );
}

/** CodeMirrorエディタの中身を選択して置き換える(textareaではないためfill()は使えない)。 */
export async function replaceEditorContent(page: Page, text: string, index = 0): Promise<void> {
  const editor = page.locator('.cm-content').nth(index);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
}

import type { Page } from '@playwright/test';

/**
 * 各テストの前にIndexedDBを空にして、記録・進捗を初期状態に戻す。
 *
 * アプリの画面(例: '/')に遷移してからDBを削除すると、そのページ自身が
 * 開いているDB接続がonblockedを引き起こし、削除が完了しないまま次のページに
 * 進んでしまう。次のページが下書きを保存した直後に遅延実行された削除が
 * データベースごと消してしまう競合が起きる。
 * about:blank は不透明オリジンでindexedDBが使えないため、アプリのJSを
 * 一切読み込まない空のHTMLをこのオリジン上で即席に返し、そこで削除する。
 */
export async function resetAppData(page: Page): Promise<void> {
  const blankUrl = '/__e2e_blank__';
  await page.route(blankUrl, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>e2e blank</title>' }),
  );
  await page.goto(blankUrl);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('kenshou-lab');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
      req.onblocked = () => reject(new Error('deleteDatabase was blocked by another connection'));
    });
  });
  await page.unroute(blankUrl);
}

/**
 * Pyodideの初回読み込み(数十秒かかることがある)が終わるまで待つ。
 *
 * 実行/提出ボタンのdisabled状態は「予想必須で未入力」「読む問題ですでに回答済み」
 * のような業務ロジックでも変わるため、ボタンの有効化では判定しない。
 * 読み込み中にだけ出る文言が消えたことをもって「準備完了」とみなす。
 *
 * ただし遷移直後・Reactがまだ何も描画していない一瞬の間はこの文言自体が
 * DOMに存在せず、「消えるのを待つ」だけだとPlaywrightがそれを「最初から
 * 非表示」と判定して即座に抜けてしまう(実際にはこの直後に読み込みが始まり
 * 数十秒かかる)。先に文言が一度表示されるのを確認してから、消えるのを待つ。
 */
export async function waitForRunReady(page: Page, timeout = 180_000): Promise<void> {
  const loadingText = page.getByText('実行環境を準備しています').first();
  await loadingText.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  await loadingText.waitFor({ state: 'hidden', timeout });
}

/** CodeMirrorエディタの中身を選択して置き換える(textareaではないためfill()は使えない)。 */
export async function replaceEditorContent(page: Page, text: string, index = 0): Promise<void> {
  const editor = page.locator('.cm-content').nth(index);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
}

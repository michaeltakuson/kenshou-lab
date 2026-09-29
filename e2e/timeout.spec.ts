import { expect, test } from '@playwright/test';
import { replaceEditorContent, resetAppData, waitForRunReady } from './helpers';

// SPEC.md 第14章 受け入れ条件3:
// while True: pass は設定秒数で停止し、その直後にも普通に実行できる。
test('無限ループは既定秒数で停止し、その後も続けて実行できる', async ({ page }) => {
  await resetAppData(page);
  await page.goto('/#/scratchpad');
  await waitForRunReady(page);

  // インデントはCodeMirrorの自動インデントに頼らず明示的に入れる
  // (スクリプトによる高速入力では自動インデントが効かないことがあるため)。
  await replaceEditorContent(page, 'while True:\n    pass');
  await page.getByRole('button', { name: '実行' }).click();

  // 既定は10秒だが、システム負荷が高いとタイマーの発火が遅れることがあるため余裕を持たせる。
  await expect(page.getByText(/秒を超えたので停止しました/)).toBeVisible({ timeout: 30_000 });

  // Workerの再生成が終わり、続けて実行できることを確認する
  await waitForRunReady(page);
  await replaceEditorContent(page, 'print("続けて実行できた")');
  await page.getByRole('button', { name: '実行' }).click();
  await expect(page.getByText('続けて実行できた')).toBeVisible({ timeout: 30_000 });
});

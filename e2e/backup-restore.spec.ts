import { expect, test } from '@playwright/test';
import { resetAppData, waitForRunReady } from './helpers';

// SPEC.md 第14章 受け入れ条件11:
// バックアップを別のブラウザ(端末)で復元すると、両方の記録が重複なく統合される。
// ここでは1つのブラウザ内で「書き出し→全消去→復元」を行い、往復できることを確認する。
test('バックアップを書き出して復元すると記録が戻る', async ({ page }) => {
  await resetAppData(page);

  // 読む問題に回答して、記録を1件作る。
  // 「回答して確かめる」ボタンは、Pyodideの準備ができているだけでなく
  // 予想欄に何か入力されていないと有効にならない(仕様通り)ため、
  // 先に予想欄を埋めてからボタンが有効になるのを待つ。
  await page.goto('/#/sets/repo/sample/sample-p03');
  await page.getByPlaceholder('実行結果を予想して入力してください').fill('8');
  await waitForRunReady(page);
  await page.getByRole('button', { name: '回答して確かめる' }).click();
  await expect(page.getByText(/初回の判定/)).toBeVisible({ timeout: 30_000 });

  // 書き出し
  await page.goto('/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'バックアップを書き出す' }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();

  // 全データ削除して、記録が消えたことを確認する
  await page.getByRole('button', { name: '全データを削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await page.getByRole('button', { name: '完全に削除する' }).click();
  await page.waitForLoadState('networkidle');

  await page.goto('/#/records');
  await expect(page.getByText('まだ記録がありません。')).toBeVisible();

  // 復元
  await page.goto('/#/settings');
  await page.getByTestId('restore-backup-file').setInputFiles(filePath!);
  await expect(page.getByText(/復元しました/)).toBeVisible({ timeout: 10_000 });

  await page.goto('/#/records');
  await expect(page.getByText('sample-p03')).toBeVisible();
});

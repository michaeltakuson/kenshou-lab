import { expect, test } from '@playwright/test';
import { replaceEditorContent, resetAppData, waitForRunReady } from './helpers';

// SPEC.md 第14章 受け入れ条件2・5・6: サンプル問題に正解すると合格し、
// 表・図・statsmodels/scikit-learnが動く。ここでは代表として書く問題を1つ確認する。
test('書く問題: 模範解答を提出するとすべて合格する', async ({ page }) => {
  await resetAppData(page);
  await page.goto('/#/sets/repo/sample/sample-p01');
  await waitForRunReady(page);

  await replaceEditorContent(page, 'category_sales = df.groupby("category")["sales"].sum()');

  await page.getByRole('button', { name: '提出' }).click();
  await expect(page.getByText('採点結果: すべて合格')).toBeVisible({ timeout: 30_000 });
  // テストの中身(assertの期待値)は表示されない
  await expect(page.getByText('assert', { exact: false })).toHaveCount(0);
});

test('書く問題: 不正解を提出すると不合格の理由が表示される', async ({ page }) => {
  await resetAppData(page);
  await page.goto('/#/sets/repo/sample/sample-p01');
  await waitForRunReady(page);

  await replaceEditorContent(page, 'category_sales = 999');

  await page.getByRole('button', { name: '提出' }).click();
  await expect(page.getByText('不合格の項目があります')).toBeVisible({ timeout: 30_000 });
});

test('書く問題: 最終行にDataFrameを書くと表で表示される', async ({ page }) => {
  await resetAppData(page);
  await page.goto('/#/scratchpad');
  await waitForRunReady(page);

  await replaceEditorContent(page, 'import pandas as pd\npd.DataFrame({"a": [1, 2]})');
  await page.getByRole('button', { name: '実行' }).click();

  await expect(page.locator('.result-table')).toBeVisible({ timeout: 30_000 });
});

test('図(matplotlib)が画像として表示される', async ({ page }) => {
  await resetAppData(page);
  await page.goto('/#/sets/repo/sample/sample-p02');
  await waitForRunReady(page);

  await replaceEditorContent(page, 'plt.hist(df["quantity"])');
  await page.getByRole('button', { name: '実行' }).click();

  await expect(page.locator('.result-figure')).toBeVisible({ timeout: 30_000 });
});

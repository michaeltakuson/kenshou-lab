import { expect, test } from '@playwright/test';
import { resetAppData, waitForRunReady } from './helpers';

// SPEC.md 第14章 受け入れ条件14: 幅390pxで横スクロールが出ないこと。
test.describe('モバイル幅レイアウト', () => {
  test('問題画面で横スクロールが発生しない', async ({ page }) => {
    await resetAppData(page);
    await page.goto('/#/sets/repo/sample/sample-p01');
    await waitForRunReady(page);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('ホーム画面で横スクロールが発生しない', async ({ page }) => {
    await resetAppData(page);
    await page.goto('/#/');
    await page.waitForLoadState('networkidle');

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('問題/コード/結果のタブが表示され、切り替えられる', async ({ page }) => {
    await resetAppData(page);
    await page.goto('/#/sets/repo/sample/sample-p01');
    await waitForRunReady(page);

    await expect(page.getByRole('tab', { name: '問題' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'コード' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '結果' })).toBeVisible();

    await page.getByRole('tab', { name: 'コード' }).click();
    await expect(page.locator('.cm-content')).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import { replaceEditorContent, resetAppData, waitForRunReady } from './helpers';

// SPEC.md 第14章 受け入れ条件8:
// 予想必須の問題は予想を書くまで実行できず、実行後に予想と結果が並ぶ。
test('予想が必須の問題は、予想を書くまで実行/提出できない', async ({ page }) => {
  await resetAppData(page);
  await page.goto('/#/sets/repo/sample/sample-p07');
  await waitForRunReady(page);

  await expect(page.getByRole('button', { name: '実行' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '提出' })).toBeDisabled();

  await page.getByLabel(/予想.*実行前に入力してください/).fill('プラスになると思う');
  await expect(page.getByRole('button', { name: '実行' })).toBeEnabled();

  await replaceEditorContent(
    page,
    'X = sm.add_constant(df["quantity"])\nmodel = sm.OLS(df["sales"], X).fit()\nslope = model.params["quantity"]',
  );
  await page.getByRole('button', { name: '実行' }).click();

  await expect(page.getByText('あなたの予想')).toBeVisible({ timeout: 30_000 });
  // 「プラスになると思う」は無効化された予想欄自体にも残っているため、
  // 結果側に表示された控え(<pre>)であることを明示して曖昧さをなくす。
  await expect(page.locator('pre.result-pre', { hasText: 'プラスになると思う' })).toBeVisible();
});

// SPEC.md 第14章 受け入れ条件9:
// ページを再読み込みしても、書きかけのコード・進捗・記録が残る。
test('リロードしても書きかけのコードと進捗が残る', async ({ page }) => {
  await resetAppData(page);
  await page.goto('/#/sets/repo/sample/sample-p01');
  await waitForRunReady(page);

  await replaceEditorContent(page, '# 書きかけの途中のコード');
  // 入力が止まってからデバウンスで保存されるため、保存が完了するまで余裕を持って待つ
  await page.waitForTimeout(2_000);

  await page.reload();
  await expect(page.locator('.cm-content')).toContainText('書きかけの途中のコード', { timeout: 30_000 });
  await expect(page.getByText('挑戦中')).toBeVisible();
});

// SPEC.md 第14章 受け入れ条件12:
// JSONの貼り付けで問題セットを追加できる。不正なJSONはどこがおかしいか日本語で示して拒否する。
test('設定画面で問題セットを貼り付け追加でき、不正なJSONは理由を示して拒否する', async ({ page }) => {
  await resetAppData(page);
  await page.goto('/#/settings');

  // 不正なJSON(必須項目が足りない)
  const invalid = JSON.stringify({ schemaVersion: 1, setId: 'e2e-test' });
  await page.getByPlaceholder('問題セットのJSONをここに貼り付け').fill(invalid);
  await page.getByRole('button', { name: '貼り付けた内容を追加' }).click();
  await expect(page.getByText(/次の点を直してから/)).toBeVisible();

  // 正しいJSON
  const valid = {
    schemaVersion: 1,
    setId: 'e2e-local-set',
    title: 'E2Eテスト用ローカルセット',
    milestone: 'M1',
    unit: 1,
    problems: [
      {
        id: 'e2e-p01',
        type: 'write',
        title: 'たし算',
        prompt: '1+1を計算してxに代入してください。',
        difficulty: 1,
        estimatedMinutes: 1,
        tags: [],
        hints: [],
        starterCode: '',
        tests: [{ name: 'xが2', code: 'assert x == 2', message: 'xが2ではありません。' }],
        modelAnswer: 'x = 1 + 1',
      },
    ],
  };
  await page.getByPlaceholder('問題セットのJSONをここに貼り付け').fill(JSON.stringify(valid));
  await page.getByRole('button', { name: '貼り付けた内容を追加' }).click();
  await expect(page.getByText(/追加しました/)).toBeVisible();

  await page.goto('/#/sets');
  await expect(page.getByText('E2Eテスト用ローカルセット')).toBeVisible();
  await expect(page.getByText('ローカル')).toBeVisible();
});

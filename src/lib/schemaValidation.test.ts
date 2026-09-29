import { describe, expect, it } from 'vitest';
import schema from '../../schema/problem-set.schema.json';
import { createProblemSetValidator } from './schemaValidation';

const validate = createProblemSetValidator(schema);

const validSet = {
  schemaVersion: 1,
  setId: 'sample',
  title: 'サンプル',
  milestone: 'M1',
  unit: 1,
  problems: [
    {
      id: 'p1',
      type: 'write',
      title: '問題1',
      prompt: '問題文',
      difficulty: 1,
      estimatedMinutes: 5,
      tags: [],
      hints: [],
      starterCode: '',
      tests: [{ name: 't1', code: 'assert True', message: 'メッセージ' }],
      modelAnswer: 'x = 1',
    },
  ],
};

describe('createProblemSetValidator', () => {
  it('正しい問題セットはエラーなしで通す', () => {
    expect(validate(validSet)).toEqual([]);
  });

  it('必須項目が欠けていると日本語のエラーを返す(設定画面の貼り付けインポートで使われる)', () => {
    const { unit: _unit, ...broken } = validSet;
    const issues = validate(broken);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.message.includes('unit'))).toBe(true);
  });

  it('JSONとして壊れている場合はJSON.parseの時点で例外になる(SettingsPageはtry/catchで捕まえる)', () => {
    expect(() => JSON.parse('not valid json')).toThrow();
  });

  it('typeの値が不正だと日本語のエラーを返す', () => {
    const broken = { ...validSet, problems: [{ ...validSet.problems[0], type: 'unknown' }] };
    const issues = validate(broken);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('write問題にtestsやmodelAnswerがないと日本語のエラーを返す', () => {
    const { tests: _t, modelAnswer: _m, ...incomplete } = validSet.problems[0];
    const broken = { ...validSet, problems: [incomplete] };
    const issues = validate(broken);
    expect(issues.length).toBeGreaterThan(0);
  });
});

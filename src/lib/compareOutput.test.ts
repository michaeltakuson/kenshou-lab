import { describe, expect, it } from 'vitest';
import { judgeReadAnswer, normalizeOutputText, outputsMatch } from './compareOutput';

describe('normalizeOutputText', () => {
  it('CRLFをLFに統一する', () => {
    expect(normalizeOutputText('a\r\nb\r\n')).toBe('a\nb');
  });

  it('各行末の空白を除去する', () => {
    expect(normalizeOutputText('a  \nb\t\n')).toBe('a\nb');
  });

  it('末尾の空行をすべて除去する', () => {
    expect(normalizeOutputText('a\nb\n\n\n')).toBe('a\nb');
  });

  it('先頭や途中の空行は保持する', () => {
    expect(normalizeOutputText('\na\n\nb\n')).toBe('\na\n\nb');
  });
});

describe('outputsMatch', () => {
  it('改行コードや末尾空白の違いを無視して一致と判定する', () => {
    expect(outputsMatch('3\n4\n', '3\r\n4\r\n\n')).toBe(true);
  });

  it('内容が異なれば不一致と判定する', () => {
    expect(outputsMatch('3\n4\n', '3\n5\n')).toBe(false);
  });
});

describe('judgeReadAnswer', () => {
  it('output: 正規化した上で一致すれば正解', () => {
    expect(judgeReadAnswer({ kind: 'output' }, '10  \n', '10')).toBe(true);
  });

  it('choice: 選択したインデックスがcorrectと一致すれば正解', () => {
    const answer = { kind: 'choice' as const, choices: ['a', 'b', 'c'], correct: 2 };
    expect(judgeReadAnswer(answer, '2', '')).toBe(true);
    expect(judgeReadAnswer(answer, '1', '')).toBe(false);
  });

  it('value: 数値かつtolerance範囲内なら正解', () => {
    const answer = { kind: 'value' as const, value: 3.14, tolerance: 0.01 };
    expect(judgeReadAnswer(answer, '3.145', '')).toBe(true);
    expect(judgeReadAnswer(answer, '3.2', '')).toBe(false);
  });

  it('value: 文字列の場合は正規化して比較する', () => {
    const answer = { kind: 'value' as const, value: 'hello' };
    expect(judgeReadAnswer(answer, 'hello  ', '')).toBe(true);
    expect(judgeReadAnswer(answer, 'world', '')).toBe(false);
  });
});

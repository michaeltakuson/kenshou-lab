import { describe, expect, it } from 'vitest';
import { isCountableMoment, todayLocalDate } from './workTime';

const TWO_MIN = 2 * 60 * 1000;

describe('isCountableMoment', () => {
  it('画面が非表示なら数えない', () => {
    expect(isCountableMoment(1000, 1000, true)).toBe(false);
  });

  it('直近2分以内の操作なら数える', () => {
    expect(isCountableMoment(TWO_MIN, 0, false)).toBe(true);
  });

  it('2分を超えて操作がなければ数えない', () => {
    expect(isCountableMoment(TWO_MIN + 1, 0, false)).toBe(false);
  });

  it('操作直後なら数える', () => {
    expect(isCountableMoment(1000, 1000, false)).toBe(true);
  });
});

describe('todayLocalDate', () => {
  it('YYYY-MM-DD形式でローカル日付を返す', () => {
    const d = new Date(2026, 0, 5); // 2026年1月5日(月は0始まり)
    expect(todayLocalDate(d)).toBe('2026-01-05');
  });

  it('月・日を2桁ゼロ埋めする', () => {
    const d = new Date(2026, 8, 9); // 2026年9月9日
    expect(todayLocalDate(d)).toBe('2026-09-09');
  });
});

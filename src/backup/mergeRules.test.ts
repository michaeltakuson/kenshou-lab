import { describe, expect, it } from 'vitest';
import { isDuplicateEvent, mergeTimeLogEntry, shouldReplaceProgress } from './mergeRules';
import { defaultProgress } from '../records/types';

describe('shouldReplaceProgress', () => {
  it('既存がなければ常に取り込む', () => {
    const incoming = defaultProgress('s', 'p');
    expect(shouldReplaceProgress(undefined, incoming)).toBe(true);
  });

  it('取り込む方が新しければ置き換える', () => {
    const existing = { ...defaultProgress('s', 'p'), updatedAt: '2026-01-01T00:00:00.000Z' };
    const incoming = { ...defaultProgress('s', 'p'), updatedAt: '2026-01-02T00:00:00.000Z' };
    expect(shouldReplaceProgress(existing, incoming)).toBe(true);
  });

  it('既存の方が新しければ置き換えない', () => {
    const existing = { ...defaultProgress('s', 'p'), updatedAt: '2026-01-05T00:00:00.000Z' };
    const incoming = { ...defaultProgress('s', 'p'), updatedAt: '2026-01-02T00:00:00.000Z' };
    expect(shouldReplaceProgress(existing, incoming)).toBe(false);
  });
});

describe('isDuplicateEvent', () => {
  it('idが既存集合に含まれれば重複と判定する', () => {
    const ids = new Set(['a', 'b']);
    expect(isDuplicateEvent(ids, 'a')).toBe(true);
    expect(isDuplicateEvent(ids, 'c')).toBe(false);
  });
});

describe('mergeTimeLogEntry', () => {
  it('一致する既存がなければ追加する', () => {
    const action = mergeTimeLogEntry([], { date: '2026-01-01', setId: 's', problemId: 'p', seconds: 60 });
    expect(action).toEqual({ kind: 'add' });
  });

  it('取り込む方の秒数が大きければ更新する', () => {
    const existing = [{ id: 1, date: '2026-01-01', setId: 's', problemId: 'p', seconds: 60 }];
    const action = mergeTimeLogEntry(existing, { date: '2026-01-01', setId: 's', problemId: 'p', seconds: 120 });
    expect(action).toEqual({ kind: 'update', seconds: 120 });
  });

  it('取り込む方の秒数が小さければ何もしない(二重加算防止)', () => {
    const existing = [{ id: 1, date: '2026-01-01', setId: 's', problemId: 'p', seconds: 120 }];
    const action = mergeTimeLogEntry(existing, { date: '2026-01-01', setId: 's', problemId: 'p', seconds: 60 });
    expect(action).toEqual({ kind: 'skip' });
  });
});

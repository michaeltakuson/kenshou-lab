import { describe, expect, it } from 'vitest';
import {
  advanceReviewOnSuccess,
  enterReviewQueue,
  isDueForReview,
  resetReviewOnFailure,
} from './reviewSchedule';

const BASE = new Date('2026-01-01T00:00:00.000Z');

describe('enterReviewQueue', () => {
  it('1日後を次回復習日にする', () => {
    const s = enterReviewQueue(BASE);
    expect(s.reviewStage).toBe(1);
    expect(s.nextReviewAt).toBe('2026-01-02T00:00:00.000Z');
  });
});

describe('advanceReviewOnSuccess', () => {
  it('1日目の成功で3日後に進む', () => {
    const s = advanceReviewOnSuccess(BASE, 1);
    expect(s.reviewStage).toBe(2);
    expect(s.nextReviewAt).toBe('2026-01-04T00:00:00.000Z');
  });

  it('3日目の成功で7日後に進む', () => {
    const s = advanceReviewOnSuccess(BASE, 2);
    expect(s.reviewStage).toBe(3);
    expect(s.nextReviewAt).toBe('2026-01-08T00:00:00.000Z');
  });

  it('7日目の成功で14日後に進む', () => {
    const s = advanceReviewOnSuccess(BASE, 3);
    expect(s.reviewStage).toBe(4);
    expect(s.nextReviewAt).toBe('2026-01-15T00:00:00.000Z');
  });

  it('14日目の成功で卒業する(キューを抜ける)', () => {
    const s = advanceReviewOnSuccess(BASE, 4);
    expect(s.reviewStage).toBe(5);
    expect(s.nextReviewAt).toBeNull();
  });
});

describe('resetReviewOnFailure', () => {
  it('失敗したら1日後に戻る', () => {
    const s = resetReviewOnFailure(BASE);
    expect(s.reviewStage).toBe(1);
    expect(s.nextReviewAt).toBe('2026-01-02T00:00:00.000Z');
  });
});

describe('isDueForReview', () => {
  it('次回復習日を過ぎていれば true', () => {
    const now = new Date('2026-01-03T00:00:00.000Z');
    expect(isDueForReview({ reviewStage: 1, nextReviewAt: '2026-01-02T00:00:00.000Z' }, now)).toBe(true);
  });

  it('次回復習日より前なら false', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(isDueForReview({ reviewStage: 1, nextReviewAt: '2026-01-02T00:00:00.000Z' }, now)).toBe(false);
  });

  it('キューに入っていない(reviewStage 0)なら false', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    expect(isDueForReview({ reviewStage: 0, nextReviewAt: null }, now)).toBe(false);
  });

  it('卒業済み(reviewStage 5)なら false', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    expect(isDueForReview({ reviewStage: 5, nextReviewAt: null }, now)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { generateWeeklyReport, formatHoursMinutes } from './generateReport';
import { defaultProgress } from '../records/types';
import type { EventRecord } from '../records/types';

// ローカル時刻のコンストラクタを使う(formatDateはgetFullYear/getMonth/getDateという
// ローカル時刻ベースのAPIを使っており、todayLocalDate()と同じ考え方のため)。
const FROM = new Date(2026, 0, 1, 0, 0, 0);
const TO = new Date(2026, 0, 7, 23, 59, 59);

function ev(partial: Partial<EventRecord> & Pick<EventRecord, 'setId' | 'problemId' | 'event'>): EventRecord {
  return {
    id: Math.random().toString(),
    ts: '2026-01-03T00:00:00.000Z',
    device: 'test-device',
    ...partial,
  };
}

describe('formatHoursMinutes', () => {
  it('秒を時間と分に変換する', () => {
    expect(formatHoursMinutes(3661)).toBe('1時間1分');
    expect(formatHoursMinutes(59)).toBe('0時間0分');
    expect(formatHoursMinutes(0)).toBe('0時間0分');
  });
});

describe('generateWeeklyReport', () => {
  it('見出しと概要行を指定の形式で出力する', () => {
    const report = generateWeeklyReport({
      from: FROM,
      to: TO,
      events: [],
      progressList: [],
      timeLogs: [],
      problems: [],
    });
    expect(report).toContain('# 週次学習レポート（2026-01-01〜2026-01-07）');
    expect(report).toContain('- 実働時間: 0時間0分');
    expect(report).toContain('- 取り組んだ問題: 0（自力 0 / ヒント 0 / 解答閲覧 0 / 未クリア 0）');
    expect(report).toContain('## 問題別');
    expect(report).toContain('## 予想が外れたもの');
    expect(report).toContain('## 説明できなかったブロック');
    expect(report).toContain('## 詰まりメモ');
    expect(report).toContain('## エラーの内訳');
  });

  it('自力クリアした問題を集計し、問題別テーブルに行を出す', () => {
    const progress = { ...defaultProgress('sample', 'p01'), state: 'cleared_alone' as const };
    const report = generateWeeklyReport({
      from: FROM,
      to: TO,
      events: [
        ev({ setId: 'sample', problemId: 'p01', event: 'open' }),
        ev({ setId: 'sample', problemId: 'p01', event: 'submit' }),
        ev({ setId: 'sample', problemId: 'p01', event: 'pass', data: { outcome: 'clean' } }),
      ],
      progressList: [progress],
      timeLogs: [{ date: '2026-01-03', setId: 'sample', problemId: 'p01', seconds: 125 }],
      problems: [{ setId: 'sample', problemId: 'p01', type: 'write' }],
    });
    expect(report).toContain('取り組んだ問題: 1（自力 1 / ヒント 0 / 解答閲覧 0 / 未クリア 0）');
    expect(report).toContain('| p01 | 書く | 自力 | 1 | 0 | 0時間2分 |  |');
  });

  it('読む形式で不正解だった予想を「予想が外れたもの」に含める', () => {
    const report = generateWeeklyReport({
      from: FROM,
      to: TO,
      events: [
        ev({
          setId: 'sample',
          problemId: 'p03',
          event: 'submit',
          data: { answer: '10', actualOutput: '8', correct: false },
        }),
      ],
      progressList: [],
      timeLogs: [],
      problems: [{ setId: 'sample', problemId: 'p03', type: 'read' }],
    });
    expect(report).toContain('- p03：予想「10」→ 実際「8」');
  });

  it('あいまい/できなかった評価のブロックを「説明できなかったブロック」に含める', () => {
    const progress = {
      ...defaultProgress('sample', 'p06'),
      explainState: [
        { explanation: 'よくわからない', assessment: 'あいまい' as const },
        { explanation: '合計している', assessment: 'できた' as const },
      ],
    };
    const report = generateWeeklyReport({
      from: FROM,
      to: TO,
      events: [],
      progressList: [progress],
      timeLogs: [],
      problems: [
        {
          setId: 'sample',
          problemId: 'p06',
          type: 'explain',
          blocks: [{ lines: [1, 2] }, { lines: [3, 3] }],
        },
      ],
    });
    expect(report).toContain('- p06 行1〜2：自己評価「あいまい」／あなたの説明「よくわからない」');
  });

  it('エラーの内訳を回数の多い順に出す', () => {
    const report = generateWeeklyReport({
      from: FROM,
      to: TO,
      events: [
        ev({ setId: 's', problemId: 'p', event: 'error', data: { name: 'KeyError' } }),
        ev({ setId: 's', problemId: 'p', event: 'error', data: { name: 'KeyError' } }),
        ev({ setId: 's', problemId: 'p', event: 'error', data: { name: 'TypeError' } }),
      ],
      progressList: [],
      timeLogs: [],
      problems: [],
    });
    expect(report).toContain('- KeyError: 2回');
    expect(report).toContain('- TypeError: 1回');
  });
});

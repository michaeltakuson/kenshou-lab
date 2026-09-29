// 検証ラボ: 学習の記録・進捗まわりの型(SPEC.md 第6〜8章)。

export type ProblemState =
  | 'not_started'
  | 'in_progress'
  | 'cleared_alone'
  | 'cleared_with_hint'
  | 'answer_viewed'
  | 'cleared_by_review';

export interface ExplainBlockState {
  explanation: string;
  assessment: 'できた' | 'あいまい' | 'できなかった' | null;
}

/**
 * 問題1件ごとの進捗と、現在の挑戦サイクルの状態。
 * 「サイクル」とは、最初の挑戦、または復習で初期コードから解き直す1回分を指す。
 * ヒント数・不合格回数・解答閲覧は、新しいサイクルが始まるたびにリセットする。
 */
export interface ProblemProgress {
  key: string; // `${setId}:${problemId}`
  setId: string;
  problemId: string;
  state: ProblemState;
  code: string | null;
  hintsOpenedCount: number;
  failCount: number;
  answerViewed: boolean;
  predictAnswer: string | null;
  stuckNote: string | null;
  explainState: ExplainBlockState[] | null;
  modifyTaskCode: string | null;
  /** 0=復習キュー外, 1〜4=1/3/7/14日, 5=卒業(キューを抜けた) */
  reviewStage: number;
  nextReviewAt: string | null;
  updatedAt: string;
}

export function defaultProgress(setId: string, problemId: string): ProblemProgress {
  return {
    key: `${setId}:${problemId}`,
    setId,
    problemId,
    state: 'not_started',
    code: null,
    hintsOpenedCount: 0,
    failCount: 0,
    answerViewed: false,
    predictAnswer: null,
    stuckNote: null,
    explainState: null,
    modifyTaskCode: null,
    reviewStage: 0,
    nextReviewAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export type EventType =
  | 'open'
  | 'run'
  | 'submit'
  | 'pass'
  | 'fail'
  | 'error'
  | 'hint'
  | 'answer_viewed'
  | 'predict'
  | 'self_assess'
  | 'stuck_note'
  | 'review_result';

export interface EventRecord {
  id: string;
  ts: string;
  device: string;
  setId: string;
  problemId: string;
  event: EventType;
  data?: Record<string, unknown>;
}

export interface TimeLogEntry {
  id?: number;
  date: string; // YYYY-MM-DD (ローカル日付)
  setId: string;
  problemId: string;
  seconds: number;
}

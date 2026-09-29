import { getDb } from '../db/db';
import { logEvent } from './eventLog';
import { advanceReviewOnSuccess, enterReviewQueue, resetReviewOnFailure } from './reviewSchedule';
import { defaultProgress, type ProblemProgress } from './types';

function key(setId: string, problemId: string): string {
  return `${setId}:${problemId}`;
}

/**
 * 同じ問題に対する「読み取り→書き換え→保存」が並行して走ると、
 * 後勝ちのつもりが古い値で上書きしてしまう競合が起きる
 * (例: コードエディタでの高速な入力のたびにsaveDraftCodeを呼ぶ場合)。
 * 同じキーへの操作を1本の待ち行列にして、常に呼び出した順に実行されるようにする。
 */
const writeQueues = new Map<string, Promise<unknown>>();

function withProgressLock<T>(setId: string, problemId: string, fn: () => Promise<T>): Promise<T> {
  const k = key(setId, problemId);
  const previous = writeQueues.get(k) ?? Promise.resolve();
  const result = previous.then(fn, fn);
  // このキュー自体は失敗しても止めない(個々の呼び出し元がエラーを扱う)。
  writeQueues.set(
    k,
    result.catch(() => undefined),
  );
  return result;
}

export async function getProgress(setId: string, problemId: string): Promise<ProblemProgress> {
  const db = await getDb();
  const existing = await db.get('progress', key(setId, problemId));
  return existing ?? defaultProgress(setId, problemId);
}

export async function saveProgress(progress: ProblemProgress): Promise<void> {
  const db = await getDb();
  await db.put('progress', progress);
}

export async function listProgressForSet(setId: string): Promise<ProblemProgress[]> {
  const db = await getDb();
  return db.getAllFromIndex('progress', 'by-setId', setId);
}

export async function listAllProgress(): Promise<ProblemProgress[]> {
  const db = await getDb();
  return db.getAll('progress');
}

/** 問題を開いたときに呼ぶ。未着手なら挑戦中にする。 */
export async function markOpened(setId: string, problemId: string): Promise<ProblemProgress> {
  const p = await withProgressLock(setId, problemId, async () => {
    const current = await getProgress(setId, problemId);
    if (current.state === 'not_started') {
      current.state = 'in_progress';
      current.updatedAt = new Date().toISOString();
      await saveProgress(current);
    }
    return current;
  });
  await logEvent(setId, problemId, 'open');
  return p;
}

export async function recordHintOpened(setId: string, problemId: string, hintIndex: number): Promise<ProblemProgress> {
  const p = await withProgressLock(setId, problemId, async () => {
    const current = await getProgress(setId, problemId);
    current.hintsOpenedCount = Math.max(current.hintsOpenedCount, hintIndex + 1);
    current.updatedAt = new Date().toISOString();
    await saveProgress(current);
    return current;
  });
  await logEvent(setId, problemId, 'hint', { hintIndex });
  return p;
}

export async function recordSubmitFailure(setId: string, problemId: string, reason: string): Promise<ProblemProgress> {
  const p = await withProgressLock(setId, problemId, async () => {
    const current = await getProgress(setId, problemId);
    current.failCount += 1;
    current.updatedAt = new Date().toISOString();
    await saveProgress(current);
    return current;
  });
  await logEvent(setId, problemId, 'fail', { reason });
  return p;
}

export async function recordAnswerViewed(setId: string, problemId: string): Promise<ProblemProgress> {
  const p = await withProgressLock(setId, problemId, async () => {
    const current = await getProgress(setId, problemId);
    current.answerViewed = true;
    current.state = 'answer_viewed';
    if (current.reviewStage === 0) {
      const sched = enterReviewQueue(new Date());
      current.reviewStage = sched.reviewStage;
      current.nextReviewAt = sched.nextReviewAt;
    }
    current.updatedAt = new Date().toISOString();
    await saveProgress(current);
    return current;
  });
  await logEvent(setId, problemId, 'answer_viewed');
  return p;
}

export async function recordPredict(setId: string, problemId: string, answer: string): Promise<void> {
  await withProgressLock(setId, problemId, async () => {
    const current = await getProgress(setId, problemId);
    current.predictAnswer = answer;
    current.updatedAt = new Date().toISOString();
    await saveProgress(current);
  });
  await logEvent(setId, problemId, 'predict', { answer });
}

export async function recordStuckNote(setId: string, problemId: string, note: string): Promise<void> {
  await withProgressLock(setId, problemId, async () => {
    const current = await getProgress(setId, problemId);
    current.stuckNote = note;
    current.updatedAt = new Date().toISOString();
    await saveProgress(current);
  });
  await logEvent(setId, problemId, 'stuck_note', { note });
}

export async function saveDraftCode(setId: string, problemId: string, code: string): Promise<void> {
  await withProgressLock(setId, problemId, async () => {
    const current = await getProgress(setId, problemId);
    current.code = code;
    current.updatedAt = new Date().toISOString();
    await saveProgress(current);
  });
}

/**
 * 挑戦サイクル(最初の挑戦、または復習1回分)の合否が確定したときに呼ぶ。
 * ヒント・解答閲覧の有無と、復習サイクルかどうかで次の状態と復習間隔を決める。
 */
export async function finalizeCycle(
  setId: string,
  problemId: string,
  outcome: 'clean' | 'needed_help',
): Promise<ProblemProgress> {
  let wasReview = false;
  const p = await withProgressLock(setId, problemId, async () => {
    const current = await getProgress(setId, problemId);
    const now = new Date();
    wasReview = current.reviewStage >= 1 && current.reviewStage <= 4;

    if (current.reviewStage === 0) {
      if (outcome === 'clean') {
        current.state = 'cleared_alone';
      } else {
        current.state = current.answerViewed ? 'answer_viewed' : 'cleared_with_hint';
        const sched = enterReviewQueue(now);
        current.reviewStage = sched.reviewStage;
        current.nextReviewAt = sched.nextReviewAt;
      }
    } else {
      if (outcome === 'clean') {
        const sched = advanceReviewOnSuccess(now, current.reviewStage);
        current.reviewStage = sched.reviewStage;
        current.nextReviewAt = sched.nextReviewAt;
        current.state = 'cleared_by_review';
      } else {
        const sched = resetReviewOnFailure(now);
        current.reviewStage = sched.reviewStage;
        current.nextReviewAt = sched.nextReviewAt;
        current.state = current.answerViewed ? 'answer_viewed' : 'cleared_with_hint';
      }
    }

    current.hintsOpenedCount = 0;
    current.failCount = 0;
    current.answerViewed = false;
    current.updatedAt = now.toISOString();
    await saveProgress(current);
    return current;
  });

  await logEvent(setId, problemId, 'pass', {
    outcome,
    reviewStage: p.reviewStage,
    state: p.state,
    wasReview,
    reviewSuccess: wasReview ? outcome === 'clean' : undefined,
  });
  return p;
}

/** 説明する問題の、ブロックごとの説明・自己評価を保存する。 */
export async function saveExplainState(progress: ProblemProgress): Promise<void> {
  await withProgressLock(progress.setId, progress.problemId, () => saveProgress(progress));
}

/** 改変課題の書きかけコードを保存する。 */
export async function saveModifyTaskCode(progress: ProblemProgress): Promise<void> {
  await withProgressLock(progress.setId, progress.problemId, () => saveProgress(progress));
}

/** 復習として解き直すときに呼ぶ。前回のコードではなく初期コードから始める(SPEC.md第8章)。 */
export async function startReviewAttempt(setId: string, problemId: string, starterCode: string): Promise<ProblemProgress> {
  return withProgressLock(setId, problemId, async () => {
    const current = await getProgress(setId, problemId);
    current.code = starterCode;
    current.hintsOpenedCount = 0;
    current.failCount = 0;
    current.answerViewed = false;
    current.explainState = null;
    current.modifyTaskCode = null;
    current.updatedAt = new Date().toISOString();
    await saveProgress(current);
    return current;
  });
}

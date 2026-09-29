import { getDb } from '../db/db';
import { logEvent } from './eventLog';
import { advanceReviewOnSuccess, enterReviewQueue, resetReviewOnFailure } from './reviewSchedule';
import { defaultProgress, type ProblemProgress } from './types';

function key(setId: string, problemId: string): string {
  return `${setId}:${problemId}`;
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
  const p = await getProgress(setId, problemId);
  if (p.state === 'not_started') {
    p.state = 'in_progress';
    p.updatedAt = new Date().toISOString();
    await saveProgress(p);
  }
  await logEvent(setId, problemId, 'open');
  return p;
}

export async function recordHintOpened(setId: string, problemId: string, hintIndex: number): Promise<ProblemProgress> {
  const p = await getProgress(setId, problemId);
  p.hintsOpenedCount = Math.max(p.hintsOpenedCount, hintIndex + 1);
  p.updatedAt = new Date().toISOString();
  await saveProgress(p);
  await logEvent(setId, problemId, 'hint', { hintIndex });
  return p;
}

export async function recordSubmitFailure(setId: string, problemId: string, reason: string): Promise<ProblemProgress> {
  const p = await getProgress(setId, problemId);
  p.failCount += 1;
  p.updatedAt = new Date().toISOString();
  await saveProgress(p);
  await logEvent(setId, problemId, 'fail', { reason });
  return p;
}

export async function recordAnswerViewed(setId: string, problemId: string): Promise<ProblemProgress> {
  const p = await getProgress(setId, problemId);
  p.answerViewed = true;
  p.state = 'answer_viewed';
  if (p.reviewStage === 0) {
    const sched = enterReviewQueue(new Date());
    p.reviewStage = sched.reviewStage;
    p.nextReviewAt = sched.nextReviewAt;
  }
  p.updatedAt = new Date().toISOString();
  await saveProgress(p);
  await logEvent(setId, problemId, 'answer_viewed');
  return p;
}

export async function recordPredict(setId: string, problemId: string, answer: string): Promise<void> {
  const p = await getProgress(setId, problemId);
  p.predictAnswer = answer;
  p.updatedAt = new Date().toISOString();
  await saveProgress(p);
  await logEvent(setId, problemId, 'predict', { answer });
}

export async function recordStuckNote(setId: string, problemId: string, note: string): Promise<void> {
  const p = await getProgress(setId, problemId);
  p.stuckNote = note;
  p.updatedAt = new Date().toISOString();
  await saveProgress(p);
  await logEvent(setId, problemId, 'stuck_note', { note });
}

export async function saveDraftCode(setId: string, problemId: string, code: string): Promise<void> {
  const p = await getProgress(setId, problemId);
  p.code = code;
  p.updatedAt = new Date().toISOString();
  await saveProgress(p);
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
  const p = await getProgress(setId, problemId);
  const now = new Date();

  if (p.reviewStage === 0) {
    if (outcome === 'clean') {
      p.state = 'cleared_alone';
    } else {
      p.state = p.answerViewed ? 'answer_viewed' : 'cleared_with_hint';
      const sched = enterReviewQueue(now);
      p.reviewStage = sched.reviewStage;
      p.nextReviewAt = sched.nextReviewAt;
    }
  } else {
    if (outcome === 'clean') {
      const sched = advanceReviewOnSuccess(now, p.reviewStage);
      p.reviewStage = sched.reviewStage;
      p.nextReviewAt = sched.nextReviewAt;
      p.state = 'cleared_by_review';
    } else {
      const sched = resetReviewOnFailure(now);
      p.reviewStage = sched.reviewStage;
      p.nextReviewAt = sched.nextReviewAt;
      p.state = p.answerViewed ? 'answer_viewed' : 'cleared_with_hint';
    }
  }

  p.hintsOpenedCount = 0;
  p.failCount = 0;
  p.answerViewed = false;
  p.updatedAt = now.toISOString();
  await saveProgress(p);
  await logEvent(setId, problemId, 'pass', { outcome, reviewStage: p.reviewStage, state: p.state });
  return p;
}

/** 復習として解き直すときに呼ぶ。前回のコードではなく初期コードから始める(SPEC.md第8章)。 */
export async function startReviewAttempt(setId: string, problemId: string, starterCode: string): Promise<ProblemProgress> {
  const p = await getProgress(setId, problemId);
  p.code = starterCode;
  p.hintsOpenedCount = 0;
  p.failCount = 0;
  p.answerViewed = false;
  p.explainState = null;
  p.modifyTaskCode = null;
  p.updatedAt = new Date().toISOString();
  await saveProgress(p);
  return p;
}

// 検証ラボ: 復習キューの間隔計算(SPEC.md第8章)。
// 間隔は 1日→3日→7日→14日。ヒントも解答も見ずにクリアしたら次の間隔へ進み、
// 14日後の復習で成功したら卒業。失敗したら1日に戻る。
//
// reviewStage: 0=キュー外, 1〜4=1/3/7/14日の各段階, 5=卒業(キューを抜けた)

export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14] as const;

export interface ReviewSchedule {
  reviewStage: number;
  nextReviewAt: string | null;
}

function addDaysIso(base: Date, days: number): string {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** 自力クリア以外(ヒント使用/解答閲覧)になった問題を、初めて復習キューに入れる。 */
export function enterReviewQueue(now: Date): ReviewSchedule {
  return { reviewStage: 1, nextReviewAt: addDaysIso(now, REVIEW_INTERVALS_DAYS[0]) };
}

/** 復習でヒント・解答を見ずにクリアできたとき: 次の間隔へ進む(14日の次は卒業)。 */
export function advanceReviewOnSuccess(now: Date, currentStage: number): ReviewSchedule {
  const nextIndex = currentStage; // currentStageは1始まり。次の間隔はconfigの[currentStage]番目(0始まり)。
  if (nextIndex >= REVIEW_INTERVALS_DAYS.length) {
    return { reviewStage: 5, nextReviewAt: null };
  }
  return { reviewStage: currentStage + 1, nextReviewAt: addDaysIso(now, REVIEW_INTERVALS_DAYS[nextIndex]) };
}

/** 復習でヒントや解答が必要だったとき: 1日後に戻す。 */
export function resetReviewOnFailure(now: Date): ReviewSchedule {
  return { reviewStage: 1, nextReviewAt: addDaysIso(now, REVIEW_INTERVALS_DAYS[0]) };
}

export function isDueForReview(
  schedule: Pick<ReviewSchedule, 'reviewStage' | 'nextReviewAt'>,
  now: Date,
): boolean {
  if (schedule.reviewStage < 1 || schedule.reviewStage > 4) return false;
  if (!schedule.nextReviewAt) return false;
  return new Date(schedule.nextReviewAt).getTime() <= now.getTime();
}

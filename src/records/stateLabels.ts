import type { ProblemState } from './types';

export const STATE_LABELS: Record<ProblemState, string> = {
  not_started: '未着手',
  in_progress: '挑戦中',
  cleared_alone: '自力クリア',
  cleared_with_hint: 'ヒント使用クリア',
  answer_viewed: '解答閲覧',
  cleared_by_review: '復習でクリア',
};

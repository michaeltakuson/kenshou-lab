// 検証ラボ: バックアップ復元のマージ判定ロジック(SPEC.md第12章)を、
// IndexedDBに依存しない純粋関数として切り出したもの(単体テスト用)。
import type { ProblemProgress, TimeLogEntry } from '../records/types';

/** 進捗は、updatedAtが新しい方を残す(端末をまたいだ統合)。 */
export function shouldReplaceProgress(existing: ProblemProgress | undefined, incoming: ProblemProgress): boolean {
  if (!existing) return true;
  return new Date(incoming.updatedAt).getTime() > new Date(existing.updatedAt).getTime();
}

/** イベントはidで重複を除く。 */
export function isDuplicateEvent(existingIds: ReadonlySet<string>, eventId: string): boolean {
  return existingIds.has(eventId);
}

export type TimeLogMergeAction =
  | { kind: 'add' }
  | { kind: 'update'; seconds: number }
  | { kind: 'skip' };

/**
 * 同じ日付・問題の実働時間ログは、大きい方を採用する。
 * (同じバックアップを二重に取り込んでも実働時間が二重加算されないようにするため)
 */
export function mergeTimeLogEntry(
  existing: TimeLogEntry[],
  incoming: TimeLogEntry,
): TimeLogMergeAction {
  const match = existing.find(
    (t) => t.date === incoming.date && t.setId === incoming.setId && t.problemId === incoming.problemId,
  );
  if (!match) return { kind: 'add' };
  if (incoming.seconds > match.seconds) return { kind: 'update', seconds: incoming.seconds };
  return { kind: 'skip' };
}

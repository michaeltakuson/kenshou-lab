// 検証ラボ: バックアップの書き出しと、端末をまたいだ復元(SPEC.md第12章)。
import { getDb } from '../db/db';
import { setLastBackupAt } from '../records/meta';
import { mergeTimeLogEntry, shouldReplaceProgress } from './mergeRules';
import type { ProblemSet } from '../problems/types';
import type { EventRecord, ProblemProgress, TimeLogEntry } from '../records/types';

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupData {
  schemaVersion: number;
  exportedAt: string;
  localProblemSets: ProblemSet[];
  progress: ProblemProgress[];
  events: EventRecord[];
  timeLog: TimeLogEntry[];
}

export interface ImportSummary {
  addedEvents: number;
  skippedDuplicateEvents: number;
  upsertedProgress: number;
  upsertedProblemSets: number;
  addedOrUpdatedTimeLog: number;
}

export async function exportBackup(): Promise<BackupData> {
  const db = await getDb();
  const [localProblemSets, progress, events, timeLog] = await Promise.all([
    db.getAll('localProblemSets'),
    db.getAll('progress'),
    db.getAll('events'),
    db.getAll('timeLog'),
  ]);
  const exportedAt = new Date().toISOString();
  await setLastBackupAt(exportedAt);
  return { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, localProblemSets, progress, events, timeLog };
}

export function backupFileName(exportedAt: string): string {
  const d = new Date(exportedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `kenshou-lab-backup-${stamp}.json`;
}

/**
 * バックアップを取り込み、既存データとマージする(上書きではない)。
 * - events: idで重複を除く(SPEC.mdが明示するマージ規則)
 * - progress: 同じ問題は updatedAt が新しい方を残す
 * - localProblemSets: setIdでアップサート(問題セットの内容は取り込んだもので更新)
 * - timeLog: 同じ日付・問題の組み合わせがあれば、実働時間は大きい方を採用
 *   (同じバックアップを二重に取り込んでも実働時間が二重加算されないようにするため)
 */
export async function importBackup(data: BackupData): Promise<ImportSummary> {
  const db = await getDb();
  const summary: ImportSummary = {
    addedEvents: 0,
    skippedDuplicateEvents: 0,
    upsertedProgress: 0,
    upsertedProblemSets: 0,
    addedOrUpdatedTimeLog: 0,
  };

  for (const set of data.localProblemSets ?? []) {
    await db.put('localProblemSets', set);
    summary.upsertedProblemSets++;
  }

  for (const incoming of data.progress ?? []) {
    const existing = await db.get('progress', incoming.key);
    if (shouldReplaceProgress(existing, incoming)) {
      await db.put('progress', incoming);
      summary.upsertedProgress++;
    }
  }

  for (const event of data.events ?? []) {
    const existing = await db.get('events', event.id);
    if (existing) {
      summary.skippedDuplicateEvents++;
      continue;
    }
    await db.put('events', event);
    summary.addedEvents++;
  }

  const existingTimeLog = await db.getAll('timeLog');
  for (const incoming of data.timeLog ?? []) {
    const action = mergeTimeLogEntry(existingTimeLog, incoming);
    if (action.kind === 'add') {
      const { id: _ignoredId, ...rest } = incoming;
      const newId = await db.add('timeLog', rest as TimeLogEntry);
      existingTimeLog.push({ ...rest, id: newId as number });
      summary.addedOrUpdatedTimeLog++;
    } else if (action.kind === 'update') {
      const match = existingTimeLog.find(
        (t) => t.date === incoming.date && t.setId === incoming.setId && t.problemId === incoming.problemId,
      );
      if (match) {
        match.seconds = action.seconds;
        await db.put('timeLog', match);
        summary.addedOrUpdatedTimeLog++;
      }
    }
  }

  return summary;
}

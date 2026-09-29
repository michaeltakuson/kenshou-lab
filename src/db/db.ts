import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProblemSet } from '../problems/types';
import type { EventRecord, ProblemProgress, TimeLogEntry } from '../records/types';

interface KenshouDB extends DBSchema {
  localProblemSets: {
    key: string;
    value: ProblemSet;
  };
  progress: {
    key: string;
    value: ProblemProgress;
    indexes: { 'by-setId': string };
  };
  events: {
    key: string;
    value: EventRecord;
    indexes: { 'by-ts': string };
  };
  timeLog: {
    key: number;
    value: TimeLogEntry;
    indexes: { 'by-date': string };
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
}

const DB_NAME = 'kenshou-lab';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<KenshouDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<KenshouDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KenshouDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('localProblemSets')) {
          db.createObjectStore('localProblemSets', { keyPath: 'setId' });
        }
        if (!db.objectStoreNames.contains('progress')) {
          const store = db.createObjectStore('progress', { keyPath: 'key' });
          store.createIndex('by-setId', 'setId');
        }
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'id' });
          store.createIndex('by-ts', 'ts');
        }
        if (!db.objectStoreNames.contains('timeLog')) {
          const store = db.createObjectStore('timeLog', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-date', 'date');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/** 設定画面の「全データ削除」から呼ぶ。呼び出し側で2段階確認を行うこと。 */
export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await Promise.all(
    (['localProblemSets', 'progress', 'events', 'timeLog', 'meta'] as const).map((name) => db.clear(name)),
  );
}

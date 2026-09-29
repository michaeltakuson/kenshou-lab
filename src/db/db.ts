import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProblemSet } from '../problems/types';

interface KenshouDB extends DBSchema {
  localProblemSets: {
    key: string;
    value: ProblemSet;
  };
}

const DB_NAME = 'kenshou-lab';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<KenshouDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<KenshouDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KenshouDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('localProblemSets')) {
          db.createObjectStore('localProblemSets', { keyPath: 'setId' });
        }
      },
    });
  }
  return dbPromise;
}

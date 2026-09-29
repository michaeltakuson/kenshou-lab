import { useEffect, useRef } from 'react';
import { getDb } from '../db/db';
import type { TimeLogEntry } from './types';

/** 画面が表示中で、かつ直近2分以内に入力・操作があった時間だけを数える(SPEC.md第7章)。 */
const ACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;
const TICK_MS = 1000;
const FLUSH_INTERVAL_MS = 10_000;

/**
 * この瞬間を実働時間として数えてよいか(画面が表示中で、かつ直近2分以内に操作があったか)。
 * SPEC.md第7章の計算ルールを純粋関数として切り出し、単体テストできるようにしたもの。
 */
export function isCountableMoment(nowMs: number, lastActivityMs: number, hidden: boolean): boolean {
  if (hidden) return false;
  return nowMs - lastActivityMs <= ACTIVITY_TIMEOUT_MS;
}

export function todayLocalDate(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function flushSeconds(setId: string, problemId: string, seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const db = await getDb();
  const date = todayLocalDate();
  const tx = db.transaction('timeLog', 'readwrite');
  const store = tx.objectStore('timeLog');
  const index = store.index('by-date');
  let cursor = await index.openCursor(IDBKeyRange.only(date));
  let matched: TimeLogEntry | undefined;
  while (cursor) {
    if (cursor.value.setId === setId && cursor.value.problemId === problemId) {
      matched = cursor.value;
      break;
    }
    cursor = await cursor.continue();
  }
  if (matched) {
    matched.seconds += seconds;
    await store.put(matched);
  } else {
    await store.add({ date, setId, problemId, seconds });
  }
  await tx.done;
}

/** 問題画面が開いている間、実働時間を計測してtimeLogに定期保存する。 */
export function useWorkingTime(setId: string, problemId: string): void {
  const lastActivityRef = useRef(0);
  const pendingSecondsRef = useRef(0);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    pendingSecondsRef.current = 0;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    const activityEvents: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    for (const ev of activityEvents) window.addEventListener(ev, markActive, { passive: true });

    const tickInterval = window.setInterval(() => {
      if (isCountableMoment(Date.now(), lastActivityRef.current, document.hidden)) {
        pendingSecondsRef.current += 1;
      }
    }, TICK_MS);

    const flushInterval = window.setInterval(() => {
      const seconds = pendingSecondsRef.current;
      pendingSecondsRef.current = 0;
      void flushSeconds(setId, problemId, seconds);
    }, FLUSH_INTERVAL_MS);

    return () => {
      for (const ev of activityEvents) window.removeEventListener(ev, markActive);
      window.clearInterval(tickInterval);
      window.clearInterval(flushInterval);
      const seconds = pendingSecondsRef.current;
      pendingSecondsRef.current = 0;
      void flushSeconds(setId, problemId, seconds);
    };
  }, [setId, problemId]);
}

export async function getTotalSecondsForSet(setId: string): Promise<number> {
  const db = await getDb();
  const all = await db.getAll('timeLog');
  return all.filter((e) => e.setId === setId).reduce((sum, e) => sum + e.seconds, 0);
}

export async function getTimeLogBetween(fromDate: string, toDate: string) {
  const db = await getDb();
  const range = IDBKeyRange.bound(fromDate, toDate);
  return db.getAllFromIndex('timeLog', 'by-date', range);
}

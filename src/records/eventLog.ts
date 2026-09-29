import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/db';
import { getDeviceId } from './meta';
import type { EventRecord, EventType } from './types';

export async function logEvent(
  setId: string,
  problemId: string,
  event: EventType,
  data?: Record<string, unknown>,
): Promise<void> {
  const device = await getDeviceId();
  const record: EventRecord = {
    id: uuidv4(),
    ts: new Date().toISOString(),
    device,
    setId,
    problemId,
    event,
    data,
  };
  const db = await getDb();
  await db.put('events', record);
}

export async function listEventsBetween(fromIso: string, toIso: string): Promise<EventRecord[]> {
  const db = await getDb();
  const range = IDBKeyRange.bound(fromIso, toIso);
  return db.getAllFromIndex('events', 'by-ts', range);
}

export async function listAllEvents(): Promise<EventRecord[]> {
  const db = await getDb();
  return db.getAll('events');
}

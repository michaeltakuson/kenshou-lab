import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/db';

let cachedDeviceId: string | null = null;

/** ブラウザ(端末)ごとのランダムID。イベント記録のdeviceフィールドに使う(SPEC.md第7章)。 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const db = await getDb();
  const existing = await db.get('meta', 'deviceId');
  if (existing) {
    cachedDeviceId = existing.value;
    return existing.value;
  }
  const id = uuidv4();
  await db.put('meta', { key: 'deviceId', value: id });
  cachedDeviceId = id;
  return id;
}

export async function getLastBackupAt(): Promise<string | null> {
  const db = await getDb();
  const rec = await db.get('meta', 'lastBackupAt');
  return rec?.value ?? null;
}

export async function setLastBackupAt(iso: string): Promise<void> {
  const db = await getDb();
  await db.put('meta', { key: 'lastBackupAt', value: iso });
}

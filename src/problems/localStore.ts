import { getDb } from '../db/db';
import type { ProblemSet, ProblemSetSummary } from './types';

function toSummary(set: ProblemSet): ProblemSetSummary {
  return {
    setId: set.setId,
    title: set.title,
    milestone: set.milestone,
    unit: set.unit,
    description: set.description,
    problemCount: set.problems.length,
    source: 'local',
  };
}

export async function listLocalProblemSets(): Promise<ProblemSetSummary[]> {
  const db = await getDb();
  const all = await db.getAll('localProblemSets');
  return all.map(toSummary);
}

export async function getLocalProblemSet(setId: string): Promise<ProblemSet | undefined> {
  const db = await getDb();
  return db.get('localProblemSets', setId);
}

export async function hasLocalProblemSet(setId: string): Promise<boolean> {
  return (await getLocalProblemSet(setId)) !== undefined;
}

export async function saveLocalProblemSet(set: ProblemSet): Promise<void> {
  const db = await getDb();
  await db.put('localProblemSets', set);
}

export async function deleteLocalProblemSet(setId: string): Promise<void> {
  const db = await getDb();
  await db.delete('localProblemSets', setId);
}

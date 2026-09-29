import { fetchRepoProblemSet, listRepoProblemSets } from './repoLoader';
import { getLocalProblemSet, listLocalProblemSets } from './localStore';
import type { ProblemSet, ProblemSetSource, ProblemSetSummary } from './types';

export async function listAllProblemSets(): Promise<ProblemSetSummary[]> {
  const [repo, local] = await Promise.all([listRepoProblemSets(), listLocalProblemSets()]);
  return [...repo, ...local];
}

export async function loadProblemSet(setId: string, source: ProblemSetSource): Promise<ProblemSet> {
  if (source === 'local') {
    const set = await getLocalProblemSet(setId);
    if (!set) throw new Error(`ローカルの問題セット「${setId}」が見つかりません。`);
    return set;
  }
  return fetchRepoProblemSet(setId);
}

import type { ProblemSet, ProblemSetSummary } from './types';

interface RepoProblemSetMeta {
  setId: string;
  title: string;
  milestone: ProblemSet['milestone'];
  unit: number;
  description?: string;
  problemCount: number;
}

/**
 * public/problems/index.json はビルド時(およびdevサーバー起動時)に
 * scripts/problemIndex.ts が自動生成する。手動更新はしない(SPEC.md 10.1)。
 */
export async function listRepoProblemSets(): Promise<ProblemSetSummary[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}problems/index.json`);
  if (!res.ok) return [];
  const metas = (await res.json()) as RepoProblemSetMeta[];
  return metas.map((m) => ({ ...m, source: 'repo' as const }));
}

export async function fetchRepoProblemSet(setId: string): Promise<ProblemSet> {
  const res = await fetch(`${import.meta.env.BASE_URL}problems/${setId}.json`);
  if (!res.ok) {
    throw new Error(`問題セット「${setId}」を読み込めませんでした。`);
  }
  return (await res.json()) as ProblemSet;
}

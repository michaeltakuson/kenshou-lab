// public/problems/index.json を自動生成する。
// SPEC.md 10.1: 「問題セット一覧はビルド時にフォルダを走査して自動生成する(手で一覧を更新しない)」
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface RepoProblemSetMeta {
  setId: string;
  title: string;
  milestone: string;
  unit: number;
  description?: string;
  problemCount: number;
}

export function generateProblemIndex(problemsDir: string): RepoProblemSetMeta[] {
  if (!existsSync(problemsDir)) return [];

  const files = readdirSync(problemsDir).filter(
    (f) => f.endsWith('.json') && f !== 'index.json',
  );

  const metas: RepoProblemSetMeta[] = [];
  for (const file of files) {
    const raw = readFileSync(join(problemsDir, file), 'utf-8');
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      // 壊れたJSONはindexに含めない(npm run validateで別途検出する)
      continue;
    }
    metas.push({
      setId: String(data.setId ?? file.replace(/\.json$/, '')),
      title: String(data.title ?? data.setId ?? file),
      milestone: String(data.milestone ?? ''),
      unit: Number(data.unit ?? 0),
      description: typeof data.description === 'string' ? data.description : undefined,
      problemCount: Array.isArray(data.problems) ? data.problems.length : 0,
    });
  }

  metas.sort((a, b) => `${a.milestone}-${a.unit}`.localeCompare(`${b.milestone}-${b.unit}`));

  writeFileSync(join(problemsDir, 'index.json'), `${JSON.stringify(metas, null, 2)}\n`, 'utf-8');
  return metas;
}

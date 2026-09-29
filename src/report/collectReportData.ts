import { listEventsBetween } from '../records/eventLog';
import { listAllProgress } from '../records/progressStore';
import { getTimeLogBetween, todayLocalDate } from '../records/workTime';
import { listAllProblemSets, loadProblemSet } from '../problems/loadAll';
import { generateWeeklyReport, type ReportProblemInfo } from './generateReport';

export async function buildWeeklyReport(from: Date, to: Date): Promise<string> {
  const [events, progressList] = await Promise.all([
    listEventsBetween(from.toISOString(), to.toISOString()),
    listAllProgress(),
  ]);
  const timeLogs = await getTimeLogBetween(todayLocalDate(from), todayLocalDate(to));

  const summaries = await listAllProblemSets();
  const sets = await Promise.all(summaries.map((s) => loadProblemSet(s.setId, s.source)));
  const problems: ReportProblemInfo[] = sets.flatMap((set) =>
    set.problems.map((p) => ({
      setId: set.setId,
      problemId: p.id,
      type: p.type,
      blocks: p.type === 'explain' ? p.blocks.map((b) => ({ lines: b.lines })) : undefined,
    })),
  );

  return generateWeeklyReport({ from, to, events, progressList, timeLogs, problems });
}

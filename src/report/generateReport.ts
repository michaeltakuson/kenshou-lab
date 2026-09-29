// 検証ラボ: 週次学習レポートの生成(SPEC.md第9章)。
// チャット側のClaudeに渡すためのMarkdownを組み立てる純粋関数。
import type { EventRecord, ProblemProgress, TimeLogEntry } from '../records/types';
import type { Problem } from '../problems/types';

export interface ReportProblemInfo {
  setId: string;
  problemId: string;
  type: Problem['type'];
  /** explain問題のブロック行範囲。それ以外はundefined。 */
  blocks?: { lines: [number, number] }[];
}

export interface GenerateReportInput {
  from: Date;
  to: Date;
  /** [from, to]の範囲に絞り込んだイベント */
  events: EventRecord[];
  /** 全問題の現在の進捗(状態判定には期間フィルタ不要) */
  progressList: ProblemProgress[];
  /** [from, to]の範囲に絞り込んだ実働時間ログ */
  timeLogs: TimeLogEntry[];
  /** 問題ID→種別・行範囲の引き当て用 */
  problems: ReportProblemInfo[];
}

const TRUNCATE_LEN = 200;
const CLEARED_ALONE_LIKE = new Set(['cleared_alone', 'cleared_by_review']);

const TYPE_LABEL: Record<Problem['type'], string> = {
  write: '書く',
  read: '読む',
  fix: '直す',
  explain: '説明する',
};

function truncate(s: string): string {
  return s.length > TRUNCATE_LEN ? `${s.slice(0, TRUNCATE_LEN)}…` : s;
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatHoursMinutes(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}時間${m}分`;
}

function resultBucket(state: ProblemProgress['state']): '自力' | 'ヒント' | '解答閲覧' | '未クリア' {
  if (CLEARED_ALONE_LIKE.has(state)) return '自力';
  if (state === 'cleared_with_hint') return 'ヒント';
  if (state === 'answer_viewed') return '解答閲覧';
  return '未クリア';
}

function mostFrequent(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function generateWeeklyReport(input: GenerateReportInput): string {
  const { from, to, events, progressList, timeLogs, problems } = input;
  const problemByKey = new Map(problems.map((p) => [`${p.setId}:${p.problemId}`, p]));
  const progressByKey = new Map(progressList.map((p) => [p.key, p]));

  const totalSeconds = timeLogs.reduce((sum, t) => sum + t.seconds, 0);

  const touchedKeys = [...new Set(events.map((e) => `${e.setId}:${e.problemId}`))];

  let alone = 0;
  let hint = 0;
  let answer = 0;
  let uncleared = 0;
  for (const key of touchedKeys) {
    const bucket = resultBucket(progressByKey.get(key)?.state ?? 'not_started');
    if (bucket === '自力') alone++;
    else if (bucket === 'ヒント') hint++;
    else if (bucket === '解答閲覧') answer++;
    else uncleared++;
  }

  const dueCount = progressList.filter(
    (p) => p.reviewStage >= 1 && p.reviewStage <= 4 && p.nextReviewAt && new Date(p.nextReviewAt) <= to,
  ).length;
  const reviewPassEvents = events.filter((e) => e.event === 'pass' && e.data?.wasReview === true);
  const reviewDone = reviewPassEvents.length;
  const reviewSuccess = reviewPassEvents.filter((e) => e.data?.reviewSuccess === true).length;

  const perProblemRows = touchedKeys.map((key) => {
    const info = problemByKey.get(key);
    const problemEvents = events.filter((e) => `${e.setId}:${e.problemId}` === key);
    const submitCount = problemEvents.filter((e) => e.event === 'submit').length;
    const hintCount = problemEvents.filter((e) => e.event === 'hint').length;
    const seconds = timeLogs.filter((t) => `${t.setId}:${t.problemId}` === key).reduce((s, t) => s + t.seconds, 0);
    const errorNames = problemEvents.filter((e) => e.event === 'error').map((e) => String(e.data?.name ?? '不明'));
    const mainError = mostFrequent(errorNames) ?? '';
    const resultLabel = resultBucket(progressByKey.get(key)?.state ?? 'not_started');
    const problemId = info?.problemId ?? key.split(':')[1];
    const typeLabel = info ? TYPE_LABEL[info.type] : '';
    return `| ${problemId} | ${typeLabel} | ${resultLabel} | ${submitCount} | ${hintCount} | ${formatHoursMinutes(seconds)} | ${mainError} |`;
  });

  const missedPredicts = events
    .filter((e) => e.event === 'submit' && e.data?.correct === false)
    .map(
      (e) =>
        `- ${e.problemId}：予想「${truncate(String(e.data?.answer ?? ''))}」→ 実際「${truncate(String(e.data?.actualOutput ?? ''))}」`,
    );

  const unclearBlocks: string[] = [];
  for (const info of problems) {
    if (info.type !== 'explain' || !info.blocks) continue;
    const prog = progressByKey.get(`${info.setId}:${info.problemId}`);
    if (!prog?.explainState) continue;
    prog.explainState.forEach((b, i) => {
      if (b.assessment === 'あいまい' || b.assessment === 'できなかった') {
        const lines = info.blocks?.[i]?.lines;
        const lineLabel = lines ? `行${lines[0]}〜${lines[1]}` : '';
        unclearBlocks.push(
          `- ${info.problemId} ${lineLabel}：自己評価「${b.assessment}」／あなたの説明「${truncate(b.explanation)}」`,
        );
      }
    });
  }

  const stuckNotes = progressList
    .filter((p) => p.stuckNote && new Date(p.updatedAt) >= from && new Date(p.updatedAt) <= to)
    .map((p) => `- ${p.problemId}：${truncate(p.stuckNote ?? '')}`);

  const errorCounts = new Map<string, number>();
  for (const e of events) {
    if (e.event !== 'error') continue;
    const name = String(e.data?.name ?? '不明');
    errorCounts.set(name, (errorCounts.get(name) ?? 0) + 1);
  }
  const errorLines = [...errorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `- ${name}: ${count}回`);

  const lines: string[] = [];
  lines.push(`# 週次学習レポート（${formatDate(from)}〜${formatDate(to)}）`);
  lines.push(`- 実働時間: ${formatHoursMinutes(totalSeconds)}`);
  lines.push(`- 取り組んだ問題: ${touchedKeys.length}（自力 ${alone} / ヒント ${hint} / 解答閲覧 ${answer} / 未クリア ${uncleared}）`);
  lines.push(`- 復習: 期限到来 ${dueCount} / 実施 ${reviewDone} / 成功 ${reviewSuccess}`);
  lines.push('');
  lines.push('## 問題別');
  lines.push('| 問題ID | 形式 | 結果 | 提出回数 | ヒント数 | 実働時間 | 主なエラー |');
  lines.push('|---|---|---|---|---|---|---|');
  lines.push(...perProblemRows);
  lines.push('');
  lines.push('## 予想が外れたもの');
  lines.push(...(missedPredicts.length ? missedPredicts : ['- なし']));
  lines.push('');
  lines.push('## 説明できなかったブロック');
  lines.push(...(unclearBlocks.length ? unclearBlocks : ['- なし']));
  lines.push('');
  lines.push('## 詰まりメモ');
  lines.push(...(stuckNotes.length ? stuckNotes : ['- なし']));
  lines.push('');
  lines.push('## エラーの内訳');
  lines.push(...(errorLines.length ? errorLines : ['- なし']));

  return lines.join('\n');
}

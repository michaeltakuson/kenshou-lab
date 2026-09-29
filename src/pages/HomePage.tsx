import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllProblemSets, loadProblemSet } from '../problems/loadAll';
import { listAllProgress } from '../records/progressStore';
import { isDueForReview } from '../records/reviewSchedule';
import { getLastBackupAt } from '../records/meta';
import type { ProblemSet, ProblemSetSummary } from '../problems/types';
import type { ProblemProgress } from '../records/types';
import './HomePage.css';
import './ProblemSetListPage.css';

const MILESTONES = ['M1', 'M2', 'M3', 'M4'] as const;
const CLEARED_STATES = new Set(['cleared_alone', 'cleared_with_hint', 'answer_viewed', 'cleared_by_review']);

interface ReviewItem {
  source: ProblemSetSummary['source'];
  setId: string;
  problemId: string;
  title: string;
}

interface HomeData {
  sets: { summary: ProblemSetSummary; full: ProblemSet }[];
  milestoneStats: Record<string, { total: number; cleared: number }>;
  dueItems: ReviewItem[];
  resume: { source: string; setId: string; problemId: string; title: string } | null;
  backupWarning: string | null;
}

const BACKUP_WARNING_DAYS = 7;

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    void (async () => {
      const summaries = await listAllProblemSets();
      const sets = await Promise.all(
        summaries.map(async (summary) => ({
          summary,
          full: await loadProblemSet(summary.setId, summary.source),
        })),
      );
      const allProgress = await listAllProgress();
      const progressByKey = new Map<string, ProblemProgress>(allProgress.map((p) => [p.key, p]));

      const milestoneStats: Record<string, { total: number; cleared: number }> = {};
      for (const { full } of sets) {
        const bucket = (milestoneStats[full.milestone] ??= { total: 0, cleared: 0 });
        for (const prob of full.problems) {
          bucket.total += 1;
          const prog = progressByKey.get(`${full.setId}:${prob.id}`);
          if (prog && CLEARED_STATES.has(prog.state)) bucket.cleared += 1;
        }
      }

      const now = new Date();
      const dueItems: ReviewItem[] = [];
      for (const prog of allProgress) {
        if (!isDueForReview(prog, now)) continue;
        const entry = sets.find((s) => s.full.setId === prog.setId);
        const prob = entry?.full.problems.find((p) => p.id === prog.problemId);
        if (entry && prob) {
          dueItems.push({ source: entry.summary.source, setId: prog.setId, problemId: prog.problemId, title: prob.title });
        }
      }

      const inProgressList = allProgress
        .filter((p) => p.state === 'in_progress')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      let resume: HomeData['resume'] = null;
      if (inProgressList.length > 0) {
        const top = inProgressList[0];
        const entry = sets.find((s) => s.full.setId === top.setId);
        const prob = entry?.full.problems.find((p) => p.id === top.problemId);
        if (entry && prob) {
          resume = { source: entry.summary.source, setId: top.setId, problemId: top.problemId, title: prob.title };
        }
      }

      const lastBackupAt = await getLastBackupAt();
      let backupWarning: string | null = null;
      if (!lastBackupAt) {
        backupWarning = 'まだバックアップが取られていません。';
      } else {
        const daysSince = (Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince >= BACKUP_WARNING_DAYS) {
          backupWarning = `最終バックアップから${Math.floor(daysSince)}日経っています。`;
        }
      }

      setData({ sets, milestoneStats, dueItems, resume, backupWarning });
    })();
  }, []);

  return (
    <div className="home-page">
      <h1>検証ラボ</h1>

      {data?.backupWarning && (
        <div className="home-page__warning">
          {data.backupWarning} <Link to="/settings">設定画面からバックアップできます。</Link>
        </div>
      )}

      {!data && <p>読み込み中…</p>}

      {data && (
        <>
          <section className="home-page__section">
            <h2>今日の復習 ({data.dueItems.length}件)</h2>
            {data.dueItems.length === 0 ? (
              <p className="home-page__muted">今日復習が必要な問題はありません。</p>
            ) : (
              <ul className="home-page__list">
                {data.dueItems.map((item) => (
                  <li key={`${item.setId}:${item.problemId}`}>
                    <Link to={`/sets/${item.source}/${item.setId}/${item.problemId}?review=1`}>{item.title}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.resume && (
            <section className="home-page__section">
              <h2>続きから再開</h2>
              <Link to={`/sets/${data.resume.source}/${data.resume.setId}/${data.resume.problemId}`}>
                {data.resume.title} の続きへ →
              </Link>
            </section>
          )}

          <section className="home-page__section">
            <h2>マイルストーン別の進捗</h2>
            <ul className="home-page__milestones">
              {MILESTONES.map((m) => {
                const stat = data.milestoneStats[m];
                return (
                  <li key={m}>
                    {m}: {stat ? `${stat.cleared} / ${stat.total}` : '0 / 0'}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="home-page__section">
            <h2>問題セット一覧</h2>
            {data.sets.length === 0 ? (
              <p className="home-page__muted">
                問題セットがまだありません。<Link to="/settings">設定</Link>から追加してください。
              </p>
            ) : (
              <ul className="home-page__list">
                {data.sets.map(({ summary }) => (
                  <li key={`${summary.source}-${summary.setId}`}>
                    <Link to={`/sets/${summary.source}/${summary.setId}`}>
                      [{summary.milestone}] {summary.title}
                      {summary.source === 'local' && <span className="set-list-page__badge">ローカル</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p>
        <Link to="/scratchpad">自由実行(スクラッチパッド)へ →</Link>
      </p>
    </div>
  );
}

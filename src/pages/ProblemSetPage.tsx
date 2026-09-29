import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MarkdownView } from '../components/MarkdownView';
import { loadProblemSet } from '../problems/loadAll';
import { listProgressForSet } from '../records/progressStore';
import { STATE_LABELS } from '../records/stateLabels';
import type { Problem, ProblemSet, ProblemSetSource } from '../problems/types';
import type { ProblemProgress } from '../records/types';
import './ProblemSetListPage.css';

const TYPE_LABEL: Record<Problem['type'], string> = {
  write: '書く',
  read: '読む',
  fix: '直す',
  explain: '説明する',
};
const DIFFICULTY_LABEL: Record<number, string> = { 1: '★☆☆', 2: '★★☆', 3: '★★★' };

export function ProblemSetPage() {
  const { source, setId } = useParams<{ source: string; setId: string }>();
  const [set, setSet] = useState<ProblemSet | null>(null);
  const [progressByProblem, setProgressByProblem] = useState<Record<string, ProblemProgress>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source || !setId) return;
    loadProblemSet(setId, source as ProblemSetSource)
      .then(setSet)
      .catch((e: Error) => setError(e.message));
    listProgressForSet(setId).then((list) => {
      const map: Record<string, ProblemProgress> = {};
      for (const p of list) map[p.problemId] = p;
      setProgressByProblem(map);
    });
  }, [source, setId]);

  if (error) return <p className="problem-page__error">{error}</p>;
  if (!set) return <p style={{ padding: 16 }}>読み込み中…</p>;

  return (
    <div className="set-list-page">
      <p>
        <Link to="/sets">← 問題セット一覧</Link>
      </p>
      <h1>
        [{set.milestone}] {set.title}
      </h1>
      {set.description && <MarkdownView source={set.description} />}
      <ul className="set-list-page__list">
        {set.problems.map((p) => (
          <li key={p.id} className="set-list-page__item">
            <Link to={`/sets/${source}/${setId}/${p.id}`}>
              <div className="set-list-page__title">{p.title}</div>
              <div className="set-list-page__count">
                {TYPE_LABEL[p.type]} ・ 難易度 {DIFFICULTY_LABEL[p.difficulty]} ・ 約{p.estimatedMinutes}分 ・{' '}
                {STATE_LABELS[progressByProblem[p.id]?.state ?? 'not_started']}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

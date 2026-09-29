import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllProblemSets } from '../problems/loadAll';
import type { ProblemSetSummary } from '../problems/types';
import './ProblemSetListPage.css';

export function ProblemSetListPage() {
  const [sets, setSets] = useState<ProblemSetSummary[] | null>(null);

  useEffect(() => {
    listAllProblemSets().then(setSets);
  }, []);

  return (
    <div className="set-list-page">
      <h1>問題セット一覧</h1>
      {!sets && <p>読み込み中…</p>}
      {sets && sets.length === 0 && <p>問題セットがまだありません。設定画面から追加してください。</p>}
      <ul className="set-list-page__list">
        {sets?.map((s) => (
          <li key={`${s.source}-${s.setId}`} className="set-list-page__item">
            <Link to={`/sets/${s.source}/${s.setId}`}>
              <div className="set-list-page__title">
                [{s.milestone}] {s.title}
                {s.source === 'local' && <span className="set-list-page__badge">ローカル</span>}
              </div>
              {s.description && <div className="set-list-page__desc">{s.description}</div>}
              <div className="set-list-page__count">{s.problemCount}問</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

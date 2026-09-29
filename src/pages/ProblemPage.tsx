import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MarkdownView } from '../components/MarkdownView';
import { WriteFixProblemView } from '../components/problem/WriteFixProblemView';
import { ReadProblemView } from '../components/problem/ReadProblemView';
import { ExplainProblemView } from '../components/problem/ExplainProblemView';
import { loadProblemSet } from '../problems/loadAll';
import { resolveDatasets } from '../problems/resolveDatasets';
import type { Problem, ProblemSet, ProblemSetSource } from '../problems/types';
import './ProblemPage.css';

const DIFFICULTY_LABEL: Record<number, string> = { 1: '★☆☆', 2: '★★☆', 3: '★★★' };

export function ProblemPage() {
  const { source, setId, problemId } = useParams<{
    source: string;
    setId: string;
    problemId: string;
  }>();
  const [set, setSet] = useState<ProblemSet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source || !setId) return;
    setSet(null);
    setError(null);
    loadProblemSet(setId, source as ProblemSetSource)
      .then(setSet)
      .catch((e: Error) => setError(e.message));
  }, [source, setId]);

  if (error) {
    return (
      <div className="problem-page">
        <p className="problem-page__error">{error}</p>
        <Link to="/sets">問題セット一覧に戻る</Link>
      </div>
    );
  }
  if (!set) {
    return (
      <div className="problem-page">
        <p>読み込み中…</p>
      </div>
    );
  }

  const problem: Problem | undefined = set.problems.find((p) => p.id === problemId);
  if (!problem) {
    return (
      <div className="problem-page">
        <p className="problem-page__error">問題「{problemId}」が見つかりません。</p>
        <Link to={`/sets/${source}/${setId}`}>問題セットに戻る</Link>
      </div>
    );
  }

  const datasets = resolveDatasets(set);

  return (
    <div className="problem-page">
      <div className="problem-page__breadcrumb">
        <Link to="/sets">問題セット一覧</Link> / <Link to={`/sets/${source}/${setId}`}>{set.title}</Link>
      </div>
      <h1>{problem.title}</h1>
      <div className="problem-page__meta">
        難易度: {DIFFICULTY_LABEL[problem.difficulty]} ・ 目安時間: 約{problem.estimatedMinutes}分 ・
        形式: {TYPE_LABEL[problem.type]}
      </div>
      <MarkdownView source={problem.prompt} className="problem-page__prompt" />

      {(problem.type === 'write' || problem.type === 'fix') && (
        <WriteFixProblemView key={problem.id} problem={problem} datasets={datasets} />
      )}
      {problem.type === 'read' && <ReadProblemView key={problem.id} problem={problem} datasets={datasets} />}
      {problem.type === 'explain' && (
        <ExplainProblemView key={problem.id} problem={problem} datasets={datasets} />
      )}
    </div>
  );
}

const TYPE_LABEL: Record<Problem['type'], string> = {
  write: '書く',
  read: '読む',
  fix: '直す',
  explain: '説明する',
};

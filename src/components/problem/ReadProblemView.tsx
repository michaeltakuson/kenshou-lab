import { useEffect, useState } from 'react';
import { CodeEditor } from '../CodeEditor';
import { ResultPanel } from '../ResultPanel';
import { getPyodideClient } from '../../pyodide/client';
import { judgeReadAnswer } from '../../lib/compareOutput';
import type { DatasetSource, PyStatus, RunResult } from '../../pyodide/types';
import type { ReadProblem } from '../../problems/types';
import './ProblemView.css';

interface Props {
  problem: ReadProblem;
  datasets: DatasetSource[];
}

function actualOutputTextOf(result: RunResult | null): string {
  if (!result) return '';
  if (result.stdout) return result.stdout;
  if (result.value && result.value.kind === 'repr') return result.value.text;
  return '';
}

export function ReadProblemView({ problem, datasets }: Props) {
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [firstJudgement, setFirstJudgement] = useState<boolean | null>(null);
  const client = getPyodideClient();
  const [status, setStatus] = useState<PyStatus>(() => client.getStatus());

  useEffect(() => client.onStatus(setStatus), [client]);

  const isBusy = status.phase === 'loading' || status.phase === 'running' || status.phase === 'restarting';
  const hasAnswered = result !== null;
  const canAnswer = userInput.trim().length > 0 || problem.answer.kind === 'choice';

  const handleAnswer = async () => {
    if (!canAnswer || isBusy) return;
    const r = await client.run({
      code: problem.code,
      setupCode: problem.setup,
      datasets,
      timeoutSec: problem.timeoutSec,
    });
    setResult(r);
    if (firstJudgement === null && r.ok) {
      const correct = judgeReadAnswer(problem.answer, userInput, actualOutputTextOf(r));
      setFirstJudgement(correct);
    }
  };

  return (
    <div className="problem-view">
      <div className="problem-view__body">
        <div className="problem-view__editor">
          <div className="problem-view__code-readonly">
            <CodeEditor value={problem.code} onChange={() => {}} readOnly ariaLabel="読み取り専用コード" />
          </div>
          <div className="problem-view__answer">
            {problem.answer.kind === 'output' && (
              <textarea
                rows={3}
                placeholder="実行結果を予想して入力してください"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={hasAnswered}
              />
            )}
            {problem.answer.kind === 'value' && (
              <input
                type="text"
                placeholder="予想する値を入力してください"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={hasAnswered}
              />
            )}
            {problem.answer.kind === 'choice' &&
              problem.answer.choices.map((choice, i) => (
                <label key={i} className="problem-view__choice">
                  <input
                    type="radio"
                    name="read-choice"
                    value={i}
                    checked={userInput === String(i)}
                    onChange={() => setUserInput(String(i))}
                    disabled={hasAnswered}
                  />
                  {choice}
                </label>
              ))}
            <div className="problem-view__actions">
              <button type="button" onClick={handleAnswer} disabled={isBusy || !canAnswer || hasAnswered}>
                回答して確かめる
              </button>
            </div>
          </div>
          {firstJudgement !== null && (
            <div className={`problem-view__judge ${firstJudgement ? 'problem-view__judge--correct' : 'problem-view__judge--incorrect'}`}>
              初回の判定: {firstJudgement ? '正解' : '不正解'}
            </div>
          )}
        </div>
        <div className="problem-view__result">
          <ResultPanel result={result} status={status} />
          {hasAnswered && (
            <div className="problem-view__predict-compare">
              <div className="result-block__title">あなたの予想</div>
              <pre className="result-pre">{userInput || '(未入力)'}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

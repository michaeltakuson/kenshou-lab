import { useEffect, useState } from 'react';
import { CodeEditor } from '../CodeEditor';
import { ResultPanel } from '../ResultPanel';
import { getPyodideClient } from '../../pyodide/client';
import type { DatasetSource, PyStatus, RunResult } from '../../pyodide/types';
import type { WriteOrFixProblem } from '../../problems/types';
import './ProblemView.css';

interface Props {
  problem: WriteOrFixProblem;
  datasets: DatasetSource[];
}

function draftKey(problemId: string) {
  return `kenshou-lab:draft:${problemId}`;
}

function loadDraft(problem: WriteOrFixProblem): string {
  try {
    return localStorage.getItem(draftKey(problem.id)) ?? problem.starterCode;
  } catch {
    return problem.starterCode;
  }
}

export function WriteFixProblemView({ problem, datasets }: Props) {
  const [code, setCode] = useState(() => loadDraft(problem));
  const [predictText, setPredictText] = useState('');
  const [predictSubmitted, setPredictSubmitted] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const client = getPyodideClient();
  const [status, setStatus] = useState<PyStatus>(() => client.getStatus());

  useEffect(() => client.onStatus(setStatus), [client]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(problem.id), code);
    } catch {
      // 保存できなくても実行は継続できるため無視する
    }
  }, [code, problem.id]);

  const isBusy = status.phase === 'loading' || status.phase === 'running' || status.phase === 'restarting';
  const predictRequired = problem.predict?.required && !predictSubmitted;
  const blockedByPredict = Boolean(predictRequired) && predictText.trim().length === 0;

  const runOptions = {
    code,
    setupCode: problem.setup,
    datasets,
    timeoutSec: problem.timeoutSec,
  };

  const handleRun = async () => {
    if (blockedByPredict) return;
    setPredictSubmitted(true);
    const r = await client.run(runOptions);
    setResult(r);
  };

  const handleSubmit = async () => {
    if (blockedByPredict) return;
    setPredictSubmitted(true);
    const r = await client.run({ ...runOptions, tests: problem.tests });
    setResult(r);
  };

  const handleResetCode = () => {
    setCode(problem.starterCode);
  };

  return (
    <div className="problem-view">
      {problem.predict && (
        <div className="problem-view__predict">
          <label htmlFor="predict-input">
            予想{problem.predict.required ? '(実行前に入力してください)' : '(任意)'}: {problem.predict.question}
          </label>
          <textarea
            id="predict-input"
            value={predictText}
            onChange={(e) => setPredictText(e.target.value)}
            rows={2}
          />
        </div>
      )}
      <div className="problem-view__body">
        <div className="problem-view__editor">
          <CodeEditor value={code} onChange={setCode} ariaLabel="コード入力欄" />
          <div className="problem-view__actions">
            <button type="button" onClick={handleRun} disabled={isBusy || blockedByPredict}>
              実行
            </button>
            <button type="button" onClick={handleSubmit} disabled={isBusy || blockedByPredict}>
              提出
            </button>
            <button type="button" className="problem-view__reset" onClick={handleResetCode} disabled={isBusy}>
              初期コードに戻す
            </button>
          </div>
          {blockedByPredict && (
            <p className="problem-view__note">先に上の予想欄を入力してください。</p>
          )}
        </div>
        <div className="problem-view__result">
          <ResultPanel result={result} status={status} />
          {problem.predict && predictSubmitted && result && !result.timedOut && (
            <div className="problem-view__predict-compare">
              <div className="problem-view__predict-compare-col">
                <div className="result-block__title">あなたの予想</div>
                <pre className="result-pre">{predictText || '(未入力)'}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

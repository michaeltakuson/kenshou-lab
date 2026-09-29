import { useEffect, useState } from 'react';
import { CodeEditor } from '../CodeEditor';
import { ResultPanel } from '../ResultPanel';
import { getPyodideClient } from '../../pyodide/client';
import type { DatasetSource, PyStatus, RunResult } from '../../pyodide/types';
import type { ExplainProblem } from '../../problems/types';
import './ProblemView.css';

interface Props {
  problem: ExplainProblem;
  datasets: DatasetSource[];
}

type SelfAssessment = 'できた' | 'あいまい' | 'できなかった';

function ModifyTaskView({ problem, datasets }: { problem: ExplainProblem; datasets: DatasetSource[] }) {
  const modifyTask = problem.modifyTask;
  const [code, setCode] = useState(problem.code);
  const [result, setResult] = useState<RunResult | null>(null);
  const client = getPyodideClient();
  const [status, setStatus] = useState<PyStatus>(() => client.getStatus());

  useEffect(() => client.onStatus(setStatus), [client]);

  if (!modifyTask) return null;
  const isBusy = status.phase === 'loading' || status.phase === 'running' || status.phase === 'restarting';

  const handleRun = async () => {
    const r = await client.run({ code, setupCode: problem.setup, datasets, timeoutSec: problem.timeoutSec });
    setResult(r);
  };
  const handleSubmit = async () => {
    const r = await client.run({
      code,
      setupCode: problem.setup,
      datasets,
      timeoutSec: problem.timeoutSec,
      tests: modifyTask.tests,
    });
    setResult(r);
  };

  return (
    <div className="problem-view__block">
      <div className="problem-view__block-title">改変課題</div>
      <p>{modifyTask.prompt}</p>
      <div className="problem-view__body">
        <div className="problem-view__editor">
          <CodeEditor value={code} onChange={setCode} ariaLabel="改変課題コード入力欄" />
          <div className="problem-view__actions">
            <button type="button" onClick={handleRun} disabled={isBusy}>
              実行
            </button>
            <button type="button" onClick={handleSubmit} disabled={isBusy}>
              提出
            </button>
          </div>
        </div>
        <div className="problem-view__result">
          <ResultPanel result={result} status={status} />
        </div>
      </div>
    </div>
  );
}

export function ExplainProblemView({ problem, datasets }: Props) {
  const [explanations, setExplanations] = useState<string[]>(() => problem.blocks.map(() => ''));
  const [revealed, setRevealed] = useState(false);
  const [assessments, setAssessments] = useState<(SelfAssessment | null)[]>(() =>
    problem.blocks.map(() => null),
  );

  const allAssessed = assessments.every((a) => a !== null);
  const allGood = assessments.every((a) => a === 'できた');

  return (
    <div className="problem-view">
      <div className="problem-view__code-readonly">
        <CodeEditor value={problem.code} onChange={() => {}} readOnly ariaLabel="説明対象コード" />
      </div>
      {problem.blocks.map((block, i) => (
        <div className="problem-view__block" key={i}>
          <div className="problem-view__block-title">
            {block.lines[0]}〜{block.lines[1]}行目は何をしていますか？
          </div>
          <textarea
            rows={2}
            value={explanations[i]}
            onChange={(e) => {
              const next = [...explanations];
              next[i] = e.target.value;
              setExplanations(next);
            }}
            disabled={revealed}
          />
          {revealed && (
            <>
              <p className="problem-view__model-text">{block.modelText}</p>
              <div className="problem-view__self-assess">
                {(['できた', 'あいまい', 'できなかった'] as SelfAssessment[]).map((label) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={assessments[i] === label}
                    onClick={() => {
                      const next = [...assessments];
                      next[i] = label;
                      setAssessments(next);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
      {!revealed && (
        <div className="problem-view__actions">
          <button type="button" onClick={() => setRevealed(true)}>
            提出(模範説明を見る)
          </button>
        </div>
      )}
      {revealed && allAssessed && (
        <p className="problem-view__note" style={{ color: allGood ? '#16a34a' : undefined }}>
          {allGood
            ? 'すべてのブロックで「できた」と評価しました。'
            : '「あいまい」「できなかった」の評価があります。復習の対象になります。'}
        </p>
      )}
      {revealed && allAssessed && problem.modifyTask && (
        <ModifyTaskView problem={problem} datasets={datasets} />
      )}
    </div>
  );
}

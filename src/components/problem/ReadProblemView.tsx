import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CodeEditor } from '../CodeEditor';
import { ResultPanel } from '../ResultPanel';
import { HintsPanel } from './HintsPanel';
import { StuckNoteInput } from './StuckNoteInput';
import { ResponsiveProblemLayout } from './ResponsiveProblemLayout';
import { getPyodideClient } from '../../pyodide/client';
import { judgeReadAnswer } from '../../lib/compareOutput';
import type { DatasetSource, PyStatus, RunResult } from '../../pyodide/types';
import type { ReadProblem } from '../../problems/types';
import {
  finalizeCycle,
  markOpened,
  recordHintOpened,
  recordStuckNote,
  startReviewAttempt,
} from '../../records/progressStore';
import { useWorkingTime } from '../../records/workTime';
import { logEvent } from '../../records/eventLog';
import { STATE_LABELS } from '../../records/stateLabels';
import type { ProblemProgress } from '../../records/types';
import { usePrefs } from '../../prefs/prefs';
import './ProblemView.css';

interface Props {
  setId: string;
  problem: ReadProblem;
  datasets: DatasetSource[];
  promptNode: ReactNode;
}

function actualOutputTextOf(result: RunResult | null): string {
  if (!result) return '';
  if (result.stdout) return result.stdout;
  if (result.value && result.value.kind === 'repr') return result.value.text;
  return '';
}

const UNFINALIZED_STATES = new Set(['not_started', 'in_progress']);

export function ReadProblemView({ setId, problem, datasets, promptNode }: Props) {
  const [searchParams] = useSearchParams();
  const isReview = searchParams.get('review') === '1';
  const [prefs] = usePrefs();

  const [progress, setProgress] = useState<ProblemProgress | null>(null);
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [firstJudgement, setFirstJudgement] = useState<boolean | null>(null);
  const client = getPyodideClient();
  const [status, setStatus] = useState<PyStatus>(() => client.getStatus());

  useWorkingTime(setId, problem.id);
  useEffect(() => client.onStatus(setStatus), [client]);

  useEffect(() => {
    void (async () => {
      let p = await markOpened(setId, problem.id);
      if (isReview && p.reviewStage >= 1 && p.reviewStage <= 4) {
        p = await startReviewAttempt(setId, problem.id, '');
      }
      setProgress(p);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, problem.id]);

  if (!progress) {
    return <div className="problem-view">読み込み中…</div>;
  }

  const isBusy = status.phase === 'loading' || status.phase === 'running' || status.phase === 'restarting';
  const hasAnswered = result !== null;
  const canAnswer = userInput.trim().length > 0 || problem.answer.kind === 'choice';
  const wasAlreadyFinalized = !UNFINALIZED_STATES.has(progress.state);

  const handleOpenHint = async (index: number) => {
    const next = await recordHintOpened(setId, problem.id, index);
    setProgress(next);
  };

  const handleAnswer = async () => {
    if (!canAnswer || isBusy || hasAnswered) return;
    await logEvent(setId, problem.id, 'submit', { answer: userInput });
    const r = await client.run({
      code: problem.code,
      setupCode: problem.setup,
      datasets,
      timeoutSec: problem.timeoutSec ?? prefs.defaultTimeoutSec,
    });
    setResult(r);
    if (r.error) await logEvent(setId, problem.id, 'error', { name: r.error.name });
    if (firstJudgement === null && r.ok) {
      const correct = judgeReadAnswer(problem.answer, userInput, actualOutputTextOf(r));
      setFirstJudgement(correct);
      if (!wasAlreadyFinalized) {
        const outcome = correct && progress.hintsOpenedCount === 0 ? 'clean' : 'needed_help';
        const next = await finalizeCycle(setId, problem.id, outcome);
        setProgress(next);
      }
    }
  };

  const showStuckNote = hasAnswered && firstJudgement !== null;

  const problemPane = (
    <>
      <div className="problem-view__state-badge">{STATE_LABELS[progress.state]}</div>
      {promptNode}

      <HintsPanel
        hints={problem.hints}
        openedCount={progress.hintsOpenedCount}
        onOpenNext={() => handleOpenHint(progress.hintsOpenedCount)}
      />

      {problem.modelExplanation && hasAnswered && (
        <div className="problem-view__answer-reveal">
          <div className="problem-view__block-title">補足</div>
          {problem.modelExplanation.map((e, i) => (
            <p key={i} className="problem-view__model-text">
              {e.lines[0]}〜{e.lines[1]}行目: {e.text}
            </p>
          ))}
        </div>
      )}

      {showStuckNote && (
        <StuckNoteInput
          emphasize={!firstJudgement}
          initialValue={progress.stuckNote}
          onSave={(note) => void recordStuckNote(setId, problem.id, note)}
        />
      )}
    </>
  );

  const codePane = (
    <div className="problem-view__editor">
      <div className="problem-view__code-readonly">
        <CodeEditor value={problem.code} onChange={() => {}} readOnly ariaLabel="読み取り専用コード" wrap={prefs.codeWrap} />
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
      </div>
      {firstJudgement !== null && (
        <div
          className={`problem-view__judge ${firstJudgement ? 'problem-view__judge--correct' : 'problem-view__judge--incorrect'}`}
        >
          初回の判定: {firstJudgement ? '正解' : '不正解'}
        </div>
      )}
    </div>
  );

  return (
    <ResponsiveProblemLayout
      problemPane={problemPane}
      codePane={codePane}
      resultPane={
        <>
          <ResultPanel result={result} status={status} />
          {hasAnswered && (
            <div className="problem-view__predict-compare">
              <div className="result-block__title">あなたの予想</div>
              <pre className="result-pre">{userInput || '(未入力)'}</pre>
            </div>
          )}
        </>
      }
      actions={
        <button type="button" onClick={handleAnswer} disabled={isBusy || !canAnswer || hasAnswered}>
          回答して確かめる
        </button>
      }
    />
  );
}

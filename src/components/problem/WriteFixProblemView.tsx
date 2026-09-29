import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CodeEditor } from '../CodeEditor';
import { ResultPanel } from '../ResultPanel';
import { HintsPanel } from './HintsPanel';
import { StuckNoteInput } from './StuckNoteInput';
import { ResponsiveProblemLayout } from './ResponsiveProblemLayout';
import { getPyodideClient } from '../../pyodide/client';
import type { DatasetSource, PyStatus, RunResult } from '../../pyodide/types';
import type { WriteOrFixProblem } from '../../problems/types';
import {
  finalizeCycle,
  markOpened,
  recordAnswerViewed,
  recordHintOpened,
  recordPredict,
  recordStuckNote,
  recordSubmitFailure,
  saveDraftCode,
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
  problem: WriteOrFixProblem;
  datasets: DatasetSource[];
  promptNode: ReactNode;
}

export function WriteFixProblemView({ setId, problem, datasets, promptNode }: Props) {
  const [searchParams] = useSearchParams();
  const isReview = searchParams.get('review') === '1';
  const [prefs] = usePrefs();

  const [progress, setProgress] = useState<ProblemProgress | null>(null);
  const [code, setCode] = useState(problem.starterCode);
  const [predictText, setPredictText] = useState('');
  const [predictLocked, setPredictLocked] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const client = getPyodideClient();
  const [status, setStatus] = useState<PyStatus>(() => client.getStatus());
  const [confirmingAnswer, setConfirmingAnswer] = useState(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useWorkingTime(setId, problem.id);
  useEffect(() => client.onStatus(setStatus), [client]);

  useEffect(() => {
    void (async () => {
      let p = await markOpened(setId, problem.id);
      if (isReview && p.reviewStage >= 1 && p.reviewStage <= 4) {
        p = await startReviewAttempt(setId, problem.id, problem.starterCode);
      }
      setProgress(p);
      setCode(p.code ?? problem.starterCode);
      setPredictText(p.predictAnswer ?? '');
      setPredictLocked(Boolean(p.predictAnswer));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, problem.id]);

  if (!progress) {
    return <div className="problem-view">読み込み中…</div>;
  }

  const isBusy = status.phase === 'loading' || status.phase === 'running' || status.phase === 'restarting';
  const predictRequired = Boolean(problem.predict?.required) && !predictLocked;
  const blockedByPredict = predictRequired && predictText.trim().length === 0;

  const runOptions = {
    code,
    setupCode: problem.setup,
    datasets,
    timeoutSec: problem.timeoutSec ?? prefs.defaultTimeoutSec,
  };

  const persistCode = (next: string) => {
    setCode(next);
    // キー入力のたびにIndexedDBへ読み書きすると、書き込み順の競合や
    // 反映の遅れにつながるため、入力が少し止まってからまとめて保存する。
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      void saveDraftCode(setId, problem.id, next);
    }, 400);
  };

  const lockPredictIfNeeded = async () => {
    if (!predictLocked && predictText.trim().length > 0) {
      setPredictLocked(true);
      await recordPredict(setId, problem.id, predictText);
    }
  };

  const handleRun = async () => {
    if (blockedByPredict || isBusy) return;
    await lockPredictIfNeeded();
    await logEvent(setId, problem.id, 'run');
    const r = await client.run(runOptions);
    setResult(r);
    if (r.error) await logEvent(setId, problem.id, 'error', { name: r.error.name });
  };

  const handleSubmit = async () => {
    if (blockedByPredict || isBusy) return;
    await lockPredictIfNeeded();
    await logEvent(setId, problem.id, 'submit');
    const r = await client.run({ ...runOptions, tests: problem.tests });
    setResult(r);
    if (r.error) await logEvent(setId, problem.id, 'error', { name: r.error.name });
    if (r.allPassed === true) {
      const outcome = progress.hintsOpenedCount > 0 || progress.answerViewed ? 'needed_help' : 'clean';
      const next = await finalizeCycle(setId, problem.id, outcome);
      setProgress(next);
    } else if (r.allPassed === false) {
      const reason = r.ok ? 'assertion_failed' : 'runtime_error';
      const next = await recordSubmitFailure(setId, problem.id, reason);
      setProgress(next);
    }
  };

  const handleResetCode = () => {
    persistCode(problem.starterCode);
  };

  const handleOpenHint = async (index: number) => {
    const next = await recordHintOpened(setId, problem.id, index);
    setProgress(next);
  };

  const failThreshold = problem.answerUnlockAfterFails ?? 3;
  const answerUnlocked = progress.hintsOpenedCount >= problem.hints.length || progress.failCount >= failThreshold;

  const handleViewAnswer = async () => {
    const next = await recordAnswerViewed(setId, problem.id);
    setProgress(next);
    setConfirmingAnswer(false);
  };

  const showStuckNote =
    progress.state === 'cleared_alone' || progress.state === 'cleared_by_review' || progress.answerViewed;

  const problemPane = (
    <>
      <div className="problem-view__state-badge">{STATE_LABELS[progress.state]}</div>
      {promptNode}
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
            disabled={predictLocked}
          />
        </div>
      )}
      {blockedByPredict && <p className="problem-view__note">先に上の予想欄を入力してください。</p>}

      <HintsPanel
        hints={problem.hints}
        openedCount={progress.hintsOpenedCount}
        onOpenNext={() => handleOpenHint(progress.hintsOpenedCount)}
      />

      {progress.answerViewed ? (
        <div className="problem-view__answer-reveal">
          <div className="problem-view__block-title">解答</div>
          <pre className="result-pre">{problem.modelAnswer}</pre>
          {problem.modelExplanation?.map((e, i) => (
            <p key={i} className="problem-view__model-text">
              {e.lines[0]}〜{e.lines[1]}行目: {e.text}
            </p>
          ))}
        </div>
      ) : (
        answerUnlocked && (
          <div className="problem-view__answer-reveal">
            {!confirmingAnswer ? (
              <button type="button" onClick={() => setConfirmingAnswer(true)}>
                解答を見る
              </button>
            ) : (
              <>
                <p>解答を見るとこの問題は復習に回ります。よろしいですか？</p>
                <div className="problem-view__actions">
                  <button type="button" onClick={handleViewAnswer}>
                    解答を見る
                  </button>
                  <button type="button" className="problem-view__reset" onClick={() => setConfirmingAnswer(false)}>
                    やめる
                  </button>
                </div>
              </>
            )}
          </div>
        )
      )}

      {showStuckNote && (
        <StuckNoteInput
          emphasize={progress.state !== 'cleared_alone'}
          initialValue={progress.stuckNote}
          onSave={(note) => void recordStuckNote(setId, problem.id, note)}
        />
      )}
    </>
  );

  return (
    <ResponsiveProblemLayout
      problemPane={problemPane}
      codePane={
        <CodeEditor
          value={code}
          onChange={persistCode}
          ariaLabel="コード入力欄"
          wrap={prefs.codeWrap}
          onRunShortcut={handleRun}
          onSubmitShortcut={handleSubmit}
        />
      }
      resultPane={
        <>
          <ResultPanel result={result} status={status} />
          {problem.predict && predictLocked && result && !result.timedOut && (
            <div className="problem-view__predict-compare">
              <div className="result-block__title">あなたの予想</div>
              <pre className="result-pre">{predictText || '(未入力)'}</pre>
            </div>
          )}
        </>
      }
      actions={
        <>
          <button type="button" onClick={handleRun} disabled={isBusy || blockedByPredict}>
            実行
          </button>
          <button type="button" onClick={handleSubmit} disabled={isBusy || blockedByPredict}>
            提出
          </button>
          <button type="button" className="problem-view__reset" onClick={handleResetCode} disabled={isBusy}>
            初期コードに戻す
          </button>
        </>
      }
    />
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CodeEditor } from '../CodeEditor';
import { ResultPanel } from '../ResultPanel';
import { HintsPanel } from './HintsPanel';
import { StuckNoteInput } from './StuckNoteInput';
import { ResponsiveProblemLayout } from './ResponsiveProblemLayout';
import { getPyodideClient } from '../../pyodide/client';
import type { DatasetSource, PyStatus, RunResult } from '../../pyodide/types';
import type { ExplainProblem } from '../../problems/types';
import {
  finalizeCycle,
  markOpened,
  recordHintOpened,
  recordStuckNote,
  saveProgress,
  startReviewAttempt,
} from '../../records/progressStore';
import { useWorkingTime } from '../../records/workTime';
import { logEvent } from '../../records/eventLog';
import { STATE_LABELS } from '../../records/stateLabels';
import type { ExplainBlockState, ProblemProgress } from '../../records/types';
import { usePrefs } from '../../prefs/prefs';
import './ProblemView.css';

interface Props {
  setId: string;
  problem: ExplainProblem;
  datasets: DatasetSource[];
  promptNode: ReactNode;
}

const UNFINALIZED_STATES = new Set(['not_started', 'in_progress']);

function emptyBlockState(problem: ExplainProblem): ExplainBlockState[] {
  return problem.blocks.map(() => ({ explanation: '', assessment: null }));
}

function ModifyTaskView({
  setId,
  problem,
  datasets,
  initialCode,
  onCodeChange,
  onPassed,
}: {
  setId: string;
  problem: ExplainProblem;
  datasets: DatasetSource[];
  initialCode: string;
  onCodeChange: (code: string) => void;
  onPassed: () => void;
}) {
  const modifyTask = problem.modifyTask;
  const [prefs] = usePrefs();
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<RunResult | null>(null);
  const client = getPyodideClient();
  const [status, setStatus] = useState<PyStatus>(() => client.getStatus());

  useEffect(() => client.onStatus(setStatus), [client]);

  if (!modifyTask) return null;
  const isBusy = status.phase === 'loading' || status.phase === 'running' || status.phase === 'restarting';

  const update = (next: string) => {
    setCode(next);
    onCodeChange(next);
  };

  const handleRun = async () => {
    if (isBusy) return;
    await logEvent(setId, problem.id, 'run', { context: 'modifyTask' });
    const r = await client.run({
      code,
      setupCode: problem.setup,
      datasets,
      timeoutSec: problem.timeoutSec ?? prefs.defaultTimeoutSec,
    });
    setResult(r);
    if (r.error) await logEvent(setId, problem.id, 'error', { name: r.error.name, context: 'modifyTask' });
  };
  const handleSubmit = async () => {
    if (isBusy) return;
    await logEvent(setId, problem.id, 'submit', { context: 'modifyTask' });
    const r = await client.run({
      code,
      setupCode: problem.setup,
      datasets,
      timeoutSec: problem.timeoutSec ?? prefs.defaultTimeoutSec,
      tests: modifyTask.tests,
    });
    setResult(r);
    if (r.error) await logEvent(setId, problem.id, 'error', { name: r.error.name, context: 'modifyTask' });
    if (r.allPassed === true) onPassed();
    else if (r.allPassed === false) await logEvent(setId, problem.id, 'fail', { context: 'modifyTask' });
  };

  return (
    <div className="problem-view__block problem-view__modify-task">
      <div className="problem-view__block-title">改変課題</div>
      <p>{modifyTask.prompt}</p>
      <ResponsiveProblemLayout
        problemPane={<p className="problem-view__note">左のコードを直接編集し、実行・提出してください。</p>}
        codePane={
          <CodeEditor
            value={code}
            onChange={update}
            ariaLabel="改変課題コード入力欄"
            wrap={prefs.codeWrap}
            onRunShortcut={handleRun}
            onSubmitShortcut={handleSubmit}
          />
        }
        resultPane={<ResultPanel result={result} status={status} />}
        actions={
          <>
            <button type="button" onClick={handleRun} disabled={isBusy}>
              実行
            </button>
            <button type="button" onClick={handleSubmit} disabled={isBusy}>
              提出
            </button>
          </>
        }
      />
    </div>
  );
}

export function ExplainProblemView({ setId, problem, datasets, promptNode }: Props) {
  const [searchParams] = useSearchParams();
  const isReview = searchParams.get('review') === '1';
  const [prefs] = usePrefs();

  const [progress, setProgress] = useState<ProblemProgress | null>(null);
  const [blocks, setBlocks] = useState<ExplainBlockState[]>(() => emptyBlockState(problem));
  const [revealed, setRevealed] = useState(false);
  const [modifyTaskPassed, setModifyTaskPassed] = useState(false);

  useWorkingTime(setId, problem.id);

  useEffect(() => {
    void (async () => {
      let p = await markOpened(setId, problem.id);
      if (isReview && p.reviewStage >= 1 && p.reviewStage <= 4) {
        p = await startReviewAttempt(setId, problem.id, problem.code);
      }
      setProgress(p);
      setBlocks(p.explainState ?? emptyBlockState(problem));
      setRevealed(p.explainState !== null);
      setModifyTaskPassed(!UNFINALIZED_STATES.has(p.state));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, problem.id]);

  if (!progress) {
    return <div className="problem-view">読み込み中…</div>;
  }

  const wasAlreadyFinalized = !UNFINALIZED_STATES.has(progress.state);
  const allAssessed = blocks.every((b) => b.assessment !== null);
  const allGood = blocks.every((b) => b.assessment === 'できた');

  const persistBlocks = async (next: ExplainBlockState[]) => {
    setBlocks(next);
    const p = { ...progress, explainState: next, updatedAt: new Date().toISOString() };
    setProgress(p);
    await saveProgress(p);
  };

  const maybeFinalize = async (nextBlocks: ExplainBlockState[], modifyPassed: boolean) => {
    if (wasAlreadyFinalized) return;
    const done = nextBlocks.every((b) => b.assessment !== null) && (!problem.modifyTask || modifyPassed);
    if (!done) return;
    const good = nextBlocks.every((b) => b.assessment === 'できた') && (!problem.modifyTask || modifyPassed);
    const outcome = good && progress.hintsOpenedCount === 0 ? 'clean' : 'needed_help';
    const next = await finalizeCycle(setId, problem.id, outcome);
    setProgress(next);
  };

  const handleOpenHint = async (index: number) => {
    const next = await recordHintOpened(setId, problem.id, index);
    setProgress(next);
  };

  const handleReveal = () => {
    setRevealed(true);
    void logEvent(setId, problem.id, 'submit');
    void persistBlocks(blocks);
  };

  const handleAssess = (index: number, assessment: ExplainBlockState['assessment']) => {
    const next = blocks.map((b, i) => (i === index ? { ...b, assessment } : b));
    void logEvent(setId, problem.id, 'self_assess', { blockIndex: index, assessment });
    void persistBlocks(next).then(() => maybeFinalize(next, modifyTaskPassed));
  };

  const handleModifyTaskPassed = () => {
    setModifyTaskPassed(true);
    void maybeFinalize(blocks, true);
  };

  const showStuckNote = revealed && allAssessed && (!problem.modifyTask || modifyTaskPassed);

  return (
    <div className="problem-view">
      <div className="problem-view__state-badge">{STATE_LABELS[progress.state]}</div>
      {promptNode}
      <div className="problem-view__code-readonly">
        <CodeEditor value={problem.code} onChange={() => {}} readOnly ariaLabel="説明対象コード" wrap={prefs.codeWrap} />
      </div>

      <HintsPanel
        hints={problem.hints}
        openedCount={progress.hintsOpenedCount}
        onOpenNext={() => handleOpenHint(progress.hintsOpenedCount)}
      />

      {problem.blocks.map((block, i) => (
        <div className="problem-view__block" key={i}>
          <div className="problem-view__block-title">
            {block.lines[0]}〜{block.lines[1]}行目は何をしていますか？
          </div>
          <textarea
            rows={2}
            value={blocks[i]?.explanation ?? ''}
            onChange={(e) => {
              const next = blocks.map((b, idx) => (idx === i ? { ...b, explanation: e.target.value } : b));
              setBlocks(next);
            }}
            onBlur={() => void persistBlocks(blocks)}
            disabled={revealed}
          />
          {revealed && (
            <>
              <p className="problem-view__model-text">{block.modelText}</p>
              <div className="problem-view__self-assess">
                {(['できた', 'あいまい', 'できなかった'] as const).map((label) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={blocks[i]?.assessment === label}
                    onClick={() => handleAssess(i, label)}
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
          <button type="button" onClick={handleReveal}>
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
        <ModifyTaskView
          setId={setId}
          problem={problem}
          datasets={datasets}
          initialCode={progress.modifyTaskCode ?? problem.code}
          onCodeChange={(code) => {
            const p = { ...progress, modifyTaskCode: code, updatedAt: new Date().toISOString() };
            setProgress(p);
            void saveProgress(p);
          }}
          onPassed={handleModifyTaskPassed}
        />
      )}

      {showStuckNote && (
        <StuckNoteInput
          emphasize={!allGood}
          initialValue={progress.stuckNote}
          onSave={(note) => void recordStuckNote(setId, problem.id, note)}
        />
      )}
    </div>
  );
}

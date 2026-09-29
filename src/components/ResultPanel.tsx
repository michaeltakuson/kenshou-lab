import { useState } from 'react';
import type { PyStatus, RunResult } from '../pyodide/types';
import './ResultPanel.css';

interface ResultPanelProps {
  result: RunResult | null;
  status: PyStatus;
}

function ValueView({ value }: { value: RunResult['value'] }) {
  if (value === null) return null;
  if (value.kind === 'repr') {
    return (
      <div className="result-block">
        <div className="result-block__title">値</div>
        <pre className="result-pre">{value.text}</pre>
      </div>
    );
  }
  return (
    <div className="result-block">
      <div className="result-block__title">値(表)</div>
      <div className="result-table-scroll">
        <table className="result-table">
          <thead>
            <tr>
              <th />
              {value.columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, i) => (
              <tr key={i}>
                <th>{String(value.index[i])}</th>
                {row.map((cell, j) => (
                  <td key={j}>{cell === null ? '' : String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {value.truncated && (
        <p className="result-note">
          先頭{value.rows.length}行のみ表示しています(全{value.totalRows}行)。
        </p>
      )}
    </div>
  );
}

function TestResultsView({ result }: { result: RunResult }) {
  if (result.allPassed === null) return null;
  return (
    <div className={`result-block result-tests ${result.allPassed ? 'result-tests--pass' : 'result-tests--fail'}`}>
      <div className="result-block__title">
        採点結果: {result.allPassed ? 'すべて合格' : '不合格の項目があります'}
      </div>
      <ul className="result-tests__list">
        {result.testResults.map((t, i) => (
          <li key={i} className={t.passed ? 'result-tests__item--pass' : 'result-tests__item--fail'}>
            <span className="result-tests__mark">{t.passed ? '合格' : '不合格'}</span>
            <span className="result-tests__name">{t.name}</span>
            {!t.passed && t.message && <p className="result-tests__message">{t.message}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorView({ error }: { error: NonNullable<RunResult['error']> }) {
  const [showTraceback, setShowTraceback] = useState(false);
  return (
    <div className="result-block result-block--error">
      <div className="result-block__title">エラー: {error.name}</div>
      <p className="result-error__hint">{error.hint}</p>
      <p className="result-error__message">
        {error.lineno !== null ? `${error.lineno}行目: ` : ''}
        {error.message}
      </p>
      {error.traceback && (
        <details open={showTraceback} onToggle={(e) => setShowTraceback(e.currentTarget.open)}>
          <summary>詳しいエラー内容(トレースバック)を見る</summary>
          <pre className="result-pre result-pre--small">{error.traceback}</pre>
        </details>
      )}
    </div>
  );
}

export function ResultPanel({ result, status }: ResultPanelProps) {
  if (status.phase === 'loading') {
    return (
      <div className="result-panel result-panel--status">
        <p>実行環境を準備しています…</p>
        <p className="result-note">{status.message}</p>
        <p className="result-note">初回はライブラリのダウンロードに時間がかかることがあります。</p>
      </div>
    );
  }
  if (status.phase === 'restarting') {
    return (
      <div className="result-panel result-panel--status">
        {status.timeoutSec !== undefined && (
          <p className="result-error__message">
            {status.timeoutSec}秒を超えたので停止しました。
          </p>
        )}
        <p className="result-note">実行環境を再準備しています…</p>
      </div>
    );
  }
  if (status.phase === 'error') {
    return (
      <div className="result-panel result-panel--status">
        <p className="result-error__message">実行環境でエラーが発生しました: {status.message}</p>
      </div>
    );
  }
  if (status.phase === 'running') {
    return (
      <div className="result-panel result-panel--status">
        <p>実行中…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="result-panel result-panel--status">
        <p className="result-note">まだ実行していません。「実行」ボタンを押してください。</p>
      </div>
    );
  }

  if (result.timedOut) {
    return (
      <div className="result-panel result-panel--status">
        <p className="result-error__message">
          {result.timeoutSec}秒を超えたので停止しました。
        </p>
        <p className="result-note">
          実行環境の再準備が完了しました。もう一度「実行」を押してください。
        </p>
      </div>
    );
  }

  return (
    <div className="result-panel">
      <TestResultsView result={result} />
      {!result.ok && result.error && <ErrorView error={result.error} />}
      {result.stdout && (
        <div className="result-block">
          <div className="result-block__title">出力(print)</div>
          <pre className="result-pre">{result.stdout}</pre>
        </div>
      )}
      {result.stderr && (
        <div className="result-block result-block--warn">
          <div className="result-block__title">標準エラー出力</div>
          <pre className="result-pre">{result.stderr}</pre>
        </div>
      )}
      {result.ok && <ValueView value={result.value} />}
      {result.figures.length > 0 && (
        <div className="result-block">
          <div className="result-block__title">図</div>
          <div className="result-figures">
            {result.figures.map((src, i) => (
              <img key={i} src={src} alt={`図${i + 1}`} className="result-figure" />
            ))}
          </div>
        </div>
      )}
      {result.ok &&
        result.allPassed === null &&
        !result.stdout &&
        !result.stderr &&
        result.value === null &&
        result.figures.length === 0 && <p className="result-note">実行が完了しました(出力なし)。</p>}
    </div>
  );
}

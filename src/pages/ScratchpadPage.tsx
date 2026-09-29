import { useEffect, useRef, useState } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { ResultPanel } from '../components/ResultPanel';
import { getPyodideClient } from '../pyodide/client';
import type { PyStatus, RunResult } from '../pyodide/types';
import './ScratchpadPage.css';

const STORAGE_KEY = 'kenshou-lab:scratchpad-draft';
const DEFAULT_CODE = `import pandas as pd

df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
df
`;

function loadDraft(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CODE;
  } catch {
    return DEFAULT_CODE;
  }
}

export function ScratchpadPage() {
  const [code, setCode] = useState(loadDraft);
  const [result, setResult] = useState<RunResult | null>(null);
  const [status, setStatus] = useState<PyStatus>({ phase: 'loading', message: '準備中…' });
  const clientRef = useRef(getPyodideClient());

  useEffect(() => {
    const client = clientRef.current;
    return client.onStatus(setStatus);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // 保存できなくても実行自体は継続できるため無視する
    }
  }, [code]);

  const isBusy = status.phase === 'loading' || status.phase === 'running' || status.phase === 'restarting';

  const handleRun = async () => {
    const client = clientRef.current;
    const r = await client.run({ code, timeoutSec: 10 });
    setResult(r);
  };

  return (
    <div className="scratchpad-page">
      <div className="scratchpad-page__header">
        <h1>自由実行(スクラッチパッド)</h1>
        <p>
          問題とは関係なく、自由にPythonコードを試せる場所です。numpy / pandas / matplotlib /
          scipy / statsmodels / scikit-learn が使えます。
        </p>
      </div>
      <div className="scratchpad-page__body">
        <div className="scratchpad-page__editor">
          <CodeEditor value={code} onChange={setCode} ariaLabel="自由実行コード入力欄" />
          <div className="scratchpad-page__actions">
            <button type="button" onClick={handleRun} disabled={isBusy}>
              実行
            </button>
            {isBusy && <span className="scratchpad-page__busy">実行環境が準備中/実行中です…</span>}
          </div>
        </div>
        <div className="scratchpad-page__result">
          <ResultPanel result={result} status={status} />
        </div>
      </div>
    </div>
  );
}

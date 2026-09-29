/// <reference lib="webworker" />
import { PYODIDE_CDN_BASE, REQUIRED_PACKAGES } from '../pyodide/version';
import bootstrapSource from './bootstrap.py?raw';
import type { RunOptions, RunResult, WorkerToMainMessage } from '../pyodide/types';

// Vite製ESM WorkerからCDN上のpyodide.mjsを動的importする。
// (importScriptsはESM WorkerでもClassic Workerでも使えるが、ESM importの方が
//  Viteのビルドパイプラインと相性が良いため、こちらを採用する。)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

declare const self: DedicatedWorkerGlobalScope;

function post(message: WorkerToMainMessage) {
  self.postMessage(message);
}

let pyodidePromise: Promise<PyodideInterface> | null = null;

async function initPyodide(): Promise<PyodideInterface> {
  post({ type: 'progress', message: 'Pythonランタイムを準備中です…' });
  const pyodideModuleUrl = `${PYODIDE_CDN_BASE}pyodide.mjs`;
  const { loadPyodide } = await import(/* @vite-ignore */ pyodideModuleUrl);
  const pyodide: PyodideInterface = await loadPyodide({ indexURL: PYODIDE_CDN_BASE });

  post({
    type: 'progress',
    message: `データ分析ライブラリを読み込み中です…(${REQUIRED_PACKAGES.join(', ')})`,
  });
  await pyodide.loadPackage([...REQUIRED_PACKAGES], {
    messageCallback: (message: string) => post({ type: 'progress', message }),
    errorCallback: (message: string) => post({ type: 'progress', message }),
  });

  post({ type: 'progress', message: '実行エンジンを初期化しています…' });
  pyodide.runPython(bootstrapSource);

  return pyodide;
}

function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = initPyodide();
  }
  return pyodidePromise;
}

async function writeDatasets(pyodide: PyodideInterface, datasets: RunOptions['datasets']) {
  if (!datasets || datasets.length === 0) return;
  try {
    pyodide.FS.mkdirTree('data');
  } catch {
    // 既に存在する場合は無視
  }
  for (const ds of datasets) {
    let content = ds.content;
    if (content === undefined && ds.url) {
      const res = await fetch(ds.url);
      content = await res.text();
    }
    if (content !== undefined) {
      pyodide.FS.writeFile(`data/${ds.name}`, content);
    }
  }
}

function internalErrorResult(e: unknown): RunResult {
  const message = e instanceof Error ? e.message : String(e);
  const stack = e instanceof Error ? (e.stack ?? '') : '';
  return {
    ok: false,
    stdout: '',
    stderr: '',
    value: null,
    figures: [],
    testResults: [],
    allPassed: null,
    error: {
      name: 'InternalError',
      message,
      lineno: null,
      hint: 'アプリ内部でエラーが発生しました。時間をおいて再度お試しください。',
      traceback: stack,
    },
  };
}

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg?.type !== 'run') return;
  const { id, code, setupCode, datasets, tests } = msg as { id: string } & RunOptions;
  try {
    const pyodide = await getPyodide();
    await writeDatasets(pyodide, datasets);
    const runFn = pyodide.globals.get('__kenshou_execute');
    const testsJson = JSON.stringify(tests ?? null);
    const resultJson: string = runFn(setupCode ?? '', code ?? '', testsJson);
    runFn.destroy();
    const result = JSON.parse(resultJson) as RunResult;
    post({ type: 'run-result', id, result });
  } catch (e) {
    post({ type: 'run-result', id, result: internalErrorResult(e) });
  }
};

getPyodide()
  .then(() => post({ type: 'ready' }))
  .catch((e) => post({ type: 'fatal', message: e instanceof Error ? e.message : String(e) }));

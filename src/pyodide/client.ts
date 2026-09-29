import { v4 as uuidv4 } from 'uuid';
import type { PyStatus, RunOptions, RunResult, WorkerToMainMessage } from './types';

const DEFAULT_TIMEOUT_SEC = 10;

type StatusListener = (status: PyStatus) => void;

interface PendingRun {
  id: string;
  resolve: (result: RunResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Pyodide Workerをラップし、メインスレッド側からPromiseベースで実行できるようにする。
 *
 * タイムアウトの実装方針: Worker内でPythonコードが `while True: pass` のように
 * 無限ループすると、Worker自体が完全にブロックされ、内部からは何も応答できなくなる。
 * そのため、タイムアウトの検出と対処(Worker破棄・再生成)はメインスレッド側で行う。
 */
export class PyodideClient {
  private worker: Worker | null = null;
  private listeners = new Set<StatusListener>();
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;
  private pending: PendingRun | null = null;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.spawnWorker();
  }

  onStatus(fn: StatusListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(status: PyStatus) {
    for (const fn of this.listeners) fn(status);
  }

  private spawnWorker() {
    const worker = new Worker(new URL('../workers/pyodideWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (ev: MessageEvent<WorkerToMainMessage>) => {
      this.handleMessage(ev.data);
    });
    worker.addEventListener('error', (ev) => {
      this.emit({ phase: 'error', message: ev.message ?? '不明なエラーが発生しました。' });
    });
    this.worker = worker;
  }

  private handleMessage(msg: WorkerToMainMessage) {
    switch (msg.type) {
      case 'progress':
        this.emit({ phase: 'loading', message: msg.message });
        break;
      case 'ready':
        this.emit({ phase: 'ready' });
        this.readyResolve?.();
        break;
      case 'run-result':
        this.resolvePending(msg.id, msg.result);
        break;
      case 'fatal':
        this.emit({ phase: 'error', message: msg.message });
        break;
    }
  }

  private resolvePending(id: string, result: RunResult) {
    if (!this.pending || this.pending.id !== id) return;
    clearTimeout(this.pending.timer);
    const { resolve } = this.pending;
    this.pending = null;
    this.emit({ phase: 'ready' });
    resolve(result);
  }

  async waitUntilReady(): Promise<void> {
    await this.readyPromise;
  }

  /** 実行中のコードを強制停止し、Workerを作り直す(タイムアウト時の処理)。 */
  private restartAfterTimeout(timeoutSec: number) {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    // 「停止した理由」と「再準備中である」ことを同時に見せる(片方だけ一瞬出て消えると分かりにくいため)。
    this.emit({ phase: 'restarting', timeoutSec });
    this.spawnWorker();
  }

  run(options: RunOptions): Promise<RunResult> {
    const timeoutSec = options.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
    const id = uuidv4();

    return new Promise((resolve) => {
      void (async () => {
        await this.waitUntilReady();
        if (!this.worker) {
          resolve({
            ok: false,
            stdout: '',
            stderr: '',
            value: null,
            figures: [],
            error: {
              name: 'InternalError',
              message: '実行エンジンの準備ができていません。',
              lineno: null,
              hint: '少し待ってから再度お試しください。',
              traceback: '',
            },
          });
          return;
        }

        this.emit({ phase: 'running' });
        const timer = setTimeout(() => {
          this.pending = null;
          this.restartAfterTimeout(timeoutSec);
          resolve({
            ok: false,
            stdout: '',
            stderr: '',
            value: null,
            figures: [],
            timedOut: true,
            timeoutSec,
          });
        }, timeoutSec * 1000);

        this.pending = { id, resolve, timer };
        this.worker.postMessage({
          type: 'run',
          id,
          code: options.code,
          setupCode: options.setupCode ?? '',
          datasets: options.datasets ?? [],
        });
      })();
    });
  }
}

let singleton: PyodideClient | null = null;

/** アプリ全体で1つのWorkerを共有する(問題を切り替えるたびに再起動しない)。 */
export function getPyodideClient(): PyodideClient {
  if (!singleton) singleton = new PyodideClient();
  return singleton;
}

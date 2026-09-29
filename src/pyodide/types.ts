// 検証ラボ: Pyodide Workerと画面(メインスレッド)の間でやり取りする型。
import type { TestCase } from '../problems/types';

export interface DatasetSource {
  /** Pyodideの仮想FS上での data/<name> になるファイル名 */
  name: string;
  /** リポジトリ経由(public/data/...)で取得する場合のURL */
  url?: string;
  /** 貼り付け(inline)で持っているCSV等の内容 */
  content?: string;
}

export interface RunOptions {
  code: string;
  setupCode?: string;
  datasets?: DatasetSource[];
  /** 既定10秒。問題ごとに変更可能(第10.3章 timeoutSec)。 */
  timeoutSec?: number;
  /** 指定すると「提出」として採点まで行う。省略すると「実行」(採点なし)。 */
  tests?: TestCase[];
}

export interface TestOutcome {
  name: string;
  passed: boolean;
  message: string | null;
  kind: 'assertion_failed' | 'grading_error' | null;
}

export type ResultValue =
  | null
  | { kind: 'repr'; text: string }
  | {
      kind: 'table';
      columns: string[];
      index: Array<string | number>;
      rows: unknown[][];
      totalRows: number;
      truncated: boolean;
    };

export interface RunError {
  name: string;
  message: string;
  lineno: number | null;
  hint: string;
  traceback: string;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  value: ResultValue;
  figures: string[];
  error?: RunError;
  /** tests未指定なら空配列、指定していれば各テストの結果 */
  testResults: TestOutcome[];
  /** tests未指定ならnull、指定していれば全テスト合格かどうか */
  allPassed: boolean | null;
  /** メインスレッド側でタイムアウトと判断した場合にtrueを立てて埋め込む */
  timedOut?: boolean;
  timeoutSec?: number;
}

export type WorkerToMainMessage =
  | { type: 'progress'; message: string }
  | { type: 'ready' }
  | { type: 'run-result'; id: string; result: RunResult }
  | { type: 'fatal'; message: string };

export type PyStatus =
  | { phase: 'loading'; message: string }
  | { phase: 'ready' }
  | { phase: 'running' }
  // タイムアウトで停止した「理由」と、Workerを作り直している「再準備中」は
  // 同時に見えている必要がある(片方だけが一瞬表示されて消えると分かりにくいため)。
  | { phase: 'restarting'; timeoutSec?: number }
  | { phase: 'error'; message: string };

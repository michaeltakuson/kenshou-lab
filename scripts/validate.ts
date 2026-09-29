// npm run validate: public/problems/ 以下の全問題セットを検証する(SPEC.md 10.5)。
// 1. JSON Schemaでの形式チェック
// 2. modelAnswer(explainはcode)を実際にPyodideで実行し、自分のテストに合格することを確認
//
// Pyodide本体(asm.js/wasm)はnode_modules/pyodideのローカルファイルを使う
// (Node.jsのデフォルトESMローダーは import("https://...") を実行できないため、
//  ブラウザと同じようにCDNから動的importすることができない)。
// ただし科学計算パッケージ(numpy/pandas/...)の.whlはnode_modulesに含まれていないため、
// ローカルのpyodide-lock.jsonから依存関係を解決した上で、ブラウザと同じバージョンの
// CDN(PYODIDE_CDN_BASE)から明示的なURLとして取得する。こうすることで、
// 「CIは通ったのに実機(ブラウザ)で動かない」という食い違いを防ぐ。
/* eslint-disable no-console */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { loadPyodide } from 'pyodide';
import { createProblemSetValidator } from '../src/lib/schemaValidation';
import { PYODIDE_CDN_BASE, REQUIRED_PACKAGES } from '../src/pyodide/version';

const ROOT = process.cwd();
const PROBLEMS_DIR = join(ROOT, 'public/problems');
const SCHEMA_PATH = join(ROOT, 'schema/problem-set.schema.json');
const BOOTSTRAP_PATH = join(ROOT, 'src/workers/bootstrap.py');

interface LockPackageEntry {
  name: string;
  file_name: string;
  depends: string[];
}

interface PyodideLock {
  packages: Record<string, LockPackageEntry>;
}

function resolvePackageWheelUrls(names: readonly string[]): string[] {
  const require = createRequire(import.meta.url);
  const lock = require('pyodide/pyodide-lock.json') as PyodideLock;
  const seen = new Set<string>();
  const queue = [...names];
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = lock.packages[name];
    if (!entry) continue;
    for (const dep of entry.depends) queue.push(dep);
  }
  return [...seen]
    .map((name) => lock.packages[name])
    .filter((entry): entry is LockPackageEntry => Boolean(entry))
    .map((entry) => `${PYODIDE_CDN_BASE}${entry.file_name}`);
}

interface Failure {
  file: string;
  message: string;
}

interface DatasetLike {
  name: string;
  path?: string;
  inline?: string;
}

interface TestLike {
  name: string;
  code: string;
  message: string;
}

interface ProblemLike {
  id: string;
  type: 'write' | 'read' | 'fix' | 'explain';
  setup?: string;
  starterCode?: string;
  modelAnswer?: string;
  tests?: TestLike[];
  code?: string;
}

interface ProblemSetLike {
  setId: string;
  datasets?: DatasetLike[];
  problems: ProblemLike[];
}

interface ExecuteResult {
  ok: boolean;
  error?: { name: string; message: string };
  allPassed: boolean | null;
  testResults: { name: string; passed: boolean }[];
}

async function writeDatasets(pyodide: Awaited<ReturnType<typeof loadPyodide>>, datasets: DatasetLike[]) {
  if (datasets.length === 0) return;
  try {
    pyodide.FS.mkdirTree('data');
  } catch {
    // 既に存在する場合は無視
  }
  for (const ds of datasets) {
    let content = ds.inline;
    if (content === undefined && ds.path) {
      content = readFileSync(join(ROOT, 'public', ds.path), 'utf-8');
    }
    if (content !== undefined) {
      pyodide.FS.writeFile(`data/${ds.name}`, content);
    }
  }
}

function checkProblem(
  runFn: (setup: string, code: string, testsJson: string) => string,
  file: string,
  setId: string,
  problem: ProblemLike,
  failures: Failure[],
) {
  const label = `${setId}/${problem.id}`;

  if (problem.type === 'write' || problem.type === 'fix') {
    const resultJson = runFn(problem.setup ?? '', problem.modelAnswer ?? '', JSON.stringify(problem.tests ?? []));
    const result = JSON.parse(resultJson) as ExecuteResult;
    if (!result.ok) {
      failures.push({
        file,
        message: `${label}: modelAnswerの実行でエラーが発生しました(${result.error?.name}: ${result.error?.message})`,
      });
      return;
    }
    if (result.allPassed !== true) {
      const failed = result.testResults
        .filter((t) => !t.passed)
        .map((t) => t.name)
        .join(', ');
      failures.push({ file, message: `${label}: modelAnswerが自分のテストに合格しませんでした(不合格: ${failed})` });
    }
    return;
  }

  // read/explainは code を実行してエラーが起きないことだけを確認する
  // (readのoutput/choice/valueの正解はJSON側にauthorが直接書く値であり、実行結果から導出しない)
  const resultJson = runFn(problem.setup ?? '', problem.code ?? '', 'null');
  const result = JSON.parse(resultJson) as ExecuteResult;
  if (!result.ok) {
    failures.push({
      file,
      message: `${label}: codeの実行でエラーが発生しました(${result.error?.name}: ${result.error?.message})`,
    });
  }
}

async function main() {
  const failures: Failure[] = [];
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
  const validate = createProblemSetValidator(schema);

  if (!existsSync(PROBLEMS_DIR)) {
    console.log('public/problems が存在しないため、検証対象はありません。');
    return;
  }

  const files = readdirSync(PROBLEMS_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');
  if (files.length === 0) {
    console.log('検証対象の問題セットがありません。');
    return;
  }

  const parsedSets: { file: string; data: ProblemSetLike }[] = [];
  for (const file of files) {
    const raw = readFileSync(join(PROBLEMS_DIR, file), 'utf-8');
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      failures.push({ file, message: `JSONとして読み取れません: ${(e as Error).message}` });
      continue;
    }
    const issues = validate(data);
    if (issues.length > 0) {
      for (const issue of issues) {
        failures.push({ file, message: `${issue.path}: ${issue.message}` });
      }
      continue;
    }
    parsedSets.push({ file, data: data as ProblemSetLike });
  }

  if (parsedSets.length > 0) {
    console.log('Pyodideを読み込んでいます(模範解答の実行確認)…');
    const pyodide = await loadPyodide();
    const wheelUrls = resolvePackageWheelUrls(REQUIRED_PACKAGES);
    console.log(`パッケージを取得しています(${PYODIDE_CDN_BASE})…`);
    await pyodide.loadPackage(wheelUrls);
    const bootstrapSource = readFileSync(BOOTSTRAP_PATH, 'utf-8');
    pyodide.runPython(bootstrapSource);
    const runFn = pyodide.globals.get('__kenshou_execute') as (
      setup: string,
      code: string,
      testsJson: string,
    ) => string;

    for (const { file, data } of parsedSets) {
      await writeDatasets(pyodide, data.datasets ?? []);
      for (const problem of data.problems ?? []) {
        checkProblem(runFn, file, data.setId, problem, failures);
      }
    }
    runFn.destroy();
  }

  if (failures.length > 0) {
    console.error(`\n検証に失敗しました(${failures.length}件):\n`);
    for (const f of failures) {
      console.error(`  [${f.file}] ${f.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nすべての問題セットの検証に成功しました(${parsedSets.length}セット、${files.length}ファイル)。`);
}

main().catch((e: unknown) => {
  console.error('検証スクリプトの実行中に予期しないエラーが発生しました:', e);
  process.exitCode = 1;
});

// 検証ラボ: 問題フォーマットの型(SPEC.md 第10章)。schema/problem-set.schema.jsonと対応する。

export interface DatasetDef {
  name: string;
  path?: string;
  inline?: string;
}

export interface TestCase {
  name: string;
  code: string;
  message: string;
}

export interface ModelExplanationEntry {
  lines: [number, number];
  text: string;
}

export interface PredictSpec {
  question: string;
  required?: boolean;
}

export type AnswerSpec =
  | { kind: 'output' }
  | { kind: 'choice'; choices: string[]; correct: number }
  | { kind: 'value'; value: unknown; tolerance?: number };

export interface ModifyTask {
  prompt: string;
  tests: TestCase[];
}

export interface ExplainBlock {
  lines: [number, number];
  modelText: string;
}

interface ProblemCommon {
  id: string;
  title: string;
  prompt: string;
  difficulty: 1 | 2 | 3;
  estimatedMinutes: number;
  tags: string[];
  timeoutSec?: number;
  hints: string[];
  answerUnlockAfterFails?: number;
  setup?: string;
  predict?: PredictSpec;
}

export interface WriteOrFixProblem extends ProblemCommon {
  type: 'write' | 'fix';
  starterCode: string;
  tests: TestCase[];
  modelAnswer: string;
  modelExplanation?: ModelExplanationEntry[];
}

export interface ReadProblem extends ProblemCommon {
  type: 'read';
  code: string;
  answer: AnswerSpec;
  modelExplanation?: ModelExplanationEntry[];
}

export interface ExplainProblem extends ProblemCommon {
  type: 'explain';
  code: string;
  blocks: ExplainBlock[];
  modifyTask?: ModifyTask;
}

export type Problem = WriteOrFixProblem | ReadProblem | ExplainProblem;

export interface ProblemSet {
  schemaVersion: 1;
  setId: string;
  title: string;
  milestone: 'M1' | 'M2' | 'M3' | 'M4';
  unit: number;
  description?: string;
  packages?: string[];
  datasets?: DatasetDef[];
  problems: Problem[];
}

/** リポジトリ経由/ローカル貼り付けのどちらから読み込んだかを記録する。 */
export type ProblemSetSource = 'repo' | 'local';

export interface ProblemSetSummary {
  setId: string;
  title: string;
  milestone: ProblemSet['milestone'];
  unit: number;
  description?: string;
  problemCount: number;
  source: ProblemSetSource;
}

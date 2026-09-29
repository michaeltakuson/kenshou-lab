import type { AnswerSpec } from '../problems/types';

/**
 * 改行コードの統一・各行末の空白除去・末尾の空行除去を行う(SPEC.md第5章)。
 * 「読む」問題の予想と実際の出力の比較で使う。
 */
export function normalizeOutputText(text: string): string {
  const unified = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = unified.split('\n').map((line) => line.replace(/[ \t]+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.join('\n');
}

export function outputsMatch(expected: string, actual: string): boolean {
  return normalizeOutputText(expected) === normalizeOutputText(actual);
}

/**
 * 「読む」問題の回答方式(output/choice/value)ごとに正誤を判定する。
 * choiceとvalueの正解はJSON側にauthorが直接書いた値であり、実行結果から導出しない。
 */
export function judgeReadAnswer(answer: AnswerSpec, userInput: string, actualOutputText: string): boolean {
  switch (answer.kind) {
    case 'output':
      return outputsMatch(userInput, actualOutputText);
    case 'choice': {
      const idx = Number(userInput);
      return Number.isInteger(idx) && idx === answer.correct;
    }
    case 'value': {
      if (typeof answer.value === 'number') {
        const parsed = Number(userInput);
        if (Number.isNaN(parsed)) return false;
        const tolerance = answer.tolerance ?? 0;
        return Math.abs(parsed - answer.value) <= tolerance;
      }
      return normalizeOutputText(userInput) === normalizeOutputText(String(answer.value));
    }
    default:
      return false;
  }
}

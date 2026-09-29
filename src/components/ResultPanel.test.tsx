import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultPanel } from './ResultPanel';
import type { PyStatus, RunResult } from '../pyodide/types';

const READY: PyStatus = { phase: 'ready' };

describe('ResultPanel', () => {
  it('読み込み中はメッセージを表示する', () => {
    render(<ResultPanel result={null} status={{ phase: 'loading', message: 'Pythonランタイムを準備中です…' }} />);
    expect(screen.getByText('Pythonランタイムを準備中です…')).toBeInTheDocument();
  });

  it('未実行なら実行を促す文言を表示する', () => {
    render(<ResultPanel result={null} status={READY} />);
    expect(screen.getByText(/まだ実行していません/)).toBeInTheDocument();
  });

  it('再準備中は、新しいWorkerの読み込み進捗が来ても停止理由を表示し続ける(回帰テスト)', () => {
    // 新しいWorkerが最初の進捗を送ってきた後も、
    // 「なぜ再準備しているか(タイムアウトしたこと)」が消えずに見え続けることを確認する。
    render(
      <ResultPanel
        result={null}
        status={{ phase: 'restarting', timeoutSec: 10, message: 'Pythonランタイムを準備中です…' }}
      />,
    );
    expect(screen.getByText('10秒を超えたので停止しました。')).toBeInTheDocument();
    expect(screen.getByText('Pythonランタイムを準備中です…')).toBeInTheDocument();
  });

  it('タイムアウト結果は理由と再準備完了の両方を表示する', () => {
    const result: RunResult = {
      ok: false,
      stdout: '',
      stderr: '',
      value: null,
      figures: [],
      testResults: [],
      allPassed: null,
      timedOut: true,
      timeoutSec: 10,
    };
    render(<ResultPanel result={result} status={READY} />);
    expect(screen.getByText('10秒を超えたので停止しました。')).toBeInTheDocument();
    expect(screen.getByText(/もう一度「実行」を押してください/)).toBeInTheDocument();
  });

  it('エラー結果は例外名・日本語の説明・行番号を表示する', () => {
    const result: RunResult = {
      ok: false,
      stdout: '',
      stderr: '',
      value: null,
      figures: [],
      testResults: [],
      allPassed: null,
      error: {
        name: 'KeyError',
        message: "'x'",
        lineno: 3,
        hint: '辞書やDataFrameに、存在しないキー(列名など)でアクセスしようとしています。',
        traceback: 'Traceback...',
      },
    };
    render(<ResultPanel result={result} status={READY} />);
    expect(screen.getByText(/KeyError/)).toBeInTheDocument();
    expect(screen.getByText(/存在しないキー/)).toBeInTheDocument();
    expect(screen.getByText(/3行目/)).toBeInTheDocument();
  });

  it('表形式の値と図を表示する', () => {
    const result: RunResult = {
      ok: true,
      stdout: 'hello\n',
      stderr: '',
      value: {
        kind: 'table',
        columns: ['a', 'b'],
        index: [0, 1],
        rows: [
          [1, 2],
          [3, 4],
        ],
        totalRows: 2,
        truncated: false,
      },
      figures: ['data:image/png;base64,AAAA'],
      testResults: [],
      allPassed: null,
    };
    render(<ResultPanel result={result} status={READY} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'a' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '図1' })).toBeInTheDocument();
  });

  it('採点結果はテストごとの合否とメッセージを表示し、テストコード自体は表示しない', () => {
    const result: RunResult = {
      ok: true,
      stdout: '',
      stderr: '',
      value: null,
      figures: [],
      testResults: [
        { name: 'shapeが正しい', passed: true, message: null, kind: null },
        {
          name: '列名が正しい',
          passed: false,
          message: '列名がおかしいようです。',
          kind: 'assertion_failed',
        },
      ],
      allPassed: false,
    };
    render(<ResultPanel result={result} status={READY} />);
    expect(screen.getByText(/不合格の項目があります/)).toBeInTheDocument();
    expect(screen.getByText('shapeが正しい')).toBeInTheDocument();
    expect(screen.getByText('列名がおかしいようです。')).toBeInTheDocument();
  });
});

import { useRef, useState } from 'react';
import schema from '../../schema/problem-set.schema.json';
import { createProblemSetValidator, type ValidationIssue } from '../lib/schemaValidation';
import { hasLocalProblemSet, saveLocalProblemSet } from '../problems/localStore';
import { clearAllData } from '../db/db';
import { usePrefs } from '../prefs/prefs';
import { backupFileName, exportBackup, importBackup, type BackupData, type ImportSummary } from '../backup/backup';
import type { ProblemSet } from '../problems/types';
import './SettingsPage.css';

const validateProblemSet = createProblemSetValidator(schema);

type ImportState =
  | { phase: 'idle' }
  | { phase: 'invalid'; issues: ValidationIssue[] }
  | { phase: 'confirm-overwrite'; set: ProblemSet }
  | { phase: 'done'; setId: string };

export function SettingsPage() {
  const [text, setText] = useState('');
  const [state, setState] = useState<ImportState>({ phase: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prefs, setPref] = usePrefs();
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [restoreSummary, setRestoreSummary] = useState<ImportSummary | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);

  const tryImport = async (raw: string) => {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      setState({
        phase: 'invalid',
        issues: [{ path: '(ルート)', message: `JSONとして読み取れませんでした: ${(e as Error).message}` }],
      });
      return;
    }
    const issues = validateProblemSet(data);
    if (issues.length > 0) {
      setState({ phase: 'invalid', issues });
      return;
    }
    const set = data as ProblemSet;
    if (await hasLocalProblemSet(set.setId)) {
      setState({ phase: 'confirm-overwrite', set });
      return;
    }
    await saveLocalProblemSet(set);
    setState({ phase: 'done', setId: set.setId });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((content) => {
      setText(content);
      void tryImport(content);
    });
    e.target.value = '';
  };

  const confirmOverwrite = async () => {
    if (state.phase !== 'confirm-overwrite') return;
    await saveLocalProblemSet(state.set);
    setState({ phase: 'done', setId: state.set.setId });
  };

  const handleExport = async () => {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName(data.exportedAt);
    a.click();
    URL.revokeObjectURL(url);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 3000);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError(null);
    setRestoreSummary(null);
    file
      .text()
      .then((content) => JSON.parse(content) as BackupData)
      .then((data) => importBackup(data))
      .then((summary) => setRestoreSummary(summary))
      .catch((err: Error) => setRestoreError(`復元できませんでした: ${err.message}`));
    e.target.value = '';
  };

  return (
    <div className="settings-page">
      <h1>設定</h1>

      <section className="settings-page__section">
        <h2>問題セットの追加</h2>
        <p className="settings-page__hint">
          チャット側で作成されたJSONを貼り付けるか、ファイルを選んで追加できます。
          この端末にのみ保存され、一覧では「ローカル」と表示されます。
        </p>
        <textarea
          className="settings-page__textarea"
          rows={10}
          placeholder="問題セットのJSONをここに貼り付け"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="settings-page__actions">
          <button type="button" onClick={() => tryImport(text)} disabled={text.trim().length === 0}>
            貼り付けた内容を追加
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            ファイルを選択
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={handleFileChange}
          />
        </div>

        {state.phase === 'invalid' && (
          <div className="settings-page__issues">
            <p>次の点を直してから、もう一度お試しください:</p>
            <ul>
              {state.issues.map((issue, i) => (
                <li key={i}>
                  <code>{issue.path}</code>: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.phase === 'confirm-overwrite' && (
          <div className="settings-page__confirm">
            <p>
              同じID「{state.set.setId}」の問題セットが既にあります。上書きしますか？
              (これまでの記録は消えません)
            </p>
            <div className="settings-page__actions">
              <button type="button" onClick={confirmOverwrite}>
                上書きする
              </button>
              <button type="button" className="settings-page__cancel" onClick={() => setState({ phase: 'idle' })}>
                やめる
              </button>
            </div>
          </div>
        )}

        {state.phase === 'done' && (
          <p className="settings-page__success">
            問題セット「{state.setId}」を追加しました。問題セット一覧から確認できます。
          </p>
        )}
      </section>

      <section className="settings-page__section">
        <h2>テーマ</h2>
        <div className="settings-page__radio-group">
          {(['auto', 'light', 'dark'] as const).map((v) => (
            <label key={v}>
              <input
                type="radio"
                name="theme"
                checked={prefs.theme === v}
                onChange={() => setPref('theme', v)}
              />
              {v === 'auto' ? '自動(OSに従う)' : v === 'light' ? 'ライト' : 'ダーク'}
            </label>
          ))}
        </div>
      </section>

      <section className="settings-page__section">
        <h2>コードエディタ</h2>
        <label className="settings-page__checkbox">
          <input
            type="checkbox"
            checked={prefs.codeWrap}
            onChange={(e) => setPref('codeWrap', e.target.checked)}
          />
          コードを折り返して表示する
        </label>
      </section>

      <section className="settings-page__section">
        <h2>実行タイムアウトの既定値</h2>
        <p className="settings-page__hint">問題ごとに個別のタイムアウトが指定されていない場合に使われます。</p>
        <label>
          <input
            type="number"
            min={1}
            max={120}
            value={prefs.defaultTimeoutSec}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) setPref('defaultTimeoutSec', Math.round(v));
            }}
          />
          秒
        </label>
      </section>

      <section className="settings-page__section">
        <h2>バックアップと復元</h2>
        <p className="settings-page__hint">
          この端末の進捗・記録・実働時間・ローカルの問題セットを1つのJSONファイルに書き出せます。
          別の端末で「復元」すると、両方の記録が重複なく統合されます(上書きではありません)。
        </p>
        <div className="settings-page__actions">
          <button type="button" onClick={() => void handleExport()}>
            {exportDone ? '書き出しました' : 'バックアップを書き出す'}
          </button>
          <button type="button" onClick={() => restoreInputRef.current?.click()}>
            復元する
          </button>
          <input ref={restoreInputRef} type="file" accept="application/json" hidden onChange={handleRestoreFile} />
        </div>
        {restoreError && <p className="settings-page__issues">{restoreError}</p>}
        {restoreSummary && (
          <p className="settings-page__success">
            復元しました(追加したイベント: {restoreSummary.addedEvents}件、重複でスキップ:{' '}
            {restoreSummary.skippedDuplicateEvents}件、更新した進捗: {restoreSummary.upsertedProgress}件、
            問題セット: {restoreSummary.upsertedProblemSets}件)。
          </p>
        )}
      </section>

      <section className="settings-page__section">
        <h2>全データ削除</h2>
        <p className="settings-page__hint">
          進捗・記録・実働時間・ローカルの問題セットを、この端末から完全に削除します。元に戻せません。
        </p>
        {deleteStep === 0 && (
          <button type="button" className="settings-page__danger" onClick={() => setDeleteStep(1)}>
            全データを削除する
          </button>
        )}
        {deleteStep === 1 && (
          <div className="settings-page__confirm">
            <p>本当にすべてのデータを削除しますか？これまでの学習記録がすべて消えます。</p>
            <div className="settings-page__actions">
              <button type="button" className="settings-page__danger" onClick={() => setDeleteStep(2)}>
                削除する
              </button>
              <button type="button" className="settings-page__cancel" onClick={() => setDeleteStep(0)}>
                やめる
              </button>
            </div>
          </div>
        )}
        {deleteStep === 2 && (
          <div className="settings-page__confirm">
            <p>本当に本当に、よろしいですか？(最終確認)</p>
            <div className="settings-page__actions">
              <button
                type="button"
                className="settings-page__danger"
                onClick={() => {
                  void clearAllData().then(() => {
                    setDeleteStep(0);
                    window.location.reload();
                  });
                }}
              >
                完全に削除する
              </button>
              <button type="button" className="settings-page__cancel" onClick={() => setDeleteStep(0)}>
                やめる
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

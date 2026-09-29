import { useRef, useState } from 'react';
import schema from '../../schema/problem-set.schema.json';
import { createProblemSetValidator, type ValidationIssue } from '../lib/schemaValidation';
import { hasLocalProblemSet, saveLocalProblemSet } from '../problems/localStore';
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
    </div>
  );
}

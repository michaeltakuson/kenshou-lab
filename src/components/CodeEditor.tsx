import { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import {
  defaultHighlightStyle,
  indentUnit,
  syntaxHighlighting,
  bracketMatching,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import './CodeEditor.css';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  ariaLabel?: string;
  /** 省略時は折り返しあり(スマホの既定に合わせる)。設定画面のトグルから渡す。 */
  wrap?: boolean;
  /** Ctrl/Cmd+Enter */
  onRunShortcut?: () => void;
  /** Ctrl/Cmd+Shift+Enter */
  onSubmitShortcut?: () => void;
}

/** スマホで入力中に出す記号バー(SPEC.md第11章)。 */
const SYMBOL_KEYS = ['Tab', '(', ')', '[', ']', '{', '}', ':', "'", '"', '=', '.', ',', '_', '#', '+', '-', '*', '/', '<', '>'];

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  ariaLabel,
  wrap = true,
  onRunShortcut,
  onSubmitShortcut,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const shortcutsRef = useRef({ onRunShortcut, onSubmitShortcut });
  shortcutsRef.current = { onRunShortcut, onSubmitShortcut };
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      python(),
      indentUnit.of('    '),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            shortcutsRef.current.onRunShortcut?.();
            return true;
          },
        },
        {
          key: 'Mod-Shift-Enter',
          run: () => {
            shortcutsRef.current.onSubmitShortcut?.();
            return true;
          },
        },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
        if (update.focusChanged) {
          setFocused(update.view.hasFocus);
        }
      }),
      EditorView.editable.of(!readOnly),
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel ?? 'コード入力欄' }),
      EditorView.theme({
        '&': { fontSize: '16px', height: '100%' },
        '.cm-scroller': {
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, Menlo, monospace',
          overflow: 'auto',
        },
      }),
      ...(wrap ? [EditorView.lineWrapping] : []),
    ];

    const state = EditorState.create({ doc: value, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 初回マウント時と、readOnly/wrapが変わったときのみ再構築する。
    // valueの変更は下のuseEffectで同期する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, wrap]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  const insertSymbol = (symbol: string) => {
    const view = viewRef.current;
    if (!view) return;
    const text = symbol === 'Tab' ? '    ' : symbol;
    view.dispatch(view.state.replaceSelection(text));
    view.focus();
  };

  return (
    <div className="code-editor-wrapper">
      <div className="code-editor" ref={containerRef} />
      {!readOnly && focused && (
        <div className="code-editor__symbol-bar" role="toolbar" aria-label="記号入力バー">
          {SYMBOL_KEYS.map((s) => (
            <button
              key={s}
              type="button"
              className="code-editor__symbol-key"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertSymbol(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

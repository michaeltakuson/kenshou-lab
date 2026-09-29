import { useEffect, useRef } from 'react';
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
}

export function CodeEditor({ value, onChange, readOnly = false, ariaLabel }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        closeBrackets(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        python(),
        indentUnit.of('    '),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel ?? 'コード入力欄' }),
        EditorView.theme({
          '&': { fontSize: '16px', height: '100%' },
          '.cm-scroller': {
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Consolas, Menlo, monospace',
            overflow: 'auto',
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 初回マウント時のみ構築する。value以降の変更は下のuseEffectで同期する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

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

  return <div className="code-editor" ref={containerRef} />;
}

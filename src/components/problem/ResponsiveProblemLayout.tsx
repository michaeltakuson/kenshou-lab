import { useState, type ReactNode } from 'react';
import './ResponsiveProblemLayout.css';

interface ResponsiveProblemLayoutProps {
  problemPane: ReactNode;
  codePane: ReactNode;
  resultPane: ReactNode;
  actions: ReactNode;
}

type Tab = 'problem' | 'code' | 'result';

/**
 * 幅900px以上: 左に問題文、右にエディタと結果の2カラム。
 * 幅900px未満: 「問題／コード／結果」のタブ切り替え。実行・提出ボタンは画面下部に固定する。
 * (SPEC.md第11章)
 */
export function ResponsiveProblemLayout({ problemPane, codePane, resultPane, actions }: ResponsiveProblemLayoutProps) {
  const [tab, setTab] = useState<Tab>('problem');

  return (
    <div className="rpl">
      <div className="rpl__tabs" role="tablist">
        {(
          [
            ['problem', '問題'],
            ['code', 'コード'],
            ['result', '結果'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className="rpl__tab"
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="rpl__body">
        <div className="rpl__pane rpl__pane--problem" data-active={tab === 'problem'}>
          {problemPane}
        </div>
        <div className="rpl__pane rpl__pane--code" data-active={tab === 'code'}>
          {codePane}
        </div>
        <div className="rpl__pane rpl__pane--result" data-active={tab === 'result'}>
          {resultPane}
        </div>
      </div>
      <div className="rpl__actions">{actions}</div>
    </div>
  );
}

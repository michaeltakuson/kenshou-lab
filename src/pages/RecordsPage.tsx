import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildWeeklyReport } from '../report/collectReportData';
import { listAllProgress } from '../records/progressStore';
import { STATE_LABELS } from '../records/stateLabels';
import type { ProblemProgress } from '../records/types';
import './RecordsPage.css';

function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

export function RecordsPage() {
  const [range, setRange] = useState(defaultRange);
  const [report, setReport] = useState<string>('');
  const [copyLabel, setCopyLabel] = useState('コピー');
  const [history, setHistory] = useState<ProblemProgress[]>([]);

  const regenerate = async (from: string, to: string) => {
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59.999`);
    const text = await buildWeeklyReport(fromDate, toDate);
    setReport(text);
  };

  useEffect(() => {
    void regenerate(range.from, range.to);
    void listAllProgress().then((list) =>
      setHistory(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyLabel('コピーしました');
      setTimeout(() => setCopyLabel('コピー'), 2000);
    } catch {
      setCopyLabel('コピーできませんでした');
      setTimeout(() => setCopyLabel('コピー'), 2000);
    }
  };

  return (
    <div className="records-page">
      <h1>記録</h1>

      <section className="records-page__section">
        <h2>週次学習レポート</h2>
        <div className="records-page__range">
          <label>
            開始
            <input
              type="date"
              value={range.from}
              onChange={(e) => {
                const next = { ...range, from: e.target.value };
                setRange(next);
                void regenerate(next.from, next.to);
              }}
            />
          </label>
          <label>
            終了
            <input
              type="date"
              value={range.to}
              onChange={(e) => {
                const next = { ...range, to: e.target.value };
                setRange(next);
                void regenerate(next.from, next.to);
              }}
            />
          </label>
          <button type="button" onClick={handleCopy}>
            {copyLabel}
          </button>
        </div>
        <pre className="records-page__report">{report}</pre>
      </section>

      <section className="records-page__section">
        <h2>問題ごとの履歴</h2>
        {history.length === 0 ? (
          <p className="records-page__muted">まだ記録がありません。</p>
        ) : (
          <table className="records-page__table">
            <thead>
              <tr>
                <th>問題セット</th>
                <th>問題ID</th>
                <th>状態</th>
                <th>更新日時</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.key}>
                  <td>{p.setId}</td>
                  <td>{p.problemId}</td>
                  <td>{STATE_LABELS[p.state]}</td>
                  <td>{new Date(p.updatedAt).toLocaleString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p>
        <Link to="/settings">設定(バックアップ・復元)へ →</Link>
      </p>
    </div>
  );
}

import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div style={{ padding: 16 }}>
      <h1>検証ラボ</h1>
      <p>
        このホーム画面は仮のものです。今日の復習件数、マイルストーン別の進捗、問題セット一覧などは
        フェーズ3で実装します(SPEC.md 第2章・第8章)。
      </p>
      <p>
        <Link to="/sets">問題セット一覧へ →</Link>
      </p>
      <p>
        <Link to="/scratchpad">自由実行(スクラッチパッド)へ →</Link>
      </p>
    </div>
  );
}

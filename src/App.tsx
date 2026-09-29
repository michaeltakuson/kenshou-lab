import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ScratchpadPage } from './pages/ScratchpadPage';
import { ProblemSetListPage } from './pages/ProblemSetListPage';
import { ProblemSetPage } from './pages/ProblemSetPage';
import { ProblemPage } from './pages/ProblemPage';
import { RecordsPage } from './pages/RecordsPage';
import { SettingsPage } from './pages/SettingsPage';
import { usePrefs } from './prefs/prefs';
import './App.css';

export default function App() {
  usePrefs();
  return (
    <HashRouter>
      <div className="app-shell">
        <nav className="app-nav">
          <Link to="/">ホーム</Link>
          <Link to="/sets">問題セット</Link>
          <Link to="/scratchpad">自由実行</Link>
          <Link to="/records">記録</Link>
          <Link to="/settings">設定</Link>
        </nav>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/scratchpad" element={<ScratchpadPage />} />
            <Route path="/sets" element={<ProblemSetListPage />} />
            <Route path="/sets/:source/:setId" element={<ProblemSetPage />} />
            <Route path="/sets/:source/:setId/:problemId" element={<ProblemPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

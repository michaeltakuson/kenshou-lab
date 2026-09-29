import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ScratchpadPage } from './pages/ScratchpadPage';
import './App.css';

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <nav className="app-nav">
          <Link to="/">ホーム</Link>
          <Link to="/scratchpad">自由実行</Link>
        </nav>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/scratchpad" element={<ScratchpadPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

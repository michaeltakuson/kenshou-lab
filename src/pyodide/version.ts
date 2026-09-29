// Pyodideのバージョンをここで一箇所に固定する。
// numpy/pandas/matplotlib/scipy/statsmodels/scikit-learn が同梱されていることを
// node_modules/pyodide/pyodide-lock.json で確認済み(0.29.5, Python 3.13.2)。
// stable-0.29系はPyodideプロジェクトが安定版として維持しているラインを採用している。
export const PYODIDE_VERSION = '0.29.5';
export const PYODIDE_CDN_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export const REQUIRED_PACKAGES = [
  'numpy',
  'pandas',
  'matplotlib',
  'scipy',
  'statsmodels',
  'scikit-learn',
] as const;

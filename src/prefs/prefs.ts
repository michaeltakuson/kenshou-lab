import { useEffect, useState } from 'react';
import { getDb } from '../db/db';

export type ThemePref = 'auto' | 'light' | 'dark';

export interface Prefs {
  theme: ThemePref;
  codeWrap: boolean;
  defaultTimeoutSec: number;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'auto',
  codeWrap: true,
  defaultTimeoutSec: 10,
};

const KEYS: Record<keyof Prefs, string> = {
  theme: 'pref:theme',
  codeWrap: 'pref:codeWrap',
  defaultTimeoutSec: 'pref:defaultTimeoutSec',
};

export function applyTheme(theme: ThemePref) {
  const root = document.documentElement;
  if (theme === 'auto') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}

export async function loadPrefs(): Promise<Prefs> {
  const db = await getDb();
  const [theme, codeWrap, defaultTimeoutSec] = await Promise.all([
    db.get('meta', KEYS.theme),
    db.get('meta', KEYS.codeWrap),
    db.get('meta', KEYS.defaultTimeoutSec),
  ]);
  return {
    theme: (theme?.value as ThemePref) ?? DEFAULT_PREFS.theme,
    codeWrap: codeWrap ? codeWrap.value === 'true' : DEFAULT_PREFS.codeWrap,
    defaultTimeoutSec: defaultTimeoutSec ? Number(defaultTimeoutSec.value) : DEFAULT_PREFS.defaultTimeoutSec,
  };
}

export async function savePref<K extends keyof Prefs>(key: K, value: Prefs[K]): Promise<void> {
  const db = await getDb();
  await db.put('meta', { key: KEYS[key], value: String(value) });
  if (key === 'theme') applyTheme(value as ThemePref);
}

/** 設定を読み込み、テーマを即座に適用する。全画面で共有する軽量なフック。 */
export function usePrefs(): [Prefs, <K extends keyof Prefs>(key: K, value: Prefs[K]) => void] {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    void loadPrefs().then((p) => {
      setPrefs(p);
      applyTheme(p.theme);
    });
  }, []);

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    void savePref(key, value);
  };

  return [prefs, update];
}

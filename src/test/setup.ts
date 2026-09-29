import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// vitest.config.tsでglobals:trueにしていないため、@testing-library/reactの
// 自動クリーンアップ(グローバルなafterEachへの自動登録)が効かない。
// 明示的に登録しないと、テストごとにrender()したDOMが蓄積してしまう。
afterEach(() => {
  cleanup();
});

import type { DatasetSource } from '../pyodide/types';
import type { ProblemSet } from './types';

/** ProblemSetのdatasets定義を、Pyodide Workerに渡せる形式に変換する。 */
export function resolveDatasets(set: ProblemSet): DatasetSource[] {
  if (!set.datasets) return [];
  return set.datasets.map((ds) => {
    if (ds.inline !== undefined) {
      return { name: ds.name, content: ds.inline };
    }
    const path = ds.path ?? '';
    const url = `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
    return { name: ds.name, url };
  });
}

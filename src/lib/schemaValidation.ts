import Ajv, { type ErrorObject } from 'ajv';

export interface ValidationIssue {
  /** 問題箇所を示すJSONポインタ形式の位置(例: "/problems/2/tests") */
  path: string;
  /** 日本語の説明文 */
  message: string;
}

function paramString(err: ErrorObject, key: string): string {
  const value = (err.params as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.join(', ') : String(value);
}

function translateError(err: ErrorObject): ValidationIssue {
  const path = err.instancePath || '(ルート)';
  switch (err.keyword) {
    case 'required':
      return { path, message: `必須の項目「${paramString(err, 'missingProperty')}」がありません。` };
    case 'type':
      return { path, message: `値の型が正しくありません(期待する型: ${paramString(err, 'type')})。` };
    case 'enum':
      return { path, message: `値が許可された選択肢のいずれでもありません(選択肢: ${paramString(err, 'allowedValues')})。` };
    case 'additionalProperties':
      return {
        path,
        message: `この場所にあってはいけない項目「${paramString(err, 'additionalProperty')}」があります。`,
      };
    case 'minItems':
      return { path, message: `配列の要素数が足りません(最低${paramString(err, 'limit')}件必要です)。` };
    case 'minLength':
      return { path, message: `文字列が短すぎます(最低${paramString(err, 'limit')}文字必要です)。` };
    case 'pattern':
      return { path, message: '書式が正しくありません(英数字・ハイフン・アンダースコアのみ使用できます)。' };
    case 'oneOf':
      return { path, message: '条件に合致する形式が1つに定まりませんでした(項目の組み合わせを確認してください)。' };
    case 'const':
      return { path, message: `値が固定値と一致しません(期待する値: ${JSON.stringify((err.params as { allowedValue: unknown }).allowedValue)})。` };
    case 'minimum':
      return { path, message: `値が小さすぎます(最低${paramString(err, 'limit')})。` };
    case 'maximum':
      return { path, message: `値が大きすぎます(最大${paramString(err, 'limit')})。` };
    default:
      return { path, message: err.message ? `${err.message}` : '内容を検証できませんでした。' };
  }
}

export function createProblemSetValidator(schema: object) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validateFn = ajv.compile(schema);

  return function validateProblemSet(data: unknown): ValidationIssue[] {
    const ok = validateFn(data);
    if (ok) return [];
    return (validateFn.errors ?? []).map(translateError);
  };
}

# 問題フォーマット仕様

このファイルだけを読めば、検証ラボ用の問題セットJSONを書けるようにすることを目的としています。
形式に不安があれば、まず `public/problems/sample.json` を実例として見てください。

作成したら **必ず `npm run validate` を実行してください。** スキーマ違反や、模範解答が自分の
テストに合格しないことをその場で検出します(GitHub Actionsでもpush時に自動実行されます)。

---

## 1. 置き場所

- **リポジトリ経由(恒久・全端末共通)**: `public/problems/<setId>.json` に置いてpushする。
  問題セット一覧(`public/problems/index.json`)はビルド時・開発サーバー起動時に自動生成されるので、
  **手で編集しないこと**。
- **貼り付け経由(即時・その端末のみ)**: アプリの「設定」画面でJSONを貼り付けるかファイルを選ぶ。
  スキーマは同じものが使われる。

同じ `setId` を貼り付けで追加すると、上書きしてよいか確認される(利用者の記録は消えない)。

---

## 2. 問題セット全体の形

```json
{
  "schemaVersion": 1,
  "setId": "m1-u01",
  "title": "M1-01 データを読み込んで形をつかむ",
  "milestone": "M1",
  "unit": 1,
  "description": "Markdown可。この単元のねらい。",
  "packages": ["pandas", "matplotlib"],
  "datasets": [
    { "name": "sales.csv", "path": "data/m1/sales.csv" },
    { "name": "tiny.csv", "inline": "a,b\n1,2\n3,4\n" }
  ],
  "problems": [ /* 下記「問題」の配列 */ ]
}
```

| 項目 | 必須 | 説明 |
|---|---|---|
| `schemaVersion` | ○ | 常に `1`。 |
| `setId` | ○ | アプリ全体で一意。英数字・ハイフン・アンダースコアのみ。 |
| `title` | ○ | 一覧に出る名前。 |
| `milestone` | ○ | `"M1"`〜`"M4"` のいずれか。 |
| `unit` | ○ | 1以上の整数。 |
| `description` | - | Markdown可。 |
| `packages` | - | この単元で使うパッケージ名の一覧(表示用のヒント。実際にimportできるかは問題ごとの `setup`/`code` に書く)。 |
| `datasets` | - | 下記「3. データセット」参照。 |
| `problems` | ○ | 1件以上。下記「4. 問題(共通項目)」参照。 |

### 3. データセット

各要素は `path`(リポジトリ内のファイル、例: `data/m1/sales.csv` を `public/` からの相対で配置)か、
`inline`(CSV文字列をそのまま埋め込む)のどちらか一方を持つ。どちらもPyodideの仮想ファイルシステム上の
`data/<name>` に配置され、問題の `setup`/`code` から `pd.read_csv("data/sales.csv")` のように読める。

---

## 4. 問題(共通項目)

```json
{
  "id": "m1-u01-p01",
  "type": "write",
  "title": "行数と列数を確かめる",
  "prompt": "Markdown可。問題文。$x^2$ のようなKaTeX数式も使える。",
  "difficulty": 1,
  "estimatedMinutes": 5,
  "tags": ["read_csv", "shape"],
  "timeoutSec": 10,
  "hints": ["1段目のヒント", "2段目のヒント"],
  "answerUnlockAfterFails": 3,
  "setup": "import pandas as pd\ndf = pd.read_csv(\"data/sales.csv\")",
  "predict": { "question": "実行前に、行数はいくつだと思うか書いてください", "required": true }
}
```

| 項目 | 必須 | 説明 |
|---|---|---|
| `id` | ○ | アプリ全体で一意。英数字・ハイフン・アンダースコアのみ。 |
| `type` | ○ | `write` / `read` / `fix` / `explain`。 |
| `title` | ○ | 問題一覧に出るタイトル。 |
| `prompt` | ○ | 問題文(Markdown+KaTeX)。 |
| `difficulty` | ○ | `1`〜`3`。 |
| `estimatedMinutes` | ○ | 目安の分数(整数)。 |
| `tags` | ○ | 検索・分類用のタグ配列(空配列可)。 |
| `timeoutSec` | - | 省略時は既定10秒。実行に時間がかかる問題(大きな学習処理など)で伸ばす。 |
| `hints` | ○ | 段階ヒントの配列(空配列可)。1段ずつ開く。 |
| `answerUnlockAfterFails` | - | 省略時は既定3回。この回数だけ不合格になると解答が開ける。 |
| `setup` | - | 利用者コードの前に隠れて実行されるコード(データ読み込みなど)。`write`/`read`/`fix`/`explain` すべてで使える。 |
| `predict` | - | `write`/`fix` でのみ意味を持つ(下記4.1参照)。 |

---

## 4.1 write / fix (「書く」「直す」)

追加項目:

```json
{
  "starterCode": "df.shape\n",
  "tests": [
    { "name": "行数が正しい", "code": "assert df.shape[0] == 8", "message": "行数が違うようです。" }
  ],
  "modelAnswer": "df.shape",
  "modelExplanation": [
    { "lines": [1, 1], "text": "dfの形(行数,列数)を表示しています。" }
  ]
}
```

- `starterCode`: 初期コード。`write` は空や骨組み、`fix` はバグ入りのコードにする。
- `tests`: 採点コードの配列。**利用者には`name`と、不合格時の`message`しか見せない。`code`の中身(assertの期待値)は絶対に表示されない。**
  各テストの `code` は、利用者コードと同じ名前空間(`setup`→利用者コードの実行後)で実行される。
  次の変数・関数がその名前空間にあらかじめ用意されている:
  - `pd`, `np`, `plt`
  - `assert_frame_equal`, `assert_series_equal` (`pandas.testing`)
  - `isclose` (`math.isclose`)
  - `_stdout`: 利用者コードの`print`出力の文字列
  - `_figures`: 利用者コードの実行後に存在する図(matplotlibのFigure)の枚数
  - テストの `code` で `AssertionError` が起きれば「不合格」、それ以外の例外は「採点中にエラー」として区別される。
- `modelAnswer`: 模範解答。**`npm run validate` がこれを実際に実行し、`tests`に全部合格することを確認する。** ここが通らないとpushしてもデプロイされない。
- `modelExplanation`: 省略可。解答画面で行ごとの補足として使う(`lines`は1始まりの行範囲)。

### predict(予想メモ)

`write`/`fix` で `predict` を指定すると、**最初の実行前に予想欄への入力が必須**になる
(`required: true` のとき)。実行後、予想と実際の結果が並べて表示される。

---

## 4.2 read (「読む」)

```json
{
  "code": "import pandas as pd\ndf = pd.read_csv(\"data/sales.csv\")\nprint(len(df))",
  "answer": { "kind": "output" }
}
```

- `code`: 読み取り専用で表示・実行されるコード。
- `answer`: 3種類のいずれか。
  - `{ "kind": "output" }`: 利用者が予想したテキストと、実行結果の**標準出力(`print`の内容)**を比較する。
    出力が改行やprintを含まない場合は、最終行の値の表示(repr)と比較される。
    比較は改行コードの統一・各行末の空白除去・末尾の空行除去をしたうえで行われるので、
    余分な空白や改行の違いは気にしなくてよい。
  - `{ "kind": "choice", "choices": [...], "correct": 0 }`: 選択式。`correct` は0始まりのインデックス。
  - `{ "kind": "value", "value": 3.14, "tolerance": 0.01 }`: 数値または文字列の直接入力。
    数値の場合は `tolerance` の範囲内で一致とみなす(省略時は完全一致)。

`choice`/`value` の正解は **JSONにauthorが直接書く値であり、コードの実行結果から自動計算されるわけではない**。
`npm run validate` は `code` がエラーなく実行できることまでは確認するが、`correct`/`value` が
実際の実行結果と一致しているかどうかは自分で確認すること。

---

## 4.3 explain (「説明する」)

```json
{
  "code": "import pandas as pd\ndf = pd.read_csv(\"data/sales.csv\")\ntotals = df.groupby(\"category\")[\"sales\"].sum()\ntop = totals.idxmax()\nprint(top)",
  "blocks": [
    { "lines": [1, 2], "modelText": "pandasを読み込み、CSVを読み込んでdfに代入しています。" },
    { "lines": [3, 3], "modelText": "category列ごとにsales列を合計しています。" }
  ],
  "modifyTask": {
    "prompt": "一番売上が少ないcategoryを表示するように変えてください。",
    "tests": [
      { "name": "最小のcategoryになっている", "code": "assert top == df.groupby(\"category\")[\"sales\"].sum().idxmin()", "message": "一番少ないcategoryになっていないようです。" }
    ]
  }
}
```

- `code`: 説明対象の読み取り専用コード(行番号付きで表示される)。
- `blocks`: `lines`(1始まりの行範囲)ごとに、利用者が自分の言葉で説明したあと、`modelText`(模範説明)が開く。
- `modifyTask`: 省略可。全ブロックの自己評価が終わったあとに続けて取り組む「そのコードの1箇所を変える」課題。
  初期コードは `code` と同じで、`tests` は write/fix と同じ形式・同じ名前空間の仕組みで採点される。
  **`modifyTask` には `modelAnswer` を書く欄がない**ので、`npm run validate` は `tests` の実行チェックを行わない
  (`code` 自体がエラーなく実行できることは確認する)。テストの内容を自分でよく確認すること。

クリア条件(アプリ内部の状態管理): 全ブロックが「できた」、かつ`modifyTask`があればそれに合格。

---

## 5. 動作確認

1. `public/problems/sample.json` を実例として参照する(8問、4形式すべて・pandas/matplotlib/statsmodels/scikit-learnを網羅)。
2. 新しい問題セットを保存したら `npm run validate` を実行する。
3. スキーマ違反は「どの項目がどうおかしいか」が日本語で表示される。
4. `write`/`fix` の `modelAnswer` が `tests` に合格しない場合もエラーになる。
5. すべて通ったら、devサーバー(`npm run dev`)で実際に開いて確認する。

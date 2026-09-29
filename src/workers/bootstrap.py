"""検証ラボ: Pyodide Worker内で一度だけ読み込まれる実行エンジン。

setup(隠しコード) -> 利用者コード の順で「新しい名前空間」を毎回作って実行し、
JSON文字列(dict)を返す。JS側はJSON.parseするだけで済むようにしている。

Pyodideインタプリタ自体は実行のたびに作り直さない(重すぎるため)。そのため、
名前空間(ns)以外にモジュールレベルで残ってしまう状態は、実行のたびに
_reset_global_state()で既定値に戻す。ここに気づいたものを列挙する:
  - matplotlibの図(figure)とrcParams
  - pandasの表示オプション(pd.options)
  - numpy/randomのグローバル乱数状態(再シードしないと前回の続きになる)
  - warningsのフィルタ設定
  - sys.setrecursionlimit
なお、利用者コードが `import builtins; builtins.print = ...` のように
標準ライブラリのモジュール自体を書き換えた場合は、次回以降の実行にも影響が
残り得る。これは意図的な妨害に近い操作であり、本仕様の「自力で書く」練習の
範囲を超えるため、対処はせず既知の制約として扱う。
"""

import ast
import base64
import contextlib
import io
import json
import math
import random
import sys
import traceback
import warnings

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("AGG")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import rcParamsDefault  # noqa: E402
from pandas.testing import assert_frame_equal, assert_series_equal  # noqa: E402

# statsmodels/scikit-learnは初回importで追加の初期化コストがかかり、
# 利用者コードの実行タイムアウト(既定10秒)を初回importだけで使い切ってしまう
# ことが実機確認でわかった。起動時(読み込み画面が出ている間)にあらかじめ
# importしておき、利用者の実行時間を初回import分だけ損させないようにする。
# ここでimportしたモジュール自体は名前空間(ns)には入れない
# (第5章の名前空間の取り決めに、setup以外でsm/sklearnは含まれていないため)。
import statsmodels.api as _warm_statsmodels_api  # noqa: E402,F401
import sklearn  # noqa: E402,F401
import sklearn.linear_model as _warm_sklearn_linear_model  # noqa: E402,F401

_ERROR_HINTS = {
    "NameError": "定義されていない名前(変数や関数)を使おうとしています。スペルミスや、定義前に使っていないかを確認してください。",
    "KeyError": "辞書やDataFrameに、存在しないキー(列名など)でアクセスしようとしています。",
    "TypeError": "データの型が合っていない操作をしようとしています(例:文字列と数値を一緒に扱うなど)。",
    "ValueError": "値そのものの型は正しくても、内容が処理にふさわしくありません。",
    "AttributeError": "そのオブジェクトには存在しないメソッドや属性を呼び出そうとしています。",
    "IndexError": "リストや配列の範囲外の位置を指定しています。",
    "SyntaxError": "Pythonの文法として読み取れない書き方になっています。",
    "IndentationError": "インデント(字下げ)がそろっていません。",
    "ZeroDivisionError": "0で割り算をしようとしています。",
    "ModuleNotFoundError": "このパッケージはまだ読み込まれていないか、このアプリでは使えません。",
}
_DEFAULT_HINT = "実行中にエラーが発生しました。詳細を確認してください。"

_MAX_TABLE_ROWS = 20
_MAX_REPR_LEN = 5000
_USER_FILENAME = "<あなたのコード>"
_SETUP_FILENAME = "<setup>"


def _format_error(exc, primary_filename):
    exc_type_name = type(exc).__name__
    if isinstance(exc, SyntaxError):
        lineno = exc.lineno
    else:
        lineno = None
        for frame in traceback.extract_tb(exc.__traceback__):
            if frame.filename == primary_filename:
                lineno = frame.lineno
        if lineno is None:
            tb = traceback.extract_tb(exc.__traceback__)
            if tb:
                lineno = tb[-1].lineno
    return {
        "name": exc_type_name,
        "message": str(exc),
        "lineno": lineno,
        "hint": _ERROR_HINTS.get(exc_type_name, _DEFAULT_HINT),
        "traceback": "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        ),
    }


def _capture_figures():
    images = []
    for num in plt.get_fignums():
        fig = plt.figure(num)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", dpi=110)
        images.append(
            "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
        )
    plt.close("all")
    return images


def _format_table(df):
    total_rows = len(df)
    truncated = total_rows > _MAX_TABLE_ROWS
    view = df.head(_MAX_TABLE_ROWS)
    raw = json.loads(
        view.to_json(orient="split", date_format="iso", default_handler=str)
    )
    return {
        "kind": "table",
        "columns": [str(c) for c in raw.get("columns", [])],
        "index": raw.get("index", []),
        "rows": raw.get("data", []),
        "totalRows": total_rows,
        "truncated": truncated,
    }


def _format_value(value):
    if value is None:
        return None
    if isinstance(value, pd.DataFrame):
        return _format_table(value)
    if isinstance(value, pd.Series):
        name = value.name if value.name is not None else "value"
        return _format_table(value.to_frame(name=str(name)))
    text = repr(value)
    if len(text) > _MAX_REPR_LEN:
        text = text[:_MAX_REPR_LEN] + " …(以下省略)"
    return {"kind": "repr", "text": text}


def _reset_global_state():
    plt.close("all")
    matplotlib.rcParams.update(rcParamsDefault)
    matplotlib.use("AGG")
    pd.reset_option("all")
    warnings.resetwarnings()
    np.random.seed()
    random.seed()
    sys.setrecursionlimit(1000)


def _base_namespace():
    return {
        "pd": pd,
        "np": np,
        "plt": plt,
        "assert_frame_equal": assert_frame_equal,
        "assert_series_equal": assert_series_equal,
        "isclose": math.isclose,
    }


def __kenshou_run(setup_code, user_code):
    _reset_global_state()
    ns = _base_namespace()
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    result = {"ok": True}

    try:
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(
            stderr_buf
        ):
            if setup_code:
                exec(compile(setup_code, _SETUP_FILENAME, "exec"), ns)

            tree = ast.parse(user_code, filename=_USER_FILENAME, mode="exec")
            last_expr = None
            if tree.body and isinstance(tree.body[-1], ast.Expr):
                last_expr = tree.body.pop()
            exec(compile(tree, _USER_FILENAME, "exec"), ns)

            value = None
            if last_expr is not None:
                value = eval(
                    compile(ast.Expression(last_expr.value), _USER_FILENAME, "eval"),
                    ns,
                )
            result["value"] = _format_value(value)
    except Exception as e:  # noqa: BLE001 - 利用者コードのあらゆる例外を捕まえる必要がある
        result["ok"] = False
        result["error"] = _format_error(e, _USER_FILENAME)

    result["stdout"] = stdout_buf.getvalue()
    result["stderr"] = stderr_buf.getvalue()
    result["figures"] = _capture_figures()
    return json.dumps(result, ensure_ascii=False)

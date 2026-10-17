from decimal import Decimal, InvalidOperation
from datetime import datetime, date
from typing import Dict, Any, Optional, List

from app.core.i18n import get_locale
from app.services.prompt.localized import format_date, weekday_of

# ── 运算符映射 ────────────────────────────────────────────────────────
OP_ADD = ["+", "加", "加上", "plus", "added", "add", "足す", "足した", "加算", "足し算", "たす"]
OP_SUB = ["-", "−", "减", "减去", "減", "minus", "subtract", "subtracted", "引く", "引いた", "減算", "引き算", "ひく"]
OP_MUL = ["*", "×", "x", "乘", "乘以", "times", "multiplied by", "multiply", "掛ける", "掛け", "乗算", "掛け算", "かける"]
OP_DIV = ["/", "÷", "除", "除以", "divided by", "divide", "割る", "割った", "除算", "割り算", "わける"]
OP_POW = ["^", "**", "次方", "的次方", "的平方", "平方", "power of", "to the power of", "べき乗", "乗", "冪乗", "累乗"]

OP_TABLE: List[List[str]] = [OP_ADD, OP_SUB, OP_MUL, OP_DIV, OP_POW]

#: 归一化后的符号，用于写进给模型看的算式
OP_SYMBOLS = ["+", "-", "×", "÷", "^"]


def normalize_operator(raw: str) -> Optional[int]:
    """把各种词形的运算符归一成 OP_TABLE 的下标；不认识则返回 None。"""
    token = (raw or "").strip().lower().replace(" ", "")
    if not token:
        return None
    for index, variants in enumerate(OP_TABLE):
        if token in variants:
            return index
    return None


# ── 说明文案 ──────────────────────────────────────────────────────────

EXPLANATIONS: Dict[str, Dict[str, str]] = {
    "zh-CN": {
        "char_header": "目标文本 \"{text}\" 中字符 '{char}' 的出现频次为：",
        "char_case_sensitive": "- 严格区分大小写：{count} 次",
        "char_case_insensitive": "- 不区分大小写：{count} 次 (出现在第 {positions} 位)",
        "char_list": "- 逐字列表：{chars}",
        "cmp_result": "数学实数按位比对结果：{num1} {symbol} {num2}（即 {larger} {relation} {smaller}）。",
        "cmp_align": "- 小数位补零对齐验证：{num1} 写作 {a1}，{num2} 写作 {a2}。",
        "cmp_conclusion": "- 结论：作为纯数学数值比较，{larger} 绝对大于 {smaller}，切勿混淆为软件版本号或长短。",
        "relation_gt": "大于",
        "relation_lt": "小于",
        "relation_eq": "等于",
        "arith": "数学精确运算：{num1} {op} {num2} = {result}",
        "date_header": "公历日期推算（基准日期今天：{today}）：",
        "date_target": "- 目标日期：{year}-{month}-{day}（{weekday}）",
        "date_delta": "- 天数差：距离该日期 {status}（共计 {days} 天）。",
        "status_future": "还有 {days} 天",
        "status_today": "就是今天",
        "status_past": "已经过去了 {days} 天",
    },
    "zh-TW": {
        "char_header": "目標文字 \"{text}\" 中字元 '{char}' 的出現頻次為：",
        "char_case_sensitive": "- 嚴格區分大小寫：{count} 次",
        "char_case_insensitive": "- 不區分大小寫：{count} 次 (出現在第 {positions} 位)",
        "char_list": "- 逐字列表：{chars}",
        "cmp_result": "數學實數按位比對結果：{num1} {symbol} {num2}（即 {larger} {relation} {smaller}）。",
        "cmp_align": "- 小數位補零對齊驗證：{num1} 寫作 {a1}，{num2} 寫作 {a2}。",
        "cmp_conclusion": "- 結論：作為純數學數值比較，{larger} 絕對大於 {smaller}，切勿混淆為軟體版本號或長短。",
        "relation_gt": "大於",
        "relation_lt": "小於",
        "relation_eq": "等於",
        "arith": "數學精確運算：{num1} {op} {num2} = {result}",
        "date_header": "公曆日期推算（基準日期今天：{today}）：",
        "date_target": "- 目標日期：{year}-{month}-{day}（{weekday}）",
        "date_delta": "- 天數差：距離該日期 {status}（共計 {days} 天）。",
        "status_future": "還有 {days} 天",
        "status_today": "就是今天",
        "status_past": "已經過去了 {days} 天",
    },
    "en": {
        "char_header": 'Occurrences of the character "{char}" in "{text}":',
        "char_case_sensitive": "- Case-sensitive: {count}",
        "char_case_insensitive": (
            "- Case-insensitive: {count} (at position(s) {positions})"
        ),
        "char_list": "- Character by character: {chars}",
        "cmp_result": (
            "Exact numeric comparison: {num1} {symbol} {num2} "
            "(that is, {larger} {relation} {smaller})."
        ),
        "cmp_align": (
            "- Aligned on equal decimal places: {num1} writes as {a1}, {num2} writes as {a2}."
        ),
        "cmp_conclusion": (
            "- Conclusion: as plain numbers, {larger} is strictly greater than {smaller}. "
            "Do not confuse this with version numbers or string lengths."
        ),
        "relation_gt": "is greater than",
        "relation_lt": "is less than",
        "relation_eq": "equals",
        "arith": "Exact arithmetic: {num1} {op} {num2} = {result}",
        "date_header": "Date calculation (anchored to today, {today}):",
        "date_target": "- Target date: {year}-{month}-{day} ({weekday})",
        "date_delta": "- Difference: {status} ({days} days in total).",
        "status_future": "in {days} days",
        "status_today": "is today",
        "status_past": "was {days} days ago",
    },
    "ja": {
        "char_header": "文字列「{text}」における文字「{char}」の出現回数：",
        "char_case_sensitive": "- 大文字と小文字を区別: {count} 回",
        "char_case_insensitive": "- 大文字と小文字を区別しない: {count} 回（{positions} 番目）",
        "char_list": "- 1 文字ずつ: {chars}",
        "cmp_result": (
            "数値の厳密比較の結果: {num1} {symbol} {num2}"
            "（すなわち {larger} は {smaller} より {relation}）。"
        ),
        "cmp_align": (
            "- 小数位をそろえた検証: {num1} は {a1}、{num2} は {a2} と表記されます。"
        ),
        "cmp_conclusion": (
            "- 結論: 純粹な数値として比較すると、{larger} は {smaller} より"
            "必ず大きく、バージョン番号や文字列の長さと比較を混同してはいけません。"
        ),
        "relation_gt": "大きい",
        "relation_lt": "小さい",
        "relation_eq": "等しい",
        "arith": "正確な演算: {num1} {op} {num2} = {result}",
        "date_header": "日付の算出（基準日は本日: {today}）:",
        "date_target": "- 対象日: {year}年{month}月{day}日（{weekday}）",
        "date_delta": "- 日数差: 該日まで {status}（合計 {days} 日）。",
        "status_future": "あと {days} 日",
        "status_today": "が本日",
        "status_past": "{days} 日前だった",
    },
}


def _t(key: str, **params: Any) -> str:
    table = EXPLANATIONS.get(get_locale()) or EXPLANATIONS["zh-CN"]
    return table[key].format(**params)


def compute_char_count(target_text: str, search_char: str) -> Optional[Dict[str, Any]]:
    """
    精确统计字符在目标文本中的出现频次与具体索引位置。
    """
    if not target_text or not search_char:
        return None

    # 大小写不敏感统计与区分大小写统计
    count_case_sensitive = target_text.count(search_char)
    count_case_insensitive = target_text.lower().count(search_char.lower())

    positions_1_based = [
        i + 1 for i, char in enumerate(target_text)
        if char.lower() == search_char.lower()
    ]

    positions_str = ", ".join(map(str, positions_1_based))
    explanation = "\n".join(
        [
            _t("char_header", text=target_text, char=search_char),
            _t("char_case_sensitive", count=count_case_sensitive),
            _t(
                "char_case_insensitive",
                count=count_case_insensitive,
                positions=positions_str,
            ),
            _t("char_list", chars="-".join(list(target_text))),
        ]
    )

    return {
        "text": target_text,
        "char": search_char,
        "count_case_sensitive": count_case_sensitive,
        "count_case_insensitive": count_case_insensitive,
        "positions": positions_1_based,
        "explanation": explanation,
    }


def compute_number_comparison(num1_str: str, num2_str: str) -> Optional[Dict[str, Any]]:
    """
    使用高精度 Decimal 严格进行数学实数大小比对，杜绝版本号或表面字符串长短的混淆。
    """
    try:
        d1 = Decimal(num1_str.strip())
        d2 = Decimal(num2_str.strip())
    except (InvalidOperation, ValueError):
        return None

    if d1 > d2:
        relation = _t("relation_gt")
        symbol = ">"
        larger = num1_str
        smaller = num2_str
    elif d1 < d2:
        relation = _t("relation_lt")
        symbol = "<"
        larger = num2_str
        smaller = num1_str
    else:
        relation = _t("relation_eq")
        symbol = "=="
        larger = smaller = num1_str

    # 构造按位对齐说明（例如 9.9 扩展为 9.90）
    exp1 = abs(d1.as_tuple().exponent) if d1.as_tuple().exponent < 0 else 0
    exp2 = abs(d2.as_tuple().exponent) if d2.as_tuple().exponent < 0 else 0
    max_decimals = max(exp1, exp2)

    format_pattern = f"{{:.{max_decimals}f}}"
    aligned1 = format_pattern.format(float(d1))
    aligned2 = format_pattern.format(float(d2))

    explanation = "\n".join(
        [
            _t(
                "cmp_result",
                num1=num1_str,
                symbol=symbol,
                num2=num2_str,
                larger=larger,
                relation=relation,
                smaller=smaller,
            ),
            _t("cmp_align", num1=num1_str, a1=aligned1, num2=num2_str, a2=aligned2),
            _t("cmp_conclusion", larger=larger, smaller=smaller),
        ]
    )

    return {
        "num1": num1_str,
        "num2": num2_str,
        "relation": relation,
        "symbol": symbol,
        "larger": larger,
        "smaller": smaller,
        "explanation": explanation,
    }


def compute_arithmetic(
    num1_str: str, op_symbol: str, num2_str: str
) -> Optional[Dict[str, Any]]:
    """
    精确四则运算计算，杜绝大数字或浮点数心算错误。
    """
    try:
        d1 = Decimal(num1_str.strip())
        d2 = Decimal(num2_str.strip())
    except (InvalidOperation, ValueError):
        return None

    index = normalize_operator(op_symbol)
    if index is None:
        return None
    clean_op = OP_SYMBOLS[index]

    try:
        if index == 0:
            result = d1 + d2
        elif index == 1:
            result = d1 - d2
        elif index == 2:
            result = d1 * d2
        elif index == 3:
            if d2 == 0:
                return None
            result = d1 / d2
        else:
            result = d1 ** int(d2)
    except Exception:
        return None

    return {
        "num1": num1_str,
        "op": clean_op,
        "num2": num2_str,
        "result": str(result),
        "explanation": _t(
            "arith", num1=num1_str, op=clean_op, num2=num2_str, result=result
        ),
    }


def compute_date_difference(year: int, month: int, day: int) -> Optional[Dict[str, Any]]:
    """
    以今天真实物理时间为锚点，精确计算距离特定日期的剩余天数或已过去天数。
    """
    try:
        target_d = date(year, month, day)
        today = datetime.now().astimezone().date()
        delta_days = (target_d - today).days

        if delta_days > 0:
            status_desc = _t("status_future", days=delta_days)
        elif delta_days == 0:
            status_desc = _t("status_today")
        else:
            status_desc = _t("status_past", days=abs(delta_days))

        target_weekday = weekday_of(target_d)

        explanation = "\n".join(
            [
                _t("date_header", today=format_date(today)),
                _t(
                    "date_target",
                    year=year,
                    month=month,
                    day=day,
                    weekday=target_weekday,
                ),
                _t("date_delta", status=status_desc, days=delta_days),
            ]
        )

        return {
            "target_date": target_d.isoformat(),
            "target_weekday": target_weekday,
            "delta_days": delta_days,
            "explanation": explanation,
        }
    except ValueError:
        return None
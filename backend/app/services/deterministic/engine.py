from decimal import Decimal, InvalidOperation
from datetime import datetime, date
from typing import Dict, Any, Optional


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

    return {
        "text": target_text,
        "char": search_char,
        "count_case_sensitive": count_case_sensitive,
        "count_case_insensitive": count_case_insensitive,
        "positions": positions_1_based,
        "explanation": (
            f"目标文本 \"{target_text}\" 中字符 '{search_char}' 的出现频次为：\n"
            f"- 严格区分大小写：{count_case_sensitive} 次\n"
            f"- 不区分大小写：{count_case_insensitive} 次 (出现在第 {', '.join(map(str, positions_1_based))} 位)\n"
            f"- 逐字列表：{'-'.join(list(target_text))}"
        )
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
        relation = "大于"
        symbol = ">"
        larger = num1_str
        smaller = num2_str
    elif d1 < d2:
        relation = "小于"
        symbol = "<"
        larger = num2_str
        smaller = num1_str
    else:
        relation = "等于"
        symbol = "=="
        larger = smaller = num1_str

    # 构造按位对齐说明（例如 9.9 扩展为 9.90）
    exp1 = abs(d1.as_tuple().exponent) if d1.as_tuple().exponent < 0 else 0
    exp2 = abs(d2.as_tuple().exponent) if d2.as_tuple().exponent < 0 else 0
    max_decimals = max(exp1, exp2)

    format_pattern = f"{{:.{max_decimals}f}}"
    aligned1 = format_pattern.format(float(d1))
    aligned2 = format_pattern.format(float(d2))

    return {
        "num1": num1_str,
        "num2": num2_str,
        "relation": relation,
        "symbol": symbol,
        "larger": larger,
        "smaller": smaller,
        "explanation": (
            f"数学实数按位比对结果：{num1_str} {symbol} {num2_str}（即 {larger} {relation} {smaller}）。\n"
            f"- 小数位补零对齐验证：{num1_str} 写作 {aligned1}，{num2_str} 写作 {aligned2}。\n"
            f"- 结论：作为纯数学数值比较，{larger} 绝对大于 {smaller}，切勿混淆为软件版本号或长短。"
        )
    }


def compute_arithmetic(num1_str: str, op_symbol: str, num2_str: str) -> Optional[Dict[str, Any]]:
    """
    精确四则运算计算，杜绝大数字或浮点数心算错误。
    """
    try:
        d1 = Decimal(num1_str.strip())
        d2 = Decimal(num2_str.strip())
    except (InvalidOperation, ValueError):
        return None

    op = op_symbol.strip()
    result = None

    if op in ["+", "加"]:
        result = d1 + d2
        clean_op = "+"
    elif op in ["-", "减"]:
        result = d1 - d2
        clean_op = "-"
    elif op in ["*", "×", "乘"]:
        result = d1 * d2
        clean_op = "×"
    elif op in ["/", "÷", "除"]:
        if d2 == 0:
            return None
        result = d1 / d2
        clean_op = "÷"
    elif op in ["^", "**", "的次方", "次方"]:
        try:
            result = d1 ** int(d2)
            clean_op = "^"
        except Exception:
            return None
    else:
        return None

    return {
        "num1": num1_str,
        "op": clean_op,
        "num2": num2_str,
        "result": str(result),
        "explanation": f"数学精确运算：{num1_str} {clean_op} {num2_str} = {result}"
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
            status_desc = f"还有 {delta_days} 天"
        elif delta_days == 0:
            status_desc = "就是今天"
        else:
            status_desc = f"已经过去了 {abs(delta_days)} 天"

        weekday_names = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
        target_weekday = weekday_names[target_d.weekday()]

        return {
            "target_date": target_d.isoformat(),
            "target_weekday": target_weekday,
            "delta_days": delta_days,
            "explanation": (
                f"公历日期推算（基准日期今天：{today.strftime('%Y年%m月%d日')}）：\n"
                f"- 目标日期：{year}年{month}月{day}日（{target_weekday}）\n"
                f"- 天数差：距离该日期 {status_desc}（共计 {delta_days} 天）。"
            )
        }
    except ValueError:
        return None

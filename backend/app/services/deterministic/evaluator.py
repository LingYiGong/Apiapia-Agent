import re
from datetime import datetime
from typing import Optional, Dict, Any, List
from app.services.deterministic.engine import (
    compute_char_count,
    compute_number_comparison,
    compute_arithmetic,
    compute_date_difference
)


def evaluate_deterministic_context(user_message: str) -> Optional[str]:
    """
    智能评估用户提问，若命中确定性计算场景（字符频次统计、数字比大小、精确算术、日期天数差），
    纯本地（0ms、0费用）生成 100% 严谨的客观事实依据，供系统提示词注入。
    """
    if not user_message or not user_message.strip():
        return None

    msg = user_message.strip()
    findings: List[str] = []

    # ==========================================
    # 场景 1：字符 / 字母出现频次统计
    # 例如："strawberry 里有几个 r"、"统计 hello 里面 l 出现的次数"、"单词 'banana' 中有几个 a"
    # ==========================================
    # 模式 A: [单词] 里有几个 [字母]
    char_match_a = re.search(
        r'(?:单词|字符串|文本)?\s*["\'“‘]?([a-zA-Z0-9_\u4e00-\u9fa5]+)["\'”’]?\s*(?:中|里|里面)?\s*(?:有|包含|出现了)?\s*(?:几个|多少个|几处)\s*["\'“‘]?([a-zA-Z0-9_\u4e00-\u9fa5])["\'”’]?',
        msg,
        re.IGNORECASE
    )
    # 模式 B: [字母] 在 [单词] 出现了几次
    char_match_b = re.search(
        r'["\'“‘]?([a-zA-Z0-9_\u4e00-\u9fa5])["\'”’]?\s*在\s*["\'“‘]?([a-zA-Z0-9_\u4e00-\u9fa5]+)["\'”’]?\s*(?:中|里)?(?:有|出现)?(?:几个|多少次|几次)',
        msg,
        re.IGNORECASE
    )

    if char_match_a:
        word, char = char_match_a.group(1), char_match_a.group(2)
        res = compute_char_count(word, char)
        if res:
            findings.append(f"【精准字符统计事实】\n{res['explanation']}")
    elif char_match_b:
        char, word = char_match_b.group(1), char_match_b.group(2)
        res = compute_char_count(word, char)
        if res:
            findings.append(f"【精准字符统计事实】\n{res['explanation']}")

    # ==========================================
    # 场景 2：数值 / 小数大小比对
    # 例如："9.11 和 9.9 谁大"、"0.8 与 0.79 哪个更大"、"比较 -3.5 和 -2.1 的大小"
    # ==========================================
    num_comp_match = re.search(
        r'(-?\d+(?:\.\d+)?)\s*(?:和|与|跟|,|\s)\s*(-?\d+(?:\.\d+)?)\s*(?:谁|哪个|哪一个)?(?:大|小|更大|更小|的高|的低|比较|谁比较)',
        msg
    )
    if not num_comp_match:
        num_comp_match = re.search(
            r'(?:比较|比一比)\s*(-?\d+(?:\.\d+)?)\s*(?:和|与|跟)\s*(-?\d+(?:\.\d+)?)',
            msg
        )

    if num_comp_match:
        n1, n2 = num_comp_match.group(1), num_comp_match.group(2)
        comp_res = compute_number_comparison(n1, n2)
        if comp_res:
            findings.append(f"【高精度数值大小比对事实】\n{comp_res['explanation']}")

    # ==========================================
    # 场景 3：精确基础算术（大数字四则运算或乘方）
    # 例如："18934 * 274 等于多少"、"2^10 是多少"、"1024 除以 16"
    # ==========================================
    arith_match = re.search(
        r'(\d+(?:\.\d+)?)\s*([\+\-\*\/×÷\^]|加|减|乘|除以|除|次方)\s*(\d+(?:\.\d+)?)\s*(?:等于|是多少|\=|\?)?',
        msg
    )
    if arith_match:
        a_n1, a_op, a_n2 = arith_match.group(1), arith_match.group(2), arith_match.group(3)
        arith_res = compute_arithmetic(a_n1, a_op, a_n2)
        if arith_res:
            findings.append(f"【高精度数学计算事实】\n{arith_res['explanation']}")

    # ==========================================
    # 场景 4：距离特定日期的天数跨度推算
    # 例如："距离2026年12月31日还有几天"、"距离今年年底还有多少天"
    # ==========================================
    current_year = datetime.now().astimezone().year
    date_match = re.search(
        r'距离\s*(\d{4})?年?\s*(\d{1,2})月(\d{1,2})[日号]?\s*(?:还有|相差|隔了)?\s*(?:几天|多少天)',
        msg
    )
    year_end_match = re.search(
        r'距离\s*(?:今年)?(?:年底|年末|元旦)\s*(?:还有|相差)?\s*(?:几天|多少天)',
        msg
    )

    if date_match:
        y_str, m_str, d_str = date_match.group(1), date_match.group(2), date_match.group(3)
        y = int(y_str) if y_str else current_year
        m = int(m_str)
        d = int(d_str)
        diff_res = compute_date_difference(y, m, d)
        if diff_res:
            findings.append(f"【本地日期与天数跨度推算事实】\n{diff_res['explanation']}")
    elif year_end_match:
        diff_res = compute_date_difference(current_year, 12, 31)
        if diff_res:
            findings.append(f"【本地日期与天数跨度推算事实】\n{diff_res['explanation']}")

    if not findings:
        return None

    return (
        "【系统本地确定性核验事实 (Deterministic Ground Truth)】\n"
        "以下是由系统后端本地沙箱精确计算得出的100%可靠物理/数学/统计事实依据。\n"
        "你在回答用户时，必须严格采纳并以此客观事实为绝对真理，严禁产生违背以下事实的逻辑幻觉：\n\n"
        + "\n\n".join(findings)
    )

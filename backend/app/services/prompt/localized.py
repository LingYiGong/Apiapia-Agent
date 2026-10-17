"""系统提示词本地化配置与多语言模版。"""

from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Union

from app.core.i18n import DEFAULT_LOCALE, get_locale, language_directive

# ── 星期名 ────────────────────────────────────────────────────────────

#: 下标与 ``datetime.weekday()`` 对齐：0 = 周一。
WEEKDAYS: Dict[str, List[str]] = {
    "zh-CN": ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    "zh-TW": ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    "en": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ],
    "ja": ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"],
}

DATE_FORMAT: Dict[str, str] = {
    "zh-CN": "%Y年%m月%d日",
    "zh-TW": "%Y年%m月%d日",
    "en": "%Y-%m-%d",
    "ja": "%Y年%m月%d日",
}

DATETIME_FORMAT: Dict[str, str] = {
    "zh-CN": "%Y年%m月%d日 %H:%M:%S",
    "zh-TW": "%Y年%m月%d日 %H:%M:%S",
    "en": "%Y-%m-%d %H:%M:%S",
    "ja": "%Y年%m月%d日 %H:%M:%S",
}

# ── 框架文案 ──────────────────────────────────────────────────────────

TEXT: Dict[str, Dict[str, str]] = {
    "zh-CN": {
        "default_persona": "你是一个智能、真诚、有洞察力的个人智能助理。",
        "role_header": "【角色与核心设定】",
        "temporal_header": "【当前现实世界真实时间基准】",
        "temporal_datetime": "- 当前公历时间：{datetime}",
        "temporal_weekday": "- 今天是：{weekday}",
        "temporal_tz": "- 当前时区：{tz}",
        "temporal_rule": (
            "- 推算指导原则：当用户询问涉及相对时间（如“今天”、“明天”、“后天”、“昨天”、"
            "“星期几”、“今年”、“几月”等），请无条件以此时间基准为绝对真理进行逻辑推算和解答，"
            "严禁回答“无法获取实时时间”。"
        ),
        "search_instruction": (
            "【联网检索机制与回复准则】\n"
            "1. 本系统采用前置自动化检索架构：若用户的问题需要联网，后台检索系统在本次对话开始前已完成搜索并将资料注入在下方。\n"
            "2. 你在当前生成阶段不支持、也绝对无需尝试调用任何外部工具、搜索引擎或函数。\n"
            "3. 若上下文下方提供了【🌐 实时网络检索最新参考资料】，请充分参考这些一手资料并在关键事实处标注引用（如 [1]、[2]）；\n"
            "4. 若上下文下方未提供网络检索资料，表明本次无需联网或未命中。你必须立刻依据你已掌握的全部知识，"
            "直接使用自然语言详尽回答用户，严禁尝试发起工具调用、严禁输出任何工具调用标记"
            "（如 `[SEARCH:]`、`<tool_call>` 等），更绝不可因未提供检索资料而中断或拒绝生成正文。"
        ),
        "format_instruction": (
            "【排版与排版规范】\n"
            "1. 严禁在 Markdown 表格中输出 `<br>`、`<br/>` 等 HTML 标签。\n"
            "2. 输出表格时，单元格文字保持精炼高可读，切忌冗长句子。若单元格内需列举多项内容，"
            "请直接在同一行使用顿号、分号或序号（如 ① ②）简练列出，使表格横向排版整洁紧凑。"
        ),
    },
    "zh-TW": {
        "default_persona": "你是一個智能、真誠、有洞察力的個人智慧助理。",
        "role_header": "【角色與核心設定】",
        "temporal_header": "【當前現實世界真實時間基準】",
        "temporal_datetime": "- 當前公曆時間：{datetime}",
        "temporal_weekday": "- 今天是：{weekday}",
        "temporal_tz": "- 當前時區：{tz}",
        "temporal_rule": (
            "- 推算指導原則：當使用者詢問涉及相對時間（如「今天」、「明天」、「後天」、「昨天」、"
            "「星期幾」、「今年」、「幾月」等），請無條件以此時間基準為絕對真理進行邏輯推算和解答，"
            "嚴禁回答「無法取得即時時間」。"
        ),
        "search_instruction": (
            "【網路檢索機制與回覆準則】\n"
            "1. 本系統採用前置自動化檢索架構：若使用者的問題需要上網，後台檢索系統在本次對話開始前已完成搜尋並將資料注入在下方。\n"
            "2. 你在目前生成階段不支援、也絕對無需嘗試呼叫任何外部工具、搜尋引擎或函式。\n"
            "3. 若上下文下方提供了【🌐 即時網路檢索最新參考資料】，請充分參考這些一手資料並在關鍵事實處標註引用（如 [1]、[2]）；\n"
            "4. 若上下文下方未提供網路檢索資料，表示本次無需上網或未命中。你必須立刻依據你已掌握的全部知識，"
            "直接使用自然語言詳盡回答使用者，嚴禁嘗試發起工具呼叫、嚴禁輸出任何工具呼叫標記"
            "（如 `[SEARCH:]`、`<tool_call>` 等），更絕不可因未提供檢索資料而中斷或拒絕生成正文。"
        ),
        "format_instruction": (
            "【排版與排版規範】\n"
            "1. 嚴禁在 Markdown 表格中輸出 `<br>`、`<br/>` 等 HTML 標籤。\n"
            "2. 輸出表格時，儲存格文字保持精簡高可讀，切忌冗長句子。若儲存格內需列舉多項內容，"
            "請直接在同一行使用頓號、分號或序號（如 ① ②）簡潔列出，使表格橫向排版整潔緊湊。"
        ),
    },
    "en": {
        "default_persona": (
            "You are an intelligent, sincere and perceptive personal AI assistant."
        ),
        "role_header": "[Role & Core Identity]",
        "temporal_header": "[Current Real-World Time Baseline]",
        "temporal_datetime": "- Current date and time: {datetime}",
        "temporal_weekday": "- Today is: {weekday}",
        "temporal_tz": "- Current time zone: {tz}",
        "temporal_rule": (
            "- How to use it: whenever the question involves relative time "
            '(such as "today", "tomorrow", "the day after tomorrow", "yesterday", '
            '"what day of the week", "this year", "which month"), treat this baseline '
            'as absolute ground truth. Never answer that you cannot read the real time.'
        ),
        "search_instruction": (
            "[Web Retrieval Protocol]\n"
            "1. This system uses a pre-retrieval architecture: if the question needs the "
            "internet, a backend search has already run and its material is injected below.\n"
            "2. You do not support tool, search-engine or function calls at this stage, and "
            "must never attempt one.\n"
            "3. If a [Live Web Sources] block appears below, use those primary sources and "
            "cite them at the key claims (e.g. [1], [2]).\n"
            "4. If no such block appears, the question did not need retrieval or the search "
            "missed. Answer immediately and thoroughly from what you already know. Never emit "
            "a tool-call marker (such as `[SEARCH:]` or `<tool_call>`), and never refuse or "
            "truncate your answer for lack of retrieved material."
        ),
        "format_instruction": (
            "[Formatting Rules]\n"
            "1. Never emit raw HTML tags such as `<br>` or `<br/>` inside Markdown tables.\n"
            "2. Keep table cells short and scannable; avoid full sentences. To list several "
            "items in one cell, put them on the same line separated by commas, semicolons or "
            "ordinals (e.g. ① ②) so the table stays compact."
        ),
    },
    "ja": {
        "default_persona": (
            "あなたは知的で誠実、そして洞察力に富むパーソナル AI アシスタントです。"
        ),
        "role_header": "【役割と中核設定】",
        "temporal_header": "【現在の現実世界での時刻基準】",
        "temporal_datetime": "- 現在の日時：{datetime}",
        "temporal_weekday": "- 今日は：{weekday}",
        "temporal_tz": "- 現在のタイムゾーン：{tz}",
"temporal_rule": (
            "- 算出の原則：相対時間（「今日」「明日」「明後日」「昨日」「何曜日」"
            "「今年」「何月」など）についての質問には、無条件にこの時刻基準を"
            "絶対の根拠として論理的に推論して回答してください。"
            "「現在時刻を取得できません」という回答は禁止です。"
        ),
        "search_instruction": (
            "【ウェブ検索の仕組みと回答方針】\n"
            "1. 本システムは事前検索方式です。質問がウェブ情報を必要とする場合、"
            "バックエンドが検索を完了し、その資料を以下に注入しています。\n"
            "2. 現在の生成フェーズではツール、検索エンジン、関数の呼び出しは"
            "サポートしておらず、試行することもあってはなりません。\n"
            "3. 以下の本文に【🌐 リアルタイムウェブ検索の参考資料】が"
            "提供されている場合は、その一次情報を重視し、重要な事実には"
            "引用（[1]、[2] など）を付けてください。\n"
            "4. 検索資料が提示されていない場合は、検索が不要だったか"
            "一致しなかったことを意味します。すでに知っている知識だけで、"
            "直ちに自然言語で詳しく回答してください。ツール呼び出しの"
            "マーカー（`[SEARCH:]`、`<tool_call>` など）を出力したり、"
            "検索資料がないことを理由に回答を中断・拒否したりしてはいけません。"
        ),
        "format_instruction": (
            "【表記とレイアウトの規則】\n"
            "1. Markdown の表の中に `<br>` や `<br/>` などの HTML タグを出力してはいけません。\n"
            "2. 表のセルは簡潔で読みやすい文章に留め、長文は避けてください。"
            "複数の項目を 1 つのセルに列挙する場合は、同一行で読点（、）、セミコロン、"
            "序数（① ② など）で簡潔に区切ると、表全体のレイアウトが整います。"
        ),
    },
}


# ── 长期记忆抽取 / 画像分析的措辞 ─────────────────────────────────────
#
# 这两个提示词原先把「主语为『用户』，10-60 字」写死在正文里。两个问题：
#
# 1. **主语词是中文的。** 让模型写 "The user prefers X" 而不是 "用户偏好 X"，
#    记忆库里就混进了两种语言的句子，而这些文本会被原样注入到
#    之后的每一次对话上下文里 —— 语言污染是累积的。
# 2. **「字」是汉字单位。** 英语语境下 10-60 *characters* 只能写出
#    "Likes tea" 这种残缺事实，比多写几个字糟糕得多。

MEMORY_TEXT: Dict[str, Dict[str, str]] = {
    "zh-CN": {"subject": "用户", "fact_length": "10-60 字", "summary_length": "10-80 字"},
    "zh-TW": {"subject": "使用者", "fact_length": "10-60 字", "summary_length": "10-80 字"},
    "en": {"subject": "the user", "fact_length": "10-60 words", "summary_length": "10-80 words"},
    "ja": {"subject": "ユーザー", "fact_length": "10-60 字", "summary_length": "10-80 字"},
}


def text(key: str) -> str:
    """取当前语言的一条框架文案；未知语言回落到默认语言。"""
    locale = get_locale()
    table = TEXT.get(locale) or TEXT[DEFAULT_LOCALE]
    return table[key]


def memory_text(key: str) -> str:
    table = MEMORY_TEXT.get(get_locale()) or MEMORY_TEXT[DEFAULT_LOCALE]
    return table[key]


def weekday_of(dt: Union[datetime, date]) -> str:
    names = WEEKDAYS.get(get_locale()) or WEEKDAYS[DEFAULT_LOCALE]
    return names[dt.weekday()]


def format_date(dt: Union[datetime, date]) -> str:
    return dt.strftime(DATE_FORMAT.get(get_locale()) or DATE_FORMAT[DEFAULT_LOCALE])


def format_datetime(dt: datetime) -> str:
    return dt.strftime(DATETIME_FORMAT.get(get_locale()) or DATETIME_FORMAT[DEFAULT_LOCALE])


def response_language_directive() -> str:
    """当前用户所选语言的回复指令。"""
    return language_directive(get_locale())
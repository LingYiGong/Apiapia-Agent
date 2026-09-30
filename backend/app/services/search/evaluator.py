import re
from typing import Tuple, Optional

# High-precision intent triggers
EXPLICIT_SEARCH_PREFIXES = [
    r"^(?:请|请你|帮我|麻烦|能否|可以)?(?:在网上|上网|全网|用谷歌|用百度|通过搜索引擎)?(?:搜一下|搜索一下|查一下|搜搜|查查|搜索|查找|检索|查询|打听一下)\s*[:：]?\s*",
    r"^(?:search|google|look up|find out)\s*(?:for\s*)?",
]

# Time-sensitive patterns mapped to Tavily official search params
# (pattern, topic, time_range): topic in {general, news, finance}, time_range in {day, week, month, year} or None
TIME_SENSITIVE_PATTERNS = [
    (r"(?:今天|今日|现在|目前|近期|最近|本周|本月|今年|2025|2026|2027|实时).*(?:天气|气温|温度|下雨|阴晴)", "general", "day"),
    (r"(?:今天|今日|现在|目前|实时|最新).*(?:股价|股票|行情|汇率|金价|油价|指数|涨跌|市值|比特币|btc|eth|大盘)", "finance", "day"),
    (r"(?:最新|最近|近期|今天|昨晚|刚刚).*(?:新闻|大事件|发布会|动态|通告|消息|爆料)", "news", "week"),
    (r"(?:比赛结果|比分|谁赢了|战况|总决赛|淘汰赛|奥运会|世界杯|欧冠|英超|nba)", "news", "week"),
    (r"(?:最新版本|什么时候发布|什么时候出|更新了什么|发布时间|发售日期|上线时间)", "general", "month"),
    (r"(?:现任|现在的|谁是现在的|目前谁是)", "general", None),
    (r"(?:官网|官方网址|下载链接|官方文档)", "general", None),
    (r"(?:地铁|电车|電車|公交|巴士|新干线|城铁|轻轨|票价|车费|运费|運賃|料金|打车).*(?:多少钱|多少|价格|费用|票价|路线|换乘|怎么走)", "general", None),
]

# Queries that should NEVER trigger web search automatically
NON_SEARCH_PATTERNS = [
    r"^(?:你好|早上好|晚上好|嗨|hello|hi|在吗|谢谢|多谢|不客气|再见|拜拜)[!！。？?~]*$",
    r"^(?:今天|明天|后天|昨天|大后天|前天)?(?:是)?(?:星期|礼拜|周)[一二三四五六日天几\?？\s]+$",
    r"^(?:现在|今天|明天|后天|昨天)?(?:是)?(?:几点|几点了|几号|几月几号|几月几日|哪一年|什么时间|什么日子)[\?？\s]*$",
    r"(?:写一首|作一首|写一篇|写一段|写个故事|编一个|翻译|润色|改写|总结上述|概括以上)",
    r"(?:编写代码|实现一个|写代码|写一个函数|写个脚本|debug|分析这段代码)",
    r"(?:解方程|计算一下|\d+\s*[\+\-\*\/]\s*\d+)",
]


def should_search_web(user_message: str, mode: str = "auto") -> Tuple[bool, str, str, Optional[str]]:
    """
    Decide whether to execute web search.
    mode options:
      - 'off': never search
      - 'on': always search
      - 'auto': automatically detect intent
    Returns: (should_search: bool, clean_search_query: str, topic: str, time_range: Optional[str])
    topic follows Tavily official enum {general, news, finance}.
    time_range follows Tavily official enum {day, week, month, year} or None.
    """
    if not user_message or not user_message.strip():
        return False, "", "general", None

    msg = user_message.strip()

    if mode == "off":
        return False, "", "general", None

    # Always clean query
    clean_query = msg
    for prefix in EXPLICIT_SEARCH_PREFIXES:
        if re.search(prefix, clean_query, re.IGNORECASE):
            clean_query = re.sub(prefix, "", clean_query, flags=re.IGNORECASE).strip()
            # If explicit prefix matched, search immediately!
            if clean_query:
                return True, clean_query, "general", None

    if mode == "on":
        return True, clean_query or msg, "general", None

    # Auto mode: check non-search exclusions first
    for non_pattern in NON_SEARCH_PATTERNS:
        if re.search(non_pattern, msg, re.IGNORECASE):
            return False, "", "general", None

    # Auto mode: check time-sensitive / real-time / current facts patterns
    for time_pattern, topic, time_range in TIME_SENSITIVE_PATTERNS:
        if re.search(time_pattern, msg, re.IGNORECASE):
            return True, clean_query or msg, topic, time_range

    # Check for direct document/media file links (handled directly by document parser)
    if re.search(r"https?:\/\/[^\s]+\.(?:pdf|docx?|xlsx?|csv|json|zip|tar|gz|txt|md|png|jpe?g|webp)\b", msg, re.IGNORECASE):
        return False, "", "general", None

    # Check for direct URL reference or domain names
    if re.search(r"(?:https?:\/\/|[a-zA-Z0-9-]+\.(?:com|org|cn|net|io|ai|dev))\b", msg):
        return True, clean_query or msg, "general", None

    return False, "", "general", None

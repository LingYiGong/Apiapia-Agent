import json
import logging
import re
from typing import Tuple, Optional, List, Dict, Any

from app.services.llm.factory import get_llm_provider, detect_provider
from app.services.prompt.temporal import get_current_temporal_context

logger = logging.getLogger("web_search_evaluator")

# High-precision intent triggers
EXPLICIT_SEARCH_PREFIXES = [
    r"^(?:请|请你|帮我|麻烦|能否|可以)?(?:在网上|上网|全网|用谷歌|用百度|通过搜索引擎)?(?:搜一下|搜索一下|查一下|搜搜|查查|搜索|查找|检索|查询|打听一下)\s*[:：]?\s*",
    r"^(?:search|google|look up|find out)\s*(?:for\s*)?",
]

# Patterns that indicate financial market data inquiry (requires web search even if containing math/numbers)
FINANCIAL_MARKET_PATTERNS = [
    r"(?:QQQ|SPY|DIA|IWM|VOO|纳斯达克|标普|道琼斯|美股|A股|港股|ETF|比特币|BTC|ETH|加密货币)",
    r"(?:股价|股票|行情|汇率|USD\s*/\s*CNY|USDCNY|美元兑人民币|外汇|金价|油价|大盘|首个交易日|历史价格)",
]

# Time-sensitive patterns mapped to Tavily official search params
# (pattern, topic, time_range): topic in {general, news, finance}, time_range in {day, week, month, year} or None
TIME_SENSITIVE_PATTERNS = [
    (r"(?:今天|今日|现在|目前|近期|最近|本周|本月|今年|2025|2026|2027|实时).*(?:天气|气温|温度|下雨|阴晴)", "general", "day"),
    (r"(?:今天|今日|现在|目前|实时|最新|历史).*(?:股价|股票|行情|汇率|金价|油价|指数|涨跌|市值|比特币|btc|eth|大盘|首个交易日)", "finance", "year"),
    (r"(?:QQQ|SPY|纳指|标普|道指|美股|A股|港股|ETF|比特币|BTC|ETH).*(?:价格|行情|走势|汇率|收益|定投|市值|历史)", "finance", "year"),
    (r"(?:最新|最近|近期|今天|昨晚|刚刚).*(?:新闻|大事件|发布会|动态|通告|消息|爆料)", "news", "week"),
    (r"(?:最近|近期|下次|下一次|最新|今年|2025|2026|2027).*(?:搞活动|活动|大促|促销|打折|优惠|降价|狂欢节|黑五|prime day|双十一|大促时间)", "news", "month"),
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
    r"^(?:解方程|计算一下|\d+\s*[\+\-\*\/]\s*\d+)$",
]

SEARCH_DECISION_PROMPT = """你是一个智能联网搜索决策与关键词重写引擎（类似 ChatGPT Search 调度系统）。
你需要分析用户的最新输入及最近对话上下文，判断是否需要联网获取最新、客观或事实性互联网信息，并提炼出最适合搜索引擎查询的高质量检索词。

【当前真实时间】
{current_time_info}

【何时需要联网搜索 (need_search: true)】
1. 时效性极强的事实或最新事件（如最新新闻、近期发布的产品、当前赛事、版本更新、当季政策等）。
2. 实时行情与动态数据（如股票走势、汇率走势、天气、加密货币行情等）。
3. 用户明确要求“搜索”、“查一下”、“最新官网”、“找找资料”或询问具体公共事实/权威信息。
4. 模型预训练知识库可能无法覆盖或可能随时间变化的特定事实（特别是 2024 年至今的新人物、新项目、新动态）。

【何时严禁联网搜索 (need_search: false)】
1. 日常问候、情感闲聊、表达谢意（如“你好”、“在吗”、“谢谢”）。
2. 通用概念解释、基础科学常识、经典算法/数学推导、哲学探讨。
3. 文本处理任务：撰写文章、翻译润色、改写扩写、小说创作等。
4. 编程任务：纯代码编写、代码解释、算法实现、一般 Bug 分析。
5. 单纯关于当前日期或星期几的询问（已有时间基准，无需搜索）。

【关键词生成要求 (search_query)】
- 如果 need_search 为 true，请生成精炼、准确、去除口语助词（如“帮我查一下”、“请问”）的搜索引擎检索词。
- 若用户提问指代不清（例如“它的售价是多少？”、“那个库怎么安装？”），必须结合【对话上下文】消除指代，补全核心主体。
- query 长度通常在 2~6 个关键词或短语，切忌整句长问句。
- topic 可选值：\"general\"（常规）、\"news\"（新闻时效）、\"finance\"（金融行情）。
- time_range 可选值：\"day\"、\"week\"、\"month\"、\"year\" 或 null。

【对话历史上下文】
{history_context}

【用户当前输入】
{user_message}

【输出格式】
必须严格输出且仅输出一个合法的 JSON 对象，不要添加任何 Markdown 代码块标记（如 ```json），不要添加任何额外解释说明：
{{"need_search": true, "search_query": "关键词", "topic": "general", "time_range": null}}
"""


def _fast_heuristic_check(user_message: str) -> Tuple[Optional[bool], str, str, Optional[str]]:
    """
    快速规则短路检测（0ms 响应）。
    返回: (matched_decision: Optional[bool], query: str, topic: str, time_range: Optional[str])
    matched_decision 为 None 表示规则未决，交由 LLM 语义研判。
    """
    msg = (user_message or "").strip()
    if not msg:
        return False, "", "general", None

    # 1. 显式命令前缀直接触发（如“帮我查一下xxx”、“搜索一下xxx”）
    clean_query = msg
    for prefix in EXPLICIT_SEARCH_PREFIXES:
        if re.search(prefix, clean_query, re.IGNORECASE):
            clean_query = re.sub(prefix, "", clean_query, flags=re.IGNORECASE).strip()
            if clean_query:
                return True, clean_query, "general", None

    # 2. 检查绝对不搜索的非联网模式（问候、打招呼、翻译代码、纯算术）
    for non_pattern in NON_SEARCH_PATTERNS:
        if re.search(non_pattern, msg, re.IGNORECASE):
            return False, "", "general", None

    # 3. 检查文件直接链接（交由文档解析器）
    if re.search(r"https?:\/\/[^\s]+\.(?:pdf|docx?|xlsx?|csv|json|zip|tar|gz|txt|md|png|jpe?g|webp)\b", msg, re.IGNORECASE):
        return False, "", "general", None

    # 4. 金融敏感查询快速识别
    is_financial = any(re.search(p, msg, re.IGNORECASE) for p in FINANCIAL_MARKET_PATTERNS)
    if is_financial:
        for time_pattern, topic, time_range in TIME_SENSITIVE_PATTERNS:
            if re.search(time_pattern, msg, re.IGNORECASE):
                search_q = clean_query or msg
                if "\\" in search_q:
                    search_q = re.sub(r"\\[a-zA-Z]+|\{|\}|_|\^", " ", search_q)
                    search_q = re.sub(r"\s+", " ", search_q).strip()
                return True, search_q or msg, topic, time_range

    return None, clean_query, "general", None


def should_search_web(user_message: str, mode: str = "auto") -> Tuple[bool, str, str, Optional[str]]:
    """
    快速同步判断（向下兼容接口）。
    对于同步路径，使用启发式规则；完整智能决策请使用 evaluate_and_generate_search_query。
    """
    if not user_message or not user_message.strip():
        return False, "", "general", None

    msg = user_message.strip()
    if mode == "off":
        return False, "", "general", None

    fast_dec, clean_q, topic, time_range = _fast_heuristic_check(msg)
    if mode == "on":
        return True, clean_q or msg, topic, time_range

    if fast_dec is not None:
        return fast_dec, clean_q, topic, time_range

    # 针对 auto 模式补充时间敏感规则
    for time_pattern, top, tr in TIME_SENSITIVE_PATTERNS:
        if re.search(time_pattern, msg, re.IGNORECASE):
            return True, clean_q or msg, top, tr

    if re.search(r"(?:https?:\/\/|[a-zA-Z0-9-]+\.(?:com|org|cn|net|io|ai|dev))\b", msg):
        return True, clean_q or msg, "general", None

    return False, "", "general", None


async def evaluate_and_generate_search_query(
    user_message: str,
    recent_messages: Optional[List[Any]] = None,
    mode: str = "auto",
    model: Optional[str] = None,
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Tuple[bool, str, str, Optional[str]]:
    """
    基于 ChatGPT 级智能语义决策与关键词重写机制：
    1. mode == 'off': 直接返回不搜索
    2. mode == 'on': 直接触发搜索，并使用 LLM 重写提炼精准搜索词
    3. mode == 'auto': 
       - 优先通过 _fast_heuristic_check 进行极速正则短路（0ms）
       - 若未命中短路规则，调用轻量 LLM 进行上下文感知意图判断与搜索词重写（200~400ms）
       - 若 LLM 响应异常或超时，自动平滑兜底至本地规则，绝不阻断正常聊天流程。
    """
    msg = (user_message or "").strip()
    if not msg:
        return False, "", "general", None

    if mode == "off":
        return False, "", "general", None

    fast_dec, clean_q, fast_topic, fast_tr = _fast_heuristic_check(msg)

    # 如果显式匹配了确定性规则（例如完全是闲聊问候），直接返回
    if mode == "auto" and fast_dec is False:
        return False, "", "general", None

    # 如果用户显式输入了搜索前缀（如“帮我查一下XXX”），我们已知 need_search=True，
    # 但若有 LLM，可用其去除冗余助词提炼出精准关键词；若无 LLM 或耗时敏感则直接用 clean_q。
    # 准备历史对话摘要上下文（取最近 4 条）
    history_snippets = []
    if recent_messages:
        for m in recent_messages[-4:]:
            role = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else "unknown")
            content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else "")
            if isinstance(content, str) and content.strip():
                clean_c = re.sub(r"!\[.*?\]\(.*?\)", "", content)
                clean_c = re.sub(r"<think>[\s\S]*?</think>", "", clean_c).strip()
                if clean_c:
                    history_snippets.append(f"{role}: {clean_c[:150]}")
    history_context_str = "\n".join(history_snippets) if history_snippets else "（无对话历史）"

    temporal_info = get_current_temporal_context().get("prompt_instruction", "")

    # 尝试使用模型进行意图研判与 Query 重写
    try:
        resolved_provider = provider or (detect_provider(model) if model else None)
        llm_instance = get_llm_provider(
            provider=resolved_provider,
            model=model,
            api_key=api_key,
            base_url=base_url
        )

        prompt = SEARCH_DECISION_PROMPT.format(
            current_time_info=temporal_info,
            history_context=history_context_str,
            user_message=msg[:600]
        )

        # 针对重写研判限制极低 token 与微小温度以追求极致速度和稳定性
        raw_res = await llm_instance.complete(
            messages=[{"role": "user", "content": prompt}],
            model=model or "gpt-4o-mini",
            temperature=0.1,
            max_tokens=150
        )

        if raw_res and raw_res.strip():
            cleaned_json = raw_res.strip()
            # 兼容模型偶尔添加的代码块反引号
            if "```" in cleaned_json:
                json_match = re.search(r"\{[\s\S]*?\}", cleaned_json)
                if json_match:
                    cleaned_json = json_match.group(0)

            data = json.loads(cleaned_json)
            need_search = bool(data.get("need_search", False))
            if mode == "on":
                need_search = True

            search_query = str(data.get("search_query") or clean_q or msg).strip()
            # 清理常见符号
            search_query = search_query.strip("\"'“”‘’#")
            topic = str(data.get("topic") or fast_topic or "general").strip().lower()
            if topic not in ("general", "news", "finance"):
                topic = "general"
            time_range = data.get("time_range")
            if time_range not in ("day", "week", "month", "year", None):
                time_range = None

            if need_search and not search_query:
                search_query = clean_q or msg

            logger.info(
                "LLM search evaluator decision: need_search=%s, query='%s', topic=%s, time_range=%s",
                need_search, search_query, topic, time_range
            )
            return need_search, search_query, topic, time_range

    except Exception as e:
        logger.warning("LLM search evaluator encountered error: %s, falling back to heuristic", str(e))

    # 兜底 fallback 至本地启发式策略
    fallback_need, fallback_q, fallback_topic, fallback_tr = should_search_web(msg, mode=mode)
    return fallback_need, fallback_q or clean_q or msg, fallback_topic, fallback_tr


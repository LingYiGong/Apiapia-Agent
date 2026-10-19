import json
import logging
import re
from typing import Tuple, Optional, List, Dict, Any

from app.core.i18n import get_locale, language_name
from app.services.llm.factory import get_llm_provider, detect_provider
from app.services.prompt.temporal import get_current_temporal_context

logger = logging.getLogger("web_search_evaluator")

"""
Web search intent evaluation and query generation triggers.
"""

# High-precision intent triggers (commands with inline query or prefix)
EXPLICIT_SEARCH_PREFIXES = [
    r"^(?:请|请你|你|帮我|麻烦|麻烦你|能否|可以)?\s*(?:去|在|到)?\s*(?:网上|全网|网络上|网络|谷歌|百度|搜索引擎|外网)?\s*(?:去)?\s*(?:搜一下|搜索一下|查一下|搜搜|查查|搜索|查找|检索|查询|打听一下|找找|搜搜看|查查看|搜下|查下|搜一搜|查一查)\s*[:：]?\s*",
    r"^(?:联网|通过网络|通过搜索|用搜索|用搜索引擎)\s*(?:搜一下|搜索一下|查一下|搜索|查找|检索|查询|搜|查|找找)\s*[:：]?\s*",
    r"^(?:ネット(?:で)?|ウェブ(?:で)?|インターネット(?:で)?|検索エンジン(?:で)?)?\s*(?:で|に|は)?\s*(?:調べて|検索して|調査して|探して|見て)\s*(?:みて)?\s*[:：]?\s*",
    r"^(?:search(?:\s+the\s+web|\s+online)?|google|look\s+up|find\s+out)\s*(?:for\s*)?",
]

# Standalone explicit search commands (user tells model to search without specifying topic in current turn, referring to context)
STANDALONE_SEARCH_PATTERNS = [
    r"^(?:请|请你|你|帮我|麻烦|麻烦你|能否|可以)?\s*(?:去|在|到)?\s*(?:网上|全网|网络上|网络|谷歌|百度|搜索引擎|外网)?\s*(?:去)?\s*(?:搜一下|搜索一下|查一下|搜搜|查查|搜索|查找|检索|查询|打听一下|找找|搜搜看|查查看|搜下|查下|搜一搜|查一查|看看|翻翻)[!！。?？\s]*$",
    r"^(?:联网|通过网络|通过搜索|用搜索|用搜索引擎)\s*(?:搜一下|搜索一下|查一下|搜索|查找|检索|查询|搜|查|找找|看下|看看)[!！。?？\s]*$",
    r"^(?:(?:ネット|ウェブ|インターネット|検索エンジン)(?:で)?\s*)?(?:調べて|検索して|調査して|探して|見てみて|調べてみて)[!！。?？\s。]*$",
    r"^(?:search(?:\s+it|\s+the\s+web|\s+online)?|google(?:\s+it)?|look\s+it\s+up|find\s+out)[!！。?？\s]*$",
]

# Patterns that indicate financial market data inquiry (requires web search even if containing math/numbers)
FINANCIAL_MARKET_PATTERNS = [
    r"(?:QQQ|SPY|DIA|IWM|VOO|纳斯达克|纳指|标普|道琼斯|道指|美股|A股|港股|ETF|比特币|BTC|ETH|加密货币|株価|暗号資産|stock|stocks|nasdaq|s&p\s?500|dow\s?jones|crypto|bitcoin|ethereum)",
    r"(?:股价|股票|行情|汇率|USD\s*/\s*CNY|USDCNY|美元兑人民币|外汇|金价|油价|大盘|首个交易日|历史价格|相場|株価|為替レート|金価格|原油価格|stock\s?price|share\s?price|exchange\s?rate|forex|oil\s?price|gold\s?price|market\s?cap|earnings)",
]

# Time-sensitive patterns mapped to Tavily official search params
# (pattern, topic, time_range): topic in {general, news, finance}, time_range in {day, week, month, year} or None
TIME_SENSITIVE_PATTERNS = [
(r"(?:今天|今日|现在|目前|近期|最近|本周|本月|今年|2025|2026|2027|实时).*(?:天气|气温|温度|下雨|阴晴|天気|気温|雨|weather|temperature|forecast)", "general", "day"),
    (r"(?:今天|今日|现在|目前|实时|最新|历史).*(?:股价|股票|行情|汇率|金价|油价|指数|涨跌|市值|比特币|btc|eth|大盘|首个交易日|株価|相場|為替レート|金価格|原油価格|時価総額|stock\s?price|share\s?price|exchange\s?rate|gold\s?price|oil\s?price|market\s?cap|bitcoin|index)", "finance", "year"),
    (r"(?:QQQ|SPY|纳指|标普|道指|美股|A股|港股|ETF|比特币|BTC|ETH).*(?:价格|行情|走势|汇率|收益|定投|市值|历史|価格|相場|推移|利回り|nasdaq|s&p\s?500|etf|bitcoin)", "finance", "year"),
    (r"(?:最新|最近|近期|今天|昨晚|刚刚).*(?:新闻|大事件|发布会|动态|通告|消息|爆料|ニュース|発表|報道|速報|news|headline|announcement|press\s+release)", "news", "week"),
    (r"(?:最近|近期|下次|下一次|最新|今年|2025|2026|2027|次回|いつ|最近).*(?:搞活动|活动|大促|促销|打折|优惠|降价|狂欢节|黑五|prime\s?day|双十一|大促时间|セール|割引|セール情報|promo|sale|discount|black\s?friday)", "news", "month"),
    (r"(?:比赛结果|比分|谁赢了|战况|总决赛|淘汰赛|奥运会|世界杯|欧冠|英超|nba|試合結果|スコア|優勝|決勝|オリンピック|ワールドカップ|score|who\s+won|final\s+score|olympics|world\s?cup)", "news", "week"),
    (r"(?:最新版本|什么时候发布|什么时候出|更新了什么|发布时间|发售日期|上线时间|最新版|リリース|配信|発売|newest\s+version|release\s+date|when\s+is\s+.*\s+(?:out|released)|changelog)", "general", "month"),
    (r"(?:现任|现在的|谁是现在的|目前谁是|誰が|who\s+is\s+the\s+(?:current|new)|current\s+ceo|current\s+president)", "general", None),
    (r"(?:官网|官方网址|下载链接|官方文档|公式サイト|ダウンロード|official\s+(?:site|website|docs?|documentation)|download\s+link)", "general", None),
    (r"(?:地铁|电车|電車|公交|巴士|新干线|城铁|轻轨|票价|车费|运费|運賃|料金|打车|地下鉄|電車|バス|新幹線|市電).*(?:多少钱|多少|价格|费用|票价|路线|换乘|怎么走|いくら|価格|運賃|ルート|乗り換え|fares?|how\s+much|route|transfer)", "general", None),
]

# Queries that should NEVER trigger web search automatically
NON_SEARCH_PATTERNS = [
    r"^(?:你好|早上好|晚上好|嗨|在吗|谢谢|多谢|不客气|再见|拜拜|おはよう|こんにちは|こんばんは|ありがとう|すみません|さようなら)[!！。？?~。\s]*$",
    r"^(?:(?:今天|明天|后天|昨天|大后天|前天)?(?:是)?(?:星期|礼拜|周)[一二三四五六日天几\?？\s]+|(?:what|which)\s+day\s+(?:is\s+it|today)\??|何曜日|曜日\??|今日は何曜日)[\?\?\s。]*$",
    r"^(?:(?:现在|今天|明天|后天|昨天)?(?:是)?(?:几点|几点了|几号|几月几号|几月几日|哪一年|什么时间|什么日子)[\?？\s]*|what\s+time|what'?s\s+the\s+time|what\s+date|today'?s\s+date|which\s+year|何時|今日は何日)[\?\?\s。]*$",
    r"(?:写一首|作一首|写一篇|写一段|写个故事|编一个|翻译|润色|改写|总结上述|概括以上|詩|物語|小説|描いて|訳して|翻訳|潤色|summari[sz]e|translate|rewrite|proofread|write\s+a\s+(?:poem|story|essay|song))",
    r"(?:编写代码|实现一个|写代码|写一个函数|写个脚本|debug|分析这段代码|プログラム|コード|スクリプト|デバッグ|write\s+(?:a\s+)?(?:function|script|program)|implement|refactor|debug\s+this|review\s+this\s+code)",
    r"^(?:解方程|计算一下|計算して|\d+\s*[\+\-\*\/\^]\s*\d+)$",
]

SEARCH_DECISION_PROMPT = """你是一个智能联网搜索决策与关键词重写引擎（类似 ChatGPT Search 调度系统）。
你需要分析用户的最新输入及最近对话上下文，判断是否需要联网获取最新、客观或事实性互联网信息，并提炼出最适合搜索引擎查询的高质量检索词。

【检索词语言】search_query 与 search_queries 一律使用【{query_language}】书写。
用户界面语言是 {query_language}，用英文检索词去喂一个中文界面只会让搜索结果与
用户看到的一切都对不上。只有当用户正在询问某个特定国家的本土事务、
且该国官方语言不是 {query_language} 时，才按下面的「跨语言/本土化一手信源策略」
额外补一条当地母语检索词。

【当前真实时间】
{current_time_info}

【何时需要联网搜索 (need_search: true)】
1. 时效性极强的事实或最新事件（如最新新闻、近期发布的产品、当前赛事、版本更新、当季政策等）。
2. 实时行情与动态数据（如股票走势、汇率走势、天气、加密货币行情等）。
3. 用户明确要求“搜索”、“查一下”、“去网上搜”、“找找资料”或询问具体公共事实/权威信息（若用户仅说“你去搜一下/去网上查查”，必须从对话历史中提取核心议题进行搜索）。
4. 模型预训练知识库可能无法覆盖或可能随时间变化的特定事实（特别是 2024 年至今的新人物、新项目、新动态）。

【何时严禁联网搜索 (need_search: false)】
1. 日常问候、情感闲聊、表达谢意（如“你好”、“在吗”、“谢谢”）。
2. 通用概念解释、基础科学常识、经典算法/数学推导、哲学探讨。
3. 文本处理任务：撰写文章、翻译润色、改写扩写、小说创作等。
4. 编程任务：纯代码编写、代码解释、算法实现、一般 Bug 分析。
5. 单纯关于当前日期或星期几的询问（已有时间基准，无需搜索）。

【关键词生成要求 (search_query & search_queries)】
- 如果 need_search 为 true，请生成精炼、准确、去除口语助词的搜索引擎检索词。
- 必须提供 search_query（主检索词），以及 search_queries（包含 1~3 个多维度互补检索词的列表，如核心主体词、背景词、对比/动态词，便于多角度并发检索）。
- 若用户提问指代不清（例如“它的售价是多少？”、“那个库怎么安装？”），必须结合【对话上下文】消除指代，补全核心主体。
- 【跨语言/本土化一手信源策略】：
  * 当用户询问明确涉及特定国家/地区的一手客观事实（如日本/美国/欧洲等地的本土政策、行业数据、招聘现状、官方白皮书、法律条例）或国际前沿技术/开源软件时，search_queries 列表中应包含 1 个该国本土官方语言（如日文、德文等）或国际通用英文的核心检索词，以获取最权威的第一手一手信息（例如查询日本IT行业缺口，可拓展包含日文词如 "日本 IT 人材 不足 職種 経済産業省"）。
  * 纯国内/中文本土事务（如国内公积金、国内政策、城市天气）严禁滥用外文，保持纯中文精准检索。
- query 长度通常在 2~6 个关键词或短语，切忌整句长问句。
- topic 可选值：\"general\"（常规）、\"news\"（新闻时效）、\"finance\"（金融行情）。
- time_range 可选值：\"day\"、\"week\"、\"month\"、\"year\" 或 null。

【Few-Shot 示范案例】
案例 1（明确涉及海外特定国家事实，search_queries 必须包含当地母语一手词）：
用户输入: "日本IT行业缺少哪种类型的人才？"
正确输出:
{{"need_search": true, "search_query": "日本 IT 行业 紧缺人才 类型", "search_queries": ["日本 IT 行业 紧缺人才", "日本 IT 人材 不足 職種 経済産業省", "Japan IT talent shortage skills"], "topic": "general", "time_range": null}}

案例 2（涉及海外国家官方政策/数据）：
用户输入: "俄罗斯目前的央行基准利率是多少？"
正确输出:
{{"need_search": true, "search_query": "俄罗斯 央行 基准利率", "search_queries": ["俄罗斯 央行 基准利率", "Банк России ключевая ставка", "Bank of Russia key interest rate"], "topic": "finance", "time_range": "year"}}

案例 3（纯国内/中文本土事务，严禁使用外文）：
用户输入: "上海公积金怎么提取？"
正确输出:
{{"need_search": true, "search_query": "上海 公积金 提取 条件 流程", "search_queries": ["上海 公积金 提取 条件 流程", "上海市住房公积金提取官网指南"], "topic": "general", "time_range": null}}

【对话历史上下文】
{history_context}

【用户当前输入】
{user_message}

【输出格式】
必须严格输出且仅输出一个合法的 JSON 对象，不要添加任何 Markdown 代码块标记（如 ```json），不要添加任何额外解释说明：
{{"need_search": true, "search_query": "核心关键词", "search_queries": ["核心关键词", "拓展词1", "拓展词2"], "topic": "general", "time_range": null}}
"""


def _extract_topic_from_recent_messages(recent_messages: Optional[List[Any]]) -> str:
    """
    当用户当前输入仅为“搜一下 / 你去网上搜一下”等无独立关键词指令时，
    从对话历史中倒序提取上一轮的核心议题或用户提问作为检索关键词。
    """
    if not recent_messages:
        return ""

    msgs = list(recent_messages)
    if len(msgs) > 1:
        f_created = getattr(msgs[0], "created_at", None)
        l_created = getattr(msgs[-1], "created_at", None)
        if f_created and l_created and f_created > l_created:
            msgs.reverse()

    # 1. 优先寻找倒数最近的一条 user 消息
    for m in reversed(msgs):
        role = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else "")
        if role == "user":
            content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else "")
            if isinstance(content, list):
                text_parts = [
                    item.get("text", "")
                    for item in content
                    if isinstance(item, dict) and item.get("type") == "text"
                ]
                content = " ".join(text_parts)
            if isinstance(content, str) and content.strip():
                cleaned = re.sub(r"!\[.*?\]\(.*?\)", "", content)
                cleaned = re.sub(r"📄\s*\*\*\[附件文件:[^\]]+\]\*\*", "", cleaned)
                cleaned = re.sub(r"```quote[\s\S]*?```", "", cleaned)
                cleaned = re.sub(r"【📌\s*用户引用回复的目标消息】[\s\S]*", "", cleaned)
                cleaned = re.sub(r"<think>[\s\S]*?</think>", "", cleaned).strip()
                # 剔除可能同样包含的前缀
                for prefix in EXPLICIT_SEARCH_PREFIXES:
                    cleaned = re.sub(prefix, "", cleaned, flags=re.IGNORECASE).strip()
                cleaned = re.sub(r"[？?！!。，,\s]+$", "", cleaned).strip()
                if cleaned and len(cleaned) > 1:
                    return cleaned[:100]

    # 2. 若未找到有效 user 消息，尝试从最近一条 assistant 消息提取首行文本
    for m in reversed(recent_messages):
        role = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else "")
        if role == "assistant":
            content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else "")
            if isinstance(content, str) and content.strip():
                clean_a = re.sub(r"<think>[\s\S]*?</think>", "", content)
                clean_a = re.sub(r"!\[.*?\]\(.*?\)", "", clean_a).strip()
                lines = [line.strip() for line in clean_a.splitlines() if line.strip()]
                if lines:
                    first_line = re.sub(r"[#*`>]+", "", lines[0]).strip()
                    if first_line and len(first_line) > 2:
                        return first_line[:60]

    return ""


def _fast_heuristic_check(
    user_message: str,
    recent_messages: Optional[List[Any]] = None
) -> Tuple[Optional[bool], str, str, Optional[str]]:
    """
    快速规则短路检测（0ms 响应）。
    返回: (matched_decision: Optional[bool], query: str, topic: str, time_range: Optional[str])
    matched_decision 为 None 表示规则未决，交由 LLM 语义研判。
    """
    msg = (user_message or "").strip()
    if not msg:
        return False, "", "general", None

    # 1. 显式命令直接触发
    # 1.1 独立显式搜索指令（如“你去网上搜一下”、“搜一下”、“上网查查”，无具体关键词，继承上文主体）
    for standalone_pat in STANDALONE_SEARCH_PATTERNS:
        if re.search(standalone_pat, msg, re.IGNORECASE):
            extracted_topic = _extract_topic_from_recent_messages(recent_messages)
            return True, extracted_topic, "general", None

    # 1.2 显式命令前缀+关键词（如“帮我查一下特斯拉股价”、“搜索一下xxx”）
    clean_query = msg
    for prefix in EXPLICIT_SEARCH_PREFIXES:
        if re.search(prefix, clean_query, re.IGNORECASE):
            clean_query = re.sub(prefix, "", clean_query, flags=re.IGNORECASE).strip()
            if clean_query:
                return True, clean_query, "general", None
            else:
                extracted_topic = _extract_topic_from_recent_messages(recent_messages)
                return True, extracted_topic, "general", None

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


def should_search_web(
    user_message: str,
    mode: str = "auto",
    recent_messages: Optional[List[Any]] = None
) -> Tuple[bool, str, str, Optional[str]]:
    """
    快速同步判断（向下兼容接口）。
    对于同步路径，使用启发式规则；完整智能决策请使用 evaluate_and_generate_search_query。
    """
    if not user_message or not user_message.strip():
        return False, "", "general", None

    msg = user_message.strip()
    if mode == "off":
        return False, "", "general", None

    fast_dec, clean_q, topic, time_range = _fast_heuristic_check(msg, recent_messages=recent_messages)
    if mode == "on":
        inherited_q = clean_q or _extract_topic_from_recent_messages(recent_messages) or msg
        return True, inherited_q, topic, time_range

    if fast_dec is not None:
        if fast_dec is True and not clean_q:
            clean_q = _extract_topic_from_recent_messages(recent_messages) or msg
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
) -> Tuple[bool, str, List[str], str, Optional[str]]:
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
        return False, "", [], "general", None

    if mode == "off":
        return False, "", [], "general", None

    fast_dec, clean_q, fast_topic, fast_tr = _fast_heuristic_check(msg, recent_messages=recent_messages)

    # 如果显式匹配了确定性规则（例如完全是闲聊问候），直接返回
    if mode == "auto" and fast_dec is False:
        return False, "", [], "general", None

    is_explicit_command = (fast_dec is True) or (mode == "on")
    context_extracted_query = clean_q or _extract_topic_from_recent_messages(recent_messages) or msg

    # 准备历史对话摘要上下文（取最近 4 条）
    history_snippets = []
    if recent_messages:
        msgs = list(recent_messages)
        if len(msgs) > 1:
            f_created = getattr(msgs[0], "created_at", None)
            l_created = getattr(msgs[-1], "created_at", None)
            if f_created and l_created and f_created > l_created:
                msgs.reverse()
        for m in msgs[-4:]:
            role = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else "unknown")
            content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else "")
            if isinstance(content, str) and content.strip():
                clean_c = re.sub(r"!\[.*?\]\(.*?\)", "", content)
                clean_c = re.sub(r"<think>[\s\S]*?</think>", "", clean_c).strip()
                if clean_c:
                    history_snippets.append(f"{role}: {clean_c[:150]}")
    history_context_str = "\n".join(history_snippets) if history_snippets else "（无对话历史）"

    temporal_info = get_current_temporal_context().get("prompt_instruction", "")

    # 若用户是无主题的独立搜索指令，在 prompt 中明确提示模型从上下文提取主题
    eval_user_msg = msg[:600]
    if is_explicit_command and (not clean_q or clean_q == msg):
        eval_user_msg = f"{msg} (用户明确要求联网搜索，请结合对话历史提取核心主题，need_search 必须为 true)"

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
            user_message=eval_user_msg,
            query_language=language_name(get_locale()),
        )

        # 针对重写研判限制低 token 与微小温度以追求极致速度和稳定性
        raw_res = await llm_instance.complete(
            messages=[{"role": "user", "content": prompt}],
            model=model or "gpt-4o-mini",
            temperature=0.1,
            max_tokens=300
        )

        if raw_res and raw_res.strip():
            cleaned_json = raw_res.strip()
            # 无论模型是否包裹 ```json 或附加解释性前后缀，均可靠抓取最外层合法的 JSON 字典
            json_match = re.search(r"\{[\s\S]*\}", cleaned_json)
            if json_match:
                cleaned_json = json_match.group(0)

            data = json.loads(cleaned_json)
            need_search = bool(data.get("need_search", False))
            if is_explicit_command:
                need_search = True

            search_query = str(data.get("search_query") or context_extracted_query).strip()
            # 清理常见符号
            search_query = search_query.strip("\"'“”‘’#")

            # 解析多维度拓展词列表 search_queries
            raw_queries = data.get("search_queries")
            queries_list: List[str] = []
            if isinstance(raw_queries, list):
                for q in raw_queries:
                    clean_item = str(q).strip().strip("\"'“”‘’#")
                    if clean_item and clean_item not in queries_list:
                        queries_list.append(clean_item)
            elif isinstance(raw_queries, str) and raw_queries.strip():
                queries_list.append(raw_queries.strip().strip("\"'“”‘’#"))

            if search_query and search_query not in queries_list:
                queries_list.insert(0, search_query)
            if not queries_list and search_query:
                queries_list = [search_query]
            elif not search_query and queries_list:
                search_query = queries_list[0]

            topic = str(data.get("topic") or fast_topic or "general").strip().lower()
            if topic not in ("general", "news", "finance"):
                topic = "general"
            time_range = data.get("time_range")
            if time_range not in ("day", "week", "month", "year", None):
                time_range = None

            if need_search and not search_query:
                search_query = context_extracted_query
                queries_list = [context_extracted_query] if context_extracted_query else []

            logger.info(
                "LLM search evaluator decision: need_search=%s, query='%s', queries=%s, topic=%s, time_range=%s",
                need_search, search_query, queries_list, topic, time_range
            )
            return need_search, search_query, queries_list, topic, time_range

    except Exception as e:
        logger.warning("LLM search evaluator encountered error: %s, falling back to heuristic", str(e))
        if is_explicit_command:
            logger.info("Explicit search command recognized, using context query: '%s'", context_extracted_query)
            return True, context_extracted_query, [context_extracted_query] if context_extracted_query else [], fast_topic or "general", fast_tr

    # 兜底 fallback 至本地启发式策略
    fallback_need, fallback_q, fallback_topic, fallback_tr = should_search_web(
        msg, mode=mode, recent_messages=recent_messages
    )
    final_q = fallback_q or context_extracted_query or clean_q or msg
    final_list = [final_q] if final_q else []
    return fallback_need, final_q, final_list, fallback_topic, fallback_tr


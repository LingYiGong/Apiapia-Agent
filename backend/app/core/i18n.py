"""多语言基础设施：错误消息本地化 + 提示词语言指令。

此前本项目的中文只存在于两个地方：界面（前端硬编码）与**后端返回的
``detail=`` 字符串**。后者尤其麻烦 —— 它们中英混杂（``"Memory not found"``
与 ``"图片不存在"`` 同在一个项目里），而且前端是直接把 ``err.message``
弹进 toast 的，于是英文用户会看到一条中文错误。

解决方式分两层：

1. **错误码 + 参数化文案。** 抛错处不再写死一句话，而是 ``ApiError(404,
   "CONVERSATION_NOT_FOUND")``。文案集中在本文件，前端拿到的 ``detail``
   已经按请求头切好语言。
2. **错误码同时回传给前端。** 响应体多一个 ``code`` 字段，前端可以用它
   做二次本地化（前端词典里可能还有更贴合上下文的说法），也便于日志与
   监控按码聚合，而不是按字符串聚合。

请求语言来自 ``Accept-Language``，由前端每次请求显式带上（见
``frontend/src/i18n/runtime.ts`` 的 ``acceptLanguageHeader``）。用标准头而不是
自定义头，是因为它同时服务于搜索引擎、CDN 与任何未来绕过本项目前端的调用方。
"""

from __future__ import annotations

import re
from contextvars import ContextVar
from typing import Any, Mapping

# 与前端 src/i18n/types.ts 的 LOCALES 保持一致，两边必须同步修改。
LOCALES: tuple[str, ...] = ("zh-CN", "zh-TW", "en", "ja")

DEFAULT_LOCALE = "zh-CN"

#: 当前请求的语言。用 ContextVar 而不是逐层传参：tr() 会被 services 层
#: 深处的代码调用，而那些函数的签名里并不该出现一个纯 UI 概念。
#: ContextVar 天然按请求隔离，异步任务之间不会串。
_current_locale: ContextVar[str] = ContextVar("apiapia_locale", default=DEFAULT_LOCALE)


def normalize_locale(raw: str | None) -> str | None:
    """把 Accept-Language 里的一个语言标签落到受支持的语言上。

    匹配忽略大小写，并按子标签回退：``en-US`` → ``en``、``zh-HK`` → ``zh-TW``、
    ``ja-JP`` → ``ja``。无法识别时返回 None，调用方决定回落策略。
    """
    if not raw:
        return None
    tag = raw.split(";")[0].strip()
    if not tag:
        return None
    lowered = tag.lower()
    for locale in LOCALES:
        if locale.lower() == lowered:
            return locale
    for locale in LOCALES:
        base = locale.split("-")[0].lower()
        if lowered == base or lowered.startswith(base + "-"):
            return locale
    return None


def parse_accept_language(header: str | None) -> str:
    """按 q 值从高到低取第一个命中的语言；都没命中则回落到默认语言。"""
    if not header:
        return DEFAULT_LOCALE
    candidates: list[tuple[float, str]] = []
    for index, part in enumerate(header.split(",")):
        piece = part.strip()
        if not piece:
            continue
        pieces = piece.split(";")
        tag = pieces[0].strip()
        quality = 1.0
        for param in pieces[1:]:
            if param.strip().startswith("q="):
                try:
                    quality = float(param.strip()[2:])
                except ValueError:
                    quality = 0.0
        candidates.append((quality, tag))
    # 稳定排序：q 相同时按出现顺序，保证同 q 的两个语言里先出现的那个胜出。
    ordered = sorted(candidates, key=lambda item: -item[0])
    for _quality, tag in ordered:
        locale = normalize_locale(tag)
        if locale:
            return locale
    return DEFAULT_LOCALE


def set_locale(locale: str) -> None:
    _current_locale.set(locale if locale in LOCALES else DEFAULT_LOCALE)


def get_locale() -> str:
    return _current_locale.get()


# ── 文案 ──────────────────────────────────────────────────────────────

_PLACEHOLDER = re.compile(r"\{(\w+)\}")


def _interpolate(template: str, params: Mapping[str, Any]) -> str:
    if not params:
        return template

    def repl(match: re.Match[str]) -> str:
        name = match.group(1)
        value = params.get(name)
        return match.group(0) if value is None else str(value)

    return _PLACEHOLDER.sub(repl, template)


def tr(key: str, /, **params: Any) -> str:
    """按当前请求语言取一条文案。

    取不到时按「默认语言 → 裸键名」逐级降级，绝不抛异常 —— 一条错误消息
    因为语言包缺词而变成 500，比显示英文更糟。
    """
    from app.core import messages  # 延迟导入，避免与 settings 形成导入环

    table = messages.TABLES.get(get_locale()) or messages.TABLES[DEFAULT_LOCALE]
    template = table.get(key)
    if template is None:
        template = messages.TABLES[DEFAULT_LOCALE].get(key, key)
    return _interpolate(template, params)


# ── 提示词语言指令 ────────────────────────────────────────────────────

#: 注入系统提示词里的「回复语言」指令。
#:
#: 为什么必须放在系统提示词里而不是前端：模型只会看到提示词，看不到界面语言。
#: 英文界面的用户如果得到中文回复，那是模型在按提示词里的中文人设说话。
#: 措辞刻意写成祈使句并强调「无论提问语言」—— 否则用户在英文界面里用中文提问
#: 时，模型会跟着提问语言走，这正是绝大多数用户想要的，但默认人设里写着中文，
#: 不覆盖的话会出现「提问中文、回复中文」而用户其实设的是英文的矛盾状态。
LANGUAGE_DIRECTIVES: dict[str, str] = {
    "zh-CN": (
        "【回复语言】无论用户使用什么语言提问，都一律使用简体中文作答。"
        "专有名词、代码、命令与数学公式保持原样，不要翻译。"
    ),
    "zh-TW": (
        "【回覆語言】無論使用者使用什麼語言提問，都一律使用繁體中文作答。"
        "專有名詞、程式碼、指令與數學公式保持原樣，不要翻譯。"
    ),
    "en": (
        "[Response Language] Always reply in English, no matter which language the "
        "question is written in. Keep proper nouns, code, commands and mathematical "
        "formulas untranslated."
    ),
    "ja": (
        "【応答言語】ユーザーがどの言語で質問しても、必ず日本語で回答してください。"
        "固有名詞・コード・コマンド・数式はそのまま保持し、翻訳しないでください。"
    ),
}


def language_directive(locale: str | None = None) -> str:
    """返回该语言的回复语言指令；未知语言回落到默认语言。"""
    target = locale if locale in LANGUAGE_DIRECTIVES else DEFAULT_LOCALE
    return LANGUAGE_DIRECTIVES[target]


def language_name(locale: str | None = None) -> str:
    """语言的自称，供提示词里点名（如「请用 {language} 回答」）。"""
    names = {
        "zh-CN": "简体中文",
        "zh-TW": "繁體中文",
        "en": "English",
        "ja": "日本語",
    }
    target = locale if locale in names else DEFAULT_LOCALE
    return names[target]
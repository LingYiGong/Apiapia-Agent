"""多语言基础设施：错误消息本地化 + 提示词语言指令。"""

from __future__ import annotations

import re
from contextvars import ContextVar
from typing import Any, Mapping

# 与前端 src/i18n/types.ts 的 LOCALES 保持一致
LOCALES: tuple[str, ...] = ("zh-CN", "zh-TW", "en", "ja")

DEFAULT_LOCALE = "zh-CN"

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


#: 注入系统提示词里的「回复语言」指令。
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
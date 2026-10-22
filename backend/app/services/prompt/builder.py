from typing import Optional

from app.services.prompt.temporal import get_current_temporal_context
from app.services.prompt.rules import ANTI_TRAP_RULES
from app.services.prompt.localized import response_language_directive, text


class SystemPromptBuilder:
    """
    模块化系统提示词构建器。
    整合物理时基、确定性核验事实、批判性常识护栏、长期记忆和排版规范。
    """

    def __init__(self, base_system_prompt: Optional[str] = None):
        self.base_prompt = (base_system_prompt or "").strip() or text("default_persona")

    def build(
        self,
        memory_context: Optional[str] = None,
        deterministic_context: Optional[str] = None,
        custom_about_user: Optional[str] = None,
        custom_response_style: Optional[str] = None,
    ) -> str:
        sections = []

        # 1. 用户自定义助手人设 / 基础系统角色设定
        sections.append(f"{text('role_header')}\n{self.base_prompt}")

        # 1.1 ChatGPT-style Custom Instructions
        if custom_about_user and custom_about_user.strip():
            sections.append(f"【用户背景与个性化说明 (Custom Instructions - User Background)】\n{custom_about_user.strip()}")

        if custom_response_style and custom_response_style.strip():
            sections.append(f"【用户期望的回答风格与偏好 (Custom Instructions - Response Style)】\n{custom_response_style.strip()}")

        # 1b. 回复语言指令（前半）
        sections.append(response_language_directive())

        # 2. 动态现实物理时基（解决"今天/明天星期几、当前年份"等问题）
        sections.append(get_current_temporal_context()["prompt_instruction"])

        # 3. 本地确定性核验事实（针对数字比大小、字符清点、算术的铁证依据）
        if deterministic_context and deterministic_context.strip():
            sections.append(deterministic_context.strip())

        # 4. 业界标准批判性常识与逻辑防翻车护栏
        sections.append(ANTI_TRAP_RULES)

        # 5. 召回的长期背景事实（Mem0 长期记忆库）
        if memory_context and memory_context.strip():
            sections.append(memory_context.strip())

        # 6. 实时网络检索引导
        sections.append(text("search_instruction"))

        # 7. Markdown 与表格排版规范
        sections.append(text("format_instruction"))

        # 8. 回复语言指令（后半，靠近因效应兜底）
        sections.append(response_language_directive())

        # 遵循清晰分段标准进行拼接
        return "\n\n".join(sections)


def build_system_prompt(
    base_prompt: Optional[str] = None,
    memory_context: Optional[str] = None,
    deterministic_context: Optional[str] = None,
    custom_about_user: Optional[str] = None,
    custom_response_style: Optional[str] = None,
) -> str:
    """快捷构建完整的防翻车系统提示词"""
    builder = SystemPromptBuilder(base_system_prompt=base_prompt)
    return builder.build(
        memory_context=memory_context,
        deterministic_context=deterministic_context,
        custom_about_user=custom_about_user,
        custom_response_style=custom_response_style,
    )
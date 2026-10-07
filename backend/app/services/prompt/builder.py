from typing import Optional
from app.services.prompt.temporal import get_current_temporal_context
from app.services.prompt.rules import ANTI_TRAP_RULES, SEARCH_INSTRUCTION, FORMAT_INSTRUCTION


class SystemPromptBuilder:
    """
    模块化系统提示词构建器。
    根据 OpenAI / Anthropic 官方 Context Engineering 标准，
    将物理时基、批判性常识护栏、长期记忆和排版规范进行优雅整合。
    """

    def __init__(self, base_system_prompt: Optional[str] = None):
        self.base_prompt = (base_system_prompt or "").strip() or "你是一个智能、真诚、有洞察力的个人智能助理。"

    def build(self, memory_context: Optional[str] = None, deterministic_context: Optional[str] = None) -> str:
        sections = []

        # 1. 用户自定义助手人设 / 基础系统角色设定
        sections.append(f"【角色与核心设定】\n{self.base_prompt}")

        # 2. 动态现实物理时基（解决“今天/明天星期几、当前年份”等问题）
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
        sections.append(SEARCH_INSTRUCTION)

        # 7. Markdown 与表格排版规范
        sections.append(FORMAT_INSTRUCTION)

        # 遵循清晰分段标准进行拼接
        return "\n\n".join(sections)


def build_system_prompt(
    base_prompt: Optional[str] = None,
    memory_context: Optional[str] = None,
    deterministic_context: Optional[str] = None
) -> str:
    """快捷构建完整的防翻车系统提示词"""
    builder = SystemPromptBuilder(base_system_prompt=base_prompt)
    return builder.build(memory_context=memory_context, deterministic_context=deterministic_context)


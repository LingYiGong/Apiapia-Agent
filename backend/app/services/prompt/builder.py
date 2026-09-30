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
        self.enable_anti_trap = True
        self.enable_temporal = True
        self.enable_formatting = True
        self.enable_search_instruction = True

    def build(self, memory_context: Optional[str] = None) -> str:
        sections = []

        # 1. 用户自定义助手人设 / 基础系统角色设定
        sections.append(f"【角色与核心设定】\n{self.base_prompt}")

        # 2. 动态现实物理时基（解决“今天/明天星期几、当前年份”等问题）
        if self.enable_temporal:
            temporal = get_current_temporal_context()
            sections.append(temporal["prompt_instruction"])

        # 3. 业界标准批判性常识与逻辑防翻车护栏
        if self.enable_anti_trap:
            sections.append(ANTI_TRAP_RULES)

        # 4. 召回的长期背景事实（Mem0 长期记忆库）
        if memory_context and memory_context.strip():
            sections.append(memory_context.strip())

        # 5. 实时网络检索引导
        if self.enable_search_instruction:
            sections.append(SEARCH_INSTRUCTION)

        # 6. Markdown 与表格排版规范
        if self.enable_formatting:
            sections.append(FORMAT_INSTRUCTION)

        # 遵循清晰分段标准进行拼接
        return "\n\n".join(sections)


def build_system_prompt(base_prompt: Optional[str] = None, memory_context: Optional[str] = None) -> str:
    """快捷构建完整的防翻车系统提示词"""
    builder = SystemPromptBuilder(base_system_prompt=base_prompt)
    return builder.build(memory_context=memory_context)

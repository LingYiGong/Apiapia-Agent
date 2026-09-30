from datetime import datetime
from typing import Dict, Any


def get_current_temporal_context() -> Dict[str, Any]:
    """
    获取服务器当前本地物理时间基准，包括公历年月日、时间、中文星期几以及时区信息。
    为大语言模型提供坚实的时空锚点（Temporal Grounding）。
    """
    now = datetime.now().astimezone()
    weekdays_zh = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
    weekday_str = weekdays_zh[now.weekday()]
    tz_name = now.tzname() or "Local"

    formatted_str = (
        f"【当前现实世界真实时间基准】\n"
        f"- 当前公历时间：{now.strftime('%Y年%m月%d日 %H:%M:%S')}\n"
        f"- 今天是：{weekday_str}\n"
        f"- 当前时区：{tz_name}\n"
        f"- 推算指导原则：当用户询问涉及相对时间（如“今天”、“明天”、“后天”、“昨天”、“星期几”、“今年”、“几月”等），请无条件以此时间基准为绝对真理进行逻辑推算和解答，严禁回答“无法获取实时时间”。"
    )

    return {
        "datetime_str": now.strftime("%Y-%m-%d %H:%M:%S"),
        "weekday": weekday_str,
        "timezone": tz_name,
        "prompt_instruction": formatted_str,
    }

from datetime import datetime
from typing import Any, Dict

from app.services.prompt.localized import format_datetime, text, weekday_of


def get_current_temporal_context() -> Dict[str, Any]:
    """
    服务器当前本地物理时间基准，包括公历年月日、时间、星期几以及时区信息。
    为大语言模型提供坚实的时空锚点（Temporal Grounding）。

    输出语言跟随请求：英文用户拿到的是 "Today is: Wednesday"，
    日文用户拿到的是「今日は：水曜日」。这不是装饰 —— 模型会把这段
    原文当作自己要复述的事实，锚点写成中文，模型就很容易在英文对话里
    顺口答出一个中文星期。
    """
    now = datetime.now().astimezone()
    weekday_str = weekday_of(now)
    tz_name = now.tzname() or "Local"

    formatted_str = "\n".join(
        [
            text("temporal_header"),
            text("temporal_datetime").format(datetime=format_datetime(now)),
            text("temporal_weekday").format(weekday=weekday_str),
            text("temporal_tz").format(tz=tz_name),
            text("temporal_rule"),
        ]
    )

    return {
        # 机器可读的那份保持 ASCII，中文也无需特殊格式，
        # 且被确定性引擎与日志复用。
        "datetime_str": now.strftime("%Y-%m-%d %H:%M:%S"),
        "weekday": weekday_str,
        "timezone": tz_name,
        "prompt_instruction": formatted_str,
    }
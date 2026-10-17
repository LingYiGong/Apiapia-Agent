from datetime import datetime
from typing import Any, Dict

from app.services.prompt.localized import format_datetime, text, weekday_of


def get_current_temporal_context() -> Dict[str, Any]:
    """
    服务器当前本地物理时间基准，包括公历年月日、时间、星期几以及时区信息。
    为大语言模型提供时空锚点（Temporal Grounding）。
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
        "datetime_str": now.strftime("%Y-%m-%d %H:%M:%S"),
        "weekday": weekday_str,
        "timezone": tz_name,
        "prompt_instruction": formatted_str,
    }
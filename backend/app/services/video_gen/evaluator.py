"""
Video Generation Intent Evaluator.
Distinguishes between:
1. Native AI Video Generation (e.g. 生成视频, 做一段视频, 视频生成)
2. Questions about video (e.g. 什么是视频, 怎么剪辑视频)
"""
import re
from typing import Tuple, Optional


# Questions asking about videos rather than requesting actual generation
VIDEO_EXCLUSION_PATTERNS = [
    r"你会做视频吗",
    r"你能做视频吗",
    r"你会生成视频吗",
    r"你能生成视频吗",
    r"怎么做视频",
    r"如何做视频",
    r"教我做视频",
    r"怎么剪辑视频",
    r"如何剪辑视频",
    r"视频剪辑软件",
    r"什么是视频",
    r"看这[段个]?视频",
    r"分析这[段个]?视频",
    r"总结这[段个]?视频",
    r"视频提取",
    r"视频转文字",
]

# Core video trigger regexes
VIDEO_DRAW_PATTERNS = [
    r"^(?:请|麻烦)?(?:帮我|替我|给我)?(?:生成|制作|做|创作|渲染|输出)(?:一段|一个|一条|部)?(?:\d+\s*[秒分s]的?)?(?:真实的?|超清|高清|精美|好看的)?(?:视频|短视频|动态画面|动画|影像)[:：\s]*(.+)$",
    r"^(?:请|麻烦)?(?:帮我|替我|给我)?(?:生成|制作|做|创作|渲染|输出)(?:一段|一个|一条)?(?:关于|如下)?(.+?)(?:的)?(?:视频|短视频|动态画面|动画)$",
    r"^(?:generate|create|make)\s+(?:a\s+)?(?:\d+\s*(?:s|sec|second)s?\s+)?(?:video|animation|clip)\s+(?:of|showing|depicting)?\s*(.+)$",
    r"^(?:文生视频|文字生成视频)[:：\s]*(.+)$",
]


def should_generate_video(text: Optional[str]) -> Tuple[bool, Optional[str], str]:
    """
    Evaluates whether the user message is requesting AI video generation.

    Returns:
        (is_video_gen, prompt, aspect_ratio)
        - is_video_gen: bool
        - prompt: cleaned prompt string for the video model
        - aspect_ratio: "16:9" (default landscape), "9:16" (portrait), or "1:1"
    """
    if not text or not text.strip():
        return False, None, "16:9"

    cleaned_text = text.strip()

    # 1. Check exclusions
    for exc in VIDEO_EXCLUSION_PATTERNS:
        if re.search(exc, cleaned_text, re.IGNORECASE):
            return False, None, "16:9"

    # 2. Detect Aspect Ratio
    aspect_ratio = "16:9"
    if any(k in cleaned_text for k in ["竖屏", "手机视频", "9:16", "抖音", "快手", "tiktok", "portrait"]):
        aspect_ratio = "9:16"
    elif any(k in cleaned_text for k in ["正方形", "1:1", "方形"]):
        aspect_ratio = "1:1"
    elif any(k in cleaned_text for k in ["横屏", "16:9", "宽屏", "电影画幅", "landscape"]):
        aspect_ratio = "16:9"

    # 3. Match video patterns
    for pat in VIDEO_DRAW_PATTERNS:
        match = re.match(pat, cleaned_text, re.IGNORECASE)
        if match:
            candidate_prompt = match.group(1).strip()
            # Remove trailing punctuations
            candidate_prompt = re.sub(r"[。！？!?~～]+$", "", candidate_prompt).strip()
            # Strip redundant words like "的视频", "的样子"
            candidate_prompt = re.sub(r"(?:的)?(?:视频|短视频|动态画面|动画)$", "", candidate_prompt).strip()
            if candidate_prompt and len(candidate_prompt) >= 2:
                return True, candidate_prompt, aspect_ratio

    return False, None, aspect_ratio

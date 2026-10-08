"""
Image Generation Intent Evaluator.
Distinguishes between:
1. Native AI Image Generation (DALL-E 3 / Flux.1 Bitmaps)
2. Vector / Code-based drawing (SVG / Canvas / Mermaid)
3. General chat questions about drawing
"""
import re
from typing import Tuple, Optional


# Explicit indicators that the user wants SVG / Code drawing instead of bitmap generation
SVG_CODE_INDICATORS = [
    "svg",
    "canvas",
    "代码画",
    "html画",
    "css画",
    "web画",
    "矢量图",
    "矢量画",
    "字符画",
    "ascii",
    "mermaid",
]

# Patterns asking questions about drawing rather than requesting an actual drawing
EXCLUSION_PATTERNS = [
    r"你会画画吗",
    r"你能画画吗",
    r"怎么画",
    r"如何画",
    r"教我画",
    r"画画技巧",
    r"画图软件",
    r"画图板",
    r"画大饼",
    r"什么是",
    r"图里有什么",
    r"看这[张幅]图",
    r"分析[这张]?图",
    r"视频",
    r"短视频",
    r"动画",
    r"动图",
]

# Core drawing trigger regexes
DRAW_PATTERNS = [
    r"^(?:请|麻烦)?(?:帮我|替我|给我)?(?:生成|画|绘制|创作|做)(?:一[幅张个份])?(?:张|幅)?(?:真实|超清|高清|精美|好看的)?(?:图片|图画|画作|插画|照片|壁纸|海报|头像|插图)?[:：\s]*(.+)$",
    r"^(?:请|麻烦)?(?:帮我|替我|给我)?(?:画|绘制)(?:一[幅张条只位个])?(.+)$",
    r"^生成(?:一[幅张])?(?:关于|如下)?(.+?)(?:的)?(?:图片|照片|画作|插画|壁纸|海报|头像)$",
    r"^(?:draw|generate|paint|create)\s+(?:an?\s+)?(?:image|picture|photo|painting|illustration|wallpaper)\s+(?:of|showing|depicting)?\s*(.+)$",
    r"^(?:draw|paint)\s+(?:me\s+)?(?:an?\s+)?(.+)$",
]


def should_generate_image(text: Optional[str]) -> Tuple[bool, Optional[str], str]:
    """
    Evaluates whether the user message is requesting AI image generation.

    Returns:
        (is_image_gen, prompt, size)
        - is_image_gen: bool
        - prompt: cleaned prompt string for the image model
        - size: "1024x1024", "1792x1024" (landscape), or "1024x1792" (portrait)
    """
    if not text or not text.strip():
        return False, None, "1024x1024"

    cleaned_text = text.strip()

    # 1. If user explicitly asks for SVG or code drawing, let the LLM handle it as code
    lower_text = cleaned_text.lower()
    for indicator in SVG_CODE_INDICATORS:
        if indicator in lower_text:
            return False, None, "1024x1024"

    # 2. Check exclusions
    for exc in EXCLUSION_PATTERNS:
        if re.search(exc, cleaned_text, re.IGNORECASE):
            return False, None, "1024x1024"

    # 3. Detect Aspect Ratio
    size = "1024x1024"
    if any(k in cleaned_text for k in ["横屏", "电脑壁纸", "横图", "landscape", "宽屏", "桌面壁纸"]):
        size = "1792x1024"
    elif any(k in cleaned_text for k in ["竖屏", "手机壁纸", "竖图", "portrait", "头像"]):
        size = "1024x1792"

    # 4. Match draw patterns
    for pat in DRAW_PATTERNS:
        match = re.match(pat, cleaned_text, re.IGNORECASE)
        if match:
            candidate_prompt = match.group(1).strip()
            # Remove trailing punctuations
            candidate_prompt = re.sub(r"[。！？!?~～]+$", "", candidate_prompt).strip()
            # Strip redundant words like "的图片", "的样子"
            candidate_prompt = re.sub(r"(?:的)?(?:图片|照片|画作|插画|壁纸|海报|头像)$", "", candidate_prompt).strip()
            if candidate_prompt and len(candidate_prompt) >= 2:
                return True, candidate_prompt, size

    return False, None, size

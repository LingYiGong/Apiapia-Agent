import io
import re
import base64
import zipfile
import logging
from typing import Dict, Any

logger = logging.getLogger("document_parser")

MAX_DOCUMENT_CHARS = 50000  # Safe boundary for document context injection


def parse_attachment(name: str, mime_type: str, data_url: str) -> Dict[str, Any]:
    """
    Parse an attachment payload into either an image payload or extracted text document.
    
    Returns dict:
    {
        "type": "image" | "document",
        "name": name,
        "mime_type": mime_type,
        "data_url": data_url,
        "extracted_text": str (for document)
    }
    """
    is_image = (
        mime_type.startswith("image/")
        or any(name.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"])
    )

    if is_image:
        return {
            "type": "image",
            "name": name,
            "mime_type": mime_type or "image/jpeg",
            "data_url": data_url,
            "extracted_text": ""
        }

    # Extract base64 payload
    try:
        if ";base64," in data_url:
            b64_content = data_url.split(";base64,")[1]
        else:
            b64_content = data_url
        raw_bytes = base64.b64decode(b64_content)
    except Exception as e:
        logger.error("Failed to decode base64 attachment %s: %s", name, e)
        return {
            "type": "document",
            "name": name,
            "mime_type": mime_type,
            "data_url": data_url,
            "extracted_text": f"[无法读取文件 {name}: Base64 解码错误]"
        }

    extracted_text = ""
    lower_name = name.lower()

    # 1. PDF Parsing
    if lower_name.endswith(".pdf") or "pdf" in mime_type:
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
            pages = []
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text()
                if txt and txt.strip():
                    pages.append(f"--- 第 {idx + 1} 页 ---\n{txt.strip()}")
            extracted_text = "\n\n".join(pages)
        except ImportError:
            # Fallback simple string extraction from raw bytes
            logger.warning("pypdf not available; falling back to raw stream text extraction")
            text_chunks = re.findall(rb"\(([^\)]+)\)Tj", raw_bytes)
            if text_chunks:
                extracted_text = "".join(c.decode("latin1", errors="ignore") for c in text_chunks)
            else:
                extracted_text = "[提示: 后端未安装 pypdf 库，建议安装 pypdf 以获得完整 PDF 解析效果]"
        except Exception as e:
            logger.warning("Failed to parse PDF %s: %s", name, e)
            extracted_text = f"[PDF 解析异常: {e}]"

    # 2. DOCX Word Document Parsing (using pure Python standard zipfile)
    elif lower_name.endswith(".docx"):
        try:
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as z:
                xml_content = z.read("word/document.xml").decode("utf-8")
                # Extract text inside <w:t> tags
                chunks = re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml_content)
                extracted_text = "".join(chunks)
        except Exception as e:
            logger.warning("Failed to parse docx %s: %s", name, e)
            extracted_text = f"[Word 文档解析失败: {e}]"

    # 3. Plain Text / Code / Markdown / CSV / JSON
    else:
        for enc in ["utf-8", "gbk", "gb2312", "latin1"]:
            try:
                extracted_text = raw_bytes.decode(enc)
                break
            except UnicodeDecodeError:
                continue

    if not extracted_text:
        extracted_text = f"[文件 {name} 内容为空或无法识别为纯文本]"

    # Apply length guardrail
    if len(extracted_text) > MAX_DOCUMENT_CHARS:
        extracted_text = extracted_text[:MAX_DOCUMENT_CHARS] + f"\n\n[注意：文档过长，已截取前 {MAX_DOCUMENT_CHARS} 字符供分析]"

    return {
        "type": "document",
        "name": name,
        "mime_type": mime_type,
        "data_url": data_url,
        "extracted_text": extracted_text.strip()
    }

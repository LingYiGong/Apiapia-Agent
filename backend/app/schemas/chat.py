from pydantic import BaseModel, Field, model_validator
from typing import Optional, List


#: Maximum number of attachments per message
MAX_ATTACHMENTS = 10

#: Per-file attachment ceiling (20 MB decoded)
MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

#: Combined attachment ceiling (40 MB decoded)
MAX_TOTAL_ATTACHMENT_BYTES = 40 * 1024 * 1024


class AttachmentPayload(BaseModel):
    name: str = Field(max_length=255)
    mime_type: Optional[str] = Field(default="application/octet-stream", max_length=120)
    data_url: str  # base64 data url: "data:...;base64,..."


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = Field(default=None, max_length=36)
    message: str
    model: Optional[str] = Field(default=None, max_length=100)
    provider: Optional[str] = Field(default=None, max_length=50)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=128000)
    reasoning_effort: Optional[str] = Field(default=None, max_length=20)  # "low", "medium", "high"
    system_prompt_override: Optional[str] = Field(default=None, max_length=10000)
    quoted_message_id: Optional[str] = Field(default=None, max_length=36)
    quoted_content: Optional[str] = Field(default=None, max_length=20000)
    memory_enabled: Optional[bool] = True
    memory_score_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    web_search_mode: Optional[str] = Field(default=None, max_length=10)  # "auto", "on", "off"
    image_gen_mode: Optional[bool] = Field(default=False)  # Explicitly trigger image generation
    video_gen_mode: Optional[bool] = Field(default=False)  # Explicitly trigger video generation
    single_turn_mode: Optional[bool] = Field(default=False)  # If true, skips multi-turn history context for pure single-turn tasks like translation
    attachments: Optional[List[AttachmentPayload]] = Field(
        default=None, max_length=MAX_ATTACHMENTS
    )

    @model_validator(mode="after")
    def _check_attachment_budget(self) -> "ChatRequest":
        """Reject an over-budget attachment set before decoding."""
        if not self.attachments:
            return self

        total = 0
        for attachment in self.attachments:
            encoded = attachment.data_url
            base64_part = encoded.split(";base64,", 1)[-1]
            decoded = (len(base64_part) * 3) // 4
            if decoded > MAX_ATTACHMENT_BYTES:
                raise ValueError(
                    f"附件「{attachment.name}」约 {decoded // (1024 * 1024)}MB，"
                    f"超过单文件 {MAX_ATTACHMENT_BYTES // (1024 * 1024)}MB 上限"
                )
            total += decoded

        if total > MAX_TOTAL_ATTACHMENT_BYTES:
            raise ValueError(
                f"本次附件合计约 {total // (1024 * 1024)}MB，"
                f"超过总量 {MAX_TOTAL_ATTACHMENT_BYTES // (1024 * 1024)}MB 上限"
            )
        return self
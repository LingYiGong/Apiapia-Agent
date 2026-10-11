from pydantic import BaseModel, Field, model_validator
from typing import Optional, List


#: Ceiling on how many files one message may carry. Deliberately looser than the
#: real constraint (total bytes, below) because the frontend does not cap the count
#: at all — a strict count limit here would reject a whole message, text included,
#: for something a total-byte budget would have happily accepted.
MAX_ATTACHMENTS = 10

#: Per-file ceiling on the *decoded* bytes. Frontend stops at 15 MB, so this only
#: bites a client that skips the check. Must stay in step with
#: app.services.document_parser.MAX_ATTACHMENT_BYTES, which is the place the
#: estimate is actually enforced before base64 is decoded.
MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

#: Ceiling on the decoded bytes of all attachments combined. This is the limit that
#: actually protects the process: the prompt assembly concatenates every document's
#: extracted text and every image becomes an inline data URI in the payload.
MAX_TOTAL_ATTACHMENT_BYTES = 40 * 1024 * 1024


class AttachmentPayload(BaseModel):
    # No `type` field: the backend infers image-vs-document from mime_type and the
    # filename extension (document_parser.parse_bytes), so a client-supplied type
    # was never read. The frontend still sends it and Pydantic ignores extras.
    name: str = Field(max_length=255)
    mime_type: Optional[str] = Field(default="application/octet-stream", max_length=120)
    data_url: str  # base64 data url: "data:...;base64,..."


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = Field(default=None, max_length=36)
    message: str
    # 100/50 match the Conversation.model column and the SUPPORTED_PROVIDERS
    # names. temperature 0-2 matches what every provider accepts.
    model: Optional[str] = Field(default=None, max_length=100)
    provider: Optional[str] = Field(default=None, max_length=50)
    # No `stream` field: this endpoint is unconditionally an SSE stream, and the
    # flag was accepted and ignored. Clients that want a one-off answer use the
    # model adapter's complete() path, not this one.
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
        """Reject an over-budget attachment set before anything is decoded.

        Sizes are derived from the *encoded* length, so this costs a string scan and
        allocates nothing. It runs at validation time, which is the earliest point
        that still has the whole request in hand — the alternative (checking inside
        the handler) would already have paid for the JSON parse of a multi-megabyte
        data URL.

        Note this is a correctness gate, not the memory gate: the request body has
        necessarily already been read into memory by the time Pydantic sees it. The
        body-size middleware in app.main is what actually stops the process from
        being handed a 500 MB payload.
        """
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
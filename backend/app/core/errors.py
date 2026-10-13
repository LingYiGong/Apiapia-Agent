"""带错误码的 HTTP 异常。

此前抛错处写的是 ``HTTPException(detail="图片不存在")`` —— 一句写死的
中文字符串。带来的问题有三个：

1. **无法本地化。** 前端把 ``err.message`` 直接弹进 toast，英文用户会看到中文。
2. **无法聚合。** 日志与监控只能按字符串匹配，而字符串里往往带着用户名、
   模型 id 这类变量，压根匹配不上。
3. **写死措辞。** 「Memory not found」和「图片不存在」并存，说明这份文案
   早已没人统一维护过。

现在抛错只声明**码**与**参数**：

    raise ApiError(404, "PINNED_IDS_UNKNOWN", ids=", ".join(missing))

文案在 ``app/core/messages.py`` 里按请求语言查，响应体额外带一个 ``code``
字段供前端二次本地化与日志聚合。

刻意做成 HTTPException 的子类而不是自定义异常：FastAPI 自带的
``http_exception_handler`` 会照常把它渲染成 ``{"detail": ...}``，前端
现有的解析路径一行都不用改，我们只需要在那个 handler 里补一个 ``code``。
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.core.i18n import tr


class ApiError(HTTPException):
    """按错误码本地化的 HTTP 异常。

    ``code`` 会随响应体一起返回（见 ``install_error_handler``）。
    没有稳定错误码的偶发错误仍然直接用 ``HTTPException`` —— 给它们硬凑一个
    码反而会让监控里的错误分类失真。
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        *,
        headers: dict[str, str] | None = None,
        **params: Any,
    ) -> None:
        super().__init__(status_code=status_code, detail=tr(code, **params), headers=headers)
        self.code = code
        self.params = params


def install_error_handler(app: Any) -> None:
    """给 app 注册一个 HTTPException 处理器，补上 ``code`` 字段。

    覆盖 FastAPI 默认的 ``http_exception_handler``。默认实现只输出
    ``{"detail": ...}``；这里在 ``detail`` 是字符串且异常带 ``code`` 时
    多输出一个 ``code``，其余情况（detail 是校验错误数组、重定向触发的
    ``HTTPException``）原样透传。

    刻意**不**替换成自定义的 Exception 兜底：默认处理器对
    ``headers`` 的处理（``WWW-Authenticate`` 等）是有意义的，那部分逻辑
    直接复用 ``fastapi.exception_handlers.http_exception_handler``。
    """

    from fastapi.exception_handlers import http_exception_handler
    from starlette.requests import Request
    from starlette.responses import JSONResponse

    @app.exception_handler(HTTPException)
    async def _handler(request: Request, exc: HTTPException):  # type: ignore[no-untyped-def]
        response = await http_exception_handler(request, exc)
        code = getattr(exc, "code", None)
        if code and isinstance(response, JSONResponse):
            # JSONResponse 的 body 已经编码成 bytes；重新构造比反解 JSON 更便宜，
            # 也避免了非 JSON 的 detail（如纯文本）被误判。
            import json

            try:
                payload = json.loads(bytes(response.body).decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                return response
            if isinstance(payload, dict):
                payload["code"] = code
                return JSONResponse(
                    status_code=response.status_code,
                    content=payload,
                    headers=dict(response.headers),
                )
        return response
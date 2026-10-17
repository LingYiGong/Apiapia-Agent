"""带错误码与本地化文案支持的 HTTP 异常。"""

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
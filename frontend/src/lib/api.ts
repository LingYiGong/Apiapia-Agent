import { acceptLanguageHeader, getTranslator, resolveStoredLocale } from "@/i18n/runtime";

export function getApiBase(): string {
  // SSR / 构建期：可以直接指向内网地址。
  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_URL || "http://backend:8000/api";
  }

  /*
   * 浏览器端 base URL 的选择 —— 两种部署形态，取决于有没有同源代理。
   *
   * A. 有 Node 服务（Docker / next start，`output: "standalone"`）
   *    src/app/api/backend/[...path]/route.ts 这个代理路由存在，
   *    走同源 /api/backend。后端地址不暴露在产物里，且天然无 CORS。
   *
   * B. 纯静态（Cloudflare Pages，`output: "export"`）
   *    scripts/build-runner.js 在导出前会把整个 src/app/api 改名移走
   *    （日志："Temporarily bypassed server-side route handlers"），
   *    所以代理路由**不存在**，同源 /api/backend 必然 404。
   *    此时必须直连后端绝对地址，并依赖后端的 CORS 放行前端域名。
   *
   * 此前无论哪种部署都返回 "/api/backend"，于是 Cloudflare 上的部署
   * 整体不可用 —— 而它此前是能用的，因为那时这段代码还会读
   * NEXT_PUBLIC_API_URL。
   *
   * 判定用「trim 后非空」：docker-compose 默认注入的是空串占位
   * （${NEXT_PUBLIC_API_URL:-}），空串会被当成「没配置」而正确回退到代理。
   */
  const directUrl = process.env.NEXT_PUBLIC_API_URL || "";

  if (directUrl.trim()) {
    // 去掉尾部斜杠，避免拼出 //api/xxx
    return directUrl.trim().replace(/\/+$/, "");
  }

  return "/api/backend";
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
}

export function removeToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
}

/**
 * URL for a persisted generated image.
 *
 * The JWT travels as a query parameter because an <img src> request cannot carry
 * an Authorization header, and lazy loading requires a plain URL. The backend
 * responds with Referrer-Policy: no-referrer so the token cannot leak.
 */
export function getMediaImageUrl(imageId: string, download = false): string {
  const base = getApiBase();
  const token = getToken();
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (download) params.set("download", "1");
  const qs = params.toString();
  return `${base}/media/images/${imageId}${qs ? `?${qs}` : ""}`;
}

/**
 * URL for a persisted generated video.
 */
export function getMediaVideoUrl(videoId: string, download = false): string {
  const base = getApiBase();
  const token = getToken();
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (download) params.set("download", "1");
  const qs = params.toString();
  return `${base}/media/videos/${videoId}${qs ? `?${qs}` : ""}`;
}

/**
 * Error carrying the HTTP status, so callers can tell an auth failure apart
 * from a transient one. A bare `Error` is deliberately left ambiguous: network
 * failures reject with a `TypeError` before any status exists, so
 * `err instanceof ApiError` is the reliable "we got a response" test.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * 会话失效的统一处理。
 *
 * apiRequest 与 streamChatResponse 都必须在 401 时走这里。此前只有 apiRequest
 * 做了，于是**流式请求期间的会话过期**不会跳登录，而是让页面弹一个红色错误
 * 气泡、把用户困在一个已经无法工作的界面里。
 */
function handleUnauthorized() {
  removeToken();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

/**
 * 后端错误消息的本地化靠标准请求头完成。
 *
 * 必须**每次请求都带**：语言存在 localStorage，不在 URL 里，所以后端无从
 * 得知，只能由客户端声明。用 `Accept-Language` 而不是自定义头，是为了让
 * 搜索引擎、CDN，以及任何将来绕过本项目前端的调用方都能得到正确语言，
 * 而不是默认落回中文。
 */
function localeHeaders(headers: Headers): void {
  // 无 token 时不要发空的 Authorization 头 —— 空字符串会被 /api/backend 代理
  // 原样转发给后端，某些网关会把 "" 当成一个格式非法的凭据而直接 400。
  // （这条判断原本散在两个函数里，各写一遍；这里统一收口。）
  headers.set("Accept-Language", acceptLanguageHeader());
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  localeHeaders(headers);

  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    handleUnauthorized();
    throw new ApiError("Unauthorized", 401);
  }

  if (!response.ok) {
    let errorMsg = `API request failed with status ${response.status}`;
    try {
      const err = await response.json();
      // 后端按 Accept-Language 查好的文案就在 detail 里，直接展示即可。
      // code 仅用于日志与错误聚类 —— 前端**不**再维护一份错误文案表，
      // 两边各存一份必然漂移，而漂移出来的表现是「英文界面弹出一条中文错误」。
      if (err.code) {
        console.warn(`[api] ${response.status} ${err.code}: ${errorMsg}`);
      }
      errorMsg = err.detail || err.message || errorMsg;
    } catch (_) {}
    throw new ApiError(errorMsg, response.status);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

import { AttachmentItem, SearchResultItem, ToolInvocation, GeneratedImage, GeneratedVideo } from "../types";

/**
 * Handle Server-Sent Events (SSE) streaming for chat
 */
export async function streamChatResponse(
  payload: {
    conversation_id?: string;
    message: string;
    model?: string;
    provider?: string;
    temperature?: number;
    max_tokens?: number;
    reasoning_effort?: string;
    system_prompt_override?: string;
    quoted_message_id?: string;
    quoted_content?: string;
    memory_enabled?: boolean;
    memory_score_threshold?: number;
    web_search_mode?: "auto" | "on" | "off";
    image_gen_mode?: boolean;
    video_gen_mode?: boolean;
    single_turn_mode?: boolean;
    attachments?: AttachmentItem[];
  },
  callbacks: {
    onMeta?: (meta: {
      conversation_id: string;
      user_message_id?: string;
      model: string;
      retrieved_memories: any[];
      search_query?: string | null;
    }) => void;
    onSearchStart?: (data: { query: string }) => void;
    onSearchResults?: (data: { query: string; results: SearchResultItem[] }) => void;
    onToolCall?: (data: { toolCallId: string; toolName: string; args: any }) => void;
    onToolResult?: (data: { toolCallId: string; result: any }) => void;
    onImageResult?: (data: { toolCallId: string; imageId?: string | null; url: string; prompt: string; provider: string; model: string }) => void;
    onVideoResult?: (data: { toolCallId: string; videoId?: string | null; prompt: string; provider: string; model: string }) => void;
    onToken?: (token: string) => void;
    onError?: (error: string, info?: { finishReason?: "stop" | "abort" | "error" | "length" | "content_filter" | (string & {}) }) => void;
    onDone?: (doneMeta: {
      conversation_id: string;
      /** Server-assigned id of the persisted assistant row; powers regenerate/delete. */
      message_id?: string | null;
      model?: string;
      duration_ms?: number;
      thinking_duration_ms?: number;
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      created_at?: string;
      search_results?: SearchResultItem[];
      search_query?: string | null;
      finish_reason?: "stop" | "abort" | "error" | "length" | "content_filter" | (string & {});
      tool_invocations?: ToolInvocation[];
      generated_images?: GeneratedImage[];
      generated_videos?: GeneratedVideo[];
    }) => void;

  },
  opts?: {
    signal?: AbortSignal;
  }
) {
  const token = getToken();
  const base = getApiBase();
  const url = `${base}/chat`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept-Language": acceptLanguageHeader(),
  };
  // 无 token 时不要发空的 Authorization 头 —— 空字符串会被 /api/backend 代理
  // 原样转发给后端，某些网关会把 "" 当成一个格式非法的凭据而直接 400。
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: opts?.signal,
  });

  // 与 apiRequest 对齐：HTTP 失败必须抛，而不是「回调 onError 后静默 return」。
  //
  // 此前这里是 onError + return，Promise 正常 resolve，于是调用方的 catch 分支
  // 对任何 HTTP 错误都不可达 —— 错误只能靠 onError 回调这一条路走；而 onError 的
  // 实现（chat/page.tsx）又会往消息列表里插一条错误气泡，和 catch 里的处理
  // 职责重叠。抛出来之后，统一的 catch 能同时负责「插错误气泡 + 复位流式状态」，
  // 401 也能统一跳登录。
  if (response.status === 401) {
    handleUnauthorized();
    throw new ApiError("Unauthorized", 401);
  }

  if (!response.ok) {
    let errorText = `Error: ${response.status} ${response.statusText}`;
    try {
      const raw = await response.text();
      if (raw) {
        // 后端错误体通常是 {"detail": "..."}，但也有纯文本。
        try {
          const parsed = JSON.parse(raw);
          errorText = parsed?.detail || parsed?.message || raw;
        } catch (_) {
          errorText = raw;
        }
      }
    } catch (_) {}
    throw new ApiError(errorText, response.status);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(getTranslator(resolveStoredLocale())("chat.message.streamUnsupported"));
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let eventData: string[] = [];
  let sawDone = false;
  let sawError = false;

  // Parse the WHATWG/HTML SSE wire format instead of assuming one JSON event
  // per network chunk. Events may be split across chunks and data may span
  // multiple lines. See MDN's SSE event stream format.
  let streamInThinking = false;
  const dispatchEvent = () => {
    if (eventData.length === 0) {
      eventName = "";
      return;
    }
    const dataStr = eventData.join("\n");
    eventData = [];
    const type = eventName || "message";
    eventName = "";
    try {
      const parsed = JSON.parse(dataStr);
      if (parsed.type === "meta") {
        callbacks.onMeta?.(parsed);
      } else if (parsed.type === "search_start") {
        callbacks.onSearchStart?.(parsed);
      } else if (parsed.type === "search_results") {
        callbacks.onSearchResults?.(parsed);
      } else if (parsed.type === "tool_call") {
        callbacks.onToolCall?.(parsed);
      } else if (parsed.type === "tool_result") {
        callbacks.onToolResult?.(parsed);
      } else if (parsed.type === "image_result") {
        callbacks.onImageResult?.(parsed);
      } else if (parsed.type === "video_result") {
        callbacks.onVideoResult?.(parsed);
      } else if (parsed.type === "reasoning") {
        if (typeof parsed.delta === "string") {
          if (!streamInThinking) {
            streamInThinking = true;
            callbacks.onToken?.("<think>\n");
          }
          callbacks.onToken?.(parsed.delta);
        }
      } else if (parsed.type === "content") {
        if (streamInThinking) {
          streamInThinking = false;
          callbacks.onToken?.("\n</think>\n\n");
        }
        if (typeof parsed.delta === "string") callbacks.onToken?.(parsed.delta);
      } else if (parsed.type === "done") {
        if (streamInThinking) {
          streamInThinking = false;
          callbacks.onToken?.("\n</think>\n\n");
        }
        sawDone = true;
        callbacks.onDone?.(parsed);
      } else if (parsed.type === "error") {
        if (streamInThinking) {
          streamInThinking = false;
          callbacks.onToken?.("\n</think>\n\n");
        }
        sawError = true;
        callbacks.onError?.(parsed.error || getTranslator(resolveStoredLocale())("chat.message.modelStreamFailed"), {
          finishReason: parsed.finish_reason,
        });
      }
    } catch (e) {
      console.error(`Failed to parse SSE ${type} JSON:`, dataStr, e);
    }
  };


  const consumeText = (text: string, flush = false) => {
    buffer += text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line === "") {
        dispatchEvent();
        continue;
      }
      if (line.startsWith(":")) continue; // SSE keep-alive comment
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") eventName = value;
      else if (field === "data") eventData.push(value);
      // id/retry are valid SSE fields but are not needed for this POST stream.
    }
    if (flush) {
      if (buffer) {
        const line = buffer;
        buffer = "";
        if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          let value = colon === -1 ? "" : line.slice(colon + 1);
          if (value.startsWith(" ")) value = value.slice(1);
          if (field === "event") eventName = value;
          else if (field === "data") eventData.push(value);
        }
      }
      dispatchEvent();
    }
  };

  try {
    while (true) {
      if (opts?.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) {
        consumeText(decoder.decode(), true);
        break;
      }
      consumeText(decoder.decode(value, { stream: true }));
    }
    if (!sawDone && !sawError && !opts?.signal?.aborted) {
      callbacks.onError?.(getTranslator(resolveStoredLocale())("chat.message.streamInterrupted"));
    }
  } catch (e: any) {
    // Intentional stop via AbortController: exit silently without onError
    if (e?.name === "AbortError" || opts?.signal?.aborted) {
      try {
        reader.cancel();
      } catch (_) {}
      return;
    }
    throw e;
  }
}

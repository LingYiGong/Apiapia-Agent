export function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }
  // In the browser, always use the relative path proxy '/api/backend'
  // so requests always hit the current server without CORS or IP hardcoding
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.INTERNAL_API_URL || "http://backend:8000/api";
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

  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError("Unauthorized", 401);
  }

  if (!response.ok) {
    let errorMsg = `API request failed with status ${response.status}`;
    try {
      const err = await response.json();
      errorMsg = err.detail || err.message || errorMsg;
    } catch (_) {}
    throw new ApiError(errorMsg, response.status);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

import { AttachmentItem, SearchResultItem, ToolInvocation, GeneratedImage } from "../types";

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
    memory_enabled?: boolean;
    web_search_mode?: "auto" | "on" | "off";
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
    onToken?: (token: string) => void;
    onError?: (error: string, info?: { finishReason?: "stop" | "abort" | "error" }) => void;
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
      finish_reason?: "stop" | "abort" | "error";
      tool_invocations?: ToolInvocation[];
      generated_images?: GeneratedImage[];
    }) => void;
  },
  opts?: {
    signal?: AbortSignal;
  }
) {
  const token = getToken();
  const base = getApiBase();
  const url = `${base}/chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(payload),
    signal: opts?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    callbacks.onError?.(errorText || `Error: ${response.statusText}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.("ReadableStream not supported by browser.");
    return;
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
      } else if (parsed.type === "content") {
        if (typeof parsed.delta === "string") callbacks.onToken?.(parsed.delta);
      } else if (parsed.type === "reasoning") {
        if (typeof parsed.delta === "string") callbacks.onToken?.(`<think>${parsed.delta}</think>`);
      } else if (parsed.type === "done") {
        sawDone = true;
        callbacks.onDone?.(parsed);
      } else if (parsed.type === "error") {
        sawError = true;
        callbacks.onError?.(parsed.error || "Model stream failed.", {
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
      callbacks.onError?.("模型连接在完成事件前中断，回答可能不完整。 ");
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

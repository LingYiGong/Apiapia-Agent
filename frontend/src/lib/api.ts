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
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    let errorMsg = `API request failed with status ${response.status}`;
    try {
      const err = await response.json();
      errorMsg = err.detail || err.message || errorMsg;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

import { AttachmentItem, SearchResultItem } from "../types";

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
    onMeta?: (meta: { conversation_id: string; model: string; retrieved_memories: any[] }) => void;
    onSearchStart?: (data: { query: string }) => void;
    onSearchResults?: (data: { query: string; results: SearchResultItem[] }) => void;
    onToken?: (token: string) => void;
    onError?: (error: string) => void;
    onDone?: (doneMeta: {
      conversation_id: string;
      model?: string;
      duration_ms?: number;
      thinking_duration_ms?: number;
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      created_at?: string;
      search_results?: SearchResultItem[];
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

  try {
    while (true) {
      if (opts?.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const dataStr = trimmed.replace(/^data:\s*/, "");
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.type === "meta") {
          callbacks.onMeta?.(parsed);
        } else if (parsed.type === "search_start") {
          callbacks.onSearchStart?.(parsed);
        } else if (parsed.type === "search_results") {
          callbacks.onSearchResults?.(parsed);
        } else if (parsed.type === "content") {
          callbacks.onToken?.(parsed.delta);
        } else if (parsed.type === "done") {
          callbacks.onDone?.(parsed);
        } else if (parsed.type === "error") {
          callbacks.onError?.(parsed.error);
        }
      } catch (e) {
        console.error("Failed to parse SSE JSON:", dataStr, e);
      }
    }
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

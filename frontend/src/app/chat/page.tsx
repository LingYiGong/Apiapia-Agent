"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest, streamChatResponse } from "@/lib/api";
import { DesktopNavbar, MobileTabBar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { MobileChatHeader, DesktopChatHeader } from "@/components/chat/ChatHeader";
import { ChatArea } from "@/components/chat/ChatArea";
import { MemorySidebar } from "@/components/chat/MemorySidebar";
import { MobileHistoryView } from "@/components/chat/MobileHistoryView";
import { MemoryView } from "@/components/memory/MemoryView";
import { UsageView } from "@/components/usage/UsageView";
import { SettingsView } from "@/components/settings/SettingsView";
import { MobileTab } from "@/components/layout/UserAvatarDropdown";
import { toast } from "sonner";
import { notifyModelSyncResult } from "@/lib/feedback";
import { useRefreshOnResume } from "@/lib/useRefreshOnResume";
import { messageEditingRef } from "@/lib/messageEditGuard";
import { FullPageSkeleton } from "@/components/common/PageSkeleton";
import { Conversation, Message, ModelCatalogItem, AttachmentItem, SearchResultItem, ToolInvocation, GeneratedImage } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Rehydrate everything the backend persisted alongside the reply text.
 *
 * The streaming path already holds these in memory, but after a reload only the
 * raw JSON columns are available, so they have to be parsed back into cards.
 * Aborted turns keep their partial text plus finish_reason, which is what makes
 * a stopped answer distinguishable from a complete one after a refresh.
 */
function hydrateMessage(msg: Message): Message {
  if (!msg.generated_images && !msg.tool_invocations) return msg;
  const next: Message = { ...msg };

  if (!next.generatedImages && msg.generated_images) {
    try {
      const raw = typeof msg.generated_images === "string"
        ? JSON.parse(msg.generated_images)
        : msg.generated_images;
      if (Array.isArray(raw) && raw.length > 0) {
        next.generatedImages = raw as GeneratedImage[];
      }
    } catch (err) {
      console.warn("Failed to parse generated_images for message", msg.id, err);
    }
  }

  if (!next.toolInvocations && msg.tool_invocations) {
    try {
      const raw = typeof msg.tool_invocations === "string"
        ? JSON.parse(msg.tool_invocations)
        : msg.tool_invocations;
      if (Array.isArray(raw) && raw.length > 0) {
        next.toolInvocations = raw as ToolInvocation[];
      }
    } catch (err) {
      console.warn("Failed to parse tool_invocations for message", msg.id, err);
    }
  }

  return next;
}

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Mirrors `messages` so callbacks can read the current list without being
  // re-created on every render.
  const messagesRef = useRef<Message[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [currentModel, setCurrentModel] = useState("openrouter/free");
  const defaultModelRef = useRef<string>("openrouter/free");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [retrievedMemories, setRetrievedMemories] = useState<any[]>([]);

  // Mobile SPA Tab State: "chat" | "history" | "memory" | "usage" | "settings"
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  // Web search state: "auto" (default, smart auto-trigger) | "on" (force on) | "off" (disabled)
  // Server-side so the preference follows the account across devices; the
  // localStorage mirror is only a fallback for the very first paint.
  const [webSearchMode, setWebSearchMode] = useState<"auto" | "on" | "off">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("apiapia_web_search_mode") as "auto" | "on" | "off" | null;
      if (saved && ["auto", "on", "off"].includes(saved)) return saved;
    }
    return "auto";
  });
  const webSearchModeRef = useRef<"auto" | "on" | "off">(webSearchMode);

  const handleToggleWebSearchMode = () => {
    setWebSearchMode((prev) => {
      const next = prev === "auto" ? "on" : prev === "on" ? "off" : "auto";
      webSearchModeRef.current = next;
      try {
        localStorage.setItem("apiapia_web_search_mode", next);
      } catch (e) {}
      // Persist to the account so it survives a device change.
      apiRequest("/settings", {
        method: "PATCH",
        body: JSON.stringify({ web_search_mode: next }),
      }).catch(() => {
        /* preference still applies locally */
      });

      if (next === "on") {
        toast.success("🌐 联网检索：强制开启", {
          description: "每次提问都将强制检索互联网最新信息",
          duration: 2200,
        });
      } else if (next === "off") {
        toast.warning("🌐 联网检索：已关闭", {
          description: "仅使用模型自身知识回答，不联网搜索",
          duration: 2200,
        });
      } else {
        toast.info("🌐 联网检索：智能自动", {
          description: "系统将根据问题自动判断是否全网搜索",
          duration: 2200,
        });
      }

      return next;
    });
  };

  const [searchStatus, setSearchStatus] = useState<{
    state: "idle" | "searching" | "done";
    query?: string;
    count?: number;
  }>({ state: "idle" });
  const [streamingSearchResults, setStreamingSearchResults] = useState<SearchResultItem[] | null>(null);
  const currentSearchResultsRef = useRef<SearchResultItem[] | null>(null);
  const currentToolInvocationsRef = useRef<ToolInvocation[]>([]);
  const currentGeneratedImagesRef = useRef<import("@/types").GeneratedImage[]>([]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Typewriter & Live Timer Refs
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const firstTokenTimeRef = useRef<number | null>(null);
  const targetContentRef = useRef<string>("");
  const displayedContentRef = useRef<string>("");
  const isStreamCompletedRef = useRef<boolean>(false);
  const doneMetaRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
    };
  }, []);

  const [isMemoryOpen, setIsMemoryOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // SPA 路由同步：在移动端或 URL 带有 ?tab= 时，自动还原至对应的标签页
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as MobileTab | null;
      if (tab && ["chat", "history", "memory", "usage", "settings"].includes(tab)) {
        setMobileTab(tab);
      } else if (params.get("openHistory") === "1") {
        setMobileTab("history");
      }
    }
  }, []);

  const handleSelectMobileTab = (tab: MobileTab) => {
    setMobileTab(tab);
    if (typeof window !== "undefined") {
      const url = tab === "chat" ? "/chat" : `/chat?tab=${tab}`;
      window.history.replaceState(null, "", url);
    }
  };

  const handleModelChange = async (newModel: string) => {
    setCurrentModel(newModel);
    try {
      localStorage.setItem("apiapia_preferred_model", newModel);
    } catch (e) {}

    // If currently inside an active conversation, update it in DB and local state
    if (activeIdRef.current) {
      const convId = activeIdRef.current;
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, model: newModel } : c))
      );
      try {
        await apiRequest(`/conversations/${convId}`, {
          method: "PATCH",
          body: JSON.stringify({ model: newModel }),
        });
      } catch (err) {
        console.error("Failed to update conversation model in DB:", err);
      }
    }
  };

  // Load conversations & settings
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const loadConversations = async (autoSelectFirst = false) => {
    try {
      const list = await apiRequest<Conversation[]>("/conversations");
      setConversations(list);
      if (autoSelectFirst && list.length > 0 && !activeIdRef.current) {
        selectConversation(list[0].id, list);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  // Dynamically load ONLY models that have active API keys in backend or DB
  const loadConfiguredModels = async () => {
    setIsRefreshingModels(true);
    try {
      const [res, settings] = await Promise.all([
        apiRequest<{ active_providers: string[]; total: number; models: ModelCatalogItem[] }>("/models/configured"),
        apiRequest<any>("/settings"),
      ]);

      const models = res?.models || [];
      setAvailableModels(models);

      // Update default model ref from settings
      const userDef = settings?.default_model;
      if (userDef) {
        defaultModelRef.current = userDef;
      }

      // Server-side web search preference wins over the local mirror.
      const serverMode = settings?.web_search_mode;
      if (serverMode && ["auto", "on", "off"].includes(serverMode)) {
        webSearchModeRef.current = serverMode;
        setWebSearchMode(serverMode);
        try { localStorage.setItem("apiapia_web_search_mode", serverMode); } catch (e) {}
      }

      // Choose active model
      if (models.length > 0) {
        if (!activeIdRef.current) {
          // Fresh new chat: ALWAYS prioritize user's configured default model or openrouter/free
          if (userDef && models.some((m) => m.id === userDef)) {
            setCurrentModel(userDef);
            try { localStorage.setItem("apiapia_preferred_model", userDef); } catch (e) {}
          } else if (models.some((m) => m.id === "openrouter/free")) {
            setCurrentModel("openrouter/free");
            try { localStorage.setItem("apiapia_preferred_model", "openrouter/free"); } catch (e) {}
          } else if (!models.some((m) => m.id === currentModel)) {
            setCurrentModel(models[0].id);
          }
        } else {
          // Inside existing conversation: only fallback if current model is invalid
          if (!models.some((m) => m.id === currentModel)) {
            const fallback = (userDef && models.some((m) => m.id === userDef))
              ? userDef
              : (models.some((m) => m.id === "openrouter/free") ? "openrouter/free" : models[0].id);
            setCurrentModel(fallback);
          }
        }
      }

      if (typeof settings?.memory_enabled === "boolean") {
        setMemoryEnabled(settings.memory_enabled);
      }
    } catch (err) {
      console.error("Failed to load configured models:", err);
    } finally {
      setIsRefreshingModels(false);
    }
  };

  const handleManualSyncModels = async () => {
    setIsRefreshingModels(true);
    try {
      const syncRes = await apiRequest<{
        success: boolean;
        new_count: number;
        new_models: ModelCatalogItem[];
        message: string;
      }>("/models/sync", { method: "POST" });

      await loadConfiguredModels();

      notifyModelSyncResult({ scope: "语言模型", newCount: syncRes.new_count || 0, message: syncRes.message });
    } catch (err: any) {
      console.error("Failed to sync models:", err);
      toast.error(err.message || "同步语言模型失败，请检查后台 .env 配置");
    } finally {
      setIsRefreshingModels(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadConversations(false);
      loadConfiguredModels();
    }
  }, [user]);

// ── 切后台 / 切页签回来后刷新 ──────────────────────────────────────
// 移动端切后台不会卸载页面，不主动重拉就会一直显示旧数据（必须杀进程才更新）。
// 这里刻意做「静默刷新」：不走 selectConversation，避免清空消息区、切页签、
// 以及覆盖掉刚刚流式生成出来的内容。
// 不用 useCallback —— useRefreshOnResume 内部用 ref 持有最新函数，无需稳定引用。
const refreshFromServer = async () => {
  await loadConversations(false);

  const id = activeIdRef.current;
  // 正在内联编辑某条消息时不要覆盖，否则用户没提交的内容会被冲掉。
  if (!id || messageEditingRef.current) return;

  try {
    const msgs = await apiRequest<Message[]>(`/conversations/${id}/messages`);
    if (activeIdRef.current === id) {
      setMessages((msgs || []).map(hydrateMessage));
    }
  } catch (err) {
    console.error("Failed to refresh conversation on resume:", err);
  }
};

  useRefreshOnResume(refreshFromServer, {
    enabled: !isStreaming && !regenerating,
    visible: mobileTab === "chat",
  });

  const selectConversation = async (id: string, customList?: Conversation[]) => {
    setActiveId(id);
    activeIdRef.current = id;
    setStreamingContent("");
    setRetrievedMemories([]);
    // 立刻清空旧消息，让右侧消息区显示骨架屏，而不是残留上一个会话的内容
    setMessages([]);
    setLoadingMessages(true);
    setMobileTab("chat");

    // Restore this conversation's saved model if present
    const targetConv = (customList || conversations).find((c) => c.id === id);
    if (targetConv?.model) {
      setCurrentModel(targetConv.model);
    }

    try {
      const [msgs, mems] = await Promise.all([
        apiRequest<Message[]>(`/conversations/${id}/messages`),
        apiRequest<any[]>(`/conversations/${id}/memories`).catch(() => []),
      ]);
      if (activeIdRef.current === id) {
        setMessages((msgs || []).map(hydrateMessage));
        if (mems && mems.length > 0) {
          setRetrievedMemories(mems);
        }
      }
    } catch (err) {
      console.error("Failed to load conversation details:", err);
    } finally {
      if (activeIdRef.current === id) {
        setLoadingMessages(false);
      }
    }
  };

  const handleNewChat = () => {
    setActiveId(null);
    activeIdRef.current = null;
    setMessages([]);
    setStreamingContent("");
    setRetrievedMemories([]);
    setLoadingMessages(false);
    setMobileTab("chat");

    // Always reset to user's configured default model from Settings!
    const userDef = defaultModelRef.current;
    if (userDef && availableModels.some((m) => m.id === userDef)) {
      setCurrentModel(userDef);
      try { localStorage.setItem("apiapia_preferred_model", userDef); } catch (e) {}
    } else if (availableModels.length > 0) {
      setCurrentModel(availableModels[0].id);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await apiRequest(`/conversations/${id}`, { method: "DELETE" });
      const updated = conversations.filter((c) => c.id !== id);
      setConversations(updated);
      // 删掉的正是当前选中会话时，只清空当前选中状态，
      // 不再自动切到别的会话，也不切换标签页 —— 用户应停留在历史页面。
      if (activeIdRef.current === id) {
        activeIdRef.current = null;
        setActiveId(null);
        setMessages([]);
        setStreamingContent("");
        setRetrievedMemories([]);
        setLoadingMessages(false);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const getPinnedSorted = (list: Conversation[]) =>
    list
      .filter((c) => c.is_pinned)
      .sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0));

  const handleTogglePin = async (id: string, nextPinned: boolean) => {
    const prev = conversations;
    // 乐观更新：置顶放到末尾，取消置顶直接去掉标记
    if (nextPinned) {
      const maxOrder = Math.max(-1, ...prev.filter((c) => c.is_pinned).map((c) => c.pin_order ?? 0));
      setConversations((list) =>
        list.map((c) => (c.id === id ? { ...c, is_pinned: true, pin_order: maxOrder + 1 } : c))
      );
    } else {
      setConversations((list) =>
        list.map((c) => (c.id === id ? { ...c, is_pinned: false, pin_order: 0 } : c))
      );
    }
    try {
      const updated = await apiRequest<Conversation>(`/conversations/${id}/pin`, {
        method: nextPinned ? "POST" : "DELETE",
      });
      setConversations((list) => list.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      setConversations(prev);
    }
  };

  const handleReorderPinned = async (orderedIds: string[]) => {
    const prev = conversations;
    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
    setConversations((list) =>
      list.map((c) => (orderMap.has(c.id) ? { ...c, pin_order: orderMap.get(c.id)! } : c))
    );
    try {
      const updated = await apiRequest<Conversation[]>(`/conversations/pinned/order`, {
        method: "PUT",
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      const updatedMap = new Map(updated.map((c) => [c.id, c]));
      setConversations((list) =>
        list.map((c) => (updatedMap.has(c.id) ? { ...c, ...updatedMap.get(c.id)! } : c))
      );
    } catch (err) {
      console.error("Failed to reorder pinned:", err);
      setConversations(prev);
    }
  };

  const handleMovePinned = (id: string, direction: "up" | "down") => {
    const pinned = getPinnedSorted(conversations);
    const idx = pinned.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= pinned.length) return;
    const ids = pinned.map((c) => c.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    handleReorderPinned(ids);
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    setConversations((list) =>
      list.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
    try {
      await apiRequest(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: newTitle }),
      });
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    }
  };

  const finalizeAssistantMessage = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }

    const doneMeta = doneMetaRef.current;
    const finalContent = targetContentRef.current || displayedContentRef.current;

    // Accurate thinking duration in milliseconds
    const finalThinkingMs =
      firstTokenTimeRef.current && startTimeRef.current
        ? Math.max(0, firstTokenTimeRef.current - startTimeRef.current)
        : doneMeta?.thinking_duration_ms || 0;

    const totalDurationMs =
      doneMeta?.duration_ms ||
      (startTimeRef.current ? Math.max(20, Date.now() - startTimeRef.current) : 0);

    const searchResults = currentSearchResultsRef.current || doneMeta?.search_results;
    const tools = currentToolInvocationsRef.current;
    const generatedImages = currentGeneratedImagesRef.current;
    const finishReason = doneMeta?.finish_reason || (stopRequestedRef.current ? "abort" : "stop");

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        id: doneMeta?.message_id,
        content: finalContent,
        model: doneMeta?.model || currentModel,
        duration_ms: totalDurationMs,
        thinking_duration_ms: finalThinkingMs,
        prompt_tokens: doneMeta?.prompt_tokens,
        completion_tokens: doneMeta?.completion_tokens,
        token_usage: doneMeta?.total_tokens,
        search_results: searchResults && searchResults.length > 0 ? searchResults : undefined,
        search_query: doneMeta?.search_query || undefined,
        toolInvocations: tools && tools.length > 0 ? [...tools] : undefined,
        generatedImages: generatedImages && generatedImages.length > 0 ? [...generatedImages] : undefined,
        finish_reason: finishReason,
        created_at: doneMeta?.created_at || new Date().toISOString(),
      },
    ]);

    setIsStreaming(false);
    setIsWaitingForFirstToken(false);
    setStreamingContent("");
    setSearchStatus({ state: "idle" });
    setStreamingSearchResults(null);
    currentSearchResultsRef.current = null;
    currentToolInvocationsRef.current = [];
    currentGeneratedImagesRef.current = [];
    targetContentRef.current = "";
    displayedContentRef.current = "";
    loadConversations(false);
  };

  const handleSendMessage = async (text: string, attachments?: AttachmentItem[]) => {
    // Clear any previous running intervals
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);

    // Add user message to UI immediately
    const userMsg: Message = {
      role: "user",
      content: text,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      model: currentModel,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    if (activeId) {
      const nowIso = new Date().toISOString();
      setConversations((list) =>
        list.map((c) => (c.id === activeId ? { ...c, last_message_at: nowIso } : c))
      );
    }

    // Reset states
    setIsStreaming(true);
    setIsWaitingForFirstToken(true);
    setStreamingContent("");
    setThinkingDuration(null);
    setElapsedTime(0);
    setSearchStatus({ state: "idle" });
    setStreamingSearchResults(null);
    currentSearchResultsRef.current = null;

    startTimeRef.current = Date.now();
    firstTokenTimeRef.current = null;
    targetContentRef.current = "";
    displayedContentRef.current = "";
    isStreamCompletedRef.current = false;
    doneMetaRef.current = null;
    stopRequestedRef.current = false;
    abortControllerRef.current = new AbortController();

    // Live waiting & duration timer (every 80ms)
    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setElapsedTime(elapsed);
    }, 80);

    // Smooth Typewriter animation loop (types out tokens character-by-character)
    typewriterIntervalRef.current = setInterval(() => {
      const target = targetContentRef.current;
      const current = displayedContentRef.current;
      const remaining = target.length - current.length;

      if (remaining > 0) {
        // Adaptive step size: smooth 1-by-1 typing when close, accelerates smoothly if buffer grows
        let step = 1;
        if (remaining > 60) {
          step = Math.min(remaining, Math.ceil(remaining / 6));
        } else if (remaining > 25) {
          step = 3;
        } else if (remaining > 8) {
          step = 2;
        }

        const nextContent = target.slice(0, current.length + step);
        displayedContentRef.current = nextContent;
        setStreamingContent(nextContent);
      } else if (isStreamCompletedRef.current) {
        // Stream completed and all buffered characters have typed out!
        finalizeAssistantMessage();
      }
    }, 20);

    try {
      await streamChatResponse(
        {
          conversation_id: activeId || undefined,
          message: text,
          model: currentModel,
          memory_enabled: memoryEnabled,
          web_search_mode: webSearchModeRef.current,
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
        },
        {
          onMeta: (meta) => {
            if (meta.conversation_id) {
              setActiveId(meta.conversation_id);
              activeIdRef.current = meta.conversation_id;
              loadConversations(false);
            }
            if (meta.retrieved_memories && meta.retrieved_memories.length > 0) {
              setRetrievedMemories(meta.retrieved_memories);
            }
            // Adopt the server-assigned id so per-message actions (edit,
            // regenerate, delete) work without waiting for a reload.
            if (meta.user_message_id) {
              setMessages((prev) => {
                for (let i = prev.length - 1; i >= 0; i--) {
                  if (prev[i].role === "user" && !prev[i].id) {
                    const next = prev.slice();
                    next[i] = { ...next[i], id: meta.user_message_id };
                    return next;
                  }
                }
                return prev;
              });
            }
          },
          onSearchStart: (data) => {
            setSearchStatus({ state: "searching", query: data.query });
          },
          onSearchResults: (data) => {
            currentSearchResultsRef.current = data.results;
            setStreamingSearchResults(data.results);
            setSearchStatus({
              state: "done",
              query: data.query,
              count: data.results?.length || 0,
            });
          },
          onToolCall: (data) => {
            currentToolInvocationsRef.current.push({
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: data.args,
              state: "call",
            });
          },
          onToolResult: (data) => {
            const idx = currentToolInvocationsRef.current.findIndex((t) => t.toolCallId === data.toolCallId);
            if (idx !== -1) {
              currentToolInvocationsRef.current[idx].state = "result";
              currentToolInvocationsRef.current[idx].result = data.result;
            }
          },
          onImageResult: (data) => {
            currentGeneratedImagesRef.current.push({
              id: data.imageId ?? undefined,
              url: data.url,
              prompt: data.prompt,
              provider: data.provider,
              model: data.model,
            });
          },
          onToken: (token) => {
            // Record Time to First Token (TTFT) when first chunk arrives
            if (firstTokenTimeRef.current === null) {
              firstTokenTimeRef.current = Date.now();
              setIsWaitingForFirstToken(false);
              const thinkSecs = (firstTokenTimeRef.current - startTimeRef.current) / 1000;
              setThinkingDuration(thinkSecs);
            }
            targetContentRef.current += token;
          },
          onError: (err) => {
            // Intentional stop: states already reset by handleStopGenerating
            if (stopRequestedRef.current) return;
            console.error("Stream error:", err);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
            setIsStreaming(false);
            setIsWaitingForFirstToken(false);
            setSearchStatus({ state: "idle" });
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: err || "❌ 后端未知错误，请检查服务器日志" },
            ]);
          },
          onDone: (doneMeta) => {
            isStreamCompletedRef.current = true;
            doneMetaRef.current = doneMeta;
            if (doneMeta.search_results && doneMeta.search_results.length > 0) {
              currentSearchResultsRef.current = doneMeta.search_results;
              setStreamingSearchResults(doneMeta.search_results);
            }

            // If typewriter has already caught up, finalize immediately
            if (targetContentRef.current.length === displayedContentRef.current.length) {
              finalizeAssistantMessage();
            }
          },
        },
        { signal: abortControllerRef.current?.signal }
      );
    } catch (err: any) {
      // Intentional stop: states already reset by handleStopGenerating, stay silent
      if (stopRequestedRef.current || abortControllerRef.current?.signal.aborted) {
        return;
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
      setIsStreaming(false);
      setIsWaitingForFirstToken(false);
      setSearchStatus({ state: "idle" });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ 网络连接失败: ${err?.message || err}` },
      ]);
    }
  };

  const handleStopGenerating = () => {
    if (!isStreaming) return;
    // Mark intentional stop so the pending stream promise stays silent
    stopRequestedRef.current = true;
    try {
      abortControllerRef.current?.abort();
    } catch (_) {}
    abortControllerRef.current = null;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }

    // The backend now persists the partial reply with finish_reason='abort', so
    // keep whatever was produced instead of discarding it.
    doneMetaRef.current = {
      finish_reason: "abort",
      created_at: new Date().toISOString(),
    };
    isStreamCompletedRef.current = true;

    finalizeAssistantMessage();
  };

  // ── Per-message actions (regenerate / edit) ─────────────────────────
  const handleEditMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!activeId || !messageId) return;
      const clean = newText.trim();
      if (!clean) {
        toast.error("消息内容不能为空");
        return;
      }
      try {
        // Removing this turn and everything after it rebuilds the branch, the
        // same way ChatGPT handles an edited prompt.
        await apiRequest(`/conversations/${activeId}/messages/${messageId}/truncate`, {
          method: "POST",
        });
        const kept = messagesRef.current.filter((m) => !(m.id === messageId));
        const cutIndex = messagesRef.current.findIndex((m) => m.id === messageId);
        setMessages(cutIndex >= 0 ? kept.slice(0, cutIndex) : kept);
        await handleSendMessage(clean);
      } catch (err: any) {
        toast.error(err.message || "编辑消息失败");
      }
    },
    // handleSendMessage intentionally omitted: it is recreated every render and
    // reads the latest refs, so capturing it would only pin a stale closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId],
  );

  const handleRegenerate = useCallback(
    async (assistantId: string) => {
      if (!activeId || isStreaming || !assistantId) return;

      const list = messagesRef.current;
      const idx = list.findIndex((m) => m.id === assistantId);
      if (idx < 0) return;

      // Walk back to the user turn that produced this reply.
      let userIdx = idx - 1;
      while (userIdx >= 0 && list[userIdx].role !== "user") userIdx--;
      if (userIdx < 0) {
        toast.error("找不到对应的提问，无法重新生成");
        return;
      }
      const prompt = list[userIdx].content;

      setRegenerating(true);
      try {
        await apiRequest(`/conversations/${activeId}/messages/${assistantId}`, {
          method: "DELETE",
        });
        setMessages(list.slice(0, idx));
        await handleSendMessage(prompt);
      } catch (err: any) {
        toast.error(err.message || "重新生成失败");
      } finally {
        setRegenerating(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, isStreaming],
  );

  if (loading || !user) {
    return <FullPageSkeleton variant="chat" />;
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* 桌面端顶部导航栏 */}
      <DesktopNavbar />

      {/* 中间主视口区域（自适应尺寸，不被任何固定栏遮盖） */}
      <div className="flex flex-1 overflow-hidden relative min-h-0">
<Sidebar
            conversations={conversations}
            activeId={activeId}
            onRename={handleRenameConversation}
          onSelect={(id) => {
            selectConversation(id);
            handleSelectMobileTab("chat");
          }}
          onNewChat={handleNewChat}
          onDelete={handleDeleteConversation}
          onTogglePin={handleTogglePin}
          onMovePinned={handleMovePinned}
          onReorderPinned={handleReorderPinned}
          isOpen={false}
          onClose={() => {}}
          loading={loadingConversations}
        />

        {/* ── Mobile Tab 2: Full-screen History View (Shown only on mobile when mobileTab === 'history') ── */}
        <div className={cn("flex-1 overflow-hidden relative", mobileTab === "history" ? "flex md:hidden" : "hidden")}>
          <MobileHistoryView
            conversations={conversations}
            activeId={activeId}
            isVisible={mobileTab === "history"}
            onSelect={(id) => {
              selectConversation(id);
              handleSelectMobileTab("chat");
            }}
            onNewChat={() => {
              handleNewChat();
              handleSelectMobileTab("chat");
            }}
            onDelete={handleDeleteConversation}
            onTogglePin={(id) => {
              const conv = conversations.find((c) => c.id === id);
              if (conv) {
                handleTogglePin(id, !conv.is_pinned);
              }
            }}
            onRename={handleRenameConversation}
            onMovePinned={handleMovePinned}
            onReorderPinned={handleReorderPinned}
            onSelectMobileTab={handleSelectMobileTab}
          />
        </div>

        {/* ── Mobile Tab 1: Chat View (On mobile shown when mobileTab === 'chat', on desktop always visible) ── */}
        <div className={cn("flex-1 flex flex-col overflow-hidden relative min-w-0 max-w-full", mobileTab === "chat" ? "flex" : "hidden md:flex")}>
          {/* 移动端专属导航条：对称置于 Tab 容器顶层，复用 MobileHeader */}
          <MobileChatHeader
            currentModel={currentModel}
            onModelChange={handleModelChange}
            availableModels={availableModels}
            onRefreshModels={handleManualSyncModels}
            isRefreshingModels={isRefreshingModels}
            onToggleMemory={() => setIsMemoryOpen((prev) => !prev)}
            memoriesCount={retrievedMemories.length}
            onNewChat={handleNewChat}
            hasMessages={messages.length > 0}
            onSelectMobileTab={handleSelectMobileTab}
          />

          {/* 桌面端专属工具条：仅在 md+ 桌面端显示，移动端完全不渲染 */}
          <DesktopChatHeader
            currentModel={currentModel}
            onModelChange={handleModelChange}
            availableModels={availableModels}
            onRefreshModels={handleManualSyncModels}
            isRefreshingModels={isRefreshingModels}
            onToggleSidebar={() => handleSelectMobileTab("history")}
            onToggleMemory={() => setIsMemoryOpen((prev) => !prev)}
            memoriesCount={retrievedMemories.length}
            onNewChat={handleNewChat}
          />

          {/* 纯粹的聊天窗口：消息流与输入交互 */}
          <ChatArea
            messages={messages}
            currentModel={currentModel}
            onSendMessage={handleSendMessage}
            onStopGenerating={handleStopGenerating}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            thinkingDuration={thinkingDuration}
            elapsedTime={elapsedTime}
            isWaitingForFirstToken={isWaitingForFirstToken}
            onNewChat={handleNewChat}
            webSearchMode={webSearchMode}
            onToggleWebSearchMode={handleToggleWebSearchMode}
            searchStatus={searchStatus}
            streamingSearchResults={streamingSearchResults}
            loadingMessages={loadingMessages}
            regenerating={regenerating}
            onRegenerate={handleRegenerate}
            onEditMessage={handleEditMessage}
          />
        </div>

        {/* ── Mobile Tab 3: Full-screen Memory View ── */}
        <div className={cn("flex-1 overflow-hidden relative", mobileTab === "memory" ? "flex md:hidden" : "hidden")}>
          <MemoryView
            isMobileSpa={true}
            onSelectMobileTab={handleSelectMobileTab}
            active={mobileTab === "memory"}
          />
        </div>

        {/* ── Mobile Tab 4: Full-screen Usage View ── */}
        <div className={cn("flex-1 overflow-hidden relative", mobileTab === "usage" ? "flex md:hidden" : "hidden")}>
          <UsageView
            isMobileSpa={true}
            onSelectMobileTab={handleSelectMobileTab}
            active={mobileTab === "usage"}
          />
        </div>

        {/* ── Mobile Tab 5: Full-screen Settings View ── */}
        <div className={cn("flex-1 overflow-hidden relative", mobileTab === "settings" ? "flex md:hidden" : "hidden")}>
          <SettingsView
            isMobileSpa={true}
            onSelectMobileTab={handleSelectMobileTab}
            active={mobileTab === "settings"}
          />
        </div>

        <MemorySidebar
          memories={retrievedMemories}
          memoryEnabled={memoryEnabled}
          onToggleMemory={() => setMemoryEnabled(!memoryEnabled)}
          isOpen={isMemoryOpen}
          onClose={() => setIsMemoryOpen(false)}
          onSelectMobileTab={() => handleSelectMobileTab("memory")}
        />
      </div>

      {/* 移动端底部标签栏：自然流式排布在容器最底端，零 fixed、零重叠遮挡！ */}
      <MobileTabBar
        hasActiveChat={messages.length > 0}
        activeMobileTab={mobileTab}
        onSelectMobileTab={handleSelectMobileTab}
        onNewChat={handleNewChat}
      />
    </div>
  );
}

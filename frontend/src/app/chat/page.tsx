"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest, streamChatResponse, ApiError } from "@/lib/api";
import { DesktopNavbar, MobileTabBar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { MobileChatHeader, DesktopChatHeader } from "@/components/chat/ChatHeader";
import { ChatArea } from "@/components/chat/ChatArea";
import { MemorySidebar } from "@/components/chat/MemorySidebar";
import { MobileHistoryView } from "@/components/chat/MobileHistoryView";
import { MemoryView } from "@/components/memory/MemoryView";
import { UsageView } from "@/components/usage/UsageView";
import { SettingsView } from "@/components/settings/SettingsView";
import { toast } from "sonner";
import { notifyModelSyncResult } from "@/lib/feedback";
import { useI18n } from "@/i18n";
import { buildVocabTutorPrompt } from "@/config/personas";
import { useRefreshOnResume } from "@/hooks/useRefreshOnResume";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWebSearchMode } from "@/hooks/useWebSearchMode";
import { messageEditGuardFlag } from "@/lib/messageEditGuard";
import { hydrateMessages } from "@/lib/message";
import { useIsKeyboardOpen } from "@/hooks/useIsKeyboardOpen";
import { cn } from "@/lib/utils";
import { FullPageSkeleton } from "@/components/common/PageSkeleton";
import {
  Conversation,
  Message,
  ModelCatalogItem,
  ImageModelItem,
  VideoModelItem,
  AttachmentItem,
  SearchResultItem,
  ToolInvocation,
} from "@/types";
import { parseMobileTab, NAV_ITEMS, type MobileTab } from "@/config/navigation";
import { isBelowMd } from "@/lib/mediaQuery";

interface ConversationInputState {
  isTranslateMode: boolean;
  vocabTargetLang: string;
  creationMode: "chat" | "image" | "video";
}

const getConversationInputStateKey = (id: string | null) => {
  return id ? `apiapia_chat_input_state:${id}` : "apiapia_chat_input_state:new";
};

const saveConversationInputState = (
  id: string | null,
  state: ConversationInputState
) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getConversationInputStateKey(id), JSON.stringify(state));
  } catch (_) {}
};

const loadConversationInputState = (
  id: string | null
): ConversationInputState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getConversationInputStateKey(id));
    if (raw) return JSON.parse(raw) as ConversationInputState;
  } catch (_) {}
  return null;
};

const detectInputStateFromMessages = (msgs: Message[]): ConversationInputState => {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i];
    if (!msg) continue;
    const content = msg.content || "";
    if (
      content.includes("```word") ||
      content.includes("```wordcard") ||
      content.includes("```vocab")
    ) {
      const match = content.match(/"language":\s*"([^"]+)"/);
      const targetLang = match ? match[1].toLowerCase() : "ja";
      return {
        isTranslateMode: true,
        vocabTargetLang: targetLang,
        creationMode: "chat",
      };
    }
    if (msg.generated_images || (msg.generatedImages && msg.generatedImages.length > 0)) {
      return {
        isTranslateMode: false,
        vocabTargetLang: "ja",
        creationMode: "image",
      };
    }
    if (msg.generated_videos || (msg.generatedVideos && msg.generatedVideos.length > 0)) {
      return {
        isTranslateMode: false,
        vocabTargetLang: "ja",
        creationMode: "video",
      };
    }
  }
  return {
    isTranslateMode: false,
    vocabTargetLang: "ja",
    creationMode: "chat",
  };
};

export default function ChatPage({
  initialConversationId,
}: {
  /** /chat/[id] 深链：挂载后自动打开指定会话 */
  initialConversationId?: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t, locale } = useI18n();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("");
  const defaultModelRef = useRef<string>("");
  const [imageModel, setImageModel] = useState<string>("dall-e-3");
  const [videoModel, setVideoModel] = useState<string>("");
  const [availableImageModels, setAvailableImageModels] = useState<ImageModelItem[]>([]);
  const [availableVideoModels, setAvailableVideoModels] = useState<VideoModelItem[]>([]);
  const [creationMode, setCreationMode] = useState<"chat" | "image" | "video">("chat");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [retrievedMemories, setRetrievedMemories] = useState<unknown[]>([]);

  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const isKeyboardOpen = useIsKeyboardOpen();

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isDesktopMemoryOpen, setIsDesktopMemoryOpen] = useState(false);

  useEffect(() => {
    try {
      const savedSidebar = localStorage.getItem("apiapia_desktop_sidebar_open");
      if (savedSidebar !== null) setIsDesktopSidebarOpen(savedSidebar === "true");
      const savedMemory = localStorage.getItem("apiapia_desktop_memory_open");
      if (savedMemory !== null) setIsDesktopMemoryOpen(savedMemory === "true");
    } catch (_) {}
  }, []);

  const handleToggleDesktopSidebar = useCallback(() => {
    setIsDesktopSidebarOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("apiapia_desktop_sidebar_open", String(next)); } catch (_) {}
      return next;
    });
  }, []);

  const handleToggleDesktopMemory = useCallback(() => {
    setIsDesktopMemoryOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("apiapia_desktop_memory_open", String(next)); } catch (_) {}
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggleDesktopSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleToggleDesktopSidebar]);

  const [isTranslateMode, setIsTranslateMode] = useState<boolean>(false);
  const [vocabTargetLang, setVocabTargetLang] = useState<string>("ja");

  const isTranslateModeRef = useRef(isTranslateMode);
  isTranslateModeRef.current = isTranslateMode;

  const vocabTargetLangRef = useRef(vocabTargetLang);
  vocabTargetLangRef.current = vocabTargetLang;

  const creationModeRef = useRef(creationMode);
  creationModeRef.current = creationMode;

  const handleToggleTranslateMode = (enabled: boolean) => {
    setIsTranslateMode(enabled);
    saveConversationInputState(activeIdRef.current, {
      isTranslateMode: enabled,
      vocabTargetLang: vocabTargetLangRef.current,
      creationMode: creationModeRef.current,
    });

    if (enabled && availableModels.length > 0) {
      // 开启翻译模式时，自动优先切换至极速推荐翻译模型：
      // 1. google/gemini-2.5-flash-lite
      // 2. openai/gpt-4o-mini
      const geminiExact = availableModels.find((m) => {
        const id = m.id.toLowerCase();
        return id === "google/gemini-2.5-flash-lite" || id.includes("gemini-2.5-flash-lite");
      });
      const openaiExact = availableModels.find((m) => {
        const id = m.id.toLowerCase();
        return id === "openai/gpt-4o-mini" || id.includes("gpt-4o-mini");
      });
      const geminiFallback = availableModels.find((m) => {
        const id = m.id.toLowerCase();
        return (id.includes("gemini") && (id.includes("flash") || id.includes("lite"))) ||
               (id.startsWith("google/") && id.includes("gemini"));
      });
      const bestModel = geminiExact || openaiExact || geminiFallback;
      if (bestModel && bestModel.id !== currentModel) {
        void handleModelChange(bestModel.id);
        toast.info(
          t("chat.translate.autoSwitchModel", { model: bestModel.name || bestModel.id })
        );
      }
    } else if (!enabled && availableModels.length > 0) {
      // 关闭翻译模式时，恢复用户配置的默认首选模型
      const userDef = defaultModelRef.current;
      const targetResetModel =
        userDef && availableModels.some((m) => m.id === userDef)
          ? userDef
          : availableModels.find((m) => m.is_default)?.id || availableModels[0]?.id;
      if (targetResetModel && targetResetModel !== currentModel) {
        void handleModelChange(targetResetModel);
        const modelObj = availableModels.find((m) => m.id === targetResetModel);
        toast.info(
          t("chat.translate.restoreModel", { model: modelObj?.name || targetResetModel })
        );
      }
    }
  };

  const handleSelectVocabLang = (lang: string) => {
    setVocabTargetLang(lang);
    saveConversationInputState(activeIdRef.current, {
      isTranslateMode: isTranslateModeRef.current,
      vocabTargetLang: lang,
      creationMode: creationModeRef.current,
    });
  };

  const handleSetCreationMode = (mode: "chat" | "image" | "video") => {
    setCreationMode(mode);
    saveConversationInputState(activeIdRef.current, {
      isTranslateMode: isTranslateModeRef.current,
      vocabTargetLang: vocabTargetLangRef.current,
      creationMode: mode,
    });
  };

  const webSearch = useWebSearchMode();

  const [searchStatus, setSearchStatus] = useState<{
    state: "idle" | "searching" | "done";
    query?: string;
    count?: number;
  }>({ state: "idle" });
  const [streamingSearchResults, setStreamingSearchResults] = useState<SearchResultItem[] | null>(null);
  const currentSearchResultsRef = useRef<SearchResultItem[] | null>(null);
  const currentToolInvocationsRef = useRef<ToolInvocation[]>([]);
  const currentGeneratedImagesRef = useRef<
    import("@/types").GeneratedImage[]
  >([]);
  const currentGeneratedVideosRef = useRef<
    import("@/types").GeneratedVideo[]
  >([]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);

  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const firstTokenTimeRef = useRef<number | null>(null);
  const targetContentRef = useRef<string>("");
  const displayedContentRef = useRef<string>("");
  const isStreamCompletedRef = useRef<boolean>(false);
  const doneMetaRef = useRef<any>(null);
  const currentStreamModelRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef<boolean>(false);
  const finalizedRef = useRef<boolean>(false);
  const streamSessionIdRef = useRef<number>(0);

  const clearStreamIntervals = () => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
  };

  const abortInFlightStream = () => {
    stopRequestedRef.current = true;
    try {
      abortControllerRef.current?.abort();
    } catch (_) {}
    abortControllerRef.current = null;
  };

  const resetStreamingState = useCallback(() => {
    // 递增 session 编号，使所有旧的异步回调、打字机定时器彻底作废
    streamSessionIdRef.current += 1;
    stopRequestedRef.current = true;

    try {
      abortControllerRef.current?.abort();
    } catch (_) {}
    abortControllerRef.current = null;

    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }

    targetContentRef.current = "";
    displayedContentRef.current = "";
    isStreamCompletedRef.current = false;
    doneMetaRef.current = null;
    firstTokenTimeRef.current = null;
    finalizedRef.current = false;
    currentSearchResultsRef.current = null;
    currentToolInvocationsRef.current = [];
    currentGeneratedImagesRef.current = [];
    currentGeneratedVideosRef.current = [];

    setIsStreaming(false);
    setIsWaitingForFirstToken(false);
    setStreamingContent("");
    setThinkingDuration(null);
    setStreamStartedAt(null);
    setSearchStatus({ state: "idle" });
    setStreamingSearchResults(null);
  }, []);

  useEffect(() => {
    return () => {
      resetStreamingState();
    };
  }, [resetStreamingState]);

  const [isMemoryOpen, setIsMemoryOpen] = useState(false);

  const handleToggleMemory = useCallback(() => {
    setIsMemoryOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = parseMobileTab(params.get("tab"));
    if (tab) {
      setMobileTab(tab);
    } else if (params.get("openHistory") === "1") {
      setMobileTab("history");
    }
  }, []);

  const handleSelectMobileTab = (tab: MobileTab) => {
    if (!isBelowMd()) {
      const target = NAV_ITEMS.find((i) => i.id === tab);
      if (target) router.push(target.href);
      return;
    }
    setMobileTab(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", tab === "chat" ? "/chat" : `/chat?tab=${tab}`);
    }
  };

  const handleModelChange = async (newModel: string) => {
    if (creationMode === "image") {
      setImageModel(newModel);
      try {
        void apiRequest("/settings", {
          method: "PATCH",
          body: JSON.stringify({ image_model: newModel }),
        });
      } catch (_) {}
      return;
    }

    if (creationMode === "video") {
      setVideoModel(newModel);
      try {
        void apiRequest("/settings", {
          method: "PATCH",
          body: JSON.stringify({ video_model: newModel }),
        });
      } catch (_) {}
      return;
    }

    setCurrentModel(newModel);
    try {
      localStorage.setItem("apiapia_preferred_model", newModel);
    } catch (_) {}

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

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadConversations = async () => {
    // 首屏该打开哪一条由下面的 activeId 恢复逻辑负责，这里只负责把列表拉回来。
    try {
      const list = await apiRequest<Conversation[]>("/conversations");
      setConversations(list);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  /**
   * Pull every model catalog down.
   *
   * Returns the resulting per-family counts (or null on failure) so the sync
   * handler can tell "nothing new" apart from "the list came back empty" — a
   * distinction the response state alone cannot make, because both leave the
   * picker unchanged from the user's point of view.
   */
  const loadConfiguredModels = async (): Promise<{
    chat: number;
    image: number;
    video: number;
  } | null> => {
    setIsRefreshingModels(true);
    try {
      const [res, settings, imageModelsRes, videoModelsRes] = await Promise.all([
        apiRequest<{ active_providers: string[]; total: number; models: ModelCatalogItem[]; default_model?: string }>(
          "/models/configured"
        ),
        apiRequest<any>("/settings"),
        apiRequest<{ models: ImageModelItem[] }>("/models/image-models").catch(() => null),
        apiRequest<{ models: VideoModelItem[] }>("/models/video-models").catch(() => null),
      ]);

      const models = res?.models || [];
      setAvailableModels(models);

      if (imageModelsRes?.models) {
        setAvailableImageModels(imageModelsRes.models);
      }
      if (videoModelsRes?.models) {
        setAvailableVideoModels(videoModelsRes.models);
      }

      if (settings?.image_model) {
        setImageModel(settings.image_model);
      } else if (imageModelsRes?.models && imageModelsRes.models.length > 0) {
        setImageModel(imageModelsRes.models[0].id);
      }

      if (settings?.video_model) {
        setVideoModel(settings.video_model);
      } else if (videoModelsRes?.models && videoModelsRes.models.length > 0) {
        setVideoModel(videoModelsRes.models[0].id);
      }

      const systemDefault =
        res?.default_model ||
        models.find((m) => m.is_default)?.id ||
        models[0]?.id ||
        "";
      const userDef = settings?.default_model;
      const effectiveDefault = (userDef && models.some((m) => m.id === userDef) ? userDef : null) || systemDefault;
      if (effectiveDefault) {
        defaultModelRef.current = effectiveDefault;
      }

      webSearch.applyFromServer(settings?.web_search_mode);

      if (typeof settings?.memory_enabled === "boolean") {
        setMemoryEnabled(settings.memory_enabled);
      }

      if (models.length > 0) {
        const targetModel = effectiveDefault || models[0].id;
        if (!activeIdRef.current) {
          setCurrentModel(targetModel);
          try { localStorage.setItem("apiapia_preferred_model", targetModel); } catch (_) {}
        } else if (!models.some((m) => m.id === currentModel)) {
          setCurrentModel(targetModel);
        }
      }
      return {
        chat: models.length,
        image: imageModelsRes?.models?.length ?? 0,
        video: videoModelsRes?.models?.length ?? 0,
      };
    } catch (err) {
      console.error("Failed to load configured models:", err);
      return null;
    } finally {
      setIsRefreshingModels(false);
    }
  };

  const handleManualSyncModels = async () => {
    setIsRefreshingModels(true);
    try {
      const target =
        creationMode === "image"
          ? { path: "/models/sync-images", scope: "image" as const, emptyKey: "image" as const }
          : creationMode === "video"
          ? { path: "/models/sync-videos", scope: "video" as const, emptyKey: "video" as const }
          : { path: "/models/sync", scope: "language" as const, emptyKey: "chat" as const };

      const syncRes = await apiRequest<{
        success: boolean;
        new_count: number;
        new_models: ModelCatalogItem[];
        message: string;
      }>(target.path, { method: "POST" });

      const counts = await loadConfiguredModels();

      notifyModelSyncResult({
        t,
        scope: target.scope,
        newCount: syncRes.new_count || 0,
        message: syncRes.message,
        emptyResult: counts !== null && counts[target.emptyKey] === 0,
      });
    } catch (err: any) {
      console.error("Failed to sync models:", err);
      toast.error(err.message || t("chat.errors.syncModelsFailed"));
    } finally {
      setIsRefreshingModels(false);
    }
  };

  useEffect(() => {
    if (user) {
      webSearch.hydrateFromStorage();
      loadConversations();
      loadConfiguredModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectConversation = async (id: string) => {
    if (activeIdRef.current === id) {
      setMobileTab("chat");
      return;
    }

    if (activeIdRef.current) {
      saveConversationInputState(activeIdRef.current, {
        isTranslateMode: isTranslateModeRef.current,
        vocabTargetLang: vocabTargetLangRef.current,
        creationMode: creationModeRef.current,
      });
    }

    // 切换到其他历史记录时，立即终止并重置当前等待思考或推流状态，避免残留到新选中的会话
    resetStreamingState();

    setActiveId(id);
    activeIdRef.current = id;
    setRetrievedMemories([]);
    setMessages([]);
    setLoadingMessages(true);
    setMobileTab("chat");

    const savedState = loadConversationInputState(id);
    if (savedState) {
      setIsTranslateMode(!!savedState.isTranslateMode);
      setVocabTargetLang(savedState.vocabTargetLang || "ja");
      setCreationMode(savedState.creationMode || "chat");
    }

    const targetConv = conversations.find((c) => c.id === id);
    if (targetConv?.model) {
      setCurrentModel(targetConv.model);
    }

    try {
      const [msgs, mems] = await Promise.all([
        apiRequest<Message[]>(`/conversations/${id}/messages`),
        apiRequest<unknown[]>(`/conversations/${id}/memories`).catch(() => []),
      ]);
      if (activeIdRef.current === id) {
        setMessages(hydrateMessages(msgs));
        if (mems && mems.length > 0) {
          setRetrievedMemories(mems);
        }

        if (!savedState) {
          const detected = detectInputStateFromMessages(msgs);
          setIsTranslateMode(detected.isTranslateMode);
          setVocabTargetLang(detected.vocabTargetLang);
          setCreationMode(detected.creationMode);
          saveConversationInputState(id, detected);
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
    if (activeIdRef.current === null && messages.length === 0 && !isStreaming) {
      setMobileTab("chat");
      return;
    }

    if (activeIdRef.current) {
      saveConversationInputState(activeIdRef.current, {
        isTranslateMode: isTranslateModeRef.current,
        vocabTargetLang: vocabTargetLangRef.current,
        creationMode: creationModeRef.current,
      });
    }

    // 新打开聊天时，立即终止并重置上一次会话的等待思考或推流状态
    resetStreamingState();

    setActiveId(null);
    activeIdRef.current = null;
    setMessages([]);
    setRetrievedMemories([]);
    setLoadingMessages(false);
    setMobileTab("chat");

    setIsTranslateMode(false);
    setCreationMode("chat");
    setVocabTargetLang("ja");

    try {
      localStorage.removeItem("apiapia_chat_draft:new");
      localStorage.removeItem("apiapia_chat_input_state:new");
    } catch (_) {}

    const userDef = defaultModelRef.current;
    if (userDef && availableModels.some((m) => m.id === userDef)) {
      setCurrentModel(userDef);
      try { localStorage.setItem("apiapia_preferred_model", userDef); } catch (_) {}
    } else if (availableModels.length > 0) {
      setCurrentModel(availableModels[0].id);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await apiRequest(`/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      try {
        localStorage.removeItem(`apiapia_chat_input_state:${id}`);
        localStorage.removeItem(`apiapia_chat_draft:${id}`);
      } catch (_) {}
      if (activeIdRef.current === id) {
        resetStreamingState();
        activeIdRef.current = null;
        setActiveId(null);
        setMessages([]);
        setRetrievedMemories([]);
        setLoadingMessages(false);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleTogglePin = async (id: string, nextPinned: boolean) => {
    const prev = conversations;
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
    const pinned = conversations
      .filter((c) => c.is_pinned)
      .sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0));
    const idx = pinned.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= pinned.length) return;
    const ids = pinned.map((c) => c.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    handleReorderPinned(ids);
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
    try {
      await apiRequest(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: newTitle }),
      });
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    }
  };

  /**
   * 记忆开关。
   *
   * 此前这里只有 `setMemoryEnabled(!memoryEnabled)`，**没有写回服务端**，
   * 而同一页面的联网检索开关是会 PATCH /settings 的。于是用户在侧栏关掉
   * 长期记忆，刷新后 loadConfiguredModels 又从 /settings 把开关读回开启 ——
   * 看起来像开关坏了。现在两者行为一致。
   */
  const handleToggleMemoryEnabled = useCallback(() => {
    setMemoryEnabled((prev) => {
      const next = !prev;
      void apiRequest("/settings", {
        method: "PATCH",
        body: JSON.stringify({ memory_enabled: next }),
      }).catch(() => {
        toast.error(t("chat.errors.memoryTogglePersistFailed"));
      });
      return next;
    });
  }, []);

  const finalizeAssistantMessage = () => {
    if (finalizedRef.current) return;
    if (stopRequestedRef.current && isStreamCompletedRef.current === false) return;
    finalizedRef.current = true;

    clearStreamIntervals();

    const doneMeta = doneMetaRef.current;
    const finalContent = targetContentRef.current || displayedContentRef.current;

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
    const generatedVideos = currentGeneratedVideosRef.current;
    const finishReason = doneMeta?.finish_reason || (stopRequestedRef.current ? "abort" : "stop");

    const hasMedia =
      (generatedImages && generatedImages.length > 0) ||
      (generatedVideos && generatedVideos.length > 0);

    if (finalContent.trim() || hasMedia) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          id: doneMeta?.message_id,
          content: finalContent,
          model: doneMeta?.model || currentStreamModelRef.current || currentModel,
          duration_ms: totalDurationMs,
          thinking_duration_ms: finalThinkingMs,
          prompt_tokens: doneMeta?.prompt_tokens,
          completion_tokens: doneMeta?.completion_tokens,
          token_usage: doneMeta?.total_tokens,
          search_results: searchResults && searchResults.length > 0 ? searchResults : undefined,
          search_query: doneMeta?.search_query || undefined,
          toolInvocations: tools && tools.length > 0 ? [...tools] : undefined,
          generatedImages: generatedImages && generatedImages.length > 0 ? [...generatedImages] : undefined,
          generatedVideos: generatedVideos && generatedVideos.length > 0 ? [...generatedVideos] : undefined,
          finish_reason: finishReason,
          created_at: doneMeta?.created_at || new Date().toISOString(),
        },
      ]);
    }

    setIsStreaming(false);
    setStreamStartedAt(null);
    setIsWaitingForFirstToken(false);
    setStreamingContent("");
    setSearchStatus({ state: "idle" });
    setStreamingSearchResults(null);
    currentSearchResultsRef.current = null;

    currentToolInvocationsRef.current = [];
    currentGeneratedImagesRef.current = [];
    currentGeneratedVideosRef.current = [];
    targetContentRef.current = "";
    displayedContentRef.current = "";
    loadConversations();
  };

  const handleSendMessage = useCallback(
    async (
      text: string,
      attachments?: AttachmentItem[],
      extraOptions?: {
        quotedMessageId?: string;
        quotedContent?: string;
        systemPromptOverride?: string;
        reasoningEffort?: string;
        maxTokens?: number;
        imageGenMode?: boolean;
        videoGenMode?: boolean;
        webSearchMode?: "auto" | "on" | "off";
        modelOverride?: string;
        singleTurnMode?: boolean;
        memoryEnabled?: boolean;
      }
    ) => {
      resetStreamingState();
      const currentSessionId = ++streamSessionIdRef.current;
      stopRequestedRef.current = false;
      finalizedRef.current = false;

      const effectiveModel = extraOptions?.modelOverride || currentModel;
      currentStreamModelRef.current = effectiveModel;

      const userMsg: Message = {
        role: "user",
        content: (text || "").trim(),
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        model: effectiveModel,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      if (activeId) {
        const nowIso = new Date().toISOString();
        setConversations((list) =>
          list.map((c) => (c.id === activeId ? { ...c, last_message_at: nowIso } : c))
        );
      }

      setIsStreaming(true);
      setIsWaitingForFirstToken(true);
      setStreamingContent("");
      setThinkingDuration(null);
      setSearchStatus({ state: "idle" });
      setStreamingSearchResults(null);
      currentSearchResultsRef.current = null;
      currentToolInvocationsRef.current = [];
      currentGeneratedImagesRef.current = [];
      currentGeneratedVideosRef.current = [];

      startTimeRef.current = Date.now();
      setStreamStartedAt(startTimeRef.current);
      firstTokenTimeRef.current = null;
      targetContentRef.current = "";
      displayedContentRef.current = "";
      isStreamCompletedRef.current = false;
      doneMetaRef.current = null;
      abortControllerRef.current = new AbortController();

      typewriterIntervalRef.current = setInterval(() => {
        if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) {
          clearStreamIntervals();
          return;
        }
        const target = targetContentRef.current;
        const current = displayedContentRef.current;
        const remaining = target.length - current.length;

        if (remaining > 0) {
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
          finalizeAssistantMessage();
        }
      }, 20);

      const isTranslate = isTranslateModeRef.current;
      const effectiveSystemPrompt =
        extraOptions?.systemPromptOverride !== undefined
          ? extraOptions.systemPromptOverride
          : isTranslate
          ? buildVocabTutorPrompt(vocabTargetLangRef.current, locale)
          : undefined;
      const effectiveSingleTurn =
        extraOptions?.singleTurnMode !== undefined
          ? extraOptions.singleTurnMode
          : isTranslate
          ? true
          : undefined;
      const effectiveMemoryEnabled =
        extraOptions?.memoryEnabled !== undefined
          ? extraOptions.memoryEnabled
          : isTranslate
          ? false
          : memoryEnabled;
      const effectiveWebSearchMode =
        extraOptions?.webSearchMode ||
        (isTranslate ? "off" : webSearch.modeRef.current);

      try {
        await streamChatResponse(
          {
            conversation_id: activeId || undefined,
            message: text,
            model: effectiveModel,
            memory_enabled: effectiveMemoryEnabled,
            single_turn_mode: effectiveSingleTurn,
            web_search_mode: effectiveWebSearchMode,
            image_gen_mode: extraOptions?.imageGenMode,
            video_gen_mode: extraOptions?.videoGenMode,
            attachments: attachments && attachments.length > 0 ? attachments : undefined,
            quoted_message_id: extraOptions?.quotedMessageId,
            quoted_content: extraOptions?.quotedContent,
            system_prompt_override: effectiveSystemPrompt,
            reasoning_effort: extraOptions?.reasoningEffort,
            max_tokens: extraOptions?.maxTokens,
          },
          {
            onMeta: (meta) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) {
                if (meta.conversation_id) {
                  loadConversations();
                }
                return;
              }
              if (meta.conversation_id) {
                setActiveId(meta.conversation_id);
                activeIdRef.current = meta.conversation_id;
                saveConversationInputState(meta.conversation_id, {
                  isTranslateMode: isTranslateModeRef.current,
                  vocabTargetLang: vocabTargetLangRef.current,
                  creationMode: creationModeRef.current,
                });
                loadConversations();
              }
              if (meta.retrieved_memories && meta.retrieved_memories.length > 0) {
                setRetrievedMemories(meta.retrieved_memories);
              }
              if (meta.user_message_id) {
                setMessages((prev) => {
                  for (let i = prev.length - 1; i >= 0; i--) {
                    const item = prev[i];
                    if (item && item.role === "user" && !item.id) {
                      const next = prev.slice();
                      next[i] = { ...item, id: meta.user_message_id };
                      return next;
                    }
                  }
                  return prev;
                });
              }
            },
            onSearchStart: (data) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) return;
              setSearchStatus({ state: "searching", query: data.query });
            },
            onSearchResults: (data) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) return;
              currentSearchResultsRef.current = data.results;
              setStreamingSearchResults(data.results);
              setSearchStatus({
                state: "done",
                query: data.query,
                count: data.results?.length || 0,
              });
            },
            onToolCall: (data) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) return;
              currentToolInvocationsRef.current.push({
                toolCallId: data.toolCallId,
                toolName: data.toolName,
                args: data.args,
                state: "call",
              });
            },
            onToolResult: (data) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) return;
              const idx = currentToolInvocationsRef.current.findIndex(
                (t) => t.toolCallId === data.toolCallId
              );
              if (idx !== -1) {
                currentToolInvocationsRef.current[idx].state = "result";
                currentToolInvocationsRef.current[idx].result = data.result;
              }
            },
            onImageResult: (data) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) return;
              currentGeneratedImagesRef.current.push({
                id: data.imageId ?? undefined,
                url: data.url,
                prompt: data.prompt,
                provider: data.provider,
                model: data.model,
              });
            },
            onVideoResult: (data) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) return;
              currentGeneratedVideosRef.current.push({
                id: data.videoId ?? undefined,
                prompt: data.prompt,
                provider: data.provider,
                model: data.model,
              });
            },
            onToken: (token) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) return;
              if (firstTokenTimeRef.current === null) {
                firstTokenTimeRef.current = Date.now();
                setIsWaitingForFirstToken(false);
                setThinkingDuration((firstTokenTimeRef.current - startTimeRef.current) / 1000);
              }
              targetContentRef.current += token;
            },
            onError: (err) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) return;
              console.error("Stream error:", err);
              clearStreamIntervals();
              setIsStreaming(false);
              setStreamStartedAt(null);
              setIsWaitingForFirstToken(false);
              setSearchStatus({ state: "idle" });
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: err || t("chat.message.backendUnknownError"),
                  finish_reason: "error",
                },
              ]);
            },
            onDone: (doneMeta) => {
              if (streamSessionIdRef.current !== currentSessionId || stopRequestedRef.current) return;
              isStreamCompletedRef.current = true;
              doneMetaRef.current = doneMeta;
              if (doneMeta.search_results && doneMeta.search_results.length > 0) {
                currentSearchResultsRef.current = doneMeta.search_results;
                setStreamingSearchResults(doneMeta.search_results);
              }
              if (targetContentRef.current.length === displayedContentRef.current.length) {
                finalizeAssistantMessage();
              }
            },
          },
          { signal: abortControllerRef.current?.signal }
        );
      } catch (err: any) {
        if (
          streamSessionIdRef.current !== currentSessionId ||
          stopRequestedRef.current ||
          abortControllerRef.current?.signal.aborted
        ) {
          return;
        }
        clearStreamIntervals();
        setIsStreaming(false);
        setStreamStartedAt(null);
        setIsWaitingForFirstToken(false);
        setSearchStatus({ state: "idle" });
        const isApiError = err instanceof ApiError;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: isApiError ? `❌ ${err.message}` : `❌ ${t("chat.message.networkFailed", { reason: err?.message || err })}`,
            finish_reason: "error",
          },
        ]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, currentModel, memoryEnabled, locale, resetStreamingState]
  );

  const handleStopGenerating = () => {
    if (!isStreaming) return;
    if (finalizedRef.current) return;
    stopRequestedRef.current = true;
    abortInFlightStream();
    clearStreamIntervals();

    doneMetaRef.current = {
      finish_reason: "abort",
      created_at: new Date().toISOString(),
    };
    if (targetContentRef.current.length === displayedContentRef.current.length) {
      finalizeAssistantMessage();
    } else {
      isStreamCompletedRef.current = true;
    }
  };

  const refreshFromServer = async () => {
    await loadConversations();

    const id = activeIdRef.current;
    if (!id || messageEditGuardFlag.current) return;

    try {
      const msgs = await apiRequest<Message[]>(`/conversations/${id}/messages`);
      if (activeIdRef.current === id) {
        setMessages(hydrateMessages(msgs));
      }
    } catch (err) {
      console.error("Failed to refresh conversation on resume:", err);
    }
  };

  useRefreshOnResume(refreshFromServer, {
    enabled: !isStreaming && !regenerating,
    visible: mobileTab === "chat",
  });

  useWakeLock({
    active: isStreaming || isWaitingForFirstToken || regenerating,
  });

  const handleEditMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!activeId || !messageId) return;
      if (isStreaming || regenerating) return;
      const clean = newText.trim();
      if (!clean) {
        toast.error(t("chat.errors.emptyEdit"));
        return;
      }

      const before = messagesRef.current;
      const rollback = () => setMessages(before);
      let truncatedOnServer = false;

      try {
        await apiRequest(`/conversations/${activeId}/messages/${messageId}/truncate`, {
          method: "POST",
        });
        truncatedOnServer = true;
        const cutIndex = before.findIndex((m) => m.id === messageId);
        const originalUserMsg = cutIndex >= 0 ? before[cutIndex] : undefined;
        setMessages(
          cutIndex >= 0 ? before.slice(0, cutIndex) : before.filter((m) => m.id !== messageId)
        );
        await handleSendMessage(clean, originalUserMsg?.attachments);
      } catch (err: any) {
        if (!truncatedOnServer) {
          rollback();
          toast.error(err.message || t("chat.errors.editFailed"));
          return;
        }
        resetStreamingState();
        void refreshFromServer();
        toast.warning(t("chat.errors.resendFailedTitle"), {
          description: t("chat.errors.resendFailedDesc", { reason: err?.message || t("chat.errors.networkReason") }),
          duration: 5000,
        });
      }
    },
    [activeId, isStreaming, regenerating, handleSendMessage, resetStreamingState]
  );

  const handleRegenerate = useCallback(
    async (assistantId: string) => {
      if (!activeId || isStreaming || regenerating || !assistantId) return;

      const list = messagesRef.current;
      const idx = list.findIndex((m) => m.id === assistantId);
      if (idx < 0) return;

      let userIdx = idx - 1;
      while (userIdx >= 0 && list[userIdx].role !== "user") userIdx--;
      if (userIdx < 0) {
        toast.error(t("chat.errors.regenerateNoSource"));
        return;
      }
      const prompt = list[userIdx].content;
      const attachments = list[userIdx].attachments;

      const rollback = () => setMessages(list);

      setRegenerating(true);
      try {
        await apiRequest(`/conversations/${activeId}/messages/${assistantId}`, {
          method: "DELETE",
        });
        setMessages(list.slice(0, idx));
        await handleSendMessage(prompt, attachments);
      } catch (err: any) {
        rollback();
        toast.error(err.message || t("chat.errors.regenerateFailed"));
      } finally {
        setRegenerating(false);
      }
    },
    [activeId, isStreaming, regenerating, handleSendMessage]
  );

  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!initialConversationId || loadingConversations) return;
    deepLinkHandledRef.current = true;
    if (conversations.some((c) => c.id === initialConversationId)) {
      selectConversation(initialConversationId);
    }
  }, [initialConversationId, loadingConversations, conversations]);

  if (loading || !user) {
    return <FullPageSkeleton variant="chat" />;
  }

  const showChat = mobileTab === "chat";
  const showSpaTab = (tab: MobileTab) => mobileTab === tab;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <DesktopNavbar />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          isOpen={isDesktopSidebarOpen}
          onToggleOpen={handleToggleDesktopSidebar}
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
          loading={loadingConversations}
        />

        {(() => {
          const activeModelId =
            creationMode === "image"
              ? imageModel
              : creationMode === "video"
              ? videoModel
              : currentModel;

          const activeModelCatalog: ModelCatalogItem[] =
            creationMode === "image"
              ? availableImageModels.map((im) => ({
                  id: im.id,
                  name: im.name,
                  provider: im.provider,
                  description: im.description || "",
                  is_free: im.is_free,
                }))
              : creationMode === "video"
              ? availableVideoModels.map((vm) => ({
                  id: vm.id,
                  name: vm.name,
                  provider: vm.provider,
                  description: vm.description || "",
                  is_free: vm.is_free,
                }))
              : availableModels;

          return (
            <div
              className={
                showChat
                  ? "flex min-w-0 max-w-full flex-1 flex-col overflow-hidden relative"
                  : "hidden min-w-0 max-w-full flex-1 flex-col overflow-hidden relative md:flex"
              }
            >
              <MobileChatHeader
                currentModel={activeModelId}
                onModelChange={handleModelChange}
                availableModels={activeModelCatalog}
                onRefreshModels={handleManualSyncModels}
                isRefreshingModels={isRefreshingModels}
                onToggleMemory={handleToggleMemory}
                memoriesCount={retrievedMemories.length}
                onNewChat={handleNewChat}
                hasMessages={messages.length > 0}
                onSelectMobileTab={handleSelectMobileTab}
                activeConversation={conversations.find((c) => c.id === activeId) || null}
                onTogglePin={handleTogglePin}
                onRename={handleRenameConversation}
                onDelete={handleDeleteConversation}
                isVocabMode={isTranslateMode}
              />

              <DesktopChatHeader
                isSidebarOpen={isDesktopSidebarOpen}
                onToggleSidebar={handleToggleDesktopSidebar}
                isMemoryOpen={isDesktopMemoryOpen}
                onToggleMemory={handleToggleDesktopMemory}
                memoriesCount={retrievedMemories.length}
                currentModel={activeModelId}
                onModelChange={handleModelChange}
                availableModels={activeModelCatalog}
                onRefreshModels={handleManualSyncModels}
                isRefreshingModels={isRefreshingModels}
                activeConversation={conversations.find((c) => c.id === activeId) || null}
                onTogglePin={handleTogglePin}
                onRename={handleRenameConversation}
                onDelete={handleDeleteConversation}
                isVocabMode={isTranslateMode}
              />

              <ChatArea
                messages={messages}
                currentModel={activeModelId}
                onSendMessage={handleSendMessage}
                onStopGenerating={handleStopGenerating}
                isStreaming={isStreaming}
                streamingContent={streamingContent}
                thinkingDuration={thinkingDuration}
                streamStartedAt={streamStartedAt}
                isWaitingForFirstToken={isWaitingForFirstToken}
                onNewChat={handleNewChat}
                webSearchMode={webSearch.mode}
                onToggleWebSearchMode={webSearch.toggle}
                searchStatus={searchStatus}
                streamingSearchResults={streamingSearchResults}
                loadingMessages={loadingMessages}
                regenerating={regenerating}
                onRegenerate={handleRegenerate}
                onEditMessage={handleEditMessage}
                conversationId={activeId}
                creationMode={creationMode}
                onChangeCreationMode={handleSetCreationMode}
                isTranslateMode={isTranslateMode}
                onToggleTranslateMode={handleToggleTranslateMode}
                vocabTargetLang={vocabTargetLang}
                onSelectVocabLang={handleSelectVocabLang}
              />
            </div>
          );
        })()}

        {showSpaTab("history") && (
          <div className="relative flex-1 overflow-hidden md:hidden">
            <MobileHistoryView
              conversations={conversations}
              activeId={activeId}
              isVisible
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
                if (conv) handleTogglePin(id, !conv.is_pinned);
              }}
              onRename={handleRenameConversation}
              onMovePinned={handleMovePinned}
              onReorderPinned={handleReorderPinned}
              onSelectMobileTab={handleSelectMobileTab}
            />
          </div>
        )}

        {showSpaTab("memory") && (
          <div className="relative flex-1 overflow-hidden md:hidden">
            <MemoryView isMobileSpa onSelectMobileTab={handleSelectMobileTab} active />
          </div>
        )}

        {showSpaTab("usage") && (
          <div className="relative flex-1 overflow-hidden md:hidden">
            <UsageView isMobileSpa onSelectMobileTab={handleSelectMobileTab} active />
          </div>
        )}

        {showSpaTab("settings") && (
          <div className="relative flex-1 overflow-hidden md:hidden">
            <SettingsView isMobileSpa onSelectMobileTab={handleSelectMobileTab} active />
          </div>
        )}

        <MemorySidebar
          isDesktopOpen={isDesktopMemoryOpen}
          memories={retrievedMemories}
          memoryEnabled={memoryEnabled}
          onToggleMemory={handleToggleMemoryEnabled}
          isOpen={isMemoryOpen}
          onClose={() => setIsMemoryOpen(false)}
          onSelectMobileTab={handleSelectMobileTab}
        />
      </div>

      <MobileTabBar
        activeMobileTab={mobileTab}
        onSelectMobileTab={handleSelectMobileTab}
        onNewChat={handleNewChat}
        className={cn(isKeyboardOpen && "hidden")}
      />
    </div>
  );
}

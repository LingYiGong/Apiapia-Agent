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
import { useI18n } from "@/i18n";
import { buildVocabTutorPrompt } from "@/config/personas";
import { useRefreshOnResume } from "@/hooks/useRefreshOnResume";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWebSearchMode } from "@/hooks/useWebSearchMode";
import { messageEditGuardFlag } from "@/lib/messageEditGuard";
import { hydrateMessages } from "@/lib/message";
import { getActiveThread, findDeepestLeafOfNode } from "@/lib/conversationTree";
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

interface ActiveStreamSession {
  sessionId: number;
  conversationId: string | null;
  tempKey: string;
  abortController: AbortController;
  model: string;
  userMessage: Message;
  baseMessages: Message[];
  startTime: number;
  firstTokenTime: number | null;
  targetContent: string;
  displayedContent: string;
  isStreamCompleted: boolean;
  doneMeta: any;
  stopRequested: boolean;
  finalized: boolean;
  retrievedMemories: any[];
  searchResults: SearchResultItem[] | null;
  searchStatus: { state: "idle" | "searching" | "done"; query?: string; count?: number };
  suggestions: string[] | null;
  toolInvocations: ToolInvocation[];
  generatedImages: import("@/types").GeneratedImage[];
  generatedVideos: import("@/types").GeneratedVideo[];
  memoryUpdated?: string[];
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
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const allMessagesRef = useRef<Message[]>([]);
  useEffect(() => {
    allMessagesRef.current = allMessages;
  }, [allMessages]);

  const [selectedLeafId, setSelectedLeafId] = useState<string | null>(null);
  const [branchSelections, setBranchSelections] = useState<Record<string, string>>({});

  const { activeMessages: messages, siblingInfoMap } = React.useMemo(() => {
    return getActiveThread(allMessages, selectedLeafId, branchSelections);
  }, [allMessages, selectedLeafId, branchSelections]);

  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const setMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setAllMessages(updater);
  }, []);

  const handleSwitchBranch = useCallback((targetMessageId: string) => {
    const newLeaf = findDeepestLeafOfNode(allMessagesRef.current, targetMessageId);
    setSelectedLeafId(newLeaf);
    const targetMsg = allMessagesRef.current.find((m) => m.id === targetMessageId);
    if (targetMsg?.parent_id) {
      setBranchSelections((prev) => ({ ...prev, [targetMsg.parent_id!]: targetMessageId }));
    }
  }, []);
  const [regenerating, setRegenerating] = useState(false);
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);

  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamSessionIdRef = useRef<number>(0);
  const activeStreamsRef = useRef<Map<string, ActiveStreamSession>>(new Map());
  const currentNewChatSessionIdRef = useRef<number>(0);
  const lastFinalizedAtRef = useRef<number>(0);
  const [streamingConversationIds, setStreamingConversationIds] = useState<string[]>([]);

  const isSessionActive = useCallback((session: ActiveStreamSession) => {
    if (activeIdRef.current) {
      return activeIdRef.current === session.conversationId;
    }
    return (
      activeIdRef.current === null &&
      currentNewChatSessionIdRef.current !== 0 &&
      currentNewChatSessionIdRef.current === session.sessionId
    );
  }, []);

  const getActiveSession = useCallback((): ActiveStreamSession | null => {
    const currentId = activeIdRef.current;
    if (currentId) {
      const direct = activeStreamsRef.current.get(currentId);
      if (direct) return direct;
      let byConv: ActiveStreamSession | null = null;
      activeStreamsRef.current.forEach((session) => {
        if (!byConv && !session.finalized && session.conversationId === currentId) {
          byConv = session;
        }
      });
      if (byConv) return byConv;
    }
    if (currentNewChatSessionIdRef.current) {
      let found: ActiveStreamSession | null = null;
      activeStreamsRef.current.forEach((session) => {
        if (!found && session.sessionId === currentNewChatSessionIdRef.current) {
          found = session;
        }
      });
      if (found) return found;
    }
    let fallback: ActiveStreamSession | null = null;
    activeStreamsRef.current.forEach((session) => {
      if (!fallback && !session.finalized && !session.stopRequested) {
        if (!currentId && !session.conversationId) {
          fallback = session;
        }
      }
    });
    return fallback;
  }, []);

  const updateStreamingIds = useCallback(() => {
    const ids: string[] = [];
    activeStreamsRef.current.forEach((session) => {
      if (session.conversationId && !session.finalized && !session.stopRequested) {
        ids.push(session.conversationId);
      }
    });
    setStreamingConversationIds(ids);
  }, []);

  const clearStreamIntervals = useCallback(() => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
  }, []);

  const detachCurrentStreamView = useCallback(() => {
    clearStreamIntervals();
    setIsStreaming(false);
    setIsWaitingForFirstToken(false);
    setStreamingContent("");
    setThinkingDuration(null);
    setStreamStartedAt(null);
    setSearchStatus({ state: "idle" });
    setStreamingSearchResults(null);
  }, [clearStreamIntervals]);

  const resetStreamingState = useCallback(() => {
    detachCurrentStreamView();
  }, [detachCurrentStreamView]);

  useEffect(() => {
    return () => {
      clearStreamIntervals();
      activeStreamsRef.current.forEach((session) => {
        try {
          session.abortController.abort();
        } catch (_) {}
      });
      activeStreamsRef.current.clear();
    };
  }, [clearStreamIntervals]);


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
  const loadConversationsSeqRef = useRef(0);
  const generatedTitlesRef = useRef<Map<string, string>>(new Map());

  const loadConversations = async () => {
    // 首屏该打开哪一条由下面的 activeId 恢复逻辑负责，这里只负责把列表拉回来。
    const seq = ++loadConversationsSeqRef.current;
    try {
      const list = await apiRequest<Conversation[]>("/conversations");
      if (seq !== loadConversationsSeqRef.current) return;
      setConversations(
        list.map((c) => {
          const overrideTitle = generatedTitlesRef.current.get(c.id);
          if (!overrideTitle) return c;
          if (c.title === overrideTitle) {
            generatedTitlesRef.current.delete(c.id);
            return c;
          }
          return { ...c, title: overrideTitle };
        })
      );
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      if (seq === loadConversationsSeqRef.current) {
        setLoadingConversations(false);
      }
    }
  };

  /** Pull every model catalog down. */
  const loadConfiguredModels = async (): Promise<void> => {
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
    } catch (err) {
      console.error("Failed to load configured models:", err);
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

  const finalizeSessionMessage = useCallback(
    (session: ActiveStreamSession, forceActive = false) => {
      if (session.finalized) return;
      if (session.stopRequested && session.isStreamCompleted === false) return;
      session.finalized = true;
      lastFinalizedAtRef.current = Date.now();

      const active = forceActive || isSessionActive(session);
      if (active) {
        clearStreamIntervals();
      }

      const doneMeta = session.doneMeta;
      // Prefer the server's sanitized final content when available. Streaming
      // tokens are raw model output, so a long citation URL may be malformed or
      // contain a repetition loop until the backend repairs it in the done event.
      let finalContent =
        (doneMeta?.content && doneMeta.content.trim())
          ? doneMeta.content
          : (session.targetContent || session.displayedContent || "");

      const finalThinkingMs =
        session.firstTokenTime && session.startTime
          ? Math.max(0, session.firstTokenTime - session.startTime)
          : doneMeta?.thinking_duration_ms || 0;

      const totalDurationMs =
        doneMeta?.duration_ms ||
        (session.startTime ? Math.max(20, Date.now() - session.startTime) : 0);

      const searchResults = session.searchResults || doneMeta?.search_results;
      const tools = session.toolInvocations;
      const generatedImages = session.generatedImages;
      const generatedVideos = session.generatedVideos;
      const finishReason = doneMeta?.finish_reason || (session.stopRequested ? "abort" : "stop");

      const hasMedia =
        (generatedImages && generatedImages.length > 0) ||
        (generatedVideos && generatedVideos.length > 0);

      if (session.stopRequested) {
        const abortedText = t("chat.message.abortedPlaceholder");
        if (!finalContent.trim() && !hasMedia) {
          finalContent = abortedText;
        } else if (/^\s*<think>/i.test(finalContent) && !/<\/think>/i.test(finalContent)) {
          finalContent = `${finalContent}\n</think>\n\n${abortedText}`;
        }
      }

      if (active && (finalContent.trim() || hasMedia)) {
        const assistantMsgId = doneMeta?.message_id || `asst_${Date.now()}`;
        const parentMsgId = doneMeta?.parent_id || session.userMessage?.id;
        setSelectedLeafId(assistantMsgId);
        if (parentMsgId) {
          setBranchSelections((prev) => ({ ...prev, [parentMsgId]: assistantMsgId }));
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            id: assistantMsgId,
            parent_id: parentMsgId,
            memory_updated: session.memoryUpdated,
            content: finalContent,
            model: doneMeta?.model || session.model || currentModel,
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
            suggested_questions: session.suggestions || doneMeta?.suggested_questions || undefined,
            created_at: doneMeta?.created_at || new Date().toISOString(),
          },
        ]);
      }

      if (active) {
        setIsStreaming(false);
        setRegenerating(false);
        setStreamStartedAt(null);
        setIsWaitingForFirstToken(false);
        setStreamingContent("");
        setSearchStatus({ state: "idle" });
        setStreamingSearchResults(null);
      }

      activeStreamsRef.current.delete(session.tempKey);
      if (session.conversationId) {
        activeStreamsRef.current.delete(session.conversationId);
      }
      updateStreamingIds();
      loadConversations();
    },
    [clearStreamIntervals, isSessionActive, currentModel, updateStreamingIds, loadConversations, t]
  );

  const startTypewriter = useCallback(
    (session: ActiveStreamSession) => {
      clearStreamIntervals();
      typewriterIntervalRef.current = setInterval(() => {
        if (!isSessionActive(session) || session.stopRequested) {
          clearStreamIntervals();
          return;
        }
        const target = session.targetContent;
        const current = session.displayedContent;
        const remaining = target.length - current.length;

        if (remaining > 0) {
          let step = 1;
          if (remaining > 60) {
            step = Math.min(remaining, Math.ceil(remaining / 6));
          } else if (remaining > 30) {
            step = 4;
          } else if (remaining > 15) {
            step = 3;
          } else if (remaining > 5) {
            step = 2;
          }

          const nextContent = target.slice(0, current.length + step);
          session.displayedContent = nextContent;
          setStreamingContent(nextContent);
        } else if (session.isStreamCompleted) {
          finalizeSessionMessage(session);
        }
      }, 16);
    },
    [clearStreamIntervals, isSessionActive, finalizeSessionMessage]
  );


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

    // 切换到其他历史记录时，仅脱离当前视图状态，绝不中断后台正在进行的流
    detachCurrentStreamView();

    currentNewChatSessionIdRef.current = 0;
    setActiveId(id);
    activeIdRef.current = id;
    setSelectedLeafId(null);
    setBranchSelections({});
    setRetrievedMemories([]);
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

    // 检查是否有该会话正在后台推流
    const activeStream = activeStreamsRef.current.get(id);
    if (activeStream && !activeStream.finalized) {
      setLoadingMessages(false);
      if (activeStream.userMessage?.id) {
        setSelectedLeafId(activeStream.userMessage.id);
      }
      setMessages([...activeStream.baseMessages, activeStream.userMessage]);
      if (activeStream.retrievedMemories && activeStream.retrievedMemories.length > 0) {
        setRetrievedMemories(activeStream.retrievedMemories);
      }
      if (
        activeStream.isStreamCompleted &&
        activeStream.targetContent.length === activeStream.displayedContent.length
      ) {
        finalizeSessionMessage(activeStream);
      } else {
        setIsStreaming(true);
        setIsWaitingForFirstToken(activeStream.firstTokenTime === null);
        setStreamStartedAt(activeStream.startTime);
        setThinkingDuration(
          activeStream.firstTokenTime
            ? (activeStream.firstTokenTime - activeStream.startTime) / 1000
            : null
        );
        setSearchStatus(activeStream.searchStatus);
        setStreamingSearchResults(activeStream.searchResults);
        setStreamingContent(activeStream.displayedContent || activeStream.targetContent);
        startTypewriter(activeStream);
      }
      return;
    }

    setMessages([]);
    setLoadingMessages(true);

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

    // 新打开聊天时，仅脱离当前视图状态，后台流保持继续运行
    detachCurrentStreamView();

    currentNewChatSessionIdRef.current = 0;
    setActiveId(null);
    activeIdRef.current = null;
    setSelectedLeafId(null);
    setBranchSelections({});
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

      const session = activeStreamsRef.current.get(id);
      if (session) {
        session.stopRequested = true;
        try {
          session.abortController.abort();
        } catch (_) {}
        activeStreamsRef.current.delete(id);
        updateStreamingIds();
      }

      if (activeIdRef.current === id) {
        detachCurrentStreamView();
        activeIdRef.current = null;
        setActiveId(null);
        setSelectedLeafId(null);
        setBranchSelections({});
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
    generatedTitlesRef.current.set(id, newTitle);
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
        parentMessageId?: string;
        regenerateMessageId?: string;
      }
    ) => {
      const currentConvId = activeIdRef.current;
      if (currentConvId) {
        const existing = activeStreamsRef.current.get(currentConvId);
        if (existing && !existing.finalized) {
          existing.stopRequested = true;
          try {
            existing.abortController.abort();
          } catch (_) {}
          activeStreamsRef.current.delete(currentConvId);
        }
      } else if (currentNewChatSessionIdRef.current) {
        activeStreamsRef.current.forEach((existing, key) => {
          if (existing.sessionId === currentNewChatSessionIdRef.current && !existing.finalized) {
            existing.stopRequested = true;
            try {
              existing.abortController.abort();
            } catch (_) {}
            activeStreamsRef.current.delete(key);
          }
        });
      }

      const currentSessionId = ++streamSessionIdRef.current;
      const tempKey = currentConvId || `__new_chat_${currentSessionId}`;
      if (!currentConvId) {
        currentNewChatSessionIdRef.current = currentSessionId;
      }

      const effectiveModel = extraOptions?.modelOverride || currentModel;

      const activeMsgs = messagesRef.current;
      const localParentId =
        extraOptions?.parentMessageId !== undefined
          ? extraOptions.parentMessageId
          : activeMsgs.length > 0
          ? activeMsgs[activeMsgs.length - 1].id
          : undefined;
      const effectiveParentId = currentConvId ? localParentId : undefined;

      const isRegenerate = Boolean(extraOptions?.regenerateMessageId);
      const clientMsgId = `client_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      let userMsg: Message;
      if (isRegenerate) {
        const allMsgs = allMessagesRef.current;
        const targetAsst = allMsgs.find((m) => m.id === extraOptions?.regenerateMessageId);
        let existingUser =
          (extraOptions?.parentMessageId ? allMsgs.find((m) => m.id === extraOptions.parentMessageId) : undefined) ||
          (targetAsst?.parent_id ? allMsgs.find((m) => m.id === targetAsst.parent_id) : undefined);

        if (!existingUser && extraOptions?.regenerateMessageId) {
          const activeList = messagesRef.current;
          const idx = activeList.findIndex((m) => m.id === extraOptions.regenerateMessageId);
          let uIdx = idx - 1;
          while (uIdx >= 0 && activeList[uIdx].role !== "user") uIdx--;
          if (uIdx >= 0) existingUser = activeList[uIdx];
        }

        userMsg = existingUser || {
          id: clientMsgId,
          role: "user",
          content: (text || "").trim(),
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
          model: effectiveModel,
          parent_id: localParentId,
          created_at: new Date().toISOString(),
        };
        if (userMsg.id) {
          setSelectedLeafId(userMsg.id);
        }
      } else {
        userMsg = {
          id: clientMsgId,
          role: "user",
          content: (text || "").trim(),
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
          model: effectiveModel,
          parent_id: localParentId,
          created_at: new Date().toISOString(),
        };
        setSelectedLeafId(clientMsgId);
        if (localParentId) {
          setBranchSelections((prev) => ({ ...prev, [localParentId]: clientMsgId }));
        } else {
          setBranchSelections((prev) => ({ ...prev, __root__: clientMsgId }));
        }
        setMessages((prev) => [...prev, userMsg]);
      }
      const baseMessages = allMessagesRef.current.filter((m) => m.id !== userMsg.id);

      if (currentConvId) {
        const nowIso = new Date().toISOString();
        setConversations((list) =>
          list.map((c) => (c.id === currentConvId ? { ...c, last_message_at: nowIso } : c))
        );
      }

      const session: ActiveStreamSession = {
        sessionId: currentSessionId,
        conversationId: currentConvId,
        tempKey,
        abortController: new AbortController(),
        model: effectiveModel,
        userMessage: userMsg,
        baseMessages,
        startTime: Date.now(),
        firstTokenTime: null,
        targetContent: "",
        displayedContent: "",
        isStreamCompleted: false,
        doneMeta: null,
        stopRequested: false,
        finalized: false,
        retrievedMemories: [],
        searchResults: null,
        searchStatus: { state: "idle" },
        suggestions: null,
        toolInvocations: [],
        generatedImages: [],
        generatedVideos: [],
      };

      activeStreamsRef.current.set(tempKey, session);
      updateStreamingIds();

      setIsStreaming(true);
      setIsWaitingForFirstToken(true);
      setStreamingContent("");
      setThinkingDuration(null);
      setSearchStatus({ state: "idle" });
      setStreamingSearchResults(null);
      setStreamStartedAt(session.startTime);

      startTypewriter(session);

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
            conversation_id: currentConvId || undefined,
            parent_message_id: effectiveParentId,
            regenerate_message_id: extraOptions?.regenerateMessageId,
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
            suggest_followups: true,
          },
          {
            onTitle: (data) => {
              if (data?.title && data?.conversation_id) {
                generatedTitlesRef.current.set(data.conversation_id, data.title);
                setConversations((list) =>
                  list.map((c) => (c.id === data.conversation_id ? { ...c, title: data.title } : c))
                );
              }
            },
            onMemoryUpdated: (data) => {
              if (session.stopRequested) return;
              if (data?.facts && data.facts.length > 0) {
                session.memoryUpdated = data.facts;
                if (isSessionActive(session)) {
                  setMessages((prev) => {
                    for (let i = prev.length - 1; i >= 0; i--) {
                      if (prev[i]?.role === "assistant") {
                        const next = prev.slice();
                        next[i] = { ...prev[i], memory_updated: data.facts };
                        return next;
                      }
                    }
                    return prev;
                  });
                }
                toast.success(t("chat.memory.updated") || "🧠 记忆已更新", {
                  description: data.facts.join("；"),
                  duration: 4500,
                });
              }
            },
            onSuggestions: (data) => {
              if (session.stopRequested) return;
              if (data?.suggestions && data.suggestions.length > 0) {
                session.suggestions = data.suggestions;
                if (isSessionActive(session)) {
                  setMessages((prev) => {
                    for (let i = prev.length - 1; i >= 0; i--) {
                      if (prev[i]?.role === "assistant") {
                        const next = prev.slice();
                        next[i] = { ...prev[i], suggested_questions: data.suggestions };
                        return next;
                      }
                    }
                    return prev;
                  });
                }
              }
            },
            onMeta: (meta) => {
              const wasActive = isSessionActive(session);
              if (meta.conversation_id) {
                const isNewConvId = session.conversationId !== meta.conversation_id;
                const oldKey = session.tempKey;
                session.conversationId = meta.conversation_id;
                session.tempKey = meta.conversation_id;
                if (!session.finalized && !session.stopRequested) {
                  activeStreamsRef.current.delete(oldKey);
                  activeStreamsRef.current.set(meta.conversation_id, session);
                  updateStreamingIds();
                } else {
                  activeStreamsRef.current.delete(oldKey);
                }

                if (wasActive && !activeIdRef.current) {
                  setActiveId(meta.conversation_id);
                  activeIdRef.current = meta.conversation_id;
                  currentNewChatSessionIdRef.current = 0;
                  saveConversationInputState(meta.conversation_id, {
                    isTranslateMode: isTranslateModeRef.current,
                    vocabTargetLang: vocabTargetLangRef.current,
                    creationMode: creationModeRef.current,
                  });
                }
                if (isNewConvId) {
                  loadConversations();
                }
              }
              if (session.stopRequested) {
                return;
              }
              if (meta.retrieved_memories && meta.retrieved_memories.length > 0) {
                session.retrievedMemories = meta.retrieved_memories;
                if (isSessionActive(session)) {
                  setRetrievedMemories(meta.retrieved_memories);
                }
              }
              if (meta.user_message_id && session.userMessage.id !== meta.user_message_id) {
                const userMsgId = meta.user_message_id;
                const oldTempId = session.userMessage.id;
                session.userMessage = { ...session.userMessage, id: userMsgId };
                if (isSessionActive(session)) {
                  setSelectedLeafId((currLeaf: string | null): string | null => (currLeaf === oldTempId ? userMsgId : currLeaf));
                  setBranchSelections((prev) => {
                    const next = { ...prev };
                    for (const k in next) {
                      if (next[k] === oldTempId) {
                        next[k] = userMsgId;
                      }
                    }
                    return next;
                  });
                  setMessages((prev) => {
                    for (let i = prev.length - 1; i >= 0; i--) {
                      const item = prev[i];
                      if (item && item.role === "user" && (item.id === oldTempId || !item.id)) {
                        const next = prev.slice();
                        next[i] = { ...item, id: userMsgId };
                        return next;
                      }
                    }
                    return prev;
                  });
                }
              }
            },
            onSearchStart: (data) => {
              if (session.stopRequested) return;
              session.searchStatus = { state: "searching", query: data.query };
              if (isSessionActive(session)) {
                setSearchStatus({ state: "searching", query: data.query });
              }
            },
            onSearchResults: (data) => {
              if (session.stopRequested) return;
              session.searchResults = data.results;
              session.searchStatus = {
                state: "done",
                query: data.query,
                count: data.results?.length || 0,
              };
              if (isSessionActive(session)) {
                setStreamingSearchResults(data.results);
                setSearchStatus(session.searchStatus);
              }
            },
            onToolCall: (data) => {
              if (session.stopRequested) return;
              session.toolInvocations.push({
                toolCallId: data.toolCallId,
                toolName: data.toolName,
                args: data.args,
                state: "call",
              });
            },
            onToolResult: (data) => {
              if (session.stopRequested) return;
              const idx = session.toolInvocations.findIndex(
                (t) => t.toolCallId === data.toolCallId
              );
              if (idx !== -1) {
                session.toolInvocations[idx].state = "result";
                session.toolInvocations[idx].result = data.result;
              }
            },
            onImageResult: (data) => {
              if (session.stopRequested) return;
              session.generatedImages.push({
                id: data.imageId ?? undefined,
                url: data.url,
                prompt: data.prompt,
                provider: data.provider,
                model: data.model,
              });
            },
            onVideoResult: (data) => {
              if (session.stopRequested) return;
              session.generatedVideos.push({
                id: data.videoId ?? undefined,
                prompt: data.prompt,
                provider: data.provider,
                model: data.model,
              });
            },
            onToken: (token) => {
              if (session.stopRequested) return;
              if (session.firstTokenTime === null) {
                session.firstTokenTime = Date.now();
                if (isSessionActive(session)) {
                  setIsWaitingForFirstToken(false);
                  setThinkingDuration((session.firstTokenTime - session.startTime) / 1000);
                }
              }
              session.targetContent += token;
            },
            onError: (err) => {
              if (session.finalized) return;
              if (session.doneMeta) {
                finalizeSessionMessage(session);
                return;
              }
              session.isStreamCompleted = true;
              session.finalized = true;
              lastFinalizedAtRef.current = Date.now();
              if (isSessionActive(session)) {
                clearStreamIntervals();
                setIsStreaming(false);
                setStreamStartedAt(null);
                setIsWaitingForFirstToken(false);
                setStreamingContent("");
                setSearchStatus({ state: "idle" });
                setStreamingSearchResults(null);

                const partialContent = (session.targetContent || session.displayedContent || "").trim();
                const errText = err || t("chat.message.backendUnknownError");
                const combinedContent = partialContent
                  ? `${partialContent}\n\n---\n\n${errText}`
                  : errText;
                const assistantMsgId = `err_asst_${Date.now()}`;
                const parentMsgId = session.userMessage?.id;
                setSelectedLeafId(assistantMsgId);
                if (parentMsgId) {
                  setBranchSelections((prev) => ({ ...prev, [parentMsgId]: assistantMsgId }));
                }
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    id: assistantMsgId,
                    parent_id: parentMsgId,
                    content: combinedContent,
                    model: session.model || currentModel,
                    search_results:
                      session.searchResults && session.searchResults.length > 0
                        ? session.searchResults
                        : undefined,
                    toolInvocations:
                      session.toolInvocations && session.toolInvocations.length > 0
                        ? [...session.toolInvocations]
                        : undefined,
                    generatedImages:
                      session.generatedImages && session.generatedImages.length > 0
                        ? [...session.generatedImages]
                        : undefined,
                    generatedVideos:
                      session.generatedVideos && session.generatedVideos.length > 0
                        ? [...session.generatedVideos]
                        : undefined,
                    finish_reason: "error",
                    created_at: new Date().toISOString(),
                  },
                ]);
              }
              activeStreamsRef.current.delete(session.tempKey);
              if (session.conversationId) {
                activeStreamsRef.current.delete(session.conversationId);
              }
              updateStreamingIds();
            },
            onDone: (doneMeta) => {
              if (session.stopRequested) return;
              session.isStreamCompleted = true;
              session.doneMeta = doneMeta;
              if (doneMeta.conversation_id && !session.conversationId) {
                const wasActive = isSessionActive(session);
                const oldKey = session.tempKey;
                session.conversationId = doneMeta.conversation_id;
                session.tempKey = doneMeta.conversation_id;
                activeStreamsRef.current.delete(oldKey);
                activeStreamsRef.current.set(doneMeta.conversation_id, session);
                updateStreamingIds();
                if (wasActive) {
                  setActiveId(doneMeta.conversation_id);
                  activeIdRef.current = doneMeta.conversation_id;
                  currentNewChatSessionIdRef.current = 0;
                }
              }
              if (doneMeta.search_results && doneMeta.search_results.length > 0) {
                session.searchResults = doneMeta.search_results;
                if (isSessionActive(session)) {
                  setStreamingSearchResults(doneMeta.search_results);
                }
              }
              if (session.targetContent.length === session.displayedContent.length || !isSessionActive(session)) {
                finalizeSessionMessage(session);
              }
            },
          },
          { signal: session.abortController.signal }
        );
      } catch (err: any) {
        if (session.stopRequested || session.abortController.signal.aborted || session.finalized) {
          return;
        }
        if (session.doneMeta) {
          finalizeSessionMessage(session);
          return;
        }
        session.isStreamCompleted = true;
        session.finalized = true;
        lastFinalizedAtRef.current = Date.now();
        if (isSessionActive(session)) {
          clearStreamIntervals();
          setIsStreaming(false);
          setStreamStartedAt(null);
          setIsWaitingForFirstToken(false);
          setStreamingContent("");
          setSearchStatus({ state: "idle" });
          setStreamingSearchResults(null);
          const isApiError = err instanceof ApiError;
          const errText = isApiError
            ? `❌ ${err.message}`
            : `❌ ${t("chat.message.networkFailed", { reason: err?.message || err })}`;
          const partialContent = (session.targetContent || session.displayedContent || "").trim();
          const combinedContent = partialContent
            ? `${partialContent}\n\n---\n\n${errText}`
            : errText;
          const assistantMsgId = `err_asst_${Date.now()}`;
          const parentMsgId = session.userMessage?.id;
          setSelectedLeafId(assistantMsgId);
          if (parentMsgId) {
            setBranchSelections((prev) => ({ ...prev, [parentMsgId]: assistantMsgId }));
          }
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              id: assistantMsgId,
              parent_id: parentMsgId,
              content: combinedContent,
              model: session.model || currentModel,
              search_results:
                session.searchResults && session.searchResults.length > 0
                  ? session.searchResults
                  : undefined,
              toolInvocations:
                session.toolInvocations && session.toolInvocations.length > 0
                  ? [...session.toolInvocations]
                  : undefined,
              generatedImages:
                session.generatedImages && session.generatedImages.length > 0
                  ? [...session.generatedImages]
                  : undefined,
              generatedVideos:
                session.generatedVideos && session.generatedVideos.length > 0
                  ? [...session.generatedVideos]
                  : undefined,
              finish_reason: "error",
              created_at: new Date().toISOString(),
            },
          ]);
        }
        activeStreamsRef.current.delete(session.tempKey);
        if (session.conversationId) {
          activeStreamsRef.current.delete(session.conversationId);
        }
        updateStreamingIds();
      }
    },
    [
      currentModel,
      memoryEnabled,
      locale,
      clearStreamIntervals,
      isSessionActive,
      finalizeSessionMessage,
      startTypewriter,
      updateStreamingIds,
      loadConversations,
      t,
    ]
  );

  const handleStopGenerating = () => {
    const session = getActiveSession();
    if (!session || session.finalized) {
      detachCurrentStreamView();
      setRegenerating(false);
      updateStreamingIds();
      return;
    }
    session.stopRequested = true;
    session.isStreamCompleted = true;
    session.displayedContent = session.targetContent;
    try {
      session.abortController.abort();
    } catch (_) {}
    clearStreamIntervals();

    session.doneMeta = {
      ...session.doneMeta,
      finish_reason: "abort",
      created_at: new Date().toISOString(),
    };
    finalizeSessionMessage(session, true);
    detachCurrentStreamView();
    setRegenerating(false);
  };


  const refreshFromServer = async () => {
    if (
      isStreaming ||
      regenerating ||
      activeStreamsRef.current.size > 0 ||
      Date.now() - lastFinalizedAtRef.current < 5000
    ) {
      return;
    }

    await loadConversations();

    const id = activeIdRef.current;
    if (
      !id ||
      messageEditGuardFlag.current ||
      isStreaming ||
      regenerating ||
      activeStreamsRef.current.has(id) ||
      Date.now() - lastFinalizedAtRef.current < 5000
    ) {
      return;
    }

    try {
      const msgs = await apiRequest<Message[]>(`/conversations/${id}/messages`);
      if (
        activeIdRef.current === id &&
        !activeStreamsRef.current.has(id) &&
        Date.now() - lastFinalizedAtRef.current >= 5000
      ) {
        const serverHydrated = hydrateMessages(msgs);
        setMessages((prev) => {
          if (prev.length === 0) return serverHydrated;
          const prevById = new Map<string, Message>();
          for (const m of prev) {
            if (m.id) prevById.set(m.id, m);
          }
          const merged = serverHydrated.map((m) => {
            const existing = m.id ? prevById.get(m.id) : undefined;
            if (!existing) return m;
            return {
              ...m,
              suggested_questions: m.suggested_questions || existing.suggested_questions,
              memory_updated: m.memory_updated || existing.memory_updated,
            };
          });
          const serverIds = new Set(merged.map((m) => m.id).filter(Boolean));
          for (const m of prev) {
            if (
              m.role === "assistant" &&
              m.id &&
              !serverIds.has(m.id) &&
              (m.id.startsWith("asst_") || m.id.startsWith("err_asst_"))
            ) {
              const hasServerSiblingForSameParent =
                m.parent_id &&
                merged.some((sm) => sm.role === "assistant" && sm.parent_id === m.parent_id);
              if (!hasServerSiblingForSameParent) {
                merged.push(m);
              }
            }
          }
          return merged;
        });
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
    active: isStreaming || isWaitingForFirstToken || regenerating || streamingConversationIds.length > 0,
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

      // ChatGPT 分支体验：不再截断删除后续历史，而是基于原消息的 parent_id 创建新分支！
      const allMsgs = allMessagesRef.current;
      const targetMsg = allMsgs.find((m) => m.id === messageId);
      const parentMessageId = targetMsg?.parent_id || undefined;

      await handleSendMessage(clean, targetMsg?.attachments, {
        parentMessageId,
      });
    },
    [activeId, isStreaming, regenerating, handleSendMessage, t]
  );

  const handleRegenerate = useCallback(
    async (assistantId: string) => {
      if (!activeId || isStreaming || regenerating || !assistantId) return;

      const allMsgs = allMessagesRef.current;
      const asstMsg = allMsgs.find((m) => m.id === assistantId);
      if (!asstMsg) return;

      let userMsg = asstMsg.parent_id
        ? allMsgs.find((m) => m.id === asstMsg.parent_id)
        : undefined;

      if (!userMsg) {
        const activeList = messagesRef.current;
        const idx = activeList.findIndex((m) => m.id === assistantId);
        let uIdx = idx - 1;
        while (uIdx >= 0 && activeList[uIdx].role !== "user") uIdx--;
        if (uIdx >= 0) userMsg = activeList[uIdx];
      }

      if (!userMsg) {
        toast.error(t("chat.errors.regenerateNoSource"));
        return;
      }

      // ChatGPT 分支体验：保留原回答，以同一次提问为父节点分叉生成新回答版本！
      const prompt = userMsg.content;
      const attachments = userMsg.attachments;

      setRegenerating(true);
      try {
        await handleSendMessage(prompt, attachments, {
          parentMessageId: userMsg.id,
          regenerateMessageId: assistantId,
        });
      } finally {
        setRegenerating(false);
      }
    },
    [activeId, isStreaming, regenerating, handleSendMessage, t]
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
          streamingIds={streamingConversationIds}
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
                siblingInfoMap={siblingInfoMap}
                onSwitchBranch={handleSwitchBranch}
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

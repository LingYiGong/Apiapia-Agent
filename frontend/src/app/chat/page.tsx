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
import { useRefreshOnResume } from "@/hooks/useRefreshOnResume";
import { useWebSearchMode } from "@/hooks/useWebSearchMode";
import { messageEditGuardFlag } from "@/lib/messageEditGuard";
import { hydrateMessages } from "@/lib/message";
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

/**
 * 聊天页 = 流式会话状态机 + 五个移动端页签的容器。
 *
 * 两个刻意的结构决定：
 *
 * 1. **移动端只渲染当前页签**。此前 MemoryView / UsageView / SettingsView /
 *    MobileHistoryView 五份视图同时挂在 DOM 里（只靠 `hidden` 切显隐）。
 *    取数虽然按 `active` 收口了，但副作用没收：4 份 MobileHeader、
 *    4 个 UserAvatarMenu（各自带 Radix Menu + Portal）、4 个
 *    useRefreshOnResume 监听器，以及设置页的浮动保存条逻辑，全程在跑。
 *    现在按 active 条件渲染，非当前页签的组件根本不存在。
 *    代价是切页签会重新取一次数 —— 这本来就是 `active` 变化时要做的事。
 *
 * 2. **桌面端只渲染对话页**。桌面端有独立的 /memory /usage /settings 路由，
 *    /chat 里的这三份视图永远被 `md:hidden` 盖住，没有理由挂载。
 */
export default function ChatPage({
  initialConversationId,
}: {
  /** /chat/[id] 深链：挂载后自动打开指定会话 */
  initialConversationId?: string;
}) {
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
  const [imageModel, setImageModel] = useState<string>("dall-e-3");
  const [videoModel, setVideoModel] = useState<string>("");
  const [availableImageModels, setAvailableImageModels] = useState<ImageModelItem[]>([]);
  const [availableVideoModels, setAvailableVideoModels] = useState<VideoModelItem[]>([]);
  const [creationMode, setCreationMode] = useState<"chat" | "image" | "video">("chat");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [retrievedMemories, setRetrievedMemories] = useState<unknown[]>([]);

  // Mobile SPA Tab State
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

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
  // 本轮流式开始的时刻，供 ChatArea 自己驱动秒数显示。
  // 此前这里是每 80ms 递增一次的数值，等于每秒 12.5 次整页重渲染。
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);

  // Typewriter Refs
  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const firstTokenTimeRef = useRef<number | null>(null);
  const targetContentRef = useRef<string>("");
  const displayedContentRef = useRef<string>("");
  const isStreamCompletedRef = useRef<boolean>(false);
  const doneMetaRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef<boolean>(false);
  // 幂等锁：finalizeAssistantMessage 有两个调用方（打字机追平的定时器、
  // 以及 done 事件），停止生成时两者还可能同时命中。此前 finalize 会把
  // targetContentRef 清空，于是第二个调用方看到「已追平」就再 finalize 一次，
  // 追加出**内容为空的重复气泡**。这里用一次性闸门保证只落一条。
  const finalizedRef = useRef<boolean>(false);

  /** 停掉打字机 interval（秒数计时器已下沉到 ChatArea）。 */
  const clearStreamIntervals = () => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
  };

  /**
   * 中止在途的流。停止、重新发送、编辑、重新生成、卸载都走这里。
   *
   * **必须**先置 stopRequestedRef 再 abort，顺序不能反。此前只 abort 不置标记，
   * 而中止后 abortControllerRef 被立刻置 null，于是 catch 里的守卫
   * `stopRequestedRef.current || abortControllerRef.current?.signal.aborted`
   * 两项全落空（后者读的是 null 的 ?.signal），被中止的那一轮就会掉进错误分支，
   * 往列表里插一条假的「❌ 网络连接失败」气泡 —— 用户刚点了发送/重发就看到这个。
   */
  const abortInFlightStream = () => {
    stopRequestedRef.current = true;
    try {
      abortControllerRef.current?.abort();
    } catch (_) {}
    abortControllerRef.current = null;
  };

  useEffect(() => {
    return () => {
      // 卸载时必须同时停 interval **并中止请求**。此前只清了 interval，
      // fetch 仍在后台跑，它的 onToken / onDone 闭包会继续往已卸载的组件写状态，
      // 且 onDone 里的 finalizeAssistantMessage 还会额外发一次 /conversations 请求。
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
      stopRequestedRef.current = true; // 让中止后的 catch 分支保持静默
      try {
        abortControllerRef.current?.abort();
      } catch (_) {}
      abortControllerRef.current = null;
    };
  }, []);

  const [isMemoryOpen, setIsMemoryOpen] = useState(false);

  /**
   * 移动端关联记忆 Sheet 的开关。
   *
   * 桌面端右侧记忆侧栏是**常驻**的（与左侧会话侧栏对称），不存在开关 ——
   * 所以这个 state 只喂给 MobileChatHeader 的 Brain 按钮与 MemorySidebar 的
   * Sheet，DesktopChatHeader 里已经没有这个按钮。
   */
  const handleToggleMemory = useCallback(() => {
    setIsMemoryOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // SPA 路由同步：从 URL 还原页签。切页签用的是 history.replaceState
  // （不会触发 Next 的路由变化），所以只在挂载时读一次。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = parseMobileTab(params.get("tab"));
    if (tab) {
      setMobileTab(tab);
    } else if (params.get("openHistory") === "1") {
      // 历史页签的旧深链，保留兼容
      setMobileTab("history");
    }
  }, []);

  /**
   * 页签切换。
   *
   * 关键：**桌面端必须走真实路由**。此前这里无条件 setMobileTab("memory")，
   * 而移动端记忆侧栏底部的「前往长期记忆库」按钮在 chat/page 里总是拿到
   * onSelectMobileTab —— 桌面端点它会把 mobileTab 改成 memory。
   * 如果此时对话区按 mobileTab 条件渲染（我一度改成这样），桌面端就会
   * 直接丢掉对话区、只剩一个记忆库，而顶栏仍高亮「对话」、底栏在 md 以上
   * 不显示 —— 用户被卡住，只能手动改地址。
   *
   * 所以桌面端一律 router.push 到 /memory、/usage、/settings 这些真实路由；
   * 移动端才切 SPA 页签。isBelowMd() 在事件回调里调用，不涉及 SSR，
   * 不会有 hydration 问题。
   */
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
        apiRequest<{ active_providers: string[]; total: number; models: ModelCatalogItem[] }>(
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

      const userDef = settings?.default_model;
      if (userDef) {
        defaultModelRef.current = userDef;
      }

      // 服务端偏好优先于本地镜像
      webSearch.applyFromServer(settings?.web_search_mode);

      if (typeof settings?.memory_enabled === "boolean") {
        setMemoryEnabled(settings.memory_enabled);
      }

      // Choose active model
      if (models.length > 0) {
        if (!activeIdRef.current) {
          // 新对话：优先用用户配置的默认模型，其次 openrouter/free
          if (userDef && models.some((m) => m.id === userDef)) {
            setCurrentModel(userDef);
            try { localStorage.setItem("apiapia_preferred_model", userDef); } catch (_) {}
          } else if (models.some((m) => m.id === "openrouter/free")) {
            setCurrentModel("openrouter/free");
            try { localStorage.setItem("apiapia_preferred_model", "openrouter/free"); } catch (_) {}
          } else if (!models.some((m) => m.id === currentModel)) {
            setCurrentModel(models[0].id);
          }
        } else if (!models.some((m) => m.id === currentModel)) {
          // 已有会话：仅当当前模型已失效时才回退
          const fallback =
            userDef && models.some((m) => m.id === userDef)
              ? userDef
              : models.some((m) => m.id === "openrouter/free")
              ? "openrouter/free"
              : models[0].id;
          setCurrentModel(fallback);
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
      // 同步哪一类目录，取决于顶部当前展示的是哪一族模型。原先这里写死
      // /models/sync，于是切到图片 / 视频模式后点刷新会去同步语言模型 ——
      // 报「发现 0 个新语言模型」，而用户眼前那一族列表纹丝不动。
      const target =
        creationMode === "image"
          ? { path: "/models/sync-images", scope: "绘图模型" as const, emptyKey: "image" as const }
          : creationMode === "video"
          ? { path: "/models/sync-videos", scope: "视频模型" as const, emptyKey: "video" as const }
          : { path: "/models/sync", scope: "语言模型" as const, emptyKey: "chat" as const };

      const syncRes = await apiRequest<{
        success: boolean;
        new_count: number;
        new_models: ModelCatalogItem[];
        message: string;
      }>(target.path, { method: "POST" });

      const counts = await loadConfiguredModels();

      notifyModelSyncResult({
        scope: target.scope,
        newCount: syncRes.new_count || 0,
        message: syncRes.message,
        // 「同步成功但列表还是空的」必须报错而不是报成功 —— 这几乎总是
        // 查询参数写错或凭证没生效，说成功只会把人引向错误方向。
        emptyResult: counts !== null && counts[target.emptyKey] === 0,
      });
    } catch (err: any) {
      console.error("Failed to sync models:", err);
      toast.error(err.message || "同步模型失败，请检查后台 .env 配置");
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
    // hydrateFromStorage 只在挂载时读一次 localStorage，故意不进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectConversation = async (id: string) => {
    setActiveId(id);
    activeIdRef.current = id;
    setStreamingContent("");
    setRetrievedMemories([]);
    // 立刻清空旧消息，让消息区显示骨架屏，而不是残留上一个会话的内容
    setMessages([]);
    setLoadingMessages(true);
    setMobileTab("chat");

    // Restore this conversation's saved model if present
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
        toast.error("记忆开关未能保存到服务器，刷新后会恢复原状态");
      });
      return next;
    });
  }, []);

  const finalizeAssistantMessage = () => {
    // 幂等：停止生成时「打字机追平」与「done 事件」可能同时调用本函数，
    // 若都执行下去就会追加两条助手消息（其中一条内容为空）。
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    clearStreamIntervals();

    const doneMeta = doneMetaRef.current;
    const finalContent = targetContentRef.current || displayedContentRef.current;

    // 思考耗时 = 首 token 时间 - 请求发出时间
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
        generatedVideos: generatedVideos && generatedVideos.length > 0 ? [...generatedVideos] : undefined,
        finish_reason: finishReason,
        created_at: doneMeta?.created_at || new Date().toISOString(),
      },
    ]);

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

  /**
   * 发送 / 重发的唯一入口。
   *
   * 刻意用 useCallback 固化：编辑与重新生成都要调用它，而这两个 handler 自己也
   * 是 useCallback。此前 handleSendMessage 每次渲染重建，handleEditMessage 的依赖
   * 数组里又不能写它（原注释称「它读的是最新 refs」——这是错的，它闭包捕获了
   * currentModel 与 memoryEnabled），于是「改了模型再编辑消息」会用**上一个模型**
   * 重新发送。改成依赖 [activeId, currentModel, memoryEnabled] 之后，
   * 模型一变依赖就变，闭包必然是最新的。
   *
   * 其余依赖（messages、conversations、isStreaming）都不需要进数组：
   * messages 走 messagesRef，isStreaming 的门禁在调用方（handleRegenerate /
   * ChatArea 的按钮 disabled）已经做了。
   */
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
      }
    ) => {
      // Clear any previous running intervals
      clearStreamIntervals();
      // 上一轮若有流在途（停止后到 done 之间、或连点两次发送），先中止它，
      // 否则两个 reader 会同时往 targetContentRef / 同一个 state 写。
      abortInFlightStream();
      if (finalizedRef.current) finalizedRef.current = false;

      // Add user message to UI immediately
      const userMsg: Message = {
        role: "user",
        content: (text || "").trim(),
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
      setSearchStatus({ state: "idle" });
      setStreamingSearchResults(null);
      currentSearchResultsRef.current = null;
      currentToolInvocationsRef.current = [];
      currentGeneratedImagesRef.current = [];
      currentGeneratedVideosRef.current = [];

      startTimeRef.current = Date.now();
      // 秒数显示由 ChatArea 用这个时间戳自行驱动，页面级不再需要 80ms 轮询。
      setStreamStartedAt(startTimeRef.current);
      firstTokenTimeRef.current = null;
      targetContentRef.current = "";
      displayedContentRef.current = "";
      isStreamCompletedRef.current = false;
      doneMetaRef.current = null;
      // 必须在上面 abortInFlightStream() 之后清回 false：本轮要正常跑，
      // catch 的「是否用户主动停止」判定必须读到 false。
      stopRequestedRef.current = false;
      abortControllerRef.current = new AbortController();

      // 打字机动画循环
      typewriterIntervalRef.current = setInterval(() => {
        const target = targetContentRef.current;
        const current = displayedContentRef.current;
        const remaining = target.length - current.length;

        if (remaining > 0) {
          // 自适应步长：接近时逐字平滑，缓冲变多时加速
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
          // 流已结束且缓冲吐完
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
            web_search_mode: extraOptions?.webSearchMode || webSearch.modeRef.current,
            image_gen_mode: extraOptions?.imageGenMode,
            video_gen_mode: extraOptions?.videoGenMode,
            attachments: attachments && attachments.length > 0 ? attachments : undefined,
            quoted_message_id: extraOptions?.quotedMessageId,
            quoted_content: extraOptions?.quotedContent,
            system_prompt_override: extraOptions?.systemPromptOverride,
            reasoning_effort: extraOptions?.reasoningEffort,
            max_tokens: extraOptions?.maxTokens,
          },
          {
            onMeta: (meta) => {
              if (meta.conversation_id) {
                setActiveId(meta.conversation_id);
                activeIdRef.current = meta.conversation_id;
                loadConversations();
              }
              if (meta.retrieved_memories && meta.retrieved_memories.length > 0) {
                setRetrievedMemories(meta.retrieved_memories);
              }
              // 采用服务端分配的 id，让逐条操作（编辑、重新生成）无需等刷新即可用
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
              const idx = currentToolInvocationsRef.current.findIndex(
                (t) => t.toolCallId === data.toolCallId
              );
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
            onVideoResult: (data) => {
              currentGeneratedVideosRef.current.push({
                id: data.videoId ?? undefined,
                prompt: data.prompt,
                provider: data.provider,
                model: data.model,
              });
            },
            onToken: (token) => {
              // 记录首 token 时间（TTFT）
              if (firstTokenTimeRef.current === null) {
                firstTokenTimeRef.current = Date.now();
                setIsWaitingForFirstToken(false);
                setThinkingDuration((firstTokenTimeRef.current - startTimeRef.current) / 1000);
              }
              targetContentRef.current += token;
            },
            onError: (err) => {
              // 主动停止：状态已由 handleStopGenerating 复位
              if (stopRequestedRef.current) return;
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
                  content: err || "❌ 后端未知错误，请检查服务器日志",
                  // 打上错误标记：ChatMessageItem 靠 finish_reason 决定是否套用错误
                  // 样式（此前靠内容里是否含「HTTP 500」等字符串来嗅探，会把用户正常
                  // 引用这些字样的消息也渲染成红色错误卡片）。
                  finish_reason: "error",
                },
              ]);
            },
            onDone: (doneMeta) => {
              isStreamCompletedRef.current = true;
              doneMetaRef.current = doneMeta;
              if (doneMeta.search_results && doneMeta.search_results.length > 0) {
                currentSearchResultsRef.current = doneMeta.search_results;
                setStreamingSearchResults(doneMeta.search_results);
              }
              // 若打字机已追平，立刻收尾
              if (targetContentRef.current.length === displayedContentRef.current.length) {
                finalizeAssistantMessage();
              }
            },
          },
          { signal: abortControllerRef.current?.signal }
        );
      } catch (err: any) {
        // 主动停止：状态已复位，保持静默
        if (stopRequestedRef.current || abortControllerRef.current?.signal.aborted) {
          return;
        }
        clearStreamIntervals();
        setIsStreaming(false);
        setStreamStartedAt(null);
        setIsWaitingForFirstToken(false);
        setSearchStatus({ state: "idle" });
        // streamChatResponse 对 HTTP 失败抛 ApiError，所以要区分两类：
        // ApiError 是服务端明确返回的错误（文案已带原因），其余是连接失败。
        const isApiError = err instanceof ApiError;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: isApiError ? `❌ ${err.message}` : `❌ 网络连接失败: ${err?.message || err}`,
            finish_reason: "error",
          },
        ]);
      }
    },
    // 见上方注释：activeId / currentModel / memoryEnabled 必须在依赖里，
    // 否则编辑 / 重新生成会拿旧模型发送。clearStreamIntervals 与
    // abortInFlightStream 只操作 ref，身份稳定，无需列入。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, currentModel, memoryEnabled]
  );

  const handleStopGenerating = () => {
    if (!isStreaming) return;
    // 幂等锁：停止生成在「正在打字」和「已追平」两种状态下都会被点，
    // 重复调用会把已落地的回复再追加一条（内容为空的重复气泡）。
    if (finalizedRef.current) return;
    stopRequestedRef.current = true;
    abortInFlightStream();
    clearStreamIntervals();

    // 后端会把部分回复带 finish_reason='abort' 落库，所以保留已生成内容
    doneMetaRef.current = {
      finish_reason: "abort",
      created_at: new Date().toISOString(),
    };
    // 注意：这里**不要**提前把 isStreamCompletedRef 置 true。
    // finalize 会把 targetContentRef 清空；若此时 done 事件恰好到达，
    // onDone 看到「已追平」就会再 finalize 一次，追加出一条空白重复消息。
    if (targetContentRef.current.length === displayedContentRef.current.length) {
      finalizeAssistantMessage();
    } else {
      // 还有缓冲没打完：置位让打字机在追平后自行 finalize
      isStreamCompletedRef.current = true;
    }
  };

  /* ── 切后台 / 切页签回来后刷新 ──────────────────────────────────
     移动端切后台不会卸载页面，不主动重拉就会一直显示旧数据（必须杀进程才更新）。
     刻意做「静默刷新」：不调用 selectConversation，避免清空消息区、切页签，
     以及覆盖刚刚流式生成出来的内容。
     不用 useCallback —— useRefreshOnResume 内部用 ref 持有最新函数。

     位置：必须声明在 handleEditMessage 之前。后者会调用它，而 const 箭头函数
     在定义之前被引用属于 TDZ（虽然调用被推迟到渲染之后才侥幸不炸，但那是
     靠时序侥幸，不是靠正确性）。 */
  const refreshFromServer = async () => {
    await loadConversations();

    const id = activeIdRef.current;
    // 正在内联编辑某条消息时不要覆盖，否则用户没提交的内容会被冲掉
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

  // ── Per-message actions (regenerate / edit) ─────────────────────────

  const handleEditMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!activeId || !messageId) return;
      // 与 handleRegenerate 同一道门禁：编辑期间再触发一次重发会开出第二个流，
      // 两个 reader 同时往同一个 state 写。
      if (isStreaming || regenerating) return;
      const clean = newText.trim();
      if (!clean) {
        toast.error("消息内容不能为空");
        return;
      }

      const before = messagesRef.current;

      // 截断 + 重发必须作为一个整体看待：此前先 POST truncate 再发送，
      // 一旦发送失败（断网 / 4xx），被截掉的那一轮已经**永久丢失**且无法恢复。
      // 现在失败时把本地列表还原回去，用户至少还能看到原来的对话并手动重试。
      const rollback = () => setMessages(before);
      let truncatedOnServer = false;

      try {
        // 移除本轮及其后续消息以重建分支，与 ChatGPT 编辑提问的行为一致
        await apiRequest(`/conversations/${activeId}/messages/${messageId}/truncate`, {
          method: "POST",
        });
        truncatedOnServer = true;
        const cutIndex = before.findIndex((m) => m.id === messageId);
        setMessages(
          cutIndex >= 0 ? before.slice(0, cutIndex) : before.filter((m) => m.id !== messageId)
        );
        await handleSendMessage(clean);
      } catch (err: any) {
        if (!truncatedOnServer) {
          // 截断本身失败：服务端数据没动过，本地还原即可无损重试
          rollback();
          toast.error(err.message || "编辑消息失败");
          return;
        }
        // 截断已生效、重发失败：服务端分支已被裁掉。此时**不能**把本地列表还原回
        // `before` —— 那会渲染出一批服务端已经不存在的消息，刷新后又凭空消失。
        abortInFlightStream();
        clearStreamIntervals();
        setIsStreaming(false);
        setStreamStartedAt(null);
        setIsWaitingForFirstToken(false);
        setStreamingContent("");
        setSearchStatus({ state: "idle" });
        void refreshFromServer();
        toast.warning("重发失败，对话已按新提问裁剪", {
          description: `${err?.message || "网络异常"}。该消息之后的内容已被删除，可重新发送或刷新页面查看最新状态。`,
          duration: 5000,
        });
      }
    },
    [activeId, isStreaming, regenerating, handleSendMessage]
  );

  const handleRegenerate = useCallback(
    async (assistantId: string) => {
      if (!activeId || isStreaming || regenerating || !assistantId) return;

      const list = messagesRef.current;
      const idx = list.findIndex((m) => m.id === assistantId);
      if (idx < 0) return;

      // 回溯到产生这条回复的用户提问
      let userIdx = idx - 1;
      while (userIdx >= 0 && list[userIdx].role !== "user") userIdx--;
      if (userIdx < 0) {
        toast.error("找不到对应的提问，无法重新生成");
        return;
      }
      const prompt = list[userIdx].content;

      const rollback = () => setMessages(list);

      setRegenerating(true);
      try {
        await apiRequest(`/conversations/${activeId}/messages/${assistantId}`, {
          method: "DELETE",
        });
        setMessages(list.slice(0, idx));
        await handleSendMessage(prompt);
      } catch (err: any) {
        rollback();
        toast.error(err.message || "重新生成失败");
      } finally {
        setRegenerating(false);
      }
    },
    [activeId, isStreaming, regenerating, handleSendMessage]
  );

  /* ── 深链：/chat/<id> 挂载后打开该会话 ────────────────────────────
     此前 [id]/page.tsx 直接渲染 ChatPage 且从不读 id，于是任何 /chat/xxx
     都能打开，却永远进不去那个会话 —— 一个静默失效的深链。 */
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!initialConversationId || loadingConversations) return;
    deepLinkHandledRef.current = true;
    // 列表里没有这个 id（已删除 / 不属于当前用户）时不跳转，让页面正常显示
    if (conversations.some((c) => c.id === initialConversationId)) {
      selectConversation(initialConversationId);
    }
  }, [initialConversationId, loadingConversations, conversations]);

  if (loading || !user) {
    return <FullPageSkeleton variant="chat" />;
  }

  /**
   * 对话区：桌面端恒显示，移动端仅当当前页签是 chat 时显示。
   *
   * 这里**不能**改成「只在 mobileTab === 'chat' 时挂载」—— 桌面端的
   * mobileTab 可能被设成 history/memory（见 handleSelectMobileTab 的注释），
   * 一旦那样挂载就会丢掉整个对话区。CSS 隐藏是唯一 SSR 安全且不会丢内容的做法。
   */
  const showChat = mobileTab === "chat";
  const showSpaTab = (tab: MobileTab) => mobileTab === tab;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <DesktopNavbar />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
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
          loading={loadingConversations}
        />

        {/* 对话页 */}
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
              />

              <DesktopChatHeader
                currentModel={activeModelId}
                onModelChange={handleModelChange}
                availableModels={activeModelCatalog}
                onRefreshModels={handleManualSyncModels}
                isRefreshingModels={isRefreshingModels}
                activeConversation={conversations.find((c) => c.id === activeId) || null}
                onTogglePin={handleTogglePin}
                onRename={handleRenameConversation}
                onDelete={handleDeleteConversation}
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
                onChangeCreationMode={setCreationMode}
              />
            </div>
          );
        })()}

        {/* ── 移动端 SPA 页签 ──
            只挂载当前页签：此前五份视图同时挂在 DOM 里（只靠 hidden 切显隐），
            取数虽然按 active 收口了，但 4 份 MobileHeader、4 个 UserAvatarMenu、
            4 个 useRefreshOnResume 监听器以及设置页的保存条逻辑全程在跑。
            容器仍然带 md:hidden，桌面端这些路由另有独立页面。 */}
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
          memories={retrievedMemories}
          memoryEnabled={memoryEnabled}
          onToggleMemory={handleToggleMemoryEnabled}
          isOpen={isMemoryOpen}
          onClose={() => setIsMemoryOpen(false)}
          onSelectMobileTab={handleSelectMobileTab}
        />
      </div>

      {/* 移动端底部标签栏：自然流式排布在容器最底端，零 fixed、零重叠遮挡 */}
      <MobileTabBar
        activeMobileTab={mobileTab}
        onSelectMobileTab={handleSelectMobileTab}
        onNewChat={handleNewChat}
      />
    </div>
  );
}

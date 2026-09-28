"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest, streamChatResponse } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { MemorySidebar } from "@/components/chat/MemorySidebar";
import { Conversation, Message, ModelCatalogItem, AttachmentItem, SearchResultItem } from "@/types";

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [currentModel, setCurrentModel] = useState("gpt-4o-mini");
  const defaultModelRef = useRef<string>("gpt-4o-mini");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [retrievedMemories, setRetrievedMemories] = useState<any[]>([]);

  // Web search state: "auto" (default, smart auto-trigger) | "on" (force on) | "off" (disabled)
  const [webSearchMode, setWebSearchMode] = useState<"auto" | "on" | "off">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("personal_ai_web_search_mode") as "auto" | "on" | "off" | null;
      if (saved && ["auto", "on", "off"].includes(saved)) return saved;
    }
    return "auto";
  });

  const handleToggleWebSearchMode = () => {
    setWebSearchMode((prev) => {
      const next = prev === "auto" ? "on" : prev === "on" ? "off" : "auto";
      try {
        localStorage.setItem("personal_ai_web_search_mode", next);
      } catch (e) {}
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

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
    };
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleModelChange = async (newModel: string) => {
    setCurrentModel(newModel);
    try {
      localStorage.setItem("personal_ai_preferred_model", newModel);
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
  const loadConversations = async (autoSelectFirst = false) => {
    try {
      const list = await apiRequest<Conversation[]>("/conversations");
      setConversations(list);
      if (autoSelectFirst && list.length > 0 && !activeIdRef.current) {
        selectConversation(list[0].id, list);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
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

      // Choose active model
      if (models.length > 0) {
        if (!activeIdRef.current) {
          // Fresh new chat: ALWAYS prioritize user's configured default model
          if (userDef && models.some((m) => m.id === userDef)) {
            setCurrentModel(userDef);
            try { localStorage.setItem("personal_ai_preferred_model", userDef); } catch (e) {}
          } else if (!models.some((m) => m.id === currentModel)) {
            setCurrentModel(models[0].id);
          }
        } else {
          // Inside existing conversation: only fallback if current model is invalid
          if (!models.some((m) => m.id === currentModel)) {
            const fallback = (userDef && models.some((m) => m.id === userDef)) ? userDef : models[0].id;
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

      if (syncRes.new_count > 0) {
        alert(
          `🎉 同步成功！发现了 ${syncRes.new_count} 个新模型：\n\n` +
          syncRes.new_models.map((m) => `• ${m.name} (${m.id})`).join("\n")
        );
      } else {
        alert("✅ 模型列表已是最新，未从提供商检测到新增模型。");
      }
    } catch (err: any) {
      console.error("Failed to sync models:", err);
      alert(err.message || "同步模型失败，请检查后台 .env 配置");
    } finally {
      setIsRefreshingModels(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadConversations(true);
      loadConfiguredModels();
    }
  }, [user]);

  const selectConversation = async (id: string, customList?: Conversation[]) => {
    setActiveId(id);
    activeIdRef.current = id;
    setStreamingContent("");
    setRetrievedMemories([]);

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
        setMessages(msgs || []);
        if (mems && mems.length > 0) {
          setRetrievedMemories(mems);
        }
      }
    } catch (err) {
      console.error("Failed to load conversation details:", err);
    }
  };

  const handleNewChat = () => {
    setActiveId(null);
    activeIdRef.current = null;
    setMessages([]);
    setStreamingContent("");
    setRetrievedMemories([]);

    // Always reset to user's configured default model from Settings!
    const userDef = defaultModelRef.current;
    if (userDef && availableModels.some((m) => m.id === userDef)) {
      setCurrentModel(userDef);
      try { localStorage.setItem("personal_ai_preferred_model", userDef); } catch (e) {}
    } else if (availableModels.length > 0) {
      setCurrentModel(availableModels[0].id);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await apiRequest(`/conversations/${id}`, { method: "DELETE" });
      const updated = conversations.filter((c) => c.id !== id);
      setConversations(updated);
      if (activeId === id) {
        if (updated.length > 0) {
          selectConversation(updated[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleRestoreConversation = async (id: string) => {
    try {
      await apiRequest(`/conversations/${id}/restore`, { method: "POST" });
      await loadConversations(false);
      selectConversation(id);
    } catch (err) {
      console.error("Failed to restore conversation:", err);
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

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: finalContent,
        model: doneMeta?.model || currentModel,
        duration_ms: totalDurationMs,
        thinking_duration_ms: finalThinkingMs,
        prompt_tokens: doneMeta?.prompt_tokens,
        completion_tokens: doneMeta?.completion_tokens,
        token_usage: doneMeta?.total_tokens,
        search_results: searchResults && searchResults.length > 0 ? searchResults : undefined,
        created_at: doneMeta?.created_at || new Date().toISOString(),
      },
    ]);

    setIsStreaming(false);
    setIsWaitingForFirstToken(false);
    setStreamingContent("");
    setSearchStatus({ state: "idle" });
    setStreamingSearchResults(null);
    currentSearchResultsRef.current = null;
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
          web_search_mode: webSearchMode,
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
        }
      );
    } catch (err: any) {
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

  if (loading || !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onToggleMemory={() => setIsMemoryOpen((prev) => !prev)}
        hasMemories={retrievedMemories.length > 0}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onNewChat={handleNewChat}
          onDelete={handleDeleteConversation}
          onRestore={handleRestoreConversation}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <ChatArea
          messages={messages}
          currentModel={currentModel}
          onModelChange={handleModelChange}
          availableModels={availableModels}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          thinkingDuration={thinkingDuration}
          elapsedTime={elapsedTime}
          isWaitingForFirstToken={isWaitingForFirstToken}
          onRefreshModels={handleManualSyncModels}
          isRefreshingModels={isRefreshingModels}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onToggleMemory={() => setIsMemoryOpen((prev) => !prev)}
          memoriesCount={retrievedMemories.length}
          onNewChat={handleNewChat}
          webSearchMode={webSearchMode}
          onToggleWebSearchMode={handleToggleWebSearchMode}
          searchStatus={searchStatus}
          streamingSearchResults={streamingSearchResults}
        />
        <MemorySidebar
          memories={retrievedMemories}
          memoryEnabled={memoryEnabled}
          onToggleMemory={() => setMemoryEnabled(!memoryEnabled)}
          isOpen={isMemoryOpen}
          onClose={() => setIsMemoryOpen(false)}
        />
      </div>
    </div>
  );
}

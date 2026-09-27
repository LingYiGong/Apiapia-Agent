"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest, streamChatResponse } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { MemorySidebar } from "@/components/chat/MemorySidebar";
import { Conversation, Message, ModelCatalogItem, AttachmentItem } from "@/types";

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", description: "高效轻量" },
    { id: "gpt-4o", name: "GPT-4o", provider: "openai", description: "旗舰模型" },
    { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet", provider: "anthropic", description: "代码与逻辑" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "gemini", description: "极速响应" },
    { id: "llama3:latest", name: "Ollama Llama 3", provider: "ollama", description: "本地模型" },
  ]);
  const [currentModel, setCurrentModel] = useState("gpt-4o-mini");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [retrievedMemories, setRetrievedMemories] = useState<any[]>([]);

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

      // Choose an active model
      if (models.length > 0) {
        const savedPref = typeof window !== "undefined" ? localStorage.getItem("personal_ai_preferred_model") : null;
        if (!activeIdRef.current) {
          if (savedPref && models.some((m) => m.id === savedPref)) {
            setCurrentModel(savedPref);
          } else if (settings?.default_model && models.some((m) => m.id === settings.default_model)) {
            setCurrentModel(settings.default_model);
          } else if (!models.some((m) => m.id === currentModel)) {
            setCurrentModel(models[0].id);
          }
        } else {
          if (!models.some((m) => m.id === currentModel)) {
            const preferred = models.find((m) => m.id === settings?.default_model) || models[0];
            setCurrentModel(preferred.id);
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
    try {
      const savedPref = localStorage.getItem("personal_ai_preferred_model");
      if (savedPref && availableModels.some((m) => m.id === savedPref)) {
        setCurrentModel(savedPref);
      }
    } catch (e) {}
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
        created_at: doneMeta?.created_at || new Date().toISOString(),
      },
    ]);

    setIsStreaming(false);
    setIsWaitingForFirstToken(false);
    setStreamingContent("");
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
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: err || "❌ 后端未知错误，请检查服务器日志" },
            ]);
          },
          onDone: (doneMeta) => {
            isStreamCompletedRef.current = true;
            doneMetaRef.current = doneMeta;

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
          onRefreshModels={loadConfiguredModels}
          isRefreshingModels={isRefreshingModels}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onToggleMemory={() => setIsMemoryOpen((prev) => !prev)}
          memoriesCount={retrievedMemories.length}
          onNewChat={handleNewChat}
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

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest, streamChatResponse } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { MemorySidebar } from "@/components/chat/MemorySidebar";
import { Conversation, Message, ModelCatalogItem } from "@/types";

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Load conversations & settings
  const loadConversations = async () => {
    try {
      const list = await apiRequest<Conversation[]>("/conversations");
      setConversations(list);
      if (list.length > 0 && !activeId) {
        selectConversation(list[0].id);
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
        // If current model is not in configured list, pick the first one or settings default
        if (!models.some((m) => m.id === currentModel)) {
          const preferred = models.find((m) => m.id === settings?.default_model);
          setCurrentModel(preferred ? preferred.id : models[0].id);
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
      loadConversations();
      loadConfiguredModels();
    }
  }, [user]);

  const selectConversation = async (id: string) => {
    setActiveId(id);
    setStreamingContent("");
    setRetrievedMemories([]);
    try {
      const msgs = await apiRequest<Message[]>(`/conversations/${id}/messages`);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const handleNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setStreamingContent("");
    setRetrievedMemories([]);
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

  const handleSendMessage = async (text: string) => {
    // Add user message to UI immediately
    const userMsg: Message = {
      role: "user",
      content: text,
      model: currentModel,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent("");

    let accumulatedContent = "";

    await streamChatResponse(
      {
        conversation_id: activeId || undefined,
        message: text,
        model: currentModel,
        memory_enabled: memoryEnabled,
      },
      {
        onMeta: (meta) => {
          if (!activeId && meta.conversation_id) {
            setActiveId(meta.conversation_id);
            loadConversations();
          }
          if (meta.retrieved_memories) {
            setRetrievedMemories(meta.retrieved_memories);
          }
        },
        onToken: (token) => {
          accumulatedContent += token;
          setStreamingContent(accumulatedContent);
        },
        onError: (err) => {
          console.error("Stream error:", err);
          setIsStreaming(false);
          // Return FULL detailed backend error directly to chat window
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: err || "❌ 后端未知错误，请检查服务器日志" },
          ]);
        },
        onDone: (convId) => {
          setIsStreaming(false);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: accumulatedContent, model: currentModel },
          ]);
          setStreamingContent("");
          loadConversations();
        },
      }
    );
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onNewChat={handleNewChat}
          onDelete={handleDeleteConversation}
        />
        <ChatArea
          messages={messages}
          currentModel={currentModel}
          onModelChange={setCurrentModel}
          availableModels={availableModels}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          onRefreshModels={loadConfiguredModels}
          isRefreshingModels={isRefreshingModels}
        />
        <MemorySidebar
          memories={retrievedMemories}
          memoryEnabled={memoryEnabled}
          onToggleMemory={() => setMemoryEnabled(!memoryEnabled)}
        />
      </div>
    </div>
  );
}

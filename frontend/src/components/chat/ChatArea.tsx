"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, ModelCatalogItem } from "@/types";
import {
  Send,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  Search,
  RotateCw,
  Cpu,
  Check,
  AlertTriangle,
} from "lucide-react";

interface ChatAreaProps {
  messages: Message[];
  currentModel: string;
  onModelChange: (model: string) => void;
  availableModels: ModelCatalogItem[];
  onSendMessage: (message: string) => void;
  isStreaming: boolean;
  streamingContent: string;
  onRefreshModels?: () => void;
  isRefreshingModels?: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  currentModel,
  onModelChange,
  availableModels,
  onSendMessage,
  isStreaming,
  streamingContent,
  onRefreshModels,
  isRefreshingModels = false,
}) => {
  const [input, setInput] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>("all");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Click outside to close model dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    if (modelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [modelDropdownOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  // Filter models by search query and provider
  const filteredModels = availableModels.filter((m) => {
    const matchesSearch =
      m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      (m.provider && m.provider.toLowerCase().includes(modelSearch.toLowerCase()));

    const matchesProvider =
      selectedProviderFilter === "all" ||
      (m.provider && m.provider.toLowerCase() === selectedProviderFilter.toLowerCase());

    return matchesSearch && matchesProvider;
  });

  // Extract distinct providers for filter tags
  const distinctProviders = Array.from(
    new Set(availableModels.map((m) => m.provider).filter(Boolean))
  );

  const activeModelObj = availableModels.find((m) => m.id === currentModel);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Top Bar with Searchable Model Picker */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/50 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 relative" ref={dropdownRef}>
          <span className="text-xs text-slate-400 font-medium">当前模型：</span>

          {/* Trigger Button */}
          <button
            type="button"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs text-white hover:border-indigo-500/80 transition-all shadow-sm max-w-xs md:max-w-md truncate"
          >
            <Cpu className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span className="truncate font-medium">
              {activeModelObj ? activeModelObj.name : currentModel || "请选择模型"}
            </span>
            {activeModelObj?.provider && (
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 shrink-0">
                {activeModelObj.provider}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
          </button>

          {/* Refresh/Sync Models Button */}
          {onRefreshModels && (
            <button
              type="button"
              onClick={onRefreshModels}
              disabled={isRefreshingModels}
              title="根据后端填写的 API Key 自动更新/检测已支持的模型列表"
              className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/50 px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRefreshingModels ? "animate-spin text-indigo-400" : ""}`} />
              <span className="hidden sm:inline">更新模型</span>
            </button>
          )}

          {/* Searchable Dropdown Modal/Panel */}
          {modelDropdownOpen && (
            <div className="absolute left-0 top-10 mt-1 w-80 sm:w-96 rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md p-3 z-50 flex flex-col max-h-[75vh]">
              {/* Search Box */}
              <div className="relative mb-2.5">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索模型（如：claude, deepseek, gpt...）"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Provider Filter Badges */}
              {distinctProviders.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap mb-2.5 pb-2 border-b border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setSelectedProviderFilter("all")}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      selectedProviderFilter === "all"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    全部 ({availableModels.length})
                  </button>
                  {distinctProviders.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedProviderFilter(p)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase font-mono transition-colors ${
                        selectedProviderFilter === p
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Model Items List */}
              <div className="overflow-y-auto flex-1 space-y-1 pr-1">
                {filteredModels.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    {availableModels.length === 0 ? (
                      <div className="space-y-2 p-2">
                        <AlertTriangle className="h-6 w-6 text-amber-500/80 mx-auto" />
                        <p className="text-slate-300 font-medium">未检测到已填写 Key 的模型</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          请在后端 .env 或设置页面配置 API Key，然后点击上方“更新模型”。
                        </p>
                      </div>
                    ) : (
                      "未找到符合条件的模型"
                    )}
                  </div>
                ) : (
                  filteredModels.map((m) => {
                    const isSelected = m.id === currentModel;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          onModelChange(m.id);
                          setModelDropdownOpen(false);
                        }}
                        className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-600/20 border border-indigo-500/40 text-white"
                            : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate group-hover:text-indigo-300">
                              {m.name}
                            </span>
                            {m.provider && (
                              <span className="text-[9px] uppercase font-mono px-1 rounded bg-slate-800 text-slate-400 border border-slate-700/60 shrink-0">
                                {m.provider}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                            {m.id}
                          </p>
                          {m.description && (
                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                              {m.description}
                            </p>
                          )}
                        </div>

                        {isSelected && (
                          <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto pt-16">
            <div className="h-14 w-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-600/10">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">欢迎使用私人 AI 助理</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              这里拥有完全独立的长期记忆存储与多模型切换支持。输入关于你的偏好、生活或项目背景，AI 会在后续所有对话中主动召回并保持连贯。
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={index}
              className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
            >
              <div
                className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-white ${
                  isUser ? "bg-indigo-600" : "bg-slate-800 border border-slate-700"
                }`}
              >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-indigo-400" />}
              </div>

              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "bg-slate-900 border border-slate-800 text-slate-200"
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Current Streaming Message */}
        {isStreaming && (
          <div className="flex gap-3 max-w-3xl mr-auto">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700 text-white">
              <Bot className="h-4 w-4 text-indigo-400 animate-pulse" />
            </div>
            <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-slate-900 border border-slate-800 text-slate-200">
              <div className="prose prose-invert prose-sm max-w-none break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingContent || "..."}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="max-w-3xl mx-auto relative flex items-end rounded-2xl border border-slate-700/80 bg-slate-950 p-2 focus-within:border-indigo-500 shadow-lg">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送，Shift + Enter 换行)"
            className="w-full resize-none bg-transparent px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none max-h-44"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-500 active:scale-95 transition-all shrink-0 ml-1 shadow-md shadow-indigo-600/20"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, ModelCatalogItem } from "@/types";
import { isFreeModel } from "@/components/common/ModelSelect";
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
  Clock,
  Zap,
  Menu,
  Brain,
  Plus,
} from "lucide-react";

function formatTime(isoStr?: string) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function renderMessageBody(content: string, isStreaming = false) {
  if (!content) return null;

  if (content.includes("<think>")) {
    const thinkEndIndex = content.lastIndexOf("</think>");
    let thought = "";
    let mainContent = "";

    if (thinkEndIndex !== -1) {
      // Collect all think sections cleanly even if fragmented
      const thinkMatches = Array.from(content.matchAll(/<think>([\s\S]*?)<\/think>/gi));
      if (thinkMatches.length > 0) {
        thought = thinkMatches.map((m) => m[1].trim()).filter(Boolean).join(" ");
        mainContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      } else {
        thought = content.substring(content.indexOf("<think>") + 7, thinkEndIndex).trim();
        mainContent = content.substring(thinkEndIndex + 8).trim();
      }
    } else {
      // Currently in-stream thinking (unclosed <think>)
      thought = content.substring(content.indexOf("<think>") + 7).trim();
      mainContent = "";
    }

    return (
      <div className="space-y-2.5">
        {thought && (
          <details
            className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-2.5 text-xs group transition-all"
            open={isStreaming && !mainContent}
          >
            <summary className="cursor-pointer select-none font-medium text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                <span>思考过程</span>
              </span>
              <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <div className="mt-2 pl-2.5 border-l-2 border-indigo-400 dark:border-indigo-600 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto leading-relaxed">
              {thought}
            </div>
          </details>
        )}
        {mainContent ? (
          <div className="prose dark:prose-invert prose-sm max-w-none break-words text-slate-800 dark:text-slate-200 overflow-x-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {mainContent}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-indigo-600 dark:bg-indigo-400 animate-pulse align-middle" />
            )}
          </div>
        ) : isStreaming ? (
          <div className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 pt-1 font-mono">
            <Sparkles className="h-3.5 w-3.5 animate-spin" />
            <span>正在组织语言回答...</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="prose dark:prose-invert prose-sm max-w-none break-words text-slate-800 dark:text-slate-200 overflow-x-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-indigo-600 dark:bg-indigo-400 animate-pulse align-middle" />
      )}
    </div>
  );
}

interface ChatAreaProps {
  messages: Message[];
  currentModel: string;
  onModelChange: (model: string) => void;
  availableModels: ModelCatalogItem[];
  onSendMessage: (message: string) => void;
  isStreaming: boolean;
  streamingContent: string;
  thinkingDuration?: number | null;
  elapsedTime?: number;
  isWaitingForFirstToken?: boolean;
  onRefreshModels?: () => void;
  isRefreshingModels?: boolean;
  onToggleSidebar?: () => void;
  onToggleMemory?: () => void;
  memoriesCount?: number;
  onNewChat?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  currentModel,
  onModelChange,
  availableModels,
  onSendMessage,
  isStreaming,
  streamingContent,
  thinkingDuration,
  elapsedTime = 0,
  isWaitingForFirstToken = false,
  onRefreshModels,
  isRefreshingModels = false,
  onToggleSidebar,
  onToggleMemory,
  memoriesCount = 0,
  onNewChat,
}) => {
  const [input, setInput] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>("all");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Monitor user scrolling to detect if user has scrolled away from the bottom
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 120; // distance from bottom in px considered "at bottom"
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom <= threshold;
    isAtBottomRef.current = atBottom;
    setShowScrollBottomBtn(!atBottom);
  };

  const scrollToBottom = (force = false, smooth = true) => {
    // If not forced and user has scrolled up to read history, DO NOT pull them down!
    if (!force && !isAtBottomRef.current) return;
    const container = scrollContainerRef.current;
    if (container) {
      if (smooth) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  };

  // When new tokens stream in, ONLY scroll if user is already at the bottom!
  // If user scrolled up to read earlier history, keep their scroll position completely undisturbed!
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom(false, false);
    }
  }, [streamingContent]);

  // When a new message is added or conversation switched, scroll to bottom
  useEffect(() => {
    scrollToBottom(true, true);
  }, [messages.length]);

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
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);
    onSendMessage(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setTimeout(() => {
      scrollToBottom(true, true);
    }, 50);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  // Filter models by search text and provider
  const filteredModels = availableModels.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.provider.toLowerCase().includes(modelSearch.toLowerCase()) ||
      (m.is_free && "free 免费".includes(modelSearch.toLowerCase()));

    if (!matchSearch) return false;

    if (selectedProviderFilter === "all") return true;
    if (selectedProviderFilter === "free") return isFreeModel(m);
    return m.provider.toLowerCase() === selectedProviderFilter.toLowerCase();
  });

  // Sort: free models first, then alphabetical
  const sortedModels = [...filteredModels].sort((a, b) => {
    const aFree = isFreeModel(a);
    const bFree = isFreeModel(b);
    if (aFree && !bFree) return -1;
    if (!aFree && bFree) return 1;
    return a.name.localeCompare(b.name);
  });

  // Extract distinct providers for filter tags
  const distinctProviders = Array.from(
    new Set(availableModels.map((m) => m.provider).filter(Boolean))
  );

  const activeModelObj = availableModels.find((m) => m.id === currentModel);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 relative overflow-hidden transition-colors">
      {/* Top Bar with Searchable Model Picker & Mobile/Tablet Controls */}
      <div className="h-12 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 px-2.5 sm:px-4 flex items-center justify-between z-20 gap-1.5 sm:gap-2 flex-nowrap min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink" ref={dropdownRef}>
          {/* Mobile Sidebar Toggle Button */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title="展开历史对话"
              className="md:hidden p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          <span className="hidden lg:inline text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 whitespace-nowrap">
            当前模型：
          </span>

          {/* Trigger Button */}
          <button
            type="button"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 px-2.5 sm:px-3 py-1.5 text-xs text-slate-800 dark:text-white hover:border-indigo-500/80 transition-all shadow-sm max-w-[130px] xs:max-w-[170px] sm:max-w-[200px] md:max-w-[210px] lg:max-w-xs truncate shrink min-w-0"
          >
            <Cpu className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate font-medium">
              {activeModelObj ? activeModelObj.name : currentModel || "请选择模型"}
            </span>
            {activeModelObj && isFreeModel(activeModelObj) && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                免费
              </span>
            )}
            {activeModelObj?.provider && (
              <span className="hidden xl:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 shrink-0">
                {activeModelObj.provider}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-0.5" />
          </button>

          {/* Refresh/Sync Models Button */}
          {onRefreshModels && (
            <button
              type="button"
              onClick={onRefreshModels}
              disabled={isRefreshingModels}
              title="根据后端填写的 API Key 自动更新/检测已支持的模型列表"
              className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-white bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50 shrink-0"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRefreshingModels ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""}`} />
              <span className="hidden lg:inline">更新模型</span>
            </button>
          )}

          {/* Searchable Dropdown Modal/Panel - Mobile Full Screen/Centered */}
          {modelDropdownOpen && (
            <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:left-0 sm:top-10 sm:mt-1 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-2xl backdrop-blur-md p-3 z-50 flex flex-col max-h-[75vh]">
              {/* Search Box */}
              <div className="relative mb-2.5">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索模型（如：free, deepseek, gpt...）"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Provider & Free Filter Badges */}
              {(distinctProviders.length > 1 || availableModels.some(isFreeModel)) && (
                <div className="flex items-center gap-1 flex-wrap mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setSelectedProviderFilter("all")}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      selectedProviderFilter === "all"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    全部 ({availableModels.length})
                  </button>
                  {availableModels.some(isFreeModel) && (
                    <button
                      type="button"
                      onClick={() => setSelectedProviderFilter("free")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                        selectedProviderFilter === "free"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/50"
                      }`}
                    >
                      <Zap className="h-3 w-3" />
                      免费 ({availableModels.filter(isFreeModel).length})
                    </button>
                  )}
                  {distinctProviders.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedProviderFilter(p)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase font-mono transition-colors ${
                        selectedProviderFilter === p
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Model Items List */}
              <div className="overflow-y-auto flex-1 space-y-1 pr-1">
                {sortedModels.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    未找到匹配的模型
                  </div>
                ) : (
                  sortedModels.map((m) => {
                    const isSelected = m.id === currentModel;
                    const free = isFreeModel(m);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onModelChange(m.id);
                          setModelDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                          isSelected
                            ? "bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {m.name}
                            </span>
                            {free && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                免费
                              </span>
                            )}
                            <span className="text-[9px] uppercase font-mono px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {m.provider}
                            </span>
                          </div>
                          {m.description && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              {m.description}
                            </p>
                          )}
                          <p className="text-[9px] text-slate-400 font-mono truncate">{m.id}</p>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              title="新建对话"
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          {onToggleMemory && (
            <button
              type="button"
              onClick={onToggleMemory}
              title="查看本次对话关联记忆"
              className="lg:hidden relative p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Brain className="h-4 w-4 text-indigo-500" />
              {typeof memoriesCount === "number" && memoriesCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white shadow-xs">
                  {memoriesCount > 9 ? "9+" : memoriesCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-5 relative"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-3 sm:mb-4 shadow-inner">
              <Sparkles className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200">
              Personal AI 助手已就绪
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              对话会自动与 Mem0 个人记忆库联动，随着交流更加懂得你的习惯与事实。
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const isErrorMsg =
              !isUser &&
              typeof msg.content === "string" &&
              (msg.content.includes("❌ 后端未知错误") || msg.content.includes("HTTP 500"));

            return (
              <div
                key={idx}
                className={`flex gap-2 sm:gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`h-7 w-7 sm:h-8 sm:w-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isUser
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : isErrorMsg
                      ? "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm"
                  }`}
                >
                  {isUser ? (
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : isErrorMsg ? (
                    <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </div>

                <div
                  className={`flex flex-col ${
                    isUser
                      ? "items-end max-w-[88%] sm:max-w-[80%]"
                      : "items-start max-w-[94%] sm:max-w-2xl min-w-0"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed ${
                      isUser
                        ? "bg-indigo-600 text-white shadow-sm font-normal rounded-tr-none"
                        : isErrorMsg
                        ? "bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200 shadow-sm rounded-tl-none"
                        : "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm rounded-tl-none"
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    ) : isErrorMsg ? (
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400 mb-1">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>生成出错：</span>
                        </div>
                        <div className="whitespace-pre-wrap font-mono text-xs text-rose-700 dark:text-rose-300 break-words bg-rose-100/50 dark:bg-rose-900/30 p-2.5 rounded-lg border border-rose-200/50 dark:border-rose-800/40">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      renderMessageBody(msg.content, false)
                    )}
                  </div>

                  {/* Message Meta Info (Tokens, Model, Cost, Time) */}
                  {!isUser && !isErrorMsg && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 px-1 font-mono">
                      {msg.created_at && (
                        <span className="flex items-center gap-1" title="回复时间">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{formatTime(msg.created_at)}</span>
                        </span>
                      )}

                      {msg.model && (
                        <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[10px] border border-slate-200 dark:border-slate-700/60 font-mono" title="回复模型">
                          <Cpu className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                          <span>{msg.model}</span>
                        </span>
                      )}

                      {typeof msg.thinking_duration_ms === "number" && msg.thinking_duration_ms > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium" title="思考耗时（到首字时间）">
                          <Clock className="h-3 w-3 text-emerald-500" />
                          <span>思考 {(msg.thinking_duration_ms / 1000).toFixed(1)}s</span>
                        </span>
                      )}

                      {typeof msg.duration_ms === "number" && msg.duration_ms > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium" title="总生成耗时">
                          <Zap className="h-3 w-3 text-amber-500" />
                          <span>总用时 {(msg.duration_ms / 1000).toFixed(2)}s</span>
                        </span>
                      )}

                      {(msg.prompt_tokens || msg.completion_tokens || msg.token_usage) ? (
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px]" title="Token 消耗">
                          <span className="text-slate-400 dark:text-slate-500">Tokens:</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {msg.token_usage || (msg.prompt_tokens || 0) + (msg.completion_tokens || 0)}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">
                            (入 {msg.prompt_tokens || 0} / 出 {msg.completion_tokens || 0})
                          </span>
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Current Streaming Message */}
        {isStreaming && (
          <div className="flex gap-2 sm:gap-3 max-w-3xl mr-auto">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm">
              <Bot className="h-4 w-4 animate-pulse" />
            </div>
            <div className="rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm max-w-[94%] min-w-[270px] sm:min-w-[340px]">
              {isWaitingForFirstToken || !streamingContent ? (
                /* Stage 1: Waiting / Thinking Live Timer Box */
                <div className="space-y-2 py-1">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm shrink-0">
                      <Sparkles className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "3s" }} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        正在深入思考中
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs">
                        <Clock className="h-3 w-3 animate-spin" style={{ animationDuration: "5s" }} />
                        已等待 {(elapsedTime || 0).toFixed(1)}s
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal pl-9">
                    正在分析问题并组织逻辑，准备逐字为你呈现回答...
                  </p>
                </div>
              ) : (
                /* Stage 2: Streaming Typewriter Output */
                <div>
                  {thinkingDuration !== null && thinkingDuration !== undefined && (
                    <div className="flex items-center gap-1.5 mb-2.5 pb-1.5 border-b border-slate-200/70 dark:border-slate-800/80 text-[11px] font-mono">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/50">
                        <Clock className="h-3 w-3" />
                        思考耗时 {thinkingDuration.toFixed(1)}s
                      </span>
                      <span className="text-[10px] text-slate-400">· 逐字回复中</span>
                    </div>
                  )}

                  {renderMessageBody(streamingContent, true)}

                  <div className="mt-2.5 pt-1.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 animate-spin" />
                      <span>{currentModel}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 font-mono">
                      <Clock className="h-3 w-3" />
                      <span>总耗时 {(elapsedTime || 0).toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottomBtn && (
        <div className="absolute bottom-16 sm:bottom-20 right-4 sm:right-8 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              isAtBottomRef.current = true;
              setShowScrollBottomBtn(false);
              scrollToBottom(true, true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700/80 text-xs font-medium transition-all"
            title="滚动回最新内容"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span>回到最新</span>
          </button>
        </div>
      )}

      {/* Input Box Area with safe area bottom */}
      <div className="p-2 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur transition-colors safe-pb">
        <div className="max-w-3xl mx-auto relative flex items-end rounded-2xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950 p-1.5 sm:p-2 focus-within:border-indigo-500 shadow-sm">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送)"
            className="w-full resize-none bg-transparent px-2.5 sm:px-3 py-1.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none max-h-32 sm:max-h-44"
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

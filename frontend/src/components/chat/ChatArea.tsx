"use client";

import React, { useState, useRef, useEffect } from "react";
import { Message, ModelCatalogItem, AttachmentItem, SearchResultItem } from "@/types";
import { ModelSelect } from "@/components/common/ModelSelect";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { MessageListSkeleton } from "@/components/common/PageSkeleton";
import { cn } from "@/lib/utils";
import {
  ChatMessageItem,
  renderMessageBody,
  parseSearchResults,
  formatFileSize,
} from "./ChatMessageItem";
import {
  Send,
  Square,
  Cat,
  Sparkles,
  RotateCw,
  Clock,
  Menu,
  Brain,
  Plus,
  Paperclip,
  X,
  FileText,
  Download,
  Globe,
  ExternalLink,
  Cpu,
  ChevronDown,
} from "lucide-react";







const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX_DIM = 1920;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve((e.target?.result as string) || "");
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(outputType, 0.85));
      };
      img.onerror = () => resolve((e.target?.result as string) || "");
      img.src = (e.target?.result as string) || "";
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
};

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
};

interface ChatAreaProps {
  messages: Message[];
  currentModel: string;
  onModelChange: (model: string) => void;
  availableModels: ModelCatalogItem[];
  onSendMessage: (message: string, attachments?: AttachmentItem[]) => void;
  onStopGenerating?: () => void;
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
  webSearchMode?: "auto" | "on" | "off";
  onToggleWebSearchMode?: () => void;
  searchStatus?: {
    state: "idle" | "searching" | "done";
    query?: string;
    count?: number;
  };
  streamingSearchResults?: SearchResultItem[] | null;
  loadingMessages?: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  currentModel,
  onModelChange,
  availableModels,
  onSendMessage,
  onStopGenerating,
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
  webSearchMode = "auto",
  onToggleWebSearchMode,
  searchStatus = { state: "idle" },
  streamingSearchResults = null,
  loadingMessages = false,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopyMessage = (text: string, idx: number) => {
    if (!text) return;
    // Clean any think tags from copy text
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() || text;
    navigator.clipboard.writeText(cleanText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };



  // Process selected or pasted files
  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const newAttachments: AttachmentItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
        let dataUrl = "";
        if (isImg) {
          dataUrl = await compressImage(file);
        } else {
          if (file.size > 15 * 1024 * 1024) {
            toast.error(`文件 ${file.name} 超过 15MB 上传限制`);
            continue;
          }
          dataUrl = await readFileAsDataUrl(file);
        }
        if (!dataUrl) continue;
        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          size: file.size,
          type: isImg ? "image" : "document",
          mime_type: file.type || (isImg ? "image/jpeg" : "application/octet-stream"),
          data_url: dataUrl,
        });
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err) {
      console.error("Error processing attachments:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleFiles(pastedFiles);
    }
  };

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming || isUploading) return;
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);
    onSendMessage(input.trim(), attachments);
    setInput("");
    setAttachments([]);
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

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden min-w-0 max-w-full">
      {/* Top Bar with Searchable Model Picker & Mobile/Tablet Controls */}
      <div className="border-b border-border/70 bg-background/80 backdrop-blur-xl px-2.5 sm:px-4 flex items-center justify-between z-20 gap-1.5 sm:gap-2 flex-nowrap min-w-0 pt-[max(0.65rem,env(safe-area-inset-top))] pb-2 md:pb-2 md:pt-2 min-h-[calc(3.25rem+env(safe-area-inset-top,0px))] md:min-h-12">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          {/* Mobile Sidebar Toggle Button */}
          {onToggleSidebar && (
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleSidebar}
              title="展开历史对话"
              className="md:hidden shrink-0"
            >
              <Menu className="h-4 w-4" />
              <span className="sr-only">展开历史对话</span>
            </Button>
          )}

          <span className="hidden lg:inline text-xs text-muted-foreground font-medium shrink-0 whitespace-nowrap">
            当前模型：
          </span>

          {/* Unified Compact Model Selector */}
          <ModelSelect
            value={currentModel}
            onChange={onModelChange}
            models={availableModels}
            variant="compact"
          />

          {/* Refresh/Sync Models Button */}
          {onRefreshModels && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshModels}
              disabled={isRefreshingModels}
              title="向配置的提供商 API (Gemini/OpenAI/OpenRouter/Ollama) 手动同步最新模型"
              className="shrink-0 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 hover:text-primary"
            >
              <RotateCw className={cn("h-3.5 w-3.5", isRefreshingModels && "animate-spin")} />
              <span className="hidden lg:inline">{isRefreshingModels ? "正在同步..." : "同步模型"}</span>
              <span className="sr-only">同步模型</span>
            </Button>
          )}
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <ThemeToggle />

          {onToggleMemory && (
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleMemory}
              title="查看本次对话关联记忆"
              className="lg:hidden relative"
            >
              <Brain className="h-4 w-4 text-primary" />
              {typeof memoriesCount === "number" && memoriesCount > 0 && (
                <Badge className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-bold">
                  {memoriesCount > 9 ? "9+" : memoriesCount}
                </Badge>
              )}
              <span className="sr-only">查看关联记忆</span>
            </Button>
          )}

          {onNewChat && (
            <Button
              variant="outline"
              size="icon"
              onClick={onNewChat}
              title="新建对话"
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">新建对话</span>
            </Button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 sm:px-5 sm:py-5 md:px-8 space-y-3 sm:space-y-4 relative min-w-0"
      >
        {loadingMessages && messages.length === 0 ? (
          <div className="max-w-4xl w-full mx-auto">
            <MessageListSkeleton rows={4} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3 shadow-inner">
              <Cat className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold">
              Apiapia 已就绪，开始新的对话吧
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
              与长期记忆库联动，越聊越懂你的习惯与偏好。
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessageItem
              key={msg.id || idx}
              msg={msg}
              idx={idx}
              isCopied={copiedIdx === idx}
              onCopy={handleCopyMessage}
              onImageClick={(src, alt) => setPreviewImage({ src, alt })}
            />
          ))
        )}

        {/* Current Streaming Message */}
        {isStreaming && (
          <div className="w-full max-w-full sm:max-w-3xl mr-auto min-w-0">
            <div className="rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3.5 text-[15px] sm:text-sm leading-relaxed bg-card border text-card-foreground shadow-sm w-full min-w-0 break-words [overflow-wrap:anywhere]">
              {isWaitingForFirstToken || !streamingContent ? (
                /* Stage 1: Waiting / Thinking Live Timer Box */
                <div className="space-y-1.5 py-0.5">
                  {searchStatus?.state === "searching" ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center text-white shadow-xs shrink-0">
                          <Globe className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "3s" }} />
                        </div>
                        <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                          正在全网检索最新信息
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-200/60 dark:border-sky-800/60 shadow-xs">
                          <Clock className="h-3 w-3 animate-spin" style={{ animationDuration: "5s" }} />
                          已耗时 {(elapsedTime || 0).toFixed(1)}s
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal pl-8 font-mono">
                        检索词：&ldquo;{searchStatus.query}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xs shrink-0">
                          <Sparkles className="h-3 w-3 animate-spin" style={{ animationDuration: "3s" }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          正在深入思考中
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs">
                          <Clock className="h-3 w-3 animate-spin" style={{ animationDuration: "5s" }} />
                          已等待 {(elapsedTime || 0).toFixed(1)}s
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal pl-8">
                        正在分析问题并组织逻辑，准备逐字为你呈现回答...
                      </p>
                    </div>
                  )}
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

                  {/* Realtime reference sources during streaming */}
                  {streamingSearchResults && streamingSearchResults.length > 0 && (
                    <div className="mb-2.5">
                      <details className="group rounded-xl border border-border bg-muted/40 text-xs overflow-hidden transition-all">
                        <summary className="cursor-pointer select-none font-medium text-foreground flex items-center justify-between p-2 sm:p-2.5 hover:bg-muted/70 transition-colors">
                          <span className="flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>参考了 {streamingSearchResults.length} 个网页来源</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">
                            ▼
                          </span>
                        </summary>
                        <div className="p-2 sm:p-2.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-border">
                          {streamingSearchResults.map((item, sIdx) => (
                            <a
                              key={sIdx}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/card flex flex-col p-2 rounded-lg bg-card border hover:border-primary hover:shadow-xs transition-all text-left"
                              title={item.title}
                            >
                              <div className="flex items-center gap-1 text-[11px] font-medium group-hover/card:text-primary">
                                <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-primary/10 text-primary text-[9px] flex items-center justify-center font-bold">
                                  {sIdx + 1}
                                </span>
                                <span className="truncate">{item.title}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity ml-auto text-primary" />
                              </div>
                              {item.snippet && (
                                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1 leading-snug break-words">
                                  {item.snippet}
                                </p>
                              )}
                              <span className="text-[9px] text-muted-foreground truncate mt-1 font-mono">
                                {(() => {
                                  try {
                                    return new URL(item.url).hostname.replace(/^www\./, "");
                                  } catch {
                                    return item.url;
                                  }
                                })()}
                              </span>
                            </a>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  {renderMessageBody(streamingContent, true, (src, alt) => setPreviewImage({ src, alt }))}

                  <div className="mt-2.5 pt-1.5 border-t border-border flex items-center justify-between gap-1.5 text-[10px] text-primary font-mono">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 animate-spin" />
                      <span>{currentModel}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground font-mono">
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
          <ActionTooltip label="回到最新内容" side="top">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                isAtBottomRef.current = true;
                setShowScrollBottomBtn(false);
                scrollToBottom(true, true);
              }}
              className="rounded-full shadow-lg text-xs"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span>回到最新</span>
            </Button>
          </ActionTooltip>
        </div>
      )}

      {/* Input Box Area with safe area bottom */}
      <div className="px-2 py-1.5 sm:p-3 sm:px-4 border-t bg-background/90 backdrop-blur-md safe-pb">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          className="max-w-3xl mx-auto rounded-2xl sm:rounded-3xl border border-border/80 bg-muted/40 dark:bg-[#1c1c1e] p-1 sm:p-1.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/40 shadow-xs flex flex-col"
        >
          {/* Attachment Preview Tray */}
          {attachments.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-1.5 pt-0.5 px-1 border-b border-border/60">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="relative group shrink-0 flex items-center gap-2 p-1.5 pr-2 rounded-xl bg-card dark:bg-[#2c2c2e] border border-border/70 shadow-xs"
                >
                  {att.type === "image" ? (
                    <img
                      src={att.data_url}
                      alt={att.name}
                      className="h-9 w-9 rounded-lg object-cover border border-border/60"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                  <div className="max-w-[110px] sm:max-w-[150px] min-w-0">
                    <p className="text-xs font-medium truncate" title={att.name}>
                      {att.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {formatFileSize(att.size)}
                    </p>
                  </div>
                  <ActionTooltip label="移除附件" side="top">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="sr-only">移除附件</span>
                    </Button>
                  </ActionTooltip>
                </div>
              ))}
              {isUploading && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary font-mono">
                  <RotateCw className="h-3 w-3 animate-spin" />
                  <span>处理中...</span>
                </div>
              )}
            </div>
          )}

          {/* Input Controls Row */}
          <div className="flex items-end gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.py,.js,.ts,.tsx,.jsx,.html,.css,.sql"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
            <ActionTooltip label="上传图片或文件（PDF、Word、代码、文本）" side="top">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || isUploading}
                className="h-9 w-9 rounded-full shrink-0 mb-0.5"
              >
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">上传附件</span>
              </Button>
            </ActionTooltip>
            {onToggleWebSearchMode && (
              <ActionTooltip
                label={
                  webSearchMode === "auto"
                    ? "联网检索: 自动智能 (系统根据问题自动决定是否检索)"
                    : webSearchMode === "on"
                    ? "联网检索: 强制开启 (每次提问均搜索最新网络)"
                    : "联网检索: 已关闭 (仅使用模型自身知识)"
                }
                side="top"
              >
                <Button
                  variant={webSearchMode === "off" ? "ghost" : "outline"}
                  size="sm"
                  onClick={onToggleWebSearchMode}
                  disabled={isStreaming}
                  className={cn(
                    "h-9 px-2 sm:px-2.5 rounded-full text-xs font-medium shrink-0 mb-0.5 select-none",
                    webSearchMode === "on" && "bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 hover:text-sky-600 dark:hover:text-sky-400",
                    webSearchMode === "auto" && "hover:border-sky-500/50 hover:text-sky-600 dark:hover:text-sky-400"
                  )}
                >
                  <Globe
                    className={cn(
                      "h-3.5 w-3.5",
                      webSearchMode === "on"
                        ? "text-sky-600 dark:text-sky-400"
                        : webSearchMode === "auto"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <span className="hidden sm:inline font-mono text-[11px]">
                    {webSearchMode === "auto" ? "联网:自动" : webSearchMode === "on" ? "联网:开启" : "联网:关闭"}
                  </span>
                </Button>
              </ActionTooltip>
            )}
            <Textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="询问 Apiapia"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-2.5 sm:px-3 py-2 text-[16px] sm:text-sm max-h-32 sm:max-h-44 leading-relaxed resize-none min-h-[36px]"
            />
            {isStreaming ? (
              <ActionTooltip label="停止生成" side="top">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => onStopGenerating?.()}
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full shrink-0 ml-1 mb-1 shadow-sm"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span className="sr-only">停止生成</span>
                </Button>
              </ActionTooltip>
            ) : (
              <ActionTooltip label="发送消息 (Enter)" side="top">
                <Button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isStreaming || isUploading}
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full shrink-0 ml-1 mb-1 shadow-sm"
                >
                  <Send className="h-4 w-4" />
                  <span className="sr-only">发送消息</span>
                </Button>
              </ActionTooltip>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox / Modal */}
      <Dialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
      >
        <DialogContent className="max-w-5xl bg-black/90 backdrop-blur-md p-3 sm:p-6 border-none text-white shadow-2xl flex flex-col items-center justify-center">
          {previewImage && (
            <>
              {/* Top action bar */}
              <div className="w-full flex items-center justify-between mb-2 text-white/90 px-1">
                <DialogTitle className="text-xs sm:text-sm font-medium truncate max-w-[60%] text-white">
                  {previewImage.alt || "图片预览"}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <ActionTooltip label="下载原图" side="bottom">
                    <Button variant="secondary" size="sm" asChild>
                      <a
                        href={previewImage.src}
                        download={previewImage.alt || "image.png"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>下载</span>
                      </a>
                    </Button>
                  </ActionTooltip>
                </div>
              </div>

              {/* Centered Image */}
              <div className="relative flex items-center justify-center max-w-full max-h-[80vh] overflow-hidden">
                <img
                  src={previewImage.src}
                  alt={previewImage.alt || "大图预览"}
                  className="max-h-[75vh] max-w-[90vw] sm:max-w-[80vw] object-contain rounded-xl shadow-2xl select-none"
                />
              </div>

              {/* Bottom hint */}
              <p className="text-[11px] text-white/50 mt-2 select-none">
                按 Esc 或点击遮罩空白区域关闭
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

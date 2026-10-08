"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Message, AttachmentItem, SearchResultItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { MessageListSkeleton } from "@/components/common/PageSkeleton";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useIsTrialMode } from "@/hooks/useIsTrialMode";
import { ChatMessageItem } from "./ChatMessageItem";
import { renderMessageBody, SearchSources } from "./markdown";
import {
  Send,
  Square,
  Sparkles,
  Clock,
  Paperclip,
  X,
  FileText,
  Download,
  Globe,
  Cpu,
  ChevronDown,
  RotateCw,
  Quote,
  Sliders,
  Terminal,
  Video,
  Plus,
  Palette,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandLogo } from "@/components/common/BrandLogo";
import { EmptyState } from "@/components/common/EmptyState";
import { DEFAULT_PROMPT_COMMANDS, PromptCommand } from "@/config/promptCommands";

// 移动端（触摸设备）检测：主指针为 coarse，即手机 / 平板这类触屏设备。
// 不用视口宽度判断，避免桌面浏览器窗口变窄时误判成移动端而丢掉回车发送。
// 触屏笔记本主指针通常是 fine，依然保留回车发送的习惯。
const useIsTouchPrimary = () => {
  const [isTouchPrimary, setIsTouchPrimary] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setIsTouchPrimary(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isTouchPrimary;
};

/**
 * 秒数显示。
 *
 * 此前 ChatArea 用一个空位 state `forceTick` 每 200ms 递增一次，用来在 render
 * 里读 `Date.now()` —— 这既让 render 变成非纯函数（并发模式下会读到过期值），
 * 又让**整个 ChatArea**（含消息列表、附件区、输入框）跟着每秒重渲染 5 次。
 *
 * 现在把计时收进这个只有一段文字的叶子组件：它的 state 变更不会牵动任何父级，
 * 而 ChatArea 在流式过程中本来就每秒要更新 50 次，额外 5 次完全被淹没。
 */
function ElapsedSeconds({
  startedAt,
  className,
  digits = 1,
}: {
  startedAt: number;
  className?: string;
  digits?: number;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    // 显示精度 0.1s，200ms 足够；80ms 属于无意义的额外重渲染。
    const id = window.setInterval(() => tick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = (Date.now() - startedAt) / 1000;
  return (
    <span className={className}>
      {Math.max(0, elapsed).toFixed(digits)}s
    </span>
  );
}






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
  currentModel?: string;
  onSendMessage: (
    message: string,
    attachments?: AttachmentItem[],
    extraOptions?: {
      quotedMessageId?: string;
      quotedContent?: string;
      systemPromptOverride?: string;
      reasoningEffort?: string;
      maxTokens?: number;
      imageGenMode?: boolean;
      videoGenMode?: boolean;
    }
  ) => void;
  onStopGenerating?: () => void;
  isStreaming: boolean;
  streamingContent: string;
  thinkingDuration?: number | null;
  streamStartedAt?: number | null;
  isWaitingForFirstToken?: boolean;
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
  regenerating?: boolean;
  onRegenerate?: (assistantMessageId: string) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  conversationId?: string | null;
  creationMode?: "chat" | "image" | "video";
  onChangeCreationMode?: (mode: "chat" | "image" | "video") => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  currentModel,
  onSendMessage,
  onStopGenerating,
  isStreaming,
  streamingContent,
  thinkingDuration,
  streamStartedAt = null,
  isWaitingForFirstToken = false,
  onNewChat,
  webSearchMode = "auto",
  onToggleWebSearchMode,
  searchStatus = { state: "idle" },
  streamingSearchResults = null,
  loadingMessages = false,
  regenerating = false,
  onRegenerate,
  onEditMessage,
  conversationId = null,
  creationMode = "chat",
  onChangeCreationMode,
}) => {
  const isTouchPrimary = useIsTouchPrimary();
  const isTrialMode = useIsTrialMode();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Composer draft persistence ──────────────────────────────────
  // An unsent prompt should survive a reload or an accidental navigation.
  //
  // 草稿按会话分桶：此前是单一全局键 `apiapia_chat_draft`，在 A 会话打的草稿会
  // 出现在 B 会话里（跨会话串内容），而且「新建对话」不会清空它 —— 用户新建后
  // 看到的是上一个会话的半句话。
  const draftKey = conversationId ? `apiapia_chat_draft:${conversationId}` : "apiapia_chat_draft:new";

  // 切换 / 新建对话时按新会话恢复草稿，并把输入框高度一并复位。
  React.useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(draftKey) || "";
    } catch (_) {}
    setInput(saved);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [draftKey]);

  const updateInput = React.useCallback(
    (next: string) => {
      setInput(next);
      try {
        if (next) localStorage.setItem(draftKey, next);
        else localStorage.removeItem(draftKey);
      } catch (_) {}
    },
    [draftKey]
  );

  const clearDraft = React.useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch (_) {}
  }, [draftKey]);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // ── Quoted Message State ──
  const [activeQuote, setActiveQuote] = useState<{ id?: string; text: string } | null>(null);

  // ── Slash Commands Menu State ──
  const [showCommandsMenu, setShowCommandsMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const [selectedCommandIdx, setSelectedCommandIdx] = useState(0);

  const filteredCommands = React.useMemo(() => {
    if (!commandFilter) return DEFAULT_PROMPT_COMMANDS;
    return DEFAULT_PROMPT_COMMANDS.filter(
      (c) =>
        c.key.toLowerCase().includes(commandFilter.toLowerCase()) ||
        c.title.toLowerCase().includes(commandFilter.toLowerCase()) ||
        c.description.toLowerCase().includes(commandFilter.toLowerCase())
    );
  }, [commandFilter]);

  const handleSelectCommand = (cmd: PromptCommand) => {
    updateInput(cmd.template);
    setShowCommandsMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleQuoteMessage = useCallback((quoteText: string, messageId?: string) => {
    setActiveQuote({ id: messageId, text: quoteText });
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleCopyMessage = useCallback((text: string, idx: number) => {
    if (!text) return;
    // Clean any think tags from copy text and strictly trim leading/trailing newlines
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    if (!cleanText) return;
    navigator.clipboard.writeText(cleanText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  /**
   * 图片点击回调此前是 messages.map 里的内联箭头，**每次渲染都是新函数**。
   * ChatMessageItem 虽然包了 memo，但收到新引用就不会跳过 —— 于是所有历史消息
   * 跟着一起重渲染并重跑 markdown 解析。固化引用后 memo 才真正生效。
   */
  const handleImageClick = useCallback((src: string, alt?: string) => {
    setPreviewImage({ src, alt });
  }, []);

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

  // Recompute "am I at the bottom" from the live DOM instead of trusting a
  // previously stored value. Safe to call any time; it writes no DOM itself.
  const syncAtBottomState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 120; // distance from bottom in px considered "at bottom"
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom <= threshold;
    isAtBottomRef.current = atBottom;
    setShowScrollBottomBtn(!atBottom);
  };

  // Monitor user scrolling to detect if user has scrolled away from the bottom
  const handleScroll = () => syncAtBottomState();

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
    // An empty list cannot be "scrolled away from": drop the floating button
    // immediately instead of waiting for a scroll event that never comes.
    if (messages.length === 0) {
      isAtBottomRef.current = true;
      setShowScrollBottomBtn(false);
      return;
    }
    scrollToBottom(true, true);
  }, [messages.length]);

  // 切换 / 新建对话时整块内容被替换，浏览器不会为此派发 scroll 事件，
  // 所以必须主动复位，否则"回到最新"按钮会残留在空白的对话上。
  useEffect(() => {
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = 0;
    // Content is loaded async; the [messages.length] effect above handles the
    // final scroll-to-bottom once the new messages land.
  }, [conversationId]);

  // 移动端：软键盘的回车不发送消息，交给 textarea 默认行为插入换行，
  // 只有点击发送按钮才真正发出；桌面端保持回车发送、Shift+回车换行。
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash commands keyboard navigation
    if (showCommandsMenu && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIdx((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIdx((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectCommand(filteredCommands[selectedCommandIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandsMenu(false);
        return;
      }
    }

    if (e.key !== "Enter") return;
    // 输入法组字过程中的回车属于候选上屏，绝不能当作发送。
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (isTouchPrimary) return;
    if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    handleSend();
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming || isUploading) return;
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);

    const extraOpts: any = {};
    if (activeQuote) {
      extraOpts.quotedMessageId = activeQuote.id;
      extraOpts.quotedContent = activeQuote.text;
    }
    if (creationMode === "image") {
      extraOpts.imageGenMode = true;
    } else if (creationMode === "video") {
      extraOpts.videoGenMode = true;
    }

    onSendMessage(input.trim(), attachments, extraOpts);
    setInput("");
    clearDraft();
    setAttachments([]);
    setActiveQuote(null);
    setShowCommandsMenu(false);
    if (onChangeCreationMode) {
      onChangeCreationMode("chat");
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setTimeout(() => {
      scrollToBottom(true, true);
    }, 50);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    updateInput(val);

    // Trigger slash commands menu when starting with /
    if (val.startsWith("/")) {
      setShowCommandsMenu(true);
      setCommandFilter(val.slice(1).trim());
      setSelectedCommandIdx(0);
    } else {
      setShowCommandsMenu(false);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden min-w-0 max-w-full">

      {/* 屏幕阅读器状态播报。
          role="log" 上的 aria-live 让新消息被自动朗读；aria-relevant 限定为
          "additions" 是关键 —— 否则流式气泡里逐字变化的文本会被反复朗读，
          实际效果是屏幕阅读器完全无法使用。aria-busy 则在生成期间整体挂起播报。
          「思考中 → 生成中 → 完成」这三个状态跃迁视觉上只有动画，对 AT 不可见，
          所以单独用一个 status 区补上。 */}
      <span className="sr-only" role="status" aria-live="polite">
        {isStreaming
          ? isWaitingForFirstToken
            ? "正在思考…"
            : "正在生成回答…"
          : messages.length > 0
          ? "回答已完成"
          : ""}
      </span>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-label="对话消息"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={isStreaming}
        className={cn(
          "flex-1 overflow-x-hidden px-3.5 sm:px-5 md:px-8 relative min-w-0",
          messages.length > 0 || isStreaming
            ? "overflow-y-auto py-3 sm:py-5 space-y-3 sm:space-y-4"
            : "overflow-y-hidden py-1 flex flex-col justify-center"
        )}
      >
        {loadingMessages && messages.length === 0 ? (
          <div className="max-w-3xl w-full mx-auto">
            <MessageListSkeleton rows={4} />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            className="my-auto"
            media={
              <BrandLogo
                size={68}
                className="mb-3.5 drop-shadow-md transition-transform hover:scale-105"
              />
            }
            title="Apiapia 已就绪，开始新的对话吧"
            description="与长期记忆库联动，越聊越懂你的习惯与偏好。"
          />
        ) : (
          <div className="max-w-3xl w-full mx-auto space-y-6 sm:space-y-8">
            {messages.map((msg, idx) => (
              <ChatMessageItem
                key={msg.id || idx}
                msg={msg}
                idx={idx}
                isCopied={copiedIdx === idx}
                onCopy={handleCopyMessage}
                onImageClick={handleImageClick}
                canRegenerate={
                  !!onRegenerate && !isStreaming && !regenerating && msg.role === "assistant" && !!msg.id
                }
                regenerating={regenerating}
                onRegenerate={onRegenerate}
                onEditMessage={onEditMessage}
                onQuote={handleQuoteMessage}
                onContinue={
                  !isStreaming && msg.role === "assistant" && idx === messages.length - 1
                    ? () => onSendMessage("请从上述被截断的地方继续写下去，无需重复前面的内容。")
                    : undefined
                }
              />
            ))}

          </div>
        )}

        {/* Current Streaming Message (ChatGPT style seamless container) */}
        {isStreaming && (
          <div className="max-w-3xl w-full mx-auto">
            <div className="w-full bg-transparent border-0 shadow-none px-0 py-0.5 text-foreground leading-[1.75] text-subhead sm:text-base min-w-0 break-words [overflow-wrap:anywhere]">
              {isWaitingForFirstToken || !streamingContent ? (
                /* Stage 1: Waiting / Thinking Live Indicator */
                <div className="py-1">
                  {searchStatus?.state === "searching" ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/50 bg-sky-50 px-3 py-1.5 text-xs text-sky-600 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-400 sm:text-sm">
                      <Globe className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      <span>正在检索：&ldquo;{searchStatus.query}&rdquo;</span>
                      {streamStartedAt && (
                        <ElapsedSeconds
                          startedAt={streamStartedAt}
                          className="font-mono text-2xs opacity-70"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-3/50 px-3 py-1.5 text-xs text-muted-foreground sm:text-sm">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                      <span>思考中...</span>
                      {streamStartedAt && (
                        <ElapsedSeconds
                          startedAt={streamStartedAt}
                          className="font-mono text-2xs opacity-70"
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Stage 2: Streaming Output with Typing Cursor */
                <div>
                  {/* 流式过程中的实时引用来源。与思考过程一致，回答时保持折叠 */}
                  {streamingSearchResults && streamingSearchResults.length > 0 && (
                    <SearchSources
                      results={streamingSearchResults}
                      defaultOpen={false}
                      className="mb-3"
                    />
                  )}

                  <div className="relative">
                    {renderMessageBody(streamingContent, true, handleImageClick)}
                    <span className="ml-1.5 inline-block h-[18px] w-2 translate-y-0.5 animate-pulse rounded-xs bg-primary/80" />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-border/40 pt-2 font-mono text-2xs text-muted-foreground opacity-60">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 animate-spin text-primary" />
                      <span>{currentModel}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-muted-foreground">
                      {thinkingDuration != null && (
                        <span>思考 {thinkingDuration.toFixed(1)}s · </span>
                      )}
                      <Clock className="h-3 w-3" />
                      {streamStartedAt ? (
                        <ElapsedSeconds startedAt={streamStartedAt} />
                      ) : (
                        <span>0.0s</span>
                      )}
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

      {/* Input Box Area — Naturally docked at the bottom of the chat window */}
      <div className="p-2 sm:p-3 border-t border-border/40 bg-background/95 backdrop-blur-md shrink-0 z-10">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          className="max-w-3xl mx-auto rounded-2xl sm:rounded-3xl border border-border/70 dark:border-border/50 bg-background/90 dark:bg-surface-2/90 backdrop-blur-xl p-1 sm:p-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.35)] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all flex flex-col"
        >
          {/* Slash Commands Autocomplete Popup */}
          {showCommandsMenu && filteredCommands.length > 0 && (
            <div className="mx-1 mb-2 rounded-xl border border-border/80 bg-background/95 backdrop-blur-xl shadow-xl overflow-hidden p-1 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between px-2.5 py-1 text-2xs font-medium text-muted-foreground border-b border-border/40 mb-1">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3 w-3 text-primary" />
                  <span>快捷提示词指令（方向键选择，Enter / Tab 采纳）</span>
                </span>
                <span className="font-mono text-3xs">{filteredCommands.length} 个指令</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredCommands.map((cmd, idx) => (
                  <button
                    key={cmd.key}
                    type="button"
                    onClick={() => handleSelectCommand(cmd)}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors",
                      idx === selectedCommandIdx
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted/70 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-semibold text-2xs px-1 rounded bg-black/10 dark:bg-white/10 shrink-0">
                        /{cmd.key}
                      </span>
                      <span className="truncate">{cmd.title}</span>
                    </div>
                    <span
                      className={cn(
                        "text-3xs truncate ml-2 max-w-[180px] sm:max-w-[240px]",
                        idx === selectedCommandIdx ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      {cmd.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Quoted Message Preview Tray */}
          {activeQuote && (
            <div className="mx-1 mb-1.5 p-2 rounded-xl bg-surface-3/80 border border-primary/20 flex items-start justify-between gap-2 text-xs">
              <div className="flex items-start gap-2 min-w-0">
                <Quote className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-medium text-2xs text-primary block">正在引用回复：</span>
                  <p className="text-2xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {activeQuote.text}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveQuote(null)}
                className="h-5 w-5 rounded-full text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">取消引用</span>
              </Button>
            </div>
          )}

          {/* Attachment Preview Tray */}
          {attachments.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-1.5 pt-0.5 px-1 border-b border-border/60">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="relative group shrink-0 flex items-center gap-2 p-1.5 pr-2 rounded-xl bg-card border border-border/70 dark:bg-surface-3 shadow-xs"
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
                    <p className="text-2xs text-muted-foreground font-mono">
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
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                if (e.target.files) {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
            {/* Creation Plus Dropdown Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={creationMode !== "chat" ? "outline" : "ghost"}
                  size="icon"
                  disabled={isStreaming || isUploading}
                  className={cn(
                    "h-9 w-9 rounded-full shrink-0 mb-0.5 transition-colors",
                    creationMode === "image" && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20",
                    creationMode === "video" && "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                  )}
                  aria-label="功能与创作菜单"
                >
                  {creationMode === "image" ? (
                    <Palette className="h-4 w-4" />
                  ) : creationMode === "video" ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-48 rounded-2xl p-1.5 shadow-lg">
                <DropdownMenuItem
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer"
                >
                  <Paperclip className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 truncate">上传图片或文件</div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                {onToggleWebSearchMode && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      onToggleWebSearchMode();
                    }}
                    className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Globe
                        className={cn(
                          "h-4 w-4 shrink-0",
                          webSearchMode === "on"
                            ? "text-sky-500"
                            : webSearchMode === "auto"
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      <span>联网检索</span>
                    </div>
                    <span
                      className={cn(
                        "font-mono text-2xs px-1.5 py-0.5 rounded-md",
                        webSearchMode === "on"
                          ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold"
                          : webSearchMode === "auto"
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground"
                      )}
                    >
                      {webSearchMode === "auto" ? "自动" : webSearchMode === "on" ? "开启" : "关闭"}
                    </span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => onChangeCreationMode?.(creationMode === "image" ? "chat" : "image")}
                  className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Palette className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>生成图片</span>
                  </div>
                  {creationMode === "image" && <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                </DropdownMenuItem>

                {isTrialMode ? (
                  <DropdownMenuItem
                    onClick={() => {
                      toast.info("当前账号处于体验模式，暂不支持使用 AI 视频生成功能。如需开通，请联系管理员获取完整权限。");
                    }}
                    className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium opacity-50 cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>生成视频 (体验账号暂不可用)</span>
                    </div>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onChangeCreationMode?.(creationMode === "video" ? "chat" : "video")}
                    className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Video className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>生成视频</span>
                    </div>
                    {creationMode === "video" && <Check className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                creationMode === "video"
                  ? "描述你的视频"
                  : creationMode === "image"
                  ? "描述你的图片"
                  : "询问 Apiapia"
              }
              // 此前输入框既无 <label> 也无 aria-label，屏幕阅读器只会念出
              // placeholder，且 placeholder 一输入就消失。
              aria-label="向 Apiapia 发送消息"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-2.5 sm:px-3 py-2 text-base sm:text-body max-h-32 sm:max-h-44 leading-relaxed resize-none min-h-[36px]"
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
              <ActionTooltip
                label={isTouchPrimary ? "发送消息" : "发送消息（Enter）"}
                side="top"
              >
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
              <p className="text-2xs text-white/50 mt-2 select-none">
                按 Esc 或点击遮罩空白区域关闭
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

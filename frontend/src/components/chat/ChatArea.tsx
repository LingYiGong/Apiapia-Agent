"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { Message, AttachmentItem, SearchResultItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { MessageListSkeleton } from "@/components/common/PageSkeleton";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { transcribeAudio } from "@/lib/speech";
import { useI18n, LOCALE_META } from "@/i18n";
import { useAudioRecorder, MAX_RECORDING_SECONDS } from "@/hooks/useAudioRecorder";
import { useIsTrialMode } from "@/hooks/useIsTrialMode";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ChatMessageItem } from "./ChatMessageItem";
import { renderMessageBody, SearchSources } from "./markdown";
import {
  Send,
  Square,
  Sparkles,
  Clock,
  Zap,
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
  Image as ImageIcon,
  Camera,
  Mic,
  AudioLines,
  Languages,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { overlaySurfaceClass } from "@/components/common/surfaces";
import { BrandLogo } from "@/components/common/BrandLogo";
import { EmptyState } from "@/components/common/EmptyState";
import { DEFAULT_PROMPT_COMMANDS, PromptCommand } from "@/config/promptCommands";
import {
  VOCAB_TARGET_LANGUAGES,
  buildVocabTutorPrompt,
  vocabLanguageName,
  vocabLanguageChipLabel,
} from "@/config/personas";
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  compressImage,
  downloadAttachment,
  readFileAsDataUrl,
} from "@/lib/fileUpload";
import { FilePreviewModal, type PreviewableFile } from "./FilePreviewModal";

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

function CreationMenuRow({
  asMenuItem,
  onActivate,
  className,
  children,
}: {
  asMenuItem: boolean;
  onActivate: (e: React.MouseEvent<HTMLElement>) => void;
  className?: string;
  children: React.ReactNode;
}) {
  if (asMenuItem) {
    return (
      <DropdownMenuItem onClick={onActivate} className={className}>
        {children}
      </DropdownMenuItem>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn("w-full text-left", className)}
    >
      {children}
    </button>
  );
}

/**
 * ISO 639-1 语种码 → 文案键。
 *
 * `config/personas.ts` 的 VOCAB_TARGET_LANGUAGES 还没迁到键上，`name` / `label`
 * 仍是硬编码中文，直接渲染会让英文 / 日文界面里混进「英语 (EN)」这种串。这里
 * 只保留「码 → 键」的映射，取值交给 i18n（`chat.translate.langs`，与 WordCard.tsx
 * 的 `chat.wordCard.lang<Code>` 同一套做法）。未收录的语种退回原始字符串。
 */
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
      webSearchMode?: "auto" | "on" | "off";
      singleTurnMode?: boolean;
      memoryEnabled?: boolean;
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
  isTranslateMode?: boolean;
  onToggleTranslateMode?: (enabled: boolean) => void;
  vocabTargetLang?: string;
  onSelectVocabLang?: (lang: string) => void;
  siblingInfoMap?: Record<string, { current: number; total: number; siblingIds: string[] }>;
  onSwitchBranch?: (targetMessageId: string) => void;
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
  isTranslateMode: propIsTranslateMode,
  onToggleTranslateMode,
  vocabTargetLang: propVocabTargetLang,
  onSelectVocabLang,
  siblingInfoMap,
  onSwitchBranch,
}) => {
  const { t, fmt, locale } = useI18n();
  const isTouchPrimary = useIsTouchPrimary();
  // 「+」面板：窄于 md 用底部抽屉，其余宽度沿用上弹的下拉。
  const isMobile = useIsMobile();
  const isTrialMode = useIsTrialMode();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userScrolledAwayRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const composerContainerRef = useRef<HTMLDivElement>(null);
  const [composerWidth, setComposerWidth] = useState<number | undefined>(undefined);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [creationSheetOpen, setCreationSheetOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setCreationSheetOpen(false);
  }, [isMobile]);

  const [internalTranslateMode, setInternalTranslateMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("apiapia_translate_mode") === "1";
    }
    return false;
  });
  const isTranslateMode = propIsTranslateMode !== undefined ? propIsTranslateMode : internalTranslateMode;

  const handleSetTranslateMode = useCallback((enabled: boolean) => {
    setInternalTranslateMode(enabled);
    onToggleTranslateMode?.(enabled);
    if (typeof window !== "undefined") {
      localStorage.setItem("apiapia_translate_mode", enabled ? "1" : "0");
    }
  }, [onToggleTranslateMode]);

  const [internalVocabTargetLang, setInternalVocabTargetLang] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("apiapia_vocab_target_lang");
      if (saved && saved !== "auto") return saved;
    }
    return "ja";
  });
  const vocabTargetLang = propVocabTargetLang !== undefined ? propVocabTargetLang : internalVocabTargetLang;

  const selectedVocabLang = VOCAB_TARGET_LANGUAGES.find((l) => l.id === vocabTargetLang);

  const handleSelectVocabLang = useCallback((lang: string) => {
    setInternalVocabTargetLang(lang);
    onSelectVocabLang?.(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("apiapia_vocab_target_lang", lang);
    }
  }, [onSelectVocabLang]);

  useEffect(() => {
    if (!composerContainerRef.current) return;
    const el = composerContainerRef.current;
    const updateWidth = () => {
      setComposerWidth(el.getBoundingClientRect().width);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const draftKey = conversationId ? `apiapia_chat_draft:${conversationId}` : "apiapia_chat_draft:new";

  // 切换 / 新建对话时按新会话恢复草稿，并把输入框高度与临时附件/引用状态一并复位。
  React.useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(draftKey) || "";
    } catch (_) {}
    setInput(saved);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    // 切换会话或点击新建时，重置上一会话的未发送附件、引用状态与斜杠菜单
    setAttachments([]);
    setActiveQuote(null);
    setShowCommandsMenu(false);
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
  const [previewFile, setPreviewFile] = useState<PreviewableFile | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // ── Quoted Message State ──
  const [activeQuote, setActiveQuote] = useState<{ id?: string; text: string } | null>(null);

  // ── Slash Commands Menu State ──
  const [showCommandsMenu, setShowCommandsMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const [selectedCommandIdx, setSelectedCommandIdx] = useState(0);

  const filteredCommands = React.useMemo(() => {
    if (!commandFilter) return DEFAULT_PROMPT_COMMANDS;
    const q = commandFilter.toLowerCase();
    return DEFAULT_PROMPT_COMMANDS.filter(
      (c) =>
        c.key.toLowerCase().includes(q) ||
        t(c.titleKey).toLowerCase().includes(q) ||
        t(c.descriptionKey).toLowerCase().includes(q)
    );
  }, [commandFilter, t]);

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
  const handleFiles = async (source: FileList | File[] | null) => {
    if (!source || source.length === 0) return;

    const files = Array.from(source);

    setIsUploading(true);
    try {
      const newAttachments: AttachmentItem[] = [];
      let room = MAX_ATTACHMENTS - attachments.length;
      let budget = MAX_TOTAL_ATTACHMENT_BYTES;

      for (const file of files) {
        if (room <= 0) {
          toast.error(t("chat.composer.tooManyAttachments", { count: MAX_ATTACHMENTS }));
          break;
        }
        const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
        let dataUrl = "";
        if (isImg) {
          dataUrl = await compressImage(file);
        } else {
          if (file.size > MAX_ATTACHMENT_BYTES) {
            toast.error(t("chat.composer.fileTooLarge", { name: file.name }));
            continue;
          }
          dataUrl = await readFileAsDataUrl(file);
        }
        if (!dataUrl) continue;
        if (file.size > budget) {
          toast.error(t("chat.composer.attachmentsTooLarge"));
          break;
        }
        budget -= file.size;
        room -= 1;
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
      return;
    }

    // ChatGPT 体验：检测超长文本或多行大代码块，自动将其转换为文本片段附件，防止挤爆输入框
    const plainText = e.clipboardData?.getData("text") || "";
    if (plainText.length > 1200 || plainText.split("\n").length > 30) {
      e.preventDefault();
      try {
        const snippetName = `pasted-snippet-${attachments.length + 1}.txt`;
        const encoded = btoa(unescape(encodeURIComponent(plainText)));
        const newAttachment: AttachmentItem = {
          id: `paste_${Date.now()}`,
          name: snippetName,
          size: new Blob([plainText]).size,
          type: "document",
          mime_type: "text/plain",
          data_url: `data:text/plain;base64,${encoded}`,
          text: plainText,
        };
        setAttachments((prev) => [...prev, newAttachment]);
        toast.info(t("chat.composer.pastedAsAttachment") || "检测到长文本/代码，已自动折叠为附件卡片，输入框保持清爽");
      } catch (err) {
        // Fallback to normal paste if encoding fails
      }
    }
  };

  const growTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const insertTranscript = (text: string) => {
    const clean = (text || "").trim();
    if (!clean) {
      toast.error(t("chat.speech.noSpeechRecognized"));
      return;
    }
    updateInput(input.trim() ? `${input.trim()} ${clean}` : clean);
    requestAnimationFrame(() => {
      growTextarea();
      textareaRef.current?.focus();
    });
  };

  const runTranscription = async (blob: Blob, filename?: string) => {
    setIsTranscribing(true);
    try {
      const result = await transcribeAudio(blob, { filename });
      insertTranscript(result.text);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t("chat.speech.transcribeFailed")
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const recorder = useAudioRecorder({
    onAutoStop: (audio) => {
      toast.info(t("chat.speech.limitReached", { seconds: MAX_RECORDING_SECONDS }));
      void runTranscription(audio.blob);
    },
  });

  useEffect(() => {
    if (!recorder.error) return;
    toast.error(recorder.error);
    recorder.clearError();
  }, [recorder.error, recorder.clearError]);

  const toggleRecording = async () => {
    if (recorder.isRecording) {
      const audio = await recorder.stop();
      if (audio) {
        await runTranscription(audio.blob);
      }
    } else {
      await recorder.start();
    }
  };

  const handleAudioFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await runTranscription(file, file.name);
    }
  };

  const BOTTOM_FOLLOW_EPS = 8;
  const BOTTOM_BTN_EPS = 120;

  const clearScrollLock = () => {
    userScrolledAwayRef.current = false;
  };

  const syncAtBottomState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= BOTTOM_FOLLOW_EPS) {
      clearScrollLock();
    }
    setShowScrollBottomBtn(distanceFromBottom > BOTTOM_BTN_EPS);
  };

  const handleScroll = () => syncAtBottomState();

  const lockScrollOnUserIntent = () => {
    const container = scrollContainerRef.current;
    if (!container || container.scrollHeight <= container.clientHeight) return;
    userScrolledAwayRef.current = true;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0) lockScrollOnUserIntent();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (e.clientX - rect.left >= container.clientWidth) {
      lockScrollOnUserIntent();
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    const currentY = e.touches[0]?.clientY;
    if (startY != null && currentY != null && currentY - startY > 6) {
      lockScrollOnUserIntent();
    }
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home") {
      lockScrollOnUserIntent();
    }
  };

  const scrollToBottom = (force = false, smooth = true) => {
    if (!force && userScrolledAwayRef.current) return;
    clearScrollLock();
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

  useLayoutEffect(() => {
    if (!userScrolledAwayRef.current) {
      scrollToBottom(false, false);
    }
  }, [streamingContent, isWaitingForFirstToken, streamingSearchResults]);

  useLayoutEffect(() => {
    if (messages.length === 0) {
      clearScrollLock();
      setShowScrollBottomBtn(false);
      return;
    }
    scrollToBottom(false, true);
  }, [messages.length]);

  useEffect(() => {
    clearScrollLock();
    setShowScrollBottomBtn(false);
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = 0;
  }, [conversationId]);

  const wasStreamingRef = useRef(false);
  useLayoutEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      clearScrollLock();
      const container = scrollContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

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

    // 空输入框按「上箭头」：一键将上一条提问召回输入框以便微调重发（对齐 ChatGPT / Discord 体验）
    if (e.key === "ArrowUp" && !input && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg && lastUserMsg.content) {
        e.preventDefault();
        updateInput(lastUserMsg.content);
        requestAnimationFrame(() => {
          growTextarea();
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(lastUserMsg.content.length, lastUserMsg.content.length);
          }
        });
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
    clearScrollLock();
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
    } else if (isTranslateMode) {
      extraOpts.systemPromptOverride = buildVocabTutorPrompt(vocabTargetLang, locale);
      extraOpts.webSearchMode = "off";
      extraOpts.singleTurnMode = true;
      extraOpts.memoryEnabled = false;
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

  const closeCreationSheet = () => setCreationSheetOpen(false);

  const renderCreationPanel = (asMenuItem: boolean) => (
    <>
      <div className="px-3 pt-1 pb-2.5 border-b border-border/40 mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
          {t("chat.creation.sectionTitle")}
        </span>
        {(creationMode !== "chat" || isTranslateMode) && (
          <button
            type="button"
            onClick={() => {
              onChangeCreationMode?.("chat");
              handleSetTranslateMode(false);
            }}
            className="-my-1.5 cursor-pointer py-1.5 text-xs font-semibold text-primary hover:underline"
          >
            {t("chat.creation.restoreChat")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-0.5 mb-2.5">
        <CreationMenuRow
          asMenuItem={asMenuItem}
          onActivate={() => {
            galleryInputRef.current?.click();
            closeCreationSheet();
          }}
          className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-2xl border border-border/50 bg-surface-3/50 hover:bg-surface-3 focus:bg-surface-3 focus:outline-none transition-all active:scale-95 group text-center cursor-pointer select-none"
        >
          <div className="h-10 w-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs">
            <ImageIcon className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {t("chat.creation.gallery")}
          </span>
        </CreationMenuRow>

        <CreationMenuRow
          asMenuItem={asMenuItem}
          onActivate={() => {
            cameraInputRef.current?.click();
            closeCreationSheet();
          }}
          className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-2xl border border-border/50 bg-surface-3/50 hover:bg-surface-3 focus:bg-surface-3 focus:outline-none transition-all active:scale-95 group text-center cursor-pointer select-none"
        >
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs">
            <Camera className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {t("chat.creation.camera")}
          </span>
        </CreationMenuRow>

        <CreationMenuRow
          asMenuItem={asMenuItem}
          onActivate={() => {
            fileInputRef.current?.click();
            closeCreationSheet();
          }}
          className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-2xl border border-border/50 bg-surface-3/50 hover:bg-surface-3 focus:bg-surface-3 focus:outline-none transition-all active:scale-95 group text-center cursor-pointer select-none"
        >
          <div className="h-10 w-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {t("chat.creation.file")}
          </span>
        </CreationMenuRow>
      </div>

      <div className="space-y-1.5">
        {onToggleWebSearchMode && (
          <CreationMenuRow
            asMenuItem={asMenuItem}
            onActivate={(e) => {
              e.preventDefault();
              onToggleWebSearchMode();
            }}
            className="flex items-center gap-3.5 rounded-2xl p-3 cursor-pointer transition-colors hover:bg-surface-3 focus:bg-surface-3 data-[highlighted]:bg-surface-3 active:scale-[0.99]"
          >
            <div className={cn(
              "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors shadow-xs",
              webSearchMode === "on"
                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                : webSearchMode === "auto"
                ? "bg-primary/10 text-primary"
                : "bg-surface-3 text-muted-foreground"
            )}>
              <Globe className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground tracking-tight truncate">
                  {t("chat.webSearch.title")}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs px-2 py-0.5 rounded-lg shrink-0",
                    webSearchMode === "on"
                      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold"
                      : webSearchMode === "auto"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground bg-surface-3"
                  )}
                >
                  {webSearchMode === "auto"
                    ? t("chat.webSearch.modeAuto")
                    : webSearchMode === "on"
                    ? t("chat.webSearch.modeOn")
                    : t("chat.webSearch.modeOff")}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {webSearchMode === "auto"
                  ? t("chat.webSearch.descAuto")
                  : webSearchMode === "on"
                  ? t("chat.webSearch.descOn")
                  : t("chat.webSearch.descOff")}
              </p>
            </div>
          </CreationMenuRow>
        )}

        <CreationMenuRow
          asMenuItem={asMenuItem}
          onActivate={() => {
            audioInputRef.current?.click();
            closeCreationSheet();
          }}
          className="flex items-center gap-3.5 rounded-2xl p-3 cursor-pointer transition-colors hover:bg-surface-3 focus:bg-surface-3 data-[highlighted]:bg-surface-3 active:scale-[0.99]"
        >
          <div className="h-10 w-10 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 shadow-xs">
            <AudioLines className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground tracking-tight">
                {t("chat.speech.audioToText")}
              </span>
              {isTranscribing && (
                <span className="flex items-center gap-1 font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
                  <RotateCw className="h-3 w-3 animate-spin" /> {t("chat.speech.transcribing")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {t("chat.speech.audioToTextDesc")}
            </p>
          </div>
        </CreationMenuRow>

        <CreationMenuRow
          asMenuItem={asMenuItem}
          onActivate={() => {
            onChangeCreationMode?.(creationMode === "image" ? "chat" : "image");
            closeCreationSheet();
          }}
          className={cn(
            "flex items-center gap-3.5 rounded-2xl p-3 cursor-pointer transition-colors active:scale-[0.99]",
            creationMode === "image"
              ? "bg-amber-500/10 border border-amber-500/30"
              : "hover:bg-surface-3 focus:bg-surface-3 data-[highlighted]:bg-surface-3"
          )}
        >
          <div className="h-10 w-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            <Palette className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground tracking-tight">
                {t("chat.creation.imageGen")}
              </span>
              {creationMode === "image" && (
                <span className="flex items-center gap-1 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Check className="h-3.5 w-3.5 stroke-[3]" /> {t("chat.creation.activeMode")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {t("chat.creation.imageGenDesc")}
            </p>
          </div>
        </CreationMenuRow>

        {isTrialMode ? (
          <CreationMenuRow
            asMenuItem={asMenuItem}
            onActivate={() => {
              toast.info(t("chat.creation.videoBlockedTitle"));
            }}
            className="flex items-center gap-3.5 rounded-2xl p-3 opacity-55 cursor-not-allowed hover:bg-transparent focus:bg-transparent data-[highlighted]:bg-transparent"
          >
            <div className="h-10 w-10 rounded-2xl bg-surface-3 text-muted-foreground flex items-center justify-center shrink-0 shadow-xs">
              <Video className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground tracking-tight">
                  {t("chat.creation.videoGen")}
                </span>
                <span className="font-mono text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                  {t("chat.creation.trialRestricted")}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {t("chat.creation.videoGenDesc")}
              </p>
            </div>
          </CreationMenuRow>
        ) : (
          <CreationMenuRow
            asMenuItem={asMenuItem}
            onActivate={() => {
              onChangeCreationMode?.(creationMode === "video" ? "chat" : "video");
              closeCreationSheet();
            }}
            className={cn(
              "flex items-center gap-3.5 rounded-2xl p-3 cursor-pointer transition-colors active:scale-[0.99]",
              creationMode === "video"
                ? "bg-purple-500/10 border border-purple-500/30"
                : "hover:bg-surface-3 focus:bg-surface-3 data-[highlighted]:bg-surface-3"
            )}
          >
            <div className="h-10 w-10 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-xs">
              <Video className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground tracking-tight">
                  {t("chat.creation.videoGen")}
                </span>
                {creationMode === "video" && (
                  <span className="flex items-center gap-1 font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
                    <Check className="h-3.5 w-3.5 stroke-[3]" /> {t("chat.creation.activeMode")}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {t("chat.creation.videoGenDesc")}
              </p>
            </div>
          </CreationMenuRow>
        )}

        <CreationMenuRow
          asMenuItem={asMenuItem}
          onActivate={() => {
            if (creationMode !== "chat") {
              onChangeCreationMode?.("chat");
            }
            handleSetTranslateMode(!isTranslateMode);
            closeCreationSheet();
          }}
          className={cn(
            "flex items-center gap-3.5 rounded-2xl p-3 cursor-pointer transition-colors active:scale-[0.99]",
            isTranslateMode && creationMode === "chat"
              ? "bg-indigo-500/10 border border-indigo-500/30"
              : "hover:bg-surface-3 focus:bg-surface-3 data-[highlighted]:bg-surface-3"
          )}
        >
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
            <Languages className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground tracking-tight">
                {t("chat.translate.menuTitle")}
              </span>
              {isTranslateMode && creationMode === "chat" && (
                <span className="flex items-center gap-1 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Check className="h-3.5 w-3.5 stroke-[3]" /> {t("chat.creation.activeMode")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {t("chat.translate.menuDesc")}
            </p>
          </div>
        </CreationMenuRow>
      </div>
    </>
  );

  const creationTrigger = (
    <Button
      variant={creationMode !== "chat" || isTranslateMode ? "outline" : "ghost"}
      size="icon"
      disabled={isStreaming || isUploading}
      className={cn(
        "h-9 w-9 rounded-full shrink-0 mb-0.5 transition-colors",
        creationMode === "image" && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20",
        creationMode === "video" && "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20",
        isTranslateMode && creationMode === "chat" && "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
      )}
      aria-label={t("chat.creation.menuLabel")}
    >
      {creationMode === "image" ? (
        <Palette className="h-4 w-4" />
      ) : creationMode === "video" ? (
        <Video className="h-4 w-4" />
      ) : isTranslateMode ? (
        <Languages className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden min-w-0 max-w-full">
      <span className="sr-only" role="status" aria-live="polite">
        {isStreaming
          ? isWaitingForFirstToken
            ? t("chat.empty.a11yThinking")
            : t("chat.empty.a11yGenerating")
          : messages.length > 0
          ? t("chat.empty.a11yDone")
          : ""}
      </span>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onKeyDown={handleContainerKeyDown}
        role="log"
        aria-label={t("chat.empty.logLabel")}
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={isStreaming}
        className={cn(
          "flex-1 overflow-x-hidden px-3.5 sm:px-5 md:px-8 relative min-w-0",
          messages.length > 0 || isStreaming
            ? "overflow-y-auto py-3 sm:py-5 space-y-6 sm:space-y-8"
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
            title={t("chat.empty.title")}
            description={t("chat.empty.description")}
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
                onFileClick={(file) => setPreviewFile(file)}
                canRegenerate={
                  !!onRegenerate && !isStreaming && !regenerating && msg.role === "assistant" && !!msg.id
                }
                regenerating={regenerating}
                onRegenerate={onRegenerate}
                onEditMessage={onEditMessage}
                onQuote={handleQuoteMessage}
                onContinue={
                  !isStreaming && msg.role === "assistant" && idx === messages.length - 1
                    ? () => onSendMessage(t("chat.message.continuePrompt"))
                    : undefined
                }
                onSelectSuggestion={(prompt) => onSendMessage(prompt)}
                siblingIndex={siblingInfoMap?.[msg.id || ""]?.current}
                siblingCount={siblingInfoMap?.[msg.id || ""]?.total}
                siblingIds={siblingInfoMap?.[msg.id || ""]?.siblingIds}
                onSwitchBranch={onSwitchBranch}
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
                      <span>
                        {t("chat.message.searching", { query: searchStatus.query ?? "" })}
                      </span>
                      {streamStartedAt && (
                        <ElapsedSeconds
                          startedAt={streamStartedAt}
                          className="font-mono text-xs opacity-80"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-3/50 px-3 py-1.5 text-xs text-muted-foreground sm:text-sm">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                      <span>{t("chat.message.thinkingLive")}</span>
                      {streamStartedAt && (
                        <ElapsedSeconds
                          startedAt={streamStartedAt}
                          className="font-mono text-xs opacity-80"
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {streamingSearchResults && streamingSearchResults.length > 0 && (
                    <SearchSources
                      results={streamingSearchResults}
                      defaultOpen={false}
                      className="mb-3"
                    />
                  )}

                  <div className="relative">
                    {renderMessageBody(streamingContent, true, handleImageClick)}
                    {(!streamingContent.includes("<think>") || streamingContent.includes("</think>")) && (
                      <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-border/40 pt-2 font-mono text-xs text-muted-foreground opacity-80">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 animate-spin text-primary" />
                      <span>{currentModel}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-muted-foreground">
                      {thinkingDuration != null && (
                        <span>
                          {t("chat.message.thinkingDuration", {
                            duration: `${thinkingDuration.toFixed(1)}s`,
                          })}{" · "}
                        </span>
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

      {showScrollBottomBtn && (
        <div className="absolute bottom-16 sm:bottom-20 right-4 sm:right-8 z-30 pointer-events-auto">
          <ActionTooltip label={t("chat.composer.scrollToLatestTip")} side="top">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                clearScrollLock();
                setShowScrollBottomBtn(false);
                scrollToBottom(true, true);
              }}
              className="rounded-full shadow-lg text-xs"
            >
              <ChevronDown className="h-4 w-4" />
              <span>{t("chat.composer.scrollToLatest")}</span>
            </Button>
          </ActionTooltip>
        </div>
      )}

      <div className="p-2 sm:p-3 border-t border-border/40 bg-background/95 backdrop-blur-md shrink-0 z-10">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          ref={composerContainerRef}
          className="max-w-3xl mx-auto rounded-2xl sm:rounded-3xl border border-border/70 dark:border-border/50 bg-background/90 dark:bg-surface-2/90 backdrop-blur-xl p-1 sm:p-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.35)] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all flex flex-col"
        >
          {showCommandsMenu && filteredCommands.length > 0 && (
            <div className="mx-1 mb-2 rounded-xl border border-border/80 bg-background/95 backdrop-blur-xl shadow-xl overflow-hidden p-1 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between px-2.5 py-1 text-xs font-medium text-muted-foreground border-b border-border/40 mb-1">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-primary" />
                  <span>{t("chat.commands.hint")}</span>
                </span>
                <span className="font-mono text-xs">
                  {t("chat.commands.count", { count: filteredCommands.length })}
                </span>
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
                      <span className="font-mono font-semibold text-xs px-1 rounded bg-black/10 dark:bg-white/10 shrink-0">
                        /{cmd.key}
                      </span>
                      <span className="truncate">{t(cmd.titleKey)}</span>
                    </div>
                    <span
                      className={cn(
                        "text-xs truncate ml-2 max-w-[180px] sm:max-w-[240px]",
                        idx === selectedCommandIdx ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      {t(cmd.descriptionKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isTranslateMode && (
            <div className="mx-1 mb-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in-0 duration-150">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Languages className="h-3.5 w-3.5" />
                  {t("chat.translate.bannerLabel")}
                  <span className="ml-1 text-indigo-500/80 font-normal">
                    {t("chat.translate.bannerPair", {
                      src: LOCALE_META[locale].shortName,
                      lang: selectedVocabLang
                        ? vocabLanguageName(selectedVocabLang, t)
                        : t("chat.translate.langs.ja"),
                    })}
                  </span>
                </span>
                <span className="text-muted-foreground truncate hidden sm:inline">
                  {t("chat.translate.bannerDesc")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSetTranslateMode(false)}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-surface-3 transition-colors text-xs cursor-pointer shrink-0"
                title={t("chat.translate.exitTip")}
              >
                <span>{t("chat.translate.exitLabel")}</span>
                <X className="h-3 w-3" />
              </button>

              <div className="w-full pt-1 border-t border-indigo-500/15 flex items-center gap-1 overflow-x-auto no-scrollbar">
                <span className="text-muted-foreground text-xs shrink-0 mr-0.5 font-medium">
                  {t("chat.translate.targetLabel")}
                </span>
                {VOCAB_TARGET_LANGUAGES.map((item) => {
                  const isSelected = vocabTargetLang === item.id;
                  const langName = vocabLanguageName(item, t);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectVocabLang(item.id)}
                      className={cn(
                        "px-2 py-0.5 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer border",
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold dark:bg-indigo-500"
                          : "bg-background/80 text-foreground/75 border-border/60 hover:bg-surface-3 hover:text-foreground"
                      )}
                      title={t("chat.translate.langChipTip", {
                        src: LOCALE_META[locale].shortName,
                        lang: langName,
                      })}
                    >
                      {vocabLanguageChipLabel(item, t)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeQuote && (
            <div className="mx-1 mb-1.5 p-2 rounded-xl bg-surface-3/80 border border-primary/20 flex items-start justify-between gap-2 text-xs">
              <div className="flex items-start gap-2 min-w-0">
                <Quote className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-semibold text-xs text-primary block">
                    {t("chat.composer.quoteLabel")}
                  </span>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {activeQuote.text}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveQuote(null)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">{t("chat.composer.cancelQuote")}</span>
              </Button>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-1.5 pt-0.5 px-1 border-b border-border/60">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  onClick={() => {
                    if (att.type === "image") {
                      setPreviewImage({ src: att.data_url, alt: att.name });
                    } else {
                      setPreviewFile(att);
                    }
                  }}
                  title={`${att.name} (${fmt.fileSize(att.size)}) - 点击查看预览`}
                  className="relative group shrink-0 flex items-center gap-2 p-1.5 pr-2 rounded-xl bg-card border border-border/70 dark:bg-surface-3 shadow-xs cursor-pointer hover:border-primary/50 transition-all select-none active:scale-[0.99]"
                >
                  {att.type === "image" ? (
                    <img
                      src={att.data_url}
                      alt={att.name}
                      className="h-9 w-9 rounded-lg object-cover border border-border/60 shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                  <div className="max-w-[110px] sm:max-w-[150px] min-w-0">
                    <p className="text-xs font-medium truncate" title={att.name}>
                      {att.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {fmt.fileSize(att.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
                    <ActionTooltip label={t("chat.markdown.download")} side="top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadAttachment(att)}
                        className="h-7 w-7 rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="sr-only">{t("chat.markdown.download")}</span>
                      </Button>
                    </ActionTooltip>
                    <ActionTooltip label={t("chat.composer.removeAttachment")} side="top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                        className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span className="sr-only">{t("chat.composer.removeAttachment")}</span>
                      </Button>
                    </ActionTooltip>
                  </div>
                </div>
              ))}
              {isUploading && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary font-mono">
                  <RotateCw className="h-3 w-3 animate-spin" />
                  <span>{t("chat.composer.processing")}</span>
                </div>
              )}
            </div>
          )}

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
            <input
              ref={galleryInputRef}
              type="file"
              multiple
              accept="image/*"
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
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
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
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.mp4,.webm,.ogg,.oga,.opus,.aac,.flac"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                if (e.target.files) {
                  handleAudioFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
            {isMobile ? (
              <Sheet open={creationSheetOpen} onOpenChange={setCreationSheetOpen}>
                <SheetTrigger asChild>{creationTrigger}</SheetTrigger>
                <SheetContent
                  side="bottom"
                  className="flex max-h-[82dvh] w-full flex-col gap-0 overflow-hidden rounded-t-sheet border-t border-border/50 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl sm:mx-auto sm:max-w-xl [&>button]:hidden"
                >
                  <div className="flex shrink-0 justify-center pb-1 pt-2.5">
                    <div className="h-1 w-9 rounded-full bg-foreground/20" />
                  </div>

                  <SheetHeader className="sr-only">
                    <SheetTitle>{t("chat.creation.sectionTitle")}</SheetTitle>
                    <SheetDescription>{t("chat.creation.sheetDesc")}</SheetDescription>
                  </SheetHeader>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-[max(0.5rem,var(--sab))]">
                    {renderCreationPanel(false)}
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>{creationTrigger}</DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  sideOffset={12}
                  collisionPadding={12}
                  style={composerWidth ? { width: `${composerWidth}px`, maxWidth: "calc(100vw - 24px)" } : undefined}
                  className={cn(
                    overlaySurfaceClass,
                    "rounded-[26px] p-2.5 sm:p-3 shadow-[0_24px_60px_rgba(0,0,0,0.25)] dark:shadow-[0_28px_70px_rgba(0,0,0,0.65)]"
                  )}
                >
                  {renderCreationPanel(true)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {recorder.isRecording && (
              <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 text-xs font-medium text-destructive">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-destructive" />
                <span className="font-mono tabular-nums">
                  {String(Math.floor(recorder.elapsed / 60)).padStart(2, "0")}:
                  {String(recorder.elapsed % 60).padStart(2, "0")}
                </span>
                <span
                  className="h-1 w-8 overflow-hidden rounded-full bg-destructive/20"
                  role="meter"
                  aria-label={t("chat.speech.meterLabel")}
                  aria-valuenow={Math.round(recorder.level * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    className="block h-full rounded-full bg-destructive transition-[width] duration-100"
                    style={{ width: `${Math.max(8, Math.round(recorder.level * 100))}%` }}
                  />
                </span>
              </span>
            )}
            <ActionTooltip
              label={
                recorder.unsupported
                  ? t("chat.speech.unsupported")
                  : isTranscribing
                  ? t("chat.speech.recognizing")
                  : recorder.isRecording
                  ? t("chat.speech.stopAndTranscribe")
                  : t("chat.speech.voiceInput")
              }
              side="top"
            >
              <Button
                type="button"
                variant={recorder.isRecording ? "destructive" : "ghost"}
                size="icon"
                disabled={recorder.unsupported || isTranscribing}
                onClick={toggleRecording}
                aria-label={recorder.isRecording ? t("chat.speech.stopRecording") : t("chat.speech.voiceInput")}
                className="h-9 w-9 shrink-0 rounded-full transition-colors"
              >
                {isTranscribing ? (
                  <RotateCw className="h-4 w-4 animate-spin" />
                ) : recorder.isRecording ? (
                  <Square className="h-4 w-4 fill-current" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </ActionTooltip>
            <Textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                creationMode === "video"
                  ? t("chat.composer.placeholderVideo")
                  : creationMode === "image"
                  ? t("chat.composer.placeholderImage")
                  : isTranslateMode
                  ? t("chat.translate.placeholder")
                  : t("chat.composer.placeholderChat")
              }
              aria-label={t("chat.composer.ariaLabel")}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-2.5 sm:px-3 py-2 text-base sm:text-body max-h-32 sm:max-h-44 leading-relaxed resize-none min-h-[36px]"
            />
            {isStreaming ? (
              <ActionTooltip label={t("chat.composer.stop")} side="top">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => onStopGenerating?.()}
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full shrink-0 ml-1 mb-1 shadow-sm"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span className="sr-only">{t("chat.composer.stop")}</span>
                </Button>
              </ActionTooltip>
            ) : (
              <ActionTooltip
                label={
                  isTouchPrimary ? t("chat.composer.send") : t("chat.composer.sendWithEnter")
                }
                side="top"
              >
                <Button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isStreaming || isUploading}
                  size="icon"
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full shrink-0 ml-1 mb-1 shadow-sm"
                >
                  <Send className="h-4 w-4" />
                  <span className="sr-only">{t("chat.composer.send")}</span>
                </Button>
              </ActionTooltip>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={cn(
            "flex w-full max-w-none flex-col gap-0 overflow-hidden border-0 bg-black/92 p-0 text-white shadow-none backdrop-blur-xl dark:bg-black/92",
            "h-[100dvh] max-h-[100dvh] rounded-none",
            "sm:h-auto sm:max-h-[92dvh] sm:w-auto sm:max-w-[min(94vw,1100px)] sm:rounded-2xl sm:shadow-2xl",
            "pt-[var(--sat)] pb-[max(0.75rem,var(--sab))] pl-[max(0.75rem,var(--sal))] pr-[max(0.75rem,var(--sar))]"
          )}
        >
          {previewImage && (
            <>
              <div className="flex shrink-0 items-center gap-2 py-2">
                <DialogTitle className="min-w-0 flex-1 truncate text-subhead font-semibold text-white/90">
                  {previewImage.alt || t("chat.composer.lightboxTitle")}
                </DialogTitle>

                <ActionTooltip label={t("chat.composer.lightboxDownloadTip")} side="bottom">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-9 shrink-0 cursor-pointer gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 text-footnote font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 active:scale-95"
                  >
                    <a
                      href={previewImage.src}
                      download={previewImage.alt || "image.png"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4" />
                      <span>{t("chat.composer.lightboxDownload")}</span>
                    </a>
                  </Button>
                </ActionTooltip>

                <DialogClose
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/90 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 active:scale-95"
                  aria-label={t("common.action.close")}
                >
                  <X className="h-4 w-4" />
                </DialogClose>
              </div>

              <div className="relative flex min-h-0 flex-1 touch-pinch-zoom">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImage.src}
                  alt={previewImage.alt || t("chat.composer.lightboxAlt")}
                  decoding="async"
                  className="h-full w-full select-none object-contain"
                />
              </div>

              <p className="shrink-0 select-none py-2 text-center text-xs text-white/75">
                {isTouchPrimary
                  ? t("chat.composer.lightboxHintTouch")
                  : t("chat.composer.lightboxHint")}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <FilePreviewModal
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />
    </div>
  );
};

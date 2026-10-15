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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/**
 * 附件预算，与后端 `backend/app/schemas/chat.py` 的校验保持一致。
 *
 * 三层的换算关系（附件是 base64 data URL 内联进 JSON 的，请求体 ≈ 原始字节 ×4/3）：
 *
 * - MAX_ATTACHMENT_BYTES 与后端单文件 20MB 对齐；
 * - MAX_TOTAL_ATTACHMENT_BYTES 与后端总量 40MB 对齐；
 * - 后端 `main.py` 的 MAX_REQUEST_BODY_BYTES 必须是 56MB，也就是总量 ×4/3 再留
 *   余量。否则请求体会先被中间件拒掉，这层的 40MB 就成了够不到的死配置。
 *
 * 这两个上限必须留在前端：超预算时后端拒的是**整条消息（连同正文）**，用户看到
 * 的只会是「消息发不出去」，而不是「附件选多了」。
 */
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 40 * 1024 * 1024;

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
}) => {
  const { t, fmt, locale } = useI18n();
  const isTouchPrimary = useIsTouchPrimary();
  const isTrialMode = useIsTrialMode();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 用户是否已主动上滚去回看上文。为 true 时，流式输出绝不再自动跟随底部。
  // 之所以不直接复用 scroll 事件算出来的「是否在底部」，见下方注释的竞态分析。
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

  // 智能翻译模式状态（优先使用外部传入，也可以内部管理）
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

  // 互译目标语种（默认日语 ja，支持外部受控同步与自身回退）
  const [internalVocabTargetLang, setInternalVocabTargetLang] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("apiapia_vocab_target_lang");
      if (saved && saved !== "auto") return saved;
    }
    return "ja";
  });
  const vocabTargetLang = propVocabTargetLang !== undefined ? propVocabTargetLang : internalVocabTargetLang;

  // 语种条目查出来一次，横幅与芯片栏共用；查不到（localStorage 里存了脏值）时
  // 由调用方决定回退文案。
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

  // ── Composer draft persistence ──────────────────────────────────
  // An unsent prompt should survive a reload or an accidental navigation.
  //
  // 草稿按会话分桶：此前是单一全局键 `apiapia_chat_draft`，在 A 会话打的草稿会
  // 出现在 B 会话里（跨会话串内容），而且「新建对话」不会清空它 —— 用户新建后
  // 看到的是上一个会话的半句话。
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

    // 关键：在第一个 await 之前把 FileList 拷成普通数组。
    //
    // `input.files` 和 `DataTransfer.files` 返回的都是**活对象**，浏览器在原地改
    // 动它。各处 onChange 调用 handleFiles 之后会立刻 `e.target.value = ""` 清
    // 空选择器，那一步正是在把这个活列表清空。而循环条件每次迭代都要重读
    // `files.length`：循环跑到第一个 await（compressImage / readFileAsDataUrl 都
    // 是异步的）时控制权回到 onChange，列表被清空，第二次迭代 length 变成 0，
    // **一次只会真正挂上第一个文件**。
    //
    // 粘贴路径没这个毛病，是因为 handlePaste 传进来的是它自己 new 的 File[]，
    // 本来就是快照。
    const files = Array.from(source);

    setIsUploading(true);
    try {
      const newAttachments: AttachmentItem[] = [];
      // 余量按已挂载的附件算，这样「先选 3 个、再选 3 个」也受同一个上限约束。
      let room = MAX_ATTACHMENTS - attachments.length;
      // 后端按**解码后**的字节累加；这里用原始 size 计费，不会因 base64 的
      // 长度估算误差被顶到线上。
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
    }
  };

  // ── Voice input (STT) ────────────────────────────────────────────────
  // The transcript lands in the textarea rather than being sent. Auto-sending
  // would make a mis-recognition unrecoverable — Whisper routinely turns a name
  // or a number into something plausible, and a hallucinated question goes
  // straight to the model. Putting it in the box costs one extra tap and lets
  // the user read what was actually heard.

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
    // Append rather than replace: someone may have typed part of a question
    // first, then hit record to add the rest.
    updateInput(input.trim() ? `${input.trim()} ${clean}` : clean);
    // Focus after the state commit, or the height reset below is applied to a
    // textarea that still holds the previous value.
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
      // ApiError already carries the backend's message, which names the actual
      // cause ("模型不支持该音色", "音频超过上限"). Anything else is a network
      // failure with nothing useful to say.
      toast.error(
        err instanceof ApiError ? err.message : t("chat.speech.transcribeFailed")
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const recorder = useAudioRecorder({
    onAutoStop: (audio) => {
      // The hook owns the time cap but not the upload, so the recording has to
      // be handed back here — otherwise a full minute of audio is discarded.
      toast.info(t("chat.speech.limitReached", { seconds: MAX_RECORDING_SECONDS }));
      void runTranscription(audio.blob);
    },
  });

  // Surface microphone failures (permission denied, no device) as a toast.
  // Done in an effect rather than at the throw site because they originate
  // inside an async callback that has no UI to return to.
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

  // ── 滚动跟随（跟随最新）────────────────────────────────────────────
  //
  // 这里的难点不是「要不要滚到底」，而是**什么时候算用户主动上滚了**。
  //
  // 之前只靠 onScroll 回填的 isAtBottomRef 判定，存在一个必然踩中的竞态：
  //   1. 用户滚轮上滚 → 浏览器同步改了 scrollTop，但 scroll 事件要等下一帧才派发；
  //   2. 打字机每 20ms 就触发一次 streamingContent 的 useEffect，它读到的仍是
  //      上一次的 isAtBottomRef === true，于是把 scrollTop 重设回 scrollHeight；
  //   3. 排队的 scroll 事件这才到达，读到的已经是被拽回后的底部状态。
  // 「模型思考结束、刚开始输出正文」那一刻最容易触发：正文要整段重解析 markdown，
  // 主线程最容易被占满，scroll 事件被拖过一帧的概率最高 —— 正好对应用户描述的现象。
  //
  // 修法：上滚「意图」由 wheel / touchmove / 方向键这些**同步派发**的手势直接上锁，
  // 抢在浏览器改 scrollTop 之前生效，useEffect 再怎么触发都读不到过期状态。
  // scroll 事件退化为只负责两件事：解锁（用户自己滚回了底部）、更新浮动按钮。

  const BOTTOM_FOLLOW_EPS = 8; // 判定「确实贴住底部」的严格阈值
  const BOTTOM_BTN_EPS = 120; // 判定是否显示「回到最新」的宽松阈值

  const clearScrollLock = () => {
    userScrolledAwayRef.current = false;
  };

  // 从实时 DOM 重新判定。随时可调，不写任何 DOM。
  const syncAtBottomState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    // 只有真正回到最底部才解锁。用宽松阈值解锁的话，用户轻轻上滑一小段
    // 也会立刻被判为「还在底部」，下一个 token 就把人拽回去。
    if (distanceFromBottom <= BOTTOM_FOLLOW_EPS) {
      clearScrollLock();
    }
    setShowScrollBottomBtn(distanceFromBottom > BOTTOM_BTN_EPS);
  };

  const handleScroll = () => syncAtBottomState();

  // 同步上锁：必须赶在浏览器改 scrollTop 之前跑完，所以不能用 scroll 事件。
  const lockScrollOnUserIntent = () => {
    const container = scrollContainerRef.current;
    // 内容压根没超出容器时（短对话、开场思考阶段）不存在滚动，
    // 此时上锁等于凭空让自动跟随停摆，等于把 bug 换了个方向。
    if (!container || container.scrollHeight <= container.clientHeight) return;
    userScrolledAwayRef.current = true;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // 向下滚不必上锁 —— 滚回底部时 syncAtBottomState 会自动解锁。
    if (e.deltaY < 0) lockScrollOnUserIntent();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // 只有点在滚动条上（clientWidth 之外的条带）才算拖滚动位置；
    // 点消息正文里的链接、按钮、代码块时不能锁。
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
    // 手指向下拖 = 内容向上走 = 用户在回看上文。
    // 留 6px 死区，否则点选文字时手的自然抖动也会误锁。
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
    // 用户已上滚回看历史时，非强制路径一律不打扰他的阅读位置。
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

  // 新 token 到达：只有用户没上滚才跟随。
  // 用 useLayoutEffect 让滚动与本次渲染落在同一帧，避免出现「先按旧位置画一帧、
  // 再瞬移到底部」的闪跳 —— 闪跳本身就会被感知成「被拉回来」。
  // 依赖里带上 isWaitingForFirstToken / streamingSearchResults：思考态切正文、
  // 以及引用来源块插入到正文上方，这两处都会在正文之外改变高度，
  // 只盯 streamingContent 会漏掉这一跳。
  useLayoutEffect(() => {
    if (!userScrolledAwayRef.current) {
      scrollToBottom(false, false);
    }
  }, [streamingContent, isWaitingForFirstToken, streamingSearchResults]);

  // 新消息进入列表 / 会话消息加载完成：跟随最新。
  // 不再无条件 force：生成结束把流式气泡落成正式消息时，用户很可能正在回看上文，
  // 此时上方内容没有变化，保持他的位置才是对的。需要强制跟随的场景
  // （发送、切换会话、点「回到最新」）各自显式清锁即可。
  useLayoutEffect(() => {
    // An empty list cannot be "scrolled away from": drop the floating button
    // immediately instead of waiting for a scroll event that never comes.
    if (messages.length === 0) {
      clearScrollLock();
      setShowScrollBottomBtn(false);
      return;
    }
    scrollToBottom(false, true);
  }, [messages.length]);

  // 切换 / 新建对话时整块内容被替换，浏览器不会为此派发 scroll 事件，
  // 所以必须主动复位，否则"回到最新"按钮会残留在空白的对话上。
  useEffect(() => {
    clearScrollLock();
    setShowScrollBottomBtn(false);
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = 0;
    // Content is loaded async; the [messages.length] effect above handles the
    // final scroll-to-bottom once the new messages land.
  }, [conversationId]);

  // 新一轮生成开始时一律贴回底部。
  // handleSend 已经清过锁，但「重新生成」「编辑后重发」不是从 handleSend 发起的，
  // 用户点这两个按钮时可能正停在历史的某条消息上；新一轮回答理应从底部开始看。
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
// 翻译目标跟随界面语言：传 locale，提示词里的「本端语言」据此生成，
    // 而不是像以前那样写死中文。
    extraOpts.systemPromptOverride = buildVocabTutorPrompt(vocabTargetLang, locale);
      // 翻译模式下强制关闭联网搜索与长期记忆，并开启单轮模式（不带历史上下文），确保极速响应并节省 Token
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
            ? t("chat.empty.a11yThinking")
            : t("chat.empty.a11yGenerating")
          : messages.length > 0
          ? t("chat.empty.a11yDone")
          : ""}
      </span>

      {/* Messages Scroll Area */}
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
          // space-y 必须与下方消息列表内部的 space-y-6 sm:space-y-8 一致。
          //
          // 流式块是「列表 div」的**兄弟节点**，所以它和最后一条已渲染消息之间的
          // 间距由**这里**决定，而不是列表内部的值。此前这里写的是 space-y-3
          // sm:space-y-4（12/16px），于是生成结束后：流式块卸载 → 正式消息挂进
          // 列表内部 → 间距从 12px 变成 24px（sm+ 从 16 变 32）→ 答案在用户眼前
          // 整体下移一格，底栏同时从流式 meta 整条换成操作栏。每条消息都会触发。
          //
          // 两处取同一个值后，生成中与生成后的间距同源，位置不再跳。附带效果：
          // messagesEndRef 那个空 div（scrollIntoView 的锚点）下方留白从 12px
          // 变成 24px，是列表末尾更正常的呼吸空间。
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
                /* Stage 2: Streaming Output with Typing Cursor */
                <div>
                  {/* 参考网页：列在思考过程与正文内容上方 */}
                  {streamingSearchResults && streamingSearchResults.length > 0 && (
                    <SearchSources
                      results={streamingSearchResults}
                      defaultOpen={false}
                      className="mb-3"
                    />
                  )}

                  <div className="relative">
                    {renderMessageBody(streamingContent, true, handleImageClick)}
                    {/* 输入光标。animate-caret 是 530ms 硬开关（tailwind.config.ts 里
                    新增的 keyframe），不是 animate-pulse 那种 2 秒不透明度呼吸。 */}
                    <span className="ml-1.5 inline-block h-[18px] w-2 translate-y-0.5 animate-caret rounded-xs bg-primary/80" />
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

      {/* Floating Scroll-to-Bottom Button */}
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
          ref={composerContainerRef}
          className="max-w-3xl mx-auto rounded-2xl sm:rounded-3xl border border-border/70 dark:border-border/50 bg-background/90 dark:bg-surface-2/90 backdrop-blur-xl p-1 sm:p-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.35)] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all flex flex-col"
        >
          {/* Slash Commands Autocomplete Popup */}
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

          {/* Active Translation Mode Banner */}
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

              {/* 快速语种选择栏：首选英文、日语、中文，其次按全球使用广泛度排序 */}
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

          {/* Active Quoted Message Preview Tray */}
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
                    <p className="text-xs text-muted-foreground font-mono">
                      {fmt.fileSize(att.size)}
                    </p>
                  </div>
                  <ActionTooltip label={t("chat.composer.removeAttachment")} side="top">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">{t("chat.composer.removeAttachment")}</span>
                    </Button>
                  </ActionTooltip>
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

          {/* Input Controls Row */}
          <div className="flex items-end gap-1">
            {/* Hidden Input: 通用文件选择 */}
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
            {/* Hidden Input: 相册（纯图片/视频） */}
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
            {/* Hidden Input: 相机拍照 (移动端调用 capture) */}
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
            {/* Hidden Input: 音频文件（转写用）。
                Not routed through handleFiles: that path base64-encodes the
                file into a chat attachment and sends it to the LLM as
                multimodal content, whereas audio here is transcribed server-side
                first and only the resulting text ever reaches the model. */}
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
            {/* Creation Plus Dropdown Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
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
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={12}
                collisionPadding={12}
                style={composerWidth ? { width: `${composerWidth}px`, maxWidth: "calc(100vw - 24px)" } : undefined}
                className={cn(
                  // 材质来自 overlaySurfaceClass，这里只保留这块面板刻意更大的
                  // 三处：更深的圆角、更宽的内距（内部是三列卡片网格）、更重
                  // 的阴影。宽度由上面的 inline style 按输入框实际宽度钉死，
                  // 所以默认的 w-max / min-w 不参与。末尾 6 个 animate-in /
                  // zoom-in-95 原本是基础类已有的（data-[state=open]: 版），冗余。
                  overlaySurfaceClass,
                  "rounded-[26px] p-2.5 sm:p-3 shadow-[0_24px_60px_rgba(0,0,0,0.25)] dark:shadow-[0_28px_70px_rgba(0,0,0,0.65)]"
                )}
              >
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
                      className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      {t("chat.creation.restoreChat")}
                    </button>
                  )}
                </div>

                {/* 顶部横排 3 按钮：相册、相机、文件 (加大尺寸与呼吸感) */}
                <div className="grid grid-cols-3 gap-2 px-0.5 mb-2.5">
                  <DropdownMenuItem asChild>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-2xl border border-border/50 bg-surface-3/50 hover:bg-surface-3 focus:bg-surface-3 focus:outline-none transition-all active:scale-95 group text-center cursor-pointer select-none"
                    >
                      <div className="h-10 w-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-foreground tracking-tight">
                        {t("chat.creation.gallery")}
                      </span>
                    </button>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-2xl border border-border/50 bg-surface-3/50 hover:bg-surface-3 focus:bg-surface-3 focus:outline-none transition-all active:scale-95 group text-center cursor-pointer select-none"
                    >
                      <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs">
                        <Camera className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-foreground tracking-tight">
                        {t("chat.creation.camera")}
                      </span>
                    </button>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-2xl border border-border/50 bg-surface-3/50 hover:bg-surface-3 focus:bg-surface-3 focus:outline-none transition-all active:scale-95 group text-center cursor-pointer select-none"
                    >
                      <div className="h-10 w-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs">
                        <FileText className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-foreground tracking-tight">
                        {t("chat.creation.file")}
                      </span>
                    </button>
                  </DropdownMenuItem>
                </div>

                <div className="space-y-1.5">
                  {/* 2. 联网检索 */}
                  {onToggleWebSearchMode && (
                    <DropdownMenuItem
                      onClick={(e) => {
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
                          <span className="text-sm font-semibold text-foreground tracking-tight">
                            {t("chat.webSearch.title")}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-xs px-2 py-0.5 rounded-lg",
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
                    </DropdownMenuItem>
                  )}

                  {/* 3. 音频转文字 */}
                  <DropdownMenuItem
                    onClick={() => audioInputRef.current?.click()}
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
                  </DropdownMenuItem>

                  {/* 4. 生成图片 */}
                  <DropdownMenuItem
                    onClick={() => onChangeCreationMode?.(creationMode === "image" ? "chat" : "image")}
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
                  </DropdownMenuItem>

                  {/* 5. 生成视频 */}
                  {isTrialMode ? (
                    <DropdownMenuItem
                      onClick={() => {
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
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => onChangeCreationMode?.(creationMode === "video" ? "chat" : "video")}
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
                    </DropdownMenuItem>
                  )}

                  {/* 6. 智能翻译 */}
                  <DropdownMenuItem
                    onClick={() => {
                      if (creationMode !== "chat") {
                        onChangeCreationMode?.("chat");
                      }
                      handleSetTranslateMode(!isTranslateMode);
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
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 录音状态条：录音时出现，显示时长与实时音量。

                The meter is not decoration. A mic that is silently not picking
                anything up produces a confident, empty transcript and a user
                who blames the app; seeing the level bar move while speaking is
                the difference between "my microphone is broken" and "I am just
                too quiet". */}
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
                  {/* Floor of 8% so the bar reads as "meter present" rather
                      than "broken" during a natural pause. */}
                  <span
                    className="block h-full rounded-full bg-destructive transition-[width] duration-100"
                    style={{ width: `${Math.max(8, Math.round(recorder.level * 100))}%` }}
                  />
                </span>
              </span>
            )}
            {/* 语音输入：录音 -> 转写 -> 文本进入输入框 */}
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
              // 此前输入框既无 <label> 也无 aria-label，屏幕阅读器只会念出
              // placeholder，且 placeholder 一输入就消失。
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

      {/* ── 图片查看器 ────────────────────────────────────────────────────
          此前是「一张居中的黑色卡片」：DialogContent 是 fixed + translate 居中，
          内部 overflow 没有放开，而图片按 max-h-[75vh] 约束，上面再叠顶栏、
          底部提示和 p-3/sm-p-6 —— 合计高度会超过视口。超出部分从上下两端被裁掉
          且无法滚动，横屏手机（可视高度约 375px）必然点不到顶栏的下载键。

          改动：
          1. 移动端铺满整屏、sm 以上才回到居中卡片，与 iOS / Android 相册一致，
             图片拿到整屏可用面积，也顺带消掉了高度溢出。
          2. 高度改由 flex 链决定：顶栏 flex-none、图片容器 min-h-0 flex-1、
             图片 h-full w-full object-contain，不再有 vh 魔法数字互相打架。
          3. touch-action: pinch-zoom 显式放行双指缩放 —— Radix Dialog 打开时
             会锁掉 body 的触摸手势，默认会被吃掉，而「看图」最核心的手势就是缩放。
          4. 自绘深色控件：默认关闭键是浅色 bg-accent，叠在纯黑上是一块浅灰方块。
          5. 下载键从 32px 提到 36px，并去掉 secondary 的亮色实心底。
          6. 底部提示改成按输入方式分流：触摸设备上没有 Esc 键，原来那句
             "Press Esc or click outside to close" 对手机用户是错的。
             ---------------------------------------------------------------- */}
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
            // 刘海 / home 条：与 MobileHeader 引用同一组变量，不另抄字面量
            "pt-[var(--sat)] pb-[max(0.75rem,var(--sab))] pl-[max(0.75rem,var(--sal))] pr-[max(0.75rem,var(--sar))]"
          )}
        >
          {previewImage && (
            <>
              {/* 顶栏：标题 + 下载 + 关闭 */}
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

              {/* 图片：flex-1 + min-h-0 让它自己收缩，容器高度永远不溢出 */}
              <div className="relative flex min-h-0 flex-1 touch-pinch-zoom">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImage.src}
                  alt={previewImage.alt || t("chat.composer.lightboxAlt")}
                  decoding="async"
                  className="h-full w-full select-none object-contain"
                />
              </div>

              {/* 提示：触摸设备没有 Esc 键，那句话对手机用户是错的 */}
              <p className="shrink-0 select-none py-2 text-center text-xs text-white/75">
                {isTouchPrimary
                  ? t("chat.composer.lightboxHintTouch")
                  : t("chat.composer.lightboxHint")}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

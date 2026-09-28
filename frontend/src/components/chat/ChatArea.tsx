"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, ModelCatalogItem, AttachmentItem, SearchResultItem } from "@/types";
import { isFreeModel, isMultimodalModel } from "@/components/common/ModelSelect";
import { ThemeToggle } from "@/components/common/ThemeToggle";
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
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  ZoomIn,
  Download,
  Copy,
  Globe,
  ExternalLink,
} from "lucide-react";

function parseSearchResults(raw: any): SearchResultItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

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

function renderWithBreaks(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") {
    if (!/<\s*br\s*\/?>|&lt;\s*br\s*\/?&gt;/i.test(node)) return node;
    const parts = node.split(/(<\s*br\s*\/?>|&lt;\s*br\s*\/?&gt;)/gi);
    return parts.map((part, index) => {
      if (/^(<\s*br\s*\/?>|&lt;\s*br\s*\/?&gt;)$/i.test(part)) {
        return <br key={index} />;
      }
      return part;
    });
  }
  if (Array.isArray(node)) {
    return node.map((child, idx) => (
      <React.Fragment key={idx}>{renderWithBreaks(child)}</React.Fragment>
    ));
  }
  if (React.isValidElement(node) && (node.props as any)?.children) {
    return React.cloneElement(node, {
      ...(node.props as any),
      children: renderWithBreaks((node.props as any).children),
    });
  }
  return node;
}

const markdownComponents = {
  img: ({ node, ...props }: any) => (
    <img
      {...props}
      alt={props.alt || "image"}
      className="max-h-80 max-w-full rounded-xl border border-slate-200 dark:border-slate-700/80 my-2 object-contain shadow-sm"
    />
  ),
  a: ({ node, ...props }: any) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-500 font-medium break-all [overflow-wrap:anywhere]"
    />
  ),
  p: ({ node, children, ...props }: any) => (
    <p {...props} className="break-words [overflow-wrap:anywhere] leading-[1.65] my-2 text-[15px] sm:text-sm text-slate-800 dark:text-slate-200">
      {renderWithBreaks(children)}
    </p>
  ),
  h1: ({ node, ...props }: any) => (
    <h1 {...props} className="text-base sm:text-lg font-bold mt-4 mb-2 text-slate-900 dark:text-white" />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 {...props} className="text-sm sm:text-base font-bold mt-3 mb-1.5 text-slate-900 dark:text-white" />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 {...props} className="text-xs sm:text-sm font-semibold mt-2.5 mb-1 text-slate-900 dark:text-white" />
  ),
  table: ({ node, ...props }: any) => (
    <div className="w-full max-w-full my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
      <table {...props} className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm border-collapse" />
    </div>
  ),
  thead: ({ node, ...props }: any) => (
    <thead {...props} className="bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300" />
  ),
  th: ({ node, children, ...props }: any) => (
    <th {...props} className="px-3.5 py-2.5 font-semibold text-left border-b border-slate-200 dark:border-slate-800 whitespace-nowrap bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
      {renderWithBreaks(children)}
    </th>
  ),
  td: ({ node, children, ...props }: any) => (
    <td {...props} className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-800 dark:text-slate-200 align-top">
      {renderWithBreaks(children)}
    </td>
  ),
  pre: ({ node, ...props }: any) => (
    <pre
      {...props}
      className="my-2.5 max-w-full overflow-x-auto rounded-xl bg-slate-900 dark:bg-slate-950 p-3 sm:p-4 text-[13px] sm:text-xs text-slate-100 font-mono shadow-inner border border-slate-800/80"
    />
  ),
  code: ({ node, inline, className, children, ...props }: any) => {
    const isInline = inline || !className;
    if (isInline) {
      return (
        <code
          {...props}
          className="px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono text-[13px] sm:text-xs break-all [overflow-wrap:anywhere]"
        >
          {children}
        </code>
      );
    }
    return (
      <code {...props} className={`${className || ""} font-mono text-[13px] sm:text-xs`}>
        {children}
      </code>
    );
  },
  ul: ({ node, ...props }: any) => (
    <ul {...props} className="list-disc list-outside pl-4 sm:pl-5 my-1.5 space-y-1 break-words [overflow-wrap:anywhere]" />
  ),
  ol: ({ node, ...props }: any) => (
    <ol {...props} className="list-decimal list-outside pl-4 sm:pl-5 my-1.5 space-y-1 break-words [overflow-wrap:anywhere]" />
  ),
  li: ({ node, children, ...props }: any) => (
    <li {...props} className="break-words [overflow-wrap:anywhere] leading-[1.6] my-1 text-[15px] sm:text-sm text-slate-800 dark:text-slate-200">
      {renderWithBreaks(children)}
    </li>
  ),
  blockquote: ({ node, ...props }: any) => (
    <blockquote {...props} className="border-l-3 border-indigo-500 pl-3 py-1 my-2 text-slate-600 dark:text-slate-400 italic break-words [overflow-wrap:anywhere]" />
  ),
};

function renderMessageBody(
  content: string,
  isStreaming = false,
  onImageClick?: (src: string, alt?: string) => void
) {
  if (!content) return null;

  const dynamicComponents = {
    ...markdownComponents,
    img: ({ node, ...props }: any) => (
      <img
        {...props}
        alt={props.alt || "image"}
        onClick={() => props.src && onImageClick?.(props.src, props.alt)}
        className="max-h-80 max-w-full rounded-xl border border-slate-200 dark:border-slate-700/80 my-2 object-contain shadow-sm cursor-zoom-in hover:opacity-95 transition-opacity"
        title="点击放大查看原图"
      />
    ),
  };

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
            className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-2.5 text-xs group transition-all min-w-0 max-w-full overflow-hidden"
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
            <div className="mt-2 pl-2.5 border-l-2 border-indigo-400 dark:border-indigo-600 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto overflow-x-hidden leading-relaxed break-words [overflow-wrap:anywhere]">
              {thought}
            </div>
          </details>
        )}
        {mainContent ? (
          <div className="prose dark:prose-invert prose-sm max-w-none min-w-0 max-w-full break-words [overflow-wrap:anywhere] text-slate-800 dark:text-slate-200">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={dynamicComponents}
              urlTransform={(url) => url}
            >
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
    <div className="prose dark:prose-invert prose-sm max-w-none min-w-0 max-w-full break-words [overflow-wrap:anywhere] text-slate-800 dark:text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={dynamicComponents}
        urlTransform={(url) => url}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-indigo-600 dark:bg-indigo-400 animate-pulse align-middle" />
      )}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ParsedUserMessage {
  text: string;
  images: { name: string; url: string }[];
  docs: string[];
}

function parseUserMessage(content: string): ParsedUserMessage {
  if (!content) return { text: "", images: [], docs: [] };

  const images: { name: string; url: string }[] = [];
  const docs: string[] = [];

  // 1. Match Markdown images: ![alt](url)
  // Supports data:image/... and https?://...
  const imgRegex = /!\[([^\]]*)\]\(((?:data:image\/[^;)]+;base64,[A-Za-z0-9+/=]+)|(?:https?:\/\/[^\s)]+))\)/gi;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    images.push({
      name: match[1] || "图片",
      url: match[2],
    });
  }

  // 2. Also match any direct raw data:image/... strings if stored without markdown
  if (images.length === 0 && content.includes("data:image/")) {
    const rawDataRegex = /(data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]+)/g;
    let rawMatch;
    while ((rawMatch = rawDataRegex.exec(content)) !== null) {
      images.push({
        name: "图片",
        url: rawMatch[1],
      });
    }
  }

  // 3. Match Document badges: 📄 **[附件文件: filename]** or 📄 [附件文档: filename]
  const docRegex = /📄\s*\*{0,2}\[?(?:附件文件|附件文档|附带文件):\s*([^\]\*\n]+)\]?\*{0,2}/gi;
  let docMatch;
  while ((docMatch = docRegex.exec(content)) !== null) {
    docs.push(docMatch[1].trim());
  }

  // 4. Remove image tags, raw base64, and doc badges from text to leave clean user question
  let cleanText = content
    .replace(imgRegex, "")
    .replace(/(data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]+)/g, "")
    .replace(docRegex, "")
    .trim();

  return { text: cleanText, images, docs };
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
  currentModel: string;
  onModelChange: (model: string) => void;
  availableModels: ModelCatalogItem[];
  onSendMessage: (message: string, attachments?: AttachmentItem[]) => void;
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
  webSearchMode = "auto",
  onToggleWebSearchMode,
  searchStatus = { state: "idle" },
  streamingSearchResults = null,
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

  // Close image preview on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
            alert(`文件 ${file.name} 超过 15MB 上传限制`);
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
    if (selectedProviderFilter === "multimodal") return isMultimodalModel(m);
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
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 relative overflow-hidden transition-colors min-w-0 max-w-full">
      {/* Top Bar with Searchable Model Picker & Mobile/Tablet Controls */}
      <div className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 sm:px-4 flex items-center justify-between z-20 gap-1.5 sm:gap-2 flex-nowrap min-w-0 pt-[max(0.65rem,env(safe-area-inset-top))] pb-2 md:pb-2 md:pt-2 min-h-[calc(3.25rem+env(safe-area-inset-top,0px))] md:min-h-12 transition-colors">
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
            {activeModelObj && isMultimodalModel(activeModelObj) && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30 shrink-0">
                多模态
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
              title="向配置的提供商 API (Gemini/OpenAI/OpenRouter/Ollama) 手动同步最新模型"
              className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-white bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRefreshingModels ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""}`} />
              <span className="hidden lg:inline">{isRefreshingModels ? "正在同步..." : "同步模型"}</span>
            </button>
          )}

          {/* Searchable Dropdown Modal/Panel - Mobile Full Screen/Centered */}
          {modelDropdownOpen && (
            <div className="fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:absolute sm:inset-x-auto sm:left-0 sm:top-10 sm:mt-1 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-2xl backdrop-blur-md p-3 z-50 flex flex-col max-h-[75vh]">
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
                  {availableModels.some(isMultimodalModel) && (
                    <button
                      type="button"
                      onClick={() => setSelectedProviderFilter("multimodal")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                        selectedProviderFilter === "multimodal"
                          ? "bg-violet-600 text-white shadow-xs"
                          : "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800/50"
                      }`}
                    >
                      多模态 ({availableModels.filter(isMultimodalModel).length})
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
                    const isMM = isMultimodalModel(m);
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
                            {isMM && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                                多模态
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
          <ThemeToggle />

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
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 sm:px-5 sm:py-5 md:px-8 space-y-3 sm:space-y-4 relative min-w-0"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-3 shadow-inner">
              <Sparkles className="h-6 w-6 sm:h-8 sm:w-8" />
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
                className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex flex-col min-w-0 ${
                    isUser
                      ? "items-end max-w-[88%] sm:max-w-[78%]"
                      : "items-start w-full max-w-full sm:max-w-3xl"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-[15px] sm:text-sm leading-relaxed min-w-0 max-w-full break-words [overflow-wrap:anywhere] ${
                      isUser
                        ? "bg-indigo-600 text-white shadow-xs font-normal rounded-br-xs"
                        : isErrorMsg
                        ? "bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200 shadow-xs rounded-tl-xs w-full py-2.5 sm:py-3.5"
                        : "bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 text-slate-800 dark:text-slate-200 shadow-xs rounded-tl-xs w-full py-2.5 sm:py-3.5"
                    }`}
                  >
                    {isUser ? (
                      <div>
                        {/* 1. In-memory attachments (if present in current session) */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2 justify-end">
                            {msg.attachments.map((att) =>
                              att.type === "image" ? (
                                <div
                                  key={att.id}
                                  onClick={() => setPreviewImage({ src: att.data_url, alt: att.name })}
                                  className="relative group rounded-xl overflow-hidden border border-white/20 shadow-md bg-black/20 cursor-zoom-in"
                                  title="点击放大查看原图"
                                >
                                  <img
                                    src={att.data_url}
                                    alt={att.name}
                                    className="max-h-48 max-w-[240px] sm:max-w-xs object-cover rounded-lg group-hover:scale-105 transition-transform duration-200"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                                    <ZoomIn className="h-5 w-5 drop-shadow-md" />
                                  </div>
                                </div>
                              ) : (
                                <div
                                  key={att.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-700/70 border border-indigo-400/40 text-xs text-white shadow-xs"
                                >
                                  <FileText className="h-4 w-4 shrink-0 text-indigo-200" />
                                  <span className="font-medium truncate max-w-[160px]" title={att.name}>
                                    {att.name}
                                  </span>
                                  <span className="text-[10px] text-indigo-200 font-mono">
                                    {formatFileSize(att.size)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {/* 2. Database-loaded message (after refresh, msg.attachments is undefined) */}
                        {(() => {
                          if (msg.attachments && msg.attachments.length > 0) {
                            return <div className="whitespace-pre-wrap break-words">{msg.content}</div>;
                          }

                          const parsed = parseUserMessage(msg.content);
                          const hasMedia = parsed.images.length > 0 || parsed.docs.length > 0;

                          return (
                            <>
                              {hasMedia && (
                                <div className="flex flex-wrap gap-2 mb-2 justify-end">
                                  {parsed.images.map((img, i) => (
                                    <div
                                      key={i}
                                      onClick={() => setPreviewImage({ src: img.url, alt: img.name })}
                                      className="relative group rounded-xl overflow-hidden border border-white/20 shadow-md bg-black/20 cursor-zoom-in"
                                      title="点击放大查看原图"
                                    >
                                      <img
                                        src={img.url}
                                        alt={img.name}
                                        className="max-h-48 max-w-[240px] sm:max-w-xs object-cover rounded-lg group-hover:scale-105 transition-transform duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                                        <ZoomIn className="h-5 w-5 drop-shadow-md" />
                                      </div>
                                    </div>
                                  ))}
                                  {parsed.docs.map((docName, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-700/70 border border-indigo-400/40 text-xs text-white shadow-xs"
                                    >
                                      <FileText className="h-4 w-4 shrink-0 text-indigo-200" />
                                      <span className="font-medium truncate max-w-[160px]" title={docName}>
                                        {docName}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {parsed.text ? (
                                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{parsed.text}</div>
                              ) : !hasMedia ? (
                                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    ) : isErrorMsg ? (
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400 mb-1">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>生成出错：</span>
                        </div>
                        <div className="whitespace-pre-wrap font-mono text-xs text-rose-700 dark:text-rose-300 break-words [overflow-wrap:anywhere] bg-rose-100/50 dark:bg-rose-900/30 p-2.5 rounded-lg border border-rose-200/50 dark:border-rose-800/40">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const searchResults = parseSearchResults(msg.search_results);
                          if (searchResults.length === 0) return null;
                          return (
                            <div className="mb-2.5">
                              <details className="group rounded-xl border border-sky-200/80 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 text-xs overflow-hidden transition-all">
                                <summary className="cursor-pointer select-none font-medium text-sky-700 dark:text-sky-300 flex items-center justify-between p-2 sm:p-2.5 hover:bg-sky-100/50 dark:hover:bg-sky-900/30 transition-colors">
                                  <span className="flex items-center gap-1.5">
                                    <Globe className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                                    <span>参考了 {searchResults.length} 个网页来源</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">
                                    ▼
                                  </span>
                                </summary>
                                <div className="p-2 sm:p-2.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-sky-100/80 dark:border-sky-900/40">
                                  {searchResults.map((item, sIdx) => (
                                    <a
                                      key={sIdx}
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group/card flex flex-col p-2 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-xs transition-all text-left"
                                      title={item.title}
                                    >
                                      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 group-hover/card:text-sky-600 dark:group-hover/card:text-sky-400">
                                        <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-sky-100 dark:bg-sky-900/70 text-sky-600 dark:text-sky-300 text-[9px] flex items-center justify-center font-bold">
                                          {sIdx + 1}
                                        </span>
                                        <span className="truncate">{item.title}</span>
                                        <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity ml-auto text-sky-500" />
                                      </div>
                                      {item.snippet && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-snug break-words">
                                          {item.snippet}
                                        </p>
                                      )}
                                      <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-1 font-mono">
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
                          );
                        })()}
                        {renderMessageBody(msg.content, false, (src, alt) => setPreviewImage({ src, alt }))}
                      </>
                    )}
                  </div>

                  {/* Message Meta Info & Mobile Action Bar */}
                  {!isUser && !isErrorMsg && (
                    <div className="flex items-center justify-between gap-1.5 flex-wrap text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 px-0.5 font-mono">
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                          </span>
                        ) : null}
                      </div>

                      {/* Copy Message Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.content, idx)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0 select-none"
                        title="复制回答内容"
                      >
                        {copiedIdx === idx ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-500 font-sans text-[11px] font-medium">已复制</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span className="font-sans text-[11px]">复制</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Current Streaming Message */}
        {isStreaming && (
          <div className="w-full max-w-full sm:max-w-3xl mr-auto min-w-0">
            <div className="rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3.5 text-[15px] sm:text-sm leading-relaxed bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 text-slate-800 dark:text-slate-200 shadow-xs w-full min-w-0 break-words [overflow-wrap:anywhere] rounded-tl-xs">
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
                      <details className="group rounded-xl border border-sky-200/80 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 text-xs overflow-hidden transition-all">
                        <summary className="cursor-pointer select-none font-medium text-sky-700 dark:text-sky-300 flex items-center justify-between p-2 sm:p-2.5 hover:bg-sky-100/50 dark:hover:bg-sky-900/30 transition-colors">
                          <span className="flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                            <span>参考了 {streamingSearchResults.length} 个网页来源</span>
                          </span>
                          <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">
                            ▼
                          </span>
                        </summary>
                        <div className="p-2 sm:p-2.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-sky-100/80 dark:border-sky-900/40">
                          {streamingSearchResults.map((item, sIdx) => (
                            <a
                              key={sIdx}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/card flex flex-col p-2 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-xs transition-all text-left"
                              title={item.title}
                            >
                              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 group-hover/card:text-sky-600 dark:group-hover/card:text-sky-400">
                                <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-sky-100 dark:bg-sky-900/70 text-sky-600 dark:text-sky-300 text-[9px] flex items-center justify-center font-bold">
                                  {sIdx + 1}
                                </span>
                                <span className="truncate">{item.title}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity ml-auto text-sky-500" />
                              </div>
                              {item.snippet && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-snug break-words">
                                  {item.snippet}
                                </p>
                              )}
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-1 font-mono">
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
      <div className="px-2 py-1.5 sm:p-3 sm:px-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors safe-pb">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          className="max-w-3xl mx-auto rounded-2xl sm:rounded-3xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950 p-1 sm:p-1.5 focus-within:border-indigo-500 shadow-xs flex flex-col transition-all"
        >
          {/* Attachment Preview Tray */}
          {attachments.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-1.5 pt-0.5 px-1 border-b border-slate-200/70 dark:border-slate-800/80">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="relative group shrink-0 flex items-center gap-2 p-1.5 pr-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs"
                >
                  {att.type === "image" ? (
                    <img
                      src={att.data_url}
                      alt={att.name}
                      className="h-9 w-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                  <div className="max-w-[110px] sm:max-w-[150px] min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" title={att.name}>
                      {att.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {formatFileSize(att.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="移除附件"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {isUploading && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-indigo-500 font-mono">
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploading}
              title="上传图片或文件（PDF、Word、代码、文本）"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 transition-all shrink-0 mb-0.5 disabled:opacity-40"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            {onToggleWebSearchMode && (
              <button
                type="button"
                onClick={onToggleWebSearchMode}
                disabled={isStreaming}
                title={
                  webSearchMode === "auto"
                    ? "联网检索: 自动智能 (系统根据问题自动决定是否检索)"
                    : webSearchMode === "on"
                    ? "联网检索: 强制开启 (每次提问均搜索最新网络)"
                    : "联网检索: 已关闭 (仅使用模型自身知识)"
                }
                className={`flex items-center gap-1 h-9 px-2 sm:px-2.5 rounded-full border text-xs font-medium transition-all shrink-0 mb-0.5 select-none disabled:opacity-40 ${
                  webSearchMode === "on"
                    ? "bg-sky-100 dark:bg-sky-950/70 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 shadow-xs"
                    : webSearchMode === "auto"
                    ? "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400"
                    : "bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                }`}
              >
                <Globe
                  className={`h-3.5 w-3.5 ${
                    webSearchMode === "on"
                      ? "text-sky-600 dark:text-sky-400"
                      : webSearchMode === "auto"
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-slate-400"
                  }`}
                />
                <span className="hidden sm:inline font-mono text-[11px]">
                  {webSearchMode === "auto" ? "联网:自动" : webSearchMode === "on" ? "联网:开启" : "联网:关闭"}
                </span>
              </button>
            )}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                attachments.length > 0
                  ? "添加说明或问题... (Enter 发送)"
                  : "输入消息，或拖入图片、PDF等文件... (Enter 发送)"
              }
              className="w-full resize-none bg-transparent px-2.5 sm:px-3 py-2 text-[16px] sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none max-h-32 sm:max-h-44 leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isStreaming || isUploading}
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-500 active:scale-95 transition-all shrink-0 ml-1 mb-1 shadow-sm shadow-indigo-600/30"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Image Lightbox / Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          {/* Top action bar */}
          <div
            className="w-full max-w-5xl flex items-center justify-between mb-2 text-white/90 px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="text-xs sm:text-sm font-medium truncate max-w-[60%]"
              title={previewImage.alt || "图片预览"}
            >
              {previewImage.alt || "图片预览"}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={previewImage.src}
                download={previewImage.alt || "image.png"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors cursor-pointer"
                title="下载原图"
              >
                <Download className="h-3.5 w-3.5" />
                <span>下载</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="关闭预览 (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Centered Image */}
          <div
            className="relative flex items-center justify-center max-w-full max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage.src}
              alt={previewImage.alt || "大图预览"}
              className="max-h-[82vh] max-w-[95vw] sm:max-w-[85vw] object-contain rounded-xl shadow-2xl select-none"
            />
          </div>

          {/* Bottom hint */}
          <div className="text-[11px] text-white/50 mt-2 select-none">
            按 Esc 或点击空白区域关闭
          </div>
        </div>
      )}
    </div>
  );
};

"use client";

import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, SearchResultItem, GeneratedImage } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { cn } from "@/lib/utils";
import { getMediaImageUrl } from "@/lib/api";
import {
  Brain,
  AlertTriangle,
  Clock,
  Cpu,
  Zap,
  Check,
  Copy,
  Globe,
  ExternalLink,
  ZoomIn,
  FileText,
  RotateCw,
  Palette,
  Download,
  ImageOff,
  Square,
  PenLine,
} from "lucide-react";

export function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(isoStr?: string) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function parseSearchResults(raw: any): SearchResultItem[] {
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

export function sanitizeDisplayContent(raw: string): string {
  if (!raw) return "";
  return raw
    // 1. Strip raw tool/function call containers and dangling arguments
    .replace(/<\/?(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)[\s\S]*?(?:<\/(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)>|$)/gi, "")
    .replace(/<\/?(?:arg_key|arg_value|parameter|parameters|arguments)[\s\S]*?>/gi, "")
    .replace(/\[(?:ACTION|SEARCH|TOOL|CALL|OBSERVATION):\s*[^\]]+\]/gi, "")
    // 2. Strip ReAct-style leftover traces
    .replace(/\n\s*(?:Action|Action Input|Observation):\s*[\s\S]*?(?=\n\s*(?:Thought|Final Answer)|$)/gi, "")
    // 3. Strip Guardrail / Moderation classifier output
    .replace(/(?:Thus (?:both|all) are safe|We must output exactly that format|Safety Assessment:|Content Moderation:)[\s\S]*/gi, "")
    .replace(/(?:(?:User|Input|Prompt|Response|Output|Assistant)\s*(?:Safety|Moderation|Guard|Risk|Category|Harm)\s*[:=]\s*\w+[\s\n\r]*)+/gi, "")
    // 4. Strip turn hallucination (User:/Human: at the end)
    .replace(/\n+\s*(?:(?:User|Human|System)\s*:[^\n]+[\s\n\r]*)+$/gi, "")
    // 5. Strip stray internal scratchpad / reflection tags
    .replace(/<\/?(?:scratchpad|internal|reflection|antThinking)>/gi, "")
    .trim();
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

function SvgRenderer({ svgCode }: { svgCode: string }) {
  const [viewMode, setViewMode] = React.useState<"preview" | "code">("preview");
  const [copied, setCopied] = React.useState(false);

  const cleanSvg = React.useMemo(() => {
    return svgCode.replace(/<script[\s\S]*?<\/script>/gi, "");
  }, [svgCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(svgCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([svgCode], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vector-artwork-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-2 bg-muted/60 border-b border-border/60 text-xs select-none flex-wrap gap-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Palette className="h-3.5 w-3.5 text-primary" />
          <span>SVG 矢量画作</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="bg-background/80 border border-border/60 rounded-lg p-0.5 flex text-[11px]">
            <button
              onClick={() => setViewMode("preview")}
              className={cn(
                "px-2 py-0.5 rounded-md transition-colors",
                viewMode === "preview"
                  ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              预览图形
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={cn(
                "px-2 py-0.5 rounded-md transition-colors",
                viewMode === "code"
                  ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              查看代码
            </button>
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-[11px]"
            title="复制代码"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "已复制" : "复制"}</span>
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[11px] font-medium"
            title="下载 SVG 矢量文件"
          >
            <Download className="h-3 w-3" />
            <span>下载 SVG</span>
          </button>
        </div>
      </div>

      {viewMode === "preview" ? (
        <div className="p-4 sm:p-6 flex items-center justify-center bg-muted/20 dark:bg-[#18181b]/60 min-h-[220px] overflow-hidden">
          <div
            className="max-w-full max-h-[460px] flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:drop-shadow-sm"
            dangerouslySetInnerHTML={{ __html: cleanSvg }}
          />
        </div>
      ) : (
        <div className="p-4 overflow-x-auto text-[13px] font-mono leading-[1.65] bg-[#0d0d0d] text-[#ececec]">
          <code>{svgCode}</code>
        </div>
      )}
    </div>
  );
}

function AiImageCard({
  image,
  onImageClick,
}: {
  image: GeneratedImage;
  onImageClick?: (src: string, alt?: string) => void;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [errored, setErrored] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const holderRef = React.useRef<HTMLDivElement>(null);

  // Prefer the durable asset URL; the inline url only exists for a freshly
  // streamed image that has not been re-read from the API yet.
  const src = image.id
    ? getMediaImageUrl(image.id)
    : image.url || "";

  // Only start downloading once the card is close to the viewport, so opening a
  // long conversation does not fetch every image at once.
  React.useEffect(() => {
    if (!src || visible) return;
    const node = holderRef.current;
    if (!node) {
      setVisible(true);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src, visible]);

  const handleDownload = () => {
    const filename = `ai-image-${Date.now()}.${(image.ext || "png").toLowerCase()}`;
    if (image.id) {
      // Same-origin asset with Content-Disposition, so a plain navigation saves it.
      const a = document.createElement("a");
      a.href = getMediaImageUrl(image.id, true);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    if (!src) return;
    if (src.startsWith("data:")) {
      // base64 data URI — create a temporary anchor
      const a = document.createElement("a");
      a.href = src;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // remote URL — open in new tab so user can save manually
      window.open(src, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-border/80 bg-card shadow-sm">
      {/* Card Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-muted/60 border-b border-border/60 text-xs select-none flex-wrap gap-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Palette className="h-3.5 w-3.5 text-primary" />
          <span>AI 生成画作</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] font-mono font-normal py-0 px-1.5 h-4.5">
            {image.provider} · {image.model}
          </Badge>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[11px] font-medium"
            title="下载图片"
          >
            <Download className="h-3 w-3" />
            <span>下载</span>
          </button>
        </div>
      </div>

      {/* Image Area */}
      <div
        ref={holderRef}
        className="relative bg-muted/20 dark:bg-[#18181b]/60 flex items-center justify-center min-h-[200px]"
      >
        {/* Shimmer skeleton while loading */}
        {!loaded && !errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground/60">
            <div className="w-full h-full absolute inset-0 bg-gradient-to-r from-muted/40 via-muted/80 to-muted/40 animate-shimmer bg-[length:200%_100%]" />
            <Palette className="relative h-8 w-8 text-primary/40 animate-pulse" />
            <span className="relative text-xs">图片加载中…</span>
          </div>
        )}

        {errored ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground/60">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">图片加载失败，请尝试下载查看</span>
            <button
              onClick={handleDownload}
              className="text-xs text-primary hover:underline mt-1"
            >
              点击下载
            </button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={visible ? src : undefined}
            alt={image.prompt}
            loading="lazy"
            decoding="async"
            className={cn(
              "max-w-full max-h-[520px] object-contain cursor-zoom-in transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setLoaded(true)}
            onError={() => { setLoaded(true); setErrored(true); }}
            onClick={() => onImageClick?.(src, image.prompt)}
            title="点击放大查看原图"
          />
        )}
      </div>

      {/* Caption */}
      <div className="px-3.5 py-2 text-[12px] text-muted-foreground border-t border-border/40 truncate" title={image.prompt}>
        💡 {image.prompt}
      </div>
    </div>
  );
}

function CodeBlock({ children, className }: any) {
  const [copied, setCopied] = React.useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const codeText = typeof children === "string" ? children.replace(/\n$/, "") : String(children || "").replace(/\n$/, "");

  const isSvg = lang === "svg" || (codeText.trim().startsWith("<svg") && codeText.trim().includes("</svg>"));
  if (isSvg) {
    return <SvgRenderer svgCode={codeText} />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3.5 rounded-2xl overflow-hidden border border-border/70 bg-[#0d0d0d] shadow-xs">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1f1f23] text-xs text-muted-foreground border-b border-white/5 select-none">
        <span className="font-mono text-[11px] font-medium tracking-wide uppercase text-slate-300">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-[11px] font-medium"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>复制代码</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-[13px] sm:text-[13.5px] font-mono leading-[1.65] text-[#ececec]">
        <code>{children}</code>
      </div>
    </div>
  );
}

const markdownComponents = {
  img: ({ node, ...props }: any) => (
    <img
      {...props}
      alt={props.alt || "image"}
      className="max-h-80 max-w-full rounded-xl border border-border/80 my-2 object-contain shadow-sm"
    />
  ),
  a: ({ node, ...props }: any) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80 font-medium break-all [overflow-wrap:anywhere]"
    />
  ),
  p: ({ node, children, ...props }: any) => (
    <p {...props} className="break-words [overflow-wrap:anywhere] leading-[1.72] my-2 text-[15px] sm:text-[15.5px] tracking-[-0.01em] text-foreground/95">
      {renderWithBreaks(children)}
    </p>
  ),
  h1: ({ node, ...props }: any) => (
    <h1 {...props} className="text-[20px] sm:text-[22px] font-bold mt-5 mb-2.5 text-foreground tracking-tight" />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 {...props} className="text-[17px] sm:text-[18px] font-bold mt-4 mb-2 text-foreground tracking-tight" />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 {...props} className="text-[15px] sm:text-[16px] font-semibold mt-3 mb-1 text-foreground" />
  ),
  table: ({ node, ...props }: any) => (
    <div className="w-full max-w-full my-3 overflow-x-auto rounded-xl border border-border/70 shadow-2xs">
      <table {...props} className="min-w-full divide-y divide-border/70 text-xs sm:text-sm border-collapse" />
    </div>
  ),
  thead: ({ node, ...props }: any) => (
    <thead {...props} className="bg-muted/60 dark:bg-[#2c2c2e] text-foreground font-medium" />
  ),
  th: ({ node, children, ...props }: any) => (
    <th {...props} className="px-3.5 py-2.5 font-semibold text-left border-b border-border/70 whitespace-nowrap bg-muted/60 dark:bg-[#2c2c2e] text-foreground text-[13px]">
      {renderWithBreaks(children)}
    </th>
  ),
  td: ({ node, children, ...props }: any) => (
    <td {...props} className="px-3.5 py-2.5 border-b border-border/50 whitespace-nowrap text-foreground/90 align-top text-[13px] sm:text-[14px]">
      {renderWithBreaks(children)}
    </td>
  ),
  pre: ({ children }: any) => <>{children}</>,
  code: ({ node, inline, className, children, ...props }: any) => {
    const isInline = inline || !className;
    if (isInline) {
      return (
        <code
          {...props}
          className="px-1.5 py-0.5 rounded-md bg-muted/80 dark:bg-[#2c2c2e] text-primary font-mono text-[13px] sm:text-xs break-all [overflow-wrap:anywhere]"
        >
          {children}
        </code>
      );
    }
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
  ul: ({ node, ...props }: any) => (
    <ul {...props} className="list-disc list-outside pl-4 sm:pl-5 my-1.5 space-y-1 break-words [overflow-wrap:anywhere]" />
  ),
  ol: ({ node, ...props }: any) => (
    <ol {...props} className="list-decimal list-outside pl-4 sm:pl-5 my-1.5 space-y-1 break-words [overflow-wrap:anywhere]" />
  ),
  li: ({ node, children, ...props }: any) => (
    <li {...props} className="break-words [overflow-wrap:anywhere] leading-[1.62] my-1 text-[16px] sm:text-[15px] tracking-[-0.012em] text-foreground/95">
      {renderWithBreaks(children)}
    </li>
  ),
  blockquote: ({ node, ...props }: any) => (
    <blockquote {...props} className="border-l-3 border-primary pl-3 py-1 my-2 text-muted-foreground italic break-words [overflow-wrap:anywhere]" />
  ),
};

export function ThoughtBox({ thought, autoScroll }: { thought: string; autoScroll: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!autoScroll) return;
    const el = ref.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [thought, autoScroll]);
  return (
    <div
      ref={ref}
      className="mt-2 pl-2.5 border-l-2 border-primary/50 text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-72 overflow-y-auto overflow-x-hidden leading-relaxed break-words [overflow-wrap:anywhere]"
    >
      {thought}
    </div>
  );
}

export function renderMessageBody(
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
        className="max-h-80 max-w-full rounded-xl border border-border/80 my-2 object-contain shadow-sm cursor-zoom-in hover:opacity-95 transition-opacity"
        title="点击放大查看原图"
      />
    ),
  };

  if (content.includes("<think>")) {
    const thinkEndIndex = content.lastIndexOf("</think>");
    let thought = "";
    let mainContent = "";

    if (thinkEndIndex !== -1) {
      const thinkMatches = Array.from(content.matchAll(/<think>([\s\S]*?)<\/think>/gi));
      if (thinkMatches.length > 0) {
        thought = thinkMatches.map((m) => m[1].trim()).filter(Boolean).join(" ");
        mainContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      } else {
        thought = content.substring(content.indexOf("<think>") + 7, thinkEndIndex).trim();
        mainContent = content.substring(thinkEndIndex + 8).trim();
      }
    } else {
      thought = content.substring(content.indexOf("<think>") + 7).trim();
      mainContent = "";
    }

    const displayMainContent = sanitizeDisplayContent(mainContent);

    return (
      <div className="space-y-2.5">
        {thought && (
          <details
            className="rounded-xl border border-border/70 bg-muted/40 dark:bg-[#1c1c1e]/80 p-2.5 text-xs group transition-all min-w-0 max-w-full overflow-hidden"
            open={!displayMainContent || isStreaming}
          >
            <summary className="cursor-pointer select-none font-medium text-primary flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-primary animate-pulse" />
                <span>思考过程</span>
              </span>
              <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <ThoughtBox thought={thought} autoScroll={isStreaming && !displayMainContent} />
          </details>
        )}

        {displayMainContent ? (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere] leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={dynamicComponents}>
              {displayMainContent}
            </ReactMarkdown>
          </div>
        ) : !isStreaming ? (
          <div className="text-xs text-muted-foreground/75 italic py-1 px-1">
            （模型仅输出了思考过程，未生成正式正文。这通常是因为该问题推理链较长耗尽了单次最大 Token 截断限制，或上游服务提前中断。）
          </div>
        ) : null}
      </div>
    );
  }

  const cleanFallbackContent = sanitizeDisplayContent(content);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere] leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={dynamicComponents}>
        {cleanFallbackContent}
      </ReactMarkdown>
    </div>
  );
}

interface ParsedUserMessage {
  text: string;
  images: { name: string; url: string }[];
  docs: string[];
}

export function parseUserMessage(content: string): ParsedUserMessage {
  if (!content) return { text: "", images: [], docs: [] };

  const images: { name: string; url: string }[] = [];
  const docs: string[] = [];

  const imgRegex = /!\[([^\]]*)\]\(((?:data:image\/[^;)]+;base64,[A-Za-z0-9+/=]+)|(?:https?:\/\/[^\s)]+))\)/gi;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    images.push({
      name: match[1] || "图片",
      url: match[2],
    });
  }

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

  const docRegex = /📄\s*\*{0,2}\[?(?:附件文件|附件文档|附带文件):\s*([^\]\*\n]+)\]?\*{0,2}/gi;
  let docMatch;
  while ((docMatch = docRegex.exec(content)) !== null) {
    docs.push(docMatch[1].trim());
  }

  let cleanText = content
    .replace(imgRegex, "")
    .replace(/(data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]+)/g, "")
    .replace(docRegex, "")
    .trim();

  return { text: cleanText, images, docs };
}

/**
 * Plain-text view of a stored user turn, used to seed the inline editor so the
 * markdown/base64 attachment syntax never lands in the textarea.
 */
function stripAttachmentMarkup(content: string): string {
  if (!content) return "";
  return content
    .replace(/!\[([^\]]*)\]\(((?:data:image\/[^;)]+;base64,[A-Za-z0-9+/=]+)|(?:https?:\/\/[^\s)]+))\)/gi, "")
    .replace(/📄\s*\*{0,2}\[?(?:附件文件|附件文档|附带文件):\s*([^\]\*\n]+)\]?\*{0,2}/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ChatMessageItemProps {
  msg: Message;
  idx: number;
  isCopied: boolean;
  onCopy: (text: string, idx: number) => void;
  onImageClick: (src: string, alt?: string) => void;
  canRegenerate?: boolean;
  regenerating?: boolean;
  onRegenerate?: (assistantMessageId: string) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  idx,
  isCopied,
  onCopy,
  onImageClick,
  canRegenerate,
  regenerating,
  onRegenerate,
  onEditMessage,
}: ChatMessageItemProps) {
  const isUser = msg.role === "user";
  const isErrorMsg =
    !isUser &&
    typeof msg.content === "string" &&
    (msg.content.includes("❌ 后端未知错误") || msg.content.includes("HTTP 500"));

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const startEdit = () => {
    setDraft(stripAttachmentMarkup(msg.content || ""));
    setEditing(true);
  };

  const commitEdit = () => {
    if (!msg.id || !onEditMessage) {
      setEditing(false);
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (!next || next === stripAttachmentMarkup(msg.content || "").trim()) return;
    onEditMessage(msg.id, next);
  };

  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"} group`}>
      <div
        className={`flex flex-col min-w-0 ${
          isUser
            ? "items-end max-w-[85%] sm:max-w-[75%]"
            : "items-start w-full max-w-full"
        }`}
      >
        <div
          className={cn(
            "min-w-0 max-w-full break-words [overflow-wrap:anywhere]",
            isUser
              ? "rounded-[24px] px-5 py-3 bg-[#f4f4f4] dark:bg-[#2f2f2f] text-foreground text-[15px] sm:text-[15px] leading-relaxed shadow-2xs font-normal"
              : isErrorMsg
              ? "rounded-2xl bg-destructive/5 border border-destructive/30 shadow-sm w-full p-3.5"
              : "w-full bg-transparent border-0 shadow-none px-0 py-0.5 text-foreground leading-[1.75]"
          )}
        >
          {isUser ? (
            <div>
              {editing ? (
                <div className="flex flex-col gap-2 min-w-[260px] max-w-full">
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        commitEdit();
                      }
                      if (e.key === "Escape") setEditing(false);
                    }}
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-primary/40 bg-background px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(false)}
                      className="h-7 px-2.5 text-[11px] rounded-lg"
                    >
                      取消
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={commitEdit}
                      className="h-7 px-2.5 text-[11px] rounded-lg"
                    >
                      发送
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 justify-end">
                  {msg.attachments.map((att) =>
                    att.type === "image" ? (
                      <div
                        key={att.id}
                        onClick={() => onImageClick(att.data_url, att.name)}
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
                            onClick={() => onImageClick(img.url, img.name)}
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

              </>
              )}
            </div>
          ) : isErrorMsg ? (            <div>
              <div className="flex items-center gap-1.5 font-bold text-destructive mb-1">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>生成出错：</span>
              </div>
              <div className="whitespace-pre-wrap font-mono text-xs break-words [overflow-wrap:anywhere] bg-destructive/5 p-2.5 rounded-lg border border-destructive/20">
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
                    <details className="group rounded-xl border border-border bg-muted/40 text-xs overflow-hidden transition-all">
                      <summary className="cursor-pointer select-none font-medium text-foreground flex items-center justify-between p-2 sm:p-2.5 hover:bg-muted/70 transition-colors">
                        <span className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>参考了 {searchResults.length} 个网页来源</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">
                          ▼
                        </span>
                      </summary>
                      <div className="p-2 sm:p-2.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-border">
                        {searchResults.map((item, sIdx) => (
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
                );
              })()}

              {/* Tool Invocations (Vercel AI SDK Standard) */}
              {msg.toolInvocations && msg.toolInvocations.length > 0 && (
                <div className="mb-2.5 space-y-1.5">
                  {msg.toolInvocations.map((tool) => (
                    <div
                      key={tool.toolCallId}
                      className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-xs transition-all"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <div className="flex items-center gap-2">
                          {tool.state === "call" ? (
                            <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />
                          ) : tool.toolName === "image_generation" ? (
                            <Palette className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Cpu className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span className="font-semibold text-foreground">
                            {tool.toolName === "search" || tool.toolName === "web_search"
                              ? "执行联网检索"
                              : tool.toolName === "image_generation"
                              ? "执行 AI 图像绘制"
                              : `调用工具: ${tool.toolName}`}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {tool.state === "call" ? "运行中..." : "已完成"}
                        </span>
                      </div>
                      {tool.state === "result" && tool.result && (
                        <div className="mt-1.5 pt-1.5 border-t border-border/40 font-mono text-[11px] text-muted-foreground break-words">
                          {typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* AI Generated Images — rendered as proper image cards */}
              {msg.generatedImages && msg.generatedImages.length > 0 && (
                <div className="space-y-3 mb-2">
                  {msg.generatedImages.map((img, imgIdx) => (
                    <AiImageCard
                      key={imgIdx}
                      image={img}
                      onImageClick={onImageClick}
                    />
                  ))}
                </div>
              )}

              {renderMessageBody(msg.content, false, onImageClick)}
            </>
          )}
        </div>

        {/* Message Meta Info & Action Bar */}
        {!isUser && !isErrorMsg && (
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground mt-2 px-0.5 select-none">
            {/* Copy Message Button (ChatGPT style) */}
            <ActionTooltip label={isCopied ? "已复制到剪贴板" : "复制回答"} side="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(msg.content, idx)}
                className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-500 text-[11px] font-medium">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[11px]">复制</span>
                  </>
                )}
              </Button>
            </ActionTooltip>

            {msg.finish_reason === "abort" && (
              <ActionTooltip label="你在生成过程中点击了停止，此处为已生成的部分内容" side="bottom">
                <span className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[11px] font-medium cursor-default">
                  <Square className="h-2.5 w-2.5 fill-current" />
                  <span>已停止</span>
                </span>
              </ActionTooltip>
            )}
            {msg.finish_reason === "error" && (
              <ActionTooltip label="本次回复生成失败" side="bottom">
                <span className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25 text-[11px] font-medium cursor-default">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  <span>生成失败</span>
                </span>
              </ActionTooltip>
            )}

            {canRegenerate && onRegenerate && (
              <ActionTooltip label="用相同提问重新生成回答" side="bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={regenerating}
                  onClick={() => msg.id && onRegenerate(msg.id)}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} />
                  <span className="text-[11px]">重新生成</span>
                </Button>
              </ActionTooltip>
            )}

            <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono opacity-50 hover:opacity-100 transition-opacity">
              {msg.created_at && (
                <ActionTooltip label="回复时间" side="top">
                  <span className="flex items-center gap-1 cursor-default">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(msg.created_at)}</span>
                  </span>
                </ActionTooltip>
              )}

              {msg.model && (
                <ActionTooltip label="回复模型" side="top">
                  <Badge variant="secondary" className="text-[10px] font-mono font-normal cursor-default py-0 px-1.5 h-4.5">
                    <Cpu className="h-2.5 w-2.5 text-primary mr-1" />
                    <span>{msg.model}</span>
                  </Badge>
                </ActionTooltip>
              )}

              {typeof msg.thinking_duration_ms === "number" && msg.thinking_duration_ms > 0 && (
                <ActionTooltip label="思考耗时（到首字输出时间）" side="top">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium cursor-default">
                    <Clock className="h-2.5 w-2.5 text-emerald-500" />
                    <span>思考 {(msg.thinking_duration_ms / 1000).toFixed(1)}s</span>
                  </span>
                </ActionTooltip>
              )}

              {typeof msg.duration_ms === "number" && msg.duration_ms > 0 && (
                <ActionTooltip label="总生成耗时" side="top">
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium cursor-default">
                    <Zap className="h-2.5 w-2.5 text-amber-500" />
                    <span>{(msg.duration_ms / 1000).toFixed(2)}s</span>
                  </span>
                </ActionTooltip>
              )}

              {(msg.prompt_tokens || msg.completion_tokens || msg.token_usage) ? (
                <ActionTooltip label="Token 消耗（输入+输出）" side="top">
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px] cursor-default">
                    <span>Tokens: {msg.token_usage || (msg.prompt_tokens || 0) + (msg.completion_tokens || 0)}</span>
                  </span>
                </ActionTooltip>
              ) : null}
            </div>
          </div>
        )}

        {/* User turn actions — same placement as the assistant action bar */}
        {isUser && !editing && msg.id && onEditMessage && (
          <div className="flex items-center justify-end gap-1 flex-wrap text-[11px] text-muted-foreground mt-2 px-0.5 select-none">
            <ActionTooltip label="编辑这条提问并重新发送" side="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={startEdit}
                className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <PenLine className="h-3.5 w-3.5" />
                <span className="text-[11px]">编辑</span>
              </Button>
            </ActionTooltip>
            <ActionTooltip label={isCopied ? "已复制到剪贴板" : "复制提问"} side="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(stripAttachmentMarkup(msg.content || ""), idx)}
                className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-500 text-[11px] font-medium">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[11px]">复制</span>
                  </>
                )}
              </Button>
            </ActionTooltip>
          </div>
        )}
      </div>
    </div>
  );
});

"use client";

import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, SearchResultItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      className="mt-2 pl-2.5 border-l-2 border-indigo-400 dark:border-indigo-600 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto overflow-x-hidden leading-relaxed break-words [overflow-wrap:anywhere]"
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
            <ThoughtBox thought={thought} autoScroll={isStreaming && !mainContent} />
          </details>
        )}

        {mainContent && (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere] leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={dynamicComponents}>
              {mainContent}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere] leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={dynamicComponents}>
        {content}
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

interface ChatMessageItemProps {
  msg: Message;
  idx: number;
  isCopied: boolean;
  onCopy: (text: string, idx: number) => void;
  onImageClick: (src: string, alt?: string) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  idx,
  isCopied,
  onCopy,
  onImageClick,
}: ChatMessageItemProps) {
  const isUser = msg.role === "user";
  const isErrorMsg =
    !isUser &&
    typeof msg.content === "string" &&
    (msg.content.includes("❌ 后端未知错误") || msg.content.includes("HTTP 500"));

  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex flex-col min-w-0 ${
          isUser
            ? "items-end max-w-[88%] sm:max-w-[78%]"
            : "items-start w-full max-w-full sm:max-w-3xl"
        }`}
      >
        <div
          className={cn(
            "rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-[15px] sm:text-sm leading-relaxed min-w-0 max-w-full break-words [overflow-wrap:anywhere]",
            isUser
              ? "bg-primary text-primary-foreground shadow-sm font-normal"
              : isErrorMsg
              ? "bg-destructive/5 border border-destructive/30 shadow-sm w-full py-2.5 sm:py-3.5"
              : "bg-card border text-card-foreground shadow-sm w-full py-2.5 sm:py-3.5"
          )}
        >
          {isUser ? (
            <div>
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
            </div>
          ) : isErrorMsg ? (
            <div>
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
                            className="group/card flex flex-col p-2 rounded-lg bg-card border hover:border-sky-500 hover:shadow-sm transition-all text-left"
                            title={item.title}
                          >
                            <div className="flex items-center gap-1 text-[11px] font-medium group-hover/card:text-sky-600 dark:group-hover/card:text-sky-400">
                              <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-sky-100 dark:bg-sky-900/70 text-sky-600 dark:text-sky-300 text-[9px] flex items-center justify-center font-bold">
                                {sIdx + 1}
                              </span>
                              <span className="truncate">{item.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity ml-auto text-sky-500" />
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
              {renderMessageBody(msg.content, false, onImageClick)}
            </>
          )}
        </div>

        {/* Message Meta Info & Mobile Action Bar */}
        {!isUser && !isErrorMsg && (
          <div className="flex items-center justify-between gap-1.5 flex-wrap text-[10px] text-muted-foreground mt-1.5 px-0.5 font-mono">
            <div className="flex items-center gap-1.5 flex-wrap">
              {msg.created_at && (
                <span className="flex items-center gap-1" title="回复时间">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(msg.created_at)}</span>
                </span>
              )}

              {msg.model && (
                <Badge variant="secondary" className="text-[10px] font-mono font-normal" title="回复模型">
                  <Cpu className="h-3 w-3 text-primary mr-1" />
                  <span>{msg.model}</span>
                </Badge>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopy(msg.content, idx)}
              className="h-6 px-2 text-muted-foreground hover:text-foreground shrink-0 select-none"
              title="复制回答内容"
            >
              {isCopied ? (
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
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

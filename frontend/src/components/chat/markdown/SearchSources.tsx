"use client";

import * as React from "react";
import { Globe, ExternalLink } from "lucide-react";
import type { SearchResultItem } from "@/types";
import { cn } from "@/lib/utils";

/**
 * 「参考了 N 个网页来源」折叠面板。
 *
 * 此前同一段 JSX 写了两遍，约 50 行 × 2：
 *   - components/chat/ChatArea.tsx:494-542        （流式输出中的实时来源）
 *   - components/chat/ChatMessageItem.tsx:947-996（历史消息里的来源）
 *
 * 两份连「从 URL 里抠 hostname 并去掉 www.」那个 IIFE 都一样，而后者在每次
 * 渲染时对每条结果重新 new 一次 URL。现在只有这一份实现。
 */

/** 从 URL 里提取可读域名；无法解析时退回原串。 */
export function hostnameOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function SearchSources({
  results,
  className,
  /** 流式过程中默认展开：来源刚出现时用户往往正想看清引了什么 */
  defaultOpen,
}: {
  results: readonly SearchResultItem[];
  className?: string;
  defaultOpen?: boolean;
}) {
  const items = React.useMemo(
    () => results.filter((r) => r && r.url),
    [results]
  );
  if (items.length === 0) return null;

  return (
    <details
      open={defaultOpen}
      className={cn(
        "group overflow-hidden rounded-xl border border-border bg-surface-3/40 text-xs transition-colors",
        className
      )}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between p-2 font-medium text-foreground transition-colors hover:bg-surface-3/60 sm:p-2.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">参考了 {items.length} 个网页来源</span>
        </span>
        {/* ▼ 是纯装饰：折叠状态已由 <details> 的语义与浏览器默认标记传达，
            这里只保留一个视觉箭头，并对其 aria-hidden。 */}
        <span
          aria-hidden="true"
          className="ml-2 shrink-0 text-[10px] text-muted-foreground transition-transform group-open:rotate-180"
        >
          ▼
        </span>
      </summary>

      <div className="grid grid-cols-1 gap-1.5 border-t border-border p-2 pt-2.5 sm:grid-cols-2 sm:p-2.5">
        {items.map((item, idx) => (
          <a
            key={`${item.url}-${idx}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={item.title}
            className="group/card flex flex-col rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary hover:shadow-xs"
          >
            <div className="flex items-center gap-1 text-[11px] font-medium group-hover/card:text-primary">
              <span
                aria-hidden="true"
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary"
              >
                {idx + 1}
              </span>
              <span className="truncate">{item.title || item.url}</span>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-primary opacity-0 transition-opacity group-hover/card:opacity-100" />
            </div>
            {item.snippet && (
              <p className="mt-1 line-clamp-2 break-words text-[10px] leading-snug text-muted-foreground">
                {item.snippet}
              </p>
            )}
            <span className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
              {hostnameOf(item.url)}
            </span>
          </a>
        ))}
      </div>
    </details>
  );
}

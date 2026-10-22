"use client";

import * as React from "react";
import { Globe, ExternalLink, ChevronDown } from "lucide-react";
import type { SearchResultItem } from "@/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

/** 从 URL 里提取可读域名；无法解析时退回原串。 */
export function hostnameOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const INITIAL_VISIBLE_COUNT = 4;

export function SearchSources({
  results,
  className,
  defaultOpen = false,
}: {
  results: readonly SearchResultItem[];
  className?: string;
  defaultOpen?: boolean;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = React.useState(false);

  const items = React.useMemo(
    () => results.filter((r) => r && r.url),
    [results]
  );
  if (items.length === 0) return null;

  const hasMore = items.length > INITIAL_VISIBLE_COUNT;
  const visibleItems = expanded || !hasMore ? items : items.slice(0, INITIAL_VISIBLE_COUNT);

  return (
    <details
      open={defaultOpen}
      className={cn(
        "group overflow-hidden rounded-2xl border border-border/80 bg-surface-3/30 text-xs transition-all shadow-2xs",
        className
      )}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between p-2.5 font-medium text-foreground transition-colors hover:bg-surface-3/60 sm:px-3 list-none">
        <span className="flex min-w-0 items-center gap-2">
          <Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate font-medium">
            {t("chat.markdown.sourcesSummary", { count: items.length })}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="ml-2 shrink-0 text-[10px] text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        >
          ▼
        </span>
      </summary>

      <div className="border-t border-border/50 p-2 sm:p-2.5">
        <div
          className={cn(
            "grid grid-cols-1 gap-1.5 sm:grid-cols-2",
            expanded && "max-h-[380px] overflow-y-auto overscroll-contain pr-1"
          )}
        >
          {visibleItems.map((item, idx) => (
            <a
              key={`${item.url}-${idx}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title={item.title || item.url}
              className="group/card flex flex-col min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card/90 p-2.5 text-left transition-all hover:border-primary/50 hover:bg-surface-3/50 hover:shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <div className="flex items-center gap-1.5 min-w-0 text-xs font-medium text-foreground/90 group-hover/card:text-primary">
                {item.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.icon}
                    alt=""
                    className="h-3.5 w-3.5 shrink-0 rounded-xs object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary font-mono"
                  >
                    {idx + 1}
                  </span>
                )}
                <span className="truncate min-w-0 flex-1 font-medium tracking-tight">
                  {item.title || item.url}
                </span>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover/card:opacity-100 group-hover/card:text-primary" />
              </div>
              {item.snippet && (
                <p className="mt-1 line-clamp-2 break-words text-[11px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {item.snippet}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono text-muted-foreground/75 truncate min-w-0">
                <span className="truncate">{item.hostname || hostnameOf(item.url)}</span>
              </div>
            </a>
          ))}
        </div>

        {hasMore && (
          <div className="mt-2 flex justify-center border-t border-border/40 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface-2/80 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:bg-surface-3 hover:text-foreground hover:border-primary/40 cursor-pointer select-none"
            >
              <span>
                {expanded
                  ? t("chat.markdown.sourcesShowLess")
                  : t("chat.markdown.sourcesShowMore", { count: items.length - INITIAL_VISIBLE_COUNT })}
              </span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  expanded && "rotate-180"
                )}
              />
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

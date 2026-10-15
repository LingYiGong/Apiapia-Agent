"use client";

import type { LucideIcon } from "lucide-react";

import * as React from "react";
import { Panel } from "@/components/common/Panel";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * KPI 指标卡。
 *
 * 用量页此前有 **8 份**逐字相同的卡片 markup（管理员 tab 4 张 + 我的 tab 4 张），
 * 只差 label / 图标 / 数值 / 脚注。现在只有这一份。
 */
export function StatCard({
  label,
  icon: Icon,
  tone = "bg-primary/10 text-primary",
  value,
  unit,
  footer,
  footerClassName,
  truncateValue = false,
}: {
  label: string;
  icon: LucideIcon;
  tone?: string;
  value: React.ReactNode;
  /** 数值后缀（位 / 次 / ¥ 等） */
  unit?: string;
  footer?: React.ReactNode;
  footerClassName?: string;
  /** 长数值（如 token 总数）避免撑破卡片 */
  truncateValue?: boolean;
}) {
  return (
    <Panel interactive className="space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            tone
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums text-foreground sm:text-3xl",
            truncateValue && "truncate"
          )}
        >
          {value}
          {unit && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
          )}
        </div>
      </div>
      {footer && (
        <div
          className={cn(
            "flex items-center gap-1.5 truncate border-t border-border/30 pt-2 font-mono text-xs text-muted-foreground/90",
            footerClassName
          )}
        >
          {footer}
        </div>
      )}
    </Panel>
  );
}

/** 「xx 正常」之类的绿点状态条。 */
export function LiveDotStat({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-t border-border/30 pt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      <span className="truncate">{children}</span>
    </div>
  );
}

/** 状态药丸（正常 / 已停用）。 */
export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "danger";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone === "success"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-destructive/20 bg-destructive/10 text-destructive"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "success" ? "bg-emerald-500" : "bg-destructive"
        )}
      />
      {children}
    </span>
  );
}

/** 「免费」徽章。表格与列表里多处复用。 */
export function FreeBadge() {
  const { t } = useI18n();
  return (
    <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600 shadow-none dark:text-emerald-400">
      {t("usage.cards.freeBadge")}
    </span>
  );
}

/** 费用展示：¥ 为主、$ 为辅。 */
export function CostValue({
  cny,
  usd,
  isFree,
  className,
  strong = true,
}: {
  cny: number;
  usd: number;
  isFree?: boolean;
  className?: string;
  strong?: boolean;
}) {
  const { fmt } = useI18n();
  if (isFree) {
    return (
      <span className={cn("font-semibold text-emerald-600 dark:text-emerald-400", className)}>
        ¥{(0).toFixed(2)}
      </span>
    );
  }
  return (
    <div className={cn("text-right", className)}>
      <span
        className={cn(
          "font-semibold text-emerald-600 dark:text-emerald-400",
          strong ? "" : "font-normal"
        )}
      >
        ¥{cny.toFixed(2)}
      </span>
      <span className="block font-mono text-xs text-muted-foreground">
        {fmt.currency(usd)}
      </span>
    </div>
  );
}

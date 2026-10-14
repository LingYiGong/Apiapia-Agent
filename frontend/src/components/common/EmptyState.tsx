import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 全应用统一的空状态。
 *
 * 此前「圆角图标块 + 标题 + 说明 + 按钮」这一结构在三个地方各写一遍：
 *   - components/memory/MemoryView.tsx:399
 *   - components/chat/MobileHistoryView.tsx:736
 *   - components/chat/ChatArea.tsx:439（无按钮的变体）
 * 三份的间距、字号、图标容器样式各不相同，改一次要动三处。
 */
export function EmptyState({
  icon: Icon,
  iconClassName,
  media,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  actionVariant = "default",
  className,
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  /** 用自定义内容替换图标方块（例如聊天页的 Logo） */
  media?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  actionVariant?: "default" | "outline";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 py-10 text-center select-none",
        className
      )}
    >
      {media ??
        (Icon && (
          <div
            className={cn(
              "mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-3/50 text-muted-foreground",
              iconClassName
            )}
          >
            <Icon className="h-7 w-7" />
          </div>
        ))}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          type="button"
          onClick={onAction}
          variant={actionVariant === "outline" ? "outline" : "default"}
          size="sm"
          className="mt-4 gap-1.5 rounded-xl px-4 text-xs font-medium active:scale-95"
        >
          {ActionIcon && <ActionIcon className="h-4 w-4" />}
          <span>{actionLabel}</span>
        </Button>
      )}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** 全应用统一的表面卡片容器 */

const panelVariants = cva(
  "relative rounded-2xl border backdrop-blur-md shadow-2xs transition-colors",
  {
    variants: {
      tone: {
        /** 常规卡片（默认） */
        default: "border-border/50 bg-card/80",
        /** 次级卡片：用于卡片内部的分组、说明块 */
        muted: "border-border/40 bg-muted/30",
        /** 无边框的纯表面：用于弹层内的分组 */
        bare: "border-transparent bg-transparent backdrop-blur-none shadow-none",
        /** 危险态 */
        danger: "border-destructive/20 bg-destructive/5",
      },
      /** 交互反馈：卡片可点击时给 hover 边框 */
      interactive: {
        true: "hover:border-border/80",
        false: "",
      },
    },
    defaultVariants: {
      tone: "default",
      interactive: false,
    },
  }
);

export interface PanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof panelVariants> {}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, tone, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(panelVariants({ tone, interactive }), className)} {...props} />
  )
);
Panel.displayName = "Panel";

/** 分组小标题 */
export function SectionLabel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-1 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** 图标方块 + 标题 + 说明 + 操作的列表小标题 */
export function SectionHeader({
  icon: Icon,
  tone = "bg-primary/10 text-primary",
  title,
  description,
  action,
  className,
  children,
}: {
  icon?: LucideIcon;
  tone?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-border/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-5",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
              tone
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
      {action && <div className="shrink-0 self-start sm:self-auto">{action}</div>}
    </div>
  );
}

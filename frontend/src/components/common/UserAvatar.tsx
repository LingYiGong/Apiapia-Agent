import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * 用户头像 + 管理员徽章。
 *
 * 此前「取用户名首字母做大写」这一行在四处各写一遍（Navbar、UserAvatarDropdown ×2、
 * UsageView 的表格），其中两处还各自带 `uppercase` 而调用点没有 —— 结果是
 * 表格里显示小写而菜单里显示大写。管理员徽章同样散落五处，尺寸分三种、
 * 文案混着「管理员」与「ADMIN」两种。
 */

export interface UserAvatarProps {
  username: string;
  className?: string;
  /** 字母的字号，默认随尺寸自适应 */
  textClassName?: string;
  /** 渐变底（头像菜单的大号头像用） */
  gradient?: boolean;
}

/** 取首字符并大写。中文取第一个字，英文取第一个字母。 */
export function initialOf(username?: string): string {
  return (username || "?").trim().slice(0, 1).toUpperCase();
}

export function UserAvatar({
  username,
  className,
  textClassName,
  gradient = false,
}: UserAvatarProps) {
  return (
    <Avatar className={cn("rounded-full", className)}>
      <AvatarFallback
        className={cn(
          "font-bold text-primary",
          gradient
            ? "bg-gradient-to-br from-primary/20 to-primary/5"
            : "bg-primary/10",
          textClassName
        )}
      >
        {initialOf(username)}
      </AvatarFallback>
    </Avatar>
  );
}

export type AdminBadgeSize = "sm" | "md" | "lg";

const ADMIN_BADGE_SIZE: Record<AdminBadgeSize, string> = {
  sm: "text-[9px] px-1.5 py-0",
  md: "text-[10px] px-2 py-0.5",
  lg: "text-[10px] px-2 py-0.5",
};

/**
 * 管理员徽章。文案统一为「管理员」—— 移动端此前用英文 ADMIN，与全站中文不一致。
 */
export function AdminBadge({
  size = "md",
  label = "管理员",
  className,
}: {
  size?: AdminBadgeSize;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-amber-500/25 bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400",
        ADMIN_BADGE_SIZE[size],
        className
      )}
    >
      {label}
    </span>
  );
}

/** 普通用户的对照徽章（与 AdminBadge 尺寸对齐，避免两者高度跳动）。 */
export function StandardUserBadge({
  size = "md",
  className,
}: {
  size?: AdminBadgeSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border/50 bg-muted font-mono text-muted-foreground",
        ADMIN_BADGE_SIZE[size],
        className
      )}
    >
      标准
    </span>
  );
}

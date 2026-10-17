import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

/** 用户头像与管理员徽章 */

export interface UserAvatarProps {
  username: string;
  className?: string;
  /** 字母的字号，默认随尺寸自适应 */
  textClassName?: string;
  /** 渐变底（头像菜单的大号头像用） */
  gradient?: boolean;
}

/** 取首字符并大写。中文取第一个字，英文取第一个字母。 */
function initialOf(username?: string): string {
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
  sm: "text-2xs leading-[14px] px-1.5 py-0",
  md: "text-xs px-2 py-0.5",
  lg: "text-xs px-2.5 py-1",
};

/** 管理员徽章 */
export function AdminBadge({
  size = "md",
  label,
  className,
}: {
  size?: AdminBadgeSize;
  /** 不传则用词典里的「管理员」 */
  label?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-amber-500/25 bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400",
        ADMIN_BADGE_SIZE[size],
        className
      )}
    >
      {label ?? t("common.account.adminBadge")}
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
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border/50 bg-muted font-mono text-muted-foreground",
        ADMIN_BADGE_SIZE[size],
        className
      )}
    >
      {t("common.account.standardBadge")}
    </span>
  );
}

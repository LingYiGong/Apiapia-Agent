"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ACCOUNT_MENU_ITEMS, type MobileTab } from "@/config/navigation";
import { useActiveNav } from "@/hooks/useActiveNav";
import { ThemeSegments } from "@/components/common/ThemeSegments";
import {
  AdminBadge,
  StandardUserBadge,
  UserAvatar,
} from "@/components/common/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * 用户头像菜单（唯一实现）。
 *
 * 此前这里有两份手写副本：
 *   - components/layout/Navbar.tsx:89-143        桌面：胶囊触发器 + 用户名 + 徽章
 *                                               + 3 个 <Link> + 退出
 *   - components/layout/UserAvatarDropdown.tsx  移动：圆形触发器 + 用户卡
 *                                               + 内联主题三段 + 3 个带箭头的
 *                                               单元格 + 退出
 *
 * 内容、目的地、徽章配色全都一致，只有触发器形态和链接渲染方式不同。
 * 结果是：移动端菜单有 active 指示，桌面端没有；桌面端用 <Link>（可中键新开、
 * 可被搜索引擎抓取），移动端用 onClick —— 行为不一致本身就是 bug 温床。
 *
 * 现在合并为一个组件，variant 只影响触发器形态与链接的渲染方式：
 *   - desktop → <Link>，可键盘/中键直达
 *   - mobile  → onClick 切换 SPA 页签（移动端跳转整页代价大且会丢状态）
 */

export interface UserAvatarMenuProps {
  variant?: "desktop" | "mobile";
  onSelectMobileTab?: (tab: MobileTab) => void;
  className?: string;
}

export const UserAvatarMenu: React.FC<UserAvatarMenuProps> = ({
  variant = "mobile",
  onSelectMobileTab,
  className,
}) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isActive, ariaCurrent } = useActiveNav();
  const isDesktop = variant === "desktop";

  if (!user) return null;

  const navigate = (tab: MobileTab, href: string) => {
    if (isDesktop) return; // 桌面端渲染成 <Link>，不需要 js 跳转
    if (onSelectMobileTab) {
      onSelectMobileTab(tab);
    } else {
      router.push(href);
    }
  };

  const trigger = isDesktop ? (
    <button
      type="button"
      aria-label={`${user.username} 的账户菜单`}
      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 p-1 pr-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:gap-2 sm:pr-2.5"
    >
      <UserAvatar username={user.username} className="h-6 w-6" textClassName="text-[10px]" />
      <span className="max-w-[80px] truncate font-medium sm:max-w-[120px]">
        {user.username}
      </span>
      {user.is_superuser && <AdminBadge size="sm" className="hidden sm:inline-flex" />}
    </button>
  ) : (
    <button
      type="button"
      aria-label={`${user.username} 的账户菜单`}
      className="flex h-8 w-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-full border border-border/70 bg-muted/40 shadow-2xs transition-all hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
    >
      <UserAvatar username={user.username} className="h-7 w-7" textClassName="text-[11px]" />
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="z-50 w-[270px] select-none rounded-[22px] border border-border/50 bg-background/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
      >
        {/* 1. 账户卡片 */}
        <div className="flex items-center gap-3 p-2 pb-2.5">
          <UserAvatar
            username={user.username}
            gradient
            className="h-10 w-10 shrink-0 border border-primary/20 shadow-xs"
            textClassName="text-[14px]"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-[14px] font-semibold tracking-tight text-foreground">
                {user.username}
              </span>
              {user.is_superuser ? (
                <AdminBadge size="sm" />
              ) : (
                <StandardUserBadge size="sm" />
              )}
            </div>
            <span className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {user.is_superuser ? "超级管理员权限已就绪" : "已登录标准用户"}
            </span>
          </div>
        </div>

        <DropdownMenuSeparator className="mx-1 my-1 opacity-60" />

        {/* 2. 外观三档
            桌面端不渲染：桌面顶栏在触发器左侧已有一个独立的 <ThemeToggle>，
            两处都放会让用户在同一屏看到两个主题入口。 */}
        {!isDesktop && (
          <>
            <div className="px-2 py-1.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  外观风格
                </span>
              </div>
              <ThemeSegments size="sm" />
            </div>
            <DropdownMenuSeparator className="mx-1 my-1 opacity-60" />
          </>
        )}

        {/* 3. 导航入口（由 ACCOUNT_MENU_ITEMS 驱动，带 active 指示） */}
        <div className="space-y-0.5">
          {ACCOUNT_MENU_ITEMS.map((item) => {
            const Icon = item.Icon;
            const active = isActive(item.id);
            const rowClass = cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-xl transition-all active:scale-[0.98]",
              isDesktop ? "px-2.5 py-2" : "px-2.5 py-2",
              active
                ? "bg-surface-3/70"
                : "hover:bg-surface-3/50 data-[highlighted]:bg-surface-3/50"
            );
            const label = (
              <span
                className={cn(
                  "truncate text-[13px] font-medium text-foreground",
                  active && "font-semibold"
                )}
              >
                {item.menuLabel}
              </span>
            );

            return isDesktop ? (
              <DropdownMenuItem key={item.id} asChild className={cn(rowClass, "text-xs")}>
                <Link href={item.href} aria-current={ariaCurrent(item.id)}>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={item.id}
                onClick={() => navigate(item.id, item.href)}
                aria-current={ariaCurrent(item.id)}
                className={rowClass}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      item.tint
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {label}
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="mx-1 my-1 opacity-60" />

        {/* 4. 退出登录 */}
        <DropdownMenuItem
          onClick={logout}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-destructive transition-all hover:bg-destructive/10 focus:bg-destructive/10 active:scale-[0.98] dark:text-destructive"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <LogOut className="h-3.5 w-3.5" />
          </div>
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * 移动端头部的头像入口。保留这个薄包装是因为 5 个视图都在用它，
 * 直接透传可读性更好，也留出将来做「未读角标」的位置。
 */
export const UserAvatarDropdown = UserAvatarMenu;

export type UserAvatarDropdownProps = UserAvatarMenuProps;

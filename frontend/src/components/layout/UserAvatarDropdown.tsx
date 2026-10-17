"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ACCOUNT_MENU_ITEMS, navLabels, type MobileTab } from "@/config/navigation";
import { useI18n } from "@/i18n";
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
import { overlaySurfaceClass } from "@/components/common/surfaces";
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
 * 现在合并为一个组件，variant 只影响两处：
 *   - 触发器形态：桌面是胶囊（头像 + 用户名 + 徽章），移动是圆形纯头像
 *   - 菜单项的跳转方式：desktop → <Link>（可中键新开、可被爬虫抓取）；
 *     mobile → onClick 切换 SPA 页签（整页跳转代价大且会丢状态）
 *
 * 菜单项的**视觉**两端完全一致（色调图标方块 + 文字 + 右箭头）。此前桌面端
 * 渲染的是裸图标 + 文字，与移动端像是两个不同的菜单 —— 行样式里还留着
 * `isDesktop ? "px-2.5 py-2" : "px-2.5 py-2"` 这种两分支值相同的死代码，
 * 说明当时并未真正区分过。唯一保留的视觉差异是「外观风格」三档：桌面顶栏
 * 已有独立的 <ThemeToggle>，同屏放两个主题入口会造成困惑。
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
  const { t } = useI18n();
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
      aria-label={t("common.account.menu", { username: user.username })}
      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 p-1 pr-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:gap-2 sm:pr-2.5"
    >
      <UserAvatar username={user.username} className="h-6 w-6" textClassName="text-2xs" />
      <span className="max-w-[80px] truncate font-medium sm:max-w-[120px]">
        {user.username}
      </span>
      {user.is_superuser && <AdminBadge size="sm" className="hidden sm:inline-flex" />}
    </button>
  ) : (
    <button
      type="button"
      aria-label={t("common.account.menu", { username: user.username })}
      className="flex h-9 w-9 shrink-0 cursor-pointer select-none items-center justify-center rounded-full border border-border/70 bg-muted/40 shadow-2xs transition-all hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
    >
      <UserAvatar username={user.username} className="h-7 w-7" textClassName="text-2xs" />
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={cn(overlaySurfaceClass, "w-[270px]")}
      >
        <div className="flex items-center gap-3 p-2 pb-2.5">
          <UserAvatar
            username={user.username}
            gradient
            className="h-10 w-10 shrink-0 border border-primary/20 shadow-xs"
            textClassName="text-sm"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {user.username}
              </span>
              {user.is_superuser ? (
                <AdminBadge size="sm" />
              ) : (
                <StandardUserBadge size="sm" />
              )}
            </div>
            <span className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {user.is_superuser ? t("common.account.adminReady") : t("common.account.standardUser")}
            </span>
          </div>
        </div>

        <DropdownMenuSeparator className="mx-1 my-1 opacity-60" />

        {!isDesktop && (
          <>
            <div className="px-2 py-1.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("settings.appearance.avatarMenuHeading")}
                </span>
              </div>
              <ThemeSegments size="sm" />
            </div>
            <DropdownMenuSeparator className="mx-1 my-1 opacity-60" />
          </>
        )}

        <div className="space-y-0.5">
          {ACCOUNT_MENU_ITEMS.map((item) => {
            const Icon = item.Icon;
            const active = isActive(item.id);
            const rowClass = cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-xl transition-all active:scale-[0.98]",
              "px-2.5 py-2",
              active
                ? "bg-surface-3/70"
                : "hover:bg-surface-3/50 data-[highlighted]:bg-surface-3/50"
            );
            const label = (
              <span
                className={cn(
                  "truncate text-footnote font-medium text-foreground",
                  active && "font-semibold"
                )}
              >
                {navLabels(item, t).menuLabel}
              </span>
            );

            // 内容部分完全一致，只有「点了怎么去」不同。
            const rowContent = (
              <>
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
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
              </>
            );

            return isDesktop ? (
              // 桌面端用 <Link>：可中键新开标签、可被爬虫抓取、可复制链接。
              <DropdownMenuItem key={item.id} asChild className={rowClass}>
                <Link href={item.href} aria-current={ariaCurrent(item.id)}>
                  {rowContent}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={item.id}
                onClick={() => navigate(item.id, item.href)}
                aria-current={ariaCurrent(item.id)}
                className={rowClass}
              >
                {rowContent}
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="mx-1 my-1 opacity-60" />

        <DropdownMenuItem
          onClick={logout}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-footnote font-medium text-destructive transition-all hover:bg-destructive/10 focus:bg-destructive/10 active:scale-[0.98] dark:text-destructive"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <LogOut className="h-3.5 w-3.5" />
          </div>
          <span>{t("common.account.logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

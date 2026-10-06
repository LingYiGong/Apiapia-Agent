"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/common/BrandLogo";
import { MobileTab } from "@/components/layout/UserAvatarDropdown";
import { cn } from "@/lib/utils";
import { Plus, LogOut } from "lucide-react";
import {
  ACCOUNT_MENU_ITEMS,
  DESKTOP_NAV_ITEMS,
  MOBILE_TAB_ITEMS,
} from "@/config/navigation";
import { useActiveNav } from "@/hooks/useActiveNav";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DesktopNavbarProps {
  className?: string;
}

/**
 * Desktop Top Header (48px / 56px)
 * Shown only on md+ screens.
 */
export const DesktopNavbar: React.FC<DesktopNavbarProps> = ({ className }) => {
  const { user, logout } = useAuth();
  const { isActive, ariaCurrent } = useActiveNav();

  return (
    <header
      className={cn(
        "hidden md:flex md:h-14 border-b border-border/70 bg-background/80 backdrop-blur-xl pl-[max(0.75rem,var(--sal))] pr-[max(0.75rem,var(--sar))] sm:pl-[max(1rem,var(--sal))] sm:pr-[max(1rem,var(--sar))] items-center justify-between shrink-0 z-30 flex-nowrap min-w-0",
        className
      )}
    >
      <div className="flex items-center gap-2 md:gap-3 lg:gap-6 min-w-0 shrink">
        <Link href="/chat" className="flex items-center gap-2 font-bold tracking-wide shrink-0">
          <BrandLogo size={32} className="shadow-xs" />
          <span className="text-base font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent truncate max-w-[110px] sm:max-w-none">
            Apiapia 助理
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 min-w-0 shrink overflow-x-auto no-scrollbar">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const Icon = item.Icon;
            const active = isActive(item.id);
            return (
              <Button
                key={item.id}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                asChild
                className={cn("shrink-0 whitespace-nowrap", active && "font-semibold")}
              >
                <Link href={item.href} aria-current={ariaCurrent(item.id)}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {/* 两个 span 始终同时存在于 DOM，屏幕阅读器会把
                      「对话对话」「记忆库记忆」连着念两遍；给短标签加
                      aria-hidden，只让完整标签参与无障碍名称。 */}
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="lg:hidden" aria-hidden="true">
                    {item.shortLabel}
                  </span>
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0">
        <ThemeToggle />
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-foreground bg-muted/60 hover:bg-muted p-1 pr-2 sm:pr-2.5 rounded-full border border-border/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 cursor-pointer"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                    {user.username.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[80px] sm:max-w-[120px] font-medium">{user.username}</span>
                {user.is_superuser && (
                  <Badge variant="outline" className="hidden sm:inline-flex text-[9px] px-1 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400">
                    管理员
                  </Badge>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs font-semibold leading-none truncate">{user.username}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {user.is_superuser ? "超级管理员 (Admin)" : "普通用户 (User)"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* 这三项此前是第三份手写副本，与桌面顶栏导航指向同一批目的地。
                  现在同样由 ACCOUNT_MENU_ITEMS 驱动。 */}
              {ACCOUNT_MENU_ITEMS.map((item) => {
                const Icon = item.Icon;
                return (
                  <DropdownMenuItem asChild key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 cursor-pointer text-xs"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{item.menuLabel}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="flex items-center gap-2 cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>退出登录</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};

export interface MobileTabBarProps {
  hasActiveChat?: boolean;
  activeMobileTab?: MobileTab;
  onSelectMobileTab?: (tab: MobileTab) => void;
  onNewChat?: () => void;
  className?: string;
}

/**
 * Apple HIG Standard Mobile Bottom Tab Bar
 * - 49pt content row (HIG)
 * - bottom padding = raw safe-area inset only (--sab): Face ID iPhone -> 34pt, total 83pt (HIG)
 * - never add a minimum/fallback inset: MD3 / Android edge-to-edge also stretch the bar behind
 *   the system navigation bar, so any extra floor shows up as dead space on inset-less devices.
 * Naturally sits in document flow at the bottom of the container (shrink-0, no fixed overlay).
 */
export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeMobileTab = "chat",
  onSelectMobileTab,
  onNewChat,
  className,
}) => {
  const router = useRouter();

  const handleMobileTabClick = (tab: MobileTab) => {
    if (tab === "chat" && activeMobileTab === "chat") {
      // 已在对话页时再次点击 = 新建对话
      if (onNewChat) {
        onNewChat();
      } else {
        router.push("/chat");
      }
      return;
    }

    const target = MOBILE_TAB_ITEMS.find((i) => i.id === tab);
    if (onSelectMobileTab) {
      onSelectMobileTab(tab);
    } else {
      router.push(target ? target.mobileHref : "/chat");
    }
  };

  const isChatActive = activeMobileTab === "chat";

  return (
    <nav
      aria-label="移动端底部标签栏"
      className={cn(
        "md:hidden shrink-0 w-full bg-background/90 dark:bg-[#121214]/90 backdrop-blur-xl border-t border-border/40 select-none z-30 transition-colors pb-[var(--sab)]",
        className
      )}
    >
      <div className="h-[49px] w-full flex items-center justify-around pl-[max(0.5rem,var(--sal))] pr-[max(0.5rem,var(--sar))]">
        {/* 现在由 MOBILE_TAB_ITEMS 统一驱动：此前这里手写 3 项，
            导致「用量」与「设置」两个顶层页面在移动端没有任何入口，
            只能从头像菜单二级进入。5 个页签在 320px 下每个约 62px，
            配合 text-[10.5px] 仍然放得下。 */}
        {MOBILE_TAB_ITEMS.map((item) => {
          const active = activeMobileTab === item.id;
          // 对话页激活时换成「新建」图标 + 文案，点击即新建；
          // 视觉隐藏两份文案，避免读屏在切换瞬间读到两个不同标签。
          const Icon = item.id === "chat" && isChatActive ? Plus : item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => handleMobileTabClick(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-0.5 gap-0.5 text-[10.5px] tracking-tight transition-all active:scale-95 cursor-pointer touch-manipulation",
                active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground/75 hover:text-foreground font-medium"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform",
                  active ? "stroke-[2.2px] scale-105" : "stroke-[1.8px]"
                )}
              />
              {item.id === "chat" ? (
                <>
                  <span className="leading-tight" aria-hidden="true">
                    {isChatActive ? "新建" : item.label}
                  </span>
                  <span className="sr-only">
                    {isChatActive ? "新建对话" : item.label}
                  </span>
                </>
              ) : (
                <span className="leading-tight">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export interface NavbarProps extends DesktopNavbarProps, MobileTabBarProps {}

/**
 * Backward-compatible Navbar component.
 */
export const Navbar: React.FC<NavbarProps> = (props) => {
  return (
    <>
      <DesktopNavbar className={props.className} />
      <MobileTabBar
        hasActiveChat={props.hasActiveChat}
        activeMobileTab={props.activeMobileTab}
        onSelectMobileTab={props.onSelectMobileTab}
        onNewChat={props.onNewChat}
        className={props.className}
      />
    </>
  );
};

"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/common/BrandLogo";
import { UserAvatarMenu } from "@/components/layout/UserAvatarDropdown";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import {
  ACCOUNT_MENU_ITEMS,
  DESKTOP_NAV_ITEMS,
  MOBILE_TAB_ITEMS,
  type MobileTab,
} from "@/config/navigation";
import { useActiveNav } from "@/hooks/useActiveNav";

export interface DesktopNavbarProps {
  className?: string;
}

/**
 * Desktop Top Header (56px)
 * Shown only on md+ screens. 高度引用 --header-h-desktop。
 */
export const DesktopNavbar: React.FC<DesktopNavbarProps> = ({ className }) => {
  const { user } = useAuth();
  const { isActive, ariaCurrent } = useActiveNav();

  return (
    <header
      className={cn(
        "hidden h-[var(--header-h-desktop)] shrink-0 flex-nowrap items-center justify-between border-b border-border/70 bg-background/80 pl-[max(0.75rem,var(--sal))] pr-[max(0.75rem,var(--sar))] backdrop-blur-xl sm:pl-[max(1rem,var(--sal))] sm:pr-[max(1rem,var(--sar))] md:flex md:min-w-0 md:shrink",
        className
      )}
    >
      <div className="flex min-w-0 shrink items-center gap-2 md:gap-3 lg:gap-6">
        <Link href="/chat" className="flex shrink-0 items-center gap-2 font-bold tracking-wide">
          <BrandLogo size={32} className="shadow-xs" />
          <span className="max-w-[110px] truncate bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-base font-semibold text-transparent sm:max-w-none dark:from-indigo-200 dark:to-indigo-400">
            Apiapia 助理
          </span>
        </Link>

        <nav className="hidden min-w-0 shrink items-center gap-0.5 overflow-x-auto no-scrollbar md:flex lg:gap-1">
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

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
        <ThemeToggle />
        {/* 主题与退出登录都收在头像菜单里（UserAvatarMenu 的单一实现），
            顶栏不再额外放第二个退出按钮 —— 同一屏出现两个退出入口不是精简。 */}
        {user && <UserAvatarMenu variant="desktop" />}
      </div>
    </header>
  );
};

export interface MobileTabBarProps {
  activeMobileTab?: MobileTab;
  onSelectMobileTab?: (tab: MobileTab) => void;
  onNewChat?: () => void;
  className?: string;
}

/**
 * Apple HIG Standard Mobile Bottom Tab Bar
 * - 49pt content row (HIG)，引用 --tabbar-h
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
        "z-30 w-full shrink-0 select-none border-t border-border/40 bg-background/90 pb-[var(--sab)] backdrop-blur-xl transition-colors md:hidden",
        className
      )}
    >
      <div className="flex h-[var(--tabbar-h)] w-full items-center justify-around pl-[max(0.5rem,var(--sal))] pr-[max(0.5rem,var(--sar))]">
        {/* 由 MOBILE_TAB_ITEMS 统一驱动。5 个页签在 320px 下每个约 62px，
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
                "flex h-full flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 py-0.5 text-[10.5px] tracking-tight transition-transform active:scale-95 touch-manipulation",
                active
                  ? "font-semibold text-primary"
                  : "font-medium text-muted-foreground/75 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform",
                  active ? "scale-105 stroke-[2.2px]" : "stroke-[1.8px]"
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

/** 账号菜单项的重导出，供只需要「有哪些二级入口」的调用点使用。 */
export { ACCOUNT_MENU_ITEMS };

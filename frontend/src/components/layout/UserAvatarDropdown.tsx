"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { ACCOUNT_MENU_ITEMS, type NavId } from "@/config/navigation";
import { useActiveNav } from "@/hooks/useActiveNav";
import { cn } from "@/lib/utils";

export type MobileTab = NavId;

export interface UserAvatarDropdownProps {
  onSelectMobileTab?: (tab: MobileTab) => void;
}

/**
 * Apple HIG Standard User Profile Dropdown & Sheet
 * - 22px super-ellipse corner radius
 * - Translucent frosted glass surface with deep soft shadows
 * - Apple ID style profile card header
 * - iOS segmented appearance theme toggle (Light / Dark / Auto)
 * - Rounded action cells with colored icon squircles and subtle chevrons
 * - Destructive Apple red sign-out button
 */
export const UserAvatarDropdown: React.FC<UserAvatarDropdownProps> = ({
  onSelectMobileTab,
}) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { isActive, ariaCurrent } = useActiveNav();

  if (!user) return null;

  const handleNavigate = (tab: MobileTab, fallbackPath: string) => {
    if (onSelectMobileTab) {
      onSelectMobileTab(tab);
    } else {
      router.push(fallbackPath);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="个人中心与偏好设置"
          className="flex items-center justify-center h-8 w-8 rounded-full border border-border/70 bg-muted/40 hover:bg-muted/70 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 shrink-0 cursor-pointer shadow-2xs select-none"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
              {user.username.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-[270px] rounded-[22px] border border-border/50 bg-background/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-2 z-50 select-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        {/* ── 1. Apple Account Profile Card ── */}
        <div className="flex items-center gap-3 p-2 pb-2.5">
          <Avatar className="h-10 w-10 border border-primary/20 shadow-xs shrink-0">
            <AvatarFallback className="text-[14px] font-bold bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
              {user.username.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[14px] font-semibold text-foreground tracking-tight truncate">
                {user.username}
              </span>
              {user.is_superuser ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-medium shrink-0">
                  管理员
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono shrink-0">
                  标准
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
              {user.is_superuser ? "超级管理员权限已就绪" : "已登录标准用户"}
            </span>
          </div>
        </div>

        <div className="border-b border-border/40 my-1 mx-1" />

        {/* ── 2. Appearance Theme Segment (iOS 3-way toggle) ── */}
        <div className="px-2 py-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              外观风格
            </span>
            <span className="text-[10px] text-muted-foreground/70 font-mono">
              {theme === "system" ? "跟随系统" : theme === "light" ? "浅色模式" : "深色模式"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-muted/50 dark:bg-[#2c2c2e]/60 p-0.5 rounded-xl border border-border/40">
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={cn(
                "h-7 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer",
                theme === "system"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Monitor className="h-3 w-3" />
              <span>自动</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "h-7 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer",
                theme === "light"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sun className="h-3 w-3 text-amber-500" />
              <span>浅色</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "h-7 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer",
                theme === "dark"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Moon className="h-3 w-3 text-indigo-400" />
              <span>深色</span>
            </button>
          </div>
        </div>

        <div className="border-b border-border/40 my-1 mx-1" />

        {/* ── 3. Navigation Links (Apple Table View Cell Style) ──
            此前手写了 3 个结构完全相同的单元格（偏好设置 / 用量与账单 / 长期记忆库），
            与桌面顶栏的导航项是同一份目的地却各写一遍。现在由 ACCOUNT_MENU_ITEMS
            驱动，并补上了 active 指示 —— 之前这三项没有任何当前位置反馈。 */}
        <div className="space-y-0.5">
          {ACCOUNT_MENU_ITEMS.map((item) => {
            const Icon = item.Icon;
            const active = isActive(item.id);
            return (
              <DropdownMenuItem
                key={item.id}
                onClick={() => handleNavigate(item.id, item.href)}
                aria-current={ariaCurrent(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-muted/60 dark:hover:bg-[#2c2c2e]/60 active:scale-[0.98] transition-all cursor-pointer group",
                  active && "bg-muted/60 dark:bg-[#2c2c2e]/60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                      item.tint
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span
                    className={cn(
                      "text-[13px] font-medium text-foreground",
                      active && "font-semibold"
                    )}
                  >
                    {item.menuLabel}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </DropdownMenuItem>
            );
          })}
        </div>

        <div className="border-b border-border/40 my-1 mx-1" />

        {/* ── 4. Sign Out Destructive Cell ── */}
        <DropdownMenuItem
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-destructive hover:bg-destructive/10 focus:bg-destructive/10 dark:text-red-400 active:scale-[0.98] transition-all cursor-pointer"
        >
          <div className="h-7 w-7 rounded-lg bg-destructive/10 text-destructive dark:text-red-400 flex items-center justify-center shrink-0">
            <LogOut className="h-3.5 w-3.5" />
          </div>
          <span className="text-[13px] font-medium">退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/common/BrandLogo";
import { cn } from "@/lib/utils";
import {
  Cat,
  Plus,
  MessageSquare,
  Brain,
  Settings,
  LogOut,
  BarChart3,
  ShieldCheck,
  AlignLeft,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  onToggleSidebar?: () => void;
  onToggleMemory?: () => void;
  hasMemories?: boolean;
  onNewChat?: () => void;
  /** 是否已有进行中的对话（有消息记录）*/
  hasActiveChat?: boolean;
  activeMobileTab?: "chat" | "history";
  onSelectMobileTab?: (tab: "chat" | "history") => void;
}

export const Navbar = ({
  onToggleSidebar,
  onToggleMemory,
  hasMemories,
  onNewChat,
  hasActiveChat = false,
  activeMobileTab = "chat",
  onSelectMobileTab,
}: NavbarProps) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isChatPage = pathname.startsWith("/chat");

  const desktopNavItems = [
    { href: "/chat", label: "对话", shortLabel: "对话", icon: MessageSquare },
    { href: "/memory", label: "记忆库", shortLabel: "记忆", icon: Brain },
    {
      href: "/usage",
      label: "用量",
      shortLabel: "用量",
      icon: BarChart3,
    },
    { href: "/settings", label: "设置", shortLabel: "设置", icon: Settings },
  ];

  return (
    <>
      {/* ── Desktop / Tablet Top Header ── */}
      <header
        className="hidden md:flex md:h-14 border-b border-border/70 bg-background/80 backdrop-blur-xl px-3 sm:px-4 items-center justify-between shrink-0 z-30 flex-nowrap min-w-0"
      >
        <div className="flex items-center gap-2 md:gap-3 lg:gap-6 min-w-0 shrink">
          <Link href="/chat" className="flex items-center gap-2 font-bold tracking-wide shrink-0">
            <BrandLogo size={32} className="shadow-xs" />
            <span className="text-base font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent truncate max-w-[110px] sm:max-w-none">
              Apiapia 助理
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 min-w-0 shrink">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  asChild
                  className={cn("shrink-0 whitespace-nowrap", isActive && "font-semibold")}
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{item.label}</span>
                    <span className="lg:hidden">{item.shortLabel}</span>
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
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2 cursor-pointer text-xs">
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>偏好设置</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/usage" className="flex items-center gap-2 cursor-pointer text-xs">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>用量与账单</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/memory" className="flex items-center gap-2 cursor-pointer text-xs">
                    <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>长期记忆库</span>
                  </Link>
                </DropdownMenuItem>
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

      {/* ── Apple HIG Standard Mobile Bottom Tab Bar (49pt + safe area) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/80 dark:bg-[#121214]/85 backdrop-blur-2xl border-t border-border/40 flex items-stretch h-[calc(49px+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-1px_3px_rgba(0,0,0,0.03)]"
      >
        {/* 1. 新建 —— 在 /chat 且无进行中的对话时高亮选中 */}
        {isChatPage ? (
          <button
            type="button"
            onClick={() => {
              onNewChat?.();
              onSelectMobileTab?.("chat");
            }}
            className={cn(
              "flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 select-none",
              activeMobileTab === "chat" && !hasActiveChat
                ? "text-primary font-semibold"
                : "text-muted-foreground/70 hover:text-foreground font-medium"
            )}
          >
            <Plus className="h-[22px] w-[22px] shrink-0" />
            <span>新建</span>
          </button>
        ) : (
          <Link
            href="/chat"
            className="flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 select-none text-muted-foreground/70 hover:text-foreground font-medium"
          >
            <Plus className="h-[22px] w-[22px] shrink-0" />
            <span>新建</span>
          </Link>
        )}

        {/* 2. 历史 —— 处于历史列表或已有对话时高亮选中 */}
        {isChatPage ? (
          <button
            type="button"
            onClick={() => {
              onSelectMobileTab?.("history");
            }}
            className={cn(
              "flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 select-none",
              activeMobileTab === "history" || (activeMobileTab === "chat" && hasActiveChat)
                ? "text-primary font-semibold"
                : "text-muted-foreground/70 hover:text-foreground font-medium"
            )}
          >
            <AlignLeft className="h-[22px] w-[22px] shrink-0" />
            <span>历史</span>
          </button>
        ) : (
          <Link
            href="/chat?openHistory=1"
            className="flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 select-none text-muted-foreground/70 hover:text-foreground font-medium"
          >
            <AlignLeft className="h-[22px] w-[22px] shrink-0" />
            <span>历史</span>
          </Link>
        )}

        {/* 3. 记忆 — 始终跳转 /memory 页，当前页时高亮 */}
        <Link
          href="/memory"
          className={cn(
            "flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 select-none",
            pathname.startsWith("/memory") ? "text-primary font-semibold" : "text-muted-foreground/70 hover:text-foreground font-medium"
          )}
        >
          <Brain className="h-[22px] w-[22px] shrink-0" />
          <span>记忆</span>
        </Link>

        {/* 4. 用量 — 跳转 /usage，当前页时高亮 */}
        <Link
          href="/usage"
          className={cn(
            "flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 select-none",
            pathname.startsWith("/usage") ? "text-primary font-semibold" : "text-muted-foreground/70 hover:text-foreground font-medium"
          )}
        >
          <BarChart3 className="h-[22px] w-[22px] shrink-0" />
          <span>用量</span>
        </Link>
      </nav>
    </>
  );
};

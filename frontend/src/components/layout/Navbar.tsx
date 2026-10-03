"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/common/BrandLogo";
import { MobileTab } from "@/components/layout/UserAvatarDropdown";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Brain,
  Settings,
  LogOut,
  BarChart3,
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

export interface DesktopNavbarProps {
  className?: string;
}

/**
 * Desktop Top Header (48px / 56px)
 * Shown only on md+ screens.
 */
export const DesktopNavbar: React.FC<DesktopNavbarProps> = ({ className }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const desktopNavItems = [
    { href: "/chat", label: "对话", shortLabel: "对话", icon: MessageSquare },
    { href: "/memory", label: "记忆库", shortLabel: "记忆", icon: Brain },
    { href: "/usage", label: "用量", shortLabel: "用量", icon: BarChart3 },
    { href: "/settings", label: "设置", shortLabel: "设置", icon: Settings },
  ];

  return (
    <header
      className={cn(
        "hidden md:flex md:h-14 border-b border-border/70 bg-background/80 backdrop-blur-xl px-3 sm:px-4 items-center justify-between shrink-0 z-30 flex-nowrap min-w-0",
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
  );
};

export interface MobileTabBarProps {
  hasActiveChat?: boolean;
  activeMobileTab?: MobileTab;
  onSelectMobileTab?: (tab: MobileTab) => void;
  className?: string;
}

/**
 * Apple HIG Standard Mobile Bottom Tab Bar (5 Tabs, 49pt + safe area)
 * Naturally sits in document flow at the bottom of the container (shrink-0, no fixed overlay).
 */
export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeMobileTab = "chat",
  onSelectMobileTab,
  className,
}) => {
  const router = useRouter();

  const handleMobileTabClick = (tab: MobileTab) => {
    if (onSelectMobileTab) {
      onSelectMobileTab(tab);
    } else {
      router.push(tab === "chat" ? "/chat" : `/chat?tab=${tab}`);
    }
  };

  return (
    <nav
      aria-label="移动端底部标签栏"
      className={cn(
        "md:hidden shrink-0 w-full bg-background/80 dark:bg-[#121214]/85 backdrop-blur-2xl border-t border-border/40 flex items-stretch h-[calc(49px+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-1px_3px_rgba(0,0,0,0.03)] select-none z-30",
        className
      )}
    >
      {/* 1. 对话 Tab */}
      <button
        type="button"
        onClick={() => handleMobileTabClick("chat")}
        className={cn(
          "flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 cursor-pointer",
          activeMobileTab === "chat"
            ? "text-primary font-semibold"
            : "text-muted-foreground/70 hover:text-foreground font-medium"
        )}
      >
        <MessageSquare className="h-[22px] w-[22px] shrink-0" />
        <span>对话</span>
      </button>

      {/* 2. 历史 Tab */}
      <button
        type="button"
        onClick={() => handleMobileTabClick("history")}
        className={cn(
          "flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 cursor-pointer",
          activeMobileTab === "history"
            ? "text-primary font-semibold"
            : "text-muted-foreground/70 hover:text-foreground font-medium"
        )}
      >
        <AlignLeft className="h-[22px] w-[22px] shrink-0" />
        <span>历史</span>
      </button>

      {/* 3. 记忆 Tab */}
      <button
        type="button"
        onClick={() => handleMobileTabClick("memory")}
        className={cn(
          "flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 cursor-pointer",
          activeMobileTab === "memory"
            ? "text-primary font-semibold"
            : "text-muted-foreground/70 hover:text-foreground font-medium"
        )}
      >
        <Brain className="h-[22px] w-[22px] shrink-0" />
        <span>记忆</span>
      </button>

      {/* 4. 用量 Tab */}
      <button
        type="button"
        onClick={() => handleMobileTabClick("usage")}
        className={cn(
          "flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 cursor-pointer",
          activeMobileTab === "usage"
            ? "text-primary font-semibold"
            : "text-muted-foreground/70 hover:text-foreground font-medium"
        )}
      >
        <BarChart3 className="h-[22px] w-[22px] shrink-0" />
        <span>用量</span>
      </button>

      {/* 5. 设置 Tab */}
      <button
        type="button"
        onClick={() => handleMobileTabClick("settings")}
        className={cn(
          "flex flex-col items-center justify-center flex-1 pt-1 pb-0.5 gap-0.5 text-[10px] tracking-tight transition-all active:scale-95 cursor-pointer",
          activeMobileTab === "settings"
            ? "text-primary font-semibold"
            : "text-muted-foreground/70 hover:text-foreground font-medium"
        )}
      >
        <Settings className="h-[22px] w-[22px] shrink-0" />
        <span>设置</span>
      </button>
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
        className={props.className}
      />
    </>
  );
};

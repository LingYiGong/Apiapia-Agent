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
  Plus,
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
  onNewChat?: () => void;
  className?: string;
}

/**
 * Apple HIG Standard Mobile Bottom Tab Bar (5 Tabs, 49pt + safe area)
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
    if (tab === "chat") {
      if (activeMobileTab === "chat") {
        if (onNewChat) {
          onNewChat();
        } else {
          router.push("/chat");
        }
        return;
      }
      if (onSelectMobileTab) {
        onSelectMobileTab("chat");
      } else {
        router.push("/chat");
      }
      return;
    }

    if (onSelectMobileTab) {
      onSelectMobileTab(tab);
    } else {
      router.push(`/chat?tab=${tab}`);
    }
  };

  const isChatActive = activeMobileTab === "chat";

  const navItems: { tab: MobileTab; label: string; icon: React.ElementType }[] = [
    {
      tab: "chat",
      label: isChatActive ? "新建" : "对话",
      icon: isChatActive ? Plus : MessageSquare,
    },
    { tab: "history", label: "历史", icon: AlignLeft },
    { tab: "memory", label: "记忆", icon: Brain },
    { tab: "usage", label: "用量", icon: BarChart3 },
    { tab: "settings", label: "设置", icon: Settings },
  ];

  return (
    <nav
      aria-label="移动端底部标签栏"
      className={cn(
        "md:hidden shrink-0 w-full bg-background/90 dark:bg-[#121214]/90 backdrop-blur-xl border-t border-border/40 select-none z-30 transition-colors",
        className
      )}
      style={{
        paddingBottom: "max(24px, env(safe-area-inset-bottom, 34px))",
      }}
    >
      <div className="h-[49px] w-full flex items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMobileTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => handleMobileTabClick(item.tab)}
              title={item.label}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-0.5 gap-0.5 text-[10.5px] tracking-tight transition-all active:scale-95 cursor-pointer touch-manipulation",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground/75 hover:text-foreground font-medium"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform",
                  isActive ? "stroke-[2.2px] scale-105" : "stroke-[1.8px]"
                )}
              />
              <span className="leading-tight">{item.label}</span>
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

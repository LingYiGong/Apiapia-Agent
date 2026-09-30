"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Cat,
  MessageSquare,
  Brain,
  Settings,
  LogOut,
  BarChart3,
  ShieldCheck,
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
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  onToggleMemory,
  hasMemories,
}) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isChatPage = pathname.startsWith("/chat");

  const navItems = [
    { href: "/chat", label: "对话", shortLabel: "对话", icon: MessageSquare },
    { href: "/memory", label: "记忆库", shortLabel: "记忆", icon: Brain },
    {
      href: "/usage",
      label: user?.is_superuser ? "管理后台" : "用量",
      shortLabel: user?.is_superuser ? "管理" : "用量",
      icon: user?.is_superuser ? ShieldCheck : BarChart3,
    },
    { href: "/settings", label: "设置", shortLabel: "设置", icon: Settings },
  ];

  return (
    <>
      {/* Top Navigation Header - flex-nowrap to prevent text/buttons dropping down on iPad */}
      <header
        className={cn(
          "border-b bg-background/90 backdrop-blur px-3 sm:px-4 items-center justify-between shrink-0 z-30 flex-nowrap min-w-0",
          isChatPage
            ? "hidden md:flex md:h-14"
            : "flex pt-[max(0.65rem,env(safe-area-inset-top))] pb-2 md:pt-0 md:pb-0 md:h-14 min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] md:min-h-14"
        )}
      >
        <div className="flex items-center gap-2 md:gap-3 lg:gap-6 min-w-0 shrink">
          <Link href="/chat" className="flex items-center gap-2 font-bold tracking-wide shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shrink-0">
              <Cat className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent truncate max-w-[110px] sm:max-w-none">
              Apiapia 助理
            </span>
          </Link>

          {/* Desktop/Tablet Navigation Links */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 min-w-0 shrink">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  asChild
                  className={cn(
                    "shrink-0 whitespace-nowrap",
                    isActive && "font-semibold"
                  )}
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

        {/* Right Header Actions */}
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

      {/* Mobile Bottom Tab Bar (shown on non-chat pages to maximize chat canvas in /chat) */}
      {!isChatPage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg border-t flex items-center justify-around px-2 py-1 safe-pb shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10px] font-medium transition-all",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "p-1 rounded-lg transition-colors",
                    isActive ? "bg-accent" : "bg-transparent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="truncate mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
};

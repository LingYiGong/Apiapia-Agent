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
      badge: user?.is_superuser ? "管理" : undefined,
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
                    {item.badge && (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {item.badge}
                      </Badge>
                    )}
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
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2 sm:px-2.5 py-1 rounded-full border max-w-[85px] sm:max-w-[110px] lg:max-w-none shrink-0">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                    {user.username.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{user.username}</span>
                {user.is_superuser && (
                  <Badge variant="outline" className="hidden xl:inline-flex text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">
                    管理员
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title="退出登录"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="sr-only">退出登录</span>
              </Button>
            </div>
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

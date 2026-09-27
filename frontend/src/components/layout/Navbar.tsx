"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  Bot,
  MessageSquare,
  Brain,
  Settings,
  LogOut,
  User as UserIcon,
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
    { href: "/memory", label: "长期记忆", shortLabel: "记忆", icon: Brain },
    {
      href: "/usage",
      label: user?.is_superuser ? "后台与用量" : "用量统计",
      shortLabel: user?.is_superuser ? "后台" : "用量",
      icon: user?.is_superuser ? ShieldCheck : BarChart3,
      badge: user?.is_superuser ? "管理" : undefined,
    },
    { href: "/settings", label: "设置", shortLabel: "设置", icon: Settings },
  ];

  return (
    <>
      {/* Top Navigation Header - flex-nowrap to prevent text/buttons dropping down on iPad */}
      <header className={`border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/90 backdrop-blur px-3 sm:px-4 items-center justify-between shrink-0 z-30 transition-colors flex-nowrap min-w-0 ${isChatPage ? "hidden md:flex h-14" : "flex h-14"}`}>
        <div className="flex items-center gap-2 md:gap-3 lg:gap-6 min-w-0 shrink">
          <Link href="/chat" className="flex items-center gap-2 font-bold tracking-wide shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/30 shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent truncate max-w-[110px] sm:max-w-none">
              Personal AI
            </span>
          </Link>

          {/* Desktop/Tablet Navigation Links */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 min-w-0 shrink">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-2 lg:px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-colors shrink-0 whitespace-nowrap ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="lg:hidden">{item.shortLabel}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0">
          <ThemeToggle />

          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 sm:px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700/60 max-w-[85px] sm:max-w-[110px] lg:max-w-none shrink-0">
                <UserIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">{user.username}</span>
                {user.is_superuser && (
                  <span className="hidden xl:inline text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                    超管
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                title="退出登录"
                className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4 shrink-0" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (shown on non-chat pages to maximize chat canvas in /chat) */}
      {!isChatPage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 py-1 safe-pb shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10px] font-medium transition-all ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-950/60"
                      : "bg-transparent"
                  }`}
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

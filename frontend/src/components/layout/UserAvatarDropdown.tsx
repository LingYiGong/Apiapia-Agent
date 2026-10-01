"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, BarChart3, Brain, LogOut } from "lucide-react";

export const UserAvatarDropdown = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="个人中心与偏好设置"
          className="flex items-center justify-center h-8 w-8 rounded-full border border-border/80 bg-muted/50 hover:bg-muted active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 cursor-pointer shadow-2xs"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
              {user.username.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 z-50">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-semibold leading-none truncate">{user.username}</p>
              {user.is_superuser && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                  管理员
                </span>
              )}
            </div>
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
  );
};

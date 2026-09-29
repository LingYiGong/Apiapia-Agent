"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Conversation } from "@/types";
import { CURRENT_VERSION, triggerManualUpdateCheck } from "@/lib/version";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Plus,
  MessageSquare,
  Trash2,
  Search,
  X,
  Brain,
  Settings,
  BarChart3,
} from "lucide-react";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function formatFullDateTime(isoStr?: string) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return "";
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  isOpen = false,
  onClose,
}) => {
  const [search, setSearch] = useState("");

  const sorted = [...conversations].sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  const filtered = sorted.filter((c) =>
    (c.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectConv = (id: string) => {
    onSelect(id);
    onClose?.();
  };

  const handleNewChatClick = () => {
    onNewChat();
    onClose?.();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay (always mounted so it can fade) */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-200 md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden="true"
      />

      {/* Sidebar Drawer Container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[84vw] max-w-xs flex-col border-r bg-background h-full shrink-0 shadow-2xl transition-[transform,visibility] duration-200 md:static md:w-56 md:shadow-none lg:w-64 md:z-auto",
          isOpen ? "translate-x-0 visible" : "-translate-x-full invisible md:visible md:translate-x-0"
        )}
      >
        {/* Mobile Header with App Switcher & Close button */}
        <div className="p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3 border-b flex flex-col gap-2">
          <div className="flex items-center justify-between md:hidden pb-1 border-b">
            <span className="text-xs font-bold">
              历史对话
            </span>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </Button>
          </div>

          {/* Quick Page Jump for Mobile */}
          <div className="grid grid-cols-3 gap-1 md:hidden pb-2 border-b">
            <Link
              href="/memory"
              onClick={onClose}
              className="flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
            >
              <Brain className="h-4 w-4 mb-0.5 text-primary" />
              <span>记忆库</span>
            </Link>
            <Link
              href="/usage"
              onClick={onClose}
              className="flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
            >
              <BarChart3 className="h-4 w-4 mb-0.5 text-primary" />
              <span>用量</span>
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4 mb-0.5 text-primary" />
              <span>设置</span>
            </Link>
          </div>

          <Button onClick={handleNewChatClick} className="w-full">
            <Plus className="h-4 w-4" />
            <span>新建对话</span>
          </Button>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜索历史对话..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                {search ? "未找到匹配会话" : "暂无历史对话"}
              </div>
            ) : (
              filtered.map((c) => {
                const isSelected = c.id === activeId;
                const timeDisplay = formatFullDateTime(c.updated_at || c.created_at);
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConv(c.id)}
                    className={cn(
                      "group flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all border",
                      isSelected
                        ? "bg-background font-medium shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <MessageSquare
                        className={cn(
                          "h-4 w-4 shrink-0 mt-0.5",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate leading-snug">{c.title || "新建对话"}</span>
                        {timeDisplay && (
                          <span className="text-[10px] text-muted-foreground font-mono mt-0.5 select-none">
                            {timeDisplay}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      title="删除对话"
                      className="opacity-70 md:opacity-0 md:group-hover:opacity-100 h-7 w-7 shrink-0 mt-0.5 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">删除对话</span>
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Bottom Version info */}
        <div className="p-2 border-t safe-pb space-y-1">
          <div className="flex items-center justify-between px-3 py-1 text-[11px] text-muted-foreground select-none">
            <Badge variant="outline" className="font-mono">v{CURRENT_VERSION}</Badge>
            <Button
              variant="link"
              size="sm"
              onClick={triggerManualUpdateCheck}
              className="h-auto p-0 text-xs"
            >
              检查更新
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Conversation } from "@/types";
import { CURRENT_VERSION, triggerManualUpdateCheck } from "@/lib/version";
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
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[84vw] max-w-xs md:static md:w-56 lg:w-64 md:z-auto border-r border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 md:bg-slate-50/80 md:dark:bg-slate-900/50 flex flex-col h-full shrink-0 transition-transform duration-200 shadow-2xl md:shadow-none ${
          isOpen ? "translate-x-0 flex" : "-translate-x-full md:translate-x-0 hidden md:flex"
        }`}
      >
        {/* Mobile Header with App Switcher & Close button */}
        <div className="p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between md:hidden pb-1 border-b border-slate-200 dark:border-slate-800/80">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              历史对话与导航
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Page Jump for Mobile */}
          <div className="grid grid-cols-3 gap-1 md:hidden pb-2 border-b border-slate-200 dark:border-slate-800/60">
            <Link
              href="/memory"
              onClick={onClose}
              className="flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <Brain className="h-4 w-4 mb-0.5 text-indigo-500" />
              <span>长期记忆</span>
            </Link>
            <Link
              href="/usage"
              onClick={onClose}
              className="flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <BarChart3 className="h-4 w-4 mb-0.5 text-indigo-500" />
              <span>用量统计</span>
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <Settings className="h-4 w-4 mb-0.5 text-indigo-500" />
              <span>系统设置</span>
            </Link>
          </div>

          <button
            onClick={handleNewChatClick}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>新建对话</span>
          </button>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="搜索对话..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/70 py-1.5 pl-8 pr-3 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
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
                  className={`group flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                    isSelected
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium shadow-sm border border-slate-200 dark:border-slate-700/60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <MessageSquare
                      className={`h-4 w-4 shrink-0 mt-0.5 ${
                        isSelected
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate leading-snug">{c.title || "新建对话"}</span>
                      {timeDisplay && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 select-none">
                          {timeDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c.id);
                    }}
                    title="删除对话"
                    className="opacity-70 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-all shrink-0 mt-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Version info */}
        <div className="p-2 border-t border-slate-200 dark:border-slate-800 safe-pb space-y-1">
          <div className="flex items-center justify-between px-3 py-1 text-[11px] text-slate-400 dark:text-slate-500 select-none">
            <span className="font-mono">v{CURRENT_VERSION}</span>
            <button
              type="button"
              onClick={triggerManualUpdateCheck}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline hover:opacity-80 transition-opacity font-medium cursor-pointer"
            >
              检查更新
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

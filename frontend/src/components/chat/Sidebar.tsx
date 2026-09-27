"use client";

import React, { useState } from "react";
import { Conversation } from "@/types";
import { Plus, MessageSquare, Trash2, Search } from "lucide-react";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
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

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex flex-col h-full shrink-0 transition-colors">
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
        <button
          onClick={onNewChat}
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
                onClick={() => onSelect(c.id)}
                className={`group flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                  isSelected
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium shadow-sm border border-slate-200 dark:border-slate-700/60"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 border border-transparent"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <MessageSquare className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
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
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-all shrink-0 mt-0.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

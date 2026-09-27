"use client";

import React from "react";
import { Brain, Sparkles, AlertCircle } from "lucide-react";
import Link from "next/link";

interface MemorySidebarProps {
  memories: any[];
  memoryEnabled: boolean;
  onToggleMemory: () => void;
}

export const MemorySidebar: React.FC<MemorySidebarProps> = ({
  memories,
  memoryEnabled,
  onToggleMemory,
}) => {
  return (
    <aside className="w-72 border-l border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 flex flex-col h-full shrink-0 transition-colors">
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">相关长期记忆</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{memoryEnabled ? "开启" : "关闭"}</span>
          <button
            onClick={onToggleMemory}
            className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors ${
              memoryEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <div
              className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${
                memoryEnabled ? "translate-x-3" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {!memoryEnabled ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 text-center shadow-sm">
            <p className="text-xs text-slate-600 dark:text-slate-400">长期记忆已停用</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">本次对话将不会召回或写入 Mem0 记忆库</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/40 p-4 text-center shadow-sm">
            <Sparkles className="h-5 w-5 text-indigo-500 dark:text-indigo-400/60 mx-auto mb-2" />
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">暂无关联记忆召回</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              发送包含个人偏好、背景或事实的消息后，系统将自动提取长期事实并在此呈现。
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 dark:text-indigo-300/90 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 px-2.5 py-1.5 rounded-lg">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>以下为本次回复参考的背景事实：</span>
            </div>
            {memories.map((m, idx) => {
              const text = m.memory || m.text || JSON.stringify(m);
              return (
                <div
                  key={m.id || idx}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3 text-xs text-slate-700 dark:text-slate-200 shadow-sm leading-relaxed"
                >
                  <p>{text}</p>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
        <Link
          href="/memory"
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors font-medium"
        >
          <span>查看完整记忆库 →</span>
        </Link>
      </div>
    </aside>
  );
};

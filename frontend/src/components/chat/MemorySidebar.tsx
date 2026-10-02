"use client";

import React, { useMemo } from "react";
import { Brain, Sparkles, X, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface MemorySidebarProps {
  memories: any[];
  memoryEnabled: boolean;
  onToggleMemory: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function formatFullDateTime(val?: string): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return String(val);
  }
}

export function MemorySidebar({
  memories,
  memoryEnabled,
  onToggleMemory,
  isOpen = false,
  onClose,
}: MemorySidebarProps) {
  const sortedMemories = useMemo(() => {
    return [...memories].sort((a, b) => {
      const timeA = new Date(
        a.created_at || a.metadata?.created_at || a.updated_at || a.metadata?.timestamp || 0
      ).getTime();
      const timeB = new Date(
        b.created_at || b.metadata?.created_at || b.updated_at || b.metadata?.timestamp || 0
      ).getTime();
      return timeB - timeA;
    });
  }, [memories]);

  const renderMemoryContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full select-none">
      {/* ── Apple HIG Modal Header ── */}
      <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-[7px] bg-[#34C759] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Brain className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-[16px] sm:text-[17px] font-semibold text-foreground tracking-tight truncate">
              本次关联记忆
            </h3>
            {sortedMemories.length > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.2 rounded-full bg-[#34C759]/10 text-[#34C759] dark:text-[#30D158] font-medium border border-[#34C759]/20 shrink-0">
                {sortedMemories.length} 条
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 bg-[#767680]/10 dark:bg-[#767680]/20 px-2.5 py-1 rounded-full">
            <span className="text-[11px] text-[#8E8E93] font-medium">
              {memoryEnabled ? "检索开启" : "已暂停"}
            </span>
            <Switch
              checked={memoryEnabled}
              onCheckedChange={onToggleMemory}
              aria-label="长期记忆检索开关"
            />
          </div>

          {/* Apple Circular Close Button */}
          {isMobile && (
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[#767680]/15 dark:bg-[#767680]/25 text-muted-foreground hover:text-foreground flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              title="关闭"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable Memory Items ── */}
      <ScrollArea className="flex-1 px-4 py-3.5">
        <div className="space-y-3 pb-4">
          {!memoryEnabled ? (
            <Card className="rounded-2xl border-black/[0.06] dark:border-white/[0.08] bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/40 shadow-none">
              <CardContent className="p-5 text-center space-y-1">
                <Brain className="h-6 w-6 text-[#8E8E93] mx-auto mb-1.5 opacity-60" />
                <p className="text-[13px] font-semibold text-foreground">长期记忆检索已暂停</p>
                <p className="text-[11px] text-[#8E8E93] dark:text-[#98989D] leading-relaxed">
                  当前对话不会自动参考或写入偏好事实。可在右上角开关中随时重新开启。
                </p>
              </CardContent>
            </Card>
          ) : sortedMemories.length === 0 ? (
            <Card className="rounded-2xl border-black/[0.06] dark:border-white/[0.08] bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/40 shadow-none">
              <CardContent className="p-6 text-center space-y-1.5">
                <Sparkles className="h-6 w-6 text-primary/70 mx-auto mb-1" />
                <p className="text-[14px] font-semibold text-foreground">暂无关联记忆召回</p>
                <p className="text-[12px] text-[#8E8E93] dark:text-[#98989D] leading-relaxed max-w-[260px] mx-auto">
                  向助理提供关于你的个人偏好、工作背景或习惯后，系统将自动提炼并在此即时呈现。
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Apple Callout Subtitle Card */}
              <div className="p-3 rounded-xl bg-[#34C759]/8 dark:bg-[#34C759]/12 border border-[#34C759]/20 text-[12px] text-foreground/80 flex items-start gap-2.5 leading-relaxed">
                <Sparkles className="h-4 w-4 text-[#34C759] dark:text-[#30D158] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">背景语义召回：</span>
                  <span>以下为系统在本次交流中自动参考的长期个人事实。</span>
                </div>
              </div>

              {/* Memory List Cards */}
              <div className="space-y-2.5 pt-0.5">
                {sortedMemories.map((m, idx) => {
                  const text = m.memory || m.text || JSON.stringify(m);
                  const createdAt =
                    m.created_at ||
                    m.metadata?.created_at ||
                    m.updated_at ||
                    m.metadata?.timestamp;
                  const formattedTime = formatFullDateTime(createdAt);

                  return (
                    <div
                      key={m.id || idx}
                      className="p-3.5 rounded-[14px] border border-black/[0.05] dark:border-white/[0.06] bg-[#F2F2F7]/60 dark:bg-[#2C2C2E]/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-2 transition-colors"
                    >
                      <p className="break-words text-[13px] text-foreground/90 font-normal leading-relaxed">
                        {text}
                      </p>
                      {formattedTime && (
                        <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-[11px] text-[#8E8E93] font-mono">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 shrink-0 opacity-70" />
                            <span>{formattedTime}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/[0.04] dark:bg-white/[0.04]">
                            已向量化
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* ── Apple Footer Navigation Action ── */}
      <div className="p-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
        <Button
          variant="outline"
          size="sm"
          asChild
          className="w-full rounded-full h-8 text-xs font-semibold border-black/[0.08] dark:border-white/[0.08] bg-[#767680]/10 hover:bg-[#767680]/15 text-foreground active:scale-95 transition-all shadow-none"
        >
          <Link href="/memory" onClick={onClose} className="flex items-center justify-center gap-1.5">
            <span>前往长期记忆库管理全部</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Memory Sidebar (Screen width >= lg) */}
      <aside className="hidden lg:flex lg:w-72 flex-col border-l border-border/70 bg-white/70 dark:bg-[#121214] h-full shrink-0">
        {renderMemoryContent(false)}
      </aside>

      {/* ── Apple HIG iOS Bottom Sheet (Screen width < lg: Mobile & Tablet) ── */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent
          side="bottom"
          className="p-0 max-h-[82vh] h-[78vh] max-w-xl mx-auto rounded-t-[24px] flex flex-col bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border-t border-black/[0.08] dark:border-white/[0.1] shadow-2xl [&>button]:hidden overflow-hidden"
        >
          {/* iOS Sheet Grabber / Drag Indicator */}
          <div className="pt-2.5 pb-0.5 flex justify-center shrink-0">
            <div className="w-9 h-1 rounded-full bg-black/20 dark:bg-white/20" />
          </div>

          <SheetHeader className="sr-only">
            <SheetTitle>本次关联记忆</SheetTitle>
            <SheetDescription>展示系统为本次对话检索到的长期记忆事实</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {renderMemoryContent(true)}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

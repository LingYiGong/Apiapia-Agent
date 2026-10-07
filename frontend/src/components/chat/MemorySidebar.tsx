"use client";

import React, { useMemo } from "react";
import { Brain, Sparkles, X, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/common/Panel";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDateTime } from "@/lib/format";
import { normalizeMemories } from "@/lib/memory";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { MobileTab } from "@/config/navigation";

interface MemorySidebarProps {
  memories: unknown[];
  memoryEnabled: boolean;
  onToggleMemory: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  onSelectMobileTab?: (tab: MobileTab) => void;
}

/**
 * 本次对话召回的长期记忆。
 *
 * 注意它与 <MemoryView>（记忆库）读的是同一批数据，但此前两处各自做了一遍
 * 归一化兜底且**时间字段优先级相反** —— 记忆库按 updated_at、这里按
 * created_at，于是同一条被编辑过的记忆在两处显示的时间不一样。现在两处
 * 都走 lib/memory 的 normalizeMemory。
 */
export function MemorySidebar({
  memories,
  memoryEnabled,
  onToggleMemory,
  isOpen = false,
  onClose,
  onSelectMobileTab,
}: MemorySidebarProps) {
  const normalized = useMemo(
    () => normalizeMemories(memories ?? [], { sort: true }),
    [memories]
  );

  /**
   * 面板内容。桌面端与移动端 Sheet 共用同一份 DOM 结构，
   * 只有「关闭按钮」需要区分：桌面侧栏常驻不可关，给一个关不掉的 X 是误导。
   */
  const renderMemoryContent = ({ showClose }: { showClose: boolean }) => (
    <div className="flex h-full select-none flex-col">
      {/* ── 头部 ── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-success text-white shadow-xs">
            <Brain className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold tracking-tight text-foreground sm:text-[17px]">
              本次关联记忆
            </h3>
            {normalized.length > 0 && (
              <span className="shrink-0 rounded-full border border-success/20 bg-success/10 px-2 py-px font-mono text-[11px] font-medium text-success">
                {normalized.length} 条
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-full bg-surface-4/50 px-2.5 py-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              {memoryEnabled ? "检索开启" : "已暂停"}
            </span>
            <Switch
              checked={memoryEnabled}
              onCheckedChange={onToggleMemory}
              aria-label="长期记忆检索开关"
            />
          </div>

          {/* 关闭按钮只给移动端 Sheet。桌面侧栏是常驻的，
              放一个按了没反应的 X 只会让人以为面板坏了。 */}
          {showClose && (
            <ActionTooltip label="关闭">
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-surface-4/40 text-muted-foreground transition-all hover:bg-surface-4 hover:text-foreground active:scale-90"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">关闭</span>
              </button>
            </ActionTooltip>
          )}
        </div>
      </div>

      {/* ── 记忆条目 ── */}
      <ScrollArea className="flex-1 px-4 py-3.5">
        <div className="space-y-3 pb-4">
          {!memoryEnabled ? (
            <Panel tone="muted" className="border-transparent p-5 text-center">
              <EmptyState
                className="py-0"
                icon={Brain}
                title="长期记忆检索已暂停"
                description="当前对话不会自动参考或写入偏好事实。可在右上角开关中随时重新开启。"
              />
            </Panel>
          ) : normalized.length === 0 ? (
            <Panel tone="muted" className="border-transparent p-5">
              <EmptyState
                className="py-0"
                icon={Sparkles}
                iconClassName="text-primary/70"
                title="暂无关联记忆召回"
                description="向助理提供关于你的个人偏好、工作背景或习惯后，系统将自动提炼并在此即时呈现。"
              />
            </Panel>
          ) : (
            <>
              <Panel tone="muted" className="flex items-start gap-2.5 border-success/20 bg-success/[0.06] p-3 text-[12px] leading-relaxed text-foreground/80">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <div>
                  <span className="font-semibold text-foreground">背景语义召回：</span>
                  <span>以下为系统在本次交流中自动参考的长期个人事实。</span>
                </div>
              </Panel>

              <div className="space-y-2.5 pt-0.5">
                {normalized.map((m) => (
                  <Panel
                    key={m.id}
                    tone="muted"
                    className="space-y-2 p-3.5"
                  >
                    <p className="break-words text-[13px] font-normal leading-relaxed text-foreground/90">
                      {m.text}
                    </p>
                    {m.effectiveAt && (
                      <div className="flex items-center justify-between border-t border-border/40 pt-2 font-mono text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0 opacity-70" />
                          <span>{formatDateTime(m.effectiveAt)}</span>
                        </div>
                        <span className="rounded-md bg-surface-4/50 px-1.5 py-px text-[10px]">
                          已向量化
                        </span>
                      </div>
                    )}
                  </Panel>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* ── 底部：前往记忆库 ── */}
      <div className="shrink-0 border-t border-border/50 bg-background/70 p-3.5 pb-[max(0.75rem,var(--sab))] backdrop-blur-md">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (onSelectMobileTab) {
              onSelectMobileTab("memory");
              onClose?.();
            }
          }}
          asChild={!onSelectMobileTab}
          className="h-8 w-full cursor-pointer rounded-full border-border/50 bg-surface-4/50 text-xs font-semibold text-foreground shadow-none transition-colors hover:bg-surface-4 active:scale-95"
        >
          {onSelectMobileTab ? (
            <span className="flex items-center justify-center gap-1.5">
              <span>前往长期记忆库管理全部</span>
              <ExternalLink className="h-3 w-3" />
            </span>
          ) : (
            <Link href="/memory" onClick={onClose} className="flex items-center justify-center gap-1.5">
              <span>前往长期记忆库管理全部</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Memory Sidebar (>= md).
          可见性由 isOpen 驱动，与移动端 Sheet 共用同一个开关。

          此前这里是**无条件** `hidden md:flex md:w-72`：桌面端永远吃掉 288px，
          768px 屏时聊天区只剩 224px。而唯一的开关（ChatHeader 里那个按钮）
          带着 `md:hidden`，父级又是 `hidden md:flex` —— 藏在不可见的父级里，
          于是它在任何宽度都点不到，isMemoryOpen 永远变不成 true，
          这个侧栏也就永远关不掉。两侧断点互补，用同一个 isOpen 即可。 */}
      {/* Desktop Memory Sidebar (>= md)
          **常驻显示**，与左侧会话侧栏对称 —— 桌面端不存在「打开/关闭关联记忆」
          这个概念，所以 isOpen 不参与这里的显隐，只驱动下方的移动端 Sheet。

          此前这里挂着 `!isOpen && "md:hidden"`，需要点顶部工具栏的 Brain 按钮
          才会出现；那与左侧历史记录常驻的交互不一致，也会让人误以为桌面端
          缺一块功能。对应地，DesktopChatHeader 里的那个 Brain 按钮也一并去掉了
          （它控制的东西在桌面端已经不存在）。 */}
      <aside className="hidden h-full w-[var(--sidebar-w)] shrink-0 flex-col border-l border-border/70 bg-surface-1 md:flex lg:w-[var(--sidebar-w-lg)]">
        {/* 桌面端没有关闭按钮可给：常驻侧栏不可关 */}
        {renderMemoryContent({ showClose: false })}
      </aside>

      {/* ── iOS Bottom Sheet (< md)：这一侧才是点击 Brain 弹出来的 ── */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[82vh] h-[78vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[24px] border-t border-border/50 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl [&>button]:hidden"
        >
          <div className="flex shrink-0 justify-center pb-0.5 pt-2.5">
            <div className="h-1 w-9 rounded-full bg-foreground/20" />
          </div>

          <SheetHeader className="sr-only">
            <SheetTitle>本次关联记忆</SheetTitle>
            <SheetDescription>展示系统为本次对话检索到的长期记忆事实</SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col overflow-hidden">
            {renderMemoryContent({ showClose: true })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

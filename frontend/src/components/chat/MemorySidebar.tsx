"use client";

import React, { useMemo } from "react";
import { Brain, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/common/EmptyState";
import { MemoryCard } from "@/components/memory/MemoryCard";
import { normalizeMemories } from "@/lib/memory";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
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
  isDesktopOpen?: boolean;
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
  isDesktopOpen = true,
  onClose,
  onSelectMobileTab,
}: MemorySidebarProps) {
  const { t, fmt } = useI18n();
  const normalized = useMemo(
    () => normalizeMemories(memories ?? [], { sort: true }),
    [memories]
  );

  /**
   * 面板内容。桌面侧栏与移动端抽屉共用同一份 DOM。
   *
   * 抽屉不提供关闭按钮：底部抽屉的约定是「点遮罩关闭 / 下拉关闭」，右上角
   * 再挂一个 X 与系统行为重复，且它此前还因为 Sheet 自带的 Close 按钮
   * 被 `[&>button]:hidden` 一并隐藏，等于一个点了没反应的死按钮。
   *
   * bottomInset：抽屉贴底，需要让开 iOS home indicator；桌面侧栏不需要。
   */
  const renderMemoryContent = ({ bottomInset }: { bottomInset: boolean }) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[var(--toolbar-h)] shrink-0 items-center gap-2 border-b border-border/40 px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Brain className="h-4 w-4" />
        </div>

        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {t("chat.recall.title")}
          </h3>
          {normalized.length > 0 && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground/75">
              {normalized.length}
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2.5">
        {!memoryEnabled ? (
          <EmptyState
            className="py-8"
            icon={Brain}
            title={t("chat.recall.disabledTitle")}
            description={t("chat.recall.disabledDesc")}
          />
        ) : normalized.length === 0 ? (
          <EmptyState
            className="py-8"
            icon={Sparkles}
            title={t("chat.recall.emptyTitle")}
            description={t("chat.recall.emptyDesc")}
          />
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 px-1 py-0.5 text-xs leading-relaxed text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{t("chat.recall.disclaimer")}</span>
            </div>

            {normalized.map((m) => (
              <MemoryCard
                key={m.id}
                text={m.text}
                time={fmt.dateTime(m.effectiveAt)}
                badge={t("chat.recall.vectorized")}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className={[
          "shrink-0 space-y-1 border-t border-border/50 bg-background/60 px-2.5 py-2",
          bottomInset ? "pb-[max(0.5rem,var(--sab))]" : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1">
          <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">
            {t("chat.recall.toggleLabel")}
          </span>
          <Switch
            checked={memoryEnabled}
            onCheckedChange={onToggleMemory}
            aria-label={t("chat.recall.toggleAria")}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (onSelectMobileTab) {
              onSelectMobileTab("memory");
              onClose?.();
            }
          }}
          asChild={!onSelectMobileTab}
          className="h-8 w-full cursor-pointer text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {onSelectMobileTab ? (
            <span className="flex items-center justify-center gap-1.5">
              <span>{t("chat.recall.gotoLibrary")}</span>
              <ExternalLink className="h-4 w-4" />
            </span>
          ) : (
            <Link href="/memory" onClick={onClose} className="flex items-center justify-center gap-1.5">
              <span>{t("chat.recall.gotoLibrary")}</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden h-full w-[var(--sidebar-w)] shrink-0 flex-col border-l border-border/70 bg-surface-1 md:flex lg:w-[var(--sidebar-w-lg)] transition-all duration-200",
          !isDesktopOpen && "md:hidden"
        )}
      >
        {renderMemoryContent({ bottomInset: false })}
      </aside>

      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent
          side="bottom"
          className="flex h-[78vh] max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[24px] border-t border-border/50 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl sm:mx-auto sm:max-w-xl [&>button]:hidden"
        >
          <div className="flex shrink-0 justify-center pb-0.5 pt-2.5">
            <div className="h-1 w-9 rounded-full bg-foreground/20" />
          </div>

          <SheetHeader className="sr-only">
            <SheetTitle>{t("chat.recall.sheetTitle")}</SheetTitle>
            <SheetDescription>{t("chat.recall.sheetDesc")}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {renderMemoryContent({ bottomInset: true })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
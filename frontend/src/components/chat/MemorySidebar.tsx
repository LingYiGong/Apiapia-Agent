"use client";

import React, { useMemo } from "react";
import { Brain, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/common/EmptyState";
import { MemoryCard } from "@/components/memory/MemoryCard";
import { normalizeMemories } from "@/lib/memory";
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
      {/* ── 头部 ──
          视觉规格对齐 <Panel> 的 SectionHeader：h-8 rounded-xl
          bg-primary/10 text-primary 的图标方块 + text-sm 标题。
          此前的实心绿块（bg-success text-white）+ 7px 圆角 + 16/17px 标题
          在全站独一份，而且在 256px 栏宽下 17px 标题会把「本次关联记忆」
          挤到 truncate。 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2.5">
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

      {/* ── 记忆条目 ──
          原生滚动容器，与左侧 <Sidebar> 一致。此前这里是 Radix <ScrollArea>：
          左右两个对称的侧栏用了两套滚动实现，而全局的 ::-webkit-scrollbar
          定制只对原生滚动生效，两者并存会出现双层滚动条。 */}
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

      {/* ── 底部：前往记忆库 ──
          检索开关此前挤在头部右侧，是一个 bg-surface-4/50 的圆角胶囊包着
          「检索开启」+ Switch，在 256px 栏里占掉近 90px 并把标题挤到 truncate；
          底部那条按钮则被写成「前往长期记忆库管理全部」，比移动端长一截。
          现在头部只留标题 + 关闭，检索开关移到底部与「前往记忆库」并列 ——
          设置页里同一个开关也是「左文字 / 右开关」的分隔行，不用胶囊底色。 */}
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
      {/* 桌面端常驻记忆侧栏（>= md），与左侧 <Sidebar> 完全对称：
          同样的 border-l/bg-surface-1、同样的 --sidebar-w / --sidebar-w-lg、
          同样的原生滚动容器、同样的 border-b/border-t 头尾分隔线。

          历史沿革：这里曾挂着 `!isOpen && "md:hidden"`，需要点顶部工具栏的
          Brain 按钮才出现；那与左侧历史侧栏常驻的交互不一致。后来该按钮被
          移进一个 `hidden md:hidden` 的父级里，在任何宽度都点不到，于是
          这个侧栏既关不掉也开不了。现在桌面端不再有开关，直接常驻，
          isOpen 只驱动下方的移动端抽屉。 */}
      <aside className="hidden h-full w-[var(--sidebar-w)] shrink-0 flex-col border-l border-border/70 bg-surface-1 md:flex lg:w-[var(--sidebar-w-lg)]">
        {renderMemoryContent({ bottomInset: false })}
      </aside>

      {/* ── 移动端底部抽屉（< md）：这一侧才是点 Brain 弹出来的 ──
          max-h 与 h 的关系此前写反（h-[78vh] 配 max-h-[82vh]，后者永不生效）；
          mx-auto max-w-xl 也被无差别地套在了手机上，导致手机通栏被限宽。 */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent
          side="bottom"
          className="flex h-[78vh] max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[24px] border-t border-border/50 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl sm:mx-auto sm:max-w-xl [&>button]:hidden"
        >
          {/* 拖拽指示条 */}
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
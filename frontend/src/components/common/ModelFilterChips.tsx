"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { ModelFilterBlock, ModelFilterGroup } from "@/components/common/modelFilterGroups";

interface ModelFilterChipsProps {
  blocks: readonly ModelFilterBlock[];
  /** 当前生效的分组 key；null 表示不过滤（显示全量） */
  activeKey: string | null;
  /**
   * 是否允许高亮当前分组。
   *
   * 用户输入搜索词时列表会跨全部分组查找，此时若还把某个分组高亮成「当前」，
   * 用户会误以为结果被限制在那一类里 —— 直接不高亮。
   */
  highlightEnabled: boolean;
  /** 分组标题的无障碍名称所需，例如「语言模型」 */
  kindLabel: string;
  onSelect: (key: string) => void;
}

/**
 * 分组筛选区：**一行**胶囊。
 *
 * ── 为什么是单行 ──────────────────────────────────────────────────
 * 旧实现把 7 个分组竖着排成一列，带区块标题和分隔线，实测约 335px 高，
 * 在手机上正好塞进 `38dvh` 装不下，用户每次开面板**先要在分类区里滚一次**
 * 才够得着「全部」。而它下面才是真正用来挑模型的列表，却只分到同样多的高度。
 * 两块各占一屏、且都是滚动区 —— 嵌套滚动在触摸设备上是最难受的交互。
 *
 * 现在压成一行，纵向只花 32px，省下的高度全部让给下面的模型列表，
 * 并且**整个面板只剩下方 listbox 一个滚动区**。
 *
 * ── 单行在不同宽度下用两种排布 ────────────────────────────────────
 * - `< md`（手机，纵向空间最紧张）：横向可滚动的一行，也就是常见的
 *   chip rail。高度恒为一行，`snap-mandatory` 让它一颗一颗地对齐，停在哪
 *   都不会半颗悬在边上。
 * - `>= md`（桌面浮层，横向有 560px 但纵向不紧张）：换回 `flex-wrap`。
 *   7 颗胶囊约 800px，桌面必然要换行；这时纵向本来就宽裕，没理由再让用户
 *   去横向拖。隐藏滚动条 + 横向滚动在桌面等于「滚不到」，所以按宽度分开。
 *
 * ── 为什么取消分组的配色 ──────────────────────────────────────────
 * 见 modelFilterGroups.ts 顶部：多色编码会暗示各分组是同类的可比选项，
 * 而它们量的不是同一件事。现在选中态只有一种（主色实心），其余一律中性灰。
 * 「免费」这类信息由模型行上的免费徽章和价格档承担，不必在筛选器上再喊一遍。
 *
 * 仍然按 section 分块，块与块之间插一根细竖线：这样「推荐」「按场景的那几
 * 档」「全部」在视觉上是三种不同的东西，不会被读成一串同类选项 —— 这正是
 * 去掉配色之后剩下的那条「不科学」线索。竖线是纯装饰，标了 aria-hidden。
 *
 * `aria-pressed` 而非 `aria-expanded`：这是切换筛选的 toggle，下面的 listbox
 * 一直都在，从来没被隐藏过，用 aria-expanded 是错的语义。
 * 旧实现右端那个旋转 90° 的 ChevronRight 同理被删掉了 —— 它暗示有层级展开，
 * 实际并不存在，点下去只是换一批结果。
 */
export function ModelFilterChips({
  blocks,
  activeKey,
  highlightEnabled,
  kindLabel,
  onSelect,
}: ModelFilterChipsProps) {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);

  // 打开面板时把当前分组滚进可视区。一行放不下 7 颗胶囊，上次选中「全部」
  // （最右）的话，重新打开时它多半在屏幕外，用户会以为自己的选择丢了。
  // inline:"nearest" 保证只在横向滚动，且只在选中项真的不可见时才动。
  useEffect(() => {
    const active = rowRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeKey]);

  if (blocks.length === 0) return null;

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={t("settings.picker.filterGroupAria", { kind: kindLabel })}
      className="flex shrink-0 snap-x snap-mandatory items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:snap-none md:flex-wrap md:overflow-x-visible"
    >
      {blocks.map((block, blockIdx) => (
        <React.Fragment key={block.id}>
          {blockIdx > 0 && (
            <span aria-hidden="true" className="h-4 w-px shrink-0 rounded-full bg-border/70" />
          )}
          {block.groups.map((group) => (
            <FilterChip
              key={group.key}
              group={group}
              isOn={highlightEnabled && activeKey === group.key}
              onSelect={onSelect}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function FilterChip({
  group,
  isOn,
  onSelect,
}: {
  group: ModelFilterGroup;
  isOn: boolean;
  onSelect: (key: string) => void;
}) {
  const Icon = group.icon;

  return (
    <button
      type="button"
      aria-pressed={isOn}
      // 胶囊是原生 button，鼠标点它会把焦点从搜索框抢走 —— 而
      // ↑↓/Home/End/Enter 全绑在搜索框上，抢走就等于键盘操作全废。
      // preventDefault 掉 pointerdown 的默认焦点转移即可留在原地。
      // touch 必须放行：移动端点分类本来就不该弹软键盘。
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") e.preventDefault();
      }}
      onClick={() => onSelect(group.key)}
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1.5 rounded-full border px-2.5 text-footnote transition-all active:scale-95",
        isOn
          ? "border-transparent bg-primary font-semibold text-primary-foreground"
          : "border-border/60 bg-surface-3/40 font-medium text-muted-foreground hover:bg-surface-3/70 hover:text-foreground"
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />}
      <span className="max-w-[9rem] whitespace-nowrap">{group.label}</span>
      <span className="font-mono text-xs opacity-70">{group.distinctCount ?? group.count}</span>
    </button>
  );
}

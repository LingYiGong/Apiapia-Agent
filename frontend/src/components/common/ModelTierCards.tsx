"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { ModelFilterGroup } from "@/components/common/modelFilterGroups";

interface ModelTierCardsProps {
  groups: readonly ModelFilterGroup[];
  /** 当前生效的等级 key；null 表示未选择 */
  activeKey: string | null;
  /** 无障碍名称前缀，例如「语言模型」 */
  kindLabel: string;
  onSelect: (key: string) => void;
}

/**
 * 模型选择器的等级卡片：免费 / 正常 / 聪明 / 自定义。
 *
 * ── 为什么不是一行胶囊 ────────────────────────────────────────────
 * 等级是打开面板后的第一层决策，用户需要先知道「这一档贵不贵、适合干什么」。
 * 单行胶囊只放得下名字，解释文案没有地方落；所以改成 2×2 卡片：标题 + 数量
 * 一行，下面一行小字说明。四张卡片刚好两行，不会把下面的模型列表挤没。
 *
 * ── 交互 ──────────────────────────────────────────────────────────
 * 卡片只切换筛选，下面的 listbox 一直都在，从未隐藏，因此用
 * `aria-pressed` 而不是 `aria-expanded`。鼠标点击时阻止 pointerdown 抢走
 * 搜索框焦点（↑↓/Home/End/Enter 都绑在搜索框上），触摸则放行以免弹软键盘。
 */
export function ModelTierCards({
  groups,
  activeKey,
  kindLabel,
  onSelect,
}: ModelTierCardsProps) {
  const { t } = useI18n();

  if (groups.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t("settings.picker.tierGroupAria", { kind: kindLabel })}
      className="grid grid-cols-2 gap-1.5"
    >
      {groups.map((group) => {
        const Icon = group.icon;
        const isOn = activeKey === group.key;

        return (
          <button
            key={group.key}
            type="button"
            aria-pressed={isOn}
            onPointerDown={(e) => {
              if (e.pointerType !== "touch") e.preventDefault();
            }}
            onClick={() => onSelect(group.key)}
            className={cn(
              "flex min-h-[64px] cursor-pointer flex-col rounded-xl border px-2.5 py-2 text-left transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isOn
                ? "border-primary/40 bg-primary/10 shadow-xs"
                : "border-border/60 bg-surface-3/30 hover:bg-surface-3/60"
            )}
          >
            <span className="flex w-full items-center gap-1.5">
              {Icon && (
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isOn ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "text-xs font-semibold",
                  isOn ? "text-primary" : "text-foreground"
                )}
              >
                {group.label}
              </span>
              <span className="ml-auto font-mono text-[10px] font-semibold text-muted-foreground">
                {group.distinctCount ?? group.count}
              </span>
            </span>

            {group.description && (
              <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {group.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ModelTierCards;

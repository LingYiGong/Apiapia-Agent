"use client";

import React from "react";
import {
  Brain,
  Code,
  Eye,
  PenLine,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n";
import type { PriceTier, UseCaseKey } from "@/lib/modelGuide";

/**
 * 模型画像的展示件：需求标签与价格档徽章。
 *
 * 三处用到同一批小徽章 —— ModelPicker 的选项行、ModelSelect 的分组筛选按钮、
 * 设置页的推荐卡片 —— 所以图标映射和配色只在这里定义一次。组件本身不含任何
 * 判定逻辑：拿不到 useCases / priceTier 时就什么都不渲染，绝不猜。
 */

export const USE_CASE_ICONS: Record<UseCaseKey, LucideIcon> = {
  writing: PenLine,
  reasoning: Brain,
  coding: Code,
  visionDocs: Eye,
  fastFree: Zap,
};

/** 需求标签的文案键。导出给 ModelSelect 拼分组筛选按钮时用。 */
export const USE_CASE_LABEL_KEYS: Record<UseCaseKey, MessageKey> = {
  writing: "settings.modelGuide.useCase.writing",
  reasoning: "settings.modelGuide.useCase.reasoning",
  coding: "settings.modelGuide.useCase.coding",
  visionDocs: "settings.modelGuide.useCase.visionDocs",
  fastFree: "settings.modelGuide.useCase.fastFree",
};

const PRICE_LABEL_KEYS: Record<PriceTier, MessageKey> = {
  free: "settings.modelGuide.price.free",
  budget: "settings.modelGuide.price.budget",
  standard: "settings.modelGuide.price.standard",
  premium: "settings.modelGuide.price.premium",
};

/**
 * 价格档配色。故意用四档一眼可辨的颜色：用户在列表里横向扫过去时，
 * 「贵不贵」比「叫什么名字」先决定要不要点开。
 */
const PRICE_CLASS: Record<PriceTier, string> = {
  free: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  budget: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  standard: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  premium: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
};

/** 价格档徽章。 */
export function ModelPriceTag({ tier, className }: { tier: PriceTier; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        PRICE_CLASS[tier],
        className
      )}
    >
      {t(PRICE_LABEL_KEYS[tier])}
    </span>
  );
}

/**
 * 需求标签行。
 *
 * `max` 用来在窄容器（选项行、卡片头）里截断 —— 命中 2~3 个需求的模型最常见，
 * 全排出来会把模型名挤没。截断只影响展示，不影响筛选结果。
 */
export function ModelUseCaseTags({
  useCases,
  max = 3,
  className,
}: {
  useCases: readonly UseCaseKey[];
  max?: number;
  className?: string;
}) {
  const { t } = useI18n();
  if (useCases.length === 0) return null;

  return (
    <span className={cn("flex shrink-0 flex-wrap items-center gap-1", className)}>
      {useCases.slice(0, max).map((key) => {
        const Icon = USE_CASE_ICONS[key];
        return (
          <span
            key={key}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-border/50 bg-surface-3/70 px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {t(USE_CASE_LABEL_KEYS[key])}
          </span>
        );
      })}
    </span>
  );
}
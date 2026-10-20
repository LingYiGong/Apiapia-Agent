"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n";
import type { PriceTier } from "@/lib/modelGuide";
import type { ModelPricing } from "@/types";

/**
 * 模型画像的展示件：价格徽章。
 *
 * 价格分两层：目录里带精确价（OpenRouter 的每 token 美元价）时显示
 * 「输入 / 输出 每百万 token」；没有精确价时才退回画像表的粗价格档。
 * 两层都拿不到就什么都不渲染，绝不猜。
 */

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

/** 把厂商的「每 token 美元」价格换算成「每百万 token」并保留最多 4 位小数。 */
function perMillion(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 1_000_000 * 10_000) / 10_000;
}

function formatUsd(value: number): string {
  return String(value);
}

/** 有精确价格时优先显示「输入 / 输出 每百万 token」；没有则回退到价格档。 */
export function ModelPriceTag({
  tier,
  pricing,
  isFree = false,
  className,
}: {
  tier?: PriceTier;
  pricing?: ModelPricing;
  /** 目录标记为免费；没有价格数据时也能显示「免费」。 */
  isFree?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const prompt = perMillion(pricing?.prompt);
  const completion = perMillion(pricing?.completion);
  const hasExactPrice = prompt !== null || completion !== null;
  const pricedAsFree = prompt === 0 && completion === 0;
  const showFree = isFree || pricedAsFree;
  const exactLabel =
    hasExactPrice && !pricedAsFree
      ? `${[prompt, completion]
          .filter((value): value is number => value !== null)
          .map((value) => `$${formatUsd(value)}`)
          .join(" / ")} /M`
      : null;
  const label = showFree
    ? t("settings.modelGuide.price.free")
    : (exactLabel ?? (tier ? t(PRICE_LABEL_KEYS[tier]) : null));

  if (!label) return null;

  const colorTier = showFree ? "free" : tier;

  return (
    <span
      title={hasExactPrice && !showFree ? t("settings.modelGuide.price.perMillion") : undefined}
      className={cn(
        "shrink-0 rounded-lg border px-2 py-0.5 font-mono text-xs font-semibold",
        colorTier ? PRICE_CLASS[colorTier] : "border-border/50 bg-surface-3/70 text-muted-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}

"use client";

import React from "react";
import { type LucideIcon, RefreshCw, Server, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { notifyModelSyncResult } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n";

/**
 * 「同步列表」按钮。
 *
 * 设置页的语言、绘图、视频与语音模型各有一个此前逐字相同的按钮，只差 handler
 * 与文案。现在只有这一份。
 */

/** 四类模型各自的小标文案键 —— 与 notifyModelSyncResult 的 scope 用同一组词。 */
const SYNC_SCOPE_LABEL_KEY = {
  language: "settings.modelGroup.language",
  image: "settings.modelGroup.image",
  video: "settings.modelGroup.video",
  speech: "settings.modelGroup.speech",
} as const satisfies Record<string, MessageKey>;

export type SyncModelsScope = keyof typeof SYNC_SCOPE_LABEL_KEY;

export function SyncModelsButton({
  onSync,
  syncing,
  scope,
  className,
}: {
  onSync: () => void;
  syncing: boolean;
  /** 语言模型 / 绘图模型 / 视频模型 / 语音模型，文案走 settings.modelGroup.* */
  scope: SyncModelsScope;
  className?: string;
}) {
  const { t } = useI18n();
  const scopeLabel = t(SYNC_SCOPE_LABEL_KEY[scope]);

  return (
    <ActionTooltip label={t("settings.sync.tooltip", { scope: scopeLabel })}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onSync}
        disabled={syncing}
        className={cn(
          "ml-auto h-7 shrink-0 cursor-pointer gap-1.5 rounded-lg border-border/50 bg-surface-3/30 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-3 active:scale-95",
          className
        )}
      >
        <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin text-primary")} />
        <span className="hidden sm:inline">
          {syncing ? t("settings.sync.syncing") : t("settings.sync.label")}
        </span>
        <span className="sr-only">{t("settings.sync.sr", { scope: scopeLabel })}</span>
      </Button>
    </ActionTooltip>
  );
}

/**
 * 模型详情面板：provider / 计费方式 / 能力徽章 + ID + 描述。
 *
 * 此前设置页里语言模型与绘图模型各有一个结构一致的 IIFE（连 badge 的 className
 * 都抄了一遍），现在共用本组件。
 */
export function ModelInfoPanel({
  model,
  isMultimodal,
  isPaid,
  isFree,
  capabilityLabel,
  capabilityIcon: CapabilityIcon = Sparkles,
  capabilityClassName,
  description,
}: {
  model: { id: string; provider?: string; description?: string };
  /** 是否多模态（语言模型用）；绘图模型传 false */
  isMultimodal?: boolean;
  /** false = 免费模型 */
  isPaid?: boolean;
  isFree?: boolean;
  capabilityLabel?: string;
  capabilityIcon?: LucideIcon;
  capabilityClassName?: string;
  description?: string;
}) {
  const { t } = useI18n();
  // 目录尚未同步时，用户存的只是一个裸 id。照常显示，但明确标出「未在列表中」，
  // 避免用户以为自己选了一个不存在的模型。
  if (!model.id) return null;

  const free = isFree ?? !isPaid;

  return (
    <div className="mt-3 space-y-2.5 border-t border-border/40 pt-3 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center gap-1.5">
        {model.provider && (
          <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-surface-3 px-2 py-0.5 font-mono text-xs font-medium uppercase text-foreground">
            <Server className="h-3 w-3 text-muted-foreground" />
            <span>{model.provider}</span>
          </span>
        )}

        {free ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Zap className="h-3 w-3" />
            <span>{t("settings.modelBadges.freeModel")}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <span>{t("settings.modelBadges.paidModel")}</span>
          </span>
        )}

        {capabilityLabel ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400",
              capabilityClassName
            )}
          >
            <CapabilityIcon className="h-3 w-3" />
            <span>{capabilityLabel}</span>
          </span>
        ) : isMultimodal === false ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-surface-3/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {t("settings.modelBadges.textOnly")}
          </span>
        ) : null}

        <span className="truncate font-mono text-xs text-muted-foreground/70 sm:ml-auto select-all">
          {t("settings.modelBadges.idPrefix", { id: model.id })}
        </span>
      </div>

      {(description ?? model.description) && (
        <div className="rounded-xl border border-border/40 bg-surface-3/30 p-2.5 text-xs leading-relaxed text-muted-foreground">
          {description ?? model.description}
        </div>
      )}
    </div>
  );
}

/**
 * 「该模型不在已同步列表中」的提示行。
 * 与 <ModelInfoPanel> 互斥：没有匹配项时显示这一行。
 */
export function ModelMissingNotice({ id }: { id: string }) {
  const { t } = useI18n();
  if (!id) return null;
  return (
    <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2.5 font-mono text-xs text-muted-foreground">
      <span className="truncate">{t("settings.modelBadges.missingId", { id })}</span>
      <span className="shrink-0 font-sans text-xs text-amber-500">
        {t("settings.modelBadges.notSynced")}
      </span>
    </div>
  );
}

export { notifyModelSyncResult };

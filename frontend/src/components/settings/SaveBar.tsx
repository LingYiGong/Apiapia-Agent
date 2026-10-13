"use client";

import React from "react";
import { Check, CheckCircle2, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

/**
 * 偏好设置的「保存」控件。
 *
 * 此前同一件事在设置页里存在**三份**：桌面头部一套、移动端子栏一套、底部浮动
 * 玻璃条一套，className 几乎逐字相同，而且桌面端会**同时**出现头部按钮和浮动
 * 条（两者都由同一个 isDirty 控制）—— 同一屏两个保存入口。
 *
 * 现在职责清晰分开：
 *   - <SaveStatus>   桌面头部（md+）：状态文案 + 还原 + 保存
 *   - <SaveActionBar> 仅 < md：底部浮动玻璃条
 * 二者由调用方按断点二选一渲染，不再同时出现。
 */

export interface SaveState {
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
}

export function SaveStatus({
  state,
  onReset,
  onSave,
}: {
  state: SaveState;
  onReset: () => void;
  onSave: () => void;
}) {
  const { dirty, saving, justSaved } = state;
  const { t } = useI18n();

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {justSaved ? (
        <span className="flex items-center gap-1.5 text-footnote font-medium text-emerald-600 animate-in fade-in dark:text-emerald-400">
          <Check className="h-4 w-4" />
          <span>{t("settings.saveBar.saved")}</span>
        </span>
      ) : dirty ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            <span>{t("settings.saveBar.dirty")}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 cursor-pointer rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            <span>{t("settings.saveBar.reset")}</span>
          </Button>
        </div>
      ) : (
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>{t("settings.saveBar.clean")}</span>
        </span>
      )}

      <SaveButton state={state} onSave={onSave} />
    </div>
  );
}

function SaveButton({
  state,
  onSave,
  size = "sm",
  className,
}: {
  state: SaveState;
  onSave: () => void;
  size?: "sm" | "xs";
  className?: string;
}) {
  const { dirty, saving, justSaved } = state;
  const { t } = useI18n();
  const isXs = size === "xs";

  return (
    <ActionTooltip label={t("settings.saveBar.tip")}>
      <Button
        type="button"
        onClick={onSave}
        // 已保存过的那一刻（justSaved）仍允许再次点击，避免用户看不到「已保存」
        // 就以为按钮坏了
        disabled={saving || (!dirty && !justSaved)}
        size="sm"
        className={cn(
          "cursor-pointer gap-1.5 rounded-full font-semibold shadow-2xs transition-colors active:scale-95",
          isXs ? "h-7 px-3.5 text-xs" : "h-8 px-4 text-xs",
          dirty || justSaved
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-surface-3 text-muted-foreground hover:bg-surface-3",
          className
        )}
      >
        {saving ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        <span>
          {saving
            ? isXs
              ? t("settings.saveBar.savingShort")
              : t("settings.saveBar.savingLong")
            : t("settings.saveBar.save")}
        </span>
        <kbd className="ml-0.5 hidden font-sans text-2xs opacity-70 sm:inline-block">⌘S</kbd>
      </Button>
    </ActionTooltip>
  );
}

/**
 * 移动端底部浮动保存条。避开 MobileTabBar（--tabbar-h + --sab）。
 * 仅在 isMobileSpa 视图里需要考虑底栏；独立路由也会渲染 MobileTabBar。
 */
export function SaveActionBar({
  state,
  onReset,
  onSave,
  className,
}: {
  state: SaveState;
  onReset: () => void;
  onSave: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  if (!state.dirty) return null;
  return (
    <div
      className={cn(
        "absolute bottom-[calc(var(--tabbar-h)+var(--sab)+12px)] left-1/2 z-40 w-[92%] max-w-lg -translate-x-1/2 animate-in fade-in slide-in-from-bottom-3 duration-200 md:bottom-5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 rounded-full border border-border/60 bg-card/90 p-2 shadow-xl backdrop-blur-2xl sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2 pl-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="text-xs font-medium text-foreground sm:text-footnote">
            {t("settings.saveBar.mobileNotice")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 cursor-pointer rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
          >
            {t("settings.saveBar.reset")}
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={state.saving}
            size="sm"
            className="h-8 cursor-pointer gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90 active:scale-95"
          >
            {state.saving ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>
              {state.saving ? t("settings.saveBar.savingLong") : t("settings.saveBar.save")}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

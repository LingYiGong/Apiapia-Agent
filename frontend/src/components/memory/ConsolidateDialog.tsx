"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Trash2,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConsolidationPlan, ConsolidationPreviewResponse } from "@/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface ConsolidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: ConsolidationPreviewResponse | null;
  isAnalyzing: boolean;
  isApplying: boolean;
  onApply: (approvedPlan: ConsolidationPlan) => void;
  onRetry?: (modelOverride?: string) => void;
  totalMemoriesCount?: number;
}

export function ConsolidateDialog({
  open,
  onOpenChange,
  previewData,
  isAnalyzing,
  isApplying,
  onApply,
  onRetry,
  totalMemoriesCount = 0,
}: ConsolidateDialogProps) {
  const { t } = useI18n();
  const plan = previewData?.plan;

  const [selectedDeletes, setSelectedDeletes] = useState<Set<string>>(new Set());
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [selectedAdds, setSelectedAdds] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState(0);

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case "identity":
      case "profile":
        return t("memory.consolidation.categories.identity");
      case "skills":
      case "skill":
        return t("memory.consolidation.categories.skills");
      case "preferences":
      case "preference":
        return t("memory.consolidation.categories.preferences");
      case "projects":
      case "project":
        return t("memory.consolidation.categories.projects");
      case "facts":
      case "fact":
      default:
        return t("memory.consolidation.categories.facts");
    }
  };

  const consolidationStages = useMemo(
    () => [
      {
        title: t("memory.consolidation.stage0Title"),
        desc: t("memory.consolidation.stage0Desc"),
      },
      {
        title: t("memory.consolidation.stage1Title"),
        desc: t("memory.consolidation.stage1Desc"),
      },
      {
        title: t("memory.consolidation.stage2Title"),
        desc: t("memory.consolidation.stage2Desc"),
      },
    ],
    [t]
  );

  useEffect(() => {
    if (!isAnalyzing) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isAnalyzing]);

  const effectiveCount = totalMemoriesCount || previewData?.total_count || 0;

  // 科学预估总耗时（根据记忆数量基准 + 模型生成开销）：
  // 10 条以内: ~12-18s; 10~30 条: ~18-28s; 30条以上: ~25-40s
  const estimatedTimeRange = useMemo(() => {
    if (effectiveCount <= 10) return { min: 12, max: 18, label: t("memory.consolidation.rangeUnder10") };
    if (effectiveCount <= 30) return { min: 18, max: 28, label: t("memory.consolidation.rangeUnder30") };
    return { min: 25, max: 40, label: t("memory.consolidation.rangeOver30") };
  }, [effectiveCount, t]);

  const targetEstimated = estimatedTimeRange.max;

  // 阶段推进真实感：
  // 0~2s: 阶段 0 执行中（读取与构建索引，秒级完成）
  // >=3s: 阶段 0 已完成，阶段 1 执行中（大模型全局研读，核心耗时）
  // 阶段 2 (安全校验与生成草案) 只在返回数据后瞬间完成，避免阶段 2 假死挂起引起用户焦虑
  const currentStageIndex = useMemo(() => {
    if (elapsed < 3) return 0;
    return 1;
  }, [elapsed]);

  // 随时间推进的动态真实子状态说明（让用户明确感知 AI 正在逐步推进，绝非假死）
  const dynamicSubstatus = useMemo(() => {
    if (elapsed < 3) return t("memory.consolidation.substatus0");
    if (elapsed < 10) return t("memory.consolidation.substatus1");
    if (elapsed < 20) return t("memory.consolidation.substatus2");
    if (elapsed < 32) return t("memory.consolidation.substatus3");
    return t("memory.consolidation.substatus4");
  }, [elapsed, t]);

  // 平滑正弦缓动进度条：在预估时间内平滑推进到 86%，超过后渐进微动，绝不卡死也不突跳
  const progressPercent = useMemo(() => {
    if (elapsed <= 2) {
      return Math.round((elapsed / 2) * 15);
    }
    if (elapsed <= targetEstimated) {
      const ratio = (elapsed - 2) / (targetEstimated - 2);
      const eased = Math.sin((ratio * Math.PI) / 2);
      return Math.round(15 + eased * 71);
    }
    const overtime = elapsed - targetEstimated;
    const crawl = 10 * (1 - Math.exp(-overtime / 18));
    return Math.min(96, Math.round(86 + crawl));
  }, [elapsed, targetEstimated]);

  useEffect(() => {
    if (plan) {
      setSelectedDeletes(new Set(plan.to_delete.map((item) => item.id!).filter(Boolean)));
      setSelectedUpdates(new Set(plan.to_update.map((item) => item.id!).filter(Boolean)));
      setSelectedAdds(new Set(plan.to_add.map((_, idx) => idx)));
    }
  }, [plan]);

  const toggleDelete = (id: string) => {
    setSelectedDeletes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleUpdate = (id: string) => {
    setSelectedUpdates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAdd = (index: number) => {
    setSelectedAdds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toAddCount = plan?.to_add?.length ?? 0;
  const toUpdateCount = plan?.to_update?.length ?? 0;
  const toDeleteCount = plan?.to_delete?.length ?? 0;
  const toKeepCount = plan?.to_keep?.length ?? 0;

  // 全选 / 取消全选快捷操作
  const toggleAllAdds = () => {
    if (selectedAdds.size === toAddCount) {
      setSelectedAdds(new Set());
    } else {
      setSelectedAdds(new Set(plan?.to_add?.map((_, idx) => idx) || []));
    }
  };

  const toggleAllUpdates = () => {
    if (selectedUpdates.size === toUpdateCount) {
      setSelectedUpdates(new Set());
    } else {
      setSelectedUpdates(new Set(plan?.to_update?.map((item) => item.id!).filter(Boolean) || []));
    }
  };

  const toggleAllDeletes = () => {
    if (selectedDeletes.size === toDeleteCount) {
      setSelectedDeletes(new Set());
    } else {
      setSelectedDeletes(new Set(plan?.to_delete?.map((item) => item.id!).filter(Boolean) || []));
    }
  };

  const totalSelectedChanges = selectedAdds.size + selectedUpdates.size + selectedDeletes.size;

  const handleConfirm = () => {
    if (!plan) return;
    const approved: ConsolidationPlan = {
      to_delete: plan.to_delete.filter((item) => item.id && selectedDeletes.has(item.id)),
      to_update: plan.to_update.filter((item) => item.id && selectedUpdates.has(item.id)),
      to_add: plan.to_add.filter((_, idx) => selectedAdds.has(idx)),
      to_keep: plan.to_keep || [],
    };
    onApply(approved);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] w-[94vw] max-h-[85vh] flex flex-col rounded-[22px] border border-border/50 bg-background/95 p-5 shadow-2xl backdrop-blur-2xl sm:p-6 overflow-hidden">
        <DialogHeader className="space-y-1.5 text-left shrink-0 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-body font-semibold text-foreground flex items-center gap-2">
                <span>{t("memory.consolidation.dialogTitle")}</span>
                {effectiveCount > 0 && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-normal">
                    {t("memory.consolidation.totalCountBadge", { count: effectiveCount })}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs font-normal leading-normal text-muted-foreground line-clamp-2">
                {isAnalyzing
                  ? t("memory.consolidation.analyzingDesc")
                  : previewData?.summary || t("memory.consolidation.defaultPreviewDesc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="flex-1 min-h-0 flex flex-col justify-center py-3 px-1 sm:px-2 space-y-4">
            {/* 顶栏状态与计时器 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-foreground">{t("memory.consolidation.analyzingTitle")}</h3>
                  <p className="text-xs text-muted-foreground">{t("memory.consolidation.analyzingSubtitle")}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-3/80 border border-border/50 text-xs font-mono text-muted-foreground shadow-2xs">
                <Clock className="h-3.5 w-3.5 animate-spin text-primary" style={{ animationDuration: "3s" }} />
                <span>{t("memory.consolidation.elapsed", { elapsed })}</span>
                <span className="text-border/80">|</span>
                <span className="text-primary font-medium">
                  {elapsed <= targetEstimated ? t("memory.consolidation.estimated", { range: estimatedTimeRange.label }) : t("memory.consolidation.almostDone")}
                </span>
              </div>
            </div>

            {/* 动态平滑进度条 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                <span className="truncate">{dynamicSubstatus}</span>
                <span className="font-mono text-primary font-medium shrink-0 ml-2">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-3/80 rounded-full overflow-hidden border border-border/30">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 3 阶段流转列表 */}
            <div className="space-y-2">
              {consolidationStages.map((stg, i) => {
                const isCompleted = i < currentStageIndex;
                const isCurrent = i === currentStageIndex;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-2.5 p-2.5 rounded-xl border transition-all text-left",
                      isCurrent
                        ? "border-primary/40 bg-primary/5 shadow-2xs"
                        : isCompleted
                        ? "border-emerald-500/20 bg-emerald-500/5 opacity-80"
                        : "border-border/30 bg-surface-2/20 opacity-40"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex items-center justify-center text-2xs leading-none text-muted-foreground font-mono">
                          {i + 1}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            isCurrent
                              ? "text-primary font-semibold"
                              : isCompleted
                              ? "text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {stg.title}
                        </span>
                        {isCurrent && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0 animate-pulse">
                            {t("memory.consolidation.statusRunning")}
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                            {t("memory.consolidation.statusCompleted")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{stg.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 提示告知框 */}
            <div className="rounded-xl border border-border/40 bg-surface-3/30 p-2.5 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">{t("memory.consolidation.whyTakeTimeTitle")} </span>
                {t("memory.consolidation.whyTakeTimeDesc")}
              </div>
            </div>
          </div>
        ) : !plan ? (
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center gap-3 px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="text-sm font-semibold text-foreground">{t("memory.consolidation.errorTitle")}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {previewData?.message || t("memory.consolidation.errorDesc")}
              </p>
            </div>
            {onRetry && (
              <div className="w-full max-w-sm space-y-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onRetry("google/gemma-4-31b-it:free")}
                  className="w-full justify-between h-9 rounded-xl border-border/50 bg-surface-2/60 text-xs font-medium hover:bg-surface-3 transition-colors text-left px-3"
                >
                  <div className="flex items-center min-w-0">
                    <Sparkles className="h-3.5 w-3.5 text-primary mr-2 shrink-0" />
                    <span className="truncate">Google Gemma 4 31B (Free)</span>
                  </div>
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0 ml-2">
                    {t("memory.consolidation.retryRecommendTag")}
                  </span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onRetry("nvidia/nemotron-3-super-120b-a12b:free")}
                  className="w-full justify-between h-9 rounded-xl border-border/50 bg-surface-2/60 text-xs font-medium hover:bg-surface-3 transition-colors text-left px-3"
                >
                  <div className="flex items-center min-w-0">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 mr-2 shrink-0" />
                    <span className="truncate">NVIDIA Nemotron 3 Super (Free)</span>
                  </div>
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 ml-2">
                    {t("memory.consolidation.retryHeavyComputeTag")}
                  </span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onRetry()}
                  className="w-full justify-start h-9 rounded-xl border-border/50 bg-surface-2/60 text-xs font-medium hover:bg-surface-3 transition-colors text-left px-3"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                  <span className="truncate">{t("memory.consolidation.retryDefault")}</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* 顶栏快照安全保护提示 */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 px-3 py-2 rounded-xl mb-2.5 shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="leading-tight">
                <strong className="text-foreground font-medium">{t("memory.consolidation.snapshotSafetyTitle")}</strong>
                {t("memory.consolidation.snapshotSafetyDesc")}
              </span>
            </div>

            <Tabs defaultValue={toAddCount > 0 ? "add" : toUpdateCount > 0 ? "update" : "delete"} className="flex-1 min-h-0 flex flex-col">
              <TabsList className="grid grid-cols-4 w-full h-9 bg-surface-3/50 p-0.5 rounded-xl border border-border/40 shrink-0">
                <TabsTrigger value="add" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  {t("memory.consolidation.tabAdd", { count: toAddCount })}
                </TabsTrigger>
                <TabsTrigger value="update" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  {t("memory.consolidation.tabUpdate", { count: toUpdateCount })}
                </TabsTrigger>
                <TabsTrigger value="delete" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs text-destructive/90">
                  {t("memory.consolidation.tabDelete", { count: toDeleteCount })}
                </TabsTrigger>
                <TabsTrigger value="keep" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  {t("memory.consolidation.tabKeep", { count: toKeepCount })}
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: 提炼新增 */}
              <TabsContent value="add" className="flex-1 min-h-0 overflow-y-auto mt-2.5 pr-1 space-y-2.5">
                <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                  <span>{t("memory.consolidation.tabAddHeader")}</span>
                  {toAddCount > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllAdds}
                      className="text-primary hover:underline font-medium shrink-0 ml-2 cursor-pointer"
                    >
                      {selectedAdds.size === toAddCount ? t("memory.consolidation.unselectAll") : t("memory.consolidation.selectAll")}
                    </button>
                  )}
                </div>
                {toAddCount === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">{t("memory.consolidation.emptyAdd")}</p>
                ) : (
                  plan.to_add.map((item, idx) => {
                    const isChecked = selectedAdds.has(idx);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleAdd(idx)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none text-left",
                          isChecked
                            ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                            : "border-border/30 bg-surface-2/30 opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              {item.category ? getCategoryLabel(item.category) : t("memory.consolidation.badgeCategoryAdd")}
                            </span>
                            {item.reason && (
                              <span className="text-xs text-muted-foreground truncate">{item.reason}</span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-foreground leading-relaxed font-normal">{item.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* Tab 2: 冲突更新 */}
              <TabsContent value="update" className="flex-1 min-h-0 overflow-y-auto mt-2.5 pr-1 space-y-2.5">
                <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                  <span>{t("memory.consolidation.tabUpdateHeader")}</span>
                  {toUpdateCount > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllUpdates}
                      className="text-primary hover:underline font-medium shrink-0 ml-2 cursor-pointer"
                    >
                      {selectedUpdates.size === toUpdateCount ? t("memory.consolidation.unselectAll") : t("memory.consolidation.selectAll")}
                    </button>
                  )}
                </div>
                {toUpdateCount === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">{t("memory.consolidation.emptyUpdate")}</p>
                ) : (
                  plan.to_update.map((item, idx) => {
                    const mid = item.id || `upd-${idx}`;
                    const isChecked = selectedUpdates.has(mid);
                    return (
                      <div
                        key={mid}
                        onClick={() => toggleUpdate(mid)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none text-left",
                          isChecked
                            ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                            : "border-border/30 bg-surface-2/30 opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 h-4 w-4 rounded border-border text-amber-600 focus:ring-amber-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              {item.category ? getCategoryLabel(item.category) : t("memory.consolidation.badgeCategoryUpdate")}
                            </span>
                            {item.reason && (
                              <span className="text-xs text-muted-foreground truncate">{item.reason}</span>
                            )}
                          </div>
                          {item.old_text && (
                            <div className="text-xs text-muted-foreground/80 line-through mb-1 bg-surface-3/40 px-2 py-1 rounded-md">
                              {t("memory.consolidation.oldRecordPrefix")}{item.old_text}
                            </div>
                          )}
                          <p className="text-xs sm:text-sm text-foreground leading-relaxed font-normal">{item.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* Tab 3: 剔除过期 */}
              <TabsContent value="delete" className="flex-1 min-h-0 overflow-y-auto mt-2.5 pr-1 space-y-2.5">
                <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                  <span>{t("memory.consolidation.tabDeleteHeader")}</span>
                  {toDeleteCount > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllDeletes}
                      className="text-primary hover:underline font-medium shrink-0 ml-2 cursor-pointer"
                    >
                      {selectedDeletes.size === toDeleteCount ? t("memory.consolidation.unselectAll") : t("memory.consolidation.selectAll")}
                    </button>
                  )}
                </div>
                {toDeleteCount === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">{t("memory.consolidation.emptyDelete")}</p>
                ) : (
                  plan.to_delete.map((item, idx) => {
                    const mid = item.id || `del-${idx}`;
                    const isChecked = selectedDeletes.has(mid);
                    return (
                      <div
                        key={mid}
                        onClick={() => toggleDelete(mid)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none text-left",
                          isChecked
                            ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                            : "border-border/30 bg-surface-2/30 opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 h-4 w-4 rounded border-border text-destructive focus:ring-destructive shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-destructive/15 text-destructive">
                              {t("memory.consolidation.badgeCategoryDelete")}
                            </span>
                            {item.reason && (
                              <span className="text-xs text-muted-foreground truncate">{item.reason}</span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground line-through leading-relaxed font-normal">
                            {item.text}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* Tab 4: 保持不变 */}
              <TabsContent value="keep" className="flex-1 min-h-0 overflow-y-auto mt-2.5 pr-1 space-y-2.5">
                <div className="px-1 text-xs text-muted-foreground">
                  <span>{t("memory.consolidation.tabKeepHeader")}</span>
                </div>
                {toKeepCount === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">{t("memory.consolidation.emptyKeep")}</p>
                ) : (
                  plan.to_keep.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-border/40 bg-surface-2/30 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface-4 text-muted-foreground">
                          {t("memory.consolidation.badgeCategoryKeep")}
                        </span>
                        {item.reason && <span className="text-xs text-muted-foreground truncate">{item.reason}</span>}
                      </div>
                      <p className="text-xs sm:text-sm text-foreground/85 leading-relaxed font-normal">{item.text}</p>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="flex-row justify-between items-center gap-2 pt-3 border-t border-border/40 shrink-0 sm:space-x-0">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {plan && (
              <span>
                {t("memory.consolidation.summaryFooter")}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium font-mono">
                  {t("memory.consolidation.addCount", { count: selectedAdds.size })}
                </span>{" "}
                ·{" "}
                <span className="text-amber-600 dark:text-amber-400 font-medium font-mono">
                  {t("memory.consolidation.updateCount", { count: selectedUpdates.size })}
                </span>{" "}
                ·{" "}
                <span className="text-destructive font-medium font-mono">
                  {t("memory.consolidation.deleteCount", { count: selectedDeletes.size })}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isApplying}
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl border-border/50 bg-surface-3/30 px-4 text-footnote font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
            >
              {t("memory.consolidation.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isAnalyzing || isApplying || !plan || totalSelectedChanges === 0}
              onClick={handleConfirm}
              className="h-9 rounded-xl bg-primary px-5 text-footnote font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40"
            >
              {isApplying
                ? t("memory.consolidation.btnApplying")
                : totalSelectedChanges === 0
                ? t("memory.consolidation.btnNoSelection")
                : t("memory.consolidation.btnConfirm", { count: totalSelectedChanges })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Sparkles, Trash2, RefreshCw, Plus, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Clock } from "lucide-react";
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

interface ConsolidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: ConsolidationPreviewResponse | null;
  isAnalyzing: boolean;
  isApplying: boolean;
  onApply: (approvedPlan: ConsolidationPlan) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  identity: "核心身份",
  skills: "技能与技术",
  preferences: "习惯偏好",
  projects: "核心项目",
  facts: "背景事实",
};

const CONSOLIDATION_STAGES = [
  {
    title: "读取全量记忆与领域聚类",
    desc: "检索全部记忆数据，按核心身份、技能栈、偏好习惯等模块结构化归集",
  },
  {
    title: "构建时序拓扑与状态矩阵",
    desc: "标记时间先后序列，映射同一主题下新旧状态冲突与版本更迭",
  },
  {
    title: "大模型全局深度推理与综合去噪",
    desc: "调度整理模型全景审视记忆库，辨识时序矛盾、聚合碎片事实并判定过期条目",
  },
  {
    title: "安全熔断校验与生成 Diff 变更草案",
    desc: "核验防误删安全阈值，格式化新增、更新与删除明细供人工审核",
  },
];

export function ConsolidateDialog({
  open,
  onOpenChange,
  previewData,
  isAnalyzing,
  isApplying,
  onApply,
}: ConsolidateDialogProps) {
  const plan = previewData?.plan;

  const [selectedDeletes, setSelectedDeletes] = useState<Set<string>>(new Set());
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [selectedAdds, setSelectedAdds] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState(0);

  // Timer for analyzing progress
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

  const currentStageIndex = useMemo(() => {
    if (elapsed >= 28) return 3;
    if (elapsed >= 11) return 2;
    if (elapsed >= 4) return 1;
    return 0;
  }, [elapsed]);

  const progressPercent = useMemo(() => {
    if (elapsed <= 3) return Math.min(25, Math.round((elapsed / 3) * 25));
    if (elapsed <= 10) return 25 + Math.min(25, Math.round(((elapsed - 3) / 7) * 25));
    if (elapsed <= 28) return 50 + Math.min(38, Math.round(((elapsed - 10) / 18) * 38));
    return Math.min(96, 88 + Math.round((elapsed - 28) * 0.4));
  }, [elapsed]);

  // Reset selections when new plan loads
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

  const toAddCount = plan?.to_add?.length ?? 0;
  const toUpdateCount = plan?.to_update?.length ?? 0;
  const toDeleteCount = plan?.to_delete?.length ?? 0;
  const toKeepCount = plan?.to_keep?.length ?? 0;
  const hasChanges = toAddCount > 0 || toUpdateCount > 0 || toDeleteCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] w-[94vw] max-h-[85vh] flex flex-col rounded-[22px] border border-border/50 bg-background/95 p-5 shadow-2xl backdrop-blur-2xl sm:p-6 overflow-hidden">
        <DialogHeader className="space-y-1.5 text-left shrink-0 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-body font-semibold text-foreground flex items-center gap-2">
                <span>记忆智能整理与脱水</span>
                {previewData?.total_count && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-normal">
                    共 {previewData.total_count} 条已分析
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs font-normal leading-normal text-muted-foreground line-clamp-2">
                {previewData?.summary || "AI 已自动检测时序冲突、淘汰过期工单，并将零散偏好聚合为长效事实。"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="flex-1 min-h-0 flex flex-col justify-center py-4 px-1 sm:px-2 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-foreground">AI 正在全局分析与时序比对</h3>
                  <p className="text-2xs text-muted-foreground">全景审视记忆库，消除冲突并合并碎片</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-3/80 border border-border/50 text-2xs font-mono text-muted-foreground shadow-2xs">
                <Clock className="h-3 w-3 animate-spin text-primary" style={{ animationDuration: "3s" }} />
                <span>已耗时 {elapsed}s</span>
              </div>
            </div>

            {/* 动态进度条 */}
            <div className="space-y-1">
              <div className="h-1.5 w-full bg-surface-3/80 rounded-full overflow-hidden border border-border/30">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 步骤时间线 */}
            <div className="space-y-2">
              {CONSOLIDATION_STAGES.map((stg, i) => {
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
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground font-mono">
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
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium shrink-0 animate-pulse">
                            执行中
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                            已完成
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-muted-foreground mt-0.5 leading-relaxed">{stg.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-border/40 bg-surface-3/30 p-2 text-center">
              <p className="text-2xs text-muted-foreground leading-normal">
                💡 记忆条目较多时，大模型全局推理耗时通常约 15~35 秒，请耐心等待
              </p>
            </div>
          </div>
        ) : !plan ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center gap-2 text-muted-foreground text-sm">
            <AlertTriangle className="h-7 w-7 text-amber-500 mb-1" />
            <p>{previewData?.message || "暂无整理方案生成"}</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <Tabs defaultValue={toAddCount > 0 ? "add" : toUpdateCount > 0 ? "update" : "delete"} className="flex-1 min-h-0 flex flex-col">
              <TabsList className="grid grid-cols-4 w-full h-9 bg-surface-3/50 p-0.5 rounded-xl border border-border/40 shrink-0">
                <TabsTrigger value="add" className="text-2xs sm:text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  提炼新增 ({toAddCount})
                </TabsTrigger>
                <TabsTrigger value="update" className="text-2xs sm:text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  冲突更新 ({toUpdateCount})
                </TabsTrigger>
                <TabsTrigger value="delete" className="text-2xs sm:text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs text-destructive/90">
                  剔除过期 ({toDeleteCount})
                </TabsTrigger>
                <TabsTrigger value="keep" className="text-2xs sm:text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  保持不变 ({toKeepCount})
                </TabsTrigger>
              </TabsList>

              {/* 提炼新增 */}
              <TabsContent value="add" className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1 space-y-2.5">
                {toAddCount === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">无新合成提炼的条目</p>
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
                            <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              {CATEGORY_LABELS[item.category || "facts"] || "提炼新事实"}
                            </span>
                            {item.reason && (
                              <span className="text-2xs text-muted-foreground truncate">{item.reason}</span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-foreground leading-relaxed font-normal">{item.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* 冲突更新 */}
              <TabsContent value="update" className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1 space-y-2.5">
                {toUpdateCount === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">无需要消除冲突与更新的条目</p>
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
                            <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              {CATEGORY_LABELS[item.category || "facts"] || "时序覆盖更新"}
                            </span>
                            {item.reason && (
                              <span className="text-2xs text-muted-foreground truncate">{item.reason}</span>
                            )}
                          </div>
                          {item.old_text && (
                            <div className="text-2xs text-muted-foreground/80 line-through mb-1 bg-surface-3/40 px-2 py-1 rounded-md">
                              原记录：{item.old_text}
                            </div>
                          )}
                          <p className="text-xs sm:text-sm text-foreground leading-relaxed font-normal">{item.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* 剔除过期 */}
              <TabsContent value="delete" className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1 space-y-2.5">
                {toDeleteCount === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">无建议淘汰的过期记录</p>
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
                            <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                              建议剔除
                            </span>
                            {item.reason && (
                              <span className="text-2xs text-muted-foreground truncate">{item.reason}</span>
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

              {/* 保持不变 */}
              <TabsContent value="keep" className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1 space-y-2.5">
                {toKeepCount === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">无记录</p>
                ) : (
                  plan.to_keep.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-border/40 bg-surface-2/30 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-surface-4 text-muted-foreground">
                          保持有效
                        </span>
                        {item.reason && <span className="text-2xs text-muted-foreground truncate">{item.reason}</span>}
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
          <div className="text-2xs text-muted-foreground hidden sm:block">
            {plan && (
              <span>
                将应用：+{selectedAdds.size} 提炼，~{selectedUpdates.size} 更新，-{selectedDeletes.size} 删除
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
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isAnalyzing || isApplying || !plan || !hasChanges}
              onClick={handleConfirm}
              className="h-9 rounded-xl bg-primary px-5 text-footnote font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40"
            >
              {isApplying ? "正在应用整理…" : !hasChanges ? "已是最优状态" : "确认应用整理"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

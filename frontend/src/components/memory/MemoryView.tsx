"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { apiRequest } from "@/lib/api";
import { ViewShell } from "@/components/common/ViewShell";
import type { MobileTab } from "@/config/navigation";
import {
  MemoryItem,
  ConsolidationPlan,
  ConsolidationPreviewResponse,
  ConsolidationSnapshotStatus,
} from "@/types";
import { Button } from "@/components/ui/button";


import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Panel, SectionLabel } from "@/components/common/Panel";
import { MemoryCard, MemoryCardIcon } from "@/components/memory/MemoryCard";
import { useRefreshOnResume } from "@/hooks/useRefreshOnResume";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useLoadMoreTrigger } from "@/hooks/useLoadMoreTrigger";
import { FullPageSkeleton, MemoryListSkeleton } from "@/components/common/PageSkeleton";
import { normalizeMemories, type NormalizedMemory } from "@/lib/memory";
import { groupByTimeBuckets } from "@/lib/timeGroups";
import { cn } from "@/lib/utils";
import {
  Brain,
  Search,
  MessageSquare,
  Trash2,
  Pencil,
  Download,
  X,
  RotateCcw,
  Sparkles,
  History,
} from "lucide-react";
import { ConsolidateDialog } from "@/components/memory/ConsolidateDialog";



export interface MemoryViewProps {
  isMobileSpa?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
  /** 移动端 SPA 里该页签当前是否可见；用于切回时补一次刷新 */
  active?: boolean;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  isMobileSpa = false,
  onSelectMobileTab,
  active = true,
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t, fmt } = useI18n();

  /** 每页条数。同时用于浏览态与检索态。后端上限 100，50 在其内。 */
  const PAGE_SIZE = 50;

  /**
   * ⌘ 只在 Apple 键盘上存在。弹窗是交互后才打开的（不会触发 hydration 不一致），
   * 因此这里直接读平台，不进 state。
   */
  const isApple =
    typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.platform);

  /** 已加载的记忆（分页累加）。分组只基于这部分，所以下滑会看到更多分组条目。 */
  const [memories, setMemories] = useState<NormalizedMemory[]>([]);
  /** 服务端报告的**总条数**（非已加载数），用于「共 N 条」。 */
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** 单飞闸门：state 异步，连续滚动可能连发多次加载。 */
  const loadingMoreRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  /** 首屏加载（显示整页骨架）；加载更多走 loadingMore。 */
  const [loadingMemories, setLoadingMemories] = useState(true);

  // Inline Edit State
  const [editingItem, setEditingItem] = useState<NormalizedMemory | null>(null);
  const [editText, setEditText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Confirm State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingRef = useRef(false);

  // Consolidation State
  const [isConsolidateOpen, setIsConsolidateOpen] = useState(false);
  const [isAnalyzingConsolidation, setIsAnalyzingConsolidation] = useState(false);
  const [isApplyingConsolidation, setIsApplyingConsolidation] = useState(false);
  const [consolidationPreview, setConsolidationPreview] = useState<ConsolidationPreviewResponse | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<ConsolidationSnapshotStatus | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

/**
 * 时间分组小标（最近 24 小时 / 最近 3 天 / 最近 7 天 / 更早）。
 *
 * 浏览态与检索态**用同一套分组**：向量搜索只负责挑出「哪些记忆相关」，
 * 挑出来之后按时间摆放，与浏览态的口径一致 —— 否则用户在同一页面里会看到
 * 两种排序规则，检索一次位置就全变了。
 *
 * 缺时间的条目（后端拿不到 created_at/updated_at 时会返回空），
 * getTime 得到 0，落进「更早」；<MemoryCard> 同时不渲染时间行，
 * 不会给它们编造一个时间。
 */
  const groupedSections = useMemo(
    () =>
      groupByTimeBuckets<NormalizedMemory>(memories, {
        t,
        pinnedTitleKey: "common.timeGroups.pinnedMemories",
        getTime: (m) => new Date(m.effectiveAt || 0).getTime(),
      }),
    [memories, t]
  );

  useRequireAuth();

  /**
   * 取一页数据并**替换**整个列表。
   *
   * `append=true` 用于下滑加载更多（累加到末尾），否则重置。
   * 两种模式共用本函数，因为浏览态与检索态的响应形状一致
   * （{items, total, has_more}），只有 URL 不同。
   */
  const fetchPage = async ({
    query,
    offset,
    append,
  }: {
    query: string;
    offset: number;
    append: boolean;
  }) => {
    const isSearch = query.length > 0;
    if (append) {
      if (loadingMoreRef.current || !hasMore) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      setLoadingMemories(true);
    }

    try {
      const url = isSearch
        ? `/memories/search?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${offset}`
        : `/memories?limit=${PAGE_SIZE}&offset=${offset}`;

      const res = await apiRequest<{
        items?: MemoryItem[];
        results?: MemoryItem[];
        total?: number;
        has_more?: boolean;
      }>(url);

      // 检索接口用 results，浏览接口用 items
      const rawItems = res.items ?? res.results ?? [];
      const page = normalizeMemories(rawItems);

      setMemories((prev) => (append ? [...prev, ...page] : page));
      setTotalCount(res.total ?? page.length);
      setHasMore(res.has_more ?? false);
    } catch (err) {
      console.error("Failed to load memories:", err);
      if (!append) {
        if (isSearch) {
          toast.error(t("memory.errors.searchFallback"));
          setIsSearching(false);
          try {
            await fetchPage({ query: "", offset: 0, append: false });
            return;
          } catch {
            // 浏览态也失败，落到下面的统一处理
          }
        } else {
          toast.error(t("memory.errors.loadFailed"));
        }
        setMemories([]);
        setTotalCount(0);
        setHasMore(false);
      }
      // append 失败时保持已有内容与 has_more，下一次滚动会重试
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setLoadingMemories(false);
    }
  };

  const checkSnapshotStatus = async () => {
    try {
      const res = await apiRequest<ConsolidationSnapshotStatus>("/memories/consolidate/snapshot-status");
      setSnapshotStatus(res);
    } catch (_) {}
  };

  /** 重置到第一页（浏览态）。切回前台刷新、退出搜索都走这里。 */
  const fetchMemories = () => {
    fetchPage({ query: "", offset: 0, append: false });
    checkSnapshotStatus();
  };

  /** 下滑加载更多。浏览态与检索态都走它。 */
  const loadMore = () => {
    if (loadingMore || !hasMore || loadingMemories) return;
    fetchPage({
      query: isSearching ? searchQuery.trim() : "",
      offset: memories.length,
      append: true,
    });
  };

  /**
   * 列表末尾的哨兵元素。滚动到底前 240px 即触发下一页。
   * 加载完一页后 hasMore 可能仍为 true，观察器持续有效，会再次触发。
   */
  const loadMoreSentinelRef = useLoadMoreTrigger(loadMore, {
    enabled: hasMore && !loadingMemories && !loadingMore,
  });

  useEffect(() => {
    // 同 UsageView：SPA 里五个页签同时挂载，这里按 active 收口，
    // 避免桌面端打开 /chat 时把 /memories 也请求掉（此时它被 `md:hidden` 盖住）。
    if (isMobileSpa && !active) return;
    if (user) {
      fetchMemories();
      checkSnapshotStatus();
    }
  }, [user, isMobileSpa, active]);

  const handleStartConsolidation = async (modelOverride?: string | React.MouseEvent) => {
    const resolvedModel = typeof modelOverride === "string" ? modelOverride : undefined;
    setIsConsolidateOpen(true);
    setIsAnalyzingConsolidation(true);
    setConsolidationPreview(null);
    try {
      const url = resolvedModel
        ? `/memories/consolidate/preview?model=${encodeURIComponent(resolvedModel)}`
        : "/memories/consolidate/preview";
      const res = await apiRequest<ConsolidationPreviewResponse>(url, {
        method: "POST",
      });
      setConsolidationPreview(res);
      if (res.status === "already_optimal") {
        toast.success(res.summary || res.message || t("memory.consolidation.toastAlreadyOptimal"));
        setIsConsolidateOpen(false);
      } else if (res.status === "too_few" || res.status === "empty") {
        toast.info(res.message || t("memory.consolidation.toastTooFew"));
        setIsConsolidateOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || t("memory.consolidation.toastAnalyzeFailed"));
      setConsolidationPreview({
        status: "error",
        message: err.message || t("memory.consolidation.toastAnalyzeFailedRetry"),
      });
    } finally {
      setIsAnalyzingConsolidation(false);
    }
  };

  const handleApplyConsolidation = async (approvedPlan: ConsolidationPlan) => {
    setIsApplyingConsolidation(true);
    const toastId = toast.loading(t("memory.consolidation.toastApplyLoading"));
    try {
      const res = await apiRequest<{
        status: string;
        deleted_count: number;
        updated_count: number;
        added_count: number;
      }>("/memories/consolidate/apply", {
        method: "POST",
        body: JSON.stringify({ plan: approvedPlan }),
      });
      toast.success(
        t("memory.consolidation.toastApplySuccess", {
          deleted: res.deleted_count,
          updated: res.updated_count,
          added: res.added_count,
        }),
        { id: toastId }
      );
      setIsConsolidateOpen(false);
      fetchMemories();
    } catch (err: any) {
      toast.error(err.message || t("memory.consolidation.toastApplyFailed"), { id: toastId });
    } finally {
      setIsApplyingConsolidation(false);
    }
  };

  const handleRollbackConsolidation = async () => {
    setIsRollingBack(true);
    const toastId = toast.loading(t("memory.rollback.toastLoading"));
    try {
      const res = await apiRequest<{ status: string; restored_count: number }>("/memories/consolidate/rollback", {
        method: "POST",
      });
      toast.success(t("memory.rollback.toastSuccess", { count: res.restored_count }), { id: toastId });
      setShowRollbackConfirm(false);
      fetchMemories();
    } catch (err: any) {
      toast.error(err.message || t("memory.rollback.toastFailed"), { id: toastId });
    } finally {
      setIsRollingBack(false);
    }
  };


  // 切后台 / 切回本页签时刷新，避免看到别的设备写入的旧记忆
  useRefreshOnResume(fetchMemories, {
    enabled: !editingItem && !isSearching,
    visible: active,
  });

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      handleResetSearch();
      return;
    }
    setIsSearching(true);
    await fetchPage({ query, offset: 0, append: false });
  };

  const handleResetSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    fetchMemories();
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editText.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    const newText = editText.trim();
    const targetId = editingItem.id;
    try {
      await apiRequest(`/memories/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({ data: newText }),
      });
      const nowIso = new Date().toISOString();
      setMemories((prev) =>
        prev.map((m) =>
          m.id === targetId
            ? { ...m, text: newText, effectiveAt: nowIso, isEdited: true }
            : m
        )
      );
      setEditingItem(null);
      toast.success(t("memory.edit.saved"));
      fetchMemories();
    } catch (err: any) {
      toast.error(err.message || t("memory.edit.failed"));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      await apiRequest(`/memories/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      toast.success(t("memory.remove.done"));
    } catch (err: any) {
      toast.error(err.message || t("memory.remove.failed"));
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading(t("memory.export.inProgress"));
    try {
      const data = await apiRequest("/memories/export");
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const username = user?.username || "export";
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `apiapia_memories_${username}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const exported = Array.isArray(data?.memories) ? data.memories.length : 0;
      const partial = exported > 0 && exported < totalCount;
      if (partial) {
        toast.warning(t("memory.export.partial", { exported, total: totalCount }), {
          id: toastId,
        });
      } else {
        toast.success(t("memory.export.all", { exported }), { id: toastId });
      }
    } catch (err: any) {
      console.error("Export failed:", err);
      toast.error(err.message || t("memory.export.failed"), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  if (loading || !user) return <FullPageSkeleton variant="list" />;

  const goToChat = () => {
    if (onSelectMobileTab) {
      onSelectMobileTab("chat");
    } else {
      router.push("/chat");
    }
  };

  return (
    <ViewShell title={t("memory.title")} isMobileSpa={isMobileSpa} onSelectMobileTab={onSelectMobileTab}>
      {/* ── 顶部操作栏 ──
          此前 form 写死 `max-w-2xl`，而下方内容由 ViewShell 统一为 `max-w-3xl`，
          于是搜索栏比它过滤的那份列表窄一截，左右边缘对不齐。现在不再自行限宽，
          直接铺满内容列 —— 宽度由 ViewShell 单一决定。 */}
      <Panel tone="bare" className="flex flex-wrap items-center justify-between gap-2">
        <form onSubmit={handleSearch} className="flex w-full items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Label htmlFor="memory-search" className="sr-only">
              {t("memory.search.label")}
            </Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="memory-search"
              type="search"
              placeholder={t("memory.search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-xl border-border/40 bg-surface-3/50 pl-9 pr-9 text-sm focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleResetSearch}
                aria-label={t("memory.search.clear")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ActionTooltip label={t("memory.search.submitSr")} side="bottom">
            <Button
              type="submit"
              variant="secondary"
              size="icon"
              className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border border-border/40 bg-surface-3/60 text-foreground transition-colors hover:bg-surface-3 active:scale-95"
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">{t("memory.search.submit")}</span>
            </Button>
          </ActionTooltip>

          <ActionTooltip label={t("memory.consolidation.btnTip")} side="bottom">
            <Button
              type="button"
              onClick={() => handleStartConsolidation()}
              disabled={loadingMemories || isExporting}
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20 active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              <span className="sr-only">{t("memory.consolidation.btnSr")}</span>
            </Button>
          </ActionTooltip>

          {snapshotStatus?.has_snapshot && (
            <ActionTooltip
              label={t("memory.rollback.btnTip", { count: snapshotStatus.count })}
              side="bottom"
            >
              <Button
                type="button"
                onClick={() => setShowRollbackConfirm(true)}
                disabled={loadingMemories || isExporting}
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/20 active:scale-95"
              >
                <History className="h-4 w-4" />
                <span className="sr-only">{t("memory.rollback.btnSr")}</span>
              </Button>
            </ActionTooltip>
          )}

          <ActionTooltip label={t("memory.export.tip", { count: totalCount })} side="bottom">
            <Button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border-border/50 bg-surface-3/30 text-foreground transition-colors hover:bg-surface-3 active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">{t("memory.export.sr")}</span>
            </Button>
          </ActionTooltip>
        </form>
      </Panel>

      <div className="flex items-center justify-between gap-3 px-1">
        <SectionLabel className="flex min-w-0 items-center gap-1.5 pb-0">
          <Brain className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">
            {isSearching ? t("memory.section.searchResults") : t("memory.section.all")}
          </span>
          <span className="shrink-0 font-mono text-xs opacity-75">
            {hasMore
              ? isSearching
                ? t("memory.counter.foundPlus", { count: memories.length })
                : t("memory.counter.loadedOfTotal", {
                    count: memories.length,
                    total: totalCount,
                  })
              : t("memory.counter.total", { total: totalCount })}
          </span>
        </SectionLabel>

        {isSearching && (
          <button
            type="button"
            onClick={handleResetSearch}
            className="flex shrink-0 cursor-pointer items-center gap-1 text-xs normal-case tracking-normal text-primary hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t("memory.showAll")}</span>
          </button>
        )}
      </div>

      {/* ── 列表 ── */}
      {loadingMemories ? (
        <MemoryListSkeleton rows={4} />
      ) : memories.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={isSearching ? t("memory.empty.searchTitle") : t("memory.empty.browseTitle")}
          description={
            isSearching ? t("memory.empty.searchDesc") : t("memory.empty.browseDesc")
          }
          actionLabel={isSearching ? t("memory.empty.resetSearch") : t("memory.empty.newChat")}
          actionIcon={isSearching ? RotateCcw : MessageSquare}
          actionVariant={isSearching ? "outline" : "default"}
          onAction={isSearching ? handleResetSearch : goToChat}
        />
      ) : (
        <div className="space-y-6">
          {groupedSections.map((sec, secIdx) => (
            <div key={sec.key} className={cn("space-y-2.5", secIdx > 0 && "pt-2")}>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-muted-foreground select-none">
                  {sec.title}
                  <span className="ml-1.5 font-mono text-xs opacity-75">
                    {t("memory.section.count", { count: sec.items.length })}
                  </span>
                </span>
              </div>

              <div className="space-y-3">
                {sec.items.map((m) => (
                    <MemoryCard
                      key={m.id}
                      size="md"
                      interactive
                      text={m.text}
                      icon={
                        <MemoryCardIcon>
                          <Brain className="h-4 w-4" />
                        </MemoryCardIcon>
                      }
                      time={fmt.dateTime(m.effectiveAt)}
                      badge={m.isEdited ? t("memory.card.edited") : undefined}
                      actions={
                        <>
                          <ActionTooltip label={t("memory.card.editTip")} side="top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingItem(m);
                                setEditText(m.text);
                              }}
                              className="h-8 w-8 cursor-pointer rounded-lg text-muted-foreground transition-all hover:bg-surface-3/80 hover:text-foreground active:scale-90"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">{t("memory.card.editTip")}</span>
                            </Button>
                          </ActionTooltip>

                          <ActionTooltip label={t("memory.card.deleteTip")} side="top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingId(m.id)}
                              className="h-8 w-8 cursor-pointer rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-90"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">{t("memory.card.deleteTip")}</span>
                            </Button>
                          </ActionTooltip>
                        </>
                      }
                    />
                ))}
              </div>
            </div>
          ))}

          {/* ── 分页尾部 ──
              哨兵元素：滚动到底前 240px 即触发下一页（IntersectionObserver，
              因为滚动容器是 ViewShell 的，拿不到 ref 只能用哨兵）。
              下方同时给出按钮与文字提示 —— 只靠自动触发对键盘用户和
              加载失败的情况不可达，按钮是这个功能的可达性兜底。 */}
          {hasMore && (
            <div className="pt-1">
              <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-px" />
              <div className="flex justify-center py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="h-9 cursor-pointer gap-1.5 rounded-xl border-border/50 bg-surface-3/40 px-5 text-footnote font-medium text-foreground transition-colors hover:bg-surface-3 active:scale-95"
                >
                  <RotateCcw
                    className={cn("h-4 w-4", loadingMore && "animate-spin")}
                  />
                  <span>
                    {loadingMore
                      ? t("memory.loadMore.busy")
                      : isSearching
                        ? t("memory.loadMore.searching")
                        : t("memory.loadMore.browsing")}
                  </span>
                </Button>
              </div>
            </div>
          )}

          {!hasMore && memories.length > 0 && (
            <p className="pt-2 pb-1 text-center text-xs text-muted-foreground/75 select-none">
              {t("memory.endOfList", { total: totalCount })}
            </p>
          )}

          {/* 加载更多期间的尾部骨架。与上方列表同为 space-y-3，不会出现接缝 */}
          {loadingMore && <MemoryListSkeleton rows={2} />}
        </div>
      )}

      {/* ── 编辑记忆弹窗 ── */}
      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-[480px] w-[92vw] space-y-4 rounded-[22px] border border-border/50 bg-background/95 p-5 shadow-2xl backdrop-blur-2xl sm:p-6"
        >
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Brain className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-body font-semibold text-foreground">
                  {t("memory.edit.title")}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs font-normal leading-normal text-muted-foreground">
                  {t("memory.edit.desc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEdit();
            }}
            className="space-y-4"
          >
            <div className="space-y-2 rounded-xl border border-border/50 bg-surface-3/40 p-3 transition-all focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20">
              <Label htmlFor="memory-edit-textarea" className="sr-only">
                {t("memory.edit.label")}
              </Label>
              <Textarea
                id="memory-edit-textarea"
                rows={4}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (editText.trim() && !isSavingEdit) {
                      handleSaveEdit();
                    }
                  }
                }}
                placeholder={t("memory.edit.placeholder")}
                className="min-h-[100px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-0"
              />
              <div className="flex items-center justify-between border-t border-border/30 pt-2 text-xs text-muted-foreground/75">
                <span>{isApple ? t("memory.edit.shortcutMac") : t("memory.edit.shortcutOther")}</span>
                <span>{t("memory.edit.charCount", { count: editText.trim().length })}</span>
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2.5 pt-1 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(null)}
                className="h-9 cursor-pointer rounded-xl border-border/50 bg-surface-3/30 px-4 text-footnote font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
              >
                {t("memory.edit.cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingEdit || !editText.trim()}
                className="h-9 cursor-pointer rounded-xl bg-primary px-5 text-footnote font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40"
              >
                {isSavingEdit ? t("memory.edit.saving") : t("memory.edit.done")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {deletingId && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDeletingId(null);
          }}
          title={t("memory.remove.title")}
          description={t("memory.remove.desc")}
          confirmText={t("memory.remove.confirm")}
          danger
          loading={isDeleting}
          onConfirm={() => handleDelete(deletingId)}
        />
      )}


      {/* ── 智能整理弹窗 ── */}
      <ConsolidateDialog
        open={isConsolidateOpen}
        onOpenChange={setIsConsolidateOpen}
        previewData={consolidationPreview}
        isAnalyzing={isAnalyzingConsolidation}
        isApplying={isApplyingConsolidation}
        onApply={handleApplyConsolidation}
        onRetry={(model) => handleStartConsolidation(model)}
        totalMemoriesCount={totalCount || memories.length}
      />

      {/* ── 恢复备份确认弹窗 ── */}
      {showRollbackConfirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !isRollingBack) setShowRollbackConfirm(false);
          }}
          title={t("memory.rollback.dialogTitle")}
          description={t("memory.rollback.dialogDesc", { count: snapshotStatus?.count || 0 })}
          confirmText={t("memory.rollback.confirm")}
          danger
          loading={isRollingBack}
          onConfirm={handleRollbackConsolidation}
        />
      )}
    </ViewShell>
  );
};


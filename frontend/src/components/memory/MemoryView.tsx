"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { apiRequest } from "@/lib/api";
import { ViewShell } from "@/components/common/ViewShell";
import type { MobileTab } from "@/config/navigation";
import { MemoryItem } from "@/types";
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
} from "lucide-react";

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
  //
  // 「待确认的目标」和「请求正在飞行」必须是两个状态。此前只有一个 deletingId，
  // 而弹窗又只在 deletingId 非空时渲染，于是 `loading={!!deletingId}` 在弹窗
  // 挂载的第一帧就为 true，ConfirmDialog 把确认/取消按钮一起 disabled 并显示
  // 「处理中…」—— onConfirm 永远不触发，删除功能从 UI 完全不可达。
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // 单飞闸门：state 更新是异步的，光靠 isDeleting 挡不住同一帧内的双击
  const deletingRef = useRef(false);

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

  // 视图内部守卫（此前与 UsageView / SettingsView 逐字相同的三份之一）
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
        // 首屏失败。若是检索，就退回浏览态的完整列表 —— 此前 catch 只弹
        // toast 而不动 memories，列表会停留在**上一次**的检索结果上，
        // 用户以为搜索失败后看到的却是一屏与关键词无关的旧结果，
        // 看起来像「搜索坏了」。
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

  /** 重置到第一页（浏览态）。切回前台刷新、退出搜索都走这里。 */
  const fetchMemories = () => fetchPage({ query: "", offset: 0, append: false });

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
    }
  }, [user, isMobileSpa, active]);

  // 切后台 / 切回本页签时刷新，避免看到别的设备写入的旧记忆。
  // 正在编辑某条记忆时必须跳过，否则会丢掉未保存的改动。
  // 检索态也跳过：此刻页面展示的是搜索结果，刷新会把它换成完整列表。
  //
  // 注意 fetchMemories 现在是**重置到第一页**（分页后不再是「替换整份数据」）。
  // 若在已加载 3 页时切回前台，用户会退回第 1 页 —— 这是刻意的：数据变了就
  // 重新开始，比在一半陈旧的分页上续接更不容易出错。
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
    // 先置位再请求：fetchPage 内部的失败分支要靠它决定是否回退到浏览态
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
    // ref 单飞：确认弹窗的 loading 态能挡住「下一帧」的点击，但挡不住同一帧内的
    // 双击（state 尚未提交），所以真正的闸门是这个 ref。
    if (deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      await apiRequest(`/memories/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
      // 分页下 total 是服务端报告的总数，删掉一条后本地减一，
      // 否则「共 N 条」和「加载更多（还有 N 条）」会一直差 1。
      // hasMore 不动：删掉的只是已加载范围内的一条，不影响「服务端还有没有更多」。
      setTotalCount((prev) => Math.max(0, prev - 1));
      toast.success(t("memory.remove.done"));
    } catch (err: any) {
      toast.error(err.message || t("memory.remove.failed"));
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
      // 成功与否都关掉弹窗：失败时用户已经看到 toast，留在原地反而挡住列表。
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
      // 报告实际导出的条数而不是 totalCount：后端 list_all_memories 是
      // 分块累加的，末页出错时会返回部分数据（并已写告警日志）。让用户
      // 知道自己拿到的文件里到底有多少条，比报一个可能对不上的数字诚实。
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

      {/* ── 状态与统计小标 ──
          px-1 让这里的内容与上方搜索框、下方卡片的左边缘对齐（搜索框有
          pl-9 的图标内边距，但 Input 自身的 border 与卡片一致）。 */}
      <div className="flex items-center justify-between gap-3 px-1">
        <SectionLabel className="flex min-w-0 items-center gap-1.5 pb-0">
          <Brain className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">
            {isSearching ? t("memory.section.searchResults") : t("memory.section.all")}
          </span>
          {/* totalCount 是服务端报告的总条数，不是 memories.length ——
              分页后后者只是「已加载多少」。两者不等时补一个进度提示，
              让用户知道下面还有。 */}
          {/*
            浏览态的 total 是精确总数；检索态的 total 只能给出下界
            （向量检索没有 count 接口），所以还有下一页时用「N+」表示
            「至少 N 条」，不谎报一个具体数字。
          */}
          <span className="shrink-0 font-mono text-2xs opacity-60">
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
            className="flex shrink-0 cursor-pointer items-center gap-1 text-2xs normal-case tracking-normal text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
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
                  <span className="ml-1.5 font-mono text-2xs opacity-60">
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
            <p className="pt-2 pb-1 text-center text-2xs text-muted-foreground/60 select-none">
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
              <div className="flex items-center justify-between border-t border-border/30 pt-2 text-2xs text-muted-foreground/70">
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

      {/* ── 删除确认弹窗 ──
          loading 必须绑定「请求在途」的 isDeleting，而不是「待确认目标」deletingId：
          弹窗正是由 deletingId 派生的，用它当 loading 会让弹窗一挂载就显示
          「处理中…」并禁用确认键，删除操作永远无法触发。 */}
      {deletingId && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            // 请求飞行中不允许关闭，否则用户会在 DELETE 还在途时把弹窗撤掉，
            // 失去 loading 反馈也失去防连点的视觉提示。
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
    </ViewShell>
  );
};

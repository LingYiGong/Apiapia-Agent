"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
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
import { useRefreshOnResume } from "@/hooks/useRefreshOnResume";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { FullPageSkeleton, MemoryListSkeleton } from "@/components/common/PageSkeleton";
import { formatDateTime } from "@/lib/format";
import { normalizeMemories, type NormalizedMemory } from "@/lib/memory";
import { groupByTimeBuckets } from "@/lib/timeGroups";
import {
  Brain,
  Search,
  MessageSquare,
  Trash2,
  Pencil,
  Download,
  X,
  Clock,
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

  const [memories, setMemories] = useState<NormalizedMemory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
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

  // 按 Apple HIG 规范将记忆按时间分组（置顶/今天、过去 7 天、更早之前）
  const groupedSections = useMemo(
    () =>
      groupByTimeBuckets<NormalizedMemory>(memories, {
        getTime: (m) => new Date(m.effectiveAt || 0).getTime(),
      }),
    [memories]
  );

  // 视图内部守卫（此前与 UsageView / SettingsView 逐字相同的三份之一）
  useRequireAuth();

  const fetchMemories = async () => {
    setLoadingMemories(true);
    try {
      const data = await apiRequest<MemoryItem[]>("/memories");
      setMemories(normalizeMemories(data || []));
    } catch (err) {
      console.error("Failed to load memories:", err);
    } finally {
      setLoadingMemories(false);
    }
  };

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
    setLoadingMemories(true);
    try {
      const res = await apiRequest<{ query: string; results: MemoryItem[] }>(
        `/memories/search?q=${encodeURIComponent(query)}`
      );
      setMemories(normalizeMemories(res.results || []));
    } catch (err: any) {
      console.error("Search failed:", err);
      toast.error(err?.message || "检索记忆库失败");
    } finally {
      setLoadingMemories(false);
    }
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
      toast.success("已更新记忆");
      fetchMemories();
    } catch (err: any) {
      toast.error(err.message || "修改记忆失败");
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
      toast.success("已删除记忆");
    } catch (err: any) {
      toast.error(err.message || "删除记忆失败");
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
    const toastId = toast.loading("正在导出记忆数据...");
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
      toast.success("记忆数据已导出为 JSON 文件", { id: toastId });
    } catch (err: any) {
      console.error("Export failed:", err);
      toast.error(err.message || "导出记忆数据失败", { id: toastId });
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
    <ViewShell title="记忆库" isMobileSpa={isMobileSpa} onSelectMobileTab={onSelectMobileTab}>
      {/* ── 顶部操作栏 ── */}
      <Panel tone="bare" className="flex flex-wrap items-center justify-between gap-2">
        <form onSubmit={handleSearch} className="flex w-full max-w-2xl items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Label htmlFor="memory-search" className="sr-only">
              搜索记忆
            </Label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="memory-search"
              type="search"
              placeholder="搜索记忆..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 rounded-xl border-border/40 bg-surface-3/50 pl-9 pr-8 text-[13px] focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleResetSearch}
                aria-label="清除搜索"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ActionTooltip label="搜索记忆" side="bottom">
            <Button
              type="submit"
              variant="secondary"
              size="icon"
              className="h-9 w-9 shrink-0 cursor-pointer rounded-xl border border-border/40 bg-surface-3/60 text-foreground transition-colors hover:bg-surface-3 active:scale-95"
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">搜索</span>
            </Button>
          </ActionTooltip>

          <ActionTooltip label="导出所有记忆为 JSON" side="bottom">
            <Button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 cursor-pointer rounded-xl border-border/50 bg-surface-3/30 text-foreground transition-colors hover:bg-surface-3 active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">导出 JSON</span>
            </Button>
          </ActionTooltip>
        </form>
      </Panel>

      {/* ── 状态与统计小标 ── */}
      <div className="flex items-center justify-between px-1">
        <SectionLabel className="flex items-center gap-1.5 pb-0">
          <Brain className="h-3.5 w-3.5 text-primary" />
          <span>{isSearching ? "搜索结果" : "全部记忆"}</span>
          <span className="font-mono text-[10px] opacity-60">({memories.length})</span>
        </SectionLabel>

        {isSearching && (
          <button
            type="button"
            onClick={handleResetSearch}
            className="flex cursor-pointer items-center gap-1 text-[11px] normal-case tracking-normal text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            <span>显示全部</span>
          </button>
        )}
      </div>

      {/* ── 列表 ── */}
      {loadingMemories ? (
        <MemoryListSkeleton rows={4} />
      ) : memories.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={isSearching ? "未找到匹配的记忆记录" : "暂无记忆记录"}
          description={
            isSearching
              ? "换个关键词试试，或清除搜索框。"
              : "在与 AI 对话中提及关于你的背景、习惯或关键事实，模型将自动提炼并记录在此处。"
          }
          actionLabel={isSearching ? "重置搜索" : "去新建对话"}
          actionIcon={isSearching ? RotateCcw : MessageSquare}
          actionVariant={isSearching ? "outline" : "default"}
          onAction={isSearching ? handleResetSearch : goToChat}
        />
      ) : (
        <div className="space-y-6">
          {groupedSections.map((sec) => (
            <div key={sec.key} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] font-semibold tracking-tight text-muted-foreground/80 select-none">
                  {sec.title}
                  <span className="ml-1.5 font-mono text-[10px] opacity-50">
                    ({sec.items.length})
                  </span>
                </span>
              </div>

              <div className="space-y-3">
                {sec.items.map((m, idx) => {
                  const formattedTime = formatDateTime(m.effectiveAt);
                  return (
                    <Panel
                      key={m.id}
                      interactive
                      className="group p-4 hover:bg-card sm:p-[18px]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Brain className="h-3.5 w-3.5" />
                          </div>
                          <span className="shrink-0 text-[12px] font-semibold tracking-tight text-foreground/80">
                            记忆 #{idx + 1}
                          </span>
                          {formattedTime && (
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground/70">
                              <span className="inline-flex items-center gap-1 font-mono">
                                <Clock className="h-3 w-3 shrink-0 opacity-70" />
                                <span>{formattedTime}</span>
                              </span>
                              {m.isEdited && (
                                <span className="shrink-0 select-none rounded-md bg-surface-3/60 px-1.5 py-0.5 font-normal text-[10px] text-muted-foreground/80">
                                  已编辑
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                          <ActionTooltip label="编辑记忆" side="top">
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
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">编辑记忆</span>
                            </Button>
                          </ActionTooltip>

                          <ActionTooltip label="删除记忆" side="top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingId(m.id)}
                              className="h-8 w-8 cursor-pointer rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-90"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">删除记忆</span>
                            </Button>
                          </ActionTooltip>
                        </div>
                      </div>

                      <p className="mt-2.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/90 select-text">
                        {m.text}
                      </p>
                    </Panel>
                  );
                })}
              </div>
            </div>
          ))}
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
                <DialogTitle className="text-[17px] font-semibold tracking-tight text-foreground">
                  编辑长期记忆
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[12.5px] font-normal leading-normal text-muted-foreground">
                  修改此条记忆内容，AI 将在全站对话中以修改后的事实作为参考。
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
                记忆内容
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
                placeholder="修改记忆内容..."
                className="min-h-[100px] w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-relaxed placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-0"
              />
              <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[11px] text-muted-foreground/70">
                <span>支持 ⌘ + 回车 完成修改</span>
                <span>{editText.trim().length} 字</span>
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2.5 pt-1 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(null)}
                className="h-9 cursor-pointer rounded-xl border-border/50 bg-surface-3/30 px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingEdit || !editText.trim()}
                className="h-9 cursor-pointer rounded-xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40"
              >
                {isSavingEdit ? "正在保存..." : "完成"}
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
          title="删除这条记忆"
          description="确定要从记忆库中永久移除这条记录吗？删除后 AI 将不再参考该事实，此操作无法撤销。"
          confirmText="删除"
          danger
          loading={isDeleting}
          onConfirm={() => handleDelete(deletingId)}
        />
      )}
    </ViewShell>
  );
};

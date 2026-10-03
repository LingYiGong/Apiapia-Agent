"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileTab } from "@/components/layout/UserAvatarDropdown";
import { MemoryItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { FullPageSkeleton } from "@/components/common/PageSkeleton";
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
import { cn } from "@/lib/utils";

function formatFullDateTime(val?: string): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return String(val);
  }
}

interface MemorySection {
  key: "today" | "pastWeek" | "earlier";
  title: string;
  items: MemoryItem[];
}

export interface MemoryViewProps {
  isMobileSpa?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  isMobileSpa = false,
  onSelectMobileTab,
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loadingMemories, setLoadingMemories] = useState(true);

  // Inline Edit State
  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null);
  const [editText, setEditText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Confirm State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 按 Apple HIG 规范将记忆按时间分组（今天、过去 7 天、更早之前）
  const groupedSections = useMemo<MemorySection[]>(() => {
    const today: MemoryItem[] = [];
    const pastWeek: MemoryItem[] = [];
    const earlier: MemoryItem[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

    const getEffectiveTime = (item: MemoryItem): number => {
      const ts =
        item.updated_at ||
        (item as any).metadata?.updated_at ||
        item.created_at ||
        (item as any).metadata?.created_at ||
        (item as any).metadata?.timestamp;
      return ts ? new Date(ts).getTime() : 0;
    };

    memories.forEach((item) => {
      const t = getEffectiveTime(item);
      if (t >= startOfToday) {
        today.push(item);
      } else if (t >= sevenDaysAgo) {
        pastWeek.push(item);
      } else {
        earlier.push(item);
      }
    });

    const sortByTimeDesc = (a: MemoryItem, b: MemoryItem) => {
      return getEffectiveTime(b) - getEffectiveTime(a);
    };

    today.sort(sortByTimeDesc);
    pastWeek.sort(sortByTimeDesc);
    earlier.sort(sortByTimeDesc);

    const sections: MemorySection[] = [];
    if (today.length > 0) sections.push({ key: "today", title: "今天", items: today });
    if (pastWeek.length > 0) sections.push({ key: "pastWeek", title: "过去 7 天", items: pastWeek });
    if (earlier.length > 0) sections.push({ key: "earlier", title: "更早之前", items: earlier });

    return sections;
  }, [memories]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const fetchMemories = async () => {
    setLoadingMemories(true);
    try {
      const data = await apiRequest<MemoryItem[]>("/memories");
      setMemories(data || []);
    } catch (err) {
      console.error("Failed to load memories:", err);
    } finally {
      setLoadingMemories(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMemories();
    }
  }, [user]);

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
      setMemories(res.results || []);
    } catch (err) {
      console.error("Search failed:", err);
      toast.error("检索记忆库失败");
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
            ? {
                ...m,
                memory: newText,
                updated_at: nowIso,
                metadata: {
                  ...((m as any).metadata || {}),
                  updated_at: nowIso,
                },
              }
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
    try {
      await apiRequest(`/memories/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
      toast.success("已删除记忆");
    } catch (err: any) {
      toast.error(err.message || "删除记忆失败");
    } finally {
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

  return (
    <div className={cn("flex flex-col h-full overflow-hidden bg-background w-full", !isMobileSpa && "h-dvh")}>
      {!isMobileSpa && <Navbar />}
      {/* ── Apple HIG Standard Mobile Navigation Bar (44pt) ── */}
      <MobileHeader title="记忆库" onSelectMobileTab={onSelectMobileTab} />

      {/* ── 顶部操作栏：完全遵循 Apple HIG 工具栏规范 ── */}
      <div className="px-3.5 sm:px-6 pl-[max(0.875rem,env(safe-area-inset-left,0px))] pr-[max(0.875rem,env(safe-area-inset-right,0px))] py-2 border-b border-border/40 bg-background/80 backdrop-blur-md shrink-0 select-none">
        <form
          onSubmit={handleSearch}
          className="max-w-4xl mx-auto w-full flex items-center gap-2"
        >
          {/* 1. 搜索输入框 */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="搜索记忆..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-8 text-[13px] rounded-lg bg-muted/60 dark:bg-muted/40 border-border/40 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleResetSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 2. 搜索按钮 */}
          <ActionTooltip label="搜索记忆" side="bottom">
            <Button
              type="submit"
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0 active:scale-95 border border-border/40 bg-muted/60 hover:bg-muted/90 text-foreground transition-all cursor-pointer"
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">搜索</span>
            </Button>
          </ActionTooltip>

          {/* 3. 下载/导出按钮 */}
          <ActionTooltip label="导出所有记忆为 JSON" side="bottom">
            <Button
              type="button"
              onClick={handleExport}
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0 active:scale-95 border-border/50 bg-muted/30 hover:bg-muted text-foreground transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">导出 JSON</span>
            </Button>
          </ActionTooltip>
        </form>
      </div>

      {/* ── 记忆列表滚动容器 ── */}
      <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 pl-[max(0.875rem,env(safe-area-inset-left,0px))] pr-[max(0.875rem,env(safe-area-inset-right,0px))] py-3.5 pb-8 md:pb-10 overscroll-contain">
        <div className="max-w-4xl mx-auto w-full space-y-3">
          {/* 状态与统计小标 */}
          <div className="flex items-center justify-between px-1 text-[12px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-primary" />
              <span>{isSearching ? "搜索结果" : "全部记忆"}</span>
              <span className="text-[10px] font-mono opacity-60">({memories.length})</span>
            </div>

            {isSearching && (
              <button
                type="button"
                onClick={handleResetSearch}
                className="flex items-center gap-1 text-[11px] font-normal tracking-normal normal-case text-primary hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>显示全部</span>
              </button>
            )}
          </div>

          {/* 列表渲染 */}
          {loadingMemories ? (
            <div className="space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-border/40 bg-card/60 space-y-2 animate-pulse"
                >
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-12 rounded-md" />
                    <Skeleton className="h-3.5 w-28 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                </div>
              ))}
            </div>
          ) : memories.length === 0 ? (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center py-16 text-center select-none">
              <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground mb-3">
                <Brain className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {isSearching ? "未找到匹配的记忆记录" : "暂无记忆记录"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                {isSearching
                  ? "换个关键词试试，或点击右上方清除搜索。"
                  : "在与 AI 对话中提及关于你的背景、习惯或关键事实，模型将自动提炼并记录在此处。"}
              </p>
              <div className="mt-4">
                {isSearching ? (
                  <Button
                    onClick={handleResetSearch}
                    variant="outline"
                    size="sm"
                    className="rounded-xl px-4 text-xs font-medium cursor-pointer"
                  >
                    重置搜索
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (onSelectMobileTab) {
                        onSelectMobileTab("chat");
                      } else {
                        router.push("/chat");
                      }
                    }}
                    size="sm"
                    className="rounded-xl px-4 text-xs font-medium gap-1.5 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>去新建对话</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                let globalCounter = 0;
                return groupedSections.map((sec) => (
                  <div key={sec.key} className="space-y-2.5">
                    {/* Apple HIG 时间分组小标 */}
                    <div className="flex items-center justify-between px-1 text-[12px] font-semibold text-muted-foreground/80 select-none">
                      <div className="flex items-center gap-1.5">
                        <span className="tracking-tight">{sec.title}</span>
                        <span className="text-[10px] font-mono opacity-50">({sec.items.length})</span>
                      </div>
                    </div>

                    {/* 分组内记忆卡片 */}
                    <div className="space-y-3">
                      {sec.items.map((item) => {
                        const currentNum = ++globalCounter;
                        const text =
                          item.memory ||
                          (item as any).data ||
                          (item as any).text ||
                          (typeof item === "string" ? item : JSON.stringify(item));
                        const itemId = item.id
                          ? String(item.id)
                          : (item as any).hash
                          ? String((item as any).hash)
                          : `mem-${currentNum}`;
                        const createdAt =
                          item.updated_at ||
                          item.created_at ||
                          (item as any).metadata?.created_at ||
                          (item as any).metadata?.timestamp;
                        const formattedTime = formatFullDateTime(createdAt);

                        return (
                          <div
                            key={itemId}
                            className={cn(
                              "group relative p-4 sm:p-4.5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs",
                              "hover:border-border/80 hover:bg-card dark:hover:bg-[#1C1C1E] hover:shadow-xs transition-all duration-200"
                            )}
                          >
                            {/* 顶部元信息栏与操作按钮 */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Brain className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-[12px] font-semibold text-foreground/80 tracking-tight shrink-0">
                                  记忆 #{currentNum}
                                </span>
                                {formattedTime && (
                                  <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground/60 text-[11.5px]">
                                    <span className="text-[10px] opacity-40">•</span>
                                    <span className="inline-flex items-center gap-1 font-mono truncate">
                                      <Clock className="h-3 w-3 shrink-0 opacity-70" />
                                      <span>{formattedTime}</span>
                                    </span>
                                    {(item.updated_at || (item as any).metadata?.updated_at) && (
                                      <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground/80 shrink-0 select-none">
                                        已编辑
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Apple HIG 按钮组：编辑与删除 */}
                              <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                <ActionTooltip label="编辑记忆" side="top">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingItem(item);
                                      setEditText(text);
                                    }}
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-90 transition-all cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span className="sr-only">编辑</span>
                                  </Button>
                                </ActionTooltip>

                                <ActionTooltip label="删除记忆" side="top">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeletingId(item.id)}
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="sr-only">删除</span>
                                  </Button>
                                </ActionTooltip>
                              </div>
                            </div>

                            {/* 记忆文本正文 */}
                            <div className="mt-2.5">
                              <p className="text-[14.5px] sm:text-[15px] leading-relaxed text-foreground/90 font-normal tracking-[-0.01em] break-words whitespace-pre-wrap select-text">
                                {text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Apple HIG 标准编辑记忆弹窗 ── */}
      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-[480px] w-[92vw] rounded-[22px] border border-border/50 bg-background/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl space-y-4"
        >
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-[17px] font-semibold tracking-tight text-foreground">
                  编辑长期记忆
                </DialogTitle>
                <DialogDescription className="text-[12.5px] text-muted-foreground leading-normal mt-0.5">
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
            {/* Apple Inset 文本输入容器 */}
            <div className="rounded-xl border border-border/50 bg-muted/40 dark:bg-muted/20 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 transition-all p-3 space-y-2">
              <Textarea
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
                className="w-full bg-transparent border-0 p-0 text-[14px] leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground/60 min-h-[100px]"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 pt-2 border-t border-border/30">
                <span>支持 ⌘ + 回车 完成修改</span>
                <span>{editText.trim().length} 字</span>
              </div>
            </div>

            {/* Apple HIG 标准操作按钮组 */}
            <DialogFooter className="flex-row justify-end gap-2.5 pt-1 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(null)}
                className="h-9 px-4 rounded-xl text-[13px] font-medium border-border/50 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingEdit || !editText.trim()}
                className="h-9 px-5 rounded-xl text-[13px] font-semibold shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
              >
                {isSavingEdit ? "正在保存..." : "完成"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Apple HIG 标准删除确认弹窗 ── */}
      {deletingId && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeletingId(null);
          }}
          title="删除这条记忆"
          description="确定要从记忆库中永久移除这条记录吗？删除后 AI 将不再参考该事实，此操作无法撤销。"
          confirmText="删除"
          danger
          onConfirm={() => handleDelete(deletingId)}
        />
      )}
    </div>
  );
};

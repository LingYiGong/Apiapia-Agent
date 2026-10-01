"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest, getToken, getApiBase } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { MemoryItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  Plus,
  Trash2,
  Edit3,
  Download,
  Check,
  X,
  Sparkles,
  Clock,
} from "lucide-react";

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

export default function MemoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loadingMemories, setLoadingMemories] = useState(true);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");

  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null);
  const [editText, setEditText] = useState("");

  // 删除确认框状态（替代原生 confirm）
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortedMemories = React.useMemo(() => {
    return [...memories].sort((a, b) => {
      const timeA = new Date(a.created_at || (a as any).metadata?.created_at || a.updated_at || (a as any).metadata?.timestamp || 0).getTime();
      const timeB = new Date(b.created_at || (b as any).metadata?.created_at || b.updated_at || (b as any).metadata?.timestamp || 0).getTime();
      return timeB - timeA;
    });
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchMemories();
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setLoadingMemories(true);
    try {
      const res = await apiRequest<{ query: string; results: MemoryItem[] }>(
        `/memories/search?q=${encodeURIComponent(searchQuery)}`
      );
      setMemories(res.results || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoadingMemories(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;

    try {
      await apiRequest("/memories", {
        method: "POST",
        body: JSON.stringify({ data: newMemoryText.trim() }),
      });
      setNewMemoryText("");
      setShowAddModal(false);
      fetchMemories();
      toast.success("已添加记忆");
    } catch (err: any) {
      toast.error(err.message || "添加记忆失败");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editText.trim()) return;
    try {
      await apiRequest(`/memories/${editingItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({ data: editText.trim() }),
      });
      setEditingItem(null);
      fetchMemories();
      toast.success("已保存修改");
    } catch (err: any) {
      toast.error(err.message || "修改记忆失败");
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

  const handleExport = () => {
    const token = getToken();
    const base = getApiBase();
    // Direct link to download export JSON
    window.open(`${base}/memories/export?token=${token}`, "_blank");
  };

  if (loading || !user) return <FullPageSkeleton variant="list" />;

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      <Navbar />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/50">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-primary font-semibold mb-1 text-[13px] tracking-tight">
              <Brain className="h-4 w-4 shrink-0" />
              <span>长期记忆管理</span>
            </div>
            <h1 className="text-[28px] sm:text-3xl font-bold tracking-tight text-foreground">记忆库</h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">
              所有记忆均独立保存在本地向量数据库中，你可在此随时审查、修正或删除。
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button onClick={() => setShowAddModal(true)} size="sm" className="h-9 px-3.5 rounded-xl font-medium">
              <Plus className="h-4 w-4 shrink-0 mr-1" />
              <span>新增记忆</span>
            </Button>
            <ActionTooltip label="导出所有记忆数据为 JSON 文件" side="bottom">
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                className="h-9 px-3.5 rounded-xl font-medium"
              >
                <Download className="h-4 w-4 shrink-0 mr-1" />
                <span>导出 JSON</span>
              </Button>
            </ActionTooltip>
          </div>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mt-5 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜索记忆（如：笔记本、编程、生活习惯）..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 text-[16px] sm:text-sm rounded-xl bg-muted/40 border-border/60"
            />
          </div>
          <Button type="submit" variant="secondary" className="h-10 px-4 rounded-xl font-medium">
            搜索
          </Button>
          {isSearching && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setIsSearching(false);
                fetchMemories();
              }}
            >
              重置
            </Button>
          )}
        </form>

        {/* Memories List */}
        <div className="mt-6">
          {loadingMemories ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 sm:p-5 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedMemories.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Sparkles className="h-10 w-10 text-primary/50 mx-auto mb-3" />
                <h3 className="text-sm font-semibold">
                  {isSearching ? "未找到符合条件的记忆" : "记忆库为空"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  在对话中提及关于你的事实，或点击上方“手动新增记忆”按钮直接添加。
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedMemories.map((item, idx) => {
                const text = item.memory || (item as any).text || JSON.stringify(item);
                const itemId = item.id ? String(item.id) : (item as any).hash ? String((item as any).hash) : `mem-${idx}`;
                const isEditing = editingItem?.id === item.id;
                const createdAt = item.created_at || (item as any).metadata?.created_at || item.updated_at || (item as any).metadata?.timestamp;
                const formattedTime = formatFullDateTime(createdAt);

                return (
                  <Card
                    key={itemId}
                    className="group hover:shadow-sm transition-all"
                  >
                    <CardContent className="p-4 sm:p-5">
                      {isEditing ? (
                        <div className="space-y-3">
                          <Textarea
                            rows={4}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="leading-relaxed"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingItem(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>取消</span>
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>保存修改</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Metadata row */}
                            <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px] text-muted-foreground">
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                #{idx + 1}
                              </Badge>
                              {formattedTime && (
                                <Badge variant="outline" className="font-mono text-muted-foreground">
                                  <Clock className="h-3 w-3 shrink-0 mr-1" />
                                  <span>{formattedTime}</span>
                                </Badge>
                              )}
                              <span className="font-mono text-[10px] text-muted-foreground hidden md:inline">
                                ID: {itemId.slice(0, 12)}...
                              </span>
                            </div>

                            {/* Full memory content */}
                            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap select-text">
                              {text}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0 self-end sm:self-start pt-1 sm:pt-0 border-t sm:border-t-0 w-full sm:w-auto justify-end">
                            <ActionTooltip label="编辑修正记忆" side="top">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingItem(item);
                                  setEditText(text);
                                }}
                              >
                                <Edit3 className="h-4 w-4" />
                                <span className="sr-only">编辑记忆</span>
                              </Button>
                            </ActionTooltip>
                            <ActionTooltip label="删除记忆" side="top">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingId(item.id)}
                                className="hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">删除记忆</span>
                              </Button>
                            </ActionTooltip>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
      </div>

      {/* Delete Confirm Dialog */}
      {deletingId && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeletingId(null);
          }}
          title="删除这条记忆"
          description="确定要删除这条长期记忆吗？删除后 AI 将不再参考它，该操作不可恢复。"
          confirmText="删除"
          danger
          onConfirm={() => handleDelete(deletingId)}
        />
      )}

      {/* Add Memory Dialog */}      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增记忆</DialogTitle>
            <DialogDescription>
              直接向记忆库写入一条事实。AI 将在后续回答中参考该信息。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMemory} className="space-y-4">
            <Textarea
              required
              rows={4}
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              placeholder="例如：我日常开发使用 Mac OS 和 Python，喜欢简洁的代码风格..."
              className="text-xs"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                取消
              </Button>
              <Button type="submit">
                确认添加
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

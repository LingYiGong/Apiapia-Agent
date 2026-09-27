"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest, getToken, getApiBase } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { MemoryItem } from "@/types";
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
} from "lucide-react";

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
    } catch (err: any) {
      alert(err.message || "添加记忆失败");
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
    } catch (err: any) {
      alert(err.message || "修改记忆失败");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条长期记忆吗？")) return;
    try {
      await apiRequest(`/memories/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert(err.message || "删除记忆失败");
    }
  };

  const handleExport = () => {
    const token = getToken();
    const base = getApiBase();
    // Direct link to download export JSON
    window.open(`${base}/memories/export?token=${token}`, "_blank");
  };

  if (loading || !user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1">
              <Brain className="h-5 w-5" />
              <span>Mem0 长期记忆管理</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">AI 记住的事实与偏好</h1>
            <p className="text-xs text-slate-400 mt-1">
              所有记忆均独立持久化保存在本地 pgvector 中，你可在此随时审查、修正或删除。
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>手动新增记忆</span>
            </button>
            <button
              onClick={handleExport}
              title="导出所有记忆数据 (JSON)"
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>导出 JSON</span>
            </button>
          </div>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索长期记忆（如：笔记本、编程、生活习惯）..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-800 border border-slate-700 px-5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            搜索
          </button>
          {isSearching && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setIsSearching(false);
                fetchMemories();
              }}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-slate-400 hover:text-white transition-colors"
            >
              重置
            </button>
          )}
        </form>

        {/* Memories List */}
        <div className="mt-6">
          {loadingMemories ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : memories.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center">
              <Sparkles className="h-10 w-10 text-indigo-400/40 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">
                {isSearching ? "未找到符合条件的长期记忆" : "当前记忆库为空"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                在对话中提及关于你的事实，或点击上方“手动新增记忆”按钮直接添加。
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {memories.map((item, idx) => {
                const text = item.memory || (item as any).text || JSON.stringify(item);
                const itemId = item.id ? String(item.id) : (item as any).hash ? String((item as any).hash) : `mem-${idx}`;
                const isEditing = editingItem?.id === item.id;

                return (
                  <div
                    key={itemId}
                    className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm hover:border-slate-700 transition-all"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          rows={3}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full rounded-xl border border-indigo-500/50 bg-slate-950 p-2.5 text-xs text-white focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingItem(null)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 text-xs flex items-center gap-1"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>取消</span>
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            className="p-1.5 rounded-lg bg-indigo-600 text-white text-xs flex items-center gap-1 hover:bg-indigo-500"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>保存</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-slate-200 leading-relaxed break-words">{text}</p>
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">ID: {itemId.slice(0, 8)}...</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setEditText(text);
                              }}
                              title="编辑修正记忆"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              title="删除记忆"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">手动添加长期记忆</h3>
            <p className="text-xs text-slate-400 mb-4">
              直接向 pgvector 记忆库写入一条事实。AI 将在后续所有模型回答中参考该信息。
            </p>
            <form onSubmit={handleAddMemory} className="space-y-4">
              <textarea
                required
                rows={4}
                value={newMemoryText}
                onChange={(e) => setNewMemoryText(e.target.value)}
                placeholder="例如：我日常开发使用 Mac OS 和 Python，喜欢简洁的代码风格..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all"
                >
                  确认添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

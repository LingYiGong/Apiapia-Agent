"use client";

import React, { useState, useRef, useEffect } from "react";
import { ModelCatalogItem } from "@/types";
import { Cpu, ChevronDown, Search, Check, Zap, AlertTriangle } from "lucide-react";

export function isFreeModel(m: ModelCatalogItem): boolean {
  if (m.is_free) return true;
  const id = (m.id || "").toLowerCase();
  const name = (m.name || "").toLowerCase();
  return (
    id.endsWith(":free") ||
    id.includes(":free") ||
    id.includes("/free") ||
    name.includes("(free)") ||
    name.includes("free") ||
    name.includes("免费") ||
    m.provider === "ollama"
  );
}

interface ModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  models: ModelCatalogItem[];
  placeholder?: string;
  className?: string;
}

export const ModelSelect: React.FC<ModelSelectProps> = ({
  value,
  onChange,
  models,
  placeholder = "请选择模型",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input on open
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Esc key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const selectedModel = models.find((m) => m.id === value);

  // Distinct providers
  const distinctProviders = Array.from(
    new Set(models.map((m) => m.provider).filter(Boolean))
  );

  const hasFreeModels = models.some(isFreeModel);
  const freeModelsCount = models.filter(isFreeModel).length;

  // Filter
  const filtered = models.filter((m) => {
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      m.id.toLowerCase().includes(query) ||
      m.name.toLowerCase().includes(query) ||
      (m.provider && m.provider.toLowerCase().includes(query)) ||
      (m.description && m.description.toLowerCase().includes(query));

    const matchesProvider =
      providerFilter === "all" ||
      (providerFilter === "free" && isFreeModel(m)) ||
      (m.provider && m.provider.toLowerCase() === providerFilter.toLowerCase());

    return matchesSearch && matchesProvider;
  });

  // Sort with free models first
  const sorted = [...filtered].sort((a, b) => {
    const aFree = isFreeModel(a);
    const bFree = isFreeModel(b);
    if (aFree && !bFree) return -1;
    if (!aFree && bFree) return 1;
    return 0;
  });

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white hover:border-indigo-500/80 transition-all text-left shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 shrink-0">
            <Cpu className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold truncate">
                {selectedModel ? selectedModel.name : value || placeholder}
              </span>
              {selectedModel && isFreeModel(selectedModel) && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                  免费
                </span>
              )}
              {selectedModel?.provider && (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700/60 shrink-0">
                  {selectedModel.provider}
                </span>
              )}
            </div>
            {selectedModel ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                {selectedModel.id} {selectedModel.description && `· ${selectedModel.description}`}
              </p>
            ) : value ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                {value}
              </p>
            ) : null}
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-indigo-600 dark:text-indigo-400" : ""
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl backdrop-blur-md p-3 z-50 flex flex-col max-h-96 animate-in fade-in zoom-in-95 duration-150">
          {/* Search Input */}
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索模型（如：free, deepseek, gpt...）"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Filter Pills */}
          {(distinctProviders.length > 1 || hasFreeModels) && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setProviderFilter("all")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                  providerFilter === "all"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                全部 ({models.length})
              </button>

              {hasFreeModels && (
                <button
                  type="button"
                  onClick={() => setProviderFilter("free")}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                    providerFilter === "free"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/50"
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  免费 ({freeModelsCount})
                </button>
              )}

              {distinctProviders.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProviderFilter(p)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase font-mono transition-colors ${
                    providerFilter === p
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Model Items List */}
          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {sorted.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {models.length === 0 ? (
                  <div className="space-y-2 p-2">
                    <AlertTriangle className="h-6 w-6 text-amber-500/80 mx-auto" />
                    <p className="text-slate-800 dark:text-slate-300 font-medium">暂无可用的已配置模型</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      请在下方“自定义模型与 API 凭证”中配置，或在后端 .env 中添加。
                    </p>
                  </div>
                ) : (
                  "未找到匹配的模型"
                )}
              </div>
            ) : (
              sorted.map((m) => {
                const isSelected = m.id === value;
                const free = isFreeModel(m);
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/40 text-indigo-950 dark:text-white"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                          {m.name}
                        </span>
                        {free && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                            免费
                          </span>
                        )}
                        {m.provider && (
                          <span className="text-[9px] uppercase font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 shrink-0">
                            {m.provider}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5">
                        {m.id}
                      </p>
                      {m.description && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {m.description}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

"use client";

import React, { useState, useRef, useEffect } from "react";
import { ModelCatalogItem } from "@/types";
import { Cpu, ChevronDown, Search, Check, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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

export function isMultimodalModel(m: ModelCatalogItem): boolean {
  if (m.is_multimodal !== undefined) return m.is_multimodal;
  const id = (m.id || "").toLowerCase();
  const name = (m.name || "").toLowerCase();
  const desc = (m.description || "").toLowerCase();

  return (
    id.includes("vision") ||
    id.includes("-vl") ||
    id.includes("_vl") ||
    id.includes("vl-") ||
    id.includes("multimodal") ||
    id.includes("4o") ||
    id.includes("gemini") ||
    id.includes("claude-3") ||
    id.includes("pixtral") ||
    id.includes("llava") ||
    id.includes("minicpm-v") ||
    name.includes("vision") ||
    name.includes("多模态") ||
    desc.includes("多模态") ||
    desc.includes("视觉")
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
      (providerFilter === "multimodal" && isMultimodalModel(m)) ||
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
    <div className={cn("relative", className)} ref={containerRef}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        className="w-full h-auto justify-between gap-3 p-3 text-left shadow-xs"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border shrink-0">
            <Cpu className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold truncate">
                {selectedModel ? selectedModel.name : value || placeholder}
              </span>
              {selectedModel && isFreeModel(selectedModel) && (
                <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                  免费
                </Badge>
              )}
              {selectedModel && isMultimodalModel(selectedModel) && (
                <Badge className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/10">
                  多模态
                </Badge>
              )}
              {selectedModel?.provider && (
                <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                  {selectedModel.provider}
                </Badge>
              )}
            </div>
            {selectedModel ? (
              <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                {selectedModel.id} {selectedModel.description && `· ${selectedModel.description}`}
              </p>
            ) : value ? (
              <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                {value}
              </p>
            ) : null}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            open && "rotate-180 text-primary"
          )}
        />
      </Button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border bg-popover shadow-2xl p-3 z-50 flex flex-col max-h-96 animate-in fade-in zoom-in-95 duration-150">
          {/* Search Input */}
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder="搜索模型（如：free, deepseek, gpt...）"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>

          {/* Filter Pills */}
          {(distinctProviders.length > 1 || hasFreeModels) && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                <Badge
                  className="cursor-pointer"
                  variant={providerFilter === "all" ? "default" : "secondary"}
                  onClick={() => setProviderFilter("all")}
                >
                  全部 ({models.length})
                </Badge>

                {hasFreeModels && (
                  <Badge
                    className={cn(
                      "cursor-pointer",
                      providerFilter === "free"
                        ? "bg-emerald-600 text-white hover:bg-emerald-600/90 border-transparent"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                    )}
                    onClick={() => setProviderFilter("free")}
                  >
                    <Zap className="h-3 w-3 mr-0.5" />
                    免费 ({freeModelsCount})
                  </Badge>
                )}

                {models.some(isMultimodalModel) && (
                  <Badge
                    className={cn(
                      "cursor-pointer",
                      providerFilter === "multimodal"
                        ? "bg-violet-600 text-white hover:bg-violet-600/90 border-transparent"
                        : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/20"
                    )}
                    onClick={() => setProviderFilter("multimodal")}
                  >
                    多模态 ({models.filter(isMultimodalModel).length})
                  </Badge>
                )}

                {distinctProviders.map((p) => (
                  <Badge
                    key={p}
                    className="cursor-pointer uppercase font-mono"
                    variant={providerFilter === p ? "default" : "secondary"}
                    onClick={() => setProviderFilter(p)}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
              <Separator className="mb-2.5" />
            </>
          )}

          {/* Model Items List (native scroll: Radix ScrollArea can't measure
              an auto-height absolute panel, so it never becomes scrollable here) */}
          <div className="overflow-y-auto max-h-64">
            <div className="space-y-1 pr-1">
              {sorted.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {models.length === 0 ? (
                    <div className="space-y-2 p-2">
                      <AlertTriangle className="h-6 w-6 text-amber-500/80 mx-auto" />
                      <p className="font-medium text-foreground">暂无可用的已配置模型</p>
                      <p className="text-[11px] leading-relaxed">
                        请在后端 .env 中配置提供商 API Key，然后点击「同步最新模型」。
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
                  const isMM = isMultimodalModel(m);
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border",
                        isSelected
                          ? "bg-accent border-primary/30"
                          : "hover:bg-accent/60 border-transparent"
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold truncate group-hover:text-primary">
                            {m.name}
                          </span>
                          {free && (
                            <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                              免费
                            </Badge>
                          )}
                          {isMM && (
                            <Badge className="text-[9px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/10">
                              多模态
                            </Badge>
                          )}
                          {m.provider && (
                            <Badge variant="secondary" className="text-[9px] uppercase font-mono">
                              {m.provider}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                          {m.id}
                        </p>
                        {m.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {m.description}
                          </p>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

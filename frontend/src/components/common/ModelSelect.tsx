"use client";

import React, { useState, useRef } from "react";
import { ModelCatalogItem } from "@/types";
import { Cpu, ChevronDown, Search, Check, Zap, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
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
  variant?: "default" | "compact";
}

export const ModelSelect: React.FC<ModelSelectProps> = ({
  value,
  onChange,
  models,
  placeholder = "请选择模型",
  className = "",
  variant = "default",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    return a.name.localeCompare(b.name);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "compact" ? (
          /* ── Apple HIG Standard Capsule / Pill Trigger ── */
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-8 px-3 rounded-full bg-muted/70 hover:bg-muted/90 active:scale-95 border border-border/60 transition-all flex items-center justify-between gap-1.5 select-none cursor-pointer shadow-2xs max-w-full group",
              open && "bg-muted/90 ring-2 ring-primary/20 border-primary/40",
              className
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              <span className="truncate font-semibold text-[13px] tracking-tight text-foreground">
                {selectedModel ? selectedModel.name : value || placeholder}
              </span>
              {selectedModel && isFreeModel(selectedModel) && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                  title="免费模型"
                />
              )}
            </div>

            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground/80 shrink-0 transition-transform duration-200 ml-0.5",
                open && "rotate-180 text-foreground"
              )}
            />
          </button>
        ) : (
          /* ── Modern Form Variant (Clean Single-line Select Trigger) ── */
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full h-9 sm:h-9.5 justify-between px-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 transition-all active:scale-[0.99] flex items-center text-left shadow-2xs gap-2 select-none cursor-pointer group",
              open && "bg-muted/60 ring-2 ring-primary/20 border-primary/40",
              className
            )}
          >
            <span className="text-[13px] font-medium truncate text-foreground min-w-0 flex-1">
              {selectedModel ? selectedModel.name : value || placeholder}
            </span>

            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ml-1",
                open && "rotate-180 text-foreground"
              )}
            />
          </button>
        )}
      </PopoverTrigger>

      {/* ── Apple HIG Standard Popover Sheet ── */}
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "rounded-[22px] border border-border/50 bg-background/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-3 pt-3.5 z-50 flex flex-col max-h-[75vh]",
          variant === "compact"
            ? "w-[calc(100vw-24px)] max-w-[390px] sm:w-[420px]"
            : "w-[calc(100vw-24px)] max-w-[500px]"
        )}
      >
        {/* Header Title & Counter */}
        <div className="flex items-center justify-between px-1 pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-foreground tracking-tight">
              选择模型
            </span>
            <span className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded-full">
              {sorted.length}
            </span>
          </div>
          {selectedModel && (
            <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[170px]">
              当前: {selectedModel.name}
            </span>
          )}
        </div>

        {/* Apple Style Search Input */}
        <div className="relative mb-2.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="搜索模型（如：free, deepseek, 4o...）"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-8.5 text-[13px] rounded-xl bg-muted/60 dark:bg-[#2c2c2e]/70 border-0 focus-visible:ring-1 focus-visible:ring-primary/40 placeholder:text-muted-foreground/60"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Apple Segmented / Pill Filter Buttons */}
        {(distinctProviders.length > 1 || hasFreeModels) && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5 pt-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setProviderFilter("all")}
              className={cn(
                "h-7 px-2.5 rounded-full text-[11px] font-medium transition-all shrink-0 active:scale-95",
                providerFilter === "all"
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "bg-muted/60 dark:bg-[#2c2c2e]/60 text-muted-foreground hover:text-foreground"
              )}
            >
              全部 ({models.length})
            </button>

            {hasFreeModels && (
              <button
                type="button"
                onClick={() => setProviderFilter("free")}
                className={cn(
                  "h-7 px-2.5 rounded-full text-[11px] font-medium transition-all shrink-0 active:scale-95 flex items-center gap-1",
                  providerFilter === "free"
                    ? "bg-emerald-600 text-white font-semibold shadow-xs"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                )}
              >
                <Zap className="h-3 w-3" />
                <span>免费 ({freeModelsCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setProviderFilter("multimodal")}
              className={cn(
                "h-7 px-2.5 rounded-full text-[11px] font-medium transition-all shrink-0 active:scale-95 flex items-center gap-1",
                providerFilter === "multimodal"
                  ? "bg-violet-600 text-white font-semibold shadow-xs"
                  : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500/20"
              )}
            >
              <Sparkles className="h-3 w-3" />
              <span>多模态</span>
            </button>

            {distinctProviders.map((prov) => (
              <button
                key={prov}
                type="button"
                onClick={() => setProviderFilter(prov!)}
                className={cn(
                  "h-7 px-2.5 rounded-full text-[11px] font-medium uppercase font-mono transition-all shrink-0 active:scale-95",
                  providerFilter === prov
                    ? "bg-foreground text-background font-semibold shadow-xs"
                    : "bg-muted/60 dark:bg-[#2c2c2e]/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {prov}
              </button>
            ))}
          </div>
        )}

        <div className="border-b border-border/40 mb-1.5" />

        {/* Apple Table View Model List */}
        <div
          className="overflow-y-auto flex-1 min-h-0 max-h-[50vh] space-y-1 pr-1 overscroll-contain touch-pan-y"
          onWheel={(e) => e.stopPropagation()}
        >
          {sorted.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              未找到匹配的模型
            </div>
          ) : (
            sorted.map((m) => {
              const isSelected = m.id === value;
              const isFree = isFreeModel(m);
              const isMulti = isMultimodalModel(m);

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "p-2.5 sm:px-3 rounded-xl cursor-pointer text-xs transition-all flex items-center justify-between gap-2.5 active:scale-[0.99]",
                    isSelected
                      ? "bg-primary/10 dark:bg-primary/15 text-primary font-medium border border-primary/25"
                      : "hover:bg-muted/60 dark:hover:bg-[#2c2c2e]/50 border border-transparent"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("font-semibold tracking-tight", isSelected ? "text-primary" : "text-foreground")}>
                        {m.name}
                      </span>
                      {isFree && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-medium">
                          免费
                        </span>
                      )}
                      {isMulti && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/25 font-medium">
                          多模态
                        </span>
                      )}
                      {m.provider && (
                        <span className="text-[9px] px-1 py-0.5 rounded uppercase font-mono bg-muted/80 text-muted-foreground">
                          {m.provider}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                      {m.id}
                    </p>
                    {m.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">
                        {m.description}
                      </p>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0 stroke-[2.5]" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

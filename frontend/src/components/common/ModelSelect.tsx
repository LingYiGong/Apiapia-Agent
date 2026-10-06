"use client";

import React, { useState, useRef, useEffect } from "react";
import { ModelCatalogItem } from "@/types";
import { Cpu, ChevronDown, Search, Check, Zap, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ActionTooltip } from "@/components/common/ActionTooltip";
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
    id === "openrouter/free" ||
    id.includes("openrouter/free") ||
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

/**
 * 识别精选精品模型：
 * 涵盖一线知名大厂的主力旗舰与稳定高品质模型，过滤掉数百个冷门测试/小众微调模型。
 */
export function isFeaturedModel(m: ModelCatalogItem): boolean {
  const id = (m.id || "").toLowerCase();
  const name = (m.name || "").toLowerCase();

  // 1. 官方免费聚合模型
  if (id === "openrouter/free" || id.includes("openrouter/free")) return true;

  // 2. OpenAI 核心精品 (GPT-4o, 4o-mini, o1, o3-mini, 4.5)
  if (
    id.startsWith("openai/") ||
    m.provider === "openai" ||
    id.startsWith("gpt-") ||
    id.startsWith("o1") ||
    id.startsWith("o3")
  ) {
    if (
      id.includes("4o") ||
      id.includes("o1") ||
      id.includes("o3") ||
      id.includes("4.5")
    ) {
      if (!id.includes("ft:") && !id.includes("realtime") && !id.includes("audio")) {
        return true;
      }
    }
  }

  // 3. Anthropic Claude 3.5 / 3.7 系列旗舰
  if (id.startsWith("anthropic/") || m.provider === "anthropic" || id.includes("claude")) {
    if (
      id.includes("claude-3-5") ||
      id.includes("claude-3.5") ||
      id.includes("claude-3-7") ||
      id.includes("claude-3.7") ||
      id.includes("claude-3-opus") ||
      id.includes("claude-3-haiku")
    ) {
      return true;
    }
  }

  // 4. Google Gemini 2.5 / 2.0 / 1.5 系列主力
  if (id.startsWith("google/") || m.provider === "gemini" || id.includes("gemini")) {
    if (
      id.includes("gemini-2.5") ||
      id.includes("gemini-2.0") ||
      id.includes("gemini-1.5-pro") ||
      id.includes("gemini-1.5-flash")
    ) {
      return true;
    }
  }

  // 5. DeepSeek 官方主力 (V3 & R1)
  if (id.startsWith("deepseek/") || id.includes("deepseek")) {
    if (
      id.includes("chat") ||
      id.includes("reasoner") ||
      id.includes("v3") ||
      id.includes("r1")
    ) {
      return true;
    }
  }

  // 6. Meta Llama 官方主力 (3.3 70B, 3.1 70B/405B)
  if (id.startsWith("meta-llama/") || id.includes("llama-3.3") || id.includes("llama-3.1-70b")) {
    if (id.includes("instruct") || id.includes("70b") || id.includes("405b")) {
      return true;
    }
  }

  // 7. Qwen 阿里通义千问 2.5 官方主力
  if (id.startsWith("qwen/") || id.includes("qwen-2.5") || id.includes("qwq")) {
    if (id.includes("72b") || id.includes("coder") || id.includes("qwq")) {
      return true;
    }
  }

  // 8. Mistral 官方主力
  if (id.startsWith("mistralai/") && (id.includes("mistral-large") || id.includes("codestral"))) {
    return true;
  }

  return false;
}

/**
 * 模型优先级排序评分：
 * 越小越靠前，用于把精选精品模型与推荐模型排在最前
 */
export function getModelPriorityScore(m: ModelCatalogItem): number {
  const id = (m.id || "").toLowerCase();

  // 1. openrouter/free (新用户首选与免费体验)
  if (id === "openrouter/free" || id.includes("openrouter/free")) return 0;

  // 2. Anthropic Claude 顶级旗舰 (3.7 Sonnet / 3.5 Sonnet)
  if (
    id.includes("claude-3-7-sonnet") ||
    id.includes("claude-3.7-sonnet") ||
    id.includes("claude-3-5-sonnet") ||
    id.includes("claude-3.5-sonnet")
  ) {
    return 1;
  }

  // 3. OpenAI 顶级旗舰 (GPT-4o, o3-mini, o1)
  if (id.includes("gpt-4o") && !id.includes("mini")) return 2;
  if (id.includes("o3-mini") || id.includes("o1")) return 3;
  if (id.includes("gpt-4o-mini")) return 4;

  // 4. DeepSeek 官方主力 (DeepSeek V3 / R1)
  if (
    id.includes("deepseek-chat") ||
    id.includes("deepseek-r1") ||
    id.includes("deepseek-v3") ||
    id.includes("deepseek/deepseek-r1")
  ) {
    return 5;
  }

  // 5. Google Gemini 顶级旗舰 (Gemini 2.5 / 2.0 / 1.5 Pro)
  if (
    id.includes("gemini-2.5") ||
    id.includes("gemini-2.0-pro") ||
    id.includes("gemini-2.0-flash") ||
    id.includes("gemini-1.5-pro")
  ) {
    return 6;
  }

  // 6. 其他精选模型 (Llama 3.3, Qwen 2.5, Mistral Large, etc.)
  if (isFeaturedModel(m)) return 10;

  // 7. 其他免费模型
  if (isFreeModel(m)) return 20;

  // 8. 其他海量模型
  return 30;
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const featuredModelsCount = models.filter(isFeaturedModel).length;
  const hasFeaturedModels = featuredModelsCount > 0;
  const hasFreeModels = models.some(isFreeModel);
  const freeModelsCount = models.filter(isFreeModel).length;

  // 默认分类：第 1 个免费（如有），第 2 个精选（如有），否则全部
  const [providerFilter, setProviderFilter] = useState<string>(() => {
    return hasFreeModels ? "free" : (hasFeaturedModels ? "featured" : "all");
  });
  const hasAutoSwitchedToDefault = useRef(false);

  useEffect(() => {
    if (!hasAutoSwitchedToDefault.current && models.length > 0) {
      setProviderFilter(hasFreeModels ? "free" : (hasFeaturedModels ? "featured" : "all"));
      hasAutoSwitchedToDefault.current = true;
    }
  }, [models.length, hasFreeModels, hasFeaturedModels]);

  const selectedModel = models.find((m) => m.id === value);

  // Filter
  const filtered = models.filter((m) => {
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      m.id.toLowerCase().includes(query) ||
      m.name.toLowerCase().includes(query) ||
      (m.provider && m.provider.toLowerCase().includes(query)) ||
      (m.description && m.description.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    // 当用户主动输入关键词搜索时，在全局所有模型中搜索，最快找到所需模型
    if (query) {
      return true;
    }

    const matchesProvider =
      providerFilter === "all" ||
      (providerFilter === "free" && isFreeModel(m)) ||
      (providerFilter === "featured" && isFeaturedModel(m));

    return matchesProvider;
  });

  // Sort: openrouter/free first, then flagship models, other featured, other free, then others
  const sorted = [...filtered].sort((a, b) => {
    const scoreA = getModelPriorityScore(a);
    const scoreB = getModelPriorityScore(b);
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
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
                // Sits inside the trigger <button>, so it stays non-focusable to
                // avoid nested interactive content. role/aria-label still feed
                // the button's accessible name.
                <ActionTooltip label="免费模型">
                  <span
                    role="img"
                    aria-label="免费模型"
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                  />
                </ActionTooltip>
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
            {sorted.length > 0 && sorted.every(isFreeModel) && (
              <ActionTooltip label="当前处于体验模式，仅可使用免费模型，联系管理员可开通完整体验">
                <Badge
                  variant="outline"
                  tabIndex={0}
                  className="text-[10px] font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-1.5 py-0 rounded-full shadow-none cursor-help"
                >
                  体验模式
                </Badge>
              </ActionTooltip>
            )}
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
            placeholder="搜索模型"
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

        {/* Apple Segmented / Pill Filter Buttons: 1.免费 2.精选 3.全部 */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5 pt-0.5 shrink-0">
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

          {hasFeaturedModels && (
            <button
              type="button"
              onClick={() => setProviderFilter("featured")}
              className={cn(
                "h-7 px-2.5 rounded-full text-[11px] font-medium transition-all shrink-0 active:scale-95 flex items-center gap-1",
                providerFilter === "featured"
                  ? "bg-amber-500 text-white font-semibold shadow-xs"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
              )}
            >
              <Sparkles className="h-3 w-3" />
              <span>精选 ({featuredModelsCount})</span>
            </button>
          )}

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
        </div>

        <div className="border-b border-border/40 mb-1.5" />

        {/* Apple Table View Model List */}
        <div
          className="overflow-y-auto flex-1 min-h-0 max-h-[50vh] space-y-1 pr-1 overscroll-contain touch-pan-y"
          onWheel={(e) => e.stopPropagation()}
        >
          {sorted.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              <div>未找到匹配的模型</div>
              {providerFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setProviderFilter("all")}
                  className="mt-2 text-primary underline text-xs hover:opacity-80 active:scale-95 inline-block cursor-pointer"
                >
                  在全部 {models.length} 个模型中查找
                </button>
              )}
            </div>
          ) : (
            sorted.map((m) => {
              const isSelected = m.id === value;
              const isFree = isFreeModel(m);
              const isMulti = isMultimodalModel(m);
              const isFeatured = isFeaturedModel(m);

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
                      {isFeatured && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-medium flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" />
                          精选
                        </span>
                      )}
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

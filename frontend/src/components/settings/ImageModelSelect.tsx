"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ImageModelItem } from "@/types";
import { Palette, ChevronDown, Search, Check, Zap, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ImageModelSelectProps {
  value: string | null;
  onChange: (modelId: string) => void;
  models: ImageModelItem[];
  placeholder?: string;
  loading?: boolean;
  synced?: boolean;
  className?: string;
  isTrialMode: boolean;
}

export const ImageModelSelect: React.FC<ImageModelSelectProps> = ({
  value,
  onChange,
  models,
  placeholder = "选择绘图模型",
  loading = false,
  synced = true,
  className,
  isTrialMode,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useRef(`image-model-listbox-${Math.random().toString(36).slice(2)}`);
  // 同 ModelSelect：用下标做选项 id，避免模型 id 字符替换后撞 id
  const optionId = (idx: number) => `${listboxId.current}-opt-${idx}`;
  const [activeIndex, setActiveIndex] = useState(-1);

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? models.filter(
          (m) =>
            m.id.toLowerCase().includes(q) ||
            (m.name || "").toLowerCase().includes(q) ||
            (m.provider || "").toLowerCase().includes(q),
        )
      : models;
    // Free models first, mirroring the language model catalog ordering.
    return [...filtered].sort((a, b) => {
      if (a.is_free !== b.is_free) return a.is_free ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  }, [models, search]);

  const selectedModel = models.find((m) => m.id === value) || null;

// Matches the language model selector: clicking a row selects it.
  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setOpen(false);
  };

  // 打开时清空搜索、把焦点交给搜索框，并把高亮对齐到当前选中项
  // （同 ModelSelect 的 ARIA combobox 模式）。
  // 依赖刻意只写 [open]：sorted / value 变化不应在用户浏览列表时抢走焦点。
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setActiveIndex(sorted.findIndex((m) => m.id === value));
    const t = setTimeout(() => searchInputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (sorted.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(sorted.length - 1, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev <= 0 ? 0 : prev - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(sorted.length - 1);
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < sorted.length) {
      e.preventDefault();
      handleSelect(sorted[activeIndex].id);
    }
  };

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const activeOptionId =
    open && activeIndex >= 0 && activeIndex < sorted.length
      ? optionId(activeIndex)
      : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="选择绘图模型"
          disabled={loading}
          className={cn(
            "w-full h-9 sm:h-[38px] justify-between px-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 transition-all active:scale-[0.99] flex items-center text-left shadow-2xs gap-2 select-none cursor-pointer group",
            open && "bg-muted/60 ring-2 ring-primary/20 border-primary/40",
            loading && "opacity-60 cursor-not-allowed",
            className,
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            {selectedModel ? (
              <>
                <Palette className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-[13px] font-medium truncate text-foreground">
                  {selectedModel.name}
                </span>
                {selectedModel.is_free && (
                  // Inside the trigger <button>: keep it non-focusable, but
                  // role/aria-label still reach the button's accessible name.
                  <ActionTooltip label="免费模型">
                    <span
                      role="img"
                      aria-label="免费模型"
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                    />
                  </ActionTooltip>
                )}
              </>
            ) : value ? (
              // Stored selection that is not in the catalog yet (e.g. before the
              // first sync); show the raw id instead of hiding the value.
              <span className="text-[13px] font-medium truncate text-foreground font-mono">
                {value}
              </span>
            ) : (
              <span className="text-[13px] font-medium truncate text-muted-foreground">
                {loading ? "加载中..." : placeholder}
              </span>
            )}
          </div>

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ml-1",
              open && "rotate-180 text-foreground",
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[calc(100vw-24px)] max-w-[390px] sm:w-[420px] rounded-[22px] border border-border/50 bg-background/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-3 pt-3.5 z-50 flex flex-col max-h-[75vh]"
      >
        {/* Header Title & Counter */}
        <div className="flex items-center justify-between px-1 pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-foreground tracking-tight">
              选择绘图模型
            </span>
            <span className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded-full">
              {models.length}
            </span>
            {isTrialMode && (
              <ActionTooltip label="当前处于体验模式，仅可使用免费绘图模型">
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
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId.current}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-label="搜索绘图模型"
            placeholder="搜索绘图模型"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(
                e.target.value ? 0 : sorted.findIndex((m) => m.id === value)
              );
            }}
            onKeyDown={handleListKeyDown}
            className="pl-9 pr-8 h-[34px] text-[13px] rounded-xl bg-muted/60 dark:bg-[#2c2c2e]/70 border-0 focus-visible:ring-1 focus-visible:ring-primary/40 placeholder:text-muted-foreground/60"
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

        {/* 此前选项行有 role="option" 却没有 role="listbox" 父容器，
            也没有 tabIndex / 方向键处理，键盘用户无法选模型。 */}
        <div
          id={listboxId.current}
          role="listbox"
          aria-label="绘图模型列表"
          className="overflow-y-auto overscroll-contain flex-1 -mx-1 px-1 no-scrollbar"
        >
          {models.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground leading-relaxed">
              {!synced
                ? "绘图模型列表尚未同步，请点击列表上方的「同步列表」按钮完成一次同步。"
                : isTrialMode
                  ? "当前无可用免费绘图模型，请联系管理员在 FREE_IMAGE_MODELS 中登记免费模型。"
                  : "后端已同步但无可用模型，请检查 .env 中的生图服务凭证是否仍然有效。"}
            </p>
          ) : sorted.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              未找到匹配的绘图模型
            </p>
          ) : (
            sorted.map((m, mIdx) => {
              const isSelected = m.id === value;
              const isActive = mIdx === activeIndex;

              return (
                <div
                  key={m.id}
                  id={optionId(mIdx)}
                  onClick={() => handleSelect(m.id)}
                  onMouseMove={() => setActiveIndex(mIdx)}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "p-2.5 sm:px-3 rounded-xl cursor-pointer text-xs transition-all flex items-center justify-between gap-2.5 active:scale-[0.99]",
                    isActive && !isSelected && "bg-muted/60 dark:bg-[#2c2c2e]/50",
                    isSelected
                      ? "bg-primary/10 dark:bg-primary/15 text-primary font-medium border border-primary/25"
                      : "border border-transparent",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          "font-semibold tracking-tight",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {m.name}
                      </span>
                      {m.is_free && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-medium">
                          免费
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

                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0 stroke-[2.5]" />}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
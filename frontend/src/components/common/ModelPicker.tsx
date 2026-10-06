"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  ChevronDown,
  Search,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ModelOption } from "@/lib/models";

/**
 * 语言模型与绘图模型共用的选择器实现。
 *
 * 这两个选择器此前是两个各自 260~640 行的文件，其中弹层外壳、头部计数、
 * 搜索框、选项行、空状态、以及整套 ARIA combobox 键盘交互几乎逐字重复。
 * 现在只有这一份实现，ModelSelect / ImageModelSelect 退化为
 * 「把各自 API 返回体归一化 + 传配置」的薄包装，调用点无需改动。
 *
 * 排序由适配器（lib/models.ts）预先算好 `rank`；本组件只负责筛选与渲染。
 */

export interface ModelFilterGroup {
  key: string;
  label: string;
  /** 该分组命中全部选项时的提示色 */
  tone: "free" | "featured" | "all";
  icon?: React.ElementType;
  count: number;
  /** 是否命中任何一条选项；为 false 时该分组不渲染 */
  available: boolean;
  match: (o: ModelOption) => boolean;
}

export interface ModelPickerProps {
  /** 允许 null：绘图模型在用户尚未选择时就是空值 */
  value: string | null;
  onChange: (modelId: string) => void;
  options: ModelOption[];
  /** 无障碍与文案前缀，例如 语言模型 / 绘图模型 */
  kindLabel: string;
  /**
   * 供屏幕阅读器播报的名称。默认跟随 kindLabel，但语言模型历史上可见标题是
   * 「模型」、无障碍名称却是「语言模型」，两者刻意保持原样，故分开提供。
   */
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  variant?: "default" | "compact";
  disabled?: boolean;
  loading?: boolean;
  /** 触发器左侧图标；不传则不显示 */
  triggerIcon?: React.ElementType;
  /** 弹层宽度档位 */
  width?: "narrow" | "wide";
  /** 是否展示 免费 / 精选 / 全部 分组筛选（仅语言模型有此筛选） */
  filterGroups?: ModelFilterGroup[];
  /** 体验模式徽章；不传则不显示 */
  isTrialMode?: boolean;
  /** 完全为空时的自定义提示，覆盖默认文案 */
  emptyState?: React.ReactNode;
}

const TONE_CLASS: Record<ModelFilterGroup["tone"], { active: string; idle: string }> = {
  free: {
    active: "bg-emerald-600 text-white font-semibold shadow-xs",
    idle: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20",
  },
  featured: {
    active: "bg-amber-500 text-white font-semibold shadow-xs",
    idle: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20",
  },
  all: {
    active: "bg-foreground text-background font-semibold shadow-xs",
    idle: "bg-muted/60 dark:bg-[#2c2c2e]/60 text-muted-foreground hover:text-foreground",
  },
};

export const ModelPicker: React.FC<ModelPickerProps> = ({
  value,
  onChange,
  options,
  kindLabel,
  ariaLabel,
  placeholder = "请选择模型",
  className,
  variant = "default",
  disabled = false,
  loading = false,
  triggerIcon: TriggerIcon,
  width = "narrow",
  filterGroups,
  isTrialMode = false,
  emptyState,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const listboxId = useRef(`model-listbox-${Math.random().toString(36).slice(2)}`);
  // 选项 id 用列表下标而非模型 id：模型 id 含 `/` `:` 等字符，即便做过字符替换，
  // `a/b` 与 `a_b` 也会撞成同一个 id，进而让 aria-activedescendant 指错元素。
  const optionId = (idx: number) => `${listboxId.current}-opt-${idx}`;

  const availableGroups = useMemo(
    () => (filterGroups ?? []).filter((g) => g.available),
    [filterGroups]
  );

  // 默认分组：语言模型优先落在「免费」（若有），否则「精选」，否则「全部」。
  // 抽屉式分组只在首次拿到数据时自动选一次，之后尊重用户手动切换。
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current || availableGroups.length === 0) return;
    const preferred =
      availableGroups.find((g) => g.tone === "free") ??
      availableGroups.find((g) => g.tone === "featured") ??
      availableGroups.find((g) => g.tone === "all");
    if (preferred) setFilterKey(preferred.key);
    autoPickedRef.current = true;
  }, [availableGroups]);

  const selectedOption = options.find((o) => o.id === value);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const group = availableGroups.find((g) => g.key === filterKey);

    const matched = options.filter((o) => {
      // 用户主动输入关键词时在全量目录内搜索，最快找到目标模型；
      // 此时忽略分组筛选，否则「免费」分组会让带关键词的搜索查不到付费模型。
      if (query) {
        return (
          o.id.toLowerCase().includes(query) ||
          o.name.toLowerCase().includes(query) ||
          (o.provider || "").toLowerCase().includes(query) ||
          (o.description || "").toLowerCase().includes(query)
        );
      }
      return group ? group.match(o) : true;
    });

    return matched.sort((a, b) => a.rank - b.rank);
  }, [options, search, filterKey, availableGroups]);

  /**
   * 打开时清空搜索、把焦点交给搜索框，并把高亮对齐到当前选中项。
   * 依赖刻意只写 [open]：options / value 变化不应在用户浏览列表时抢走焦点。
   */
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setActiveIndex(visible.findIndex((o) => o.id === value));
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // 高亮项滚动进可视区，否则 ↑ 移到列表外时用户看不到自己在哪
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const activeOptionId =
    open && activeIndex >= 0 && activeIndex < visible.length ? optionId(activeIndex) : undefined;

  const commit = (idx: number) => {
    const picked = visible[idx];
    if (!picked) return;
    onChange(picked.id);
    setOpen(false);
  };

  /**
   * combobox 键盘交互：↑/↓ 移动高亮，Home/End 跳首尾，Enter 选中。
   * Escape 交还给 Popover（Radix 已处理，这里不拦截）。
   */
  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (visible.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(visible.length - 1, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev <= 0 ? 0 : prev - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(visible.length - 1);
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < visible.length) {
      e.preventDefault();
      commit(activeIndex);
    }
  };

  const isCompact = variant === "compact";
  const a11yLabel = ariaLabel ?? kindLabel;
  // 目录尚未同步时用户存的只是一个裸 id：照常显示出来，但用等宽字体与
  // 真实模型名区分，避免看起来像一个正常的模型名。
  const isRawIdFallback = !selectedOption && !!value;
  const triggerLabel = selectedOption
    ? selectedOption.name
    : value || (loading ? "加载中..." : placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId.current : undefined}
          aria-label={`选择${a11yLabel}`}
          disabled={disabled}
          className={cn(
            isCompact
              ? "h-8 px-3 rounded-full bg-muted/70 hover:bg-muted/90 active:scale-95 border border-border/60 transition-all flex items-center justify-between gap-1.5 select-none cursor-pointer shadow-2xs max-w-full group"
              : "w-full h-9 sm:h-[38px] justify-between px-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 transition-all active:scale-[0.99] flex items-center text-left shadow-2xs gap-2 select-none cursor-pointer group",
            open && "bg-muted/60 ring-2 ring-primary/20 border-primary/40",
            loading && "opacity-60 cursor-not-allowed",
            className
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            {TriggerIcon && (
              <TriggerIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span
              className={cn(
                "text-[13px] truncate",
                !isCompact && "font-medium",
                selectedOption || value ? "text-foreground" : "text-muted-foreground",
                isRawIdFallback && "font-mono"
              )}
            >
              {triggerLabel}
            </span>
            {selectedOption?.isFree && (
              // 位于触发器 <button> 内部，因此保持不可聚焦，
              // 但 role / aria-label 仍会并入按钮的可访问名称。
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
              "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
              isCompact ? "ml-0.5" : "ml-1",
              open && "rotate-180 text-foreground"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "rounded-[22px] border border-border/50 bg-background/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl",
          "shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]",
          "p-3 pt-3.5 z-50 flex flex-col max-h-[75vh]",
          width === "wide"
            ? "w-[calc(100vw-24px)] max-w-[500px]"
            : "w-[calc(100vw-24px)] max-w-[390px] sm:w-[420px]"
        )}
      >
        <div className="flex items-center justify-between px-1 pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-foreground tracking-tight">
              选择{kindLabel}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded-full">
              {visible.length}
            </span>
            {isTrialMode && (
              <ActionTooltip label={`当前处于体验模式，仅可使用免费${kindLabel}`}>
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
          {selectedOption && (
            <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[170px]">
              当前: {selectedOption.name}
            </span>
          )}
        </div>

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
            aria-label={`搜索${a11yLabel}`}
            placeholder={`搜索${a11yLabel}`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(
                e.target.value ? 0 : visible.findIndex((o) => o.id === value)
              );
            }}
            onKeyDown={handleListKeyDown}
            className="pl-9 pr-8 h-[34px] text-[13px] rounded-xl bg-muted/60 dark:bg-[#2c2c2e]/70 border-0 focus-visible:ring-1 focus-visible:ring-primary/40 placeholder:text-muted-foreground/60"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="清除搜索"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {availableGroups.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5 pt-0.5 shrink-0">
            {availableGroups.map((group) => {
              const Icon = group.icon;
              const isOn = filterKey === group.key;
              return (
                <button
                  key={group.key}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => setFilterKey(group.key)}
                  className={cn(
                    "h-7 px-2.5 rounded-full text-[11px] font-medium transition-all shrink-0 active:scale-95",
                    Icon && "flex items-center gap-1",
                    isOn ? TONE_CLASS[group.tone].active : TONE_CLASS[group.tone].idle
                  )}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  <span>
                    {group.label} ({group.count})
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {availableGroups.length > 0 && <div className="border-b border-border/40 mb-1.5" />}

        {/* ARIA combobox：焦点留在搜索框，用 aria-activedescendant 指向高亮项，
            选项本身保持不可聚焦。列表缺 role="listbox" 或选项缺 role="option"
            都会让键盘与读屏完全无法操作。 */}
        <div
          id={listboxId.current}
          role="listbox"
          aria-label={`${a11yLabel}列表`}
          className="overflow-y-auto flex-1 min-h-0 max-h-[50vh] space-y-1 pr-1 overscroll-contain touch-pan-y"
          onWheel={(e) => e.stopPropagation()}
        >
          {visible.length === 0 ? (
            emptyState ?? (
              <div className="py-10 px-3 text-center text-xs text-muted-foreground leading-relaxed">
                未找到匹配的{kindLabel}
                {filterKey && (
                  <button
                    type="button"
                    onClick={() => setFilterKey(null)}
                    className="mt-2 block mx-auto text-primary underline text-xs hover:opacity-80 active:scale-95 cursor-pointer"
                  >
                    在全部 {options.length} 个模型中查找
                  </button>
                )}
              </div>
            )
          ) : (
            visible.map((o, idx) => {
              const isSelected = o.id === value;
              const isActive = idx === activeIndex;
              return (
                <div
                  key={o.id}
                  id={optionId(idx)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => commit(idx)}
                  onMouseMove={() => setActiveIndex(idx)}
                  className={cn(
                    "p-2.5 sm:px-3 rounded-xl cursor-pointer text-xs transition-all flex items-center justify-between gap-2.5 active:scale-[0.99]",
                    isActive && !isSelected && "bg-muted/60 dark:bg-[#2c2c2e]/50",
                    isSelected
                      ? "bg-primary/10 dark:bg-primary/15 text-primary font-medium border border-primary/25"
                      : "border border-transparent"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          "font-semibold tracking-tight",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {o.name}
                      </span>
                      {o.isFeatured && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-medium flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" />
                          精选
                        </span>
                      )}
                      {o.isFree && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-medium">
                          免费
                        </span>
                      )}
                      {o.isMultimodal && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/25 font-medium">
                          多模态
                        </span>
                      )}
                      {o.provider && (
                        <span className="text-[9px] px-1 py-0.5 rounded uppercase font-mono bg-muted/80 text-muted-foreground">
                          {o.provider}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                      {o.id}
                    </p>
                    {o.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">
                        {o.description}
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

/** 语言模型 / 绘图模型共用的免费筛选谓词，供适配层构建 ModelFilterGroup。 */
export const freeFilterMatch = (o: ModelOption) => o.isFree;
export const featuredFilterMatch = (o: ModelOption) => o.isFeatured;
export const allFilterMatch = () => true;

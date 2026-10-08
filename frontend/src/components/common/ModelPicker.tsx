"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  ChevronDown,
  Search,
  Check,
  X,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  icon?: LucideIcon;
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
  triggerIcon?: LucideIcon;
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
    active: "bg-emerald-600 font-semibold text-white shadow-xs",
    idle: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400",
  },
  featured: {
    active: "bg-amber-500 font-semibold text-white shadow-xs",
    idle: "border border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400",
  },
  all: {
    active: "bg-foreground font-semibold text-background shadow-xs",
    idle: "bg-surface-3/60 text-muted-foreground hover:text-foreground",
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
   * 打开时清空搜索，并把高亮对齐到当前选中项。
   * 不默认聚焦输入框，避免移动端/触屏设备打开弹窗时直接顶出软键盘。
   * 用户需要搜索时手动点击输入框才会获得焦点并呼出键盘。
   */
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setActiveIndex(visible.findIndex((o) => o.id === value));
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
        {/*
          触发器**不**声明 role="combobox"。
          整个弹层里已经有且只有一个 combobox（下方的搜索框，见下），
          两个 combobox 指向同一个 listbox 会让读屏用户听到两个输入框，
          且 aria-activedescendant 只在其中一个上生效。
          触发器只是一个「打开选择器」的按钮，用 aria-haspopup="dialog" 表达。
        */}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`选择${a11yLabel}${selectedOption ? `，当前 ${selectedOption.name}` : ""}`}
          disabled={disabled}
          className={cn(
            isCompact
              ? "flex h-8 max-w-full select-none cursor-pointer items-center justify-between gap-1.5 rounded-full border border-border/60 bg-surface-3/70 px-3 transition-colors hover:bg-surface-3 active:scale-95 group"
              : "flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface-3/30 px-3 text-left transition-colors hover:bg-surface-3/60 active:scale-[0.99] sm:h-[38px] h-9 group",
            "shadow-2xs",
            open && "border-primary/40 bg-surface-3/60 ring-2 ring-primary/20",
            loading && "cursor-not-allowed opacity-60",
            className
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {TriggerIcon && (
              <TriggerIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span
              className={cn(
                "truncate text-footnote sm:text-sm",
                !isCompact && "font-medium",
                selectedOption || value ? "text-foreground" : "text-muted-foreground",
                isRawIdFallback && "font-mono"
              )}
            >
              {triggerLabel}
            </span>
            {/* 「免费」圆点：不能包 ActionTooltip —— 它位于触发器 <button>
                内部，而 TooltipTrigger asChild 会给它加 tabindex，于是 button
                里出现了可聚焦元素（HTML 非法，键盘用户也会被卡住）。
                改用原生 title 提示。 */}
            {selectedOption?.isFree && (
              <span
                role="img"
                aria-label="免费模型"
                title="免费模型"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
              />
            )}
          </div>

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
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
          "z-50 flex max-h-[75vh] flex-col rounded-[22px] border border-border/50 bg-background/95 p-3 pt-3.5 backdrop-blur-2xl",
          "shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]",
          width === "wide"
            ? "w-[calc(100vw-24px)] max-w-[500px]"
            : "w-[calc(100vw-24px)] max-w-[390px] sm:w-[420px]"
        )}
      >
        <div className="flex items-center justify-between px-1 pb-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              选择{kindLabel}
            </span>
            <span className="rounded-full bg-surface-3/60 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
              {visible.length}
            </span>
            {isTrialMode && (
              // 不可聚焦：纯展示信息。徽章本身是 div，套 Tooltip 会造出一个
              // 可聚焦的 div（违反 WCAG 2.1.1）。
              <span
                title={`当前处于体验模式，仅可使用免费${kindLabel}`}
                className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-2xs text-emerald-600 dark:text-emerald-400"
              >
                体验模式
              </span>
            )}
          </div>
          {selectedOption && (
            <span className="max-w-[170px] truncate font-mono text-2xs text-muted-foreground">
              当前: {selectedOption.name}
            </span>
          )}
        </div>

        <div className="relative mb-2.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          {/* 全弹层唯一的 combobox：焦点始终留在这个搜索框，
              aria-activedescendant 指向 listbox 里的高亮项。 */}
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
            className="h-[34px] rounded-xl border-0 bg-surface-3/60 pl-9 pr-8 text-footnote placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="清除搜索"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-transform hover:text-foreground active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {availableGroups.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5 pt-0.5">
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
                    "h-7 shrink-0 rounded-full px-2.5 text-2xs font-medium transition-colors active:scale-95",
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

        {availableGroups.length > 0 && <div className="mb-1.5 border-b border-border/40" />}

        {/* listbox：焦点留在搜索框，用 aria-activedescendant 指向高亮项，
            选项本身保持不可聚焦。列表缺 role="listbox" 或选项缺 role="option"
            都会让键盘与读屏完全无法操作。 */}
        <div
          id={listboxId.current}
          role="listbox"
          aria-label={`${a11yLabel}列表`}
          onWheel={(e) => e.stopPropagation()}
          className="min-h-0 max-h-[50vh] flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 touch-pan-y"
        >
          {visible.length === 0 ? (
            emptyState ?? (
              <div className="px-3 py-10 text-center text-xs leading-relaxed text-muted-foreground">
                未找到匹配的{kindLabel}
                {filterKey && (
                  <button
                    type="button"
                    onClick={() => setFilterKey(null)}
                    className="mx-auto mt-2 block cursor-pointer text-xs text-primary underline hover:opacity-80 active:scale-95"
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
                    "flex cursor-pointer items-center justify-between gap-2.5 rounded-xl p-2.5 text-xs transition-all active:scale-[0.99] sm:px-3",
                    isActive && !isSelected && "bg-surface-3/50",
                    isSelected
                      ? "border border-primary/25 bg-primary/10 font-medium text-primary"
                      : "border border-transparent"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "font-semibold tracking-tight",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {o.name}
                      </span>
                      {o.isFeatured && (
                        <span className="flex items-center gap-0.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-2xs font-medium text-amber-600 dark:text-amber-400">
                          <Sparkles className="h-2.5 w-2.5" />
                          精选
                        </span>
                      )}
                      {o.isFree && (
                        <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                          免费
                        </span>
                      )}
                      {o.isMultimodal && (
                        <span className="rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-2xs font-medium text-violet-600 dark:text-violet-400">
                          多模态
                        </span>
                      )}
                      {o.provider && (
                        <span className="rounded bg-surface-3/80 px-1 py-0.5 font-mono text-2xs uppercase text-muted-foreground">
                          {o.provider}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">
                      {o.id}
                    </p>
                    {o.description && (
                      <p className="mt-0.5 line-clamp-1 text-2xs leading-relaxed text-muted-foreground">
                        {o.description}
                      </p>
                    )}
                  </div>

                  {isSelected && <Check className="h-4 w-4 shrink-0 stroke-[2.5] text-primary" />}
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

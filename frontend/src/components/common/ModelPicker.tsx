"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, Search, Check, X, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ModelPriceTag } from "@/components/common/ModelGuideTags";
import { ModelTierCards } from "@/components/common/ModelTierCards";
import type { ModelFilterGroup } from "@/components/common/modelFilterGroups";
import { overlaySurfaceClass } from "@/components/common/surfaces";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ModelOption } from "@/lib/models";

/**
 * 语言模型与绘图模型共用的选择器组件。
 * 移动端展示为下拉抽屉，桌面端展示为 Popover 浮层。
 */

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
  /** 桌面浮层宽度档位；移动端抽屉始终通栏，此项不参与 */
  width?: "narrow" | "wide";
  /** 等级卡片筛选（仅语言模型有此筛选） */
  filterGroups?: ModelFilterGroup[];
  /** 初始默认选中的分组 key；该分组不可用时不预选任何分组 */
  defaultFilterKey?: string;
  /** 体验模式徽章；不传则不显示 */
  isTrialMode?: boolean;
  /** 完全为空时的自定义提示，覆盖默认文案 */
  emptyState?: React.ReactNode;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  value,
  onChange,
  options,
  kindLabel,
  ariaLabel,
  placeholder,
  className,
  variant = "default",
  disabled = false,
  loading = false,
  triggerIcon: TriggerIcon,
  width = "narrow",
  filterGroups,
  defaultFilterKey,
  isTrialMode = false,
  emptyState,
}) => {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const listboxId = useRef(`model-listbox-${Math.random().toString(36).slice(2)}`);
  const optionId = (idx: number) => `${listboxId.current}-opt-${idx}`;

  const availableGroups = useMemo(
    () => (filterGroups ?? []).filter((g) => g.available),
    [filterGroups]
  );

  const activeGroup = availableGroups.find((g) => g.key === filterKey);
  /** 「自定义」档不对等级做限制，因此头部计数把它当作「未筛选」。 */
  const isFiltered = activeGroup !== undefined && activeGroup.key !== "custom";

  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current || availableGroups.length === 0) return;
    const wanted =
      defaultFilterKey && availableGroups.some((g) => g.key === defaultFilterKey)
        ? defaultFilterKey
        : null;
    setFilterKey(wanted);
    autoPickedRef.current = true;
  }, [availableGroups, defaultFilterKey]);

  const selectedOption = options.find((o) => o.id === value);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matched = options.filter((o) => {
      // 搜索只在当前等级内进行：选了「免费」就不该冒出付费模型。
      // 「自定义」档的 match 恒为 true，因此那边搜索的就是全量目录。
      if (activeGroup && !activeGroup.match(o)) return false;
      if (!query) return true;
      return (
        o.id.toLowerCase().includes(query) ||
        o.name.toLowerCase().includes(query) ||
        (o.provider || "").toLowerCase().includes(query) ||
        (o.description || "").toLowerCase().includes(query)
      );
    });

    return matched.sort((a, b) => a.rank - b.rank);
  }, [options, search, activeGroup]);

  /**
   * 打开时清空搜索，并把高亮对齐到当前选中项；没有选中项时落在第一项。
   * 不默认聚焦输入框，避免移动端/触屏设备打开弹窗时直接顶出软键盘
   * （抽屉侧同样要拦住 Radix Dialog 自带的 onOpenAutoFocus，见下）。
   * 用户需要搜索时手动点击输入框才会获得焦点并呼出键盘。
   */
  useEffect(() => {
    if (!open) return;
    setSearch("");
    const selectedIndex = visible.findIndex((o) => o.id === value);
    // 没有选中项（或选中项不在当前列表）时，默认高亮第一项，键盘操作
    // 可以直接从推荐首位开始。
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : visible.length > 0 ? 0 : -1);
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
   * Escape 交还给 Popover / Sheet（Radix 已处理，这里不拦截）。
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
    : value || (loading ? t("settings.picker.loading") : (placeholder ?? t("settings.picker.placeholder")));

  // 触发器**不**声明 role="combobox"。
  // 整个面板里已经有且只有一个 combobox（下方的搜索框），两个 combobox
  // 指向同一个 listbox 会让读屏用户听到两个输入框，且 aria-activedescendant
  // 只在其中一个上生效。触发器只是一个「打开选择器」的按钮，用
  // aria-haspopup="dialog" 表达 —— 浮层与抽屉的角色都是 dialog。
  const trigger = (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={t("settings.picker.selectAria", {
        kind: a11yLabel,
        current: selectedOption
          ? t("settings.picker.selectAriaCurrent", { name: selectedOption.name })
          : "",
      })}
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
        {TriggerIcon && <TriggerIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
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
        {selectedOption?.isFree && (
          <span
            role="img"
            aria-label={t("settings.modelBadges.freeModel")}
            title={t("settings.modelBadges.freeModel")}
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
  );

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col p-3 pt-3.5">
      <div className="flex items-center justify-between gap-2 px-1 pb-2.5 border-b border-border/40 mb-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
            {t("settings.picker.title", { kind: kindLabel })}
          </span>
          <span
            title={
              search.trim() || isFiltered
                ? `${visible.length} / ${options.length}`
                : `${options.length}`
            }
            className="shrink-0 rounded-lg bg-surface-3/80 px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground"
          >
            {search.trim() || isFiltered
              ? `${visible.length} / ${options.length}`
              : options.length}
          </span>
          {isTrialMode && (
            <span
              title={t("settings.picker.trialTitle", { kind: kindLabel })}
              className="shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              {t("settings.picker.trialBadge")}
            </span>
          )}
        </div>
        {selectedOption && (
          <span className="min-w-0 shrink truncate text-right font-mono text-xs text-muted-foreground">
            {t("settings.picker.current", { name: selectedOption.name })}
          </span>
        )}
      </div>

      <div className="relative mb-2.5 shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId.current}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-label={t("settings.picker.searchAria", { kind: a11yLabel })}
          placeholder={t("settings.picker.searchPh", { kind: a11yLabel })}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActiveIndex(e.target.value ? 0 : visible.findIndex((o) => o.id === value));
          }}
          onKeyDown={handleListKeyDown}
          className="h-9 rounded-xl border-0 bg-surface-3/60 pl-9 pr-8 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/40"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label={t("settings.picker.clearSearch")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-muted-foreground transition-transform hover:text-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {availableGroups.length > 0 && (
        <div className="mb-2.5 shrink-0">
          <ModelTierCards
            groups={availableGroups}
            activeKey={filterKey}
            kindLabel={a11yLabel}
            onSelect={(key) => {
              // 切档时回到该档的完整列表：清掉上一档的搜索词，并把第一项
              // 设为键盘高亮项（点一下才会真正切换模型，避免误触付费档）。
              setFilterKey(key);
              setSearch("");
              setActiveIndex(0);
              // activeIndex 可能本来就是 0，单靠上面的滚动 effect 不会触发；
              // 这里显式回到列表顶部，确保切档后先看到第一个推荐。
              if (listRef.current) listRef.current.scrollTop = 0;
            }}
          />
        </div>
      )}

      <div
        ref={listRef}
        id={listboxId.current}
        role={visible.length > 0 ? "listbox" : undefined}
        aria-label={
          visible.length > 0 ? t("settings.picker.listAria", { kind: a11yLabel }) : undefined
        }
        onWheel={(e) => e.stopPropagation()}
        className="model-list-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1.5 touch-pan-y"
      >
        {visible.length === 0 ? (
          options.length > 0 && search.trim() && isFiltered ? (
            <div className="px-3 py-10 text-center text-xs leading-relaxed text-muted-foreground">
              <p>{t("settings.picker.noMatch", { kind: kindLabel })}</p>
              <button
                type="button"
                onPointerDown={(e) => {
                  if (e.pointerType !== "touch") e.preventDefault();
                }}
                onClick={() => {
                  // 保留搜索词切到「自定义」，让用户立刻看到全量目录里的结果；
                  // 第一条作为默认高亮项。
                  setFilterKey("custom");
                  setActiveIndex(0);
                  if (listRef.current) listRef.current.scrollTop = 0;
                }}
                className="mt-2 cursor-pointer rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-medium text-primary transition-colors hover:bg-primary/15"
              >
                {t("settings.picker.searchAll")}
              </button>
            </div>
          ) : (
            emptyState ?? (
              <div className="px-3 py-10 text-center text-xs leading-relaxed text-muted-foreground">
                {t("settings.picker.noMatch", { kind: kindLabel })}
              </div>
            )
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
                onPointerDown={() => setActiveIndex(idx)}
                className={cn(
                  "flex cursor-pointer items-start justify-between gap-3 rounded-2xl p-3 text-xs transition-all active:scale-[0.99] sm:items-center",
                  isSelected
                    ? "border border-primary/30 bg-primary/10 font-medium text-primary shadow-xs"
                    : isActive
                      ? "border border-primary/25 bg-primary/5"
                      : "border border-transparent hover:bg-surface-3/50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "text-sm font-semibold tracking-tight",
                        isSelected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {o.name}
                    </span>
                    {(o.guide || o.pricing || o.isFree) && (
                      <ModelPriceTag
                        tier={o.guide?.priceTier}
                        pricing={o.pricing}
                        isFree={o.isFree}
                      />
                    )}
                    {o.isMultimodal && (
                      <span className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">
                        {t("settings.picker.multimodalBadge")}
                      </span>
                    )}
                    {o.provider && (
                      <span className="rounded-lg bg-surface-3/80 px-2 py-0.5 font-mono text-xs uppercase text-muted-foreground font-semibold">
                        {o.provider}
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{o.id}</p>

                  {o.guide ? (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {t(o.guide.reasonKey)}
                    </p>
                  ) : (
                    o.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
                        {o.description}
                      </p>
                    )
                  )}
                </div>

                {isSelected && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5] text-primary sm:mt-0" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="top"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[85dvh] max-h-[90dvh] w-full flex-col gap-0 overflow-hidden rounded-b-sheet border-b border-border/50 bg-background/95 p-0 pt-[var(--sat)] shadow-2xl backdrop-blur-2xl sm:mx-auto sm:max-w-xl [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("settings.picker.title", { kind: kindLabel })}</SheetTitle>
            <SheetDescription>{t("settings.picker.sheetDesc", { kind: kindLabel })}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {panel}
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label={t("common.action.close")}
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className="flex shrink-0 cursor-pointer justify-center py-2.5 active:opacity-60 focus-visible:outline-none"
          >
            <div className="h-1 w-9 rounded-full bg-foreground/20" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          overlaySurfaceClass,
          "flex max-h-[78dvh] flex-col p-0",
          width === "wide"
            ? "w-[calc(100vw-24px)] max-w-[560px]"
            : "w-[calc(100vw-24px)] max-w-[390px] sm:w-[420px]"
        )}
      >
        {panel}
      </PopoverContent>
    </Popover>
  );
};

export default ModelPicker;

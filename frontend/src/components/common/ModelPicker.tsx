"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  X,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ModelPriceTag, ModelUseCaseTags } from "@/components/common/ModelGuideTags";
import { overlaySurfaceClass } from "@/components/common/surfaces";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
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
  tone: "free" | "featured" | "accent" | "all";
  icon?: LucideIcon;
  count: number;
  /**
   * 分类右侧显示的数字。缺省时用 `count`（列表条目数）。
   * 传去重后的模型数会让「编程 (5)」这种数字如实反映有多少个**不同**的模型，
   * 而不是被 `:batch` / `-pro` 变体灌大。列表本身仍按条目渲染。
   */
  distinctCount?: number;
  /**
   * 所属区块的小标题（如「按用途」「按价格」）。区块标题只在**非空**时渲染，
   * 且同一区块的第一行会自动带上标题 —— 所以调用方只要把 section 填好，
   * 组件负责画标题行与分隔线。
   */
  section?: string;
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
  /** 初始默认选中的分组 key */
  defaultFilterKey?: string;
  /** 体验模式徽章；不传则不显示 */
  isTrialMode?: boolean;
  /** 完全为空时的自定义提示，覆盖默认文案 */
  emptyState?: React.ReactNode;
}

/**
 * 分类行的**选中态**配色。
 *
 * 以前分类是一排胶囊，未选中时也要靠边框色区分是免费 / 精选 / 需求，所以存了
 * active + idle 两套。现在改成竖排整行，未选中统一走 `text-muted-foreground +
 * hover:bg-surface-3`，颜色只在选中时出现 —— idle 那半套就是死代码了。
 *
 * `free` 绿 / `featured` 琥珀 / `accent` 主色 / `all` 中性：选中哪一类，
 * 一眼就能从颜色上分出来。
 */
const TONE_ACTIVE: Record<ModelFilterGroup["tone"], string> = {
  free: "bg-emerald-600 font-semibold text-white shadow-xs",
  featured: "bg-amber-500 font-semibold text-white shadow-xs",
  accent: "bg-primary font-semibold text-primary-foreground shadow-xs",
  all: "bg-foreground font-semibold text-background shadow-xs",
};

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

  // 默认分组：若传入 defaultFilterKey 且存在则优先使用；
  // 否则语言模型优先落在「免费」（若有），否则「精选」，否则「全部」。
  // 抽屉式分组只在首次拿到数据时自动选一次，之后尊重用户手动切换。
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current || availableGroups.length === 0) return;
    if (defaultFilterKey && availableGroups.some((g) => g.key === defaultFilterKey)) {
      setFilterKey(defaultFilterKey);
      autoPickedRef.current = true;
      return;
    }
    const preferred =
      availableGroups.find((g) => g.tone === "free") ??
      availableGroups.find((g) => g.tone === "featured") ??
      availableGroups.find((g) => g.tone === "all");
    if (preferred) setFilterKey(preferred.key);
    autoPickedRef.current = true;
  }, [availableGroups, defaultFilterKey]);

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
    : value || (loading ? t("settings.picker.loading") : (placeholder ?? t("settings.picker.placeholder")));

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
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          // 材质来自 overlaySurfaceClass，此前这里是手写的同一套值（连两档
          // 阴影都相同，只是主档透明度写成 0.2 而非 0.22）。这里只保留弹层
          // 特有的部分：面板自身的 flex 布局、高度上限、内距，以及宽度策略。
          // dvh 而非 vh：移动端地址栏展开收起时 vh 不变，弹层会顶到地址栏底下，
          // 而 collisionPadding 只让开了 12px。
          overlaySurfaceClass,
          "flex max-h-[78dvh] flex-col p-3 pt-3.5",
          width === "wide"
            ? "w-[calc(100vw-24px)] max-w-[560px]"
            : "w-[calc(100vw-24px)] max-w-[390px] sm:w-[420px]"
        )}
      >
        <div className="flex items-center justify-between px-1 pb-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              {t("settings.picker.title", { kind: kindLabel })}
            </span>
            <span
              title={
                search.trim() || (filterKey && filterKey !== "all")
                  ? `${visible.length} / ${options.length}`
                  : `${options.length}`
              }
              className="rounded-full bg-surface-3/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
            >
              {search.trim() || (filterKey && filterKey !== "all")
                ? `${visible.length} / ${options.length}`
                : options.length}
            </span>
            {isTrialMode && (
              // 不可聚焦：纯展示信息。徽章本身是 div，套 Tooltip 会造出一个
              // 可聚焦的 div（违反 WCAG 2.1.1）。
              <span
                title={t("settings.picker.trialTitle", { kind: kindLabel })}
                className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400"
              >
                {t("settings.picker.trialBadge")}
              </span>
            )}
          </div>
          {selectedOption && (
            <span className="max-w-[170px] truncate font-mono text-xs text-muted-foreground">
              {t("settings.picker.current", { name: selectedOption.name })}
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
            aria-label={t("settings.picker.searchAria", { kind: a11yLabel })}
            placeholder={t("settings.picker.searchPh", { kind: a11yLabel })}
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
              aria-label={t("settings.picker.clearSearch")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-transform hover:text-foreground active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {availableGroups.length > 0 && (
          /* 一级：分类。竖排成行而不是横向排布成胶囊 —— 分类一多横向必然溢出，
             而隐藏滚动条的横向滚动在 PC 上等于「滚不到」。

             二级：下方就是模型列表（下面那个 listbox，代码未动）。

             区块标题把「按用途」和「按价格」两条轴分开摆。同一个区块里才是
             可比的：拿「编程开发」和「免费」横向比较是没有意义的，它们量的
             不是同一件事（依据见 lib/modelGuide.ts 顶部的分类说明）。

             分隔线的条件是「上一行的 section 与这行不同」，**不要求这一行自己
             有 section** —— 于是没有 section 的「推荐」（排在最前）和「全部」
             （排在最后）各自也会拿到一条分隔线，不会被误并进相邻区块。

             高度上限用 vh 而不是 %：父容器只有 max-h、height 是 auto，包含块
             高度不确定，按 CSS 规范 % 的 max-height 会算成 none（形同虚设）。
             实测内容高：10 行 × 28px + 2 个区块标题 ≈ 38px + 3 条分隔线 ≈ 39px
             ≈ 335px。38dvh 在 800px 视口下是 304px，会轻微滚动；更矮的屏幕滚
             动更多。下方列表是 flex-1 min-h-0，会自动吸收差额，不会被压没。 */
          <div className="max-h-[38dvh] shrink-0 overflow-y-auto overscroll-contain pb-1 pr-0.5">
            {availableGroups.map((group, idx) => {
              const Icon = group.icon;
              // 搜索时列表会跨全部分类（见上面 visible 的 query 分支），
              // 此时若还把某个分类高亮成「当前」，用户会以为结果被限制在那一类里。
              const isOn = !search.trim() && filterKey === group.key;
              // 标题只画在这一区块的第一行；换了区块就先画一条分隔线。
              const prev = idx > 0 ? availableGroups[idx - 1] : undefined;
              const sectionChanged = !!prev && prev.section !== group.section;
              const startsSection = sectionChanged && !!group.section;
              return (
                <React.Fragment key={group.key}>
                  {sectionChanged && <div className="mx-2 my-1.5 border-t border-border/40" />}
                  {startsSection && (
                    <div className="px-2 pb-1 pt-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                      {group.section}
                    </div>
                  )}
                  <button
                    type="button"
                    // 这是切换筛选的 toggle，不是折叠面板：下面的 listbox 一直都在，
                    // 从来没被隐藏过，所以 aria-expanded 是错的语义，用 aria-pressed。
                    aria-pressed={isOn}
                    // 分类是原生 button，鼠标点它会把焦点从搜索框抢走 —— 而
                    // ↑↓/Home/End/Enter 全绑在搜索框上，抢走就等于键盘操作全废。
                    // preventDefault 掉 pointerdown 的默认焦点转移即可留在原地。
                    // touch 必须放行：移动端点分类本来就不该弹软键盘。
                    onPointerDown={(e) => {
                      if (e.pointerType !== "touch") e.preventDefault();
                    }}
                    onClick={() => {
                      // 切换分类后旧的高亮下标可能超出新列表长度（新高亮直接消失，
                      // ↓ 一下又会跳回 0）。直接清零更干净：等用户自己开始移动。
                      setFilterKey(group.key);
                      setActiveIndex(-1);
                    }}
                    className={cn(
                      "flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-2.5 text-footnote font-medium transition-colors active:scale-[0.99]",
                      isOn
                        ? TONE_ACTIVE[group.tone]
                        : "text-muted-foreground hover:bg-surface-3/60 hover:text-foreground"
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" />}
                    <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                    <span className="shrink-0 font-mono text-xs opacity-75">
                      {group.distinctCount ?? group.count}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200",
                        isOn && "rotate-90"
                      )}
                    />
                  </button>
                </React.Fragment>
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
          aria-label={t("settings.picker.listAria", { kind: a11yLabel })}
          onWheel={(e) => e.stopPropagation()}
          className="min-h-0 max-h-[38dvh] flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 touch-pan-y"
        >
          {visible.length === 0 ? (
            emptyState ?? (
              /* 这里原先还有一个「在全部 N 个模型中查找」的按钮，指向
                 setFilterKey(null)。现在删掉，三个原因：
                 1. 它是死按钮 —— 空状态只可能出现在「有搜索词」时（分类组的
                    count 与 match 同源，非空分类永远有结果），而有搜索词时
                    visible 本来就无视分组、搜的是全量，点了界面纹丝不动。
                 2. 它是可聚焦的 <button>，落在 role="listbox" 内部 —— 与本文件
                    顶部「listbox 后代只能是 option」的约定冲突。
                 3. 分类行就在正上方，「换一个分类 / 回到全部」有唯一且明显的入口，
                    这里再来一个纯属冗余。 */
              <div className="px-3 py-10 text-center text-xs leading-relaxed text-muted-foreground">
                {t("settings.picker.noMatch", { kind: kindLabel })}
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
                  // onMouseMove 在触摸设备上永远不触发（iOS 只合成 mousedown/
                  // mouseup/click，不合成 mousemove），于是 activeIndex 一直停在
                  // -1，手指点下去之前没有任何行被高亮。pointerdown 对鼠标和触摸
                  // 都会触发，且早于 click，正好补上这条路径；onMouseMove 保留，
                  // 桌面端不按鼠标也能实时跟随。
                  onPointerDown={() => setActiveIndex(idx)}
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
                          "text-sm font-semibold tracking-tight",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {o.name}
                      </span>
                      {o.guide && <ModelPriceTag tier={o.guide.priceTier} />}
                      {/* 价格档已经是「免费」时不再重复挂一个免费徽章 */}
                      {o.isFree && o.guide?.priceTier !== "free" && (
                        <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {t("settings.picker.freeBadge")}
                        </span>
                      )}
                      {o.isMultimodal && (
                        <span className="rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                          {t("settings.picker.multimodalBadge")}
                        </span>
                      )}
                      {o.provider && (
                        <span className="rounded bg-surface-3/80 px-1 py-0.5 font-mono text-xs uppercase text-muted-foreground">
                          {o.provider}
                        </span>
                      )}
                    </div>

                    {/* 需求标签：这一行就是「根据自己的需求选模型」的落点 */}
                    {o.guide && <ModelUseCaseTags useCases={o.guide.useCases} className="mt-1" />}

                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {o.id}
                    </p>

                    {/* 命中画像时用中文推荐理由替代厂商的英文原描述 ——
                        后者是 truncated 到一行的营销文案，对选型几乎没有帮助。 */}
                    {o.guide ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {t(o.guide.reasonKey)}
                      </p>
                    ) : (
                      o.description && (
                        <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
                          {o.description}
                        </p>
                      )
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

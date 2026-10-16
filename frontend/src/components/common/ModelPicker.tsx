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
import { ModelPriceTag, ModelUseCaseTags } from "@/components/common/ModelGuideTags";
import { ModelFilterChips } from "@/components/common/ModelFilterChips";
import { buildFilterBlocks, type ModelFilterGroup } from "@/components/common/modelFilterGroups";
import { overlaySurfaceClass } from "@/components/common/surfaces";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useIsMobile } from "@/hooks/useIsMobile";
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
 *
 * ── 两种形态 ──────────────────────────────────────────────────────
 * 移动端（< md）走**底部抽屉**，桌面端走锚在触发器旁的**浮层**。面板内容
 * 是同一个 `panel` 变量，两侧共用，不存在两份实现 —— 面板里的搜索、筛选、
 * 键盘交互、无障碍标记因此天然一致。
 *
 * 以前只有浮层，且它在手机上被锚在顶部 header 里一个很窄的触发器上，
 * 整块面板浮在聊天内容之上，看起来就是「一条窄板贴在屏幕顶部」，而手机
 * 屏幕的纵向空间其实大面积空着。抽屉通栏、可用高度接近全屏，拇指也够得到
 * 下半部分。
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
  /** 是否展示分组筛选（仅语言模型有此筛选） */
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

  const listboxId = useRef(`model-listbox-${Math.random().toString(36).slice(2)}`);
  // 选项 id 用列表下标而非模型 id：模型 id 含 `/` `:` 等字符，即便做过字符替换，
  // `a/b` 与 `a_b` 也会撞成同一个 id，进而让 aria-activedescendant 指错元素。
  const optionId = (idx: number) => `${listboxId.current}-opt-${idx}`;

  const availableGroups = useMemo(
    () => (filterGroups ?? []).filter((g) => g.available),
    [filterGroups]
  );

  // 把扁平的分组按 section 切成块，供胶囊区渲染。
  const filterBlocks = useMemo(() => buildFilterBlocks(availableGroups), [availableGroups]);

  // 默认分组：若传入 defaultFilterKey 且该分组确实存在则用它。
  // 抽屉式分组只在首次拿到数据时自动选一次，之后尊重用户手动切换。
  //
  // 旧实现在 defaultFilterKey 不可用时会「猜」一个（免费 → 精选 → 全部），
  // 于是用户只是打开面板就被塞进某一类，看起来像筛选生效了。现在不猜：
  // 落到 null = 不限分类，用户看到全量列表；想收窄可以自己点胶囊。
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
   * 不默认聚焦输入框，避免移动端/触屏设备打开弹窗时直接顶出软键盘
   * （抽屉侧同样要拦住 Radix Dialog 自带的 onOpenAutoFocus，见下）。
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
  );

  /**
   * 面板本体。浮层与抽屉共用这一份 JSX：内距由这里统一给出，
   * 所以两边的容器只需要管各自的宽高与材质。
   */
  const panel = (
    <div className="flex min-h-0 flex-1 flex-col p-3 pt-3.5">
      <div className="flex items-center justify-between gap-2 px-1 pb-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-xs font-semibold text-foreground">
            {t("settings.picker.title", { kind: kindLabel })}
          </span>
          <span
            title={
              search.trim() || (filterKey && filterKey !== "all")
                ? `${visible.length} / ${options.length}`
                : `${options.length}`
            }
            className="shrink-0 rounded-full bg-surface-3/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
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
          // 抽屉是通栏的，给固定 max-w 会白白浪费右侧空间；改成可压缩并右对齐，
          // 窄屏下先被截断的是这行辅助信息，而不是标题与计数。
          <span className="min-w-0 shrink truncate text-right font-mono text-xs text-muted-foreground">
            {t("settings.picker.current", { name: selectedOption.name })}
          </span>
        )}
      </div>

      <div className="relative mb-2.5 shrink-0">
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
            setActiveIndex(e.target.value ? 0 : visible.findIndex((o) => o.id === value));
          }}
          onKeyDown={handleListKeyDown}
          className="h-[34px] rounded-xl border-0 bg-surface-3/60 pl-9 pr-8 text-footnote placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/40"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label={t("settings.picker.clearSearch")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-muted-foreground transition-transform hover:text-foreground active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/*
        分组筛选：压成**一行**胶囊（手机横向可滚，桌面换行），高度恒为 32px，
        不再自己占一块滚动区。**整个面板现在只有下方 listbox 一个滚动区** ——
        触摸设备上嵌套滚动是最反直觉的交互，这里彻底消除。
      */}
      {filterBlocks.length > 0 && (
        <div className="mb-2.5">
          <ModelFilterChips
            blocks={filterBlocks}
            activeKey={filterKey}
            highlightEnabled={!search.trim()}
            kindLabel={a11yLabel}
            onSelect={(key) => {
              // 切换分类后旧的高亮下标可能超出新列表长度（新高亮直接消失，
              // ↓ 一下又会跳回 0）。直接清零更干净：等用户自己开始移动。
              setFilterKey(key);
              setActiveIndex(-1);
            }}
          />
        </div>
      )}

      {/* listbox：焦点留在搜索框，用 aria-activedescendant 指向高亮项，
          选项本身保持不可聚焦。列表缺 role="listbox" 或选项缺 role="option"
          都会让键盘与读屏完全无法操作。

          高度策略：min-h-0 + flex-1，**不再设 max-h**。旧实现给筛选区和列表
          各写了 `max-h-[38dvh]`，容器总高又是 `78dvh` —— 于是模型列表只能
          分到和筛选区一样的高度，真正用来挑模型的地方被压成了一条缝。
          现在筛选区缩成一行胶囊，剩下的高度全部归列表，由容器的 max-h
          （桌面）/ 固定 h（抽屉）负责封顶。 */}
      <div
        id={listboxId.current}
        role="listbox"
        aria-label={t("settings.picker.listAria", { kind: a11yLabel })}
        onWheel={(e) => e.stopPropagation()}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 touch-pan-y"
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
               3. 分类胶囊就在正上方，「换一个分类 / 回到全部」有唯一且明显的
                  入口，这里再来一个纯属冗余。 */
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
                  "flex cursor-pointer items-start justify-between gap-2.5 rounded-xl p-2.5 text-xs transition-all active:scale-[0.99] sm:items-center sm:px-3",
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

                  {/* 需求标签：这一行就是「根据自己的需求选模型」的落点。
                      max=2 而不是 3 —— 抽屉通栏但一行仍只有 ~360px 可用，
                      第三个标签必然换行，把每行的高度又撑高一截。 */}
                  {o.guide && <ModelUseCaseTags useCases={o.guide.useCases} max={2} className="mt-1" />}

                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{o.id}</p>

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
        {/* 抽屉。类名里几个要点：
            - h-[86dvh]：固定高度而不是自适应，列表因此拿到稳定的高度，
              不会出现「这次开 3 行、下次开 8 行」的跳动。
            - gap-0：盖掉 sheetVariants 自带的 gap-4，间距交给拖拽条的
              pb-1 和面板自己的 p-3，两个子节点之间要严丝合缝。
            - [&>button]:hidden：去掉 SheetContent 自带的关闭按钮。点遮罩
              即可关闭，再挂一个 X 与系统返回手势重复，还白占一行高度。
            - p-0：内距由下方共用的 `panel` 统一给出。

          onOpenAutoFocus 必须拦掉：Radix Dialog 默认把焦点送进内容区，而这里
          内容的第一个可聚焦元素正是搜索框 —— 打开面板就会顶出软键盘、盖掉
          列表，不拦的话每次选模型都要先手动收起一次键盘。 */}
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[86dvh] max-h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-t-[24px] border-t border-border/50 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl sm:mx-auto sm:max-w-xl [&>button]:hidden"
        >
          {/* 拖拽指示条，与移动端记忆抽屉保持一致的视觉语言 */}
          <div className="flex shrink-0 justify-center pb-1 pt-2.5">
            <div className="h-1 w-9 rounded-full bg-foreground/20" />
          </div>

          {/* Radix Dialog 要求有标题，否则读屏会念不出这个面板是什么。
              与移动端记忆抽屉一致，视觉上隐藏即可。 */}
          <SheetHeader className="sr-only">
            <SheetTitle>{t("settings.picker.title", { kind: kindLabel })}</SheetTitle>
            <SheetDescription>{t("settings.picker.sheetDesc", { kind: kindLabel })}</SheetDescription>
          </SheetHeader>

          {/* pb 用 safe-area 而不是写死内距：iPhone 底部 Home Indicator
              会压住最后一行模型，padding 不足时选项的下半截点不到。 */}
          <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
            {panel}
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
          // 材质来自 overlaySurfaceClass，此前这里是手写的同一套值（连两档
          // 阴影都相同，只是主档透明度写成 0.2 而非 0.22）。这里只保留弹层
          // 特有的部分：面板自身的 flex 布局、高度上限，以及宽度策略。
          // 内距由共用的 `panel` 统一给出，所以这里必须显式 p-0 盖掉基础类的 p-4。
          // dvh 而非 vh：移动端地址栏展开收起时 vh 不变，弹层会顶到地址栏底下，
          // 而 collisionPadding 只让开了 12px。
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

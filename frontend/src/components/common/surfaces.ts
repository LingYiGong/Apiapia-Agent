/**
 * 浮层材质与菜单行的统一样式。
 *
 * ── 为什么要抽出来 ──────────────────────────────────────────────
 * 「悬浮在内容之上的一块半透明圆角面板」这件事，此前全前端有 9 处各自手写：
 *
 *   components/chat/ChatHeader.tsx             移动端聊天页顶栏「三个点」
 *   components/chat/SwipeableConversationCard  移动端历史列表卡片「三个点」
 *   components/chat/Sidebar.tsx                桌面端会话列表「三个点」
 *   components/chat/ChatArea.tsx               输入框「+」大面板
 *   components/chat/MemorySidebar.tsx          移动端底部 Sheet（材质本来就一致）
 *   components/layout/UserAvatarDropdown.tsx   用户头像菜单
 *   components/common/ThemeToggle.tsx          主题菜单
 *   components/common/LanguageSwitcher.tsx     语言菜单
 *   components/common/ModelPicker.tsx          模型选择 Popover
 *   components/usage/UsagePanels.tsx           管理员用户操作菜单
 *
 * 九份拷贝的 `rounded-* / border-border/50 / bg-background/95 / backdrop-blur-2xl`
 * 和两档阴影其实完全一样，差异只有各自的宽度与内距。改一次阴影要动九个文件，
 * 迟早漏掉某一个 —— 这正是本文件要消灭的状态。
 *
 * ── 菜单行为上的四个历史问题 ────────────────────────────────────
 * 同一批菜单此前还各自带着四个 bug，一并在这里说明根因（行样式见下方注释）：
 *
 * 1. 图标尺寸写了 h-3.5 w-3.5 但从不生效。
 *    DropdownMenuItem 基础类含 `[&>svg]:size-4`，编译成
 *    `.\[\&\>svg\]\:size-4 > svg`，specificity (0,1,1) 高于 `.h-3\.5` 的
 *    (0,1,0)；cn 里的 twMerge 只在 modifier 相同时才去重，`[&>svg]:` 与裸类
 *    不同 —— 两个类都会留下，由 CSS 决定胜负，于是图标一律渲染成 16px。
 *    `<Button>` 基础类的 `[&_svg]:size-4` 同理。
 *    修法是让代码与实际渲染一致（写 h-4 w-4），而不是继续留着骗人的类名。
 *
 * 2. 图标与文字的间距被算了两遍。
 *    基础类已经有 gap-2，副本又各自加了 mr-2，实际间距 16px，比头像菜单
 *    （gap-2.5 = 10px）还宽，把标签挤到必须换行。现在只保留 gap。
 *
 * 3. 高亮只写 focus:，触屏完全失效。
 *    Radix MenuItem 的 pointermove 处理被 whenMouse 包住，仅当
 *    pointerType === "mouse" 时才调 ref.focus()；手指按下走的是
 *    data-highlighted。所以手机用户按住菜单项时背景一点不变。
 *
 * 4. 固定宽度 + 紧凑行高。
 *    w-36 / w-40 / w-44 在多语言下都会截断：英文 "Switch to trial mode" 约
 *    130px、日文「システムに合わせる」9 个全角字约 108px，而容器扣掉内边距后
 *    标签可用宽度分别只剩 116px / 92px，必然折行（DropdownMenuItem 默认没有
 *    whitespace-nowrap）。行高 py-1.5 + text-xs 也只有 28px。
 *
 * ── 刻意不统一的部分 ────────────────────────────────────────────
 * `SelectContent` 没有改用 overlaySurfaceClass：它在 position="popper" 下由
 * Radix 用 min-w-[var(--radix-select-trigger-width)] 钉死宽度，塞 w-max 会
 * 和这段 pin 打架。它只补了 collisionPadding。
 */

/**
 * 浮层材质：半透明底 + 细边 + 22px 圆角 + 背景模糊 + 两档阴影。
 *
 * 基础类 DropdownMenuContent / PopoverContent 自带的 bg-popover、shadow-md、
 * rounded-md、p-1 以及全部进出动画都会�� twMerge 依次替换掉 —— 所以调用方
 * **不需要**再重复写 animate-in / zoom-in-95，基础类已经提供了
 * `data-[state=open]:` 前缀版本。
 *
 * 宽度默认 `w-max` + `min-w`，内容自适应；需要固定宽度时在 cn() 里追加
 * （如头像菜单的 w-[270px]），twMerge 会让后者覆盖 w-max。
 */
export const overlaySurfaceClass =
  "z-50 min-w-[10rem] w-max select-none rounded-[22px] border border-border/50 bg-background/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]";

/**
 * 菜单行。
 *
 * 需要「选中态」时用 `cn(menuItemClass, "bg-primary/10 …")` 叠加，但必须同时
 * 覆盖 hover / data-[highlighted]（例如 `hover:bg-primary/15
 * data-[highlighted]:bg-primary/15`），否则高亮会把选中底色盖掉。
 *
 * 禁用态一律写 `data-[disabled]:`：Radix 给 role="menuitem" 的 div 打的是
 * data-disabled，不是原生 disabled 属性，所以 disabled:* 永远不会命中。
 */
export const menuItemClass =
  "flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-footnote font-medium text-foreground transition-all hover:bg-surface-3/50 data-[highlighted]:bg-surface-3/50 active:scale-[0.98] data-[disabled]:opacity-40";

/** 危险行（删除 / 停用）。 */
export const menuItemDangerClass =
  "flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-footnote font-medium text-destructive transition-all hover:bg-destructive/10 focus:bg-destructive/10 data-[highlighted]:bg-destructive/10 active:scale-[0.98] data-[disabled]:opacity-40 dark:text-destructive";

/** 分隔线。基础类的 -mx-1 会被这里的 mx-1 顶掉。 */
export const menuSeparatorClass = "mx-1 my-1 opacity-60";
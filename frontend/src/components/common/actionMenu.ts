/**
 * 全项目「操作型下拉菜单」的统一样式。
 *
 * 此前同一类菜单散落五处手写副本，各自漂移出四个问题：
 *
 *   - components/chat/ChatHeader.tsx             移动端聊天页顶栏「三个点」
 *   - components/chat/SwipeableConversationCard  移动端历史列表卡片「三个点」
 *   - components/chat/Sidebar.tsx                桌面端会话列表「三个点」
 *   - components/usage/UsagePanels.tsx           管理员用户操作菜单
 *   - components/common/ThemeToggle.tsx          主题选择菜单
 *
 * （另有 components/layout/UserAvatarDropdown.tsx 是第六处，菜单项因为
 *   要放账户卡片而另写了一套行样式，但容器材质与这里完全一致。）
 *
 * ── 问题 1：图标尺寸写了 h-3.5 w-3.5 但从不生效 ──────────────────
 * `DropdownMenuItem` 基础类含 `[&>svg]:size-4`，编译成
 * `.\[\&\>svg\]\:size-4 > svg`，specificity (0,1,1) 高于 `.h-3\.5` 的
 * (0,1,0)；`cn` 里的 twMerge 只在 modifier 相同时才去重，`[&>svg]:` 与
 * 裸类不同 —— 两个类都会留下，由 CSS 决定胜负，于是图标一律渲染成 16px。
 * `<Button>` 基础类的 `[&_svg]:size-4` 同理。
 * 现在统一写 `h-4 w-4`（本来就是 16px），代码与实际渲染一致。
 *
 * ── 问题 2：图标与文字的间距被算了两遍 ────────────────────────
 * 基础类已经有 `gap-2`，各副本又各自加了 `mr-2`，实际间距 16px，比
 * 头像菜单（`gap-2.5` = 10px）还宽，把标签挤到必须换行。现在只保留 gap。
 *
 * ── 问题 3：高亮只写 focus:，触屏完全失效 ──────────────────────
 * Radix `MenuItem` 的 pointermove 处理被 `whenMouse` 包住，仅当
 * pointerType === "mouse" 时才调 `ref.focus()`；手指按下走的是
 * `data-highlighted`。所以手机用户按住菜单项时背景一点不变。
 * `UserAvatarDropdown` 早就为此改用 `data-[highlighted:]`，其余各处漏了。
 *
 * ── 问题 4：固定宽度 + 紧凑行高 ────────────────────────────────
 * `w-36` / `w-40` / `w-44` 在多语言下都会截断：英文 "Switch to trial mode"
 * 约 130px、日文「システムに合わせる」9 个全角字约 108px，而容器扣掉内边距
 * 后标签可用宽度分别只剩 116px / 92px，必然折行（`DropdownMenuItem` 默认
 * 没有 whitespace-nowrap）。行高 `py-1.5` + `text-xs` 也只有 28px，低于
 * globals.css 里自述的 h-9（36px）触控目标下限。
 * 现在改为 `w-max` + `min-w` 下限 + 不换行，行高回到 px-2.5 py-2（38px）。
 *
 * 统一后对齐 `UserAvatarMenu` 的刻度：字号 text-footnote、内距 px-2.5 py-2、
 * 圆角 rounded-xl、按下 active:scale-[0.98]，容器为毛玻璃 + 22px 圆角。
 */

/**
 * 菜单容器材质。
 *
 * 用 `w-max` + `min-w` 而不是固定宽度：内容自适应，同时保证短文案下不会缩成
 * 一条窄缝。基础类的 `bg-popover shadow-md rounded-md p-1` 会被 twMerge 依次
 * 替换掉；窄屏收边交给 `collisionPadding`。
 */
export const actionMenuContentClass =
  "z-50 min-w-[10rem] w-max select-none rounded-[22px] border border-border/50 bg-background/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]";

/**
 * 普通菜单行。
 *
 * 需要「选中态」时用 `cn(actionMenuItemClass, "bg-primary/10 …")` 叠加，但
 * 必须同时覆盖 hover / data-[highlighted]（例如 `hover:bg-primary/15
 * data-[highlighted]:bg-primary/15`），否则高亮会把选中底色盖掉。
 */
export const actionMenuItemClass =
  "flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-footnote font-medium text-foreground transition-all hover:bg-surface-3/50 data-[highlighted]:bg-surface-3/50 active:scale-[0.98] data-[disabled]:opacity-40";

/**
 * 危险行（删除 / 停用）。
 *
 * 禁用态一律写 `data-[disabled]:`：Radix 给 `role="menuitem"` 的 div 打的是
 * `data-disabled`，不是原生 `disabled` 属性，所以基础类之外的 `disabled:*`
 * 永远不会命中。
 */
export const actionMenuDangerItemClass =
  "flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-footnote font-medium text-destructive transition-all hover:bg-destructive/10 focus:bg-destructive/10 data-[highlighted]:bg-destructive/10 active:scale-[0.98] data-[disabled]:opacity-40 dark:text-destructive";

/** 分隔线。基础类的 `-mx-1` 会被这里的 `mx-1` 顶掉。 */
export const actionMenuSeparatorClass = "mx-1 my-1 opacity-60";
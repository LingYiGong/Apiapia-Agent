/**
 * 会话操作菜单（置顶 / 重命名 / 删除 / 上下移动）的统一样式。
 *
 * 此前同一份菜单散落三处手写副本：
 *   - components/chat/ChatHeader.tsx             移动端聊天页顶栏「三个点」
 *   - components/chat/SwipeableConversationCard  移动端历史列表卡片「三个点」
 *   - components/chat/Sidebar.tsx                桌面端会话列表「三个点」
 *
 * 三份拷贝各自漂移，叠加出四个问题：
 *
 * 1. 图标尺寸写了 `h-3.5 w-3.5` 但**从不生效**。
 *    `DropdownMenuItem` 基础类含 `[&>svg]:size-4`，编译成
 *    `.\[\&\>svg\]\:size-4 > svg`，specificity (0,1,1) 高于
 *    `.h-3\.5` 的 (0,1,0)；而 `cn` 里的 twMerge 只在 modifier 相同时
 *    才去重，`[&>svg]:` 与裸类不同 —— 两个类都会留下，由 CSS 决定胜负，
 *    于是图标一律渲染成 16px。这里直接写 `h-4 w-4`，让代码与实际
 *    渲染一致，不再留一个骗人的类名。
 *
 * 2. 图标与文字的间距被算了两遍。
 *    基础类已经有 `gap-2`，三份副本又各自加了 `mr-2`，实际间距 16px，
 *    比同屏头像菜单（`gap-2.5` = 10px）还宽，把标签挤到必须换行。
 *    现在只保留 gap。
 *
 * 3. 高亮只写 `focus:`，触屏完全失效。
 *    Radix `MenuItem` 的 pointermove 处理被 `whenMouse` 包住，仅当
 *    pointerType === "mouse" 时才调 `ref.focus()`；手指按下走的是
 *    `data-highlighted`。所以手机用户按住菜单项时背景一点不变，
 *    不知道点没点上。项目在 `UserAvatarMenu` 早就改用 `data-[highlighted]`
 *    （那里还留着一段注释记录这次修正），这里漏了。
 *
 * 4. 固定 `w-36` / `w-40` + `text-xs` + `py-1.5`。
 *    行高只有 6+16+6 = 28px，低于 Apple HIG 的 44pt，也低于项目在
 *    globals.css 里写明的「触控目标靠 h-9 / h-10 手工保证」下限；
 *    固定宽度还会把 `Delete conversation` 这类英文长标签折成两行
 *    （DropdownMenuItem 默认没有 whitespace-nowrap）。改为
 *    `w-max` + `min-w` 下限 + 不换行，窄屏靠 collisionPadding 收边。
 *
 * 统一后对齐 `UserAvatarMenu` 的刻度：字号 text-footnote、内距
 * px-2.5 py-2（38px 行高）、圆角 rounded-xl、按下 active:scale-[0.98]。
 * 容器材质同样取自那里：毛玻璃 + 22px 圆角 + 大阴影。
 */

/**
 * 菜单容器。
 *
 * 用 `w-max` + `min-w` 而不是固定宽度：内容自适应，同时保证三条菜单
 * 在中文下不会缩成一条窄缝。基础类的 `bg-popover shadow-md rounded-md p-1`
 * 会被 twMerge 依次替换掉。
 */
export const conversationMenuContentClass =
  "z-50 min-w-[9.5rem] w-max select-none rounded-[22px] border border-border/50 bg-background/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]";

/** 普通菜单行。 */
export const conversationMenuItemClass =
  "flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-footnote font-medium text-foreground transition-all hover:bg-surface-3/50 data-[highlighted]:bg-surface-3/50 active:scale-[0.98] data-[disabled]:opacity-40";

/**
 * 危险行（删除）。
 *
 * 底部列表禁用的菜单项由 Radix 打 `data-disabled` 而非原生 `disabled`
 * 属性，所以禁用态一律写 `data-[disabled]:`（基础类里的 `disabled:*`
 * 对 role="menuitem" 的 div 永远不命中）。
 */
export const conversationMenuDangerItemClass =
  "flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-footnote font-medium text-destructive transition-all hover:bg-destructive/10 focus:bg-destructive/10 data-[highlighted]:bg-destructive/10 active:scale-[0.98] data-[disabled]:opacity-40 dark:text-destructive";

/** 分隔线。基础类的 `-mx-1` 会被这里的 `mx-1` 顶掉。 */
export const conversationMenuSeparatorClass = "mx-1 my-1 opacity-60";
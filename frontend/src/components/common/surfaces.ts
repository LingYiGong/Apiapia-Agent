/**
 * 浮层材质与菜单行的统一样式。
 */

/** 浮层材质：半透明底 + 细边 + 22px 圆角 + 背景模糊 + 两档阴影 */
export const overlaySurfaceClass =
  "z-50 min-w-[10rem] w-max select-none rounded-[22px] border border-border/50 bg-background/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]";

/** 菜单行 */
export const menuItemClass =
  "flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-footnote font-medium text-foreground transition-all hover:bg-surface-3/50 data-[highlighted]:bg-surface-3/50 active:scale-[0.98] data-[disabled]:opacity-40";

/** 危险行（删除 / 停用）。 */
export const menuItemDangerClass =
  "flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-footnote font-medium text-destructive transition-all hover:bg-destructive/10 focus:bg-destructive/10 data-[highlighted]:bg-destructive/10 active:scale-[0.98] data-[disabled]:opacity-40 dark:text-destructive";

/** 分隔线。基础类的 -mx-1 会被这里的 mx-1 顶掉。 */
export const menuSeparatorClass = "mx-1 my-1 opacity-60";
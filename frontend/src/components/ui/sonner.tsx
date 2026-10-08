"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * 顶部提示与各页面头部栏之间的间距。必须与 globals.css 中
 * `[data-sonner-toaster][data-y-position="top"]` 的覆盖值保持一致。
 *
 * 两处共同引用 globals.css 的 --header-h / --sat，此前这里写着
 * `calc(3.85rem + env(...))`、CSS 里写着 `calc(3.85rem + env(...))`，
 * 是两份互不关联的字面量，且 3.85rem 与实际头部高度（--header-h）无关 ——
 * 头部一旦调整，toast 遮挡问题就会静默复发。
 */
export const TOASTER_TOP_OFFSET =
  "calc(var(--header-h) + env(safe-area-inset-top, 0px) + 0.6rem)";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      offset={TOASTER_TOP_OFFSET}
      toastOptions={{
        classNames: {
          /* 字号必须显式声明。此前这里只给了颜色，Toast 全部继承 body 的
             16px 且拿不到 tailwind.config.ts fontSize 刻度里的 Apple
             tracking（Sonner 渲染进 body 下的 portal）。改用刻度类后
             toast=14px / description=12px，符合 shadcn 惯例，也落在
             Apple Footnote 13pt 与 Caption 1 12pt 附近。 */
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:text-sm",
          description:
            "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

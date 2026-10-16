import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
ghost: "hover:bg-accent hover:text-accent-foreground",
          // variant `link` 原先在此，全站 0 处引用，已删。
        },
        size: {
          /**
           * 触控目标高度。
           *
           * 此前 default/icon 是 `h-9`(36px)、sm 是 `h-8`(32px)，全站
           * 没有任何一个按钮达到 44×44 —— globals.css 早先把
           * `.apple-touch-target` 删掉时注释写的是「靠 h-9/h-10 手工保证」，
           * 但 h-9 只有 36px。
           *
           * 这里改成**触屏给足 44px、大屏才收紧**：断点用 `mdup`
           * （宽 ≥768 **且** 高 ≥600）而不是 `md`，因为横屏手机
           * （iPhone 15 Pro Max 932×430）也必须拿到大号热区。
           * 这样桌面端的视觉密度一字不变，风险被限制在触屏侧。
           */
          default: "h-11 px-4 py-2 mdup:h-9",
          sm: "h-11 rounded-md px-3 text-xs mdup:h-8",
          icon: "h-11 w-11 mdup:h-9 mdup:w-9",
        },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, type = "button", ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        // HTML 的 <button> 默认 type="submit"。全站有 100+ 处 <Button> 没有显式
        // 写 type，此前它们恰好都不在 <form> 里 —— 但这是「谁把按钮搬进表单谁
        // 踩雷」的地雷：表单会静默提交并丢掉整页状态。默认改成 "button"，
        // 真正要提交的按钮写 type="submit"（表单里已按此写法）。
        type={asChild ? undefined : type}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

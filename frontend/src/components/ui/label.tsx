import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * 本项目的 Label 一律**包住**控件，因此 `peer-disabled:*` 一律匹配不到
 * （`peer-*` 需要前置兄弟节点）。别为了迁就它改成兄弟结构 —— 那样就换成
 * 不可聚焦的 span 了，键盘可达性会丢。
 */
const labelVariants = cva("text-sm font-medium leading-none");

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };

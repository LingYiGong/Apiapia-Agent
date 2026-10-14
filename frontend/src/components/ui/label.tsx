import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * 此前这里是 shadcn 默认的
 * `peer-disabled:cursor-not-allowed peer-disabled:opacity-70`，已删 —— 它在本项目
 * 的每一个调用点都匹配不到，原因是本项目的 Label 一律**包住**控件，而 Tailwind 的
 * `peer-*` 编译成 `.peer:disabled ~ .peer-disabled\:…`，那个 `~` 要求 peer 是前置
 * **兄弟**节点，后代永远匹配不上。
 *
 *   - components/usage/UsagePanels.tsx  <Label><Switch disabled={…} /></Label>
 *     这是唯一一处 Switch 真的会被 disabled 的地方（请求进行中），而它恰好是
 *     后代结构，所以禁用时 Label 不会变灰 —— 一直如此，删掉这两行不改变表现。
 *   - components/settings/SettingsView.tsx  是兄弟结构，peer 规则本可生效，
 *     但那个 Switch 从不传 disabled，所以也匹配不到。
 *   - 其余调用点全是 sr-only 标签（搜索框、重命名输入框），视觉上不可见。
 *
 * 注意这里**不要**为了迁就 peer 选择器而把包住改成兄弟：那正是为了键盘可达性
 * 才选的结构（见 UsagePanels.tsx 里那段注释 —— 不可聚焦的 span 用户根本够不到）。
 * 若确实想让 Label 跟随禁用态变灰，唯一可行的办法是在调用方用 React 态传
 * aria-disabled / data-disabled 下来，CSS 从子元素选父元素是做不到的。
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

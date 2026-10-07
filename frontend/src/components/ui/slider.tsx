"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 滑块。
 *
 * 这里刻意没用 @radix-ui/react-slider（项目也没有安装），而是用一层视觉轨道
 * 盖住一个透明的原生 `<input type="range">`：原生 range 自带键盘、屏幕阅读器
 * 数值播报与触屏拖动，自己实现一遍只会更差。
 *
 * 无障碍上补齐了三件事：
 *   - `aria-label`（此前整个滑块**没有任何**可访问名称，读屏只会念「滑块」）
 *   - `aria-valuetext`（把 0.85 念成「0.85」而不是裸数值）
 *   - 视觉 thumb 的 focus-visible 描边（透明 input 吃掉了焦点，原先完全看不到）
 */
export interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
  /** 无障碍名称。**必填** —— 没有它读屏用户无从判断这是控制什么的。 */
  "aria-label": string;
  /** 把数值转成人话播报，例如 (v) => `${v.toFixed(2)} 度` */
  formatValueText?: (value: number) => string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  disabled = false,
  "aria-label": ariaLabel,
  formatValueText,
}: SliderProps) {
  const currentVal = value?.[0] ?? min;
  const percentage = Math.min(
    100,
    Math.max(0, ((currentVal - min) / (max - min || 1)) * 100)
  );

  return (
    <div
      className={cn(
        "relative flex w-full items-center py-2 select-none",
        // touch-none 只作用在轨道上：手指按下滑块时不触发页面滚动
        "touch-none",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-4">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-75"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentVal}
        disabled={disabled}
        onChange={(e) => onValueChange([parseFloat(e.target.value)])}
        aria-label={ariaLabel}
        aria-valuetext={formatValueText?.(currentVal)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />

      {/* 视觉 thumb。pointer-events-none，让事件穿透到下面的 input。
          focus 状态靠 peer 兄弟选择器无法命中（thumb 在 input 之后），
          所以改成 :has() —— 现代浏览器全部支持。 */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/10 bg-white shadow-[0_2px_5px_rgba(0,0,0,0.22)] transition-transform",
          "[input:focus-visible~&]:ring-2 [input:focus-visible~&]:ring-ring",
          "[input:focus-visible~&]:ring-offset-2 [input:focus-visible~&]:ring-offset-background",
          "active:scale-110"
        )}
        style={{ left: `${percentage}%` }}
      />
    </div>
  );
}

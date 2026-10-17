"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
  "aria-label": string;
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

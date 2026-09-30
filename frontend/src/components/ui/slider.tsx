"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  disabled = false,
}: SliderProps) {
  const currentVal = value[0] ?? min;
  const percentage = Math.min(
    100,
    Math.max(0, ((currentVal - min) / (max - min)) * 100)
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange([parseFloat(e.target.value)]);
  };

  return (
    <div
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-75"
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
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={currentVal}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 block h-4 w-4 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-events-none shadow-sm"
        style={{ left: `${percentage}%` }}
      />
    </div>
  );
}

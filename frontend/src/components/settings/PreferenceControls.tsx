"use client";

import React from "react";
import { Lightbulb, Target, Scale, Palette, Zap, BookOpen, Sparkles, PenLine } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Panel, SectionLabel } from "@/components/common/Panel";
import { cn } from "@/lib/utils";

/**
 * 系统人设（system prompt）与人格预设。
 *
 * 此前这段手写 radiogroup 声明了 role="radio" 却没有方向键导航 ——
 * 读屏会把它播报成一组单选按钮，但键盘用户按 ↑↓ 什么都不会发生。
 * 这里补上 roving tabindex + 方向键，与原生 radio group 行为一致。
 */

export const SYSTEM_PROMPT_PRESETS = [
  {
    id: "default",
    label: "默认助手",
    desc: "通用智能助手，亲和可靠",
    icon: Sparkles,
    text: "你是一个智能、真诚、有洞察力的个人智能助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。",
  },
  {
    id: "concise",
    label: "简洁直接",
    desc: "直击要点，无寒暄废话",
    icon: Zap,
    text: "你是一个高效直接的个人智能助理。回答简洁、直击要点，避免寒暄和冗余解释，善用列表呈现；除非用户要求，不输出长篇大论。",
  },
  {
    id: "rigorous",
    label: "严谨学术",
    desc: "严密论证，逻辑条理清晰",
    icon: BookOpen,
    text: "你是一个严谨细致的个人智能助理。回答准确、有依据，不确定的内容明确说明；涉及事实时优先引用检索到的来源；逻辑清晰、分步骤表达。",
  },
  {
    id: "creative",
    label: "创意灵感",
    desc: "多角度发散，生动灵动",
    icon: Lightbulb,
    text: "你是一个富有想象力的个人智能助理。乐于发散、多给灵感与可能性，表达生动；涉及客观事实时仍以检索资料为准，不虚构。",
  },
] as const;

export type PersonaId = (typeof SYSTEM_PROMPT_PRESETS)[number]["id"] | "custom";

export function matchPersonaId(text: string): PersonaId {
  const found = SYSTEM_PROMPT_PRESETS.find((p) => p.text === text);
  return found ? found.id : "custom";
}

export function PersonaPicker({
  personaId,
  systemPrompt,
  onPromptChange,
}: {
  personaId: PersonaId;
  systemPrompt: string;
  onPromptChange: (text: string) => void;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    SYSTEM_PROMPT_PRESETS.findIndex((p) => p.id === personaId)
  );

  const select = (idx: number) => {
    const preset = SYSTEM_PROMPT_PRESETS[idx];
    if (!preset) return;
    onPromptChange(preset.text);
    refs.current[idx]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = SYSTEM_PROMPT_PRESETS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = activeIndex >= last ? 0 : activeIndex + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = activeIndex <= 0 ? last : activeIndex - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    select(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel className="pb-0">系统人设设定</SectionLabel>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPromptChange(systemPrompt)}
            aria-pressed={personaId === "custom"}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-medium transition-colors active:scale-95",
              personaId === "custom"
                ? "border-primary bg-primary/10 font-semibold text-primary shadow-2xs"
                : "border-border/60 bg-surface-3/30 text-muted-foreground hover:bg-surface-3/60 hover:text-foreground"
            )}
          >
            <PenLine className="h-3 w-3" />
            <span>自定义</span>
          </button>
          <span className="font-mono text-2xs text-muted-foreground">
            {systemPrompt.length} 字
          </span>
        </div>
      </div>

      <Panel className="space-y-3 p-3.5 sm:p-4">
        <div
          role="radiogroup"
          aria-label="助手人设风格"
          onKeyDown={onKeyDown}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {SYSTEM_PROMPT_PRESETS.map((preset, idx) => {
            const isActive = personaId === preset.id;
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                tabIndex={idx === activeIndex ? 0 : -1}
                ref={(el) => {
                  refs.current[idx] = el;
                }}
                onClick={() => onPromptChange(preset.text)}
                className={cn(
                  "relative flex cursor-pointer flex-col rounded-xl border p-2.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary bg-primary/10 font-semibold text-primary shadow-2xs ring-1 ring-primary/30"
                    : "border-border/60 bg-surface-3/30 text-muted-foreground hover:bg-surface-3/60 hover:text-foreground"
                )}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-lg transition-colors",
                      isActive ? "bg-primary/20 text-primary" : "bg-surface-3 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                  {isActive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
                </div>
                <span className="block text-footnote font-medium text-foreground">{preset.label}</span>
                <span className="mt-0.5 line-clamp-1 text-2xs leading-snug text-muted-foreground">
                  {preset.desc}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="system-prompt-textarea" className="text-xs text-muted-foreground">
            人设指令
          </Label>
          <Textarea
            id="system-prompt-textarea"
            rows={3}
            value={systemPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={
              personaId === "custom"
                ? "输入自定义的人设指令、口吻偏好与准则..."
                : "在此设定 AI 助理的角色行为准则..."
            }
            className="resize-y rounded-xl border-border/60 bg-surface-3/30 text-footnote leading-relaxed transition-colors focus:bg-background"
          />
        </div>
      </Panel>
    </div>
  );
}

export const TEMPERATURE_PRESETS = [
  { id: "precise", label: "严谨精确", value: 0.2, icon: Target },
  { id: "balanced", label: "日常平衡", value: 0.7, icon: Scale },
  { id: "creative", label: "发散创意", value: 1.0, icon: Palette },
] as const;

export function TemperatureControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
        <SectionLabel className="pb-0">采样温度 (Temperature)</SectionLabel>
        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-2xs font-semibold text-rose-600 dark:text-rose-400">
          {value.toFixed(2)}
        </span>
      </div>

      <Panel className="space-y-3 p-3.5 sm:p-4">
        <div className="space-y-1.5 px-1">
          {/* aria-label 与 aria-valutext 由 Slider 强制要求 */}
          <Slider
            aria-label="采样温度"
            formatValueText={(v) => `${v.toFixed(2)}，${
              v < 0.4 ? "严谨精确" : v > 0.85 ? "发散创意" : "日常平衡"
            }`}
            min={0}
            max={2}
            step={0.05}
            value={[value]}
            onValueChange={(vals) => {
              // Radix 语义上 value 至少一项，但解构拿到的是 number | undefined。
              // 不判空的话 Math.round(undefined) → NaN，温度会直接变成 NaN 并被保存。
              const val = vals?.[0];
              if (typeof val === "number" && Number.isFinite(val)) {
                onChange(Math.round(val * 100) / 100);
              }
            }}
          />
          <div className="flex justify-between px-0.5 font-mono text-2xs text-muted-foreground">
            <span>0.0 严谨精确</span>
            <span>1.0 均衡日常</span>
            <span>2.0 发散创意</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {TEMPERATURE_PRESETS.map((preset) => {
            const isActive = Math.abs(value - preset.value) < 0.01;
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.value)}
                aria-pressed={isActive}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary bg-primary/10 font-semibold text-primary shadow-2xs ring-1 ring-primary/30"
                    : "border-border/60 bg-surface-3/30 text-muted-foreground hover:bg-surface-3/60 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground")}
                />
                <span className="text-xs">
                  {preset.label} ({preset.value})
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

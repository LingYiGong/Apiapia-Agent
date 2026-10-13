"use client";

import React from "react";
import { Target, Scale, Palette } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Panel, SectionLabel } from "@/components/common/Panel";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const TEMPERATURE_PRESETS = [
  { id: "precise", labelKey: "settings.persona.temperaturePrecise", value: 0.2, icon: Target },
  { id: "balanced", labelKey: "settings.persona.temperatureBalanced", value: 0.7, icon: Scale },
  { id: "creative", labelKey: "settings.persona.temperatureCreative", value: 1.0, icon: Palette },
] as const;

export function TemperatureControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useI18n();

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
        <SectionLabel className="pb-0">{t("settings.persona.temperatureLabel")}</SectionLabel>
        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-2xs font-semibold text-rose-600 dark:text-rose-400">
          {value.toFixed(2)}
        </span>
      </div>

      <Panel className="space-y-3 p-3.5 sm:p-4">
        <div className="space-y-1.5 px-1">
          {/* aria-label 与 aria-valutext 由 Slider 强制要求 */}
          <Slider
            aria-label={t("settings.persona.temperatureAria")}
            formatValueText={(v) =>
              t("settings.persona.temperatureValueText", {
                value: v.toFixed(2),
                label: t(
                  v < 0.4
                    ? "settings.persona.temperaturePrecise"
                    : v > 0.85
                      ? "settings.persona.temperatureCreative"
                      : "settings.persona.temperatureBalanced"
                ),
              })
            }
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
            <span>{t("settings.persona.temperatureTicks.min")}</span>
            <span>{t("settings.persona.temperatureTicks.mid")}</span>
            <span>{t("settings.persona.temperatureTicks.max")}</span>
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
                  {t(preset.labelKey)} ({preset.value})
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

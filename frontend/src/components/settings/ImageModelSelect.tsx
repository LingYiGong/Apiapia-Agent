"use client";

import React, { useMemo } from "react";
import { Palette } from "lucide-react";
import { ModelPicker } from "@/components/common/ModelPicker";
import { toImageModelOptions } from "@/lib/models";
import { useI18n } from "@/i18n";
import type { ImageModelItem } from "@/types";

interface ImageModelSelectProps {
  /** 允许为 null，表示用户尚未选择绘图模型 */
  value: string | null;
  onChange: (modelId: string) => void;
  models: ImageModelItem[];
  placeholder?: string;
  loading?: boolean;
  /** 后端是否已完成过一次同步；用于区分「没同步」与「同步了但没模型」 */
  synced?: boolean;
  className?: string;
  isTrialMode: boolean;
}

/** 绘图模型选择器 */
export const ImageModelSelect: React.FC<ImageModelSelectProps> = ({
  value,
  onChange,
  models,
  placeholder,
  loading = false,
  synced = true,
  className,
  isTrialMode,
}) => {
  const { t } = useI18n();
  const options = useMemo(() => toImageModelOptions(models), [models]);
  const kindLabel = t("settings.modelGroup.image");

  const emptyState = useMemo(() => {
    if (models.length === 0) {
      return (
        <p className="px-3 py-8 text-center text-xs text-muted-foreground leading-relaxed">
          {!synced
            ? t("settings.pickerEmpty.notSynced", { kind: kindLabel })
            : isTrialMode
              ? t("settings.pickerEmpty.trialNoFree", {
                  kind: kindLabel,
                  env: "FREE_IMAGE_MODELS",
                })
              : t("settings.pickerEmpty.syncedButEmpty")}
        </p>
      );
    }
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
        {t("settings.picker.noMatch", { kind: kindLabel })}
      </p>
    );
  }, [models.length, synced, isTrialMode, kindLabel, t]);

  return (
    <ModelPicker
      value={value}
      onChange={onChange}
      options={options}
      kindLabel={kindLabel}
      placeholder={placeholder ?? t("settings.modelGroup.imagePlaceholder")}
      className={className}
      loading={loading}
      triggerIcon={Palette}
      width="narrow"
      isTrialMode={isTrialMode}
      emptyState={emptyState}
    />
  );
};

export default ImageModelSelect;

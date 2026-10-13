"use client";

import React, { useMemo } from "react";
import { Palette } from "lucide-react";
import { ModelPicker } from "@/components/common/ModelPicker";
import { toImageModelOptions } from "@/lib/models";
import { useI18n } from "@/i18n";
import type { ImageModelItem } from "@/types";

interface ImageModelSelectProps {
  /**
   * 允许为 null —— UserSetting.image_model 本身就是 `string | null`，
   * 表示用户尚未选择绘图模型。这里若收窄成 string，调用方会直接类型报错。
   */
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

/**
 * 绘图模型选择器。实现已收敛到共享的 <ModelPicker>；
 * 本文件只负责归一化后端返回体，并提供绘图场景专属的空状态文案。
 *
 * 与语言模型的差异全部通过 props 表达，不再各自维护一份弹层实现：
 * - 无 免费/精选/全部 分组筛选（不传 filterGroups）
 * - 「是否免费」直接采信后端下发的 is_free 字段，而非启发式
 */
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

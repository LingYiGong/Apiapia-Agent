"use client";

import React, { useMemo } from "react";
import { Video } from "lucide-react";
import { ModelPicker } from "@/components/common/ModelPicker";
import { toVideoModelOptions } from "@/lib/models";
import { useI18n } from "@/i18n";
import type { VideoModelItem } from "@/types";

interface VideoModelSelectProps {
  /**
   * 允许为 null —— UserSetting.video_model 本身就是 `string | null`，
   * 表示用户尚未选择视频模型。
   */
  value: string | null;
  onChange: (modelId: string) => void;
  models: VideoModelItem[];
  placeholder?: string;
  loading?: boolean;
  /** 后端是否已完成过一次同步；用于区分「没同步」与「同步了但没模型」 */
  synced?: boolean;
  className?: string;
  isTrialMode: boolean;
}

/**
 * 视频模型选择器。基于共享的 <ModelPicker>，
 * 负责归一化后端返回体，并提供视频模型场景专属的空状态文案。
 */
export const VideoModelSelect: React.FC<VideoModelSelectProps> = ({
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
  const options = useMemo(() => toVideoModelOptions(models), [models]);
  const kindLabel = t("settings.modelGroup.video");

  const emptyState = useMemo(() => {
    if (models.length === 0) {
      return (
        <p className="px-3 py-8 text-center text-xs text-muted-foreground leading-relaxed">
          {!synced
            ? t("settings.pickerEmpty.notSynced", { kind: kindLabel })
            : isTrialMode
              ? t("settings.pickerEmpty.trialNoFree", {
                  kind: kindLabel,
                  env: "FREE_VIDEO_MODELS",
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
      placeholder={placeholder ?? t("settings.modelGroup.videoPlaceholder")}
      className={className}
      loading={loading}
      triggerIcon={Video}
      width="narrow"
      isTrialMode={isTrialMode}
      emptyState={emptyState}
    />
  );
};

export default VideoModelSelect;

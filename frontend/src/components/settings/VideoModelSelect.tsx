"use client";

import React, { useMemo } from "react";
import { Video } from "lucide-react";
import { ModelPicker } from "@/components/common/ModelPicker";
import { toVideoModelOptions } from "@/lib/models";
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
  placeholder = "选择视频模型",
  loading = false,
  synced = true,
  className,
  isTrialMode,
}) => {
  const options = useMemo(() => toVideoModelOptions(models), [models]);

  const emptyState = useMemo(() => {
    if (models.length === 0) {
      return (
        <p className="px-3 py-8 text-center text-xs text-muted-foreground leading-relaxed">
          {!synced
            ? "视频模型列表尚未同步，请点击列表上方的「同步列表」按钮完成一次同步。"
            : isTrialMode
              ? "当前无可用免费视频模型，请联系管理员在 FREE_VIDEO_MODELS 中登记免费模型。"
              : "后端已同步但无可用模型，请检查 .env 中的 OpenRouter 服务凭证是否有效。"}
        </p>
      );
    }
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
        未找到匹配的视频模型
      </p>
    );
  }, [models.length, synced, isTrialMode]);

  return (
    <ModelPicker
      value={value}
      onChange={onChange}
      options={options}
      kindLabel="视频模型"
      placeholder={placeholder}
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

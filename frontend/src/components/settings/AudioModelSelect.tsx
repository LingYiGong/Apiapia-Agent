"use client";

import React, { useMemo } from "react";
import { AudioLines } from "lucide-react";
import { ModelPicker } from "@/components/common/ModelPicker";
import { toAudioModelOptions } from "@/lib/models";
import type { AudioModelItem } from "@/types";

type Capability = "stt" | "tts";

interface AudioModelSelectProps {
  /** 允许为 null —— UserSetting.stt_model / tts_model 本身就是 `string | null` */
  value: string | null;
  onChange: (modelId: string) => void;
  /** 整份语音目录；组件按 capability 自行过滤 */
  models: AudioModelItem[];
  /**
   * 选择哪一族模型。
   *
   * 这不是可选的装饰参数：语音识别与语音合成在上游是两族互不相交的模型，
   * 混在一个下拉里必然有一半选项用不了。这里强制调用方声明意图，父组件
   * 也因此无法忘记分流。
   */
  capability: Capability;
  /** 决定 kindLabel / placeholder / 空状态文案 */
  kindLabel: string;
  placeholder?: string;
  loading?: boolean;
  /** 后端是否已完成过一次同步；用于区分「没同步」与「同步了但没模型」 */
  synced?: boolean;
  className?: string;
  isTrialMode: boolean;
}

/**
 * 语音模型选择器（识别 / 合成共用）。
 *
 * 基于共享的 <ModelPicker>，负责按 capability 从同一份目录里切出对应的一族，
 * 并提供语音场景专属的空状态文案。
 */
export const AudioModelSelect: React.FC<AudioModelSelectProps> = ({
  value,
  onChange,
  models,
  capability,
  kindLabel,
  placeholder,
  loading = false,
  synced = true,
  className,
  isTrialMode,
}) => {
  // Filter before adapting, so the rank assigned inside toAudioModelOptions
  // counts only the family this picker is showing.
  const scoped = useMemo(
    () => models.filter((m) => m.capability === capability),
    [models, capability]
  );
  const options = useMemo(() => toAudioModelOptions(scoped), [scoped]);

  const emptyState = useMemo(() => {
    if (scoped.length === 0) {
      return (
        <p className="px-3 py-8 text-center text-xs text-muted-foreground leading-relaxed">
          {!synced
            ? "语音模型列表尚未同步，请点击列表上方的「同步列表」按钮完成一次同步。"
            : isTrialMode
              ? `当前无可用免费${kindLabel}，请联系管理员在 FREE_AUDIO_MODELS 中登记免费模型。`
              : "后端已同步但无可用模型，请检查 .env 中的 OpenRouter 服务凭证是否有效。"}
        </p>
      );
    }
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
        未找到匹配的{kindLabel}
      </p>
    );
  }, [scoped.length, synced, isTrialMode, kindLabel]);

  return (
    <ModelPicker
      value={value}
      onChange={onChange}
      options={options}
      kindLabel={kindLabel}
      placeholder={placeholder}
      className={className}
      loading={loading}
      triggerIcon={AudioLines}
      width="narrow"
      isTrialMode={isTrialMode}
      emptyState={emptyState}
    />
  );
};

export default AudioModelSelect;
"use client";

import React, { useMemo } from "react";
import { Palette } from "lucide-react";
import { ModelPicker } from "@/components/common/ModelPicker";
import { toImageModelOptions } from "@/lib/models";
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
  placeholder = "选择绘图模型",
  loading = false,
  synced = true,
  className,
  isTrialMode,
}) => {
  const options = useMemo(() => toImageModelOptions(models), [models]);

  const emptyState = useMemo(() => {
    if (models.length === 0) {
      return (
        <p className="px-3 py-8 text-center text-xs text-muted-foreground leading-relaxed">
          {!synced
            ? "绘图模型列表尚未同步，请点击列表上方的「同步列表」按钮完成一次同步。"
            : isTrialMode
              ? "当前无可用免费绘图模型，请联系管理员在 FREE_IMAGE_MODELS 中登记免费模型。"
              : "后端已同步但无可用模型，请检查 .env 中的生图服务凭证是否仍然有效。"}
        </p>
      );
    }
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
        未找到匹配的绘图模型
      </p>
    );
  }, [models.length, synced, isTrialMode]);

  return (
    <ModelPicker
      value={value}
      onChange={onChange}
      options={options}
      kindLabel="绘图模型"
      placeholder={placeholder}
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

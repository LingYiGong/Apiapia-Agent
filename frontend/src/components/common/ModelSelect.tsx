"use client";

import React, { useMemo } from "react";
import { Zap, Sparkles } from "lucide-react";
import {
  ModelPicker,
  allFilterMatch,
  featuredFilterMatch,
  freeFilterMatch,
  type ModelFilterGroup,
} from "@/components/common/ModelPicker";
import { toChatModelOptions } from "@/lib/models";
import type { ModelCatalogItem } from "@/types";

interface ModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  models: ModelCatalogItem[];
  placeholder?: string;
  className?: string;
  variant?: "default" | "compact";
}

/**
 * 语言模型选择器。实现已收敛到共享的 <ModelPicker>；
 * 本文件只负责把后端目录归一化，并组装「免费 / 精选 / 全部」分组筛选。
 */
export const ModelSelect: React.FC<ModelSelectProps> = ({
  value,
  onChange,
  models,
  placeholder,
  className,
  variant = "default",
}) => {
  const options = useMemo(() => toChatModelOptions(models), [models]);

  const filterGroups = useMemo<ModelFilterGroup[]>(() => {
    const free = options.filter(freeFilterMatch);
    const featured = options.filter(featuredFilterMatch);
    return [
      {
        key: "free",
        label: "免费",
        tone: "free",
        icon: Zap,
        count: free.length,
        available: free.length > 0,
        match: freeFilterMatch,
      },
      {
        key: "featured",
        label: "精选",
        tone: "featured",
        icon: Sparkles,
        count: featured.length,
        available: featured.length > 0,
        match: featuredFilterMatch,
      },
      {
        key: "all",
        label: "全部",
        tone: "all",
        count: options.length,
        available: true,
        match: allFilterMatch,
      },
    ];
  }, [options]);

  // 体验模式 = 目录里一个付费模型都没有。旧实现写的是
  // `sorted.every(isFreeModel)`，判断的是**筛选后**的列表 ——
  // 用户一输入搜索词，这个徽标就会消失。
  const isTrialMode = options.length > 0 && options.every((o) => o.isFree);

  return (
    <ModelPicker
      value={value}
      onChange={onChange}
      options={options}
      kindLabel="模型"
      ariaLabel="语言模型"
      placeholder={placeholder}
      className={className}
      variant={variant}
      width="wide"
      filterGroups={filterGroups}
      isTrialMode={isTrialMode}
    />
  );
};

export default ModelSelect;

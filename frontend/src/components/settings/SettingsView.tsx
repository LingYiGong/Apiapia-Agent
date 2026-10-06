"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { ModelCatalogItem, ImageModelItem, ImageModelsResponse } from "@/types";
import { useTheme } from "@/lib/theme";
import { ModelSelect, isFreeModel, isMultimodalModel } from "@/components/common/ModelSelect";
import { CURRENT_VERSION, triggerManualUpdateCheck } from "@/lib/version";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { notifyModelSyncResult } from "@/lib/feedback";
import { FullPageSkeleton, SettingsFormSkeleton } from "@/components/common/PageSkeleton";
import {
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Info,
  CheckCircle2,
  Zap,
  BookOpen,
  Lightbulb,
  PenLine,
  Target,
  Scale,
  Palette,
  Brain,
  Cpu,
  Check,
  RotateCcw,
  Sliders,
  Database,
  Cat,
  Layers,
  Server,
} from "lucide-react";
import { BrandLogo } from "@/components/common/BrandLogo";
import { ImageModelSelect } from "@/components/settings/ImageModelSelect";

interface InitialSettings {
  defaultModel: string;
  memoryModel: string;
  imageModel: string | null;
  systemPrompt: string;
  temperature: number;
  memoryEnabled: boolean;
}

const TEMPERATURE_PRESETS = [
  {
    id: "precise",
    label: "严谨精确",
    desc: "稳定可复现，代码与事实分析",
    value: 0.2,
    icon: Target,
  },
  {
    id: "balanced",
    label: "日常平衡",
    desc: "兼具逻辑与灵活性，通用推荐",
    value: 0.7,
    icon: Scale,
  },
  {
    id: "creative",
    label: "发散创意",
    desc: "头脑风暴，适合起名创作",
    value: 1.0,
    icon: Palette,
  },
] as const;

const SYSTEM_PROMPT_PRESETS = [
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

const MEMORY_MODEL_OPTIONS = [
  { id: "openai/gpt-4o-mini", label: "openai/gpt-4o-mini (推荐：高性价比、提取稳定)" },
  { id: "deepseek/deepseek-chat", label: "deepseek/deepseek-chat (DeepSeek V3 便宜且智能)" },
  { id: "anthropic/claude-3-5-haiku", label: "anthropic/claude-3-5-haiku (Claude 快速响应)" },
  { id: "google/gemini-2.5-flash", label: "google/gemini-2.5-flash (Gemini 2.5 Flash 超快)" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini (OpenAI 原生直连)" },
] as const;

function matchPersonaId(text: string): string {
  const found = SYSTEM_PROMPT_PRESETS.find((p) => p.text === text);
  return found ? found.id : "custom";
}

import { MobileTab } from "@/components/layout/UserAvatarDropdown";

export interface SettingsViewProps {
  isMobileSpa?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  isMobileSpa = false,
  onSelectMobileTab,
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Accounts without full model access only ever see zero-cost options.
  const isTrialMode = !user?.is_superuser && !user?.can_access_all_models;

  // User Settings State
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini");
  const [memoryModel, setMemoryModel] = useState("openai/gpt-4o-mini");
  const [imageModel, setImageModel] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [personaId, setPersonaId] = useState<string>("default");
  const [temperature, setTemperature] = useState(0.7);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  // Baseline state for dirty checking & reset (Apple HIG)
  const [initialSettings, setInitialSettings] = useState<InitialSettings | null>(null);

  // Model Catalog State
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [imageModels, setImageModels] = useState<ImageModelItem[]>([]);
  const [imageModelsSynced, setImageModelsSynced] = useState(false);
  const [loadingImageModels, setLoadingImageModels] = useState(true);
  const [syncingImageModels, setSyncingImageModels] = useState(false);
  const [syncingModels, setSyncingModels] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Apple HIG Dirty Check: Has user changed any settings?
  const isDirty = useMemo(() => {
    if (!initialSettings) return false;
    return (
      defaultModel !== initialSettings.defaultModel ||
      memoryModel !== initialSettings.memoryModel ||
      imageModel !== initialSettings.imageModel ||
      systemPrompt !== initialSettings.systemPrompt ||
      Math.abs(temperature - initialSettings.temperature) > 0.001 ||
      memoryEnabled !== initialSettings.memoryEnabled
    );
  }, [initialSettings, defaultModel, memoryModel, imageModel, systemPrompt, temperature, memoryEnabled]);

  const handleSyncModels = async () => {
    setSyncingModels(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        new_count: number;
        new_models: ModelCatalogItem[];
        total: number;
        message: string;
      }>("/models/sync", { method: "POST" });

      const modelsRes = await apiRequest<{ models: ModelCatalogItem[] }>("/models/configured");
      if (modelsRes?.models) setAvailableModels(modelsRes.models);

      notifyModelSyncResult({
        scope: "语言模型",
        newCount: res.new_count || 0,
        message: res.message,
      });
    } catch (err: any) {
      toast.error(err.message || "同步语言模型失败，请检查后台 .env 是否配置了有效 API 密钥");
    } finally {
      setSyncingModels(false);
    }
  };

  const handleSyncImageModels = async () => {
    setSyncingImageModels(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        new_count: number;
        total: number;
        synced_providers: string[];
        message: string;
      }>("/models/sync-images", { method: "POST" });

      const imageRes = await apiRequest<ImageModelsResponse>("/models/image-models");
      if (imageRes?.models) setImageModels(imageRes.models);
      setImageModelsSynced(imageRes?.synced ?? true);

      notifyModelSyncResult({
        scope: "绘图模型",
        newCount: res.new_count || 0,
        message: res.message,
      });
    } catch (err: any) {
      toast.error(err.message || "同步绘图模型失败，请检查后台 .env 是否配置了有效的生图服务密钥");
    } finally {
      setSyncingImageModels(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const fetchSettingsAndConfigs = async () => {
    setLoadingSettings(true);
    setLoadingImageModels(true);
    try {
      const [settingsRes, modelsRes, imageModelsRes] = await Promise.all([
        apiRequest<any>("/settings"),
        apiRequest<{ models: ModelCatalogItem[] }>("/models/configured"),
        apiRequest<ImageModelsResponse>("/models/image-models").catch(() => null),
      ]);

      if (settingsRes) {
        let dModel = settingsRes.default_model;
        if (isTrialMode) {
          if (!dModel || !modelsRes?.models?.some((m) => m.id === dModel)) {
            dModel = modelsRes?.models?.some((m) => m.id === "openrouter/free")
              ? "openrouter/free"
              : (modelsRes?.models?.[0]?.id || "openrouter/free");
          }
        } else {
          dModel = dModel || "openrouter/free";
        }
        const mModel = settingsRes.memory_model || "openai/gpt-4o-mini";
        // Mirror the chat model contract: an absent selection falls back to the
        // zero-cost default rather than staying empty.
        const freeImage =
          imageModelsRes?.models?.find((m) => m.is_free) || imageModelsRes?.models?.[0];
        let iModel = settingsRes.image_model || null;
        if (!iModel || !imageModelsRes?.models?.some((m) => m.id === iModel)) {
          iModel = freeImage?.id || iModel;
        }
        const sPrompt = settingsRes.system_prompt || "";
        const temp = settingsRes.temperature ?? 0.7;
        const memEnabled = settingsRes.memory_enabled ?? true;

        setDefaultModel(dModel);
        setMemoryModel(mModel);
        setImageModel(iModel);
        setSystemPrompt(sPrompt);
        setPersonaId(matchPersonaId(sPrompt));
        setTemperature(temp);
        setMemoryEnabled(memEnabled);

        setInitialSettings({
          defaultModel: dModel,
          memoryModel: mModel,
          imageModel: iModel,
          systemPrompt: sPrompt,
          temperature: temp,
          memoryEnabled: memEnabled,
        });
      }
      if (modelsRes?.models) setAvailableModels(modelsRes.models);
      if (imageModelsRes?.models) setImageModels(imageModelsRes.models);
      if (imageModelsRes) setImageModelsSynced(!!imageModelsRes.synced);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingSettings(false);
      setLoadingImageModels(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettingsAndConfigs();
    }
  }, [user]);

  // Apple HIG Discard / Reset Action
  const handleResetSettings = () => {
    if (!initialSettings) return;
    setDefaultModel(initialSettings.defaultModel);
    setMemoryModel(initialSettings.memoryModel);
    setImageModel(initialSettings.imageModel);
    setSystemPrompt(initialSettings.systemPrompt);
    setPersonaId(matchPersonaId(initialSettings.systemPrompt));
    setTemperature(initialSettings.temperature);
    setMemoryEnabled(initialSettings.memoryEnabled);
    toast.info("已还原至上次保存的配置");
  };

  const handleSaveSettings = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (savingSettings) return;
      setSavingSettings(true);
      setSaveSuccess(false);
      try {
        await apiRequest("/settings", {
          method: "PATCH",
          body: JSON.stringify({
            default_model: defaultModel,
            ...(user?.is_superuser ? { memory_model: memoryModel } : {}),
            image_model: imageModel,
            system_prompt: systemPrompt,
            temperature,
            memory_enabled: memoryEnabled,
          }),
        });
        try {
          localStorage.setItem("apiapia_preferred_model", defaultModel);
        } catch (e) {}

        // Update baseline
        setInitialSettings({
          defaultModel,
          memoryModel,
          imageModel,
          systemPrompt,
          temperature,
          memoryEnabled,
        });

        setSaveSuccess(true);
        toast.success("偏好设置已成功保存");
        setTimeout(() => setSaveSuccess(false), 2500);
      } catch (err: any) {
        toast.error(err.message || "保存设置失败");
      } finally {
        setSavingSettings(false);
      }
    },
    [defaultModel, memoryModel, imageModel, systemPrompt, temperature, memoryEnabled, user, savingSettings]
  );

  // Apple Mac Shortcut: Command + S / Ctrl + S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveSettings();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveSettings]);

  if (loading || !user) return <FullPageSkeleton variant="list" />;

  const memoryModelIsPreset = MEMORY_MODEL_OPTIONS.some((o) => o.id === memoryModel);

  return (
    <div className={cn("relative flex flex-col h-full overflow-hidden bg-background text-foreground w-full", !isMobileSpa && "h-dvh")}>
      {!isMobileSpa && <Navbar />}
      {/* ── Apple HIG Standard Mobile Navigation Bar ── */}
      <MobileHeader title="偏好设置" onSelectMobileTab={onSelectMobileTab} />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <main className="max-w-3xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 pb-24 md:pb-28">
          {/* ── Apple HIG Desktop System Settings Header ── */}
          <div className="hidden md:flex items-center justify-between pb-4 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                偏好设置
              </h1>
              {user.is_superuser && (
                <Badge className="text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 shadow-none">
                  管理员
                </Badge>
              )}
            </div>

            {/* Apple Header Action Controls */}
            <div className="flex items-center gap-2.5 shrink-0">
              {saveSuccess ? (
                <span className="text-[13px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium transition-all animate-in fade-in">
                  <Check className="h-4 w-4" />
                  <span>已保存</span>
                </span>
              ) : isDirty ? (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>未保存更改</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetSettings}
                    className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    <span>还原</span>
                  </Button>
                </div>
              ) : (
                <span className="text-[12px] text-muted-foreground flex items-center gap-1.5 font-normal">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>已是最新</span>
                </span>
              )}

              <ActionTooltip label="保存偏好设置（⌘S / Ctrl+S）">
                <Button
                  type="button"
                  onClick={() => handleSaveSettings()}
                  disabled={savingSettings || (!isDirty && !saveSuccess)}
                  size="sm"
                  className={cn(
                    "h-8 px-4 rounded-full text-xs font-semibold shadow-2xs gap-1.5 active:scale-95 transition-all",
                    isDirty
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground hover:bg-muted"
                  )}
                >
                  {savingSettings ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>{savingSettings ? "正在保存..." : "保存设置"}</span>
                  <kbd className="hidden sm:inline-block ml-0.5 text-[10px] opacity-70 font-sans">
                    ⌘S
                  </kbd>
                </Button>
              </ActionTooltip>
            </div>
          </div>

          {/* ── Mobile Header Sub-bar (Only shown when dirty) ── */}
          {isDirty && (
            <div className="flex md:hidden items-center justify-between gap-2 px-1 pb-1">
              <span className="text-[12px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>设置有变动</span>
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetSettings}
                  className="h-7 px-2.5 rounded-full text-xs font-medium text-muted-foreground active:scale-95"
                >
                  还原
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSaveSettings()}
                  disabled={savingSettings}
                  size="sm"
                  className="h-7 px-3.5 rounded-full text-xs font-medium gap-1.5 shadow-2xs active:scale-95 transition-all bg-primary text-primary-foreground"
                >
                  {savingSettings ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  <span>{savingSettings ? "保存中" : "保存"}</span>
                </Button>
              </div>
            </div>
          )}

          {/* ── Settings Form ── */}
          {loadingSettings ? (
            <SettingsFormSkeleton />
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-4 sm:space-y-5">
              {/* ── GROUP 1: 外观模式 (Appearance) ── */}
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1.5 select-none">
                  界面外观
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md shadow-2xs overflow-hidden p-2 sm:p-2.5">
                  {/* Apple Segmented Control - Full width 3-way toggle */}
                  <Tabs
                    value={theme}
                    onValueChange={(val) => setTheme(val as "light" | "dark" | "system")}
                    className="w-full"
                  >
                    <TabsList className="h-9 p-1 rounded-xl bg-muted/60 border border-border/40 grid grid-cols-3 w-full">
                      <TabsTrigger
                        value="system"
                        className="h-[28px] rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 text-muted-foreground"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        <span>跟随系统</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="light"
                        className="h-[28px] rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 text-muted-foreground"
                      >
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        <span>浅色</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="dark"
                        className="h-[28px] rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 text-muted-foreground"
                      >
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        <span>深色</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              {/* ── GROUP 2: 默认模型设置 (Language + Image) ── */}
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1.5 select-none flex items-center justify-between gap-2">
                  <span>默认模型设置</span>
                  <div className="flex items-center gap-2">
                    {isTrialMode && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-600 dark:text-emerald-400">
                        <Zap className="h-2.5 w-2.5" />
                        体验模式 · 仅免费
                      </span>
                    )}
                    <span className="font-mono text-[11px] font-normal text-muted-foreground">
                      {availableModels.length} 语言 · {imageModels.length} 绘图
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md shadow-2xs overflow-hidden p-3 sm:p-3.5">
                  {/* ── 语言模型 ── */}
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/25">
                      <Brain className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[12px] font-semibold text-foreground tracking-tight">
                      语言模型
                    </span>
                    <ActionTooltip label="同步可用模型列表">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSyncModels}
                        disabled={syncingModels}
                        className="ml-auto h-7 px-2.5 text-[11px] font-medium rounded-lg border-border/50 bg-muted/30 hover:bg-muted text-foreground transition-all active:scale-95 gap-1.5 shrink-0"
                      >
                        <RefreshCw className={cn("h-3 w-3", syncingModels && "animate-spin text-primary")} />
                        <span className="hidden sm:inline">
                          {syncingModels ? "同步中..." : "同步列表"}
                        </span>
                      </Button>
                    </ActionTooltip>
                  </div>

                  <div className="mt-2">
                    <ModelSelect
                      value={defaultModel}
                      onChange={(mId) => setDefaultModel(mId)}
                      models={availableModels}
                      placeholder="选择会话初始模型"
                    />
                  </div>

                  {/* ── 选好模型后的详细信息面板 ── */}
                  {(() => {
                    const currentModelItem = availableModels.find((m) => m.id === defaultModel);
                    if (!currentModelItem) {
                      return defaultModel ? (
                        <div className="pt-2.5 mt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                          <span>模型 ID: {defaultModel}</span>
                          <span className="text-[10px] text-amber-500 font-sans">未在已同步列表中</span>
                        </div>
                      ) : null;
                    }

                    const isFree = isFreeModel(currentModelItem);
                    const isMulti = isMultimodalModel(currentModelItem);

                    return (
                      <div className="pt-3 mt-3 border-t border-border/40 space-y-2.5 animate-in fade-in duration-200">
                        {/* 属性徽章行 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {currentModelItem.provider && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium uppercase bg-muted text-foreground border border-border/50">
                              <Server className="h-3 w-3 text-muted-foreground" />
                              <span>{currentModelItem.provider}</span>
                            </span>
                          )}

                          {isFree ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                              <Zap className="h-3 w-3" />
                              <span>免费模型</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                              <span>API 计费</span>
                            </span>
                          )}

                          {isMulti ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/25">
                              <Sparkles className="h-3 w-3" />
                              <span>支持图文视觉</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/40">
                              <span>文本模型</span>
                            </span>
                          )}

                          <span className="sm:ml-auto font-mono text-[11px] text-muted-foreground/70 truncate select-all">
                            ID: {currentModelItem.id}
                          </span>
                        </div>

                        {/* 模型详细介绍 */}
                        {currentModelItem.description && (
                          <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-[12px] text-muted-foreground leading-relaxed">
                            {currentModelItem.description}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── 分隔：绘图模型 ── */}
                  <div className="pt-4 mt-1">
                    <div className="flex items-center gap-2 px-0.5">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/25">
                        <Palette className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[12px] font-semibold text-foreground tracking-tight">
                        绘图模型
                      </span>
                      <ActionTooltip label="同步可用绘图模型列表">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSyncImageModels}
                          disabled={syncingImageModels}
                          className="ml-auto h-7 px-2.5 text-[11px] font-medium rounded-lg border-border/50 bg-muted/30 hover:bg-muted text-foreground transition-all active:scale-95 gap-1.5 shrink-0"
                        >
                          <RefreshCw className={cn("h-3 w-3", syncingImageModels && "animate-spin text-primary")} />
                          <span className="hidden sm:inline">
                            {syncingImageModels ? "同步中..." : "同步列表"}
                          </span>
                        </Button>
                      </ActionTooltip>
                    </div>

                    <div className="mt-2">
                      <ImageModelSelect
                        value={imageModel}
                        onChange={setImageModel}
                        models={imageModels}
                        loading={loadingImageModels}
                        synced={imageModelsSynced}
                        isTrialMode={isTrialMode}
                      />
                    </div>

                    {/* ── 选好绘图模型后的详细信息面板（对照语言模型） ── */}
                    {(() => {
                      const currentImageItem = imageModels.find((m) => m.id === imageModel);
                      if (!currentImageItem) {
                        return imageModel ? (
                          <div className="pt-2.5 mt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                            <span>模型 ID: {imageModel}</span>
                            <span className="text-[10px] text-amber-500 font-sans">未在已同步列表中</span>
                          </div>
                        ) : null;
                      }

                      return (
                        <div className="pt-3 mt-3 border-t border-border/40 space-y-2.5 animate-in fade-in duration-200">
                          {/* 属性徽章行 */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {currentImageItem.provider && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium uppercase bg-muted text-foreground border border-border/50">
                                <Server className="h-3 w-3 text-muted-foreground" />
                                <span>{currentImageItem.provider}</span>
                              </span>
                            )}

                            {currentImageItem.is_free ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                <Zap className="h-3 w-3" />
                                <span>免费模型</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                <span>API 计费</span>
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/25">
                              <Sparkles className="h-3 w-3" />
                              <span>位图生成</span>
                            </span>

                            <span className="sm:ml-auto font-mono text-[11px] text-muted-foreground/70 truncate select-all">
                              ID: {currentImageItem.id}
                            </span>
                          </div>

                          {/* 模型详细介绍 */}
                          {currentImageItem.description && (
                            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-[12px] text-muted-foreground leading-relaxed">
                              {currentImageItem.description}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* ── GROUP 3: 系统人设设定 (Persona & System Prompt) ── */}
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1.5 select-none flex items-center justify-between">
                  <span>系统人设设定</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPersonaId("custom")}
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-all active:scale-95",
                        personaId === "custom"
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                          : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      <PenLine className="h-3 w-3" />
                      <span>自定义</span>
                    </button>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {systemPrompt.length} 字
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md shadow-2xs overflow-hidden p-3.5 sm:p-4 space-y-3">
                  {/* Preset Cards Grid */}
                  <div role="radiogroup" aria-label="助手人设风格" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SYSTEM_PROMPT_PRESETS.map((preset) => {
                      const isActive = personaId === preset.id;
                      const Icon = preset.icon;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          onClick={() => {
                            setPersonaId(preset.id);
                            setSystemPrompt(preset.text);
                          }}
                          className={cn(
                            "flex flex-col text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer relative",
                            isActive
                              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30 shadow-2xs font-semibold"
                              : "border-border/60 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div
                              className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                                isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Icon className="h-3 w-3" />
                            </div>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                          <span className="font-medium text-[13px] text-foreground block">
                            {preset.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">
                            {preset.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* System Prompt Textarea */}
                  <Textarea
                    rows={3}
                    value={systemPrompt}
                    onChange={(e) => {
                      setSystemPrompt(e.target.value);
                      setPersonaId(matchPersonaId(e.target.value));
                    }}
                    placeholder={
                      personaId === "custom"
                        ? "输入自定义的人设指令、口吻偏好与准则..."
                        : "在此设定 AI 助理的角色行为准则..."
                    }
                    className="text-[13px] leading-relaxed rounded-xl border-border/60 bg-muted/30 focus:bg-background transition-all resize-y"
                  />
                </div>
              </div>

              {/* ── GROUP 4: 采样温度 (Temperature) ── */}
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1.5 select-none flex items-center justify-between">
                  <span>采样温度 (Temperature)</span>
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full border border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10">
                    {temperature.toFixed(2)}
                  </span>
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md shadow-2xs overflow-hidden p-3.5 sm:p-4 space-y-3">
                  {/* Slider */}
                  <div className="px-1 space-y-1.5">
                    <Slider
                      min={0}
                      max={2}
                      step={0.05}
                      value={[temperature]}
                      onValueChange={([val]) => setTemperature(Math.round(val * 100) / 100)}
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground font-mono px-0.5">
                      <span>0.0 严谨精确</span>
                      <span>1.0 均衡日常</span>
                      <span>2.0 发散创意</span>
                    </div>
                  </div>

                  {/* Temperature Preset Quick Selection Cards */}
                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                    {TEMPERATURE_PRESETS.map((preset) => {
                      const isActive = Math.abs(temperature - preset.value) < 0.01;
                      const Icon = preset.icon;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setTemperature(preset.value)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all cursor-pointer",
                            isActive
                              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30 shadow-2xs font-semibold"
                              : "border-border/60 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                          <span className="text-[12px]">{preset.label} ({preset.value})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── GROUP 5: 长期记忆 (Memory) ── */}
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1.5 select-none">
                  记忆系统
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md shadow-2xs overflow-hidden divide-y divide-border/40">
                  {/* Switch Row */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
                    <label htmlFor="memory-switch" className="text-[14px] font-medium text-foreground tracking-tight cursor-pointer">
                      自动提取与上下文检索
                    </label>
                    <Switch
                      id="memory-switch"
                      checked={memoryEnabled}
                      onCheckedChange={setMemoryEnabled}
                      aria-label="长期记忆开关"
                    />
                  </div>

                  {/* Superuser Memory LLM Configuration */}
                  {memoryEnabled && user.is_superuser && (
                    <div className="p-3.5 sm:p-4 space-y-2.5 bg-muted/20">
                      <div className="text-[12px] font-medium text-muted-foreground">
                        提取模型 (Memory LLM)
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <Select
                          value={memoryModelIsPreset ? memoryModel : "custom"}
                          onValueChange={(v) => {
                            if (v !== "custom") setMemoryModel(v);
                          }}
                        >
                          <SelectTrigger id="memory-model-select" className="text-xs rounded-xl border-border/60 bg-background">
                            <SelectValue placeholder="选择记忆提炼模型" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {MEMORY_MODEL_OPTIONS.map((o) => (
                              <SelectItem key={o.id} value={o.id} className="text-xs rounded-lg">
                                {o.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="custom" className="text-xs rounded-lg">
                              ✍️ 手动输入其它模型 ID...
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          type="text"
                          value={memoryModel}
                          onChange={(e) => setMemoryModel(e.target.value.trim())}
                          placeholder="例如: openai/gpt-4o-mini"
                          className="text-xs font-mono rounded-xl border-border/60 bg-background"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── GROUP 6: 关于系统与版本 (About & Version) ── */}
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1.5 select-none">
                  关于系统
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md shadow-2xs overflow-hidden divide-y divide-border/40">
                  {/* App Brand Header Row */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <BrandLogo size={36} className="shadow-2xs" />
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-foreground">
                          Apiapia
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                          v{CURRENT_VERSION}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={triggerManualUpdateCheck}
                      className="h-7 px-3 text-[12px] font-medium rounded-full border-border/50 bg-muted/30 hover:bg-muted text-foreground active:scale-95 transition-all gap-1.5 shrink-0"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>检查更新</span>
                    </Button>
                  </div>

                  {/* Specification List */}
                  <div className="divide-y divide-border/40">
                    <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">软件版本</span>
                      <span className="font-mono text-foreground font-medium">v{CURRENT_VERSION}</span>
                    </div>
                    <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">客户端架构</span>
                      <span className="text-foreground">Next.js 14 · React 18</span>
                    </div>
                    <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">记忆检索引擎</span>
                      <span className="text-foreground">PostgreSQL · pgvector</span>
                    </div>
                    <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">更新策略</span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        <span>自动在线校验</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* ── Apple HIG Floating Glass Action Bar (Visible when unsaved changes exist) ── */}
      {isDirty && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg transition-all animate-in fade-in slide-in-from-bottom-3 duration-200",
            isMobileSpa
              ? "bottom-[calc(49px+max(24px,env(safe-area-inset-bottom,34px))+12px)]"
              : "bottom-5"
          )}
        >
          <div className="p-2 sm:px-4 sm:py-2.5 rounded-full bg-card/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl border border-border/60 shadow-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 pl-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[12px] sm:text-[13px] font-medium text-foreground">
                偏好设置有未保存更改
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetSettings}
                className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                还原
              </Button>
              <Button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={savingSettings}
                size="sm"
                className="h-8 px-4 rounded-full text-xs font-semibold gap-1.5 active:scale-95 transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
              >
                {savingSettings ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>{savingSettings ? "正在保存..." : "保存设置"}</span>
                <kbd className="hidden sm:inline-block text-[10px] opacity-75 font-sans">
                  ⌘S
                </kbd>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { ModelCatalogItem } from "@/types";
import { useTheme } from "@/lib/theme";
import { ModelSelect } from "@/components/common/ModelSelect";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
} from "lucide-react";

interface InitialSettings {
  defaultModel: string;
  memoryModel: string;
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

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // User Settings State
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini");
  const [memoryModel, setMemoryModel] = useState("openai/gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [personaId, setPersonaId] = useState<string>("default");
  const [temperature, setTemperature] = useState(0.7);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  // Baseline state for dirty checking & reset (Apple HIG)
  const [initialSettings, setInitialSettings] = useState<InitialSettings | null>(null);

  // Model Catalog State
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [syncingModels, setSyncingModels] = useState(false);
  const [syncResultModal, setSyncResultModal] = useState<{
    isOpen: boolean;
    newCount: number;
    newModels: ModelCatalogItem[];
    message: string;
  } | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Apple HIG Dirty Check: Has user changed any settings?
  const isDirty = useMemo(() => {
    if (!initialSettings) return false;
    return (
      defaultModel !== initialSettings.defaultModel ||
      memoryModel !== initialSettings.memoryModel ||
      systemPrompt !== initialSettings.systemPrompt ||
      Math.abs(temperature - initialSettings.temperature) > 0.001 ||
      memoryEnabled !== initialSettings.memoryEnabled
    );
  }, [initialSettings, defaultModel, memoryModel, systemPrompt, temperature, memoryEnabled]);

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

      setSyncResultModal({
        isOpen: true,
        newCount: res.new_count || 0,
        newModels: res.new_models || [],
        message: res.message || "同步完成",
      });
    } catch (err: any) {
      toast.error(err.message || "同步模型失败，请检查后台 .env 是否配置了有效 API 密钥");
    } finally {
      setSyncingModels(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const fetchSettingsAndConfigs = async () => {
    setLoadingSettings(true);
    try {
      const [settingsRes, modelsRes] = await Promise.all([
        apiRequest<any>("/settings"),
        apiRequest<{ models: ModelCatalogItem[] }>("/models/configured"),
      ]);

      if (settingsRes) {
        const dModel = settingsRes.default_model || "gpt-4o-mini";
        const mModel = settingsRes.memory_model || "openai/gpt-4o-mini";
        const sPrompt = settingsRes.system_prompt || "";
        const temp = settingsRes.temperature ?? 0.7;
        const memEnabled = settingsRes.memory_enabled ?? true;

        setDefaultModel(dModel);
        setMemoryModel(mModel);
        setSystemPrompt(sPrompt);
        setPersonaId(matchPersonaId(sPrompt));
        setTemperature(temp);
        setMemoryEnabled(memEnabled);

        setInitialSettings({
          defaultModel: dModel,
          memoryModel: mModel,
          systemPrompt: sPrompt,
          temperature: temp,
          memoryEnabled: memEnabled,
        });
      }
      if (modelsRes?.models) setAvailableModels(modelsRes.models);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingSettings(false);
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
    [defaultModel, memoryModel, systemPrompt, temperature, memoryEnabled, user, savingSettings]
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
    <div className="flex flex-col h-dvh overflow-hidden bg-[#F2F2F7] dark:bg-[#000000] text-foreground">
      <Navbar />
      {/* ── Apple HIG Standard Mobile Navigation Bar ── */}
      <MobileHeader title="偏好设置" />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <main className="max-w-3xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-7 pb-32 md:pb-24">
          {/* ── Apple macOS System Settings Header ── */}
          <div className="hidden md:flex items-center justify-between pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF] tracking-tight flex items-center gap-1.5 uppercase">
                  <span>系统偏好</span>
                </span>
                {user.is_superuser && (
                  <Badge className="text-[11px] font-medium bg-[#FF9500]/10 text-[#FF9500] dark:text-[#FF9F0A] border border-[#FF9500]/25 rounded-full px-2 py-0 shadow-none">
                    管理员
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground">
                偏好设置
              </h1>
              <p className="text-[13px] text-[#6E6E73] dark:text-[#98989D] leading-normal">
                管理外观显示、主力大模型、助理人设、创意度与长期记忆引擎。
              </p>
            </div>

            {/* Apple Header Action Controls */}
            <div className="flex items-center gap-2.5 shrink-0">
              {saveSuccess ? (
                <span className="text-[13px] text-[#34C759] dark:text-[#30D158] flex items-center gap-1.5 font-medium transition-all animate-in fade-in">
                  <Check className="h-4 w-4" />
                  <span>已保存</span>
                </span>
              ) : isDirty ? (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#FF9500] dark:text-[#FF9F0A] flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] animate-pulse" />
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
                <span className="text-[12px] text-[#8E8E93] flex items-center gap-1.5 font-normal">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759]" />
                  <span>已是最新</span>
                </span>
              )}

              <ActionTooltip label="保存偏好设置 (快捷键 ⌘S / Ctrl+S)">
                <Button
                  type="button"
                  onClick={() => handleSaveSettings()}
                  disabled={savingSettings || (!isDirty && !saveSuccess)}
                  size="sm"
                  className={cn(
                    "h-8 px-4 rounded-full text-xs font-semibold shadow-xs gap-1.5 active:scale-95 transition-all",
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

          {/* ── Mobile Header Sub-bar ── */}
          <div className="flex md:hidden items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              {isDirty ? (
                <span className="text-[12px] text-[#FF9500] dark:text-[#FF9F0A] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] animate-pulse" />
                  <span>设置有变动</span>
                </span>
              ) : (
                <span className="text-[12px] text-muted-foreground">外观与模型偏好</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetSettings}
                  className="h-7 px-2.5 rounded-full text-xs font-medium text-muted-foreground active:scale-95"
                >
                  还原
                </Button>
              )}
              <Button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={savingSettings || !isDirty}
                size="sm"
                className={cn(
                  "h-7 px-3.5 rounded-full text-xs font-medium gap-1.5 shadow-xs active:scale-95 transition-all",
                  isDirty
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
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

          {/* ── Settings Form ── */}
          {loadingSettings ? (
            <SettingsFormSkeleton />
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-6 sm:space-y-7">
              {/* ── GROUP 1: 外观与显示 (Appearance) ── */}
              <div>
                <div className="text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D] uppercase tracking-[0.04em] px-4 pb-1.5 select-none flex items-center gap-1.5">
                  <span>外观与显示</span>
                </div>

                <div className="rounded-[16px] sm:rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-[7px] bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                        <Palette className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[14px] sm:text-[15px] font-medium text-foreground tracking-[-0.01em]">
                          界面外观模式
                        </div>
                        <p className="text-[12px] text-[#8E8E93] dark:text-[#98989D] leading-normal mt-0.5">
                          选择浅色、深色，或根据当前操作系统偏好自动无缝切换。
                        </p>
                      </div>
                    </div>

                    {/* Apple Segmented Control */}
                    <Tabs
                      value={theme}
                      onValueChange={(val) => setTheme(val as "light" | "dark" | "system")}
                      className="shrink-0 self-start sm:self-center"
                    >
                      <TabsList className="h-8 p-[2px] rounded-[9px] bg-[#767680]/12 dark:bg-[#767680]/24 border border-black/[0.04] dark:border-white/[0.04] gap-0.5 inline-flex">
                        <TabsTrigger
                          value="system"
                          className="h-[28px] px-3 rounded-[7px] text-[13px] font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-[#636366] data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2.5px_rgba(0,0,0,0.12),0_0_1px_rgba(0,0,0,0.08)] transition-all gap-1.5 text-muted-foreground"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                          <span>跟随系统</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="light"
                          className="h-[28px] px-3 rounded-[7px] text-[13px] font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-[#636366] data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2.5px_rgba(0,0,0,0.12),0_0_1px_rgba(0,0,0,0.08)] transition-all gap-1.5 text-muted-foreground"
                        >
                          <Sun className="h-3.5 w-3.5 text-amber-500" />
                          <span>浅色</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="dark"
                          className="h-[28px] px-3 rounded-[7px] text-[13px] font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-[#636366] data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2.5px_rgba(0,0,0,0.12),0_0_1px_rgba(0,0,0,0.08)] transition-all gap-1.5 text-muted-foreground"
                        >
                          <Moon className="h-3.5 w-3.5 text-indigo-400" />
                          <span>深色</span>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </div>

              {/* ── GROUP 2: 默认对话模型 (Default Model) ── */}
              <div>
                <div className="text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D] uppercase tracking-[0.04em] px-4 pb-1.5 select-none flex items-center gap-1.5">
                  <span>默认大语言模型</span>
                </div>

                <div className="rounded-[16px] sm:rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <div className="p-4 sm:p-5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-[7px] bg-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                          <Cpu className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] sm:text-[15px] font-medium text-foreground tracking-[-0.01em]">
                              默认主力模型
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#767680]/10 text-muted-foreground font-medium">
                              {availableModels.length} 个可用
                            </span>
                          </div>
                          <p className="text-[12px] text-[#8E8E93] dark:text-[#98989D] leading-normal mt-0.5">
                            新创建会话时的初始模型，进入聊天界面后仍可按需自由切换。
                          </p>
                        </div>
                      </div>

                      <ActionTooltip label="向后台已配置 API 提供商同步最新可用模型列表">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSyncModels}
                          disabled={syncingModels}
                          className="h-7 px-3 text-[12px] font-medium rounded-full bg-[#767680]/10 hover:bg-[#767680]/20 text-foreground transition-all active:scale-95 gap-1.5 shrink-0 self-start sm:self-auto"
                        >
                          <RefreshCw className={cn("h-3 w-3", syncingModels && "animate-spin text-primary")} />
                          <span>{syncingModels ? "正在同步..." : "同步最新模型"}</span>
                        </Button>
                      </ActionTooltip>
                    </div>

                    <div className="pt-1">
                      <ModelSelect
                        value={defaultModel}
                        onChange={(mId) => setDefaultModel(mId)}
                        models={availableModels}
                        placeholder="请选择默认大模型"
                      />
                    </div>
                  </div>
                </div>

                <div className="text-[12px] text-[#8E8E93] dark:text-[#8E8E93] px-4 pt-1.5 leading-relaxed">
                  提示：支持 Gemini、OpenAI、DeepSeek、Claude 以及本地 Ollama。点击同步可自动拉取最新接入的模型。
                </div>
              </div>

              {/* ── GROUP 3: 助理人设与准则 (Persona) ── */}
              <div>
                <div className="text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D] uppercase tracking-[0.04em] px-4 pb-1.5 select-none flex items-center gap-1.5">
                  <span>助理人设与准则</span>
                </div>

                <div className="rounded-[16px] sm:rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-[7px] bg-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[14px] sm:text-[15px] font-medium text-foreground tracking-[-0.01em]">
                        系统预设人设风格
                      </div>
                      <p className="text-[12px] text-[#8E8E93] dark:text-[#98989D] leading-normal mt-0.5">
                        选取预置的专业人设模板，或在下方文本区域自由编辑你的专属助理设定。
                      </p>
                    </div>
                  </div>

                  {/* Apple Preset Cards Grid */}
                  <div role="radiogroup" aria-label="助手人设风格" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                            "flex flex-col text-left p-3 rounded-xl border text-xs transition-all cursor-pointer relative",
                            isActive
                              ? "border-primary bg-primary/[0.08] dark:bg-primary/[0.14] text-foreground ring-1 ring-primary/40 shadow-xs"
                              : "border-black/[0.06] dark:border-white/[0.08] bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/40 hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]/70 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div
                              className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                                isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                          <span className="font-semibold text-[13px] text-foreground block">
                            {preset.label}
                          </span>
                          <span className="text-[11px] text-[#8E8E93] dark:text-[#98989D] mt-0.5 leading-snug line-clamp-1">
                            {preset.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Persona Toggle Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setPersonaId("custom")}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1 rounded-full border transition-all active:scale-95",
                        personaId === "custom"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-black/[0.08] dark:border-white/[0.08] bg-[#767680]/10 text-muted-foreground hover:text-foreground hover:bg-[#767680]/20"
                      )}
                    >
                      <PenLine className="h-3 w-3" />
                      <span>自由编写提示词</span>
                    </button>

                    <span className="text-[11px] font-mono text-[#8E8E93]">
                      {systemPrompt.length} 字
                    </span>
                  </div>

                  {/* System Prompt Textarea */}
                  <div className="space-y-1.5">
                    <Textarea
                      rows={4}
                      value={systemPrompt}
                      onChange={(e) => {
                        setSystemPrompt(e.target.value);
                        setPersonaId(matchPersonaId(e.target.value));
                      }}
                      placeholder={
                        personaId === "custom"
                          ? "写下你想要的人设，例如：你是一个毒舌但严谨的资深架构师，先给精准结论再展开技术细节，拒绝寒暄……"
                          : "在此设定 AI 助理的口吻与角色行为准则..."
                      }
                      className="text-[13px] leading-relaxed rounded-xl border-black/[0.08] dark:border-white/[0.08] bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/40 focus:bg-background transition-all resize-y"
                    />
                  </div>
                </div>

                <div className="text-[12px] text-[#8E8E93] dark:text-[#8E8E93] px-4 pt-1.5 leading-relaxed">
                  提示：选择上方卡片将自动填入推荐文案；在文本框中直接编辑将无缝切换为「自定义」模式。
                </div>
              </div>

              {/* ── GROUP 4: 回答风格与创意度 (Temperature) ── */}
              <div>
                <div className="text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D] uppercase tracking-[0.04em] px-4 pb-1.5 select-none flex items-center gap-1.5">
                  <span>回答风格与创意度</span>
                </div>

                <div className="rounded-[16px] sm:rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-[7px] bg-[#FF2D55] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                        <Sliders className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[14px] sm:text-[15px] font-medium text-foreground tracking-[-0.01em]">
                          创意度采样温度 (Temperature)
                        </div>
                        <p className="text-[12px] text-[#8E8E93] dark:text-[#98989D] leading-normal mt-0.5">
                          较低温度使回答收敛精确、符合事实；较高温度使语言发散、充满创意灵感。
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full border-[#FF2D55]/30 text-[#FF2D55] dark:text-[#FF375F] bg-[#FF2D55]/8 shrink-0"
                    >
                      {temperature.toFixed(2)}
                    </Badge>
                  </div>

                  {/* Apple Native Slider */}
                  <div className="pt-2 px-1 space-y-2">
                    <Slider
                      min={0}
                      max={2}
                      step={0.05}
                      value={[temperature]}
                      onValueChange={([val]) => setTemperature(Math.round(val * 100) / 100)}
                    />
                    <div className="flex justify-between text-[11px] text-[#8E8E93] font-mono px-0.5">
                      <span>0.0 (最确定 / 代码级)</span>
                      <span>1.0 (均衡通用)</span>
                      <span>2.0 (极度发散)</span>
                    </div>
                  </div>

                  {/* Temperature Preset Quick Selection Cards */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {TEMPERATURE_PRESETS.map((preset) => {
                      const isActive = Math.abs(temperature - preset.value) < 0.01;
                      const Icon = preset.icon;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setTemperature(preset.value)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all cursor-pointer",
                            isActive
                              ? "border-primary bg-primary/[0.08] dark:bg-primary/[0.14] text-foreground ring-1 ring-primary/40 shadow-xs font-semibold"
                              : "border-black/[0.06] dark:border-white/[0.08] bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/40 hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]/70 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                          <span className="text-[13px]">{preset.label} ({preset.value})</span>
                          <span className="text-[10px] font-normal opacity-70 text-center leading-snug line-clamp-1">
                            {preset.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="text-[12px] text-[#8E8E93] dark:text-[#8E8E93] px-4 pt-1.5 leading-relaxed">
                  建议：编写代码或进行专业学术分析建议设为 0.2；日常问答推荐 0.7；头脑风暴与文案生成建议 1.0 以上。
                </div>
              </div>

              {/* ── GROUP 5: 长期记忆引擎 (Long-Term Memory) ── */}
              <div>
                <div className="text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D] uppercase tracking-[0.04em] px-4 pb-1.5 select-none flex items-center gap-1.5">
                  <span>长期记忆引擎</span>
                </div>

                <div className="rounded-[16px] sm:rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                  {/* Switch Row */}
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-[7px] bg-[#34C759] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                        <Brain className="h-4 w-4" />
                      </div>
                      <div>
                        <label htmlFor="memory-switch" className="text-[14px] sm:text-[15px] font-medium text-foreground tracking-[-0.01em] cursor-pointer block">
                          自动提炼与长期记忆召回
                        </label>
                        <p className="text-[12px] text-[#8E8E93] dark:text-[#98989D] leading-normal mt-0.5">
                          在对话中自动沉淀你的偏好与重要事实，利用 pgvector 向量数据库实现智能语义召回。
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="memory-switch"
                      checked={memoryEnabled}
                      onCheckedChange={setMemoryEnabled}
                      aria-label="长期记忆开关"
                    />
                  </div>

                  {/* Superuser Memory LLM Configuration */}
                  {memoryEnabled && user.is_superuser && (
                    <div className="p-4 sm:p-5 space-y-3 bg-[#F2F2F7]/30 dark:bg-[#2C2C2E]/20">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                        <span className="text-[13px] font-medium text-foreground">
                          记忆提炼专有模型 (Memory LLM)
                        </span>
                        <span className="text-[11px] text-[#8E8E93] font-mono">
                          后台异步蒸馏与记忆管理
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <Select
                          value={memoryModelIsPreset ? memoryModel : "custom"}
                          onValueChange={(v) => {
                            if (v !== "custom") setMemoryModel(v);
                          }}
                        >
                          <SelectTrigger id="memory-model-select" className="text-xs rounded-xl border-black/[0.08] dark:border-white/[0.08] bg-background">
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
                          className="text-xs font-mono rounded-xl border-black/[0.08] dark:border-white/[0.08] bg-background"
                        />
                      </div>

                      <div className="p-3 rounded-xl border border-black/[0.05] dark:border-white/[0.06] bg-background text-[11px] text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                        💡 <strong>跨厂商提炼提示：</strong>若你配置了 OpenRouter 密钥，填入支持的任意模型 ID（如 <code>openai/gpt-4o-mini</code> 或 <code>deepseek/deepseek-chat</code>）即可全自动异步处理，无需单独绑定 OpenAI 官方 Key。
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-[12px] text-[#8E8E93] dark:text-[#8E8E93] px-4 pt-1.5 leading-relaxed">
                  记忆提取在后台全异步流转，不占用用户前端等待时间；关闭此功能将暂停新记忆的提炼与插入。
                </div>
              </div>

              {/* ── GROUP 6: 关于系统与版本 (About & Version) ── */}
              <div>
                <div className="text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D] uppercase tracking-[0.04em] px-4 pb-1.5 select-none flex items-center gap-1.5">
                  <span>关于与系统版本</span>
                </div>

                <div className="rounded-[16px] sm:rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                  {/* App Brand Header Row */}
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[10px] bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
                        <Cat className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold text-foreground flex items-center gap-1.5">
                          <span>Apiapia 智能助手</span>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#34C759]/10 text-[#34C759] font-medium border border-[#34C759]/20">
                            v{CURRENT_VERSION}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#8E8E93] dark:text-[#98989D] mt-0.5">
                          个人私有化全功能 AI 助理系统
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={triggerManualUpdateCheck}
                      className="h-7 px-3 text-[12px] font-medium rounded-full bg-[#767680]/10 hover:bg-[#767680]/20 text-foreground active:scale-95 transition-all gap-1.5 shrink-0"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>检查更新</span>
                    </Button>
                  </div>

                  {/* Apple Inset Specification List */}
                  <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    <div className="px-4 py-3 sm:px-5 flex items-center justify-between text-[13px]">
                      <span className="text-[#8E8E93]">软件版本</span>
                      <span className="font-mono text-foreground font-medium">v{CURRENT_VERSION}</span>
                    </div>
                    <div className="px-4 py-3 sm:px-5 flex items-center justify-between text-[13px]">
                      <span className="text-[#8E8E93]">客户端架构</span>
                      <span className="text-foreground">Next.js 14 · React 18</span>
                    </div>
                    <div className="px-4 py-3 sm:px-5 flex items-center justify-between text-[13px]">
                      <span className="text-[#8E8E93]">记忆检索引擎</span>
                      <span className="text-foreground">PostgreSQL · pgvector</span>
                    </div>
                    <div className="px-4 py-3 sm:px-5 flex items-center justify-between text-[13px]">
                      <span className="text-[#8E8E93]">更新策略</span>
                      <span className="text-[#34C759] dark:text-[#30D158] flex items-center gap-1.5 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] inline-block" />
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
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg transition-all animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="p-2 sm:px-4 sm:py-2.5 rounded-full bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 pl-2">
              <span className="w-2 h-2 rounded-full bg-[#FF9500] animate-pulse" />
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
                className="h-8 px-4 rounded-full text-xs font-semibold gap-1.5 active:scale-95 transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
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

      {/* ── Model Sync Result Dialog (Apple HIG Sheet Style) ── */}
      <Dialog
        open={!!syncResultModal?.isOpen}
        onOpenChange={(open) => {
          if (!open) setSyncResultModal(null);
        }}
      >
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-[22px] border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl shadow-2xl">
          <DialogHeader className="p-6 border-b border-black/[0.06] dark:border-white/[0.08] bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/30">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 shadow-xs",
                  (syncResultModal?.newCount ?? 0) > 0
                    ? "bg-[#FF9500] text-white"
                    : "bg-[#34C759] text-white"
                )}
              >
                {(syncResultModal?.newCount ?? 0) > 0 ? (
                  <Sparkles className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-[17px] font-semibold tracking-tight">
                  {(syncResultModal?.newCount ?? 0) > 0
                    ? `发现 ${syncResultModal?.newCount} 个新模型`
                    : "模型库已是最新"}
                </DialogTitle>
                <DialogDescription className="text-[12px] text-[#8E8E93] mt-0.5">
                  {syncResultModal?.message}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-3">
            {(syncResultModal?.newCount ?? 0) > 0 ? (
              <div className="space-y-2">
                <p className="text-[13px] font-medium text-foreground">
                  新检测到的模型列表：
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                  {(syncResultModal?.newModels ?? []).map((m) => (
                    <div key={m.id} className="pt-2 first:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-foreground">
                          {m.name}
                        </span>
                        <Badge variant="secondary" className="uppercase text-[10px] rounded-full px-2 py-0">
                          {m.provider}
                        </Badge>
                      </div>
                      <p className="text-[11px] font-mono text-[#8E8E93] mt-0.5">
                        {m.id}
                      </p>
                      {m.description && (
                        <p className="text-[11px] text-[#8E8E93] mt-0.5">
                          {m.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/40 text-[12px] text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                系统已向后台配置的所有 API 提供商（Gemini / OpenAI / OpenRouter / Ollama）发起即时校验，现有模型库已包含所有支持的模型，未检测到新增模型。
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#F2F2F7]/30 dark:bg-[#2C2C2E]/20">
            <Button
              type="button"
              onClick={() => setSyncResultModal(null)}
              className="rounded-full px-5 text-xs font-semibold h-8 bg-primary text-primary-foreground"
            >
              我知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

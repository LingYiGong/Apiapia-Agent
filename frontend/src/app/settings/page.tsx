"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { ModelCatalogItem } from "@/types";
import { useTheme } from "@/lib/theme";
import { ModelSelect } from "@/components/common/ModelSelect";
import { CURRENT_VERSION, triggerManualUpdateCheck } from "@/lib/version";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Settings, Save, ShieldCheck, Sparkles, Sun, Moon, Monitor, RefreshCw, Info, CheckCircle2, Zap, BookOpen, Lightbulb, PenLine, Target, Scale, Palette } from "lucide-react";

const TEMPERATURE_PRESETS = [
  {
    id: "precise",
    label: "严谨精确",
    desc: "稳定可复现，适合事实与代码",
    value: 0.2,
    icon: Target,
  },
  {
    id: "balanced",
    label: "平衡",
    desc: "日常聊天推荐",
    value: 0.7,
    icon: Scale,
  },
  {
    id: "creative",
    label: "发散创意",
    desc: "写故事起名要灵感时用",
    value: 1.0,
    icon: Palette,
  },
] as const;

const SYSTEM_PROMPT_PRESETS = [
  {
    id: "default",
    label: "默认助手",
    desc: "通用推荐",
    icon: Sparkles,
    text: "你是一个智能、真诚、有洞察力的个人智能助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。",
  },
  {
    id: "concise",
    label: "简洁直接",
    desc: "直击要点不啰嗦",
    icon: Zap,
    text: "你是一个高效直接的个人智能助理。回答简洁、直击要点，避免寒暄和冗余解释，善用列表呈现；除非用户要求，不输出长篇大论。",
  },
  {
    id: "rigorous",
    label: "严谨学术",
    desc: "有依据分步骤",
    icon: BookOpen,
    text: "你是一个严谨细致的个人智能助理。回答准确、有依据，不确定的内容明确说明；涉及事实时优先引用检索到的来源；逻辑清晰、分步骤表达。",
  },
  {
    id: "creative",
    label: "创意灵感",
    desc: "多灵感不死板",
    icon: Lightbulb,
    text: "你是一个富有想象力的个人智能助理。乐于发散、多给灵感与可能性，表达生动；涉及客观事实时仍以检索资料为准，不虚构。",
  },
  { id: "custom", label: "自定义", desc: "自己写人设", icon: PenLine, text: "" },
] as const;

const MEMORY_MODEL_OPTIONS = [
  { id: "openai/gpt-4o-mini", label: "openai/gpt-4o-mini (推荐：高性价比、提取稳定)" },
  { id: "deepseek/deepseek-chat", label: "deepseek/deepseek-chat (DeepSeek V3 便宜且智能)" },
  { id: "anthropic/claude-3-5-haiku", label: "anthropic/claude-3-5-haiku (Claude 快速响应)" },
  { id: "google/gemini-2.5-flash", label: "google/gemini-2.5-flash (Gemini 2.5 Flash 超快)" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini (OpenAI 原生直连)" },
] as const;

function matchPersonaId(text: string): string {
  const found = SYSTEM_PROMPT_PRESETS.find((p) => p.id !== "custom" && p.text === text);
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
        setDefaultModel(settingsRes.default_model || "gpt-4o-mini");
        setMemoryModel(settingsRes.memory_model || "openai/gpt-4o-mini");
        setSystemPrompt(settingsRes.system_prompt || "");
        setPersonaId(matchPersonaId(settingsRes.system_prompt || ""));
        setTemperature(settingsRes.temperature ?? 0.7);
        setMemoryEnabled(settingsRes.memory_enabled ?? true);
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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      await apiRequest("/settings", {
        method: "PATCH",
        body: JSON.stringify({
          default_model: defaultModel,
          // Memory LLM is admin-only: ordinary users don't submit it
          ...(user?.is_superuser ? { memory_model: memoryModel } : {}),
          system_prompt: systemPrompt,
          temperature,
          memory_enabled: memoryEnabled,
        }),
      });
      try {
        localStorage.setItem("apiapia_preferred_model", defaultModel);
      } catch (e) {}
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err.message || "保存设置失败");
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading || !user) return <FullPageSkeleton variant="list" />;

  const memoryModelIsPreset = MEMORY_MODEL_OPTIONS.some((o) => o.id === memoryModel);

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      <Navbar />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 pb-24 md:pb-8">
        <div className="flex items-center justify-between pb-6 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold mb-1 text-[13px] tracking-tight">
              <Settings className="h-4 w-4" />
              <span>系统设置</span>
            </div>
            <h1 className="text-[28px] sm:text-3xl font-bold tracking-tight text-foreground">偏好设置</h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
              管理界面外观、默认模型、助手人设、回答风格与长期记忆开关。
            </p>
          </div>
        </div>

        {/* General Settings Form */}
        {loadingSettings ? (
          <SettingsFormSkeleton />
        ) : (
          <>
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider">通用</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Appearance Setting */}
              <div className="space-y-3 pb-5 border-b">
                <div>
                  <Label className="text-xs">
                    界面外观与主题 (Theme Appearance)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    支持白天模式、夜间模式或跟随操作系统自动切换。
                  </p>
                </div>

                <Tabs
                  value={theme}
                  onValueChange={(val) => setTheme(val as "light" | "dark" | "system")}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-3 h-14 p-1 bg-muted/60">
                    <TabsTrigger value="system" className="flex items-center justify-center gap-2 h-12 text-xs">
                      <Monitor className="h-4 w-4" />
                      <span>💻 跟随系统</span>
                    </TabsTrigger>
                    <TabsTrigger value="light" className="flex items-center justify-center gap-2 h-12 text-xs">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span>☀️ 浅色 (白天)</span>
                    </TabsTrigger>
                    <TabsTrigger value="dark" className="flex items-center justify-center gap-2 h-12 text-xs">
                      <Moon className="h-4 w-4" />
                      <span>🌙 深色 (夜间)</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Default Model */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs">
                      默认大模型 (Default Model)
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      新对话启动时默认使用的大模型（当前共有 {availableModels.length} 个可用模型）。
                    </p>
                  </div>
                  <ActionTooltip label="向提供商 API (Gemini/OpenAI/OpenRouter/Ollama) 请求最新模型">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSyncModels}
                      disabled={syncingModels}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", syncingModels && "animate-spin")} />
                      <span>{syncingModels ? "正在请求提供商..." : "同步最新模型"}</span>
                    </Button>
                  </ActionTooltip>
                </div>
                <ModelSelect
                  value={defaultModel}
                  onChange={(mId) => setDefaultModel(mId)}
                  models={availableModels}
                  placeholder="请选择默认大模型"
                />
              </div>

              {/* System Prompt: preset persona cards + editable text */}
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">
                    助手人设 (Persona)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    选一种回答风格，需要完全自己写时点自定义再往下写。
                  </p>
                </div>
                <div role="radiogroup" aria-label="助手人设风格" className="grid grid-cols-4 gap-2">
                  {SYSTEM_PROMPT_PRESETS.filter((p) => p.id !== "custom").map((preset) => {
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
                          "flex flex-col items-center justify-center gap-1 p-2 sm:p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                          isActive
                            ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary"
                            : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-semibold text-[11px] sm:text-xs">{preset.label}</span>
                        <span className="hidden sm:block text-[10px] font-normal opacity-70 text-center leading-snug">
                          {preset.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant={personaId === "custom" ? "default" : "outline"}
                  onClick={() => {
                    setPersonaId("custom");
                    setSystemPrompt("");
                  }}
                  className={cn(
                    "w-full border-dashed",
                    personaId !== "custom" && "text-muted-foreground"
                  )}
                >
                  <PenLine className="h-4 w-4 shrink-0" />
                  <span className="font-semibold">自定义人设</span>
                  <span className="text-[11px] font-normal opacity-70">
                    不套模板，在下方文本框自由编写
                  </span>
                </Button>
                <Textarea
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                    setPersonaId(matchPersonaId(e.target.value));
                  }}
                  placeholder={
                    personaId === "custom"
                      ? "写下你想要的人设，例如：你是一个毒舌但靠谱的编程搭子——先给结论再给代码，拒绝寒暄；不确定的事直说不知道……"
                      : "设定 AI 助理的口吻与角色准则..."
                  }
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  上面是所选人设的完整文本，可直接微调；一改动即变为自定义。
                </p>
              </div>

              {/* Temperature presets & Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">
                      回答风格 (创意度 Temperature)
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      严谨适合查事实写代码，发散适合起名写故事，日常用平衡。
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 border-primary/30 text-primary">
                    {temperature.toFixed(2)}
                  </Badge>
                </div>

                {/* Slider */}
                <div className="pt-2 px-1">
                  <Slider
                    min={0}
                    max={2}
                    step={0.05}
                    value={[temperature]}
                    onValueChange={([val]) => setTemperature(Math.round(val * 100) / 100)}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1.5 px-0.5">
                    <span>0.0 (最确定/严谨)</span>
                    <span>1.0 (标准发散)</span>
                    <span>2.0 (极度发散)</span>
                  </div>
                </div>

                {/* Quick Presets */}
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
                          "flex flex-col items-center gap-1 p-2 sm:p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                          isActive
                            ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary"
                            : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-semibold text-xs">{preset.label} ({preset.value})</span>
                        <span className="text-[10px] font-normal opacity-70 text-center leading-snug">
                          {preset.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Memory Toggle */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-xs font-semibold">启用长期记忆提取与检索</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    开启后对话将自动提取重要事实存入 pgvector，并作为不可信背景注入后续对话。
                  </p>
                </div>
                <Switch
                  checked={memoryEnabled}
                  onCheckedChange={setMemoryEnabled}
                  aria-label="长期记忆开关"
                />
              </div>

              {/* Memory Extraction Model (admin only) */}
              {memoryEnabled && user?.is_superuser && (
                <div className="pt-3 border-t space-y-2">
                  <div className="flex justify-between items-center gap-2">
                    <Label htmlFor="memory-model-select" className="text-xs">
                      长期记忆提炼模型 (Memory LLM)
                    </Label>
                    <Badge variant="secondary" className="text-[11px]">
                      后台自动总结与事实提炼
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <Select
                      value={memoryModelIsPreset ? memoryModel : "custom"}
                      onValueChange={(v) => {
                        if (v !== "custom") setMemoryModel(v);
                      }}
                    >
                      <SelectTrigger id="memory-model-select" className="text-xs">
                        <SelectValue placeholder="选择记忆提炼模型" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMORY_MODEL_OPTIONS.map((o) => (
                          <SelectItem key={o.id} value={o.id} className="text-xs">
                            {o.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-xs">
                          ✍️ 手动输入其它模型 ID...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      value={memoryModel}
                      onChange={(e) => setMemoryModel(e.target.value.trim())}
                      placeholder="例如: openai/gpt-4o-mini 或 deepseek/deepseek-chat"
                      className="text-xs font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    💡 <strong>提示：</strong>若你配置了 OpenRouter Key，填入支持的任意模型标识符（如 <code>openai/gpt-4o-mini</code> 或 <code>deepseek/deepseek-chat</code>）即可全自动调用，无需单独绑定 OpenAI 官方 Key。
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                {saveSuccess && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    配置已保存
                  </span>
                )}
                <Button
                  type="submit"
                  disabled={savingSettings}
                >
                  <Save className="h-4 w-4" />
                  <span>{savingSettings ? "正在保存..." : "保存全局设置"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* System Version & Update Check Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm uppercase tracking-wider">系统版本与更新</CardTitle>
                  <CardDescription className="mt-0.5">
                    每次进入应用自动校验最新版本，确保获取最新模型支持与功能特性。
                  </CardDescription>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={triggerManualUpdateCheck}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>检查更新</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border bg-muted/40">
                <span className="text-[11px] text-muted-foreground block mb-0.5">当前软件版本</span>
                <span className="text-sm font-bold font-mono">v{CURRENT_VERSION}</span>
              </div>
              <div className="p-3.5 rounded-xl border bg-muted/40">
                <span className="text-[11px] text-muted-foreground block mb-0.5">客户端架构</span>
                <span className="text-sm font-semibold">Next.js 14 Web App</span>
              </div>
              <div className="p-3.5 rounded-xl border bg-muted/40">
                <span className="text-[11px] text-muted-foreground block mb-0.5">更新检测策略</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> 每次进入自动检查
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </main>
      </div>

      {/* Model Sync Result Dialog */}
      <Dialog open={!!syncResultModal?.isOpen} onOpenChange={(open) => { if (!open) setSyncResultModal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                (syncResultModal?.newCount ?? 0) > 0
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
              )}>
                {(syncResultModal?.newCount ?? 0) > 0 ? (
                  <Sparkles className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base">
                  {(syncResultModal?.newCount ?? 0) > 0
                    ? `🎉 发现 ${syncResultModal?.newCount} 个新模型！`
                    : "模型库已是最新"}
                </DialogTitle>
                <DialogDescription className="mt-0.5">
                  {syncResultModal?.message}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {(syncResultModal?.newCount ?? 0) > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold">
                新检测到的模型列表：
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-border">
                {(syncResultModal?.newModels ?? []).map((m) => (
                  <div key={m.id} className="pt-2 first:pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {m.name}
                      </span>
                      <Badge variant="secondary" className="uppercase text-[10px]">
                        {m.provider}
                      </Badge>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      {m.id}
                    </p>
                    {m.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {m.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs text-muted-foreground leading-relaxed bg-muted rounded-xl p-3 border">
              系统已向后台配置的所有 API 提供商（Gemini / OpenAI / OpenRouter / Ollama）发起即时校验，现有模型库已包含所有支持的模型，未检测到新增模型。
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setSyncResultModal(null)}
            >
              我知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

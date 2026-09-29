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
import { Settings, Save, ShieldCheck, Sparkles, Sun, Moon, Monitor, RefreshCw, Info, CheckCircle2, X, Zap, BookOpen, Lightbulb, PenLine, Target, Scale, Palette } from "lucide-react";

const TEMPERATURE_PRESETS = [
  {
    id: "precise",
    label: "严谨精确",
    desc: "稳定可复现，适合事实与代码",
    value: 0.2,
    icon: Target,
    iconColor: "text-sky-500",
    activeClass:
      "border-sky-600 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 shadow-sm ring-1 ring-sky-600",
  },
  {
    id: "balanced",
    label: "平衡",
    desc: "日常聊天推荐",
    value: 0.7,
    icon: Scale,
    iconColor: "text-indigo-500",
    activeClass:
      "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600",
  },
  {
    id: "creative",
    label: "发散创意",
    desc: "写故事起名要灵感时用",
    value: 1.0,
    icon: Palette,
    iconColor: "text-violet-500",
    activeClass:
      "border-violet-600 bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 shadow-sm ring-1 ring-violet-600",
  },
] as const;

const SYSTEM_PROMPT_PRESETS = [
  {
    id: "default",
    label: "默认助手",
    desc: "通用推荐",
    icon: Sparkles,
    iconColor: "text-indigo-500",
    activeClass:
      "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600",
    text: "你是一个智能、真诚、有洞察力的私人 AI 助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。",
  },
  {
    id: "concise",
    label: "简洁直接",
    desc: "直击要点不啰嗦",
    icon: Zap,
    iconColor: "text-sky-500",
    activeClass:
      "border-sky-600 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 shadow-sm ring-1 ring-sky-600",
    text: "你是一个高效直接的私人 AI 助理。回答简洁、直击要点，避免寒暄和冗余解释，善用列表呈现；除非用户要求，不输出长篇大论。",
  },
  {
    id: "rigorous",
    label: "严谨学术",
    desc: "有依据分步骤",
    icon: BookOpen,
    iconColor: "text-emerald-500",
    activeClass:
      "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-600",
    text: "你是一个严谨细致的私人 AI 助理。回答准确、有依据，不确定的内容明确说明；涉及事实时优先引用检索到的来源；逻辑清晰、分步骤表达。",
  },
  {
    id: "creative",
    label: "创意灵感",
    desc: "多灵感不死板",
    icon: Lightbulb,
    iconColor: "text-amber-500",
    activeClass:
      "border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shadow-sm ring-1 ring-amber-600",
    text: "你是一个富有想象力的私人 AI 助理。乐于发散、多给灵感与可能性，表达生动；涉及客观事实时仍以检索资料为准，不虚构。",
  },
  { id: "custom", label: "自定义", desc: "自己写人设", icon: PenLine, text: "" },
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
      alert(err.message || "同步模型失败，请检查后台 .env 是否配置了有效 API 密钥");
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
        localStorage.setItem("personal_ai_preferred_model", defaultModel);
      } catch (e) {}
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "保存设置失败");
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      <Navbar />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 pb-24 md:pb-8">
        <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
              <Settings className="h-5 w-5" />
              <span>系统与模型设置</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">偏好配置</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              控制界面外观模式、默认提示词、温度、长期记忆开关以及专属 API Key。
            </p>
          </div>
        </div>

        {/* General Settings Form */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">全局通用设置</h2>

            {/* Theme Appearance Setting */}
            <div className="space-y-3 pb-5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  界面外观与主题 (Theme Appearance)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  支持白天模式、夜间模式或跟随操作系统自动切换。
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-medium transition-all ${
                    theme === "system"
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <Monitor className="h-5 w-5" />
                  <span>💻 跟随系统</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-medium transition-all ${
                    theme === "light"
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <Sun className="h-5 w-5 text-amber-500" />
                  <span>☀️ 浅色 (白天)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-medium transition-all ${
                    theme === "dark"
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <Moon className="h-5 w-5 text-indigo-400" />
                  <span>🌙 深色 (夜间)</span>
                </button>
              </div>
            </div>

            {/* Default Model */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    默认大模型 (Default Model)
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    新对话启动时默认使用的大模型（当前共有 {availableModels.length} 个可用模型）。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSyncModels}
                  disabled={syncingModels}
                  title="向提供商 API (Gemini/OpenAI/OpenRouter/Ollama) 请求最新模型"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingModels ? "animate-spin" : ""}`} />
                  <span>{syncingModels ? "正在请求提供商..." : "同步最新模型"}</span>
                </button>
              </div>
              <ModelSelect
                value={defaultModel}
                onChange={(mId) => setDefaultModel(mId)}
                models={availableModels}
                placeholder="请选择默认大模型"
              />
            </div>

            {/* System Prompt: preset persona cards (theme-switcher style) + editable text */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  助手人设 (Persona)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  选一种回答风格，需要完全自己写时点自定义再往下写。
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {SYSTEM_PROMPT_PRESETS.filter((p) => p.id !== "custom").map((preset) => {
                  const isActive = personaId === preset.id;
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setPersonaId(preset.id);
                        setSystemPrompt(preset.text);
                      }}
                      className={`flex flex-col items-center justify-center gap-1 p-2 sm:p-3 rounded-xl border text-xs font-medium transition-all ${
                        isActive
                          ? preset.activeClass
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${isActive ? "" : preset.iconColor}`} />
                      <span className="font-semibold text-[11px] sm:text-xs">{preset.label}</span>
                      <span className="hidden sm:block text-[10px] font-normal opacity-70 text-center leading-snug">
                        {preset.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPersonaId("custom");
                  setSystemPrompt("");
                }}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed text-xs font-medium transition-all ${
                  personaId === "custom"
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600"
                    : "border-slate-300 dark:border-slate-700 bg-transparent text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                <PenLine className="h-4 w-4 shrink-0" />
                <span className="font-semibold">自定义人设</span>
                <span className="text-[11px] font-normal opacity-70">
                  不套模板，在下方文本框自由编写
                </span>
              </button>
              <textarea
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
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                上面是所选人设的完整文本，可直接微调；一改动即变为自定义。
              </p>
            </div>

            {/* Temperature: three preset gears instead of a raw number slider */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  回答风格 (创意度)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  严谨适合查事实写代码，发散适合起名写故事，日常用平衡。
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {TEMPERATURE_PRESETS.map((preset) => {
                  const isActive = temperature === preset.value;
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTemperature(preset.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all ${
                        isActive
                          ? preset.activeClass
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? "" : preset.iconColor}`} />
                      <span className="font-semibold">{preset.label}</span>
                      <span className="text-[10px] font-normal opacity-70 text-center leading-snug">
                        {preset.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!TEMPERATURE_PRESETS.some((p) => p.value === temperature) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  当前为历史自定义值 {temperature}，点上面任意一档即可覆盖。
                </p>
              )}
            </div>

            {/* Memory Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">启用长期记忆提取与检索</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  开启后对话将自动提取重要事实存入 pgvector，并作为不可信背景注入后续对话。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMemoryEnabled(!memoryEnabled)}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                  memoryEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    memoryEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Memory Extraction Model (admin only) */}
            {memoryEnabled && user?.is_superuser && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="memory-model-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    长期记忆提炼模型 (Memory LLM)
                  </label>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    后台自动总结与事实提炼
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <select
                      id="memory-model-select"
                      value={["openai/gpt-4o-mini", "deepseek/deepseek-chat", "anthropic/claude-3-5-haiku", "google/gemini-2.5-flash", "gpt-4o-mini"].includes(memoryModel) ? memoryModel : "custom"}
                      onChange={(e) => {
                        if (e.target.value !== "custom") {
                          setMemoryModel(e.target.value);
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (推荐：高性价比、提取稳定)</option>
                      <option value="deepseek/deepseek-chat">deepseek/deepseek-chat (DeepSeek V3 便宜且智能)</option>
                      <option value="anthropic/claude-3-5-haiku">anthropic/claude-3-5-haiku (Claude 快速响应)</option>
                      <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (Gemini 2.5 Flash 超快)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (OpenAI 原生直连)</option>
                      <option value="custom">✍️ 手动输入其它模型 ID...</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={memoryModel}
                      onChange={(e) => setMemoryModel(e.target.value.trim())}
                      placeholder="例如: openai/gpt-4o-mini 或 deepseek/deepseek-chat"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
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
              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50 transition-all"
              >
                <Save className="h-4 w-4" />
                <span>{savingSettings ? "正在保存..." : "保存全局设置"}</span>
              </button>
            </div>
          </div>
        </form>

        {/* System Version & Update Check Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                <Info className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">系统版本与更新</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  每次进入应用自动校验最新版本，确保获取最新模型支持与功能特性。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={triggerManualUpdateCheck}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 active:scale-[0.98] transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>检查更新</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block mb-0.5">当前软件版本</span>
              <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">v{CURRENT_VERSION}</span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block mb-0.5">客户端架构</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Next.js 14 Web App</span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block mb-0.5">更新检测策略</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> 每次进入自动检查
              </span>
            </div>
          </div>
        </div>
      </main>
      </div>

      {/* Model Sync Result Dialog */}
      {syncResultModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  syncResultModal.newCount > 0
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                }`}>
                  {syncResultModal.newCount > 0 ? (
                    <Sparkles className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {syncResultModal.newCount > 0
                      ? `🎉 发现 ${syncResultModal.newCount} 个新模型！`
                      : "模型库已是最新"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {syncResultModal.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSyncResultModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {syncResultModal.newCount > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  新检测到的模型列表：
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
                  {syncResultModal.newModels.map((m) => (
                    <div key={m.id} className="pt-2 first:pt-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {m.name}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                          {m.provider}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {m.id}
                      </p>
                      {m.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {m.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800/60">
                系统已向后台配置的所有 API 提供商（Gemini / OpenAI / OpenRouter / Ollama）发起即时校验，现有模型库已包含所有支持的模型，未检测到新增模型。
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSyncResultModal(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

"use client";

import * as React from "react";
import {
  Volume2,
  VolumeX,
  Loader2,
  BookOpen,
  Lightbulb,
  Layers,
  Languages,
  Check,
  Copy,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { speakText } from "@/lib/speech";
import { cn } from "@/lib/utils";

export interface WordDefinition {
  pos?: string;
  meaning: string;
}

export interface WordExample {
  original: string;
  translation?: string;
  note?: string;
}

export interface WordPhrase {
  phrase: string;
  meaning?: string;
}

export interface WordCardData {
  word: string;
  language?: string;
  phonetic?: string;
  phonetic_uk?: string;
  phonetic_us?: string;
  definitions?: WordDefinition[];
  examples?: WordExample[];
  phrases?: WordPhrase[];
  grammar_tips?: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "英语",
  ja: "日语",
  fr: "法语",
  de: "德语",
  es: "西班牙语",
  ko: "韩语",
  ru: "俄语",
  it: "意大利语",
  pt: "葡萄牙语",
  zh: "中文",
  ar: "阿拉伯语",
};

/** 本地剪贴板反馈 hook，避免循环依赖 CodeBlock */
function useLocalCopyFeedback(duration = 2000) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = React.useCallback(
    (text: string) => {
      try {
        navigator.clipboard.writeText(text);
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), duration);
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    },
    [duration]
  );

  return { copied, copy };
}

function safeString(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

/**
 * 尝试把模型输出的字符串解析为结构化单词卡数据。
 * 支持标准 JSON、Markdown 键值对以及模糊字段容错。
 */
export function parseWordData(raw: string): WordCardData | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // 1. 尝试 JSON 提取
  let jsonStr = trimmed;
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    jsonStr = trimmed.substring(jsonStart, jsonEnd + 1);
  }

  try {
    const obj = JSON.parse(jsonStr);
    if (obj && typeof obj === "object") {
      const word = safeString(
        obj.word ||
        obj.term ||
        obj.vocabulary ||
        obj.title ||
        obj.name ||
        ""
      ).trim();

      if (word) {
        const rawDefs = obj.definitions || obj.definition || obj.meanings || [];
        const definitions: WordDefinition[] = [];
        if (Array.isArray(rawDefs)) {
          for (const d of rawDefs) {
            if (typeof d === "string") {
              definitions.push({ meaning: d });
            } else if (d && typeof d === "object") {
              definitions.push({
                pos: d.pos || d.part_of_speech || d.type ? safeString(d.pos || d.part_of_speech || d.type) : undefined,
                meaning: safeString(d.meaning || d.definition || d.zh || d.translation || d),
              });
            }
          }
        } else if (typeof rawDefs === "string") {
          definitions.push({ meaning: rawDefs });
        }

        const rawExamples = obj.examples || obj.example || obj.sentences || [];
        const examples: WordExample[] = [];
        if (Array.isArray(rawExamples)) {
          for (const ex of rawExamples) {
            if (typeof ex === "string") {
              examples.push({ original: ex });
            } else if (ex && typeof ex === "object") {
              const orig = safeString(ex.original || ex.en || ex.sentence || ex.foreign || ex.text || "");
              if (orig) {
                examples.push({
                  original: orig,
                  translation: ex.translation || ex.zh || ex.meaning ? safeString(ex.translation || ex.zh || ex.meaning) : undefined,
                  note: ex.note || ex.tip || ex.explanation ? safeString(ex.note || ex.tip || ex.explanation) : undefined,
                });
              }
            }
          }
        }

        const rawPhrases = obj.phrases || obj.collocations || obj.idioms || [];
        const phrases: WordPhrase[] = [];
        if (Array.isArray(rawPhrases)) {
          for (const p of rawPhrases) {
            if (typeof p === "string") {
              const parts = p.split(/[:：-]/);
              phrases.push({
                phrase: parts[0]?.trim() || p,
                meaning: parts[1]?.trim() || undefined,
              });
            } else if (p && typeof p === "object") {
              phrases.push({
                phrase: safeString(p.phrase || p.text || p.title || ""),
                meaning: p.meaning || p.translation || p.zh ? safeString(p.meaning || p.translation || p.zh) : undefined,
              });
            }
          }
        }

        const phonetic =
          obj.phonetic ||
          obj.ipa ||
          obj.pinyin ||
          (typeof obj.pronunciation === "string" ? obj.pronunciation : obj.pronunciation?.text) ||
          undefined;

        return {
          word,
          language: safeString(obj.language || obj.lang || "en").toLowerCase(),
          phonetic: phonetic ? safeString(phonetic) : undefined,
          phonetic_uk: obj.phonetic_uk || obj.uk_phonetic || obj.pronunciation?.uk ? safeString(obj.phonetic_uk || obj.uk_phonetic || obj.pronunciation?.uk) : undefined,
          phonetic_us: obj.phonetic_us || obj.us_phonetic || obj.pronunciation?.us ? safeString(obj.phonetic_us || obj.us_phonetic || obj.pronunciation?.us) : undefined,
          definitions: definitions.length > 0 ? definitions : undefined,
          examples: examples.length > 0 ? examples : undefined,
          phrases: phrases.length > 0 ? phrases : undefined,
          grammar_tips:
            obj.grammar_tips ||
            obj.grammar ||
            obj.tips ||
            obj.notes ||
            obj.usage_notes
              ? safeString(obj.grammar_tips || obj.grammar || obj.tips || obj.notes || obj.usage_notes)
              : undefined,
        };
      }
    }
  } catch {
    // 忽略未闭合的 JSON（流式阶段），进入备用正则
  }

  // 2. 尝试宽松键值对格式提取
  const wordMatch = trimmed.match(/(?:^|\n)(?:#+\s*)?(?:word|单词|生词|term)\s*[:：]\s*([^\n\r]+)/i);
  if (wordMatch) {
    const word = wordMatch[1].replace(/[*_`]/g, "").trim();
    const phoneticMatch = trimmed.match(/(?:phonetic|音标|注音)\s*[:：]\s*([^\n\r]+)/i);
    const grammarMatch = trimmed.match(/(?:grammar(?:_tips)?|语法(?:提示|要点)?)\s*[:：]\s*([^\n\r]+(?:\n(?![a-zA-Z\u4e00-\u9fa5]+[:：])[^\n\r]+)*)/i);

    return {
      word,
      language: "en",
      phonetic: phoneticMatch ? phoneticMatch[1].replace(/[*_`]/g, "").trim() : undefined,
      grammar_tips: grammarMatch ? grammarMatch[1].trim() : undefined,
    };
  }

  return null;
}

/**
 * 兜底：利用浏览器原生 Web Speech API 进行发音
 */
function playWebSpeech(text: string, lang = "en"): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return reject(new Error("浏览器不支持语音合成"));
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (lang) {
        utterance.lang = lang;
      }
      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 单词与多语言学习交互卡片。
 * 支持点击单词、例句独立发音，优先调用后端配置好的全语言 TTS 模型，
 * 并以 Web Speech API 作为离线/无模型兜底。
 */
export function WordCard({
  rawContent,
  initialData,
}: {
  rawContent: string;
  initialData?: WordCardData | null;
}) {
  const [viewMode, setViewMode] = React.useState<"card" | "code">("card");

  // 使用 useMemo 保证流式输出时每一跳都能即时响应数据变化，且不会因异步 useState 延迟卡死
  const data = React.useMemo(() => {
    return initialData || parseWordData(rawContent);
  }, [initialData, rawContent]);

  const [playingKey, setPlayingKey] = React.useState<string | null>(null);
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = React.useRef<Map<string, string>>(new Map());
  const { copied, copy } = useLocalCopyFeedback();

  // 组件卸载时释放音频资源
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      audioCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      audioCacheRef.current.clear();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopAudio = React.useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingKey(null);
    setLoadingKey(null);
  }, []);

  const handlePlay = React.useCallback(
    async (key: string, textToSpeak: string, lang = "en") => {
      const text = textToSpeak.trim();
      if (!text) return;

      if (playingKey === key || loadingKey === key) {
        stopAudio();
        return;
      }

      stopAudio();
      setLoadingKey(key);

      try {
        let url = audioCacheRef.current.get(text);
        if (!url) {
          const blob = await speakText(text);
          url = URL.createObjectURL(blob);
          audioCacheRef.current.set(text, url);
        }

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setPlayingKey(null);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setPlayingKey(null);
          audioRef.current = null;
        };

        await audio.play();
        setLoadingKey(null);
        setPlayingKey(key);
      } catch (backendErr) {
        console.warn("项目后端 TTS 合成未就绪或调用失败，转为浏览器原生发音:", backendErr);
        try {
          setLoadingKey(null);
          setPlayingKey(key);
          await playWebSpeech(text, lang);
          setPlayingKey(null);
        } catch (speechErr) {
          console.error("发音失败:", speechErr);
          setLoadingKey(null);
          setPlayingKey(null);
        }
      }
    },
    [playingKey, loadingKey, stopAudio]
  );

  // 如果流式生成尚未完成或无法解析为单词卡，友好展示预备态
  if (!data || !data.word) {
    return (
      <div className="my-3 overflow-hidden rounded-2xl border border-border/70 bg-[#0d0d0d] p-4 text-xs font-mono text-muted-foreground">
        <div className="mb-2 flex items-center justify-between text-2xs text-muted-foreground/75">
          <span className="flex items-center gap-1.5 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>单词卡生成中...</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copy(rawContent)}
            className="h-6 gap-1 px-2 text-2xs text-slate-300 hover:bg-white/10"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "已复制" : "复制"}</span>
          </Button>
        </div>
        <pre className="whitespace-pre-wrap">{rawContent}</pre>
      </div>
    );
  }

  const langCode = (data.language || "en").toLowerCase();
  const langName = LANGUAGE_NAMES[langCode] || langCode.toUpperCase();

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all">
      {/* 顶部标题栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-surface-3/50 px-4 py-2.5 text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="flex h-6 items-center gap-1.5 rounded-md bg-primary/10 px-2 font-medium text-primary">
            <Languages className="h-3.5 w-3.5" />
            <span className="text-2xs">{langName}卡片</span>
          </div>
          <span className="text-2xs text-muted-foreground">点读发音已就绪</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-border/60 bg-background/80 p-0.5 text-2xs">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              aria-pressed={viewMode === "card"}
              className={cn(
                "rounded-md px-2 py-0.5 transition-colors",
                viewMode === "card"
                  ? "bg-primary font-medium text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              卡片视图
            </button>
            <button
              type="button"
              onClick={() => setViewMode("code")}
              aria-pressed={viewMode === "code"}
              className={cn(
                "rounded-md px-2 py-0.5 transition-colors",
                viewMode === "code"
                  ? "bg-primary font-medium text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              代码
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copy(data.word)}
            className="h-7 gap-1 rounded-lg px-2 text-2xs text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "已复制" : "复制单词"}</span>
          </Button>
        </div>
      </div>

      {viewMode === "code" ? (
        <div className="overflow-x-auto bg-[#0d0d0d] p-4 font-mono text-footnote leading-relaxed text-[#ececec]">
          <pre className="whitespace-pre-wrap">{rawContent}</pre>
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          {/* 单词主区域：单词标题 + 发音按钮 + 音标 */}
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/40 pb-3.5">
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {safeString(data.word)}
                </h2>

                {/* 主发音按钮 */}
                <button
                  type="button"
                  onClick={() => handlePlay("word", data.word, langCode)}
                  title="点击朗读单词"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all shadow-2xs cursor-pointer",
                    playingKey === "word"
                      ? "bg-primary text-primary-foreground animate-pulse"
                      : loadingKey === "word"
                      ? "bg-primary/20 text-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                >
                  {loadingKey === "word" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : playingKey === "word" ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {loadingKey === "word"
                      ? "合成中"
                      : playingKey === "word"
                      ? "播放中"
                      : "发音"}
                  </span>
                </button>
              </div>

              {/* 音标展示（支持单音标或英美分列音标） */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
                {data.phonetic_uk && (
                  <span className="inline-flex items-center gap-1 rounded bg-surface-3/80 px-1.5 py-0.5">
                    <span className="text-2xs font-sans text-primary">英</span>
                    {safeString(data.phonetic_uk)}
                  </span>
                )}
                {data.phonetic_us && (
                  <span className="inline-flex items-center gap-1 rounded bg-surface-3/80 px-1.5 py-0.5">
                    <span className="text-2xs font-sans text-primary">美</span>
                    {safeString(data.phonetic_us)}
                  </span>
                )}
                {!data.phonetic_uk && !data.phonetic_us && data.phonetic && (
                  <span className="inline-flex items-center gap-1 rounded bg-surface-3/80 px-1.5 py-0.5">
                    {safeString(data.phonetic)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 释义列表 */}
          {data.definitions && data.definitions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span>核心释义</span>
              </div>
              <div className="space-y-1 pl-1">
                {data.definitions.map((def, idx) => (
                  <div key={idx} className="flex items-baseline gap-2 text-sm leading-relaxed">
                    {def.pos && (
                      <Badge
                        variant="secondary"
                        className="rounded px-1.5 py-0 text-2xs font-mono font-medium text-primary bg-primary/10 hover:bg-primary/15 shrink-0"
                      >
                        {safeString(def.pos)}
                      </Badge>
                    )}
                    <span className="text-foreground/90 font-medium">
                      {safeString(def.meaning)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 经典例句与例句点读 */}
          {data.examples && data.examples.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>经典例句</span>
              </div>
              <div className="space-y-2.5">
                {data.examples.map((ex, idx) => {
                  const exKey = `example-${idx}`;
                  const isExPlaying = playingKey === exKey;
                  const isExLoading = loadingKey === exKey;

                  return (
                    <div
                      key={idx}
                      className="group relative rounded-xl border border-border/50 bg-surface-3/30 p-3 text-xs transition-colors hover:bg-surface-3/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          {/* 外语原句 */}
                          <div className="text-sm font-medium text-foreground leading-snug">
                            {safeString(ex.original)}
                          </div>
                          {/* 中文翻译 */}
                          {ex.translation && (
                            <div className="text-xs text-muted-foreground leading-normal">
                              {safeString(ex.translation)}
                            </div>
                          )}
                          {/* 语法点说明 */}
                          {ex.note && (
                            <div className="text-2xs text-primary/80 pt-0.5">
                              💡 {safeString(ex.note)}
                            </div>
                          )}
                        </div>

                        {/* 例句点读小喇叭 */}
                        <button
                          type="button"
                          onClick={() => handlePlay(exKey, ex.original, langCode)}
                          title="点击发音该例句"
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer",
                            isExPlaying
                              ? "border-primary bg-primary text-primary-foreground animate-pulse"
                              : isExLoading
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border/60 bg-background/80 text-muted-foreground hover:border-primary/50 hover:text-primary"
                          )}
                        >
                          {isExLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isExPlaying ? (
                            <VolumeX className="h-3.5 w-3.5" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 重点短语 / 常用搭配 */}
          {data.phrases && data.phrases.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                <span>常用短语 & 搭配</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                {data.phrases.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-baseline justify-between gap-2 rounded-lg bg-surface-3/30 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-semibold text-foreground/90">
                      {safeString(p.phrase)}
                    </span>
                    {p.meaning && (
                      <span className="text-2xs text-muted-foreground">
                        {safeString(p.meaning)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 语法与易错点提示 */}
          {data.grammar_tips && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                <span>语法要点 & 提示</span>
              </div>
              <div className="pl-5 text-2xs text-foreground/85 whitespace-pre-wrap">
                {safeString(data.grammar_tips)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

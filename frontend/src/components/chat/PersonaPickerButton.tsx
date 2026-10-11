"use client";

import * as React from "react";
import {
  Sparkles,
  Languages,
  Zap,
  BookOpen,
  Lightbulb,
  Terminal,
  Check,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import {
  CHAT_PERSONAS,
  VOCAB_TARGET_LANGUAGES,
  type ChatPersona,
} from "@/config/personas";
import { cn } from "@/lib/utils";

function getPersonaIcon(iconName: ChatPersona["iconName"]) {
  switch (iconName) {
    case "Languages":
      return Languages;
    case "Zap":
      return Zap;
    case "BookOpen":
      return BookOpen;
    case "Lightbulb":
      return Lightbulb;
    case "Terminal":
      return Terminal;
    case "Sparkles":
    default:
      return Sparkles;
  }
}

export function PersonaPickerButton({
  activePersonaId,
  onSelectPersona,
  vocabTargetLang = "ja",
  onSelectVocabLang,
  disabled = false,
}: {
  activePersonaId: string;
  onSelectPersona: (id: string) => void;
  vocabTargetLang?: string;
  onSelectVocabLang?: (lang: string) => void;
  disabled?: boolean;
}) {
  const activePersona =
    CHAT_PERSONAS.find((p) => p.id === activePersonaId) || CHAT_PERSONAS[0];
  const isCustomPersona = activePersona.id !== "default";
  const ActiveIcon = isCustomPersona ? getPersonaIcon(activePersona.iconName) : Bot;

  const currentLangObj = VOCAB_TARGET_LANGUAGES.find((l) => l.id === vocabTargetLang) || VOCAB_TARGET_LANGUAGES[0];
  const displayShortLabel =
    activePersona.id === "vocab_tutor" && currentLangObj
      ? `翻译·${currentLangObj.name}`
      : activePersona.shortLabel;

  return (
    <DropdownMenu>
      <ActionTooltip
        label={
          isCustomPersona
            ? `当前模式：${activePersona.label}（点击切换）`
            : "助手模式（默认助手）"
        }
        side="top"
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={isCustomPersona ? "outline" : "ghost"}
            size={isCustomPersona ? "sm" : "icon"}
            disabled={disabled}
            className={cn(
              "h-9 shrink-0 mb-0.5 rounded-full transition-all flex items-center justify-center cursor-pointer",
              isCustomPersona
                ? "px-2.5 gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 shadow-2xs ring-1 ring-primary/25"
                : "w-9 text-muted-foreground hover:bg-surface-3/80 hover:text-foreground"
            )}
            aria-label="选择助手模式"
          >
            <ActiveIcon className="h-4 w-4 shrink-0" />
            {isCustomPersona && (
              <>
                <span className="text-xs font-medium max-sm:hidden">
                  {displayShortLabel}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
      </ActionTooltip>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={12}
        className="z-50 select-none w-72 rounded-2xl border border-border/70 bg-background/95 p-2 backdrop-blur-2xl shadow-xl animate-in fade-in-0 zoom-in-95"
      >
        <div className="px-2.5 py-1.5 border-b border-border/40 mb-1.5 flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
            选择助手模式
          </span>
          {isCustomPersona && (
            <button
              type="button"
              onClick={() => onSelectPersona("default")}
              className="text-2xs text-primary hover:underline font-semibold cursor-pointer"
            >
              重置为默认
            </button>
          )}
        </div>

        <div className="space-y-1">
          {CHAT_PERSONAS.map((p) => {
            const isSelected = activePersona.id === p.id;
            const IconComponent = getPersonaIcon(p.iconName);

            return (
              <DropdownMenuItem
                key={p.id}
                onClick={() => onSelectPersona(p.id)}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl p-2 cursor-pointer transition-colors focus:bg-surface-3",
                  isSelected
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-surface-3/80"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    p.colorClass
                  )}
                >
                  <IconComponent className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isSelected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {p.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {p.badge && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                          {p.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 stroke-[2.5]" />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] leading-tight text-muted-foreground line-clamp-2 mt-0.5">
                    {p.desc}
                  </p>

                  {/* 智能翻译被选中时的快速语种微调 */}
                  {p.id === "vocab_tutor" && isSelected && onSelectVocabLang && (
                    <div
                      className="mt-2 pt-2 border-t border-border/40 flex flex-wrap gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-full text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center justify-between">
                        <span>双向互译语种</span>
                        <span className="text-primary font-semibold">
                          {currentLangObj?.name || "英语"}
                        </span>
                      </div>
                      {VOCAB_TARGET_LANGUAGES.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectVocabLang(l.id);
                          }}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer border",
                            vocabTargetLang === l.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-surface-3/80 text-muted-foreground border-border/50 hover:text-foreground"
                          )}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

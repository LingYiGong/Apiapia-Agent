"use client";

import React, { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { AttachmentItems, DocChip, ImageThumb, MediaGrid } from "@/components/chat/MessageMedia";
import {
  AiImageCard,
  AiVideoCard,
  SearchSources,
  parseSearchResults,
  parseUserMessage,
  renderMessageBody,
  stripAttachmentMarkup,
} from "@/components/chat/markdown";
import { messageEditingRef } from "@/lib/messageEditGuard";
import { formatClock, formatDateTime, formatDuration } from "@/lib/format";
import { useSpeechPlayer } from "@/hooks/useSpeechPlayer";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Cpu,
  Check,
  Clock,
  Copy,
  Loader2,
  Palette,
  PenLine,
  Play,
  Quote,
  RotateCw,
  Square,
  Video,
  Volume2,
  VolumeX,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Message } from "@/types";

/**
 * 单条消息气泡。
 *
 * 本文件此前 1199 行，其中 markdown 渲染、SVG 画作、AI 图片卡片、代码块、
 * 用户消息解析等约 600 行与「气泡长什么样」是两件事，已移入 ./markdown。
 * 现在这里只保留：气泡布局、编辑态、操作栏、元信息。
 */

interface ChatMessageItemProps {
  msg: Message;
  idx: number;
  isCopied: boolean;
  onCopy: (text: string, idx: number) => void;
  onImageClick: (src: string, alt?: string) => void;
  canRegenerate?: boolean;
  regenerating?: boolean;
  onRegenerate?: (assistantMessageId: string) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  onContinue?: () => void;
  onQuote?: (quoteText: string, messageId?: string) => void;
}


/** 「复制」按钮。助手与用户两处原本各写了一遍，结构完全相同。 */
function CopyButton({
  isCopied,
  onClick,
  copyLabel,
  side = "bottom",
}: {
  isCopied: boolean;
  onClick: () => void;
  copyLabel: string;
  side?: "top" | "bottom";
}) {
  return (
    <ActionTooltip label={isCopied ? "已复制到剪贴板" : copyLabel} side={side}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClick}
        className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-surface-3/80 hover:text-foreground"
      >
        {isCopied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-2xs font-medium text-emerald-500">已复制</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span className="text-2xs">复制</span>
          </>
        )}
      </Button>
    </ActionTooltip>
  );
}

/**
 * 「朗读」按钮：把这条消息读出来。
 *
 * All of the playback machinery lives in useSpeechPlayer, shared with voice
 * mode's automatic read-aloud. This component is only the button plus its label —
 * it stays here rather than being lifted to the page so a bubble that starts
 * talking does not re-render every other bubble.
 *
 * `tooltip` differs per side of the conversation: the same "朗读" affordance on
 * a question should not claim to be reading the answer back.
 */
function SpeakButton({
  text,
  side = "bottom",
  tooltip = "朗读此回答",
}: {
  text: string;
  side?: "top" | "bottom";
  tooltip?: string;
}) {
  const { state, isBusy, speak, stop } = useSpeechPlayer();

  return (
    <ActionTooltip
      label={isBusy ? "停止朗读" : state === "error" ? "朗读失败，点击重试" : tooltip}
      side={side}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={isBusy ? stop : () => void speak(text)}
        className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-surface-3/80 hover:text-foreground"
      >
        {state === "loading" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-2xs">合成中</span>
          </>
        ) : isBusy ? (
          <>
            <VolumeX className="h-3.5 w-3.5" />
            <span className="text-2xs">停止</span>
          </>
        ) : (
          <>
            <Volume2 className="h-3.5 w-3.5" />
            <span className="text-2xs">朗读</span>
          </>
        )}
      </Button>
    </ActionTooltip>
  );
}

/** 元信息里的一枚「图标 + 数值 + tooltip」徽标。 */
function MetaBadge({
  icon: Icon,
  value,
  label,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <ActionTooltip label={label} side="top">
      <span className={cn("flex cursor-default items-center gap-1", className)}>
        <Icon className={cn("h-3 w-3", iconClassName)} />
        <span>{value}</span>
      </span>
    </ActionTooltip>
  );
}

export const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  idx,
  isCopied,
  onCopy,
  onImageClick,
  canRegenerate,
  regenerating,
  onRegenerate,
  onEditMessage,
  onContinue,
  onQuote,
}: ChatMessageItemProps) {
  const isUser = msg.role === "user";
  // 错误判定用后端下发的 finish_reason，不再靠内容里是否含 "HTTP 500" 之类的
  // 字符串嗅探 —— 那种做法会把用户正常引用这些字样的消息也渲染成红色错误卡片。
  const isErrorMsg = !isUser && msg.finish_reason === "error";

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  /**
   * 用户消息里的图片/附件解析。
   *
   * parseUserMessage 要扫全文，而带内联 base64 图片时 content 可达数 MB ——
   * 每帧重扫足以让整页掉帧，所以只在 content / attachments 真正变化时算一次。
   */
  const parsedUserMedia = React.useMemo(() => {
    // 附件已结构化存在时不需要再从正文里抠
    if (msg.attachments && msg.attachments.length > 0) return null;
    return parseUserMessage(msg.content);
  }, [msg.content, msg.attachments]);

  // 编辑期间告诉页面别用服务端数据覆盖 messages（切后台/切页签刷新会冲掉草稿）
  React.useEffect(() => {
    if (!editing) return;
    messageEditingRef.current = true;
    return () => {
      messageEditingRef.current = false;
    };
  }, [editing]);

  const startEdit = () => {
    setDraft(stripAttachmentMarkup(msg.content || ""));
    setEditing(true);
  };

  const commitEdit = () => {
    if (!msg.id || !onEditMessage) {
      setEditing(false);
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (!next || next === stripAttachmentMarkup(msg.content || "").trim()) return;
    onEditMessage(msg.id, next);
  };

  const searchResults = React.useMemo(
    () => (isUser ? [] : parseSearchResults(msg.search_results)),
    [isUser, msg.search_results]
  );

  const totalTokens =
    msg.token_usage || (msg.prompt_tokens || 0) + (msg.completion_tokens || 0);

  const renderUserBody = () => {
    if (editing) {
      return (
        <div className="flex min-w-[260px] max-w-full flex-col gap-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // ⌘/Ctrl + Enter 提交；Esc 取消
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === "Escape") setEditing(false);
            }}
            rows={3}
            aria-label="编辑这条提问"
            className="w-full resize-none rounded-2xl border border-primary/40 bg-background px-4 py-3 text-subhead leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              className="h-7 rounded-lg px-2.5 text-2xs"
            >
              取消
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={commitEdit}
              className="h-7 rounded-lg px-2.5 text-2xs"
            >
              发送
            </Button>
          </div>
        </div>
      );
    }

    const attachments = msg.attachments;
    if (attachments && attachments.length > 0) {
      return (
        <>
          <AttachmentItems attachments={attachments} onImageClick={onImageClick} />
          {msg.content?.trim() && (
            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content.trim()}</div>
          )}
        </>
      );
    }

    const parsed = parsedUserMedia;
    if (!parsed) return null;
    const hasMedia = parsed.images.length > 0 || parsed.docs.length > 0;

    const trimmedText = (parsed.text || "").trim();
    const fallbackText = (msg.content || "").trim();

    return (
      <>
        {hasMedia && (
          <MediaGrid>
            {parsed.images.map((img, i) => (
              <ImageThumb
                key={i}
                src={img.url}
                alt={img.name}
                onClick={() => onImageClick(img.url, img.name)}
              />
            ))}
            {parsed.docs.map((docName, i) => (
              <DocChip key={i} name={docName} />
            ))}
          </MediaGrid>
        )}
        {trimmedText ? (
          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{trimmedText}</div>
        ) : !hasMedia && fallbackText ? (
          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{fallbackText}</div>
        ) : null}
      </>
    );
  };

  return (
    <div className={cn("group flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex min-w-0 flex-col",
          isUser ? "max-w-[85%] items-end sm:max-w-[75%]" : "w-full max-w-full items-start"
        )}
      >
        <div
          className={cn(
            "min-w-0 max-w-full break-words [overflow-wrap:anywhere]",
            isUser
              ? "rounded-[24px] bg-[#f4f4f4] px-5 py-3 text-subhead leading-relaxed text-foreground shadow-2xs dark:bg-surface-3"
              : isErrorMsg
              ? "w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5 shadow-sm"
              : "w-full border-0 bg-transparent px-0 py-0.5 text-foreground leading-[1.75] shadow-none"
          )}
        >
          {isUser ? (
            <div>{renderUserBody()}</div>
          ) : isErrorMsg ? (
            <div>
              <div className="mb-1 flex items-center gap-1.5 font-bold text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>生成出错：</span>
              </div>
              <div className="break-words whitespace-pre-wrap rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 font-mono text-xs [overflow-wrap:anywhere]">
                {msg.content}
              </div>
            </div>
          ) : (
            <>
              {/* 参考网页：列在思考过程与正文内容上方 */}
              {searchResults.length > 0 && (
                <SearchSources results={searchResults} className="mb-2.5" />
              )}

              {msg.toolInvocations && msg.toolInvocations.length > 0 && (
                <details
                  open={false}
                  className="group mb-2.5 overflow-hidden rounded-xl border border-border/70 bg-surface-3/30 text-xs transition-all"
                >
                  <summary className="flex cursor-pointer select-none items-center justify-between p-2.5 font-medium text-foreground transition-colors hover:bg-surface-3/50">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-primary" />
                      <span>工具调用与检索记录（{msg.toolInvocations.length} 项）</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="ml-2 shrink-0 text-2xs text-muted-foreground transition-transform group-open:rotate-180"
                    >
                      ▼
                    </span>
                  </summary>
                  <div className="space-y-1.5 border-t border-border/40 p-2">
                    {msg.toolInvocations.map((tool) => (
                      <div
                        key={tool.toolCallId}
                        className="rounded-lg border border-border/60 bg-card p-2 text-xs"
                      >
                        <div className="flex items-center justify-between font-medium">
                          <div className="flex items-center gap-2">
                            {tool.state === "call" ? (
                              <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : tool.toolName === "image_generation" ? (
                              <Palette className="h-3.5 w-3.5 text-primary" />
                            ) : tool.toolName === "video_generation" ? (
                              <Video className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Cpu className="h-3.5 w-3.5 text-primary" />
                            )}
                            <span className="font-semibold text-foreground">
                              {tool.toolName === "search" || tool.toolName === "web_search"
                                ? "执行联网检索"
                                : tool.toolName === "image_generation"
                                ? "执行 AI 图像绘制"
                                : tool.toolName === "video_generation"
                                ? "执行 AI 视频生成"
                                : `调用工具: ${tool.toolName}`}
                            </span>
                          </div>
                          <span className="font-mono text-2xs text-muted-foreground">
                            {tool.state === "call" ? "运行中..." : "已完成"}
                          </span>
                        </div>
                        {tool.state === "result" && tool.result && (
                          <div className="mt-1.5 break-words border-t border-border/40 pt-1.5 font-mono text-2xs text-muted-foreground">
                            {typeof tool.result === "string"
                              ? tool.result
                              : JSON.stringify(tool.result)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {msg.generatedImages && msg.generatedImages.length > 0 && (
                <div className="mb-2 space-y-3">
                  {msg.generatedImages.map((img, imgIdx) => (
                    <AiImageCard
                      key={img.id || imgIdx}
                      image={img}
                      onImageClick={onImageClick}
                    />
                  ))}
                </div>
              )}

              {msg.generatedVideos && msg.generatedVideos.length > 0 && (
                <div className="mb-2 space-y-3">
                  {msg.generatedVideos.map((vid, vidIdx) => (
                    <AiVideoCard
                      key={vid.id || vidIdx}
                      video={vid}
                    />
                  ))}
                </div>
              )}

              {renderMessageBody(msg.content, false, onImageClick)}
            </>
          )}
        </div>

        {/* 助手消息：操作栏 + 元信息 */}
        {!isUser && !isErrorMsg && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-0.5 text-2xs text-muted-foreground select-none">
            <div className="flex items-center gap-1">
              <CopyButton
                isCopied={isCopied}
                onClick={() => onCopy(msg.content, idx)}
                copyLabel="复制回答"
              />

              <SpeakButton text={msg.content} />

              {onQuote && (
                <ActionTooltip label="引用此回答并继续提问" side="bottom">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onQuote(msg.content, msg.id)}
                    className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-surface-3/80 hover:text-foreground"
                  >
                    <Quote className="h-3 w-3" />
                    <span className="text-2xs">引用</span>
                  </Button>
                </ActionTooltip>
              )}

              {msg.finish_reason === "abort" && (
                <ActionTooltip label="你在生成过程中点击了停止，此处为已生成的部分内容" side="bottom">
                  <span className="inline-flex h-7 cursor-default items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 text-2xs font-medium text-amber-600 dark:text-amber-400">
                    <Square className="h-2.5 w-2.5 fill-current" />
                    <span>已停止</span>
                  </span>
                </ActionTooltip>
              )}

              {msg.finish_reason === "length" && (
                <>
                  <ActionTooltip label="因达到模型单次最大 Token 限制，回答已截断" side="bottom">
                    <span className="inline-flex h-7 cursor-default items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 text-2xs font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      <span>长度截断</span>
                    </span>
                  </ActionTooltip>
                  {onContinue && (
                    <ActionTooltip label="从被截断处继续输出后续内容" side="bottom">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onContinue}
                        className="flex h-7 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 text-2xs font-medium text-primary hover:bg-primary/20"
                      >
                        <Play className="h-2.5 w-2.5 fill-current" />
                        <span>继续生成</span>
                      </Button>
                    </ActionTooltip>
                  )}
                </>
              )}

              {canRegenerate && onRegenerate && (
                <ActionTooltip label="用相同提问重新生成回答" side="bottom">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={regenerating}
                    onClick={() => msg.id && onRegenerate(msg.id)}
                    className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-surface-3/80 hover:text-foreground disabled:opacity-50"
                  >
                    <RotateCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} />
                    <span className="text-2xs">重新生成</span>
                  </Button>
                </ActionTooltip>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono opacity-50 transition-opacity hover:opacity-100">
              {msg.created_at && (
                <MetaBadge
                  icon={Clock}
                  value={formatDateTime(msg.created_at)}
                  label="回复时间"
                />
              )}

              {msg.model && (
                <ActionTooltip label="回复模型" side="top">
                  <Badge
                    variant="secondary"
                    className="h-[18px] cursor-default px-1.5 py-0 font-mono text-2xs font-normal"
                  >
                    <Cpu className="mr-1 h-2.5 w-2.5 text-primary" />
                    <span>{msg.model}</span>
                  </Badge>
                </ActionTooltip>
              )}

              {typeof msg.thinking_duration_ms === "number" && msg.thinking_duration_ms > 0 && (
                <MetaBadge
                  icon={Clock}
                  value={`思考 ${formatDuration(msg.thinking_duration_ms)}`}
                  label="思考耗时（到首字输出时间）"
                  className="font-medium text-emerald-600 dark:text-emerald-400"
                  iconClassName="text-emerald-500"
                />
              )}

              {typeof msg.duration_ms === "number" && msg.duration_ms > 0 && (
                <MetaBadge
                  icon={Zap}
                  value={formatDuration(msg.duration_ms)}
                  label="总生成耗时"
                  className="font-medium text-amber-600 dark:text-amber-400"
                  iconClassName="text-amber-500"
                />
              )}

              {totalTokens ? (
                <MetaBadge
                  icon={Cpu}
                  value={`Tokens: ${totalTokens}`}
                  label="Token 消耗（输入+输出）"
                  className="text-2xs text-slate-500 dark:text-slate-400"
                />
              ) : null}
            </div>
          </div>
        )}

        {/* 用户消息操作栏：与助手消息同一位置，便于扫读 */}
        {isUser && !editing && msg.id && onEditMessage && (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-1 px-0.5 text-2xs text-muted-foreground select-none">
            <ActionTooltip label="编辑这条提问并重新发送" side="bottom">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={startEdit}
                className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-surface-3/80 hover:text-foreground"
              >
                <PenLine className="h-3.5 w-3.5" />
                <span className="text-2xs">编辑</span>
              </Button>
            </ActionTooltip>
            {onQuote && (
              <ActionTooltip label="引用此提问" side="bottom">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onQuote(stripAttachmentMarkup(msg.content || ""), msg.id)}
                  className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-surface-3/80 hover:text-foreground"
                >
                  <Quote className="h-3 w-3" />
                  <span className="text-2xs">引用</span>
                </Button>
              </ActionTooltip>
            )}
            <CopyButton
              isCopied={isCopied}
              onClick={() => onCopy(stripAttachmentMarkup(msg.content || "").trim(), idx)}
              copyLabel="复制提问"
            />
            {/* stripAttachmentMarkup 是必须的，不是顺手：用户消息里可能嵌着附件的
                base64 data URL 和附件标记，不过滤的话 TTS 会把一整串编码念出来。
                和上面的复制、引用保持同一套取文逻辑。 */}
            <SpeakButton
              text={stripAttachmentMarkup(msg.content || "")}
              tooltip="朗读此提问"
            />
          </div>
        )}
      </div>
    </div>
  );
});

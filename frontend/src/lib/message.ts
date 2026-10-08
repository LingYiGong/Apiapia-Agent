import type { GeneratedImage, GeneratedVideo, Message, ToolInvocation } from "@/types";

/**
 * 消息的形状归一化。
 *
 * 后端把工具调用与生成图/视频以 JSON 字符串存在 DB 列里，而流式回调直接给对象。
 * types/index.ts 因此为同一份数据保留了两套字段（snake_case 原文 +
 * camelCase 解析结果），chat/page 与 ChatMessageItem 各自做一次转换。
 * 转换逻辑只有一份，放在这里。
 */

/** 宽松解析：接受对象或 JSON 字符串；解析失败返回 null（不抛）。 */
function parseJsonColumn(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toToolInvocations(raw: unknown): ToolInvocation[] | undefined {
  const parsed = parseJsonColumn(raw);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed as ToolInvocation[];
  return undefined;
}

function toGeneratedImages(raw: unknown): GeneratedImage[] | undefined {
  const parsed = parseJsonColumn(raw);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed as GeneratedImage[];
  return undefined;
}

function toGeneratedVideos(raw: unknown): GeneratedVideo[] | undefined {
  const parsed = parseJsonColumn(raw);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed as GeneratedVideo[];
  return undefined;
}

/**
 * 把后端返回的消息补齐成前端渲染需要的形状。
 *
 * 流式路径里这些字段已经在内存中；刷新后只有原始 JSON 列可用，必须重新解析。
 * 被用户中断的轮次会保留已生成的部分文本加 finish_reason —— 这正是刷新后
 * 仍能区分「已停止」与「已完成」的依据。
 *
 * 解析失败只警告不抛：一条坏消息不该让整个会话打不开。
 */
export function hydrateMessage(msg: Message): Message {
  if (!msg.generated_images && !msg.generated_videos && !msg.tool_invocations) return msg;

  const next: Message = { ...msg };

  if (!next.generatedImages && msg.generated_images) {
    const images = toGeneratedImages(msg.generated_images);
    if (images) next.generatedImages = images;
  }
  if (!next.generatedVideos && msg.generated_videos) {
    const videos = toGeneratedVideos(msg.generated_videos);
    if (videos) next.generatedVideos = videos;
  }
  if (!next.toolInvocations && msg.tool_invocations) {
    const tools = toToolInvocations(msg.tool_invocations);
    if (tools) next.toolInvocations = tools;
  }

  return next;
}

export function hydrateMessages(list: Message[] | null | undefined): Message[] {
  return (list ?? []).map(hydrateMessage);
}

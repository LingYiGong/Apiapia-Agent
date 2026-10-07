import type { SearchResultItem } from "@/types";

/**
 * 用户消息正文的解析。
 *
 * 后端把图片以 markdown 内联图语法、文档以「📄 附件文件：xxx」文本存进
 * `content`，前端需要把它们从正文里拆出来单独渲染，否则正文里会出现一整串
 * base64。这些纯函数此前住在 ChatMessageItem 里，与气泡样式混在一起。
 */

const IMG_RE =
  /!\[([^\]]*)\]\(((?:data:image\/[^;)]+;base64,[A-Za-z0-9+/=]+)|(?:https?:\/\/[^\s)]+))\)/gi;
const RAW_IMG_RE = /(data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]+)/g;
const DOC_RE = /📄\s*\*{0,2}\[?(?:附件文件|附件文档|附带文件):\s*([^\]\*\n]+)\]?\*{0,2}/gi;

export interface ParsedUserMessage {
  text: string;
  images: { name: string; url: string }[];
  docs: string[];
}

/**
 * 解析用户消息中的图片与文档。
 *
 * 注意：这个函数要对全文跑一遍正则，而带内联 base64 图片的 content 可达数 MB ——
 * 调用方必须把它包进 useMemo（见 ChatMessageItem 的 parsedUserMedia），
 * 否则每帧重扫足以让整页掉帧。
 */
/**
 * 收集某个带 /g 的正则的全部匹配。
 *
 * 刻意用 `Array.from(...)` 而不是 `for (const m of s.matchAll(re))`：
 * tsconfig 的 `target` 是 `es5` 且没有开 `downlevelIteration`，而 `matchAll`
 * 返回的是 `RegExpStringIterator`（迭代器，不是数组）—— 直接 for...of 迭代它
 * 会编译报错。数组则不受此限制。
 *
 * `matchAll` 内部会克隆正则，不会推进原正则的 lastIndex，因此这里三个正则
 * 后面还能安全地拿去做 `String.replace`。
 */
function collect(source: string, re: RegExp): RegExpExecArray[] {
  return Array.from(source.matchAll(re));
}

export function parseUserMessage(content: string): ParsedUserMessage {
  if (!content) return { text: "", images: [], docs: [] };

  const images: { name: string; url: string }[] = [];
  const docs: string[] = [];

  for (const match of collect(content, IMG_RE)) {
    images.push({ name: match[1] || "图片", url: match[2] });
  }

  // 没有标准 markdown 图语法、但正文里直接含 data:image 的情况
  if (images.length === 0 && content.includes("data:image/")) {
    for (const match of collect(content, RAW_IMG_RE)) {
      images.push({ name: "图片", url: match[1] });
    }
  }

  for (const match of collect(content, DOC_RE)) {
    docs.push(match[1].trim());
  }

  const text = content.replace(IMG_RE, "").replace(RAW_IMG_RE, "").replace(DOC_RE, "").trim();

  return { text, images, docs };
}

/**
 * 用户消息的纯文本视图，用于：
 *  - 内联编辑框的初始值（否则 markdown / base64 会落进 textarea）
 *  - 「复制提问」按钮
 */
export function stripAttachmentMarkup(content: string): string {
  if (!content) return "";
  return content
    .replace(IMG_RE, "")
    .replace(DOC_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 搜索结果字段在 DB 里是 JSON 字符串、在流式回调里是对象，两种都要吃。
 */
export function parseSearchResults(raw: unknown): SearchResultItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as SearchResultItem[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as SearchResultItem[];
    } catch {
      return [];
    }
  }
  return [];
}

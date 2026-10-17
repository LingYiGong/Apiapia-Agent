import type { SearchResultItem } from "@/types";
import { getMediaImageUrl } from "@/lib/api";
import { getTranslator, resolveStoredLocale } from "@/i18n";

/**
 * 用户消息正文的解析。
 *
 * 后端把图片以 markdown 内联图语法、文档以「📄 附件文件：xxx」文本存进
 * `content`，前端需要把它们从正文里拆出来单独渲染。
 */

/**
 * 图片引用的三种来源：
 *  - `data:image/...;base64,...`   历史消息（后端曾经把整张图内联进正文）
 *  - `https?://...`               直接外链
 *  - `/api/media/images/<32位hex>` 后端落盘后的引用形式，由 resolveImageUrl 补全
 */
const IMG_RE =
  /!\[([^\]]*)\]\(((?:data:image\/[^;)]+;base64,[A-Za-z0-9+/=]+)|(?:https?:\/\/[^\s)]+)|(?:\/api\/media\/images\/[0-9a-f]{32}))\)/gi;
const RAW_IMG_RE = /(data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]+)/g;
const DOC_RE = /📄\s*\*{0,2}\[?(?:附件文件|附件文档|附带文件):\s*([^\]\*\n]+)\]?\*{0,2}/gi;
const MEDIA_REF_RE = /^\/api\/media\/images\/([0-9a-f]{32})$/;

/**
 * 把正文里的图片引用解析成可直接喂给 <img src> 的地址。
 *
 * 落盘引用 `/api/media/images/{id}` 是相对路径，且媒体接口需要 JWT，所以不能
 * 直接当 URL 用 —— 必须经 getMediaImageUrl 拼上 `?token=`，否则 <img> 会 401。
 * data URI 与外链原样返回。
 *
 * MEDIA_REF_RE 不带 /g，exec 不会推进 lastIndex，可反复调用。
 */
function resolveImageUrl(raw: string): string {
  const refMatch = MEDIA_REF_RE.exec(raw);
  return refMatch ? getMediaImageUrl(refMatch[1]) : raw;
}

export interface ParsedUserMessage {
  text: string;
  images: { name: string; url: string }[];
  docs: string[];
}

/**
 * 图片没有 alt 时的兜底名，会被 ImageThumb 当作 alt 显示。
 *
 * 注意它与下方 DOC_RE 里的「附件文件 / 附件文档 / 附带文件」性质不同：那三个是
 * **解析关键词**（后端写进正文里、随后被剥掉的标记），换语言就会匹配失败，必须
 * 保持原样；这个兜底名是真正渲染出来的文案，所以走 i18n。
 *
 * 本文件是纯函数模块（调用方把结果 memo 在 msg.content 上），拿不到 useI18n，
 * 因此走 i18n 提供的非 React 取值口。代价是切换语言后不会重算 —— 但它只喂
 * alt 属性，且重新解析要重扫可能数 MB 的内联 base64，拿实时性换这个不划算。
 */
function fallbackImageName(): string {
  return getTranslator(resolveStoredLocale())("chat.markdown.imageAlt");
}

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

/**
 * 解析用户消息中的图片与文档。
 *
 * 注意：历史消息的 content 可能带内联 base64，可达数 MB —— 调用方必须把它包进
 * useMemo（见 ChatMessageItem 的 parsedUserMedia），否则每帧重扫足以让整页掉帧。
 * 落盘引用形式没有这个问题，正则会快速跳过。
 */
export function parseUserMessage(content: string): ParsedUserMessage {
  if (!content) return { text: "", images: [], docs: [] };

  const images: { name: string; url: string }[] = [];
  const docs: string[] = [];

  for (const match of collect(content, IMG_RE)) {
    images.push({ name: match[1] || fallbackImageName(), url: resolveImageUrl(match[2]) });
  }

  // 没有标准 markdown 图语法、但正文里直接含 data:image 的情况
  if (images.length === 0 && content.includes("data:image/")) {
    for (const match of collect(content, RAW_IMG_RE)) {
      images.push({ name: fallbackImageName(), url: match[1] });
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
    .replace(RAW_IMG_RE, "")
    .replace(DOC_RE, "")
    .replace(/^\s+/, "")
    .replace(/\s+$/, "")
    .replace(/\r\n/g, "\n")
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

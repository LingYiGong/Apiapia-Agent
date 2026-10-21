"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Brain, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { CodeBlock } from "@/components/chat/markdown/CodeBlock";

/**
 * 助手消息正文的 markdown 渲染。
 */

export type ImageClickHandler = (src: string, alt?: string) => void;

/** 把模型可能输出的标准 LaTeX 括号分界符 \(...\) 与 \[...\] 转换为 remark-math 识别的 $...$ 与 $$...$$ */
export function normalizeMathDelimiters(text: string): string {
  if (!text) return "";
  let normalized = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);
  return normalized;
}

/** 剥掉模型泄漏的内部痕迹（工具调用容器、ReAct 轨迹、安全分类器输出等），保护代码块并归一化公式。 */
export function sanitizeDisplayContent(raw: string): string {
  if (!raw) return "";

  // 0. 隔离保护 markdown 围栏代码块（``` 与 ~~~），防止代码内部的内容被正则误伤
  const codeBlocks: string[] = [];
  const protectedText = raw.replace(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length - 1}__`;
  });

  // 1. 标准化数学公式分界符 \[...\] -> $$...$$, \(...\) -> $...$
  let cleaned = normalizeMathDelimiters(protectedText)
    // 2. 裸的工具/函数调用容器与悬空的参数标签
    .replace(/<\/?(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)[\s\S]*?(?:<\/(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)>|$)/gi, "")
    .replace(/<\|(?:tool(?:_call|_calls)?_start|action_start|plugin_start)\|?>[\s\S]*?(?:<\|(?:tool(?:_call|_calls)?_end|action_end|plugin_end)\|?>|$)/gi, "")
    .replace(/<\/?(?:arg_key|arg_value|parameter|parameters|arguments)[\s\S]*?>/gi, "")
    .replace(/\[(?:ACTION|SEARCH|TOOL|CALL|OBSERVATION|google|search):\s*[^\]]+\]/gi, "")
    .replace(/\[(?:google|search)\([^\]]*\)\]/gi, "")
    // 3. ReAct 残留
    .replace(/\n\s*(?:Action|Action Input|Observation):\s*[\s\S]*?(?=\n\s*(?:Thought|Final Answer)|$)/gi, "")
    // 4. 护栏/内容审核分类器的输出
    .replace(/(?:Thus (?:both|all) are safe|We must output exactly that format|Safety Assessment:|Content Moderation:)[\s\S]*/gi, "")
    .replace(/(?:(?:User|Input|Prompt|Response|Output|Assistant)\s*(?:Safety|Moderation|Guard|Risk|Category|Harm)\s*[:=]\s*\w+[\s\n\r]*)+/gi, "")
    // 5. 幻觉出的多余轮次（结尾的 User:/Human:）
    .replace(/\n+\s*(?:(?:User|Human|System)\s*:[^\n]+[\s\n\r]*)+$/gi, "")
    // 6. 遗留的内部草稿/反思标签
    .replace(/<\/?(?:scratchpad|internal|reflection|antThinking)>/gi, "");

  // 7. 还原受保护的代码块
  for (let i = 0; i < codeBlocks.length; i++) {
    cleaned = cleaned.replace(`__CODE_BLOCK_PLACEHOLDER_${i}__`, codeBlocks[i]);
  }

  return cleaned.trim();
}

/** 把正文里的裸 `<br>` 变成真正的换行元素（部分模型会用它代替换行）。 */
function renderWithBreaks(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") {
    if (!/<\s*br\s*\/?>|&lt;\s*br\s*\/?&gt;/i.test(node)) return node;
    const parts = node.split(/(<\s*br\s*\/?>|&lt;\s*br\s*\/?&gt;)/gi);
    return parts.map((part, index) =>
      /^(<\s*br\s*\/?>|&lt;\s*br\s*\/?&gt;)$/i.test(part) ? <br key={index} /> : part
    );
  }
  if (Array.isArray(node)) {
    return node.map((child, idx) => (
      <React.Fragment key={idx}>{renderWithBreaks(child)}</React.Fragment>
    ));
  }
  if (React.isValidElement(node) && (node.props as any)?.children) {
    return React.cloneElement(node, {
      ...(node.props as any),
      children: renderWithBreaks((node.props as any).children),
    });
  }
  return node;
}

/**
 * remark 插件表必须是模块级常量：写成 `remarkPlugins={[remarkGfm, remarkMath]}` 会在每次渲染
 * 产生新数组引用，和 components 一样让 react-markdown 认为配置变了从而重解析。
 */
const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

const BODY_TEXT = "text-base sm:text-body leading-[1.62] text-foreground/95";

function MarkdownImage({ node, ...props }: any) {
  const { t } = useI18n();
  return (
    <img
      {...props}
      alt={props.alt || t("chat.markdown.imageAlt")}
      className="my-2 max-h-80 max-w-full rounded-xl border border-border/80 object-contain shadow-sm"
    />
  );
}

const baseMarkdownComponents: Record<string, any> = {
  img: MarkdownImage,
  a: ({ node, children, href, ...props }: any) => {
    const textContent =
      typeof children === "string"
        ? children
        : Array.isArray(children) && typeof children[0] === "string"
        ? children[0]
        : "";
    const isCitation =
      /(?:来源|Source|出典|來源)\s*[:：]|^\s*\[?\d+\]?\s*$|^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(
        textContent.trim()
      );

    if (isCitation) {
      const cleanLabel = textContent.replace(/^(?:来源|Source|出典|來源)\s*[:：]\s*/i, "").trim();
      return (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={href}
          className="group/citation inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-full border border-primary/25 bg-primary/10 text-[11px] font-medium text-primary hover:bg-primary/20 hover:border-primary/50 transition-all no-underline align-baseline cursor-pointer select-none"
        >
          <span className="truncate max-w-[140px]">{cleanLabel || textContent}</span>
          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60 group-hover/citation:opacity-100" />
        </a>
      );
    }

    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all font-medium text-primary underline underline-offset-2 hover:opacity-80 [overflow-wrap:anywhere]"
      >
        {children}
      </a>
    );
  },
  p: ({ node, children, ...props }: any) => (
    <p
      {...props}
      className={`my-2 break-words ${BODY_TEXT} [overflow-wrap:anywhere]`}
    >
      {renderWithBreaks(children)}
    </p>
  ),
  h1: ({ node, ...props }: any) => (
    <h1 {...props} className="mb-3 mt-6 text-2xl font-bold text-foreground sm:text-3xl" />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 {...props} className="mb-2.5 mt-5 text-xl font-bold text-foreground sm:text-2xl" />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 {...props} className="mb-2 mt-4 text-lg font-semibold text-foreground sm:text-xl" />
  ),
  h4: ({ node, ...props }: any) => (
    <h4 {...props} className="mb-1.5 mt-3 text-base font-semibold text-foreground sm:text-lg" />
  ),
  h5: ({ node, ...props }: any) => (
    <h5 {...props} className="mb-1 mt-2.5 text-subhead font-semibold text-foreground sm:text-base" />
  ),
  h6: ({ node, ...props }: any) => (
    <h6
      {...props}
      className="mb-1 mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
    />
  ),
  table: ({ node, ...props }: any) => (
    <div className="my-3 w-full max-w-full overflow-x-auto rounded-xl border border-border/70 shadow-2xs">
      <table {...props} className="min-w-full border-collapse divide-y divide-border/70 text-xs sm:text-sm" />
    </div>
  ),
  thead: ({ node, ...props }: any) => (
    <thead {...props} className="bg-surface-3/60 font-medium text-foreground" />
  ),
  th: ({ node, children, ...props }: any) => (
    <th
      {...props}
      className="border-b border-border/70 bg-surface-3/60 px-3.5 py-2.5 text-left text-xs font-semibold text-foreground sm:text-sm min-w-[80px]"
    >
      {renderWithBreaks(children)}
    </th>
  ),
  td: ({ node, children, ...props }: any) => (
    <td
      {...props}
      className="border-b border-border/50 px-3.5 py-2.5 align-top text-xs text-foreground/90 sm:text-sm min-w-[100px] max-w-sm whitespace-normal break-words sm:whitespace-pre-wrap [overflow-wrap:anywhere]"
    >
      {renderWithBreaks(children)}
    </td>
  ),
  // 交回给 CodeBlock 自己画外壳
  pre: ({ children }: any) => <>{children}</>,
  code: ({ node, inline, className, children, ...props }: any) => {
    const isInline = inline || !className;
    if (isInline) {
      return (
        <code
          {...props}
          className="break-all rounded-md bg-surface-3/80 px-1.5 py-0.5 font-mono text-xs sm:text-footnote text-primary [overflow-wrap:anywhere]"
        >
          {children}
        </code>
      );
    }
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
  ul: ({ node, ...props }: any) => (
    <ul {...props} className="my-1.5 list-disc list-outside break-words pl-4 space-y-1 sm:pl-5 [overflow-wrap:anywhere]" />
  ),
  ol: ({ node, ...props }: any) => (
    <ol {...props} className="my-1.5 list-decimal list-outside break-words pl-4 space-y-1 sm:pl-5 [overflow-wrap:anywhere]" />
  ),
  li: ({ node, children, ...props }: any) => (
    <li {...props} className={`my-1 break-words ${BODY_TEXT} [overflow-wrap:anywhere]`}>
      {renderWithBreaks(children)}
    </li>
  ),
  blockquote: ({ node, ...props }: any) => (
    <blockquote
      {...props}
      className="my-2 break-words border-l-[3px] border-primary py-1 pl-3 italic text-muted-foreground [overflow-wrap:anywhere]"
    />
  ),
};

/**
 * markdown 渲染器表，按 onImageClick 缓存。
 */
let cachedImageClick: ImageClickHandler | undefined;
let cachedComponents: Record<string, any> | undefined;

function MarkdownImageClickable({ node, ...props }: any) {
  const { t } = useI18n();
  return (
    <img
      {...props}
      alt={props.alt || t("chat.markdown.imageAlt")}
      onClick={() => props.src && cachedImageClick?.(props.src, props.alt)}
      title={t("chat.markdown.imageZoom")}
      className="my-2 max-h-80 max-w-full cursor-zoom-in rounded-xl border border-border/80 object-contain shadow-sm transition-opacity hover:opacity-95"
    />
  );
}

function getMessageComponents(onImageClick?: ImageClickHandler) {
  if (cachedComponents && cachedImageClick === onImageClick) return cachedComponents;
  cachedImageClick = onImageClick;
  cachedComponents = {
    ...baseMarkdownComponents,
    img: MarkdownImageClickable,
  };
  return cachedComponents;
}

export function ThoughtBox({ thought, autoScroll }: { thought: string; autoScroll: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!autoScroll) return;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thought, autoScroll]);
  return (
    <div
      ref={ref}
      className="mt-2 max-h-72 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words border-l-2 border-primary/50 pl-2.5 font-mono text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]"
    >
      {thought}
    </div>
  );
}

function ThinkingBlock({
  thought,
  streaming,
  hasBody,
}: {
  thought: string;
  streaming: boolean;
  hasBody: boolean;
}) {
  const { t } = useI18n();
  return (
    <details
      open={!hasBody}
      className="group min-w-0 max-w-full overflow-hidden rounded-xl border border-border/70 bg-surface-3/40 p-2.5 text-xs transition-all"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between font-medium text-primary">
        <span className="flex items-center gap-1.5">
          <Brain className={cn("h-3.5 w-3.5 text-primary", !hasBody && "animate-pulse")} />
          <span>{hasBody ? (t("chat.markdown.thoughtFinished") || "已深度思考") : (t("chat.markdown.thinkingTitle") || "思考过程")}</span>
        </span>
        <span
          aria-hidden="true"
          className="text-xs text-muted-foreground transition-transform group-open:rotate-180"
        >
          ▼
        </span>
      </summary>
      <ThoughtBox thought={thought} autoScroll={streaming && !hasBody} />
    </details>
  );
}

/**
 * 「只输出了思考过程、没有正文」的兜底说明。
 */
function EmptyAnswerNote() {
  const { t } = useI18n();
  return (
    <div className="px-1 py-1 text-xs italic text-muted-foreground/75">
      {t("chat.markdown.emptyAnswer")}
    </div>
  );
}

export function renderMessageBody(
  content: string,
  isStreaming = false,
  onImageClick?: ImageClickHandler
) {
  if (!content) return null;

  const components = getMessageComponents(onImageClick);

  if (content.includes("<think>")) {
    const thinkEndIndex = content.lastIndexOf("</think>");
    let thought = "";
    let mainContent = "";

    if (thinkEndIndex !== -1) {
      const thinkMatches = Array.from(content.matchAll(/<think>([\s\S]*?)<\/think>/gi));
      if (thinkMatches.length > 0) {
        thought = thinkMatches.map((m) => m[1].trim()).filter(Boolean).join(" ");
        mainContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      } else {
        thought = content.substring(content.indexOf("<think>") + 7, thinkEndIndex).trim();
        mainContent = content.substring(thinkEndIndex + 8).trim();
      }
    } else {
      thought = content.substring(content.indexOf("<think>") + 7).trim();
      mainContent = "";
    }

    const displayMainContent = sanitizeDisplayContent(mainContent);
    const hasBody = !!displayMainContent;

    return (
      <div className="space-y-2.5">
        {thought && (
          <ThinkingBlock thought={thought} streaming={isStreaming} hasBody={hasBody} />
        )}
        {hasBody ? (
          <div className="max-w-none break-words leading-relaxed [overflow-wrap:anywhere]">
            <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
              {displayMainContent}
            </ReactMarkdown>
          </div>
        ) : !isStreaming ? (
          <EmptyAnswerNote />
        ) : null}
      </div>
    );
  }

  const cleanFallbackContent = sanitizeDisplayContent(content);

  return (
    <div className="max-w-none break-words leading-relaxed [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {cleanFallbackContent}
      </ReactMarkdown>
    </div>
  );
}

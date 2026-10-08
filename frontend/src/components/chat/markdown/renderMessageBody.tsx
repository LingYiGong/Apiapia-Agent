"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain } from "lucide-react";
import { CodeBlock } from "@/components/chat/markdown/CodeBlock";

/**
 * 助手消息正文的 markdown 渲染。
 *
 * 从 ChatMessageItem 拆出。文件里保留了三条此前被详细注释过的性能/正确性决策，
 * 它们很容易在重构时被「顺手改掉」，所以原注释一并带过来了：
 *   1. remarkPlugins 与 components 必须是模块级常量 —— 每次渲染新建数组/对象
 *      会让 react-markdown 认为配置变了，从而整段重新解析。流式输出时
 *      这个函数每秒被调用 50 次，等于每秒全量重解析 50 次。
 *   2. components 表按 onImageClick 引用缓存（见 getMessageComponents）。
 *   3. 错误消息的判定用后端下发的 finish_reason，不靠嗅探内容字符串。
 */

export type ImageClickHandler = (src: string, alt?: string) => void;

/** 剥掉模型泄漏的内部痕迹（工具调用容器、ReAct 轨迹、安全分类器输出等）。 */
export function sanitizeDisplayContent(raw: string): string {
  if (!raw) return "";
  return (
    raw
      // 1. 裸的工具/函数调用容器与悬空的参数标签
      .replace(/<\/?(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)[\s\S]*?(?:<\/(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)>|$)/gi, "")
      .replace(/<\/?(?:arg_key|arg_value|parameter|parameters|arguments)[\s\S]*?>/gi, "")
      .replace(/\[(?:ACTION|SEARCH|TOOL|CALL|OBSERVATION):\s*[^\]]+\]/gi, "")
      // 2. ReAct 残留
      .replace(/\n\s*(?:Action|Action Input|Observation):\s*[\s\S]*?(?=\n\s*(?:Thought|Final Answer)|$)/gi, "")
      // 3. 护栏/内容审核分类器的输出
      .replace(/(?:Thus (?:both|all) are safe|We must output exactly that format|Safety Assessment:|Content Moderation:)[\s\S]*/gi, "")
      .replace(/(?:(?:User|Input|Prompt|Response|Output|Assistant)\s*(?:Safety|Moderation|Guard|Risk|Category|Harm)\s*[:=]\s*\w+[\s\n\r]*)+/gi, "")
      // 4. 幻觉出的多余轮次（结尾的 User:/Human:）
      .replace(/\n+\s*(?:(?:User|Human|System)\s*:[^\n]+[\s\n\r]*)+$/gi, "")
      // 5. 遗留的内部草稿/反思标签
      .replace(/<\/?(?:scratchpad|internal|reflection|antThinking)>/gi, "")
      .trim()
  );
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
 * remark 插件表必须是模块级常量：写成 `remarkPlugins={[remarkGfm]}` 会在每次渲染
 * 产生新数组引用，和 components 一样让 react-markdown 认为配置变了从而重解析。
 */
const remarkPlugins = [remarkGfm];

/**
 * markdown 排版基准：Apple iOS Body = 17pt / 22pt leading（tracking -0.43px）。
 * 移动端取 16px（网页最小可读字号，同时也是 iOS 输入框防缩放阈值），
 * 桌面端升到 17px 与 Apple Body 对齐。leading 用 1.62 而非 Apple 的
 * 22/17 = 1.294 —— 那个比值是给 SF 拉丁字形调的，中文方块字需要更松
 * 的行距才不显拥挤。
 */
const BODY_TEXT = "text-base sm:text-body leading-[1.62] text-foreground/95";

const baseMarkdownComponents: Record<string, any> = {
  img: ({ node, ...props }: any) => (
    <img
      {...props}
      alt={props.alt || "image"}
      className="my-2 max-h-80 max-w-full rounded-xl border border-border/80 object-contain shadow-sm"
    />
  ),
  a: ({ node, ...props }: any) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all font-medium text-primary underline underline-offset-2 hover:opacity-80 [overflow-wrap:anywhere]"
    />
  ),
  p: ({ node, children, ...props }: any) => (
    <p
      {...props}
      className={`my-2 break-words ${BODY_TEXT} [overflow-wrap:anywhere]`}
    >
      {renderWithBreaks(children)}
    </p>
  ),
  h1: ({ node, ...props }: any) => (
    <h1 {...props} className="mb-2.5 mt-5 text-xl font-bold text-foreground sm:text-2xl" />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 {...props} className="mb-2 mt-4 text-body font-bold text-foreground sm:text-lg" />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 {...props} className="mb-1 mt-3 text-subhead font-semibold text-foreground sm:text-base" />
  ),
  /* h4–h6 此前未覆盖，走浏览器 UA 默认的 `1em bold`，导致标题层级在 h3
     之后突然与正文同号、同粗细，层级断掉。这里按 Apple 的 Footnote 13pt
     起逐级递降。 */
  h4: ({ node, ...props }: any) => (
    <h4 {...props} className="mb-1 mt-3 text-footnote font-semibold text-foreground" />
  ),
  h5: ({ node, ...props }: any) => (
    <h5 {...props} className="mb-1 mt-2 text-footnote font-semibold text-foreground/90" />
  ),
  h6: ({ node, ...props }: any) => (
    <h6
      {...props}
      className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
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
      className="whitespace-nowrap border-b border-border/70 bg-surface-3/60 px-3.5 py-2.5 text-left text-footnote font-semibold text-foreground"
    >
      {renderWithBreaks(children)}
    </th>
  ),
  td: ({ node, children, ...props }: any) => (
    <td
      {...props}
      className="whitespace-nowrap border-b border-border/50 px-3.5 py-2.5 align-top text-footnote text-foreground/90 sm:text-sm"
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
          className="break-all rounded-md bg-surface-3/80 px-1.5 py-0.5 font-mono text-footnote text-primary [overflow-wrap:anywhere]"
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
 *
 * 此前 renderMessageBody 每次调用都 `{ ...markdownComponents, img: ... }` 造一个新
 * 对象，于是 react-markdown 收到的 `components` prop 每次渲染都是新引用 —— 它会认为
 * 渲染配置变了，从而**把整段 markdown 重新解析一遍**。流式输出时这个函数每秒被
 * 调用 50 次（打字机 20ms 一跳），等于每秒全量重解析 50 次，长回答时明显卡顿。
 *
 * 调用方（ChatArea / ChatMessageItem）已把回调固化为 useCallback，引用稳定，
 * 缓存恒定命中。
 */
let cachedImageClick: ImageClickHandler | undefined;
let cachedComponents: Record<string, any> | undefined;

function getMessageComponents(onImageClick?: ImageClickHandler) {
  if (cachedComponents && cachedImageClick === onImageClick) return cachedComponents;
  cachedImageClick = onImageClick;
  cachedComponents = {
    ...baseMarkdownComponents,
    img: ({ node, ...props }: any) => (
      <img
        {...props}
        alt={props.alt || "image"}
        onClick={() => props.src && onImageClick?.(props.src, props.alt)}
        title="点击放大查看原图"
        className="my-2 max-h-80 max-w-full cursor-zoom-in rounded-xl border border-border/80 object-contain shadow-sm transition-opacity hover:opacity-95"
      />
    ),
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
  return (
    <details
      open={!hasBody || streaming}
      className="group min-w-0 max-w-full overflow-hidden rounded-xl border border-border/70 bg-surface-3/40 p-2.5 text-xs transition-all"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between font-medium text-primary">
        <span className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 animate-pulse text-primary" />
          <span>思考过程</span>
        </span>
        <span
          aria-hidden="true"
          className="text-2xs text-muted-foreground transition-transform group-open:rotate-180"
        >
          ▼
        </span>
      </summary>
      <ThoughtBox thought={thought} autoScroll={streaming && !hasBody} />
    </details>
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
            <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
              {displayMainContent}
            </ReactMarkdown>
          </div>
        ) : !isStreaming ? (
          <div className="px-1 py-1 text-xs italic text-muted-foreground/75">
            （模型仅输出了思考过程，未生成正式正文。这通常是因为该问题推理链较长耗尽了单次最大
            Token 截断限制，或上游服务提前中断。）
          </div>
        ) : null}
      </div>
    );
  }

  const cleanFallbackContent = sanitizeDisplayContent(content);

  return (
    <div className="max-w-none break-words leading-relaxed [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {cleanFallbackContent}
      </ReactMarkdown>
    </div>
  );
}

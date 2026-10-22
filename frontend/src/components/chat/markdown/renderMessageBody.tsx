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

/** 把模型可能输出的标准 LaTeX 环境与分界符转换为 remark-math / KaTeX 兼容的格式，并处理粘连格式 */
export function normalizeMathDelimiters(text: string): string {
  if (!text) return "";

  let normalized = text;

  // 1. 将标准 LaTeX 块级公式 \[ ... \] 转换为 $$ ... $$
  normalized = normalized.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);

  // 2. 将行内 LaTeX \( ... \) 转换为 $ ... $
  normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // 3. 将裸露的 \begin{equation*?} ... \end{equation*?} 转换为 $$ ... $$
  normalized = normalized.replace(
    /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g,
    (_, math) => `\n$$\n${math.trim()}\n$$\n`
  );

  // 4. 将裸露的 \begin{align*?} ... \end{align*?} 规范化并包裹为 $$ \begin{aligned} ... \end{aligned} $$
  normalized = normalized.replace(
    /\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g,
    (_, math) => `\n$$\n\\begin{aligned}\n${math.trim()}\n\\end{aligned}\n$$\n`
  );

  // 5. 分离可能与公式 $$ 粘连在同一行的 markdown 标题（如 "$$ #### 标题" 或 "### 标题 $$"）
  normalized = normalized
    .replace(/(\$\$)\s*(#{1,6}\s)/g, "$1\n\n$2")
    .replace(/(#{1,6}[^\n]*?)\s*(\$\$)/g, "$1\n\n$2");

  // 6. 自动增强包含对齐符 & 或换行符 \\ 的行间公式：
  // 若未显式包含 aligned/matrix/cases 等环境，自动包裹 \begin{aligned} ... \end{aligned}，
  // 彻底避免 KaTeX 报错 "KaTeX parse error: & is only permitted within an aligned environment"
  normalized = normalized.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    const trimmed = math.trim();
    if (!trimmed) return match;
    if (
      (/&|\\\\/.test(trimmed)) &&
      !/\\begin\{(?:aligned|matrix|bmatrix|pmatrix|vmatrix|Vmatrix|cases|array|split)\}/.test(trimmed)
    ) {
      return `\n$$\n\\begin{aligned}\n${trimmed}\n\\end{aligned}\n$$\n`;
    }
    return `\n$$\n${trimmed}\n$$\n`;
  });

  return normalized;
}

/**
 * 自动识别并格式化模型未包裹在代码块中的学术 LaTeX 文档语法：
 * 1. \begin{algorithm} ... \end{algorithm} 自动包裹为 ```latex 代码块
 * 2. 连续的 \usepackage, \DeclareMathOperator, \documentclass 自动包裹为 ```latex 代码块
 * 3. \begin{theorem|lemma|corollary|definition} 转换为标准 Markdown 引用卡片
 * 4. \begin{proof} 转换为优雅的证明引用块
 * 5. \newtheorem 声明自动清理
 */
export function autoFormatUnfencedLatex(text: string): string {
  if (!text) return "";

  let formatted = text;

  // 1. 将未加代码块围栏的算法伪代码环境（\begin{algorithm} ... \end{algorithm}）自动包裹为 LaTeX 代码块
  formatted = formatted.replace(
    /(\\begin\{algorithm\*?\}(?:\[[^\]]*\])?[\s\S]*?\\end\{algorithm\*?\})/gi,
    "\n\n```latex\n$1\n```\n\n"
  );

  // 2. 将定理/引理/推论/定义环境转换为美观的 Markdown 引用卡片
  formatted = formatted
    .replace(
      /\\begin\{(theorem|lemma|corollary|definition|proposition)\}(?:\[([^\]]+)\])?([\s\S]*?)\\end\{\1\}/gi,
      (_, type, title, body) => {
        const typeNames: Record<string, string> = {
          theorem: "定理",
          lemma: "引理",
          corollary: "推论",
          definition: "定义",
          proposition: "命题",
        };
        const label = typeNames[type.toLowerCase()] || type;
        const header = title ? `**${label}（${title.trim()}）**` : `**${label}**`;
        const lines = body.trim().split("\n").map((line: string) => `> ${line}`);
        return `\n\n> ${header}\n${lines.join("\n")}\n\n`;
      }
    )
    .replace(
      /\\begin\{proof\}(?:\[([^\]]+)\])?([\s\S]*?)\\end\{proof\}/gi,
      (_, title, body) => {
        const header = title ? `*证明（${title.trim()}）*：` : `*证明*：`;
        const lines = body.trim().split("\n").map((line: string) => `> ${line}`);
        return `\n\n> ${header}\n${lines.join("\n")} ∎\n\n`;
      }
    );

  // 3. 清理已转换定理环境残留的 \newtheorem 声明
  formatted = formatted.replace(
    /\\newtheorem\*?\{[^\}]+\}(?:\[[^\]]+\])?\{[^\}]+\}(?:\[[^\]]+\])?/gi,
    ""
  );

  // 4. 将裸露的导言区指令（\usepackage, \DeclareMathOperator, \documentclass）成块包裹为代码块
  formatted = formatted.replace(
    /((?:(?:\\(?:usepackage|DeclareMathOperator\*?|documentclass)\b[^\n]*|%[^\n]*)\s*\n*)+)/gi,
    (match) => {
      const trimmed = match.trim();
      if (!trimmed || (trimmed.startsWith("%") && !trimmed.includes("\\"))) return match;
      return `\n\n\`\`\`latex\n${trimmed}\n\`\`\`\n\n`;
    }
  );

  return formatted;
}

/** 剥掉模型泄漏的内部痕迹（工具调用容器、ReAct 轨迹、安全分类器输出等），保护代码块并归一化公式。 */
export function sanitizeDisplayContent(raw: string): string {
  if (!raw) return "";

  // 0. 隔离保护 markdown 围栏代码块（``` 与 ~~~）、未闭合流式代码块以及行内代码（`...`），防止代码内部的内容被正则误伤
  const codeBlocks: string[] = [];
  const protectedText = raw.replace(
    /(```[\s\S]*?```|~~~[\s\S]*?~~~|```[^\n]*(?:\n[\s\S]*)?$|~~~[^\n]*(?:\n[\s\S]*)?$|`[^`\n]+`)/g,
    (match) => {
      codeBlocks.push(match);
      return `__APIAPIA_CODE_BLOCK_${codeBlocks.length - 1}__`;
    }
  );

  // 1. 对正文中遗漏了代码块围栏的学术 LaTeX 文档语法进行自动排版与代码块封装
  const autoFormattedText = autoFormatUnfencedLatex(protectedText);

  // 2. 标准化数学公式分界符 \[...\] -> $$...$$, \(...\) -> $...$ 以及对齐环境容错
  let cleaned = normalizeMathDelimiters(autoFormattedText)
    // 2. 裸的工具/函数调用容器与悬空的参数标签（增加词边界 \b，避免误伤 callback, caller 等正常变量名）
    .replace(/<\/?(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)\b[\s\S]*?(?:<\/(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)>)/gi, "")
    .replace(/<\|(?:tool(?:_call|_calls)?_start|action_start|plugin_start)\|?>[\s\S]*?(?:<\|(?:tool(?:_call|_calls)?_end|action_end|plugin_end)\|?>)/gi, "")
    .replace(/<\/?(?:arg_key|arg_value|parameter|parameters|arguments)[\s\S]*?>/gi, "")
    .replace(/\[(?:ACTION|SEARCH|TOOL|CALL|OBSERVATION|google|search):\s*[^\]]+\]/gi, "")
    .replace(/\[(?:google|search)\([^\]]*\)\]/gi, "")
    // 3. ReAct 残留（精确定位 Agent 工具调用，避免误删科学文章中包含 Action/Observation 的段落）
    .replace(/\n\s*Action:\s*[\w_]+(?:\s*\n\s*Action Input:\s*\{[\s\S]*?\})?(?:\s*\n\s*Observation:\s*[\s\S]*?(?=\n\s*(?:Thought|Final Answer|Action):|$))?/gi, "")
    // 4. 护栏/内容审核分类器的输出
    .replace(/(?:Thus (?:both|all) are safe|We must output exactly that format|Safety Assessment:|Content Moderation:)[\s\S]*/gi, "")
    .replace(/(?:(?:User|Input|Prompt|Response|Output|Assistant)\s*(?:Safety|Moderation|Guard|Risk|Category|Harm)\s*[:=]\s*\w+[\s\n\r]*)+/gi, "")
    // 5. 幻觉出的多余轮次（结尾的 User:/Human:）
    .replace(/\n+\s*(?:(?:User|Human|System)\s*:[^\n]+[\s\n\r]*)+$/gi, "")
    // 6. 遗留的内部草稿/反思标签
    .replace(/<\/?(?:scratchpad|internal|reflection|antThinking)>/gi, "");

  // 7. 还原受保护的代码块
  // 注意：绝对不能直接使用 cleaned.replace(placeholder, codeBlocks[i])！
  // 因为 JS 的 String.prototype.replace 会把 replacement 里的 "$'"（后随文本）、"$$"（转义为$）等特殊替换符号求值，
  // 导致包含 '$' 的代码（如 MathJax/KaTeX 配置、正则、LaTeX 公式）发生全文递归嵌套与占位符泄漏。
  // 使用 split(placeholder).join(block) 保证 100% 字面无害精确替换。
  for (let i = 0; i < codeBlocks.length; i++) {
    const placeholder = `__APIAPIA_CODE_BLOCK_${i}__`;
    cleaned = cleaned.split(placeholder).join(codeBlocks[i]);
  }

  // 兼容旧版遗留的占位符格式
  for (let i = 0; i < codeBlocks.length; i++) {
    const oldPlaceholder = `__CODE_BLOCK_PLACEHOLDER_${i}__`;
    if (cleaned.includes(oldPlaceholder)) {
      cleaned = cleaned.split(oldPlaceholder).join(codeBlocks[i]);
    }
  }

  // 清除任何历史数据遗留、无法还原的孤立占位符，避免在前端暴露占位符字符串
  cleaned = cleaned.replace(/__(?:CODE_BLOCK_PLACEHOLDER|APIAPIA_CODE_BLOCK)_\d+__/g, "");

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
const rehypePlugins: any[] = [
  [
    rehypeKatex,
    {
      output: "htmlAndMathml",
      throwOnError: false,
      strict: false,
    },
  ],
];

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
      className="border-b border-border/50 px-3.5 py-2.5 align-top text-xs text-foreground/90 sm:text-sm min-w-[100px] max-w-xl whitespace-normal break-words sm:whitespace-pre-wrap [overflow-wrap:anywhere]"
    >
      {renderWithBreaks(children)}
    </td>
  ),
  // 交回给 CodeBlock 自己画外壳
  pre: ({ children }: any) => <>{children}</>,
  code: ({ node, inline, className, children, ...props }: any) => {
    const isMultiline = typeof children === "string" ? children.includes("\n") : Array.isArray(children) && children.length > 1;
    const isInline = inline ?? (!className && !isMultiline);
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
  const [userToggled, setUserToggled] = React.useState<boolean | null>(null);
  const isOpen = userToggled !== null ? userToggled : !hasBody;

  return (
    <details
      open={isOpen}
      onToggle={(e) => {
        const target = e.currentTarget as HTMLDetailsElement;
        setUserToggled(target.open);
      }}
      className={cn(
        "group min-w-0 max-w-full overflow-hidden rounded-2xl border transition-all",
        isOpen
          ? "border-border/80 bg-surface-3/30 p-3 shadow-2xs"
          : "border-border/50 bg-surface-2/50 px-3 py-1.5 hover:bg-surface-3/60 cursor-pointer"
      )}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between text-xs font-medium text-muted-foreground transition-colors hover:text-foreground list-none">
        <span className="flex items-center gap-2">
          <Brain
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-colors",
              !hasBody && streaming ? "text-primary animate-pulse" : "text-muted-foreground"
            )}
          />
          <span className="font-medium tracking-tight">
            {hasBody
              ? (t("chat.markdown.thoughtFinished") || "已深度思考")
              : (t("chat.markdown.thinkingTitle") || "思考过程...")}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="ml-2 text-[10px] text-muted-foreground/70 transition-transform duration-200 group-open:rotate-180"
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

"use client";

import * as React from "react";
import { Check, Copy, Download, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useClipboard } from "@/hooks/useClipboard";
import { downloadAttachment } from "@/lib/fileUpload";
import { WordCard, parseWordData } from "./WordCard";

/**
 * 代码块 / SVG 矢量画作 的渲染。
 */

/** 触发浏览器下载一段内存中的文本（SVG 源码等）。 */
export function downloadTextFile(filename: string, text: string, mime: string) {
  downloadAttachment({ name: filename, text, mime_type: mime });
}

/**
 * 推断 SVG 的宽高比，让沙箱 iframe 精确贴合原图尺寸而不产生上下黑边。
 * 优先读 viewBox（现代导出几乎都有），退回 width/height 属性。
 */
function getSvgAspectRatio(svg: string): number | undefined {
  const viewBox = svg.match(
    /<svg[^>]*\bviewBox\s*=\s*["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)/i
  );
  if (viewBox) {
    const w = parseFloat(viewBox[1]);
    const h = parseFloat(viewBox[2]);
    if (w > 0 && h > 0) return w / h;
  }
  const wAttr = svg.match(/<svg[^>]*\bwidth\s*=\s*["']?\s*([\d.]+)/i);
  const hAttr = svg.match(/<svg[^>]*\bheight\s*=\s*["']?\s*([\d.]+)/i);
  if (wAttr && hAttr) {
    const w = parseFloat(wAttr[1]);
    const h = parseFloat(hAttr[1]);
    if (w > 0 && h > 0) return w / h;
  }
  return undefined;
}

export function SvgRenderer({ svgCode }: { svgCode: string }) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = React.useState<"preview" | "code">("preview");
  const { copied, copy } = useClipboard();

  /**
   * 预览走 `sandbox=""` 的 iframe 渲染，而不是 dangerouslySetInnerHTML。
   * SVG 来源是**模型输出**，而模型会原样回显用户粘贴的内容，等于把外部
   * 文本直接插进页面。只剥掉 `<script>` 是不够的：`<img onerror>`、`<svg onload>`、
   * `<foreignObject><iframe src="javascript:...">`、`xlink:href="javascript:"` 全部可执行。
   * 空 sandbox 给予 iframe 一个独立的不透明源：脚本、表单、弹窗全被禁用，
   * SVG 只能当静态图像渲染，这才是真正的隔离边界（正则剥 script 只是纵深防御）。
   */
  const svgSrcDoc = React.useMemo(() => {
    const stripped = svgCode.replace(/<\/?script[\s\S]*?>/gi, "");
    return [
      '<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
      "html,body{margin:0;padding:0;height:100%;background:transparent;overflow:hidden}",
      "body{display:flex;align-items:center;justify-content:center}",
      "svg{max-width:100%;max-height:100%;width:auto;height:auto;",
      "filter:drop-shadow(0 1px 2px rgb(0 0 0 / 0.15))}",
      `</style></head><body>${stripped}</body></html>`,
    ].join("");
  }, [svgCode]);

  const aspectRatio = React.useMemo(() => getSvgAspectRatio(svgCode), [svgCode]);

  const modeButton = (mode: "preview" | "code", label: string) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      aria-pressed={viewMode === mode}
      className={cn(
        "rounded-md px-2 py-0.5 transition-colors",
        viewMode === mode
          ? "bg-primary font-medium text-primary-foreground shadow-2xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-surface-3/60 px-3.5 py-2 text-xs select-none">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Palette className="h-3.5 w-3.5 text-primary" />
          <span>{t("chat.markdown.svgTitle")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-border/60 bg-background/80 p-0.5 text-xs">
            {modeButton("preview", t("chat.markdown.svgPreviewToggle"))}
            {modeButton("code", t("chat.markdown.svgCodeToggle"))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copy(svgCode)}
            className="h-7 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span>{copied ? t("chat.message.copied") : t("chat.message.copy")}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => downloadTextFile(`vector-artwork-${Date.now()}.svg`, svgCode, "image/svg+xml;charset=utf-8")}
            className="h-7 gap-1 rounded-lg bg-primary/10 px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Download className="h-4 w-4" />
            <span>{t("chat.markdown.downloadSvg")}</span>
          </Button>
        </div>
      </div>

      {viewMode === "preview" ? (
        <div className="flex min-h-[220px] items-center justify-center overflow-hidden bg-surface-3/20 p-4 sm:p-6">
          <iframe
            title={t("chat.markdown.svgPreview")}
            sandbox=""
            srcDoc={svgSrcDoc}
            style={aspectRatio ? { aspectRatio } : undefined}
            className={cn(
              "w-full max-w-full max-h-[460px] border-0 bg-transparent",
              !aspectRatio && "h-[220px] sm:h-[380px]"
            )}
          />
        </div>
      ) : (
        <div className="overflow-x-auto bg-code p-4 font-mono text-xs sm:text-sm leading-[1.65] text-code-foreground">
          <code className="block whitespace-pre font-mono">{svgCode}</code>
        </div>
      )}
    </div>
  );
}

class WordCardSafe extends React.Component<
  { rawContent: string },
  { hasError: boolean }
> {
  constructor(props: { rawContent: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.error("WordCard render exception caught:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <pre className="my-3 overflow-x-auto rounded-xl border border-border/70 bg-code p-3 font-mono text-xs text-muted-foreground">
          {this.props.rawContent}
        </pre>
      );
    }
    return <WordCard rawContent={this.props.rawContent} />;
  }
}

/**
 * 现代化轻量语法着色函数（零依赖、无额外体积、流式响应无卡顿）
 * 覆盖关键字、字符串、数字、注释、函数名、布尔值与常用类型
 */
function highlightSyntax(code: string, lang: string): React.ReactNode {
  if (!code) return null;
  const l = (lang || "").toLowerCase();
  if (!l || ["text", "txt", "plain", "plaintext", "raw"].includes(l)) {
    return code;
  }

  const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|<!--[\s\S]*?-->|--[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|import|from|export|as|class|extends|implements|interface|type|new|this|super|try|catch|finally|throw|async|await|yield|def|elif|lambda|pass|with|in|is|not|and|or|struct|enum|pub|fn|mut|impl|trait|select|insert|update|delete|where|group|by|order|limit|join|left|right|inner|outer|create|table|drop|alter)\b)|(\b(?:true|false|null|undefined|None|True|False|nil)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b[A-Z][a-zA-Z0-9_$]*\b)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      elements.push(code.slice(lastIndex, match.index));
    }

    const [full, comment, str, kw, boolVal, num, funcName, typeName] = match;
    const key = `${match.index}-${full.slice(0, 5)}`;

    if (comment) {
      elements.push(<span key={key} className="text-slate-400 dark:text-slate-500 italic">{comment}</span>);
    } else if (str) {
      elements.push(<span key={key} className="text-emerald-400 dark:text-emerald-300">{str}</span>);
    } else if (kw) {
      elements.push(<span key={key} className="text-purple-400 dark:text-purple-300 font-medium">{kw}</span>);
    } else if (boolVal) {
      elements.push(<span key={key} className="text-amber-400 dark:text-amber-300">{boolVal}</span>);
    } else if (num) {
      elements.push(<span key={key} className="text-amber-300 dark:text-amber-200">{num}</span>);
    } else if (funcName) {
      elements.push(<span key={key} className="text-sky-400 dark:text-sky-300">{funcName}</span>);
    } else if (typeName) {
      elements.push(<span key={key} className="text-cyan-300 dark:text-cyan-200">{typeName}</span>);
    } else {
      elements.push(full);
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < code.length) {
    elements.push(code.slice(lastIndex));
  }

  return elements;
}

export function CodeBlock({ children, className }: any) {
  const { t } = useI18n();
  const { copied, copy } = useClipboard();
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const codeText =
    typeof children === "string"
      ? children.replace(/\n$/, "")
      : String(children || "").replace(/\n$/, "");

  const isSvg =
    lang === "svg" || (codeText.trim().startsWith("<svg") && codeText.trim().includes("</svg>"));
  if (isSvg) {
    return <SvgRenderer svgCode={codeText} />;
  }

  const normalizedLang = (lang || "").toLowerCase();
  const isWordCardLang = ["word", "wordcard", "vocab", "vocabulary"].includes(normalizedLang);
  if (isWordCardLang) {
    return <WordCardSafe rawContent={codeText} />;
  }

  const isMermaid = lang === "mermaid";

  return (
    <div className="my-3.5 overflow-hidden rounded-2xl border border-border/70 bg-code shadow-xs">
      <div className="flex items-center justify-between border-b border-border/40 bg-code-header px-4 py-2 text-xs text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium uppercase tracking-wide text-slate-300">
            {lang || t("chat.markdown.codeFallback")}
          </span>
          {isMermaid && (
            <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
              {t("chat.markdown.mermaid")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => copy(codeText)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copied ? t("chat.message.copied") : t("chat.message.copy")}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                `code-${Date.now()}.${isMermaid ? "mmd" : lang || "txt"}`,
                codeText,
                "text/plain;charset=utf-8"
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t("chat.markdown.download")}</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-xs sm:text-sm leading-[1.65] text-code-foreground">
        <code className="block whitespace-pre font-mono">
          {highlightSyntax(codeText, lang)}
        </code>
      </div>
    </div>
  );
}


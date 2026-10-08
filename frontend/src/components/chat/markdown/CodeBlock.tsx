"use client";

import * as React from "react";
import { Check, Copy, Download, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 代码块 / SVG 矢量画作 的渲染。
 *
 * 从 ChatMessageItem 中拆出：该文件 1199 行，其中 markdown 相关（SvgRenderer、
 * AiImageCard、CodeBlock、markdownComponents、renderMessageBody、parseUserMessage）
 * 占了约 600 行，与「一条消息气泡长什么样」是两件事。
 */

/** 把纯文本写进剪贴板，并把按钮切成「已复制」2 秒。 */
export function useCopyFeedback(duration = 2000) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = React.useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), duration);
    },
    [duration]
  );

  return { copied, copy };
}

/** 触发浏览器下载一段内存中的文本（SVG 源码等）。 */
export function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const [viewMode, setViewMode] = React.useState<"preview" | "code">("preview");
  const { copied, copy } = useCopyFeedback();

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
          <span>SVG 矢量画作</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-border/60 bg-background/80 p-0.5 text-2xs">
            {modeButton("preview", "预览图形")}
            {modeButton("code", "查看代码")}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copy(svgCode)}
            className="h-7 gap-1 rounded-lg px-2 text-2xs text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span>{copied ? "已复制" : "复制"}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => downloadTextFile(`vector-artwork-${Date.now()}.svg`, svgCode, "image/svg+xml;charset=utf-8")}
            className="h-7 gap-1 rounded-lg bg-primary/10 px-2 text-2xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Download className="h-3 w-3" />
            <span>下载 SVG</span>
          </Button>
        </div>
      </div>

      {viewMode === "preview" ? (
        <div className="flex min-h-[220px] items-center justify-center overflow-hidden bg-surface-3/20 p-4 sm:p-6">
          <iframe
            title="SVG 矢量画作预览"
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
        <div className="overflow-x-auto bg-[#0d0d0d] p-4 font-mono text-footnote leading-[1.65] text-[#ececec]">
          <code>{svgCode}</code>
        </div>
      )}
    </div>
  );
}

export function CodeBlock({ children, className }: any) {
  const { copied, copy } = useCopyFeedback();
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

  const isMermaid = lang === "mermaid";

  return (
    <div className="my-3.5 overflow-hidden rounded-2xl border border-border/70 bg-[#0d0d0d] shadow-xs">
      <div className="flex items-center justify-between border-b border-white/5 bg-[#1f1f23] px-4 py-2 text-xs text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs font-medium uppercase tracking-wide text-slate-300">
            {lang || "code"}
          </span>
          {isMermaid && (
            <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-2xs font-medium text-primary">
              架构图
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => copy(codeText)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-2xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copied ? "已复制" : "复制"}</span>
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
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-2xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            <span>下载</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-footnote leading-[1.65] text-[#ececec]">
        <code>{children}</code>
      </div>
    </div>
  );
}


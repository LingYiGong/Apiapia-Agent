/**
 * 附件上传及图像压缩工具函数与预算常量。
 * 与后端 `backend/app/schemas/chat.py` 及 `main.py` 的大小校验保持对齐。
 */

/** 单条会话最大允许选择的附件数量 */
export const MAX_ATTACHMENTS = 10;

/** 单个非图片文件上限 (20MB) */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/** 一次发送的附件总量上限 (40MB) */
export const MAX_TOTAL_ATTACHMENT_BYTES = 40 * 1024 * 1024;

/**
 * 将图片等比缩放到指定最大长宽限制内（默认 1920px），并以较低体积的 JPEG/PNG 导出 DataURL。
 */
export const compressImage = (file: File, maxDim = 1920, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve((e.target?.result as string) || "");
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(outputType, quality));
      };
      img.onerror = () => resolve((e.target?.result as string) || "");
      img.src = (e.target?.result as string) || "";
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
};

/**
 * 以 DataURL (base64) 形式异步读取文件。
 */
export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
};

export type FileCategory = "image" | "pdf" | "code" | "text" | "word" | "data" | "other";

export function getFileCategory(filename: string, mimeType?: string): FileCategory {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }
  if (
    ["py", "js", "ts", "tsx", "jsx", "html", "css", "sql", "sh", "java", "cpp", "c", "rs", "go", "php"].includes(ext) ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("html") ||
    mime.includes("css")
  ) {
    return "code";
  }
  if (["json", "csv", "xml", "yaml", "yml"].includes(ext) || mime.includes("json") || mime.includes("csv")) {
    return "data";
  }
  if (["txt", "md", "log", "env", "ini"].includes(ext) || mime.startsWith("text/")) {
    return "text";
  }
  if (["doc", "docx"].includes(ext) || mime.includes("word") || mime.includes("officedocument")) {
    return "word";
  }
  return "other";
}

/**
 * 将 Base64 Data URL 解码为 UTF-8 文本内容
 */
export function decodeDataUrlText(dataUrl: string): string {
  if (!dataUrl) return "";
  try {
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) return dataUrl;
    const meta = dataUrl.slice(0, commaIdx);
    const content = dataUrl.slice(commaIdx + 1);
    if (meta.includes(";base64")) {
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder("utf-8").decode(bytes);
    }
    return decodeURIComponent(content);
  } catch (err) {
    console.error("Failed to decode data URL text:", err);
    return "";
  }
}

/**
 * 触发浏览器直接下载附件（支持 Base64 DataURL、Blob URL 或纯文本内容）
 */
export function downloadAttachment(file: {
  name: string;
  data_url?: string;
  text?: string;
  mime_type?: string;
}) {
  if (!file) return;
  const filename = file.name || "download";

  if (file.data_url) {
    const a = document.createElement("a");
    a.href = file.data_url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  if (file.text) {
    const mime = file.mime_type || "text/plain;charset=utf-8";
    const blob = new Blob([file.text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
}

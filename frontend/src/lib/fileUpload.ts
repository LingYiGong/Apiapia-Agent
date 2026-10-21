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

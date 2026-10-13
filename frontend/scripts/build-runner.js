const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const isExport =
  process.env.NEXT_EXPORT === "true" ||
  process.env.CF_PAGES === "1" ||
  process.env.CLOUDFLARE === "1" ||
  process.env.CI === "true" ||
  process.argv.includes("--export");

/**
 * 导出模式（Cloudflare Pages / 纯静态）下 app/api 里的 route handler 会被移走，
 * 所以同源代理 `/api/backend` **不存在**。此时浏览器必须直连后端绝对地址，
 * 也就是必须提供 NEXT_PUBLIC_API_URL。
 *
 * 之前这里什么都不检查，于是构建照常成功、部署照常上传，直到用户打开页面
 * 才发现所有接口 404 —— 配置错误要等到运行时才暴露。构建期就报错能省掉
 * 一次「以为部署完了其实全挂了」的排查。
 *
 * 注意 Docker 那条路径（output: standalone）不受影响：那里 app/api 保留，
 * 走同源代理，不需要这个变量。
 */
function resolveExportApiUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL || "";
  if (url.trim()) return url.trim();
  // 显式跳过开关：仅供本地验证产物结构时使用，绝不应出现在 CI/部署环境。
  // 注意跳过时返回空串而不是 null —— 调用方靠它区分「跳过」与「未配置」。
  if (process.argv.includes("--export-allow-missing-api")) return "";
  return null;
}


const projectRoot = path.resolve(__dirname, "..");
const apiDir = path.join(projectRoot, "src", "app", "api");
const apiDisabledDir = path.join(projectRoot, "src", "app", "_api_disabled");

let renamed = false;

try {
  if (isExport) {
    console.log("[Build] Detected Export mode (Cloudflare Pages / Static SSG)");
    const exportApiUrl = resolveExportApiUrl();
    if (exportApiUrl === null) {
      console.error("");
      console.error("  ✗ 导出模式缺少 NEXT_PUBLIC_API_URL");
      console.error("");
      console.error("    导出模式会在构建前移走 src/app/api（route handler），");
      console.error("    因此同源代理 /api/backend 不存在，浏览器必须直连后端。");
      console.error("");
      console.error("    Cloudflare Pages 请在构建环境变量中设置：");
      console.error("      NEXT_PUBLIC_API_URL = https://你的后端域名/api");
      console.error("");
      console.error("    要求：必须以 https 开头，且后端 CORS 放行你的前端域名");
      console.error("          （在后端的 CORS_ORIGINS 或 CORS_ORIGIN_REGEX 中配置）。");
      console.error("");
      console.error("    仅本地验证产物结构时可加 --export-allow-missing-api 跳过检查。");
      console.error("");
      process.exit(1);
    }
    if (exportApiUrl) {
      console.log(`[Build] Browser will call backend directly: ${exportApiUrl}`);
    } else {
      console.warn("[Build] WARNING: NEXT_PUBLIC_API_URL missing (skipped via flag).");
      console.warn("[Build]          产物里的接口调用会 404 —— 仅可用于验证产物结构。");
    }
    if (fs.existsSync(apiDir)) {
      fs.renameSync(apiDir, apiDisabledDir);
      renamed = true;
      console.log("[Build] Temporarily bypassed server-side route handlers in app/api");
    }
    process.env.NEXT_EXPORT = "true";
    process.env.NEXT_PUBLIC_API_URL = exportApiUrl;
  } else {
    console.log("[Build] Detected Standalone mode (Docker / Node.js Server)");
  }

  const result = spawnSync("npx", ["next", "build"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
    // NEXT_PUBLIC_* 必须在 next build 启动**之前**就在环境里 —— Next.js 会在
    // 构建时把它们内联进客户端产物，运行时再设无效。
    env: {
      ...process.env,
      ...(isExport ? { NEXT_EXPORT: "true" } : {}),
    },
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
} finally {
  if (renamed && fs.existsSync(apiDisabledDir)) {
    fs.renameSync(apiDisabledDir, apiDir);
    console.log("[Build] Restored app/api route handlers.");
  }
}

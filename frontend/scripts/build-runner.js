const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const isExport =
  process.env.NEXT_EXPORT === "true" ||
  process.env.CF_PAGES === "1" ||
  process.env.CLOUDFLARE === "1" ||
  process.env.CI === "true" ||
  process.argv.includes("--export");


const projectRoot = path.resolve(__dirname, "..");
const apiDir = path.join(projectRoot, "src", "app", "api");
const apiDisabledDir = path.join(projectRoot, "src", "app", "_api_disabled");

let renamed = false;

try {
  if (isExport) {
    console.log("[Build] Detected Export mode (Cloudflare Pages / Static SSG)");
    if (fs.existsSync(apiDir)) {
      fs.renameSync(apiDir, apiDisabledDir);
      renamed = true;
      console.log("[Build] Temporarily bypassed server-side route handlers in app/api");
    }
    process.env.NEXT_EXPORT = "true";
  } else {
    console.log("[Build] Detected Standalone mode (Docker / Node.js Server)");
  }

  const result = spawnSync("npx", ["next", "build"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...(isExport ? { NEXT_EXPORT: "true" } : {}) },
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

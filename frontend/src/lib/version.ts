export const CURRENT_VERSION = "2.6.0";

export interface VersionInfo {
  version: string;
  buildTime?: string;
  title?: string;
  changelog?: string[];
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  info: VersionInfo | null;
}

/**
 * Compare two semver strings: a > b -> 1, a < b -> -1, a == b -> 0
 */
export function compareVersions(a: string, b: string): number {
  const cleanA = a.replace(/^[vV]/, "").trim();
  const cleanB = b.replace(/^[vV]/, "").trim();

  if (cleanA === cleanB) return 0;

  const partsA = cleanA.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = cleanB.split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] || 0;
    const valB = partsB[i] || 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }
  return 0;
}

/**
 * Fetch latest version metadata from public/version.json with cache busting
 */
export async function checkAppUpdate(): Promise<CheckUpdateResult> {
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    if (!res.ok) {
      return {
        hasUpdate: false,
        currentVersion: CURRENT_VERSION,
        latestVersion: CURRENT_VERSION,
        info: null,
      };
    }

    const data: VersionInfo = await res.json();
    const hasUpdate = compareVersions(data.version, CURRENT_VERSION) > 0;

    return {
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      latestVersion: data.version,
      info: data,
    };
  } catch (err) {
    console.warn("Failed to check for app updates:", err);
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      latestVersion: CURRENT_VERSION,
      info: null,
    };
  }
}

/**
 * Trigger manual update check event across components
 */
export function triggerManualUpdateCheck() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("apiapia_check_update", { detail: { manual: true } }));
  }
}

/**
 * Perform application update:
 * Clears service worker caches if applicable and reloads the window.
 */
export async function performAppUpdate(): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch (e) {
      console.warn("Error clearing cache:", e);
    }
    window.location.reload();
  }
}

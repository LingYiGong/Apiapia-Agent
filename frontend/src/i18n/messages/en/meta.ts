/**
 * App-shell copy: document title, 404, error boundaries, update prompt.
 *
 * `metadata.title` itself stays Chinese in app/layout.tsx — Next.js can only
 * emit metadata at build time on the server, so it cannot follow a locale the
 * client picked after hydration. Everything else in here is dynamic.
 */
export default {
  appName: "Apiapia Assistant",
  entering: "Opening {app}…",
  appDescription: "Apiapia Assistant — a cat assistant with long-term memory",

  notFound: {
    title: "Page not found",
    description: "This address may have been removed, or the link is wrong.",
  },

  routeError: {
    title: "Something went wrong",
    description:
      "This page hit an error. You can retry; if it keeps happening, head back to the chat.",
    digest: "Error ID: {digest}",
  },

  globalError: {
    title: "The app failed to start",
    description:
      "An error occurred during initialisation. Try reloading; if it persists, clear this site's data and retry.",
    reload: "Reload",
  },

  update: {
    availableTitle: "Version {version} is available",
    availableDescription: "Update to get the latest features straight away.",
    currentTitle: "You're up to date",
    currentDescription: "Version {version} is the latest release.",
    changelog: "What's new",
    changelogHint: "See what changed in preferences, or tap here for details",
    dismiss: "Got it",
    later: "Remind me later",
    updateNow: "Update now",
    checking: "Checking for updates…",
    /** Shown when the server sends no changelog, so the panel is never blank. */
    noChangelog: "No changelog was published for this release.",
    cacheWarning: "Updating clears the cached assets and reloads the app. Avoid updating mid-conversation.",
  },
} as const;
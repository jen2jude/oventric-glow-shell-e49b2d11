import { useEffect, useState } from "react";

/**
 * Oventric runs as one codebase with two presentations:
 *
 *  - "browser"  → the marketing/web experience (desktop site, SEO pages)
 *  - "app"      → the native-feeling app shell (installed PWA on a phone,
 *                 or an explicit `?mode=app` preview from the web build)
 *
 * The app shell is activated when the page is running in a standalone
 * window (installed to the home screen) or when the visitor explicitly asked
 * for app mode. The choice sticks for the rest of the browsing session so
 * in-app navigation doesn't bounce back to the website skin.
 */
export type LaunchContext = "browser" | "app";

export const APP_MODE_KEY = "oventric:launch-mode";

/** Keep the unfinished app presentation available only for internal previews. */
export function isAppReviewPreview(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" ||
    host.startsWith("id-preview--") || host.startsWith("preview--") ||
    (host.startsWith("project--") && host.endsWith("-dev.lovable.app")) ||
    host.endsWith(".lovableproject-dev.com");
}

/** True when the page is running in an installed / standalone window. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  } catch {
    /* ignore */
  }
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Lovable editor preview runs inside an iframe — never treat that as installed. */
function inIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Resolve the launch context for this page view (client only). */
export function resolveLaunchContext(): LaunchContext {
  if (typeof window === "undefined") return "browser";
  if (!isAppReviewPreview()) return "browser";

  // 1. Explicit request via the URL wins and is remembered for the session.
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("mode");
  if (requested === "app") {
    try {
      window.sessionStorage.setItem(APP_MODE_KEY, "app");
    } catch {
      /* ignore */
    }
    return "app";
  }
  if (requested === "web") {
    try {
      window.sessionStorage.setItem(APP_MODE_KEY, "browser");
    } catch {
      /* ignore */
    }
    return "browser";
  }

  // 2. Installed to the home screen (and not the editor iframe).
  if (!inIframe() && isStandaloneDisplay()) return "app";

  // 3. Sticky choice from earlier in this session. A stored "browser" pick
  //    from the old preview switch is cleared so the app default wins.
  try {
    const stored = window.sessionStorage.getItem(APP_MODE_KEY);
    if (stored === "app") return "app";
    if (stored === "browser") window.sessionStorage.removeItem(APP_MODE_KEY);
  } catch {
    /* ignore */
  }

  // 4. Preview hosts default to the app shell while we tighten things up;
  //    the public site stays on the browser presentation.
  return "app";
}

/** Null until hydration so server and client markup match. */
export function useLaunchContext(): LaunchContext | null {
  const [ctx, setCtx] = useState<LaunchContext | null>(null);
  useEffect(() => setCtx(resolveLaunchContext()), []);
  return ctx;
}

/** True only once hydrated and running the app shell presentation. */
export function useIsAppShell(): boolean {
  const ctx = useLaunchContext();
  return ctx === "app";
}

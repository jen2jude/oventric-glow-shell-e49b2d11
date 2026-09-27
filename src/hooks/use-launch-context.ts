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

/** Keep the unfinished app presentation off Oventric's public addresses. */
export function isAppReviewPreview(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  const isPublicHost = host === "oventric.com" ||
    host === "www.oventric.com" ||
    host === "oventric-glow-shell.lovable.app";
  return !isPublicHost;
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

  // 1. Review environments are app-only while the app is being tightened.
  // Ignore old URL and session overrides so the Lovable iframe cannot get
  // stuck in the website presentation.
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
// After the first hydration, components that mount later (sheets, popups)
// can read the context immediately. Otherwise their first frame renders the
// website look and flashes before switching to the app look.
let hydratedContext: LaunchContext | null = null;

export function useLaunchContext(): LaunchContext | null {
  const [ctx, setCtx] = useState<LaunchContext | null>(() =>
    hydratedContext ?? (typeof window !== "undefined" ? resolveLaunchContext() : null)
  );
  useEffect(() => {
    const next = resolveLaunchContext();
    hydratedContext = next;
    setCtx(next);
  }, []);
  return ctx;
}

/** True only once hydrated and running the app shell presentation. */
export function useIsAppShell(): boolean {
  const ctx = useLaunchContext();
  return ctx === "app";
}

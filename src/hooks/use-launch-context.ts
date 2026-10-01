import { useEffect, useState } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestHost, getRequestUrl } from "@tanstack/react-start/server";

const PUBLIC_HOSTS = new Set(["oventric.com", "www.oventric.com", "oventric-glow-shell.lovable.app"]);

/** Only the published site defaults to web; Lovable previews default to app. */
function isWebDefaultHost(host: string): boolean {
  return PUBLIC_HOSTS.has(host);
}

/**
 * First-render context, identical on server and client: review hosts render
 * the app shell straight from the server so the website never shows while
 * the preview's scripts are still loading.
 */
const getInitialContext = createIsomorphicFn()
  .server((): LaunchContext => {
    try {
      const host = (getRequestHost({ xForwardedHost: true }) || "").split(":")[0].toLowerCase();
      const requested = getRequestUrl({ xForwardedHost: true }).searchParams.get("mode");
      // Installed launches start at /?mode=app. Honour that on the server so
      // the HTML already contains the app shell instead of briefly painting
      // the public website before hydration.
      if (requested === "app") return "app";
      // Installed app windows carry the ov_app cookie (set by the launch
      // script), so every in-app page is server-rendered as the app.
      const cookie = getRequestHeader("cookie") || "";
      if (requested === "web") return "browser";
      if (/(?:^|;\s*)ov_app=1(?:;|$)/.test(cookie)) return "app";
      // Published site stays web; Lovable previews (including localhost) are app.
      return isWebDefaultHost(host) ? "browser" : "app";
    } catch {
      return "browser";
    }
  })
  .client((): LaunchContext => {
    // Mirror the server decision exactly so hydration never mismatches.
    try {
      const mode = new URLSearchParams(window.location.search).get("mode");
      if (mode === "app") return "app";
      if (mode === "web") return "browser";
      if (/(?:^|;\s*)ov_app=1(?:;|$)/.test(document.cookie)) return "app";
    } catch {
      /* ignore */
    }
    const host = window.location.hostname.toLowerCase();
    return isWebDefaultHost(host) ? "browser" : "app";
  });

/**
 * Oventric runs as one codebase with two presentations:
 *
 *  - "browser"  → the marketing/web experience (desktop site, SEO pages)
 *  - "app"      → the native-feeling app shell (installed PWA on a phone,
  *                 or a Lovable preview)
 *
 * The app shell is activated when the page is running in a standalone
 * window (installed to the home screen) or when the visitor explicitly asked
 * for app mode. The choice sticks for the rest of the browsing session so
 * in-app navigation doesn't bounce back to the website skin.
 */
export type LaunchContext = "browser" | "app";

export const APP_MODE_KEY = "oventric:launch-mode";

/** True for preview and other non-published hosts. */
export function isAppReviewPreview(): boolean {
  if (typeof window === "undefined") return false;
  return !isWebDefaultHost(window.location.hostname.toLowerCase());
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
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("mode");

  // Installed / native windows are ALWAYS the app — nothing (not even
  // ?mode=web or a stray link) may show the website inside the PWA.
  const native = Boolean(
    (window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; isNative?: boolean };
    }).Capacitor?.isNativePlatform?.() ||
      (window as unknown as { Capacitor?: { isNative?: boolean } }).Capacitor?.isNative,
  );
  const installed = !inIframe() && isStandaloneDisplay();
  const remember = (v: LaunchContext) => {
    try {
      window.sessionStorage.setItem(APP_MODE_KEY, v);
    } catch {
      /* ignore */
    }
  };
  if (native || installed) {
    remember("app");
    return "app";
  }

  // Explicit ?mode=web lets browser visitors (and reviewers) see the site.
  if (requested === "web") {
    remember("browser");
    return "browser";
  }

  if (isAppReviewPreview() || requested === "app") {
    remember("app");
    return "app";
  }

  // Keep app mode across hard navigations in the same installed session.
  try {
    const stored = window.sessionStorage.getItem(APP_MODE_KEY);
    if (stored === "app") return "app";
    if (stored === "browser") window.sessionStorage.removeItem(APP_MODE_KEY);
  } catch {
    /* ignore */
  }

  return isWebDefaultHost(window.location.hostname.toLowerCase()) ? "browser" : "app";
}

/** Null until hydration so server and client markup match. */
// After the first hydration, components that mount later (sheets, popups)
// can read the context immediately. Otherwise their first frame renders the
// website look and flashes before switching to the app look.
let hydratedContext: LaunchContext | null = null;

export function useLaunchContext(): LaunchContext | null {
  // The first client render must match SSR. Resolving from `window` here made
  // review previews hydrate website markup as app markup, leaving the website
  // shell behind when React abandoned hydration. The splash covers this brief
  // null state until the effect selects the presentation.
  const [ctx, setCtx] = useState<LaunchContext | null>(() => hydratedContext ?? getInitialContext());
  useEffect(() => {
    const next = resolveLaunchContext();
    hydratedContext = next;
    document.documentElement.classList.toggle("standalone-app", next === "app");
    setCtx(next);
  }, []);
  return ctx;
}

/** True only once hydrated and running the app shell presentation. */
export function useIsAppShell(): boolean {
  const ctx = useLaunchContext();
  return ctx === "app";
}

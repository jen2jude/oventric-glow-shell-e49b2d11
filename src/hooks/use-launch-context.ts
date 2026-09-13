import { useEffect, useLayoutEffect, useState } from "react";

import { isNativeApp } from "@/lib/native/capacitor";

export type LaunchContext = "native" | "standalone" | "browser";

// Resolve the launch context *before* the browser paints the hydrated tree,
// so app-shell users never see a frame of the marketing/browser layout.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * How the app was launched:
 * - "native"      → Capacitor shell (APK / iOS build)
 * - "standalone"  → installed PWA / added to home screen
 * - "browser"     → normal browser tab (desktop or mobile)
 *
 * Returns `null` until after hydration so SSR markup stays stable.
 */
export function useLaunchContext(): LaunchContext | null {
  const [ctx, setCtx] = useState<LaunchContext | null>(null);

  useIsomorphicLayoutEffect(() => {

    const read = (): LaunchContext => {
      // Manual override for testing
      const params = new URLSearchParams(window.location.search);
      const forceMode = params.get("mode");
      if (forceMode === "app") return "native";
      if (forceMode === "web") return "browser";

      if (isNativeApp()) return "native";
      const preboot = (window as unknown as { __oventricStandalone?: boolean })
        .__oventricStandalone;
      const standalone =
        preboot === true ||
        (typeof window.matchMedia === "function" &&
          window.matchMedia("(display-mode: standalone)").matches) ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      return standalone ? "standalone" : "browser";

    };
    const apply = (c: LaunchContext) => {
      setCtx(c);
      // Marker class so global CSS can keep app shells fully dark.
      document.documentElement.classList.toggle(
        "oventric-app",
        c === "native" || c === "standalone",
      );
    };
    apply(read());

    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(display-mode: standalone)");
    const onChange = () => apply(read());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return ctx;
}

/** True for the app-like shells (native build or installed PWA). */
export function useIsAppShell(): boolean {
  const ctx = useLaunchContext();
  // Default to false during hydration so browser visitors see marketing first.
  return ctx === "native" || ctx === "standalone";
}

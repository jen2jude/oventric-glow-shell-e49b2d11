import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import logoFull from "@/assets/oventric-full-transparent.png";

/**
 * Full-screen boot splash: site logo only.
 * Fades once hydration, route data, document load and first idle frame finish.
 */
// Only the very first mount of the session may show the splash — later route
// changes inside the app must never re-trigger it.
let splashConsumed = false;

function isStandaloneLaunch() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    __oventricStandalone?: boolean;
    navigator: Navigator & { standalone?: boolean };
  };
  if (typeof w.__oventricStandalone === "boolean") return w.__oventricStandalone;
  try {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || w.navigator.standalone === true;
    // Mobile only — no splash on desktop or tablet.
    return standalone && window.matchMedia?.("(max-width: 767px)").matches;
  } catch {
    return false;
  }
}

export function BootSplash() {
  // Decide whether to show only after hydration so server and first client
  // render match, avoiding a hydration mismatch.
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  // Track start time for minimum duration.
  const startTime = useRef(Date.now());
  // Eased value that chases the milestone target, so the sweep still looks
  // smooth when several milestones land in the same frame.
  const [shown, setShown] = useState(0);

  // Milestone weights (sum = 1).
  const [hydrated, setHydrated] = useState(false);
  const [docLoaded, setDocLoaded] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const routeLoading = useRouterState({ select: (s) => s.isLoading || s.status === "pending" });

  useEffect(() => {
    // Hand off from the server-rendered pre-hydration splash.
    document.getElementById("oventric-boot")?.remove();
    setHydrated(true);
    if (!splashConsumed && isStandaloneLaunch()) {
      splashConsumed = true;
      setEnabled(true);
    }

    const onLoad = () => setDocLoaded(true);
    if (document.readyState === "complete") setDocLoaded(true);
    else window.addEventListener("load", onLoad, { once: true });

    let idle: number | undefined;
    const markAssets = () => {
      const ric = (window as unknown as { requestIdleCallback?: typeof setTimeout })
        .requestIdleCallback;
      idle = (ric
        ? ric(() => setAssetsReady(true))
        : setTimeout(() => setAssetsReady(true), 120)) as unknown as number;
    };
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts?.ready) fonts.ready.then(markAssets).catch(markAssets);
    else markAssets();

    return () => {
      window.removeEventListener("load", onLoad);
      if (idle) clearTimeout(idle);
    };
  }, []);

  const target =
    (hydrated ? 0.3 : 0.12) +
    (routeLoading ? 0 : 0.28) +
    (docLoaded ? 0.24 : 0) +
    (assetsReady ? 0.18 : 0);

  // Ease `shown` toward `target`; when it reaches 1, fade the splash away.
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    const tick = () => {
      setShown((prev) => {
        // Slow down the progress to feel premium over the 5s window
        const next = prev + (target - prev) * 0.045;
        return next > target - 0.002 ? target : next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target]);

  useEffect(() => {
    // Minimum duration of 5 seconds (5000ms) from mount.
    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, 5000 - elapsed);

    if (target < 1 || shown < 0.985) return;

    const t = setTimeout(() => {
      setFading(true);
      setTimeout(() => setVisible(false), 320);
    }, remaining);
    return () => clearTimeout(t);
  }, [target, shown]);

  if (!enabled || !visible) return null;

  return (
    <div
      aria-hidden
      data-oventric-boot="react"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <img
        src={logoFull}
        alt="Oventric"
        className="h-10 w-auto select-none sm:h-12"
        draggable={false}
      />
    </div>
  );
}

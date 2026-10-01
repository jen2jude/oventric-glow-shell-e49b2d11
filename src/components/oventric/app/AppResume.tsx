import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { readRecentScreen, saveLastScreen } from "@/lib/app-resume";

let resumeChecked = false;

/** Reopens the installed app on the last screen and keeps that screen saved. */
export function AppResume() {
  const isApp = useIsAppShell();
  const router = useRouter();

  useEffect(() => {
    if (!isApp) return;
    if (!resumeChecked) {
      resumeChecked = true;
      const url = new URL(window.location.href);
      const params = [...url.searchParams.keys()].filter((k) => k !== "mode");
      const atLaunch = url.pathname === "/" && params.length === 0;
      const saved = readRecentScreen();
      if (atLaunch && saved && saved !== "/") {
        router.history.replace(saved);
      }
    }
    const save = () => saveLastScreen();
    const onVis = () => document.visibilityState === "hidden" && save();
    const unsub = router.subscribe("onResolved", save);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", save);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", save);
    };
  }, [isApp, router]);

  return null;
}

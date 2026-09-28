import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "oventric:seen-feature-carousel";

function getServerDefault(): boolean {
  return false;
}

/**
 * Detects whether the user is opening Oventric for the very first time on
 * this device. Persists the "seen" flag in localStorage so returning users
 * skip the feature carousel entirely.
 *
 * SSR-safe: returns false during server render / hydration mismatch window,
 * then hydrates from localStorage on mount.
 */
export function useFirstLaunch() {
  const [show, setShow] = useState<boolean>(getServerDefault);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const forcePreview = new URLSearchParams(window.location.search).get("onboarding") === "1";
      if (forcePreview) {
        setShow(true);
        setHydrated(true);
        return;
      }
      const seen = localStorage.getItem(STORAGE_KEY);
      setShow(seen !== "true");
    } catch {
      setShow(true);
    }
    setHydrated(true);
  }, []);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore storage errors (private mode)
    }
    setShow(false);
  }, []);

  return { show, markSeen, hydrated };
}

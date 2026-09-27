import { useEffect, useState } from "react";

const SELECTOR = '[role="dialog"]:not([data-onboarding-popup]), [aria-modal="true"]:not([data-onboarding-popup])';

export function isSheetOpen(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector(SELECTOR);
}

/** True while any sheet/dialog (other than onboarding popups) is on screen. */
export function useSheetOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(isSheetOpen());
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role", "aria-modal", "data-state"] });
    return () => mo.disconnect();
  }, []);
  return open;
}

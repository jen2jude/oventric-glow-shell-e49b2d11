import { useEffect, useState } from "react";
import { X } from "lucide-react";

import cashbackArt from "@/assets/cashback-spotlight.png.asset.json";

const DISMISSED_AT_KEY = "oventric:cashback-spotlight-dismissed-at";
const REPEAT_AFTER_MS = 24 * 60 * 60 * 1000;
const APPEAR_AFTER_MS = 2400;

export function CashbackSpotlight({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    let dismissedAt = 0;
    try {
      dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY) ?? 0);
    } catch {
      dismissedAt = 0;
    }
    if (Date.now() - dismissedAt < REPEAT_AFTER_MS) return;

    const timer = window.setTimeout(() => setVisible(true), APPEAR_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    } catch {
      // Dismiss for this visit when browser storage is unavailable.
    }
  }

  if (!visible || !active) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[3px] animate-fade-in motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-label="Cashback offer: the more you shop, the less you pay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="relative w-full max-w-[560px] animate-scale-in motion-reduce:animate-none">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close cashback offer"
          className="absolute -right-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg ring-1 ring-slate-200 transition hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
        <img
          src={cashbackArt.url}
          alt="Oventric cashback: the more you shop, the less you pay — get up to 50% cashback on eligible digital asset purchases from participating Oventric sellers."
          className="block w-full rounded-[16px] shadow-2xl"
          onClick={dismiss}
        />
      </div>
    </div>
  );
}

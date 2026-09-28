import { useEffect, useState } from "react";
import { ArrowRight, Gift, Sparkles, X } from "lucide-react";
import { useSheetOpen } from "@/hooks/use-sheet-open";
import { Button } from "@/components/ui/button";

const DISMISSED_AT_KEY = "oventric:cashback-spotlight-dismissed-at";
const REPEAT_AFTER_MS = 24 * 60 * 60 * 1000;
const APPEAR_AFTER_MS = 2400;

export function CashbackSpotlight({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  const sheetOpen = useSheetOpen();

  useEffect(() => {
    if (!active || sheetOpen) {
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
  }, [active, sheetOpen]);

  useEffect(() => {
    if (!visible) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
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

  function shopAndEarn() {
    dismiss();
    window.dispatchEvent(
      new CustomEvent("oventric:navigate", { detail: { section: "Marketplace" } }),
    );
  }

  if (!visible || !active) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-background/80 px-5 backdrop-blur-md animate-fade-in motion-reduce:animate-none"
      role="dialog"
      data-onboarding-popup
      aria-modal="true"
      aria-label="Cashback offer: the more you shop, the less you pay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="relative w-full max-w-[360px] animate-scale-in motion-reduce:animate-none">
        <div className="absolute -inset-3 rounded-[32px] bg-wallet-warning/10 blur-2xl" aria-hidden="true" />
        <div className="relative overflow-hidden rounded-[28px] border border-wallet-rich-line bg-wallet-rich/95 px-7 pb-7 pt-9 text-center shadow-wallet-card backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-wallet-warning-soft/10 via-transparent to-wallet-crimson-soft/10" />
          <Button
          type="button"
          onClick={dismiss}
          aria-label="Close cashback offer"
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-10 rounded-full text-wallet-on-rich-muted hover:bg-wallet-rich-muted hover:text-wallet-on-rich"
        >
            <X />
          </Button>

          <div className="relative mx-auto mb-6 flex h-20 w-20 rotate-6 items-center justify-center rounded-[18px] bg-gradient-to-b from-wallet-warning to-wallet-gift text-wallet-rich-strong shadow-wallet-card">
            <span className="absolute -right-2 -top-2 flex h-7 w-7 -rotate-6 items-center justify-center rounded-full bg-wallet-crimson text-wallet-on-crimson ring-4 ring-wallet-rich">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <Gift className="h-9 w-9" strokeWidth={1.8} />
          </div>

          <div className="relative">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-wallet-warning">
              Oventric rewards
            </p>
            <h2 className="text-[28px] font-extrabold leading-tight text-wallet-on-rich">
              Shop more. Pay less.
            </h2>
            <div className="my-4 flex items-end justify-center gap-2">
              <span className="text-[46px] font-black leading-none text-wallet-warning">50%</span>
              <span className="pb-1 text-left text-sm font-bold leading-tight text-wallet-on-rich">
                cashback<br />available
              </span>
            </div>
            <p className="mx-auto mb-7 max-w-[260px] text-sm leading-6 text-wallet-on-rich-muted">
              Earn cashback on eligible digital products from participating sellers.
            </p>

            <Button
              type="button"
              onClick={shopAndEarn}
              className="h-12 w-full rounded-[12px] bg-gradient-to-r from-wallet-warning to-wallet-gift font-extrabold text-wallet-rich-strong shadow-wallet-card hover:opacity-95"
            >
              Shop & earn cashback
              <ArrowRight />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={dismiss}
              className="mt-2 h-10 w-full text-wallet-on-rich-muted hover:bg-wallet-rich-muted hover:text-wallet-on-rich"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

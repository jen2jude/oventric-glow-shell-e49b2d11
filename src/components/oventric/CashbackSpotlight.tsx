import { useEffect, useState } from "react";
import { Gift, ShieldCheck, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";

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
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 px-5 backdrop-blur-[3px] animate-fade-in motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cashback-spotlight-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="relative w-full max-w-[390px] overflow-hidden rounded-[10px] border border-rose-200 bg-white shadow-2xl animate-scale-in motion-reduce:animate-none">
        <div className="relative overflow-hidden bg-slate-950 px-7 pb-7 pt-8 text-white">
          <div aria-hidden="true" className="absolute -right-9 -top-10 h-36 w-36 rounded-full border-[22px] border-rose-500/25" />
          <div aria-hidden="true" className="absolute -bottom-14 -left-10 h-32 w-32 rotate-12 rounded-[10px] border-[18px] border-amber-300/15" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={dismiss}
            aria-label="Close cashback offer"
            className="absolute right-3 top-3 z-10 h-9 w-9 rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="relative">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-rose-500 text-white shadow-lg shadow-rose-950/30">
                <Gift className="h-6 w-6" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-200">
                <Sparkles className="h-3.5 w-3.5" /> Seller rewards
              </span>
            </div>

            <p className="text-sm font-semibold text-rose-300">Your next find can pay you back</p>
            <h2 id="cashback-spotlight-title" className="mt-2 text-[32px] font-black leading-[1.05] tracking-normal text-white">
              Get up to <span className="text-rose-400">50% cashback</span>
            </h2>
            <p className="mt-3 max-w-[300px] text-sm leading-6 text-slate-300">
              On eligible digital asset purchases from participating Oventric sellers.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 bg-white px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p className="text-xs font-medium leading-5 text-slate-600">Cashback appears in your wallet after purchase.</p>
          </div>
          <Button type="button" onClick={dismiss} className="shrink-0 bg-rose-500 px-5 font-bold text-white hover:bg-rose-600">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
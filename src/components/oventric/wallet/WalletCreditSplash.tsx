import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, PartyPopper, Sparkles, Wallet as WalletIcon, X } from "lucide-react";
import {
  getUnseenWalletCredits,
  markWalletCreditsSeen,
  type WalletCreditSplashItem,
} from "@/lib/wallet.functions";
import { formatMoney } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { walletTxLabel } from "@/lib/wallet-tx-labels";
import { Button } from "@/components/ui/button";

/** Decorative confetti pieces — fixed values so server and client render alike. */
const CONFETTI: { left: string; color: string; delay: string; duration: string; drift: string }[] = [
  { left: "6%", color: "#e5484d", delay: "0s", duration: "2.6s", drift: "18px" },
  { left: "16%", color: "#f59e0b", delay: "0.35s", duration: "3.1s", drift: "-14px" },
  { left: "27%", color: "#22c55e", delay: "0.7s", duration: "2.4s", drift: "24px" },
  { left: "38%", color: "#3b82f6", delay: "0.15s", duration: "2.9s", drift: "-22px" },
  { left: "49%", color: "#d946ef", delay: "0.9s", duration: "2.7s", drift: "12px" },
  { left: "60%", color: "#f43f5e", delay: "0.5s", duration: "3.3s", drift: "-18px" },
  { left: "71%", color: "#14b8a6", delay: "1.1s", duration: "2.5s", drift: "20px" },
  { left: "82%", color: "#eab308", delay: "0.25s", duration: "3s", drift: "-10px" },
  { left: "91%", color: "#8b5cf6", delay: "0.8s", duration: "2.8s", drift: "16px" },
];

/**
 * One-time celebration overlay shown on the wallet page whenever new money
 * has landed since the user's last visit. Items are driven by the ledger's
 * splash_seen flag, so each credit is celebrated exactly once across devices.
 */
export function WalletCreditSplash({ enabled }: { enabled: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  const fetchCredits = useServerFn(getUnseenWalletCredits);
  const { data } = useQuery({
    queryKey: ["wallet-credit-splash"],
    queryFn: () => fetchCredits(),
    enabled,
    retry: false,
    staleTime: 60_000,
  });

  const markSeen = useServerFn(markWalletCreditsSeen);
  const mutation = useMutation({
    mutationFn: (ids: string[]) => markSeen({ data: { ids } }),
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const open = enabled && !dismissed && items.length > 0;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    setDismissed(true);
    mutation.mutate(items.map((i) => i.id));
  };

  const single = items.length === 1 ? items[0] : null;
  const headline = single?.type === "Wallet Top-Up" ? "Your wallet has been funded" : "You just received cash";

  // Sum per currency so mixed-currency credits stay honest.
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[10px] border border-border bg-card text-center shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Falling confetti — decorative only. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="wallet-confetti-piece"
              style={{
                left: c.left,
                background: c.color,
                animationDelay: c.delay,
                animationDuration: c.duration,
                // @ts-expect-error CSS custom property
                "--drift": c.drift,
              }}
            />
          ))}
        </div>

        {/* Party header band. */}
        <div className="relative overflow-hidden bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 px-6 pb-8 pt-7 wallet-party-hue">
          <span
            aria-hidden
            className="wallet-party-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/25 blur-md"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-white/20 p-1.5 text-white transition-colors hover:bg-white/35"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="wallet-coin-pop mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/25 ring-4 ring-white/25 backdrop-blur">
            <PartyPopper className="h-8 w-8 text-white" />
          </div>

          <h2 className="relative text-xl font-extrabold text-white drop-shadow-sm">{headline}</h2>
          <p className="relative mt-1 text-sm text-white/90">
            {single ? "New money just landed in your wallet." : `${items.length} payments just landed in your wallet.`}
          </p>
        </div>

        <div className="relative px-6 pb-6">
          <div className="-mt-5 space-y-1 rounded-[10px] border border-border bg-card px-4 py-3 shadow-sm">
            {[...totals.entries()].map(([currency, amount]) => (
              <p
                key={currency}
                className="wallet-amount-pop bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent"
              >
                +{formatMoney(amount, currency as Currency)}
              </p>
            ))}
          </div>


        {!single && (
          <ul className="mt-4 max-h-40 space-y-2 overflow-y-auto rounded-[10px] border border-border bg-muted/40 p-3 text-left">
            {items.map((item: WalletCreditSplashItem) => (
              <li key={item.id} className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <ArrowDown className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {walletTxLabel(item.type)}
                </span>
                <span className="shrink-0 text-xs font-semibold text-foreground">
                  +{formatMoney(item.amount, item.currency as Currency)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Button
          onClick={close}
          className="mt-6 w-full gap-2 border-0 bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-500 text-white hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          Nice, thanks!
        </Button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <WalletIcon className="h-3 w-3" />
          Available now in your balance
        </p>
        </div>
      </div>
    </div>
  );
}

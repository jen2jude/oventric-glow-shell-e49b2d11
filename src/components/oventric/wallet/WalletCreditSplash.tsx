import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, PartyPopper, Sparkles, Wallet as WalletIcon, X } from "lucide-react";
import {
  getUnseenWalletCredits,
  markWalletCreditsSeen,
  type WalletCreditSplashItem,
} from "@/lib/wallet.functions";
import { formatMoney, type MoneyCurrency } from "@/lib/fx-display";
import { walletTxLabel } from "@/lib/wallet-tx-labels";
import { Button } from "@/components/ui/button";

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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[10px] border border-border bg-card p-6 text-center shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <PartyPopper className="h-8 w-8 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-foreground">{headline}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {single ? "New money just landed in your wallet." : `${items.length} payments just landed in your wallet.`}
        </p>

        <div className="mt-5 space-y-1">
          {[...totals.entries()].map(([currency, amount]) => (
            <p key={currency} className="text-3xl font-extrabold tracking-tight text-primary">
              +{formatMoney(amount, currency as MoneyCurrency)}
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
                  +{formatMoney(item.amount, item.currency as MoneyCurrency)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Button onClick={close} className="mt-6 w-full gap-2">
          <Sparkles className="h-4 w-4" />
          Nice, thanks!
        </Button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <WalletIcon className="h-3 w-3" />
          Available now in your balance
        </p>
      </div>
    </div>
  );
}

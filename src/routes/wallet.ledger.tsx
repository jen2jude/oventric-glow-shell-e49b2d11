import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  SlidersHorizontal,
  Download,
  Printer,
  ShoppingCart,
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  Lock,
  ReceiptText,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listWalletTransactions,
  type WalletTxType,
  type WalletTxDTO,
} from "@/lib/wallet.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { downloadWalletCsv, printWalletPdf } from "@/components/oventric/wallet/export";
import { formatMoney } from "@/lib/fx-display";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/wallet/ledger")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Transaction Ledger — Oventric Wallet" },
      {
        name: "description",
        content:
          "Review every Oventric wallet movement: purchases, sales, cashback, escrow releases and payouts, grouped month by month.",
      },
      { property: "og:title", content: "Transaction Ledger — Oventric Wallet" },
      {
        property: "og:description",
        content: "Every wallet movement, grouped month by month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletLedgerPage,
});

import { walletTxLabel } from "@/lib/wallet-tx-labels";

const TABS = ["All", "Cashback", "Escrow", "Payouts"] as const;
type Tab = (typeof TABS)[number];

const TAB_TYPES: Record<Exclude<Tab, "All">, WalletTxType[]> = {
  Cashback: ["Cashback Earned", "Affiliate Cashback Payout"],
  Escrow: ["Marketplace Sale", "Marketplace Purchase"],
  Payouts: ["Payout Withdrawal", "Wallet Top-Up", "Wallet Transfer Sent", "Wallet Transfer Received"],
};

function txStyle(type: WalletTxType, inflow: boolean) {
  if (type === "Marketplace Purchase" || type === "Ad Injection Charge")
    return { icon: ShoppingCart, tone: "bg-accent text-accent-foreground" };
  if (type === "Cashback Earned" || type === "Affiliate Cashback Payout")
    return { icon: ArrowDown, tone: "bg-ledger-positive-soft text-ledger-positive" };
  if (type === "Marketplace Sale") return { icon: Lock, tone: "bg-ledger-info-soft text-ledger-info" };
  if (type === "Wallet Transfer Sent" || type === "Wallet Transfer Received")
    return { icon: ArrowLeftRight, tone: "bg-ledger-info-soft text-ledger-info" };
  return inflow
    ? { icon: ArrowDown, tone: "bg-ledger-positive-soft text-ledger-positive" }
    : { icon: ArrowUp, tone: "bg-muted text-muted-foreground" };
}

function WalletLedgerPage() {
  const router = useRouter();
  const { homeCurrency } = useOnboarding();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const fetchList = useServerFn(listWalletTransactions);
  const query = useQuery({
    queryKey: ["wallet-ledger", userId, from, to],
    enabled: !!userId,
    retry: false,
    queryFn: () =>
      fetchList({
        data: {
          from: from ? new Date(from).toISOString() : null,
          to: to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : null,
          page: 1,
          pageSize: 200,
        },
      }),
  });

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    if (tab === "All") return all;
    const allowed = TAB_TYPES[tab];
    return all.filter((t) => allowed.includes(t.type));
  }, [query.data, tab]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: WalletTxDTO[] }>();
    for (const t of items) {
      const d = new Date(t.occurredAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const group = map.get(key);
      if (group) group.items.push(t);
      else map.set(key, { label, items: [t] });
    }
    return Array.from(map.values());
  }, [items]);

  const totals = useMemo(() => {
    const currencies = new Set(items.map((item) => item.currency));
    const currency = currencies.size === 1 ? items[0]?.currency : null;
    const incoming = items.filter((item) => item.inflow);
    const outgoing = items.filter((item) => !item.inflow);
    return {
      currency,
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      incomingAmount: incoming.reduce((sum, item) => sum + item.amount, 0),
      outgoingAmount: outgoing.reduce((sum, item) => sum + item.amount, 0),
    };
  }, [items]);

  const activityLabel = groups[0]?.label ?? "All activity";

  const exportAll = (kind: "csv" | "pdf") => {
    if (kind === "csv") downloadWalletCsv(items);
    else printWalletPdf(items, homeCurrency);
  };

  return (
    <div className="web-ledger min-h-screen bg-background text-foreground pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="gap-2">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back to wallet</span>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportAll("csv")} className="gap-2">
              <Download className="size-4" /> <span className="hidden sm:inline">Export</span> CSV
            </Button>
            <Button variant="outline" size="icon" onClick={() => exportAll("pdf")} aria-label="Print transaction ledger">
              <Printer className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        <section className="overflow-hidden rounded-[10px] border border-border bg-card shadow-ledger-panel animate-fade-in">
          <div className="border-b border-border bg-card/80 p-5 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                  <ReceiptText className="size-4 text-primary" /> Transaction ledger
                </div>
                <h1 className="font-wallet-display text-3xl font-bold sm:text-4xl">
                  Activity <span className="text-border">/</span> {activityLabel}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">A complete, read-only record of your wallet activity.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[10px] border border-border bg-muted/55 px-4 py-3 sm:min-w-40">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Money in</p>
                  <p className="mt-1 font-wallet-display text-sm font-bold text-ledger-positive sm:text-base">
                    {totals.currency ? `+${formatMoney(totals.incomingAmount, totals.currency)}` : `${totals.incomingCount} entries`}
                  </p>
                </div>
                <div className="rounded-[10px] border border-border bg-muted/55 px-4 py-3 sm:min-w-40">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Money out</p>
                  <p className="mt-1 font-wallet-display text-sm font-bold sm:text-base">
                    {totals.currency ? `−${formatMoney(totals.outgoingAmount, totals.currency)}` : `${totals.outgoingCount} entries`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-border bg-muted/25 px-4 sm:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 gap-5 overflow-x-auto no-scrollbar sm:gap-7">
                {TABS.map((t) => (
                  <Button
                    key={t}
                    variant="ghost"
                    onClick={() => setTab(t)}
                    aria-current={tab === t ? "page" : undefined}
                    className="ledger-tab h-14 shrink-0 rounded-none px-0 text-sm"
                  >
                    {t === "All" ? "All transactions" : t}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersOpen((value) => !value)}
                aria-expanded={filtersOpen}
                className="shrink-0 gap-2"
              >
                <SlidersHorizontal className="size-4" />
                <span className="hidden sm:inline">Date range</span>
              </Button>
            </div>
          </div>

          {filtersOpen && (
            <div className="flex flex-col gap-3 border-b border-border bg-muted/40 p-4 sm:flex-row sm:items-end sm:px-8">
              <label className="grid flex-1 gap-1.5 text-xs font-semibold text-muted-foreground">
                From
                <span className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-full rounded-[8px] border border-input bg-card pl-10 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </span>
              </label>
              <label className="grid flex-1 gap-1.5 text-xs font-semibold text-muted-foreground">
                To
                <span className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-full rounded-[8px] border border-input bg-card pl-10 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </span>
              </label>
              {(from || to) && <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>Clear</Button>}
            </div>
          )}

          <div>
        {!userId ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">
            Sign in to view your wallet activity.
          </div>
        ) : query.isLoading ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">Loading transactions…</div>
        ) : groups.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">
            No transactions in this category.
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label}>
              <div className="border-y border-border bg-muted/45 px-5 py-3 text-xs font-bold uppercase text-muted-foreground first:border-t-0 sm:px-8">{g.label}</div>
              <div className="divide-y divide-border">
                {g.items.map((t) => {
                  const style = txStyle(t.type, t.inflow);
                  return (
                    <div key={t.id} className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/35 sm:gap-5 sm:px-8 sm:py-5">
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-current/10 transition-transform group-hover:scale-105 ${style.tone}`}>
                        <style.icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-foreground">{walletTxLabel(t.type)}</div>
                        <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{t.txHash}</div>
                      </div>
                      <div className="hidden text-right sm:block">
                        <div className="text-xs text-muted-foreground">{new Date(t.occurredAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</div>
                        <div className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Recorded</div>
                      </div>
                      <div className="w-auto shrink-0 text-right sm:w-40">
                        <div className={`font-wallet-display text-sm font-bold tabular-nums sm:text-base ${t.inflow ? "text-ledger-positive" : "text-foreground"}`}>
                          {t.inflow ? "+ " : "− "}{formatMoney(t.amount, t.currency)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(t.occurredAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
          </div>
          <footer className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-4 text-xs text-muted-foreground sm:px-8">
            <span>{items.length} {items.length === 1 ? "transaction" : "transactions"}</span>
            <span>Read-only wallet record</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

import { AppOnlyGate } from "@/lib/app-gate";
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
  Award,
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  Lock,
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

export const Route = createFileRoute("/wallet/ledger")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Transaction Ledger — Oventric Wallet" },
      {
        name: "description",
        content:
          "Review every Oventric wallet movement: cashback, bounty rewards, escrow releases and payouts, grouped month by month.",
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
  component: WalletLedgerPageGated,
});

function WalletLedgerPageGated() {
  return (
    <AppOnlyGate
      title="Your wallet lives in the app"
      description="Balances, cashback, escrow releases and payouts are only available in the Oventric app."
      from="wallet"
    >
      <WalletLedgerPage />
    </AppOnlyGate>
  );
}

const TABS = ["All", "Cashback", "Bounty", "Escrow", "Payouts"] as const;
type Tab = (typeof TABS)[number];

const TAB_TYPES: Record<Exclude<Tab, "All">, WalletTxType[]> = {
  Cashback: ["Cashback Earned", "Affiliate Cashback Payout"],
  Bounty: ["Gig Bounty Escrowed"],
  Escrow: ["Marketplace Sale", "Marketplace Purchase"],
  Payouts: ["Payout Withdrawal", "Wallet Top-Up", "Wallet Transfer Sent", "Wallet Transfer Received"],
};

function txStyle(type: WalletTxType, inflow: boolean) {
  if (type === "Marketplace Purchase" || type === "Ad Injection Charge")
    return { icon: ShoppingCart, tone: "bg-[#3B1030] text-[#F472B6]" };
  if (type === "Cashback Earned" || type === "Affiliate Cashback Payout")
    return { icon: ArrowDown, tone: "bg-[#0F2E23] text-[#34D399]" };
  if (type === "Gig Bounty Escrowed") return { icon: Award, tone: "bg-[#3A2A12] text-[#FBBF24]" };
  if (type === "Marketplace Sale") return { icon: Lock, tone: "bg-[#12283A] text-[#60A5FA]" };
  if (type === "Wallet Transfer Sent" || type === "Wallet Transfer Received")
    return { icon: ArrowLeftRight, tone: "bg-[#12283A] text-[#60A5FA]" };
  return inflow
    ? { icon: ArrowDown, tone: "bg-[#0F2E23] text-[#34D399]" }
    : { icon: ArrowUp, tone: "bg-[#2A1B3D] text-[#C084FC]" };
}

function WalletLedgerPage() {
  const router = useRouter();
  const { baseCurrency } = useOnboarding();
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
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(t);
    }
    return Array.from(map.values());
  }, [items]);

  const exportAll = (kind: "csv" | "pdf") => {
    if (kind === "csv") downloadWalletCsv(items);
    else printWalletPdf(items, baseCurrency);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white pb-24">
      <header className="sticky top-0 z-30 bg-[#0A0A0B]/95 backdrop-blur border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.history.back()}
            aria-label="Go back"
            className="p-1.5 -ml-1.5 rounded-full text-white/80 hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-[16px] font-semibold">Transaction Ledger</h1>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label="Filter transactions"
            className={`p-1.5 -mr-1.5 rounded-full hover:bg-white/10 ${filtersOpen ? "text-[#E5484D]" : "text-white/80"}`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-semibold transition ${
                tab === t
                  ? "bg-[#4C1D95] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {filtersOpen && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="rounded-[10px] border border-white/10 bg-[#111114] p-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-[10px] border border-white/15 bg-transparent text-xs"
            />
            <span className="text-xs text-white/40">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-[10px] border border-white/15 bg-transparent text-xs"
            />
            <div className="flex-1" />
            <button
              onClick={() => exportAll("csv")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-white/15 text-xs"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => exportAll("pdf")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-white/15 text-xs"
            >
              <Printer className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
        {!userId ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Wallet is Locked, Sign in to view
          </div>
        ) : query.isLoading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No transactions in this category.
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label}>
              <div className="mb-2 text-[13px] font-semibold text-slate-400">{g.label}</div>
              <div className="rounded-[10px] bg-[#111114] border border-white/5 divide-y divide-white/5 overflow-hidden">
                {g.items.map((t) => {
                  const style = txStyle(t.type, t.inflow);
                  return (
                    <div key={t.id} className="p-3.5 flex items-center gap-3">
                      <span
                        className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center ${style.tone}`}
                      >
                        <style.icon className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-white truncate">
                          {t.type}
                        </div>
                        <div className="text-[12px] text-slate-500 truncate font-mono">
                          {t.txHash}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`text-[14px] font-bold tabular-nums ${
                            t.inflow ? "text-emerald-400" : "text-white"
                          }`}
                        >
                          {t.inflow ? "+ " : "- "}
                          {formatMoney(t.amount, t.currency)}
                        </div>
                        <div className="text-[12px] text-slate-500">
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
      </main>
    </div>
  );
}

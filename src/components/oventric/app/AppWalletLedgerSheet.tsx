/**
 * App-native Ledger sheet — dark signature slide-up used inside the app shell.
 * Mirrors the website Activity page content (money in/out, category filters,
 * month-grouped transactions) without leaving the wallet.
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpFromLine,
  Lock,
  ReceiptText,
  ShoppingCart,
  X,
} from "lucide-react";
import {
  listWalletTransactions,
  type WalletTxType,
  type WalletTxDTO,
} from "@/lib/wallet.functions";
import { walletTxLabel } from "@/lib/wallet-tx-labels";
import { visibleMoney, usdEquivalent } from "@/lib/money-visibility";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";

type Tab = "all" | "cashback" | "escrow" | "payouts";

const TAB_TYPES: Record<Exclude<Tab, "all">, WalletTxType[]> = {
  cashback: ["Cashback Earned", "Affiliate Cashback Payout"],
  escrow: ["Marketplace Sale", "Marketplace Purchase"],
  payouts: [
    "Payout Withdrawal",
    "Wallet Top-Up",
    "Wallet Transfer Sent",
    "Wallet Transfer Received",
  ],
};

function txStyle(type: WalletTxType, inflow: boolean) {
  if (type === "Marketplace Purchase" || type === "Ad Injection Charge")
    return { Icon: ShoppingCart, cls: "bg-[#E5484D]/15 text-[#E5484D]" };
  if (type === "Cashback Earned" || type === "Affiliate Cashback Payout")
    return { Icon: ArrowDown, cls: "bg-emerald-500/15 text-emerald-400" };
  if (type === "Marketplace Sale")
    return { Icon: Lock, cls: "bg-sky-500/15 text-sky-400" };
  if (type === "Wallet Transfer Sent" || type === "Wallet Transfer Received")
    return { Icon: ArrowLeftRight, cls: "bg-sky-500/15 text-sky-400" };
  return inflow
    ? { Icon: ArrowDown, cls: "bg-emerald-500/15 text-emerald-400" }
    : { Icon: ArrowUpFromLine, cls: "bg-white/[0.06] text-white/50" };
}

export function AppWalletLedgerSheet({ onClose }: { onClose: () => void }) {
  const { balancesHidden } = useOnboarding();
  const fetchTx = useServerFn(listWalletTransactions);
  const [rows, setRows] = useState<WalletTxDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [visible, setVisible] = useState(false);

  // Slide in on mount; lock background scroll on both overflow layers.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchTx({ data: { page: 1, pageSize: 200 } })
      .then((data) => {
        if (alive) setRows(data.items ?? []);
      })
      .catch((cause) => {
        if (!alive) return;
        const message = cause instanceof Error ? cause.message : "Failed to load activity";
        setError(
          /unauthor|authorization header|401/i.test(message)
            ? "Sign in to view your wallet activity."
            : message,
        );
      });
    return () => {
      alive = false;
    };
  }, [fetchTx]);

  const close = () => {
    setVisible(false);
    window.setTimeout(onClose, 280);
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (tab === "all") return rows;
    const allowed = TAB_TYPES[tab];
    return rows.filter((t) => allowed.includes(t.type));
  }, [rows, tab]);

  const counts = useMemo(
    () => ({
      all: rows?.length ?? 0,
      cashback: rows?.filter((t) => TAB_TYPES.cashback.includes(t.type)).length ?? 0,
      escrow: rows?.filter((t) => TAB_TYPES.escrow.includes(t.type)).length ?? 0,
      payouts: rows?.filter((t) => TAB_TYPES.payouts.includes(t.type)).length ?? 0,
    }),
    [rows],
  );

  const summary = useMemo(() => {
    const currencies = new Set(rows?.map((row) => row.currency) ?? []);
    const currency = currencies.size === 1 ? rows?.[0]?.currency ?? null : null;
    const incoming = rows?.filter((row) => row.inflow) ?? [];
    const outgoing = rows?.filter((row) => !row.inflow) ?? [];
    return {
      currency,
      incomingAmount: incoming.reduce((sum, row) => sum + row.amount, 0),
      outgoingAmount: outgoing.reduce((sum, row) => sum + row.amount, 0),
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
    };
  }, [rows]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: WalletTxDTO[] }>();
    for (const t of filtered) {
      const d = new Date(t.occurredAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const group = map.get(key);
      if (group) group.items.push(t);
      else map.set(key, { label, items: [t] });
    }
    return Array.from(map.values());
  }, [filtered]);

  const TABS: Array<[Tab, string]> = [
    ["all", "All"],
    ["cashback", "Cashback"],
    ["escrow", "Escrow"],
    ["payouts", "Payouts"],
  ];

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Wallet activity">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      {/* Sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto flex h-[88dvh] max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl will-change-transform border-t border-white/[0.08] bg-[#101013] text-white shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] transition-transform duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Handle + header */}
        <div className="shrink-0 pt-2.5">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/15" />
          <div className="flex items-center justify-between px-5 pb-1 pt-3">
            <div>
              <p className="text-[15px] font-bold tracking-tight">Wallet activity</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/40">
                <ReceiptText className="h-3 w-3 text-[#E5484D]" /> Every movement, read-only
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="nav-tap grid size-8 place-items-center rounded-full bg-white/[0.06] text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-2">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Money in</p>
              <p className="mt-1 text-[14px] font-bold text-emerald-400">
                {summary.currency
                  ? `+${visibleMoney(summary.incomingAmount, summary.currency, balancesHidden)}`
                  : `${summary.incomingCount} entries`}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Money out</p>
              <p className="mt-1 text-[14px] font-bold">
                {summary.currency
                  ? `−${visibleMoney(summary.outgoingAmount, summary.currency, balancesHidden)}`
                  : `${summary.outgoingCount} entries`}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {TABS.map(([key, label]) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`nav-tap flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    active ? "bg-[#E5484D] text-white" : "bg-white/[0.05] text-white/60"
                  }`}
                >
                  {label}
                  <span className={active ? "text-white/80" : "text-white/35"}>{counts[key]}</span>
                </button>
              );
            })}
          </div>

          {/* Month-grouped list */}
          <div className="mt-4">
            {error ? (
              <p className="py-16 text-center text-[13px] text-white/50">{error}</p>
            ) : rows === null ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-white/50">
                  <ReceiptText className="h-5 w-5" />
                </span>
                <p className="text-[13px] font-semibold">No activity here yet</p>
                <p className="mt-1 text-[12px] text-white/45">Your wallet movements will appear here.</p>
              </div>
            ) : (
              groups.map((g) => (
                <section key={g.label} className="mb-4">
                  <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wide text-white/40">{g.label}</p>
                  <ul className="space-y-2">
                    {g.items.map((t) => {
                      const style = txStyle(t.type, t.inflow);
                      return (
                        <li
                          key={t.id}
                          className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3"
                        >
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.cls}`}>
                            <style.Icon className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-bold">{walletTxLabel(t.type)}</p>
                            <p className="mt-0.5 truncate text-[11px] text-white/40">{t.txHash}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p
                              className={`text-[13px] font-bold tabular-nums ${
                                t.inflow ? "text-emerald-400" : "text-white/85"
                              }`}
                            >
                              {t.inflow ? "+" : "−"}
                              {visibleMoney(t.amount, t.currency as Currency, balancesHidden)}
                            </p>
                            {usdEquivalent(t.amount, t.currency as Currency, balancesHidden) && (
                              <p className="mt-0.5 text-[10px] text-white/35">
                                {usdEquivalent(t.amount, t.currency as Currency, balancesHidden)}
                              </p>
                            )}
                            <p className="mt-0.5 text-[10px] text-white/40">
                              {new Date(t.occurredAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

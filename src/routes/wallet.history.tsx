import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Landmark,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { listMyPaystackTopups, type PaystackTopupRow } from "@/lib/paystack.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/wallet/history")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Top-Up History — Oventric Wallet" },
      {
        name: "description",
        content: "Review the status, amount, reference and date of every Oventric wallet top-up.",
      },
      { property: "og:title", content: "Top-Up History — Oventric Wallet" },
      {
        property: "og:description",
        content: "A complete record of your Oventric wallet top-ups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TopupHistoryPage,
});

type Filter = "all" | "pending" | "success" | "failed";

const FILTERS: Array<[Filter, string]> = [
  ["all", "All top-ups"],
  ["pending", "Initialized"],
  ["success", "Paid"],
  ["failed", "Failed"],
];

function AppTopupHistory({
  rows,
  filtered,
  error,
  filter,
  setFilter,
  counts,
  summary,
}: {
  rows: PaystackTopupRow[] | null;
  filtered: PaystackTopupRow[];
  error: string | null;
  filter: Filter;
  setFilter: (f: Filter) => void;
  counts: Record<Filter, number>;
  summary: { currency: string | null | undefined; paidAmount: number; paidCount: number; pendingCount: number };
}) {
  const navigate = useNavigate();
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="min-h-screen bg-[#0A0A0B] pb-24 text-white">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/[0.06] bg-[#0A0A0B]/90 px-3 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button
          type="button"
          onClick={() => navigate({ to: "/wallet" })}
          aria-label="Back to wallet"
          className="nav-tap flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05]"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <h1 className="text-[15px] font-semibold">Top-up history</h1>
      </header>

      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Paid</p>
            <p className="mt-1 text-[14px] font-bold text-emerald-400">
              {summary.currency ? `${summary.currency} ${fmt(summary.paidAmount)}` : `${summary.paidCount} top-ups`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Pending</p>
            <p className="mt-1 text-[14px] font-bold">{summary.pendingCount} top-ups</p>
          </div>
        </div>

        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
          {FILTERS.map(([key, label]) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`nav-tap flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  active ? "bg-[#E5484D] text-white" : "bg-white/[0.05] text-white/60"
                }`}
              >
                {key === "all" ? "All" : key === "pending" ? "Pending" : label}
                <span className={active ? "text-white/80" : "text-white/35"}>{counts[key]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {error ? (
            <p className="py-16 text-center text-[13px] text-white/50">{error}</p>
          ) : rows === null ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-white/50">
                <Landmark className="h-5 w-5" />
              </span>
              <p className="text-[13px] font-semibold">No top-ups here yet</p>
              <p className="mt-1 text-[12px] text-white/45">Your wallet funding will appear here.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((row) => {
                const date = new Date(row.createdAt);
                const tone =
                  row.status === "success"
                    ? { label: "Paid", Icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400" }
                    : row.status === "failed"
                      ? { label: "Failed", Icon: XCircle, cls: "bg-[#E5484D]/15 text-[#E5484D]" }
                      : { label: "Pending", Icon: Clock, cls: "bg-amber-500/15 text-amber-400" };
                return (
                  <li key={row.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.cls}`}>
                      <tone.Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold">
                        {row.currency} {fmt(row.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(row.reference).then(() => toast.success("Reference copied"))}
                        className="mt-0.5 flex max-w-full items-center gap-1 text-[11px] text-white/40"
                      >
                        <span className="truncate font-mono">{row.reference}</span>
                        <Copy className="h-3 w-3 shrink-0" />
                      </button>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.cls}`}>{tone.label}</span>
                      <p className="mt-1 text-[10px] text-white/40">
                        {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function TopupHistoryPage() {
  const isApp = useIsAppShell();
  const fetchTopups = useServerFn(listMyPaystackTopups);
  const [rows, setRows] = useState<PaystackTopupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let alive = true;
    fetchTopups()
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((cause) => {
        if (!alive) return;
        const message = cause instanceof Error ? cause.message : "Failed to load history";
        setError(
          /unauthor|authorization header|401/i.test(message)
            ? "Sign in to view your top-up history."
            : message,
        );
      });
    return () => {
      alive = false;
    };
  }, [fetchTopups]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    return rows.filter((row) => row.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const result = { all: rows?.length ?? 0, pending: 0, success: 0, failed: 0 };
    rows?.forEach((row) => {
      result[row.status] += 1;
    });
    return result;
  }, [rows]);

  const summary = useMemo(() => {
    const successful = rows?.filter((row) => row.status === "success") ?? [];
    const currencies = new Set(successful.map((row) => row.currency));
    const currency = currencies.size === 1 ? successful[0]?.currency : null;
    return {
      currency,
      paidAmount: successful.reduce((sum, row) => sum + row.amount, 0),
      paidCount: successful.length,
      pendingCount: counts.pending,
    };
  }, [rows, counts.pending]);

  if (isApp) {
    return (
      <AppTopupHistory
        rows={rows}
        filtered={filtered}
        error={error}
        filter={filter}
        setFilter={setFilter}
        counts={counts}
        summary={summary}
      />
    );
  }

  return (
    <div className="web-ledger min-h-screen bg-background pb-16 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back to dashboard</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        <section className="animate-fade-in overflow-hidden rounded-[10px] border border-border bg-card shadow-ledger-panel">
          <div className="border-b border-border bg-card/80 p-5 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                  <ReceiptText className="size-4 text-primary" /> Wallet funding
                </div>
                <h1 className="font-wallet-display text-3xl font-bold sm:text-4xl">
                  Top-up <span className="text-border">/</span> History
                </h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Track every wallet funding attempt and its confirmed payment status.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[10px] border border-border bg-muted/55 px-4 py-3 sm:min-w-40">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Successfully paid</p>
                  <p className="mt-1 font-wallet-display text-sm font-bold text-ledger-positive sm:text-base">
                    {summary.currency
                      ? `${summary.currency} ${summary.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${summary.paidCount} ${summary.paidCount === 1 ? "top-up" : "top-ups"}`}
                  </p>
                </div>
                <div className="rounded-[10px] border border-border bg-muted/55 px-4 py-3 sm:min-w-40">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Initialized</p>
                  <p className="mt-1 font-wallet-display text-sm font-bold sm:text-base">
                    {summary.pendingCount} {summary.pendingCount === 1 ? "top-up" : "top-ups"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-border bg-muted/25 px-4 sm:px-8">
            <div className="flex gap-5 overflow-x-auto no-scrollbar sm:gap-7">
              {FILTERS.map(([key, label]) => (
                <Button
                  key={key}
                  variant="ghost"
                  onClick={() => setFilter(key)}
                  aria-current={filter === key ? "page" : undefined}
                  className="ledger-tab h-14 shrink-0 rounded-none px-0 text-sm"
                >
                  {label}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {counts[key]}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          <div>
            {error ? (
              <div className="px-6 py-20 text-center text-sm text-muted-foreground">{error}</div>
            ) : rows === null ? (
              <div className="space-y-px bg-border" aria-label="Loading top-up history">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse bg-card px-6 py-4">
                    <div className="h-full rounded-[8px] bg-muted" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-20 text-center">
                <span className="mb-3 flex size-11 items-center justify-center rounded-[10px] bg-muted text-muted-foreground">
                  <Landmark className="size-5" />
                </span>
                <p className="text-sm font-bold text-foreground">No top-ups in this category</p>
                <p className="mt-1 text-sm text-muted-foreground">Your wallet funding activity will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((row) => (
                  <TopupRow key={row.id} row={row} />
                ))}
              </ul>
            )}
          </div>

          <footer className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-4 text-xs text-muted-foreground sm:px-8">
            <span>{filtered.length} {filtered.length === 1 ? "top-up" : "top-ups"}</span>
            <span>Verified payment records</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

function TopupRow({ row }: { row: PaystackTopupRow }) {
  const badge =
    row.status === "success"
      ? {
          label: "Paid",
          icon: CheckCircle2,
          tone: "bg-ledger-positive-soft text-ledger-positive",
        }
      : row.status === "failed"
        ? { label: "Failed", icon: XCircle, tone: "bg-accent text-accent-foreground" }
        : {
            label: "Initialized",
            icon: Clock,
            tone: "bg-ledger-warning-soft text-ledger-warning",
          };
  const Icon = badge.icon;
  const date = new Date(row.occurredAt || row.createdAt);

  return (
    <li className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/35 sm:gap-5 sm:px-8 sm:py-5">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-current/10 transition-transform group-hover:scale-105 ${badge.tone}`}>
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-wallet-display text-sm font-bold text-foreground sm:text-base">
            {row.currency} {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.tone}`}>{badge.label}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate font-mono">{row.reference}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(row.reference).then(() => toast.success("Reference copied"));
            }}
            className="size-7 shrink-0"
            aria-label="Copy payment reference"
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="shrink-0 text-right text-xs text-muted-foreground">
        <p>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
        <p className="mt-1 hidden sm:block">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </li>
  );
}
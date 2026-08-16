import { AppOnlyGate } from "@/lib/app-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { listMyPaystackTopups, type PaystackTopupRow } from "@/lib/paystack.functions";

export const Route = createFileRoute("/wallet/history")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Top-Up History — Oventric" },
      {
        name: "description",
        content:
          "Review every wallet top-up you started through Paystack — initialized, paid, and failed transactions.",
      },
    ],
  }),
  component: TopupHistoryPageGated,
});

function TopupHistoryPageGated() {
  return (
    <AppOnlyGate
      title="Your wallet lives in the app"
      description="Top-ups and payment history are only available in the Oventric app."
      from="wallet"
    >
      <TopupHistoryPage />
    </AppOnlyGate>
  );
}

type Filter = "all" | "pending" | "success" | "failed";

function TopupHistoryPage() {
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
      .catch((e) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Failed to load history";
        setError(
          /unauthor|authorization header|401/i.test(msg)
            ? "Wallet is Locked, Sign in to view"
            : msg,
        );
      });
    return () => {
      alive = false;
    };
  }, [fetchTopups]);


  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0, pending: 0, success: 0, failed: 0 };
    rows?.forEach((r) => {
      c[r.status] += 1;
    });
    return c;
  }, [rows]);

  return (
    <div className="page-light min-h-screen bg-[#0b0b0e] md:bg-slate-50 text-white md:text-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <Link
            to="/dashboard"
            className="p-2 rounded-[10px] hover:bg-white/10 md:hover:bg-slate-100 text-white/70 md:text-slate-600 hover:text-white md:hover:text-slate-900"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold">Top-Up History</h1>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {(
            [
              ["all", "All"],
              ["pending", "Initialized"],
              ["success", "Paid"],
              ["failed", "Failed"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border ${
                filter === k
                  ? "bg-white text-black border-white md:bg-slate-900 md:text-white md:border-slate-900"
                  : "border-white/15 md:border-slate-200 md:bg-white text-white/70 md:text-slate-600 hover:text-white md:hover:text-slate-900 hover:border-white/30"
              }`}
            >
              {label} <span className="opacity-60">({counts[k]})</span>
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-[10px] border border-red-500/40 md:border-red-200 bg-red-500/10 md:bg-red-50 p-4 text-sm text-red-200 md:text-red-700">
            {error}
          </div>
        ) : rows === null ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-[10px] bg-white/5 md:bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[10px] border border-white/10 md:border-slate-200 bg-white/[0.03] md:bg-white p-8 text-center text-sm text-white/60 md:text-slate-500">
            No transactions yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((r) => (
              <TopupRow key={r.id} row={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TopupRow({ row }: { row: PaystackTopupRow }) {
  const badge =
    row.status === "success"
      ? {
          label: "Paid",
          icon: CheckCircle2,
          cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
        }
      : row.status === "failed"
        ? { label: "Failed", icon: XCircle, cls: "text-red-300 border-red-500/30 bg-red-500/10" }
        : {
            label: "Initialized",
            icon: Clock,
            cls: "text-amber-300 border-amber-500/30 bg-amber-500/10",
          };
  const Icon = badge.icon;
  const dt = new Date(row.occurredAt || row.createdAt);
  return (
    <li className="rounded-[10px] border border-white/10 md:border-slate-200 bg-white/[0.03] md:bg-white md:shadow-sm p-3 flex items-center gap-3">
      <div className={`p-2 rounded-[10px] border ${badge.cls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <div className="font-medium text-sm">
            {row.currency}{" "}
            {row.amount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <span className={`text-[11px] px-1.5 py-0.5 rounded border ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div className="text-xs text-white/50 md:text-slate-500 flex items-center gap-2 mt-0.5">
          <span className="truncate">{row.reference}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                .writeText(row.reference)
                .then(() => toast.success("Reference copied"));
            }}
            className="p-1 rounded hover:bg-white/10 md:hover:bg-slate-100"
            aria-label="Copy reference"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="text-xs text-white/50 md:text-slate-500 whitespace-nowrap">
        {dt.toLocaleDateString()} ·{" "}
        {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </li>
  );
}

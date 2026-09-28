/**
 * App-native Top-up History sheet — dark signature slide-up used inside the
 * app shell. Mirrors the app History screen content (summary tiles, status
 * filters, tap-to-copy references) without leaving the wallet.
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Clock,
  Copy,
  Landmark,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { listMyPaystackTopups, type PaystackTopupRow } from "@/lib/paystack.functions";

type Filter = "all" | "pending" | "success" | "failed";

const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["pending", "Pending"],
  ["success", "Paid"],
  ["failed", "Failed"],
];

export function AppWalletHistorySheet({ onClose }: { onClose: () => void }) {
  const fetchTopups = useServerFn(listMyPaystackTopups);
  const [rows, setRows] = useState<PaystackTopupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
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

  const close = () => {
    setVisible(false);
    window.setTimeout(onClose, 280);
  };

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: rows?.length ?? 0, pending: 0, success: 0, failed: 0 };
    rows?.forEach((row) => {
      result[row.status] += 1;
    });
    return result;
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    return rows.filter((row) => row.status === filter);
  }, [rows, filter]);

  const summary = useMemo(() => {
    const successful = rows?.filter((row) => row.status === "success") ?? [];
    const currencies = new Set(successful.map((row) => row.currency));
    const currency = currencies.size === 1 ? successful[0]?.currency : null;
    return {
      currency,
      paidAmount: successful.reduce((sum, row) => sum + row.amount, 0),
      pendingCount: counts.pending,
    };
  }, [rows, counts.pending]);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Top-up history">
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
              <p className="text-[15px] font-bold tracking-tight">Top-up history</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/40">
                <ShieldCheck className="h-3 w-3 text-[#E5484D]" /> Wallet funding records
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Paid</p>
              <p className="mt-1 text-[14px] font-bold text-emerald-400">
                {summary.currency
                  ? `${summary.currency} ${fmt(summary.paidAmount)}`
                  : `${counts.success} top-ups`}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Pending</p>
              <p className="mt-1 text-[14px] font-bold">{summary.pendingCount} top-ups</p>
            </div>
          </div>

          {/* Filters */}
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
                  {label}
                  <span className={active ? "text-white/80" : "text-white/35"}>{counts[key]}</span>
                </button>
              );
            })}
          </div>

          {/* List */}
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
                    <li
                      key={row.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.cls}`}>
                        <tone.Icon className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold">
                          {row.currency} {fmt(row.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(row.reference).then(() => toast.success("Reference copied"))
                          }
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
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Truck,
  MessageCircle,
  Loader2,
  PackageCheck,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OrderFulfilmentRoadmap } from "@/components/oventric/OrderFulfilmentRoadmap";
import { markOrderDelivered, type SaleDTO } from "@/lib/fulfilment.functions";
import { formatMoney } from "@/lib/fx-display";

export type SaleFilter = "all" | "deliver" | "awaiting" | "disputed" | "settled";

const FILTERS: Array<{ id: SaleFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "deliver", label: "To deliver" },
  { id: "awaiting", label: "Awaiting buyer" },
  { id: "disputed", label: "Disputed" },
  { id: "settled", label: "Settled" },
];

function overdue(s: SaleDTO) {
  return (
    s.requiresManualDelivery &&
    !s.deliveredAt &&
    s.escrowStatus === "held" &&
    Date.now() - new Date(s.createdAt).getTime() > 24 * 3600 * 1000
  );
}

/** Time left until the seller's earnings land in their wallet, or null. */
export function sellerShareDisplay(s: SaleDTO): number {
  // Seller keeps 80%; convert the USD share back into the order's display currency
  if (s.totalUSD > 0 && s.displayTotal > 0) {
    return s.sellerShareUSD * (s.displayTotal / s.totalUSD);
  }
  return s.displayTotal * 0.8;
}

export function payoutCountdown(s: SaleDTO): string | null {
  if (!s.buyerConfirmedAt || s.escrowStatus !== "held" || !s.payoutReleaseAt) return null;
  const ms = new Date(s.payoutReleaseAt).getTime() - Date.now();
  if (ms <= 0) return "any moment now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function saleBucket(s: SaleDTO): Exclude<SaleFilter, "all"> {
  if (s.disputeStatus === "open") return "disputed";
  if (s.escrowStatus === "released") return "settled";
  if (s.deliveredAt) return "awaiting";
  return "deliver";
}

export function saleBadge(s: SaleDTO): { label: string; cls: string } {
  if (s.disputeStatus === "open")
    return { label: "Disputed", cls: "bg-red-500/15 text-red-300 md:text-red-700" };
  if (s.escrowStatus === "released")
    return { label: "Settled", cls: "bg-emerald-500/15 text-emerald-300 md:text-emerald-700" };
  if (s.buyerConfirmedAt)
    return {
      label: "Confirmed — clearing",
      cls: "bg-emerald-500/15 text-emerald-300 md:text-emerald-700",
    };
  if (s.deliveredAt)
    return { label: "Awaiting buyer", cls: "bg-amber-500/15 text-amber-300 md:text-amber-700" };
  if (overdue(s)) return { label: "Overdue 24h+", cls: "bg-red-500 text-white" };
  if (s.requiresManualDelivery)
    return { label: "Deliver now", cls: "bg-white text-black md:bg-slate-900 md:text-white" };
  return {
    label: "In escrow",
    cls: "bg-white/10 md:bg-slate-100 text-slate-200 md:text-slate-700",
  };
}

export type SaleSort = "newest" | "oldest" | "value" | "urgency";

const SORTS: Array<{ id: SaleSort; label: string }> = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "value", label: "Highest value" },
  { id: "urgency", label: "Most urgent" },
];

const PAGE_SIZE = 10;

function urgencyScore(s: SaleDTO) {
  if (s.disputeStatus === "open") return 3;
  if (!s.deliveredAt && s.escrowStatus === "held") return overdue(s) ? 4 : 2;
  if (s.deliveredAt && s.escrowStatus === "held") return 1;
  return 0;
}

export function SalesFulfilmentList({
  rows,
  onChanged,
}: {
  rows: SaleDTO[];
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<SaleFilter>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sort, setSort] = useState<SaleSort>("newest");
  const [page, setPage] = useState(1);
  const deliverFn = useServerFn(markOrderDelivered);

  const counts = useMemo(() => {
    const c: Record<SaleFilter, number> = {
      all: rows.length,
      deliver: 0,
      awaiting: 0,
      disputed: 0,
      settled: 0,
    };
    for (const s of rows) c[saleBucket(s)] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((s) => {
      if (filter !== "all" && saleBucket(s) !== filter) return false;
      if (!needle) return true;
      return (
        s.productName.toLowerCase().includes(needle) ||
        s.buyerName.toLowerCase().includes(needle) ||
        s.orderId.toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, q]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      if (sort === "value") return b.sellerShareUSD - a.sellerShareUSD;
      if (sort === "urgency") {
        const d = urgencyScore(b) - urgencyScore(a);
        if (d !== 0) return d;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
    return list;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );

  // Filters/search/sort change the result set — go back to the first page,
  // but keep the active filter and query intact.
  useEffect(() => {
    setPage(1);
  }, [filter, q, sort]);

  const openSale = useMemo(() => rows.find((s) => s.orderId === openId) ?? null, [rows, openId]);
  const confirmSale = useMemo(
    () => rows.find((s) => s.orderId === confirmId) ?? null,
    [rows, confirmId],
  );

  const markDelivered = async (s: SaleDTO) => {
    setDeliveringId(s.orderId);
    try {
      const r = await deliverFn({ data: { orderId: s.orderId } });
      const when = new Date().toLocaleString();
      toast.success(
        r.alreadyDelivered ? "Already marked delivered" : "Marked delivered — buyer notified",
        { description: `Delivered at ${when}` },
      );
      setConfirmId(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this order");
    } finally {
      setDeliveringId(null);
    }
  };

  const messageBuyer = (buyerId: string) => {
    if (typeof window === "undefined") return;
    window.location.href = `/?dm=${buyerId}`;
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
          role="tablist"
          aria-label="Order filters"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  active
                    ? "bg-emerald-500 text-black border-emerald-500"
                    : "bg-white/5 md:bg-white text-slate-300 md:text-slate-600 border-white/10 md:border-slate-200 hover:bg-white/10 md:hover:bg-slate-50"
                }`}
              >
                {f.label}
                <span className={active ? "opacity-70" : "opacity-60"}>{counts[f.id]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search product, buyer, order id"
              aria-label="Search orders"
              className="w-full pl-9 pr-8 py-3 rounded-xl bg-white/5 md:bg-white border border-white/10 md:border-slate-200 text-sm text-white md:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[10px] text-slate-400 hover:text-white md:hover:text-slate-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="relative shrink-0">
            <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SaleSort)}
              aria-label="Sort orders"
              className="appearance-none pl-8 pr-7 py-3 rounded-xl bg-white/5 md:bg-white border border-white/10 md:border-slate-200 text-xs font-semibold text-white md:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              {SORTS.map((o) => (
                <option key={o.id} value={o.id} className="text-slate-900">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 md:border-slate-300 p-6 text-center">
          <Truck className="w-6 h-6 mx-auto text-slate-500 mb-2" />
          <p className="text-sm font-semibold text-white md:text-slate-900">No orders match</p>
          <p className="text-xs text-slate-500 mt-1">
            Try a different filter or clear your search.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {paged.map((s) => {
            const b = saleBadge(s);
            const canDeliver =
              !s.deliveredAt && s.escrowStatus === "held" && s.disputeStatus !== "open";
            return (
              <div
                key={s.orderId}
                className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(s.orderId)}
                    className="min-w-0 text-left"
                  >
                    <div className="text-sm font-bold text-white md:text-slate-900 truncate">
                      {s.productName}
                    </div>
                    <div className="text-xs text-slate-400 md:text-slate-500 truncate">
                      {s.buyerName} · Qty {s.quantity} ·{" "}
                      {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                    {s.deliveredAt && !s.buyerConfirmedAt && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 md:text-emerald-700">
                        <PackageCheck className="w-3 h-3" /> Delivered{" "}
                        {new Date(s.deliveredAt).toLocaleString()}
                      </div>
                    )}
                    {s.buyerConfirmedAt && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 md:text-emerald-700">
                        <PackageCheck className="w-3 h-3" /> Buyer confirmed{" "}
                        {new Date(s.buyerConfirmedAt).toLocaleString()}
                      </div>
                    )}
                    {payoutCountdown(s) && (
                      <div className="mt-0.5 text-[11px] font-semibold text-slate-300 md:text-slate-600">
                        Wallet funds in {payoutCountdown(s)}
                      </div>
                    )}
                  </button>
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${b.cls}`}
                  >
                    {b.label}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-400 md:text-slate-500">
                    {formatMoney(s.displayTotal, s.displayCurrency)} gross · your 80% ≈{" "}
                    {formatMoney(sellerShareDisplay(s), s.displayCurrency)}
                  </div>
                  <div className="flex items-center gap-2">
                    {canDeliver && (
                      <button
                        onClick={() => setConfirmId(s.orderId)}
                        disabled={deliveringId === s.orderId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-60"
                      >
                        {deliveringId === s.orderId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PackageCheck className="w-3.5 h-3.5" />
                        )}
                        Mark delivered
                      </button>
                    )}
                    <button
                      onClick={() => messageBuyer(s.buyerId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/5 md:bg-slate-50 hover:bg-white/10 md:hover:bg-slate-100 border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700 text-xs font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Message
                    </button>
                    <button
                      onClick={() => setOpenId(s.orderId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/10 hover:bg-white/15 md:bg-slate-100 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-900 text-xs font-bold"
                    >
                      <Truck className="w-3.5 h-3.5" /> Manage
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-slate-400 md:text-slate-500">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)}{" "}
            of {sorted.length}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
                className="p-1.5 rounded-[10px] border border-white/10 md:border-slate-200 bg-white/5 md:bg-white text-slate-300 md:text-slate-600 disabled:opacity-40 hover:bg-white/10 md:hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-semibold text-white md:text-slate-900 px-1">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-[10px] border border-white/10 md:border-slate-200 bg-white/5 md:bg-white text-slate-300 md:text-slate-600 disabled:opacity-40 hover:bg-white/10 md:hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Details drawer */}
      <Sheet open={!!openSale} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto bg-[#0e0e11] md:bg-white border-white/10 md:border-slate-200"
        >
          {openSale && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white md:text-slate-900 text-left pr-6 truncate">
                  {openSale.productName}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-3 space-y-4">
                <div className="rounded-xl border border-white/10 md:border-slate-200 bg-white/5 md:bg-slate-50 p-3 space-y-1.5 text-xs">
                  <Row label="Buyer" value={openSale.buyerName} />
                  <Row label="Quantity" value={String(openSale.quantity)} />
                  <Row
                    label="Gross"
                    value={formatMoney(openSale.displayTotal, openSale.displayCurrency)}
                  />
                  <Row label="Your share" value={`$${openSale.sellerShareUSD.toFixed(2)}`} />
                  <Row label="Placed" value={new Date(openSale.createdAt).toLocaleString()} />
                  <Row
                    label="Delivered"
                    value={
                      openSale.deliveredAt
                        ? new Date(openSale.deliveredAt).toLocaleString()
                        : "Not yet"
                    }
                  />
                  <Row
                    label="Auto-release"
                    value={
                      openSale.autoReleaseAt
                        ? new Date(openSale.autoReleaseAt).toLocaleString()
                        : "—"
                    }
                  />
                  <Row label="Order id" value={openSale.orderId.slice(0, 8)} />
                </div>

                <OrderFulfilmentRoadmap orderId={openSale.orderId} onChanged={onChanged} />

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => messageBuyer(openSale.buyerId)}
                    className="inline-flex items-center gap-1.5 px-3 py-3 rounded-[10px] bg-white/5 md:bg-slate-50 hover:bg-white/10 md:hover:bg-slate-100 border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700 text-xs font-semibold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Message buyer
                  </button>
                  <Link
                    to="/order/$id"
                    params={{ id: openSale.orderId }}
                    className="inline-flex items-center gap-1.5 px-3 py-3 rounded-[10px] bg-white/5 md:bg-slate-50 hover:bg-white/10 md:hover:bg-slate-100 border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700 text-xs font-semibold"
                  >
                    Open full order page
                  </Link>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Mark delivered confirmation */}
      {confirmSale && (
        <div
          className="modal-light fixed inset-0 z-[90] flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => deliveringId === null && setConfirmId(null)}
          />
          <div className="slide-up relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-white/10 md:border-slate-200 bg-[#1E1E24] md:bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <PackageCheck className="w-5 h-5 text-emerald-400 md:text-emerald-600" />
                </span>
                <h3 className="text-base font-bold text-white md:text-slate-900">
                  Mark as delivered?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => deliveringId === null && setConfirmId(null)}
                aria-label="Close"
                className="p-1 rounded-[10px] text-slate-400 hover:text-white md:hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-400 md:text-slate-600 mb-3">
              Confirm you have delivered{" "}
              <span className="font-semibold text-white md:text-slate-900">
                {confirmSale.productName}
              </span>{" "}
              to {confirmSale.buyerName} inside Oventric chat. The buyer has 48 hours to confirm
              before escrow auto-releases.
            </p>
            <div className="rounded-[10px] border border-white/10 md:border-slate-200 bg-white/5 md:bg-slate-50 px-3 py-3 text-[11px] text-slate-400 md:text-slate-600 mb-4">
              Delivery will be timestamped{" "}
              <span className="font-semibold text-white md:text-slate-900">
                {new Date().toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                disabled={deliveringId !== null}
                className="py-2.5 rounded-[10px] text-xs font-bold border border-white/10 md:border-slate-200 bg-white/5 md:bg-white text-slate-200 md:text-slate-700 hover:bg-white/10 md:hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void markDelivered(confirmSale)}
                disabled={deliveringId !== null}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-60"
              >
                {deliveringId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PackageCheck className="w-3.5 h-3.5" />
                )}
                Yes, delivered
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400 md:text-slate-500">{label}</span>
      <span className="font-semibold text-white md:text-slate-900 truncate max-w-[60%] text-right">
        {value}
      </span>
    </div>
  );
}

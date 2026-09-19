import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  ShieldCheck,
  Truck,
  MessageCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  RefreshCcw,
} from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { listEscrowInbox, type EscrowInboxItem } from "@/lib/escrow-inbox.functions";
import { formatMoney } from "@/lib/fx-display";

export const Route = createFileRoute("/escrow")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Escrow inbox — Oventric" },
      {
        name: "description",
        content:
          "Track every Oventric deal in one place: pending orders, delivery status, escrow timers and the latest message from the other side.",
      },
      { property: "og:title", content: "Escrow inbox — Oventric" },
      {
        property: "og:description",
        content:
          "Pending orders, delivery status and buyer messages for every deal you have on Oventric.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EscrowInboxPage,
});

type Tab = "action" | "waiting" | "closed";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "action", label: "Needs action" },
  { id: "waiting", label: "In escrow" },
  { id: "closed", label: "Closed" },
];

function countdown(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Stage {
  label: string;
  tone: "amber" | "sky" | "emerald" | "rose" | "slate";
  detail: string;
  needsMe: boolean;
}

function stageOf(o: EscrowInboxItem): Stage {
  if (o.disputeStatus === "open") {
    return {
      label: "Under review",
      tone: "rose",
      detail: "A problem was reported. Oventric support is reviewing this deal and timers are frozen.",
      needsMe: true,
    };
  }
  if (o.escrowStatus === "refunded") {
    return {
      label: "Refunded",
      tone: "slate",
      detail: "The payment went back to the buyer.",
      needsMe: false,
    };
  }
  if (o.escrowStatus === "released") {
    return {
      label: "Completed",
      tone: "emerald",
      detail:
        o.role === "seller"
          ? "Funds released into your wallet."
          : "Delivery confirmed and the seller has been paid.",
      needsMe: false,
    };
  }
  if (!o.deliveredAt) {
    const left = countdown(o.autoRefundAt);
    return {
      label: o.role === "seller" ? "Deliver now" : "Awaiting delivery",
      tone: "amber",
      detail:
        o.role === "seller"
          ? `Deliver in the order chat and mark it delivered${left ? ` — ${left} before an automatic refund` : ""}.`
          : `The seller is preparing your item${left ? ` — ${left} before you are refunded automatically` : ""}.`,
      needsMe: o.role === "seller",
    };
  }
  if (!o.buyerConfirmedAt) {
    const left = countdown(o.autoReleaseAt);
    return {
      label: o.role === "buyer" ? "Confirm receipt" : "Awaiting buyer",
      tone: "sky",
      detail:
        o.role === "buyer"
          ? `Check the item and confirm receipt${left ? ` — ${left} before it confirms automatically` : ""}.`
          : `Delivered. The buyer has to confirm${left ? ` — ${left}` : ""}.`,
      needsMe: o.role === "buyer",
    };
  }
  const left = countdown(o.payoutReleaseAt);
  return {
    label: "Clearing",
    tone: "sky",
    detail:
      o.role === "seller"
        ? `Confirmed. Funds clear into your wallet${left ? ` — ${left}` : ""}.`
        : `Confirmed. The seller is paid after the clearing window${left ? ` — ${left}` : ""}.`,
    needsMe: false,
  };
}

const TONE: Record<Stage["tone"], string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

function bucketOf(o: EscrowInboxItem, s: Stage): Tab {
  if (o.escrowStatus !== "held") return "closed";
  if (s.needsMe) return "action";
  return "waiting";
}

function EscrowInboxPage() {
  const load = useServerFn(listEscrowInbox);
  const [rows, setRows] = useState<EscrowInboxItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("action");
  const [reloading, setReloading] = useState(false);

  const refresh = async () => {
    setReloading(true);
    try {
      setRows(await load({}));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load your deals.");
    } finally {
      setReloading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staged = useMemo(
    () => (rows ?? []).map((o) => ({ o, s: stageOf(o) })),
    [rows],
  );
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { action: 0, waiting: 0, closed: 0 };
    for (const { o, s } of staged) c[bucketOf(o, s)] += 1;
    return c;
  }, [staged]);
  const visible = staged.filter(({ o, s }) => bucketOf(o, s) === tab);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                <ShieldCheck className="h-6 w-6 text-[#E5484D]" />
                Escrow inbox
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Every deal you are part of, what it is waiting on, and the last message sent.
              </p>
            </div>
            <button
              onClick={() => void refresh()}
              className="rounded-[10px] border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900"
              aria-label="Refresh"
            >
              <RefreshCcw className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  tab === t.id
                    ? "border-[#E5484D] bg-[#E5484D] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {t.label}
                <span className={`ml-2 text-xs ${tab === t.id ? "text-white/80" : "text-slate-400"}`}>
                  {counts[t.id]}
                </span>
              </button>
            ))}
          </div>

          {rows === null && !err && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          )}

          {err && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">We could not load your deals.</p>
                <p className="mt-1 text-rose-600">{err}</p>
              </div>
            </div>
          )}

          {rows !== null && !err && visible.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <Inbox className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-semibold text-slate-700">Nothing here yet</p>
              <p className="mt-1 text-xs text-slate-500">
                {tab === "action"
                  ? "No deal is waiting on you right now."
                  : tab === "waiting"
                    ? "No payments are sitting in escrow."
                    : "Completed and refunded deals will show here."}
              </p>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {visible.map(({ o, s }) => (
              <div
                key={o.orderId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{o.productName}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {o.role === "seller" ? "Sold to" : "Bought from"} {o.counterpartyName}
                      {o.quantity > 1 ? ` · Qty ${o.quantity}` : ""} · {when(o.paidAt ?? o.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${TONE[s.tone]}`}
                  >
                    {s.label}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="font-bold text-slate-900">
                    {formatMoney(o.displayTotal, o.displayCurrency)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {o.escrowStatus === "held" ? (
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                    ) : o.escrowStatus === "released" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <RefreshCcw className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    {o.escrowStatus === "held"
                      ? "Held in escrow"
                      : o.escrowStatus === "released"
                        ? "Released"
                        : "Refunded"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5 text-slate-400" />
                    {o.deliveredAt
                      ? `Delivered ${when(o.deliveredAt)}`
                      : o.requiresManualDelivery
                        ? "Not delivered yet"
                        : "Instant delivery"}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.detail}</p>

                {o.lastMessage && (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {o.lastMessage.fromMe ? "You" : o.counterpartyName}
                      <span className="font-normal text-slate-400">
                        · {when(o.lastMessage.createdAt)}
                      </span>
                      {o.lastMessage.unread && (
                        <span className="rounded-full bg-[#E5484D] px-2 py-0.5 text-[10px] font-bold text-white">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-slate-700">
                      {o.lastMessage.body}
                    </p>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Link
                    to="/order/$id"
                    params={{ id: o.orderId }}
                    className="flex-1 rounded-[10px] bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-slate-800"
                  >
                    Open order
                  </Link>
                  <Link
                    to="/messages"
                    search={{ order: o.orderId }}
                    className="flex-1 rounded-[10px] border border-slate-200 px-3 py-2 text-center text-xs font-bold text-slate-700 hover:border-slate-300"
                  >
                    Open chat
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

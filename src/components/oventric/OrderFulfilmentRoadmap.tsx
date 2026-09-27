import { navigateInApp } from "@/lib/navigate-in-app";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  MessageCircle,
  ShieldAlert,
  Truck,
  X,
  Clock,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  getOrderFulfilment,
  markOrderDelivered,
  buyerConfirmReceipt,
  openOrderDispute,
  getDisputeUploadUrl,
  type FulfilmentDTO,
  type FulfilmentStep,
} from "@/lib/fulfilment.functions";
import { formatMoney } from "@/lib/fx-display";

const REASONS: Array<{
  value: "not_delivered" | "wrong_item" | "not_working" | "seller_unreachable" | "other";
  label: string;
}> = [
  { value: "not_delivered", label: "I paid but never received the item" },
  { value: "wrong_item", label: "I received the wrong item" },
  { value: "not_working", label: "The item doesn't work as described" },
  { value: "seller_unreachable", label: "The seller is unreachable" },
  { value: "other", label: "Something else" },
];

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function OrderFulfilmentRoadmap({
  orderId,
  onChanged,
}: {
  orderId: string;
  onChanged?: () => void;
}) {
  const loadFn = useServerFn(getOrderFulfilment);
  const deliverFn = useServerFn(markOrderDelivered);
  const confirmFn = useServerFn(buyerConfirmReceipt);

  const [data, setData] = useState<FulfilmentDTO | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDispute, setShowDispute] = useState(false);
  const [confirmModal, setConfirmModal] = useState<null | "deliver" | "receive">(null);
  const [deliveryNote, setDeliveryNote] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await loadFn({ data: { orderId } }));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [loadFn, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // While money is still in escrow the server keeps advancing the clocks
  // (auto-confirm, clearing, payout). Poll so the card updates on its own.
  const held = data?.escrowStatus === "held";
  useEffect(() => {
    if (!held) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 45_000);
    return () => clearInterval(t);
  }, [held, load]);

  const act = async (kind: "deliver" | "receive") => {
    setBusy(kind);
    try {
      if (kind === "deliver") {
        const note = deliveryNote.trim();
        await deliverFn({ data: note ? { orderId, note } : { orderId } });
        setDeliveryNote("");
        toast.success("Marked delivered — buyer notified in chat.");
      } else {
        await confirmFn({ data: { orderId } });
        toast.success("Receipt confirmed.");
      }
      setConfirmModal(null);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const contactPeer = () => {
    if (!data) return;
    const peerId = data.role === "seller" ? data.buyer.id : data.seller.id;
    if (window.location.pathname === "/") {
      window.dispatchEvent(new CustomEvent("oventric:open-dm", { detail: { peerId } }));
    } else {
      navigateInApp(`/?dm=${peerId}`);
    }
  };

  if (err) {
    return (
      <div className="rounded-[10px] border border-red-200 bg-white p-4 text-sm text-red-700">
        {err}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-[10px] border border-slate-200 bg-white p-4 text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading fulfilment roadmap…
      </div>
    );
  }

  const auto = timeLeft(data.autoReleaseAt);
  const canDeliver =
    data.role === "seller" &&
    data.requiresManualDelivery &&
    !data.deliveredAt &&
    data.escrowStatus === "held";
  const canConfirm =
    data.role === "buyer" && data.escrowStatus === "held" && data.disputeStatus !== "open";
  const canDispute =
    data.role === "buyer" && data.disputeStatus === "none" && data.escrowStatus !== "refunded";

  return (
    <div className="rounded-[10px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-slate-900 font-bold text-base">Payment fulfilment</h2>
          <p className="text-xs text-slate-500 truncate">
            {data.productName} · {formatMoney(data.displayTotal, data.displayCurrency)} · Order{" "}
            {data.orderId.slice(0, 8)}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
            data.disputeStatus === "open"
              ? "bg-red-100 text-red-700"
              : data.escrowStatus === "released"
                ? "bg-emerald-100 text-emerald-600"
                : "bg-amber-100 text-amber-700"
          }`}
        >
          {data.disputeStatus === "open"
            ? "Disputed"
            : data.escrowStatus === "released"
              ? "Complete"
              : "In escrow"}
        </span>
      </div>

      {/* Roadmap */}
      <ol className="flex flex-col sm:flex-row sm:items-stretch gap-2 sm:gap-0 mb-4">
        {data.steps.map((s, i) => (
          <li key={s.key} className="flex sm:flex-1 items-start sm:items-center gap-2 min-w-0">
            <StepNode step={s} />
            {i < data.steps.length - 1 && (
              <ChevronRight className="hidden sm:block w-4 h-4 text-slate-600 shrink-0" />
            )}
          </li>
        ))}
      </ol>

      {/* Delivery timeline */}
      <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Delivery timeline
        </h3>
        <ol className="flex flex-col gap-0">
          <TimelineRow
            label={data.requiresManualDelivery ? "Payment held in escrow" : "Payment confirmed"}
            at={data.paidAt}
            expected={null}
            last={false}
          />
          <TimelineRow
            label={data.requiresManualDelivery ? "Seller delivered" : "Delivered automatically"}
            at={data.deliveredAt}
            expected={data.escrowStatus === "held" && !data.deliveredAt ? data.autoRefundAt : null}
            expectedPrefix={data.escrowStatus === "held" && !data.deliveredAt ? "Auto-refund if not delivered by" : null}
            last={false}
          />
          <TimelineRow
            label="Buyer confirmed receipt"
            at={data.buyerConfirmedAt}
            expected={
              data.escrowStatus === "held" && data.deliveredAt && !data.buyerConfirmedAt
                ? data.autoReleaseAt
                : null
            }
            expectedPrefix="Auto-confirms"
            last={false}
          />
          <TimelineRow
            label={data.role === "seller" ? "Funds released to your wallet" : "Funds released to seller"}
            at={data.releasedAt}
            expected={data.escrowStatus === "held" && data.buyerConfirmedAt ? data.payoutReleaseAt : null}
            expectedPrefix="Expected"
            last
          />
        </ol>
      </div>

      {data.escrowStatus === "held" && data.buyerConfirmedAt && (
        <div className="flex items-center gap-2 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-[10px] px-3 py-3 mb-3">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Receipt confirmed
          {data.role === "seller"
            ? ` — your earnings land in your wallet${timeLeft(data.payoutReleaseAt) ? ` in ${timeLeft(data.payoutReleaseAt)}` : " shortly"}.`
            : ` — the seller is paid${timeLeft(data.payoutReleaseAt) ? ` in ${timeLeft(data.payoutReleaseAt)}` : " shortly"}.`}
        </div>
      )}
      {data.escrowStatus === "held" && !data.buyerConfirmedAt && auto && data.deliveredAt && (
        <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-3 mb-3">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Auto-confirms in {auto} if you don't act. Funds then release to the seller.
        </div>
      )}
      {data.role === "seller" &&
        data.deliveredAt &&
        !data.buyerConfirmedAt &&
        data.escrowStatus === "held" && (
          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-[10px] px-3 py-3 mb-3">
            Waiting for the buyer to confirm receipt{auto ? ` — auto-releases in ${auto}` : ""}.
          </div>
        )}
      {data.dispute && (
        <div className="rounded-[10px] border border-red-200 bg-red-50 p-3 mb-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-red-700 mb-1">
            Dispute · {data.dispute.status}
          </div>
          <div className="text-xs text-slate-600 whitespace-pre-wrap">
            {data.dispute.details}
          </div>
          {data.dispute.imageUrls.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {data.dispute.imageUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noreferrer">
                  <img loading="lazy" decoding="async"
                    src={u}
                    alt="Dispute evidence"
                    className="w-16 h-16 object-cover rounded border border-slate-200"
                  />
                </a>
              ))}
            </div>
          )}
          {data.dispute.adminNote && (
            <div className="text-[11px] text-emerald-600 mt-2">Admin: {data.dispute.adminNote}</div>
          )}
        </div>
      )}

      <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-3 mb-3 text-[11px] text-emerald-900 leading-relaxed">
        {data.requiresManualDelivery ? (
          <>
            <strong className="text-emerald-700">Keep this trade on Oventric.</strong> Payment stays
            protected while delivery is completed here. Deliver, chat and confirm here — never on
            WhatsApp or any other app.
          </>
        ) : (
          <>
            <strong className="text-emerald-700">Your purchase is complete.</strong> The download is
            available from this receipt and My purchases whenever you need a fresh secure link.
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canDeliver && (
          <button
            onClick={() => setConfirmModal("deliver")}
            className="inline-flex items-center gap-2 px-3.5 py-3 rounded-[10px] text-sm font-bold text-white bg-[#E5484D] hover:bg-[#D63D42] transition-colors"
          >
            <Truck className="w-4 h-4" /> Mark as delivered
          </button>
        )}
        {canConfirm && (
          <button
            onClick={() => setConfirmModal("receive")}
            className="inline-flex items-center gap-2 px-3.5 py-3 rounded-[10px] text-sm font-bold text-white bg-[#E5484D] hover:bg-[#D63D42] transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> Received — complete trade
          </button>
        )}
        <button
          onClick={contactPeer}
          className="inline-flex items-center gap-2 px-3.5 py-3 rounded-[10px] text-sm font-semibold text-slate-900 bg-slate-100 border border-slate-200"
        >
          <MessageCircle className="w-4 h-4" />
          {data.role === "seller" ? "Contact buyer" : "Contact seller"}
        </button>
        {canDispute && (
          <button
            onClick={() => setShowDispute(true)}
            className="inline-flex items-center gap-2 px-3.5 py-3 rounded-[10px] text-sm font-semibold text-red-700 bg-slate-100 border border-red-200"
          >
            <ShieldAlert className="w-4 h-4" /> Open dispute
          </button>
        )}
      </div>

      {confirmModal && (
        <ConfirmModal
          title={
            confirmModal === "deliver"
              ? "Mark this order delivered?"
              : "Confirm you received this item?"
          }
          body={
            confirmModal === "deliver"
              ? "We'll post your delivery note in the buyer's chat. They get 24 hours to confirm — after that funds auto-release to your wallet."
              : "This releases the escrowed payment to the seller immediately. Only confirm if you have the item."
          }
          busy={busy !== null}
          onCancel={() => {
            setConfirmModal(null);
            setDeliveryNote("");
          }}
          onConfirm={() => act(confirmModal)}
        >
          {confirmModal === "deliver" && (
            <label className="block mb-4">
              <span className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1">
                Delivery note (sent to the buyer's chat)
              </span>
              <textarea
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Paste the download link, licence key or setup steps here."
                className="w-full rounded-[10px] bg-slate-50 border border-slate-200 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </label>
          )}
        </ConfirmModal>
      )}

      {showDispute && (
        <DisputeModal
          orderId={orderId}
          onClose={() => setShowDispute(false)}
          onSubmitted={() => {
            setShowDispute(false);
            void load();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function TimelineRow({
  label,
  at,
  expected,
  expectedPrefix,
  last,
}: {
  label: string;
  at: string | null;
  expected: string | null;
  expectedPrefix?: string | null;
  last: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex flex-col items-center shrink-0">
        <span
          className={`w-4 h-4 rounded-full flex items-center justify-center ${
            at ? "bg-emerald-100 text-emerald-600" : "bg-white border border-slate-300 text-slate-400"
          }`}
        >
          {at ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <Circle className="w-2 h-2" />
          )}
        </span>
        {!last && <span className="w-px flex-1 min-h-3 bg-slate-300" />}
      </span>
      <span className={`min-w-0 ${last ? "" : "pb-3"}`}>
        <span className={`block text-xs font-semibold ${at ? "text-slate-900" : "text-slate-500"}`}>
          {label}
        </span>
        <span className="block text-[11px] text-slate-500">
          {at
            ? new Date(at).toLocaleString()
            : expected
              ? `${expectedPrefix ?? "Expected"} ${new Date(expected).toLocaleString()}`
              : "Pending"}
        </span>
      </span>
    </li>
  );
}

function StepNode({ step }: { step: FulfilmentStep }) {
  const done = step.state === "done";
  const active = step.state === "active";
  const blocked = step.state === "blocked";
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1 rounded-[10px] px-2 py-3 bg-slate-50 border border-slate-200">
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
          done
            ? "bg-emerald-100 text-emerald-600"
            : blocked
              ? "bg-red-100 text-red-700"
              : active
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-50 text-slate-500"
        }`}
      >
        {done ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : blocked ? (
          <ShieldAlert className="w-3.5 h-3.5" />
        ) : active ? (
          <Clock className="w-3.5 h-3.5" />
        ) : (
          <Circle className="w-3 h-3" />
        )}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[11px] font-bold leading-tight truncate ${done ? "text-emerald-700" : active ? "text-slate-900" : "text-slate-500"}`}
        >
          {step.label}
        </span>
        <span className="block text-[10px] text-slate-500 truncate">
          {step.at ? new Date(step.at).toLocaleString() : step.hint}
        </span>
      </span>
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  busy,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  body: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="modal-light fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-slate-900 font-bold text-base mb-2">{title}</h3>
        <p className="text-xs text-slate-500 mb-4">{body}</p>
        {children}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-3 rounded-[10px] text-sm text-slate-600 bg-slate-100 border border-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-3 rounded-[10px] text-sm font-bold text-white disabled:opacity-60 inline-flex items-center gap-2 bg-[#E5484D] hover:bg-[#D63D42] transition-colors"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function DisputeModal({
  orderId,
  onClose,
  onSubmitted,
}: {
  orderId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const openFn = useServerFn(openOrderDispute);
  const uploadUrlFn = useServerFn(getDisputeUploadUrl);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("not_delivered");
  const [details, setDetails] = useState("");
  const [paths, setPaths] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const scrollY = window.scrollY;
    const previousBody = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBody.overflow;
      document.body.style.position = previousBody.position;
      document.body.style.top = previousBody.top;
      document.body.style.width = previousBody.width;
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 5 - paths.length);
    setBusy(true);
    try {
      for (const f of list) {
        const { path, token } = await uploadUrlFn({ data: { filename: f.name } });
        const { error } = await supabase.storage
          .from("post-media")
          .uploadToSignedUrl(path, token, f);
        if (error) throw new Error(error.message);
        setPaths((p) => [...p, path]);
        setPreviews((p) => [...p, URL.createObjectURL(f)]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (details.trim().length < 10) {
      toast.error("Add at least a short description of what went wrong.");
      return;
    }
    setBusy(true);
    try {
      await openFn({ data: { orderId, reason, details: details.trim(), imagePaths: paths } });
      toast.success("Dispute submitted. Our team will review it.");
      onSubmitted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="modal-light fixed inset-0 z-[100] flex items-center justify-center bg-newsfeed-ink/55 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-title"
    >
      <div className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-surface shadow-newsfeed-panel">
        <div className="grid h-1.5 shrink-0 grid-cols-5" aria-hidden="true">
          <span className="bg-newsfeed-coral" />
          <span className="bg-newsfeed-gold" />
          <span className="bg-newsfeed-green" />
          <span className="bg-newsfeed-blue" />
          <span className="bg-newsfeed-violet" />
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-newsfeed-coral-soft text-newsfeed-coral">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 id="dispute-title" className="text-base font-extrabold text-newsfeed-ink sm:text-lg">
                  Open a dispute
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-newsfeed-ink">
                  Oventric will review your case and mediate with the seller.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={busy}
              aria-label="Close dispute form"
              className="h-9 w-9 shrink-0 rounded-[10px] text-newsfeed-ink hover:bg-newsfeed-blue-soft"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-4 rounded-[10px] border border-newsfeed-blue/20 bg-newsfeed-blue-soft p-3 text-xs leading-relaxed text-newsfeed-ink">
            Share clear details and evidence. Paid funds remain protected while the dispute is reviewed.
          </div>

          <label htmlFor="dispute-reason" className="mb-1.5 block text-[11px] font-bold uppercase text-newsfeed-ink">
            What went wrong?
          </label>
          <select
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
            className="mb-4 w-full rounded-[10px] border border-newsfeed-line bg-newsfeed-surface px-3 py-3 text-sm font-medium text-newsfeed-ink outline-none focus:border-newsfeed-violet focus:ring-2 focus:ring-newsfeed-violet/20"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <label htmlFor="dispute-details" className="mb-1.5 block text-[11px] font-bold uppercase text-newsfeed-ink">
            Details
          </label>
          <textarea
            id="dispute-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            placeholder="Explain what happened, including dates and what the seller said."
            className="mb-4 w-full resize-none rounded-[10px] border border-newsfeed-line bg-newsfeed-surface px-3 py-3 text-sm text-newsfeed-ink outline-none placeholder:text-newsfeed-muted focus:border-newsfeed-violet focus:ring-2 focus:ring-newsfeed-violet/20"
          />

          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="dispute-evidence" className="text-[11px] font-bold uppercase text-newsfeed-ink">
              Evidence
            </label>
            <span className="text-[11px] font-medium text-newsfeed-ink">Up to 5 images</span>
          </div>
          <label
            htmlFor="dispute-evidence"
            className="mb-4 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-newsfeed-gold/35 bg-newsfeed-gold-soft px-3 py-3 text-sm font-bold text-newsfeed-ink transition-colors hover:border-newsfeed-gold"
          >
            <ImagePlus className="h-4 w-4 text-newsfeed-gold" /> Add screenshots
            <input
              id="dispute-evidence"
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
          {previews.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {previews.map((u) => (
                <img
                  loading="lazy"
                  decoding="async"
                  key={u}
                  src={u}
                  alt="Evidence preview"
                  className="h-16 w-16 rounded-[10px] border border-newsfeed-line object-cover"
                />
              ))}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-newsfeed-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
              className="h-11 rounded-[10px] border-newsfeed-line bg-newsfeed-surface font-bold text-newsfeed-ink hover:bg-newsfeed-blue-soft"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={busy}
              className="h-11 rounded-[10px] bg-newsfeed-coral font-extrabold text-newsfeed-on-accent hover:bg-newsfeed-coral/90"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit dispute
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

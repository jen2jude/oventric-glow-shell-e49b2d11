import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  Upload,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
        toast.success("Receipt confirmed. Seller wallet funded.");
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
      window.location.href = `/?dm=${peerId}`;
    }
  };

  if (err) {
    return (
      <div className="rounded-[10px] border border-red-500/40 bg-[#1E1E24] md:bg-white p-4 text-sm text-red-300">
        {err}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-[10px] border border-white/10 md:border-slate-200 bg-[#1E1E24] md:bg-white p-4 text-sm text-slate-400 md:text-slate-500 flex items-center gap-2">
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
    <div className="rounded-[10px] border border-white/10 md:border-slate-200 bg-[#1E1E24] md:bg-white p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-white md:text-slate-900 font-bold text-base">Payment fulfilment</h2>
          <p className="text-xs text-slate-500 truncate">
            {data.productName} · {formatMoney(data.displayTotal, data.displayCurrency)} · Order{" "}
            {data.orderId.slice(0, 8)}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
            data.disputeStatus === "open"
              ? "bg-red-500/15 text-red-300"
              : data.escrowStatus === "released"
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-amber-500/15 text-amber-300"
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

      {data.escrowStatus === "held" && auto && data.deliveredAt && (
        <div className="flex items-center gap-2 text-[11px] text-amber-200 bg-amber-500/5 border border-amber-500/30 rounded-[10px] px-3 py-3 mb-3">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Auto-confirms in {auto} if you don't act. Funds then release to the seller.
        </div>
      )}
      {data.role === "seller" && data.deliveredAt && data.escrowStatus === "held" && (
        <div className="text-[11px] text-slate-400 md:text-slate-500 bg-[#121214] md:bg-slate-50 border border-white/10 md:border-slate-200 rounded-[10px] px-3 py-3 mb-3">
          Waiting for the buyer to confirm receipt{auto ? ` — auto-releases in ${auto}` : ""}.
        </div>
      )}
      {data.dispute && (
        <div className="rounded-[10px] border border-red-500/40 bg-red-500/5 p-3 mb-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-red-300 mb-1">
            Dispute · {data.dispute.status}
          </div>
          <div className="text-xs text-slate-300 md:text-slate-600 whitespace-pre-wrap">
            {data.dispute.details}
          </div>
          {data.dispute.imageUrls.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {data.dispute.imageUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noreferrer">
                  <img loading="lazy" decoding="async"
                    src={u}
                    alt="Dispute evidence"
                    className="w-16 h-16 object-cover rounded border border-white/10 md:border-slate-200"
                  />
                </a>
              ))}
            </div>
          )}
          {data.dispute.adminNote && (
            <div className="text-[11px] text-emerald-300 mt-2">Admin: {data.dispute.adminNote}</div>
          )}
        </div>
      )}

      <div className="rounded-[10px] border border-emerald-500/30 bg-emerald-500/5 px-3 py-3 mb-3 text-[11px] text-emerald-100 leading-relaxed">
        <strong className="text-emerald-200">Keep this trade on Oventric.</strong> Payments are held
        in escrow and we can only refund or mediate deals completed in-app. Deliver, chat and
        confirm here — never on WhatsApp or any other app.
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canDeliver && (
          <button
            onClick={() => setConfirmModal("deliver")}
            className="inline-flex items-center gap-2 px-3.5 py-3 rounded-[10px] text-sm font-bold text-black"
            style={{ backgroundColor: "#3b82f6" }}
          >
            <Truck className="w-4 h-4" /> Mark as delivered
          </button>
        )}
        {canConfirm && (
          <button
            onClick={() => setConfirmModal("receive")}
            className="inline-flex items-center gap-2 px-3.5 py-3 rounded-[10px] text-sm font-bold text-black"
            style={{ backgroundColor: "#3b82f6" }}
          >
            <CheckCircle2 className="w-4 h-4" /> Confirm I received it
          </button>
        )}
        <button
          onClick={contactPeer}
          className="inline-flex items-center gap-2 px-3.5 py-3 rounded-[10px] text-sm font-semibold text-white md:text-slate-900 bg-[#2A2A31] md:bg-slate-100 border border-white/10 md:border-slate-200"
        >
          <MessageCircle className="w-4 h-4" />
          {data.role === "seller" ? "Contact buyer" : "Contact seller"}
        </button>
        {canDispute && (
          <button
            onClick={() => setShowDispute(true)}
            className="inline-flex items-center gap-2 px-3.5 py-3 rounded-[10px] text-sm font-semibold text-red-300 bg-[#2A2A31] md:bg-slate-100 border border-red-500/40"
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
              ? "We'll post your delivery note in the buyer's chat. They get 48 hours to confirm — after that funds auto-release to your wallet."
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
                className="w-full rounded-[10px] bg-[#121214] md:bg-slate-50 border border-white/10 md:border-slate-200 px-3 py-3 text-sm text-white md:text-slate-900 placeholder:text-slate-600"
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

function StepNode({ step }: { step: FulfilmentStep }) {
  const done = step.state === "done";
  const active = step.state === "active";
  const blocked = step.state === "blocked";
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1 rounded-[10px] px-2 py-3 bg-[#121214] md:bg-slate-50 border border-white/10 md:border-slate-200">
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
          done
            ? "bg-emerald-500/20 text-emerald-300"
            : blocked
              ? "bg-red-500/15 text-red-300"
              : active
                ? "bg-amber-500/15 text-amber-300"
                : "bg-white/5 md:bg-slate-50 text-slate-500"
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
          className={`block text-[11px] font-bold leading-tight truncate ${done ? "text-emerald-200" : active ? "text-white md:text-slate-900" : "text-slate-400 md:text-slate-500"}`}
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
      <div className="w-full max-w-sm rounded-xl border border-white/10 md:border-slate-200 bg-[#1E1E24] md:bg-white p-5">
        <h3 className="text-white md:text-slate-900 font-bold text-base mb-2">{title}</h3>
        <p className="text-xs text-slate-400 md:text-slate-500 mb-4">{body}</p>
        {children}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-3 rounded-[10px] text-sm text-slate-300 md:text-slate-600 bg-[#2A2A31] md:bg-slate-100 border border-white/10 md:border-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-3 rounded-[10px] text-sm font-bold text-black disabled:opacity-60 inline-flex items-center gap-2"
            style={{ backgroundColor: "#3b82f6" }}
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

  return (
    <div className="modal-light fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-white/10 md:border-slate-200 bg-[#1E1E24] md:bg-white p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-white md:text-slate-900 font-bold text-base">Open a dispute</h3>
            <p className="text-xs text-slate-500">
              Admin will review your case and mediate with the seller.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-[10px] text-slate-400 md:text-slate-500 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:bg-slate-50 md:hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1">
          What went wrong?
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as typeof reason)}
          className="w-full mb-3 rounded-[10px] bg-[#121214] md:bg-slate-50 border border-white/10 md:border-slate-200 px-3 py-3 text-sm text-white md:text-slate-900"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1">
          Details
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={5}
          placeholder="Explain what happened, including dates and what the seller said."
          className="w-full mb-3 rounded-[10px] bg-[#121214] md:bg-slate-50 border border-white/10 md:border-slate-200 px-3 py-3 text-sm text-white md:text-slate-900 placeholder:text-slate-600"
        />

        <label className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1">
          Evidence (up to 5 images)
        </label>
        <label className="inline-flex items-center gap-2 px-3 py-3 rounded-[10px] text-sm text-slate-200 md:text-slate-700 bg-[#2A2A31] md:bg-slate-100 border border-white/10 md:border-slate-200 cursor-pointer mb-3">
          <Upload className="w-4 h-4" /> Add screenshots
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {previews.map((u) => (
              <img loading="lazy" decoding="async"
                key={u}
                src={u}
                alt="Evidence preview"
                className="w-16 h-16 object-cover rounded border border-white/10 md:border-slate-200"
              />
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-3 rounded-[10px] text-sm text-slate-300 md:text-slate-600 bg-[#2A2A31] md:bg-slate-100 border border-white/10 md:border-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-3 rounded-[10px] text-sm font-bold text-white md:text-slate-900 disabled:opacity-60 inline-flex items-center gap-2"
            style={{ backgroundColor: "#dc2626" }}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Submit dispute
          </button>
        </div>
      </div>
    </div>
  );
}

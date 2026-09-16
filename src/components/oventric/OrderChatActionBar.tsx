import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buyerConfirmReceipt,
  getDisputeUploadUrl,
  openOrderDispute,
} from "@/lib/fulfilment.functions";
import type { PeerOrderContext } from "@/lib/messaging/messages.functions";

const ISSUE_REASONS: Array<{
  value: "not_delivered" | "wrong_item" | "not_working" | "seller_unreachable" | "other";
  label: string;
}> = [
  { value: "not_delivered", label: "I haven't received it" },
  { value: "not_working", label: "Received, but it isn't working" },
  { value: "seller_unreachable", label: "The seller isn't replying" },
  { value: "wrong_item", label: "I received the wrong item" },
  { value: "other", label: "Something else" },
];

function countdown(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Floating buyer controls pinned above the chat composer: confirm delivery
 * (irreversible, behind a warning) or report an issue (freezes escrow).
 */
export function OrderChatActionBar({
  ctx,
  onChanged,
}: {
  ctx: PeerOrderContext | null;
  onChanged: () => void;
}) {
  const confirmFn = useServerFn(buyerConfirmReceipt);
  const [warn, setWarn] = useState(false);
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!ctx) return null;
  const active =
    ctx.role === "buyer" &&
    ctx.requiresManualDelivery &&
    ctx.escrowStatus === "held" &&
    ctx.disputeStatus !== "open" &&
    !ctx.buyerConfirmedAt;
  if (!active) return null;

  const deadline = ctx.deliveredAt ? ctx.autoReleaseAt : ctx.autoRefundAt;
  const left = countdown(deadline);

  const doConfirm = async () => {
    setBusy(true);
    try {
      await confirmFn({ data: { orderId: ctx.orderId } });
      toast.success("Delivery confirmed — thank you! Please leave a review.");
      setWarn(false);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sticky bottom-0 z-20 px-3 pb-2 pt-2 bg-background">
        <div className="rounded-[10px] border border-border bg-background shadow-sm p-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWarn(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90"
            >
              <CheckCircle2 className="w-4 h-4" /> Confirm delivery
            </button>
            <button
              onClick={() => setReport(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-xs font-bold text-destructive bg-destructive/5 border border-destructive/20 hover:bg-destructive/10"
            >
              <ShieldAlert className="w-4 h-4" /> Report issue
            </button>
          </div>
          {left && (
            <div className="mt-1.5 text-[10px] text-center text-slate-500">
              {ctx.deliveredAt
                ? `Auto-confirms in ${left} if you don't act`
                : `Auto-refunds to your wallet in ${left} if the seller doesn't deliver`}
            </div>
          )}
        </div>
      </div>

      {warn && (
        <div className="modal-light fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-amber-500/40 bg-[#1E1E24] md:bg-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-white md:text-slate-900 font-bold text-base">
                Confirm you received it?
              </h3>
            </div>
            <p className="text-xs text-slate-400 md:text-slate-600 leading-relaxed mb-4">
              Only continue if you have received the item <strong>and it works</strong>. This
              releases the payment to the seller after a short hold and{" "}
              <span className="text-amber-300 md:text-amber-700 font-semibold">cannot be undone</span>
              . If anything is wrong, close this and tap <em>Report issue</em> instead.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setWarn(false)}
                className="px-3 py-2.5 rounded-[10px] text-sm text-slate-300 md:text-slate-600 bg-[#2A2A31] md:bg-slate-100 border border-white/10 md:border-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => void doConfirm()}
                disabled={busy}
                className="px-4 py-2.5 rounded-[10px] text-sm font-bold text-black bg-emerald-500 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Yes, confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {report && (
        <ReportIssueModal
          orderId={ctx.orderId}
          onClose={() => setReport(false)}
          onSubmitted={() => {
            setReport(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ReportIssueModal({
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
  const [reason, setReason] = useState<(typeof ISSUE_REASONS)[number]["value"]>("not_delivered");
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
      toast.error("Tell us a little more about what went wrong.");
      return;
    }
    setBusy(true);
    try {
      await openFn({ data: { orderId, reason, details: details.trim(), imagePaths: paths } });
      toast.success("Issue reported. The seller and our team have been notified.");
      onSubmitted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-light fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-white/10 md:border-slate-200 bg-[#1E1E24] md:bg-white p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-white md:text-slate-900 font-bold text-base">Report an issue</h3>
            <p className="text-xs text-slate-500">
              Escrow is frozen while the seller and our team review this.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-[10px] text-slate-400 md:text-slate-500 hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1">
          What happened?
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as typeof reason)}
          className="w-full mb-3 rounded-[10px] bg-[#121214] md:bg-slate-50 border border-white/10 md:border-slate-200 px-3 py-3 text-sm text-white md:text-slate-900"
        >
          {ISSUE_REASONS.map((r) => (
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
          placeholder="Explain what happened — what you received, what isn't working, and when you last heard from the seller."
          className="w-full mb-3 rounded-[10px] bg-[#121214] md:bg-slate-50 border border-white/10 md:border-slate-200 px-3 py-3 text-sm text-white md:text-slate-900 placeholder:text-slate-600"
        />

        <label className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1">
          Proof (optional, up to 5 images)
        </label>
        <label className="inline-flex items-center gap-2 px-3 py-3 rounded-[10px] text-sm text-slate-200 md:text-slate-700 bg-[#2A2A31] md:bg-slate-100 border border-white/10 md:border-slate-200 cursor-pointer mb-3">
          <Upload className="w-4 h-4" /> Upload screenshots
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
              <img
                loading="lazy"
                decoding="async"
                key={u}
                src={u}
                alt="Proof preview"
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
            onClick={() => void submit()}
            disabled={busy}
            className="px-4 py-3 rounded-[10px] text-sm font-bold text-white disabled:opacity-60 inline-flex items-center gap-2"
            style={{ backgroundColor: "#dc2626" }}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

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
      toast.success("Receipt confirmed — trade complete. Please leave a review.");
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
      <div className="shrink-0 border-t border-border bg-background px-3 pb-2 pt-2 sm:px-6">
        <div className="rounded-[10px] border border-border bg-muted/35 p-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWarn(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90"
            >
              <CheckCircle2 className="w-4 h-4" /> Received — complete trade
            </button>
            <button
              onClick={() => setReport(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-xs font-bold text-destructive bg-destructive/5 border border-destructive/20 hover:bg-destructive/10"
            >
              <ShieldAlert className="w-4 h-4" /> Report issue
            </button>
          </div>
          {left && (
            <div className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {ctx.deliveredAt
                ? `Auto-confirms in ${left} if you don't act`
                : `Auto-refunds to your wallet in ${left} if the seller doesn't deliver`}
            </div>
          )}
        </div>
      </div>

      {warn && (
        <div className="web-chat fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-2xl border border-border bg-background p-5 shadow-2xl sm:max-w-md sm:rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="font-wallet-display text-base font-bold text-foreground">
                Confirm you received it?
              </h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              Only continue if you have received the item <strong>and it works</strong>. This
              releases the payment to the seller after a short hold and{" "}
              <span className="font-semibold text-amber-700">cannot be undone</span>
              . If anything is wrong, close this and tap <em>Report issue</em> instead.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setWarn(false)}
                className="rounded-[10px] border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => void doConfirm()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
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
    <div className="web-chat fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-background p-5 shadow-2xl sm:max-w-lg sm:rounded-xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-wallet-display text-base font-bold text-foreground">Report an issue</h3>
            <p className="text-xs text-muted-foreground">
              Escrow is frozen while the seller and our team review this.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-[10px] p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="mb-1 block text-[11px] uppercase tracking-widest text-muted-foreground">
          What happened?
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as typeof reason)}
          className="mb-3 w-full rounded-[10px] border border-border bg-muted/50 px-3 py-3 text-sm text-foreground"
        >
          {ISSUE_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-[11px] uppercase tracking-widest text-muted-foreground">
          Details
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={5}
          placeholder="Explain what happened — what you received, what isn't working, and when you last heard from the seller."
          className="mb-3 w-full rounded-[10px] border border-border bg-muted/50 px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground"
        />

        <label className="mb-1 block text-[11px] uppercase tracking-widest text-muted-foreground">
          Proof (optional, up to 5 images)
        </label>
        <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-muted px-3 py-3 text-sm text-foreground">
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
                className="h-16 w-16 rounded border border-border object-cover"
              />
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-[10px] border border-border bg-muted px-3 py-3 text-sm text-muted-foreground"
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

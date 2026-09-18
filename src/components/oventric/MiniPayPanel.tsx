import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, CheckCircle2, Copy, X, ShieldCheck, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  createManualPayment,
  getProofUploadUrl,
  attachManualProof,
} from "@/lib/manual-payments.functions";
import { formatMoney } from "@/lib/fx-display";
import { BINANCE_USER_ID, MANUAL_RAIL_LABEL, type ManualRail } from "@/lib/payments/active-rails";
import minipayQrAsset from "@/assets/minipay-qr.jpg.asset.json";

interface Props {
  /** Manual rail: MiniPay transfer or Binance User ID transfer. */
  rail?: ManualRail;
  purpose: "order" | "course" | "bounty";
  targetId?: string | null;
  quantity?: number;
  couponCode?: string | null;
  /** Bounty funding only — the poster's chosen amount, in `currency`. */
  amount?: number;
  currency: string;
  onClose: () => void;
}

/**
 * MiniPay is a manual rail: the buyer sends the transfer themselves, uploads a
 * receipt, and a reviewer releases the purchase. No card is charged here.
 */
export function MiniPayPanel({
  rail = "minipay",
  purpose,
  targetId,
  quantity = 1,
  couponCode = null,
  amount,
  currency,
  onClose,
}: Props) {
  const create = useServerFn(createManualPayment);
  const getUpload = useServerFn(getProofUploadUrl);
  const attach = useServerFn(attachManualProof);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{
    id: string;
    reference: string;
    amount: number;
    currency: string;
  } | null>(null);
  const [instructions, setInstructions] = useState<{
    handle: string | null;
    accountName: string | null;
    binanceUserId: string | null;
    instructions: string | null;
  }>({
    handle: null,
    accountName: null,
    binanceUserId: null,
    instructions: null,
  });
  const [payerRef, setPayerRef] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    create({
      data: { provider: rail, purpose, targetId: targetId ?? null, quantity, couponCode, amount, currency },
    })
      .then((res) => {
        setPayment({
          id: res.payment.id,
          reference: res.payment.reference,
          amount: res.payment.amount,
          currency: res.payment.currency,
        });
        setInstructions(res.instructions);
      })
      .catch((e: Error) => setError(e.message || "Could not start this payment"))
      .finally(() => setLoading(false));
  }, [create, rail, purpose, targetId, quantity, couponCode, amount, currency]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success("Copied");
  };

  const onPick = async (file: File | null) => {
    if (!file || !payment) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Receipt too large", { description: "Please upload an image under 8MB." });
      return;
    }
    setUploading(true);
    try {
      const { path, token } = await getUpload({ data: { filename: file.name } });
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .uploadToSignedUrl(path, token, file);
      if (upErr) throw new Error(upErr.message);
      await attach({ data: { id: payment.id, proofPath: path, payerNote: payerRef.trim() || null } });
      setDone(true);
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-light fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full sm:max-w-md bg-[#141418] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-black text-white">Pay with {MANUAL_RAIL_LABEL[rail]}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[10px] hover:bg-white/10 text-slate-400"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {loading && (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-500 mt-3">Preparing your payment instructions…</p>
            </div>
          )}

          {error && <p className="text-sm text-rose-400">{error}</p>}

          {payment && !done && (
            <>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                {rail === "minipay" && (
                  <div className="flex justify-center mb-4">
                    <div className="relative p-2 bg-white rounded-xl">
                      <img loading="lazy" decoding="async"
                        src={minipayQrAsset.url}
                        alt="MiniPay QR Code"
                        className="w-48 h-48 object-contain"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                        <QrCode className="w-24 h-24 text-black" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="text-[11px] uppercase tracking-wider text-emerald-300/90 font-bold mb-1">
                  Amount to send
                </div>
                <div className="text-3xl font-black text-white">
                  {formatMoney(payment.amount, payment.currency)}
                </div>
                <p className="mt-3 text-[10px] text-amber-300/90 font-medium bg-amber-500/10 py-1.5 px-3 rounded-full border border-amber-500/20">
                  Pay the full amount or your transaction won't be confirmed
                </p>
              </div>

              {rail === "minipay" ? (
                <>
                  <Row label="MiniPay Account Number" value="+234 803 434 7661" onCopy={copy} />
                  <Row label="MiniPay handle" value={instructions.handle ?? "oventric"} onCopy={copy} />
                </>
              ) : (
                <Row
                  label="Binance User ID"
                  value={instructions.binanceUserId ?? BINANCE_USER_ID}
                  onCopy={copy}
                />
              )}
              <Row label="Payment reference" value={payment.reference} onCopy={copy} />

              {instructions.instructions && (
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
                  {instructions.instructions}
                </p>
              )}

              <div className="rounded-xl border border-white/10 bg-[#1E1E24] p-4">
                <p className="text-xs text-slate-400 mb-3">
                  Send the exact amount, add your transfer details, then upload your receipt. Only
                  Oventric finance can confirm this payment — the seller cannot.
                </p>
                <input
                  value={payerRef}
                  onChange={(e) => setPayerRef(e.target.value)}
                  placeholder={
                    rail === "binance"
                      ? "Binance order / transaction ID and sender name"
                      : "Transfer reference and sender name"
                  }
                  className="mb-3 w-full rounded-[10px] border border-white/10 bg-[#141418] px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || payerRef.trim().length < 3}
                  className="w-full rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-bold text-sm py-2.5 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? "Uploading…" : "Upload payment receipt"}
                </button>
              </div>
            </>
          )}

          {done && (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-black text-white">Receipt received</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Oventric finance is verifying your {MANUAL_RAIL_LABEL[rail]} transfer. You&apos;ll get a notification the
                moment it clears
                {purpose === "order"
                  ? " and your order goes live."
                  : " and the amount lands in your wallet."}
              </p>
              <button
                onClick={onClose}
                className="mt-5 w-full rounded-[10px] bg-white/10 hover:bg-white/15 text-white font-bold text-sm py-2.5"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/10 bg-[#1E1E24] px-3 py-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </div>
        <div className="text-sm text-white font-mono truncate">{value}</div>
      </div>
      <button
        onClick={() => onCopy(value)}
        className="p-1.5 rounded-[10px] hover:bg-white/10 text-slate-400 shrink-0"
        aria-label={`Copy ${label}`}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

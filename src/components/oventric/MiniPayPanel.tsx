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
import {
  BINANCE_USER_ID,
  MANUAL_RAIL_LABEL,
  type ManualDestination,
  type ManualRail,
} from "@/lib/payments/active-rails";
import minipayQrAsset from "@/assets/minipay-qr.jpg.asset.json";
import { Button } from "@/components/ui/button";

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
  /** Crypto rail: which exchange ID / wallet address the buyer must pay. */
  destination?: ManualDestination | null;
  /** Shown in the copied order summary the buyer sends the seller. */
  productName?: string | null;
  /** Direct chat link to the seller, e.g. /messages?dm=<sellerId>. */
  chatHref?: string | null;
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
  destination = null,
  productName = null,
  chatHref = null,
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
  const [orderSummary, setOrderSummary] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const scrollY = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, []);

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
        // Put the order details on the clipboard straight away so the buyer can
        // paste them to the seller in chat without typing anything.
        const summary = [
          `Oventric payment — ${MANUAL_RAIL_LABEL[rail]}${destination ? ` (${destination.label})` : ""}`,
          productName ? `Item: ${productName}` : null,
          `Order / Payment ID: ${res.payment.reference}`,
          `Amount: ${formatMoney(res.payment.amount, res.payment.currency)}`,
          "I have sent this payment — please confirm.",
        ]
          .filter(Boolean)
          .join("\n");
        setOrderSummary(summary);
        navigator.clipboard?.writeText(summary).then(
          () => toast.success("Order ID copied", { description: "Paste it to the seller in chat." }),
          () => undefined,
        );
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
    <div className="modal-light fixed inset-0 z-[120] flex items-center justify-center bg-newsfeed-ink/55 p-3 sm:p-4">
      <div className="relative flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-surface shadow-2xl sm:max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div aria-hidden="true" className="grid h-1 shrink-0 grid-cols-5">
          <span className="bg-newsfeed-coral" />
          <span className="bg-newsfeed-gold" />
          <span className="bg-newsfeed-green" />
          <span className="bg-newsfeed-blue" />
          <span className="bg-newsfeed-violet" />
        </div>
        <div className="flex items-center justify-between border-b border-newsfeed-line bg-newsfeed-surface px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-newsfeed-green-soft text-newsfeed-green">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-black text-newsfeed-ink">
              Pay with {destination?.label ?? MANUAL_RAIL_LABEL[rail]}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="rounded-full border border-newsfeed-line bg-newsfeed-canvas text-newsfeed-ink hover:bg-newsfeed-coral-soft hover:text-newsfeed-coral"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto overscroll-contain p-4 text-newsfeed-ink">
          {loading && (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-newsfeed-green" />
              <p className="mt-3 text-xs text-newsfeed-muted">Preparing your payment instructions…</p>
            </div>
          )}

          {error && <p className="rounded-[10px] bg-newsfeed-coral-soft p-3 text-sm font-semibold text-newsfeed-coral">{error}</p>}

          {payment && !done && (
            <>
              <div className="rounded-[10px] border border-newsfeed-green/25 bg-newsfeed-green-soft p-4 text-center">
                {rail === "minipay" && !destination && (
                  <div className="flex justify-center mb-4">
                    <div className="relative rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-2 shadow-sm">
                      <img loading="lazy" decoding="async"
                        src={minipayQrAsset.url}
                        alt="MiniPay QR Code"
                        className="w-48 h-48 object-contain"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                         <QrCode className="w-24 h-24 text-newsfeed-ink" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mb-1 text-[11px] font-bold uppercase text-newsfeed-green">
                  Amount to send
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => copy(String(payment.amount))}
                  className="h-auto px-2 py-1 text-3xl font-black text-newsfeed-ink hover:bg-newsfeed-surface/70"
                  aria-label="Copy amount"
                >
                  {formatMoney(payment.amount, payment.currency)}
                  <Copy className="w-4 h-4 text-newsfeed-green" />
                </Button>
                <p className="mt-3 rounded-full border border-newsfeed-gold/30 bg-newsfeed-gold-soft px-3 py-1.5 text-[10px] font-bold text-newsfeed-ink">
                  Pay the full amount or your transaction won't be confirmed
                </p>
              </div>

              {rail === "minipay" && !destination ? (
                <>
                  <Row label="MiniPay Account Number" value="+234 803 434 7661" onCopy={copy} />
                  <Row label="MiniPay handle" value={instructions.handle ?? "oventric"} onCopy={copy} />
                </>
              ) : destination ? (
                <>
                  <Row label={destination.addressLabel} value={destination.address} onCopy={copy} />
                  {destination.extraRows?.map((r) => (
                    <Row key={r.label} label={r.label} value={r.value} onCopy={copy} />
                  ))}
                  {destination.network && !destination.extraRows && (
                    <p className="rounded-[10px] bg-newsfeed-gold-soft p-3 text-[11px] font-medium text-newsfeed-ink">
                      Send only on <span className="font-bold">{destination.network}</span>. Funds
                      sent on another network cannot be recovered.
                    </p>
                  )}
                </>
              ) : (
                <Row
                  label="Binance User ID"
                  value={instructions.binanceUserId ?? BINANCE_USER_ID}
                  onCopy={copy}
                />
              )}
              <Row label="Order / Payment ID" value={payment.reference} onCopy={copy} />

              {instructions.instructions && (
                <p className="whitespace-pre-line text-xs leading-relaxed text-newsfeed-muted">
                  {instructions.instructions}
                </p>
              )}

              <div className="space-y-3 rounded-[10px] border border-newsfeed-blue/25 bg-newsfeed-blue-soft p-4">
                <p className="text-xs font-medium leading-relaxed text-newsfeed-ink">
                  This payment is confirmed manually — it is not automatic. After sending, message
                  the seller your Order / Payment ID so your order is confirmed quickly. We already
                  copied the full order details for you.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copy(orderSummary || payment.reference)}
                    className="h-9 flex-1 rounded-[10px] border-newsfeed-blue/30 bg-newsfeed-surface text-xs font-bold text-newsfeed-blue hover:bg-newsfeed-blue-soft"
                  >
                    Copy order details
                  </Button>
                  {chatHref && (
                    <a
                      href={chatHref}
                      className="flex h-9 flex-1 items-center justify-center rounded-[10px] bg-newsfeed-blue px-3 text-center text-xs font-bold text-newsfeed-surface transition-opacity hover:opacity-90"
                    >
                      Message seller
                    </a>
                  )}
                </div>
              </div>

              <div className="rounded-[10px] border border-newsfeed-violet/25 bg-newsfeed-violet-soft p-4">
                <p className="mb-3 text-xs font-medium text-newsfeed-ink">
                  Send the exact amount, add your transfer details, then upload your receipt.
                </p>
                <input
                  value={payerRef}
                  onChange={(e) => setPayerRef(e.target.value)}
                  placeholder={
                    rail === "binance"
                      ? "Binance order / transaction ID and sender name"
                      : "Transfer reference and sender name"
                  }
                  className="mb-3 w-full rounded-[10px] border border-newsfeed-line bg-newsfeed-surface px-3 py-2.5 text-sm text-newsfeed-ink outline-none placeholder:text-newsfeed-muted focus:border-newsfeed-violet focus:ring-2 focus:ring-newsfeed-violet/15"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || payerRef.trim().length < 3}
                  className="h-11 w-full rounded-[10px] bg-newsfeed-violet text-sm font-bold text-newsfeed-surface hover:bg-newsfeed-violet/90"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? "Uploading…" : "Upload payment receipt"}
                </Button>
              </div>
            </>
          )}

          {done && (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-newsfeed-green" />
              <h3 className="text-base font-black text-newsfeed-ink">Receipt received</h3>
              <p className="mt-2 text-xs leading-relaxed text-newsfeed-muted">
                Oventric finance is verifying your {MANUAL_RAIL_LABEL[rail]} transfer. You&apos;ll get a notification the
                moment it clears
                {purpose === "order"
                  ? " and your order goes live."
                  : " and the amount lands in your wallet."}
              </p>
              <Button
                type="button"
                onClick={onClose}
                className="mt-5 h-11 w-full rounded-[10px] bg-newsfeed-green text-sm font-bold text-newsfeed-surface hover:bg-newsfeed-green/90"
              >
                Done
              </Button>
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
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-newsfeed-line bg-newsfeed-canvas px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase text-newsfeed-muted">
          {label}
        </div>
        <div className="truncate font-mono text-sm font-bold text-newsfeed-ink">{value}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onCopy(value)}
        className="shrink-0 rounded-[10px] text-newsfeed-blue hover:bg-newsfeed-blue-soft hover:text-newsfeed-blue"
        aria-label={`Copy ${label}`}
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

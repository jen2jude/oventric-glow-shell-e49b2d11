/**
 * App-native Add Funds sheet — dark signature slide-up used inside the app
 * shell. Shares the same Paystack funding rail as the website's
 * AddCapitalModal (bank transfer or card via initPayment).
 */
import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Landmark, Lock, ShieldCheck, X } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useServerFn } from "@tanstack/react-start";
import { initPayment } from "@/lib/payments.functions";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";

const PRESETS = ["1000", "5000", "10000", "25000", "50000"];

function formatNumberInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function parseAmount(formatted: string) {
  return Number(formatted.replace(/,/g, "")) || 0;
}

const methods = [
  {
    id: "bank",
    label: "Bank transfer",
    desc: "Transfer, USSD, Opay and other bank channels",
    icon: Landmark,
  },
  {
    id: "card",
    label: "Debit or credit card",
    desc: "Visa, Mastercard and Verve — funded instantly",
    icon: CreditCard,
  },
];

export function AppAddFundsSheet({ onClose }: { onClose: () => void }) {
  const { homeCurrency } = useOnboarding();
  const [method, setMethod] = useState<string>("bank");
  const [amountDisplay, setAmountDisplay] = useState<string>("5,000");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const startPayment = useServerFn(initPayment);

  const amount = parseAmount(amountDisplay);
  const symbol = useMemo(() => {
    if (homeCurrency === "GHS") return "₵";
    if (homeCurrency === "USD") return "$";
    return "₦";
  }, [homeCurrency]);

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

  const close = () => {
    setVisible(false);
    window.setTimeout(onClose, 280);
  };

  const handleContinue = async () => {
    if (amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    haptic("select");
    setLoading(true);
    try {
      const result = await startPayment({
        data: {
          purpose: "wallet_topup",
          amount,
          currency: homeCurrency,
          channel: method === "bank" ? "bank_transfer" : "card",
          returnTo: "/wallet",
        },
      });
      if (result?.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      } else {
        toast.error("Unable to start payment. Try again.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Add funds">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      {/* Sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border-t border-white/[0.08] bg-[#101013] text-white shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out ${visible ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Handle + header */}
        <div className="shrink-0 pt-2.5">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/15" />
          <div className="flex items-center justify-between px-5 pb-1 pt-3">
            <div>
              <p className="text-[15px] font-bold tracking-tight">Add funds</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/40">
                <ShieldCheck className="h-3 w-3 text-[#E5484D]" /> Secure checkout
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
          {/* Method picker */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">Pay with</p>
          <div className="mt-2 space-y-2">
            {methods.map((m) => {
              const Icon = m.icon;
              const selected = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    haptic("select");
                    setMethod(m.id);
                  }}
                  aria-pressed={selected}
                  className={`nav-tap flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                    selected
                      ? "border-[#E5484D]/50 bg-[#E5484D]/[0.08]"
                      : "border-white/[0.07] bg-white/[0.03]"
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      selected ? "bg-[#E5484D] text-white" : "bg-white/[0.06] text-white/50"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">{m.label}</span>
                    <span className="mt-0.5 block text-[11px] text-white/40">{m.desc}</span>
                  </span>
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      selected ? "border-[#E5484D] bg-[#E5484D] text-white" : "border-white/15"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Amount */}
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-widest text-white/35">Amount ({homeCurrency})</p>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
            <span className="text-xl font-bold text-white/40">{symbol}</span>
            <input
              inputMode="numeric"
              value={amountDisplay}
              onChange={(e) => setAmountDisplay(formatNumberInput(e.target.value))}
              placeholder="0"
              aria-label={`Amount in ${homeCurrency}`}
              className="w-full flex-1 bg-transparent text-2xl font-bold tabular-nums outline-none placeholder:text-white/20"
            />
            {amountDisplay && (
              <button
                type="button"
                onClick={() => setAmountDisplay("")}
                aria-label="Clear amount"
                className="nav-tap grid size-7 place-items-center rounded-full bg-white/[0.06] text-white/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {PRESETS.map((v) => {
              const formatted = formatNumberInput(v);
              const selected = amountDisplay === formatted;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    haptic("select");
                    setAmountDisplay(formatted);
                  }}
                  className={`nav-tap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold tabular-nums transition-colors ${
                    selected
                      ? "border-[#E5484D] bg-[#E5484D] text-white"
                      : "border-white/[0.08] bg-white/[0.03] text-white/70"
                  }`}
                >
                  {symbol}
                  {formatted}
                </button>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-white/40">Funding amount</span>
              <span className="font-semibold tabular-nums">
                {symbol}
                {amountDisplay || "0"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="text-white/40">Method</span>
              <span className="font-semibold">{methods.find((m) => m.id === method)?.label}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3 text-[12px]">
              <span className="text-white/40">Credited to wallet</span>
              <span className="text-[15px] font-extrabold tabular-nums">
                {symbol}
                {amountDisplay || "0"}
              </span>
            </div>
            <p className="mt-2.5 text-[10px] leading-relaxed text-white/35">
              The payment provider may add its own processing fee at checkout. Your wallet is
              credited with the full amount once payment is confirmed.
            </p>
          </div>
        </div>

        {/* Fixed actions */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#101013] px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
          <button
            type="button"
            onClick={handleContinue}
            disabled={loading || amount <= 0}
            className="nav-tap flex h-12 w-full items-center justify-center rounded-xl bg-[#E5484D] text-[14px] font-bold text-white shadow-[0_10px_28px_-10px_rgba(229,72,77,0.6)] disabled:opacity-50"
          >
            {loading ? "Please wait…" : "Continue to payment"}
          </button>
          <p className="mt-2.5 flex items-center justify-center gap-1 text-[10px] text-white/35">
            <Lock className="h-3 w-3" /> Encrypted and secured by Oventric
          </p>
        </div>
      </div>
    </div>
  );
}

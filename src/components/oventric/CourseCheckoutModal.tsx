import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Loader2,
  CreditCard,
  Building2,
  Smartphone,
  CheckCircle2,
  Tag,
  Sparkles,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { enrollPaid, type EnrollCurrency, type EnrollPaymentMethod } from "@/lib/academy.functions";
import { getWalletBalances } from "@/lib/wallet.functions";
import { validateCoupon } from "@/lib/marketplace.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice, formatMoney, usdRate, validateFxSnapshot } from "@/lib/fx-display";
import { AlertTriangle } from "lucide-react";

// Course checkout is card / bank / mobile-money only. Wallet is intentionally
// excluded — users pay directly and receive cashback (2%) to their cashback
// wallet, which can then be spent on other transactions.
const METHODS: {
  key: Exclude<EnrollPaymentMethod, "wallet">;
  label: string;
  icon: typeof CreditCard;
  hint: string;
}[] = [
  {
    key: "card",
    label: "Debit / Credit card",
    icon: CreditCard,
    hint: "Visa, Mastercard, Verve · Instant",
  },
  {
    key: "bank_transfer",
    label: "Bank transfer",
    icon: Building2,
    hint: "Local bank rails · Instant",
  },
  {
    key: "mobile_money",
    label: "Mobile money",
    icon: Smartphone,
    hint: "MTN, Airtel, MoMo · Instant",
  },
];

interface Course {
  id: string;
  title: string;
  instructorName: string;
  priceUSD: number;
  coverUrl: string | null;
  originalCurrency: EnrollCurrency;
  originalAmount: number;
  fxSnapshot: unknown;
}

export function CourseCheckoutModal({
  open,
  course,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  course: Course | null;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const { homeCurrency } = useOnboarding();
  const runEnroll = useServerFn(enrollPaid);
  const runBalances = useServerFn(getWalletBalances);
  const runCoupon = useServerFn(validateCoupon);

  const [method, setMethod] = useState<Exclude<EnrollPaymentMethod, "wallet">>("card");
  const [couponInput, setCouponInput] = useState("");
  const [couponPct, setCouponPct] = useState(0);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [cashbackUSD, setCashbackUSD] = useState<number>(0);
  const [useCashback, setUseCashback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [earnedDisplay, setEarnedDisplay] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setMethod("card");
    setCouponInput("");
    setCouponPct(0);
    setCouponCode(null);
    setBusy(false);
    setDone(false);
    setEarnedDisplay("");
    setUseCashback(false);
    runBalances()
      .then((b) => {
        setCashbackUSD(b.cashback ?? 0);
      })
      .catch(() => {
        setCashbackUSD(0);
      });
  }, [open, runBalances, homeCurrency]);

  // Snapshot-aware display for the course price. Falls back safely inside
  // computeDisplayPrice when fxSnapshot is missing/invalid.
  const priceDisplay = useMemo(() => {
    if (!course) return null;
    return computeDisplayPrice(
      {
        price_usd: course.priceUSD,
        original_currency: course.originalCurrency,
        original_amount: course.originalAmount,
        fx_snapshot: course.fxSnapshot,
      },
      homeCurrency,
    );
  }, [course, homeCurrency]);

  const fxValidation = useMemo(() => {
    if (!course) return null;
    return validateFxSnapshot(
      {
        price_usd: course.priceUSD,
        original_currency: course.originalCurrency,
        original_amount: course.originalAmount,
        fx_snapshot: course.fxSnapshot,
      },
      homeCurrency,
    );
  }, [course, homeCurrency]);

  const grossUSD = course?.priceUSD ?? 0;
  // Display-currency gross — this is the single source of truth for all money
  // math in the modal, so the "Total due" row always aligns with the course
  // price shown above it (no cross-basis rounding).
  const displayGross = priceDisplay?.value ?? grossUSD * usdRate(homeCurrency);
  // Conversion rate USD → display currency, derived from the same source as
  // the price above so cashback/discount deductions match exactly.
  const usdToDisplay = grossUSD > 0 ? displayGross / grossUSD : usdRate(homeCurrency);

  const discountDisplay = useMemo(
    () => Number(((displayGross * couponPct) / 100).toFixed(homeCurrency === "USD" ? 2 : 0)),
    [displayGross, couponPct, homeCurrency],
  );

  // Cashback balance stored in USD → convert into course display currency
  // using the same rate the course is priced in.
  const cashbackAvailableDisplay = cashbackUSD * usdToDisplay;
  const cashbackApplyDisplay = useMemo(() => {
    if (!useCashback) return 0;
    const remaining = Math.max(0, displayGross - discountDisplay);
    return Math.min(cashbackAvailableDisplay, remaining);
  }, [useCashback, displayGross, discountDisplay, cashbackAvailableDisplay]);
  // Server still consumes cashback in USD.
  const cashbackApplyUSD = usdToDisplay > 0 ? cashbackApplyDisplay / usdToDisplay : 0;

  const totalDisplay = Math.max(0, displayGross - discountDisplay - cashbackApplyDisplay);
  // Cashback earn: 2% of the post-coupon amount, always.
  const cashbackEarnDisplay = Number(
    (Math.max(0, displayGross - discountDisplay) * 0.02).toFixed(homeCurrency === "USD" ? 2 : 0),
  );

  const isFree = grossUSD <= 0;
  const conversionNeeded = !!course && course.originalCurrency !== homeCurrency;
  const fxInvalid = !isFree && conversionNeeded && fxValidation?.ok === false;
  const fxBlocksCheckout = fxInvalid && fxValidation?.reason !== "missing";
  const fxWarningMessage = !fxInvalid
    ? null
    : fxValidation?.reason === "missing"
      ? "This course was published before locked exchange rates existed. The price shown is an estimate using platform fallback rates."
      : fxValidation?.reason === "missing_rate"
        ? `The locked exchange rate for ${fxValidation.missingRateFor ?? "your currency"} is unavailable on this course.`
        : "The locked exchange rate for this course looks malformed.";

  if (!open || !course) return null;

  const grossFormatted = formatMoney(displayGross, homeCurrency);
  const totalFormatted = formatMoney(totalDisplay, homeCurrency);

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    try {
      const res = await runCoupon({ data: { code } });
      if (res.valid) {
        setCouponPct(res.discountPct);
        setCouponCode(res.code);
        toast.success(`Coupon applied — ${res.discountPct}% off`);
      } else {
        setCouponPct(0);
        setCouponCode(null);
        toast.error("Invalid or inactive coupon");
      }
    } finally {
      setCouponBusy(false);
    }
  };

  const enroll = async () => {
    if (fxBlocksCheckout) {
      toast.error("Checkout blocked: this course is missing a valid locked exchange rate.");
      return;
    }
    setBusy(true);
    try {
      const res = await runEnroll({
        data: {
          courseId: course.id,
          displayCurrency: homeCurrency,
          paymentMethod: method,
          couponCode,
          applyCashbackUSD: cashbackApplyUSD,
        },
      });
      const earnedUSD = Number(res.cashbackUSD ?? 0);
      const earnedLocal = earnedUSD * usdToDisplay;
      setEarnedDisplay(earnedLocal > 0 ? formatMoney(earnedLocal, homeCurrency) : "");
      setDone(true);
      setTimeout(
        () => {
          onEnrolled();
        },
        earnedLocal > 0 ? 2400 : 1200,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const canPay = !busy && !done && totalDisplay >= 0 && !fxBlocksCheckout;

  return (
    <div className="modal-light fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-[#1E1E24] border-b border-white/10">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              Enroll in course
            </div>
            <h3 className="text-white font-black text-lg leading-tight mt-0.5 truncate">
              {course.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {done ? (
            <div className="text-center py-8">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-300" />
                </div>
              </div>
              <div className="text-white font-black text-xl">You're enrolled 🎉</div>
              {earnedDisplay && (
                <div className="mt-4 mx-auto max-w-xs rounded-xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-4">
                  <div className="flex items-center justify-center gap-2 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
                    <Gift className="w-3.5 h-3.5" /> Cashback earned
                  </div>
                  <div className="mt-1 text-white font-black text-2xl">+ {earnedDisplay}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Credited to your Cashback Wallet — spend on any future purchase.
                  </div>
                </div>
              )}
              <p className="text-sm text-slate-400 mt-3">Redirecting you to the course…</p>
            </div>
          ) : (
            <>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Payment method
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {METHODS.map((m) => {
                    const active = method === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setMethod(m.key)}
                        className={`text-left p-3 rounded-[10px] border transition-colors ${
                          active
                            ? "bg-emerald-500/10 border-emerald-500/50"
                            : "bg-[#121214] border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <m.icon
                            className={`w-4 h-4 ${active ? "text-emerald-300" : "text-slate-400"}`}
                          />
                          <div className="text-sm font-semibold text-white">{m.label}</div>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">{m.hint}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Instant payment — you'll earn 2% cashback to your Cashback Wallet.
                </p>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Coupon code
                </div>
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE"
                    className="flex-1 px-3 py-3 bg-[#121214] border border-white/10 rounded-[10px] text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/50"
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={couponBusy || !couponInput.trim()}
                    className="px-3 py-3 rounded-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-slate-200 font-semibold disabled:opacity-50"
                  >
                    {couponBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </button>
                </div>
                {couponCode && (
                  <div className="mt-2 text-[11px] text-emerald-300">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    {couponCode} — {couponPct}% off applied
                  </div>
                )}
              </div>

              <label
                className={`flex items-start gap-3 p-3 rounded-[10px] border ${
                  cashbackUSD > 0
                    ? "bg-[#121214] border-emerald-500/30 cursor-pointer"
                    : "bg-[#121214] border-white/10 opacity-70 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  checked={useCashback}
                  disabled={cashbackUSD <= 0}
                  onChange={(e) => setUseCashback(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">Use Cashback</div>
                  <div
                    className={`text-[11px] ${cashbackUSD > 0 ? "text-emerald-300" : "text-slate-500"}`}
                  >
                    Available: {formatMoney(cashbackAvailableDisplay, homeCurrency)} · spend-only,
                    not withdrawable
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    You'll earn back: + {formatMoney(cashbackEarnDisplay, homeCurrency)} (Oventric
                    Bonus)
                  </div>
                </div>
              </label>

              <div className="p-4 rounded-[10px] bg-[#121214] border border-white/10 space-y-1.5">
                <Row label="Course price" value={grossFormatted} />
                {discountDisplay > 0 && (
                  <Row
                    label="Coupon discount"
                    value={`- ${formatMoney(discountDisplay, homeCurrency)}`}
                    accent="text-emerald-300"
                  />
                )}
                {cashbackApplyDisplay > 0 && (
                  <Row
                    label="Cashback applied"
                    value={`- ${formatMoney(cashbackApplyDisplay, homeCurrency)}`}
                    accent="text-emerald-300"
                  />
                )}
                <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-white font-bold">Total due</span>
                  <span className="text-white font-black text-lg">{totalFormatted}</span>
                </div>
              </div>

              {fxInvalid && (
                <div
                  className={`p-3 rounded-[10px] border text-xs flex gap-2 ${
                    fxBlocksCheckout
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-200"
                      : "bg-amber-500/10 border-amber-500/40 text-amber-200"
                  }`}
                  role="alert"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      {fxBlocksCheckout ? "Exchange rate unavailable" : "Estimated exchange rate"}
                    </div>
                    <div className="mt-0.5 leading-relaxed">
                      {fxWarningMessage}{" "}
                      {fxBlocksCheckout
                        ? "Checkout is temporarily disabled for this course — please try again later or contact the instructor."
                        : "You can still enroll; the platform will settle at publish-time equivalents."}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={enroll}
                disabled={!canPay}
                className="w-full py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-sm inline-flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue to payment · {totalFormatted}
              </button>
              <p className="text-[10px] text-slate-600 text-center leading-relaxed">
                80% goes to the instructor · 20% to platform academy revenue · Secure ledgered
                payment.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${accent ?? "text-white"}`}>{value}</span>
    </div>
  );
}

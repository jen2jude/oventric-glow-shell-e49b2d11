import { AppOnlyGate } from "@/lib/app-gate";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Wallet as WalletIcon,
  CreditCard,
  Smartphone,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Building2,
  Check,
  Headphones,
  TicketPercent,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/oventric/Header";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getProduct,
  createOrder,
  validateCoupon,
  WALLET_CASHBACK_PCT,
  type ProductDTO,
  type PaymentMethod,
} from "@/lib/marketplace.functions";

import { initPayment, getPaymentOptions } from "@/lib/payments.functions";
import { getServicePackages, type ServicePackage } from "@/lib/services.functions";
import { ServiceBriefForm, BRIEF_FIELDS, type BriefState } from "@/components/oventric/services/ServiceBriefForm";
import { MiniPayPanel } from "@/components/oventric/MiniPayPanel";
import { usdRate, convertViaSnapshot, formatMoney } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { useIsAppShell } from "@/hooks/use-launch-context";

// Checkout works in USD canonical (the wallet is USD-native). Display
// conversion for the viewer uses the LEGACY fallback rates; the true locked
// price is shown on the product/listing card via computeDisplayPrice.
// Live USD-base rate for any supported currency.
const rateFor = (cur: Currency) => usdRate(cur);

function fmt(usd: number, cur: Currency) {
  return formatMoney(usd * rateFor(cur), cur);
}

/** Format a USD amount using the product's LOCKED FX snapshot when available. */
function fmtSnap(usd: number, cur: Currency, snap: ProductDTO["fxSnapshot"] | null | undefined) {
  const s = snap && snap.rates ? { base: "USD" as const, rates: snap.rates } : null;
  const converted = convertViaSnapshot(usd, "USD", cur, s);
  const v = converted > 0 || usd === 0 ? converted : usd * rateFor(cur);
  return formatMoney(v, cur);
}

/** Format an amount that's ALREADY in the given currency (no USD conversion). */
function fmtLocal(amount: number, cur: Currency) {
  return formatMoney(amount, cur);
}

/**
 * Preferred display: when the viewer's currency matches the product's
 * ORIGINAL listing currency, show the seller's exact locked amount — no USD
 * round-trip, no snapshot drift. Otherwise fall back to snapshot conversion.
 */
function fmtPrice(
  usdAmount: number,
  viewer: Currency,
  product: ProductDTO | null,
  originalLocalAmount: number,
) {
  if (usdAmount === 0 || originalLocalAmount === 0) return "Free";
  if (product && viewer === (product.originalCurrency as Currency)) {
    return fmtLocal(originalLocalAmount, viewer);
  }
  return fmtSnap(usdAmount, viewer, product?.fxSnapshot ?? null);
}

/** Country-driven payment method availability. Wallet is greyed out on marketplace checkout — buyers pay directly. */
function methodsForCountry(
  country: string | null,
): Array<{
  id: PaymentMethod;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  hint: string;
  disabled?: boolean;
}> {
  const wallet = {
    id: "wallet" as PaymentMethod,
    label: "Pay with Oventric Wallet",
    Icon: WalletIcon,
    hint: "Direct checkout preferred — fund wallet for bounties & ads only",
    disabled: true,
  };
  if (country === "NG") {
    return [
      { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Verve, Mastercard, Visa" },
      wallet,
    ];
  }
  if (country === "GH") {
    return [
      {
        id: "mobile_money",
        label: "Mobile Money",
        Icon: Smartphone,
        hint: "MTN · Vodafone · AirtelTigo",
      },
      { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Mastercard, Visa" },
      wallet,
    ];
  }
  return [
    { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Global cards" },
    wallet,
  ];
}

export const Route = createFileRoute("/checkout/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Secure checkout — Oventric" },
      { name: "description", content: "Complete your Oventric purchase with escrow-protected payments and instant delivery." },
      { property: "og:title", content: "Secure checkout — Oventric" },
      { property: "og:description", content: "Complete your Oventric purchase with escrow-protected payments and instant delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    qty: Math.max(1, Math.min(20, Number(s?.qty ?? 1) || 1)),
    pkg: typeof s?.pkg === "string" && s.pkg ? String(s.pkg) : undefined,
  }),
  component: CheckoutPageGated,
});

function CheckoutPageGated() {
  return (
    <AppOnlyGate
      title="Checkout happens in the app"
      description="Payments, escrow and order tracking run inside the Oventric app so your money stays protected end to end."
      from="checkout"
    >
      <CheckoutPage />
    </AppOnlyGate>
  );
}

function CheckoutPage() {
  const { id } = Route.useParams();
  const { qty, pkg } = Route.useSearch();
  const navigate = useNavigate();
  const { homeCurrency, country, setUsdPreview } = useOnboarding();
  const isAppShell = useIsAppShell();

  // Checkout always settles in the buyer's home currency — leaving the USD
  // preview on here would be misleading, so we drop it on entry.
  useEffect(() => {
    setUsdPreview(false);
  }, [setUsdPreview]);


  const loadProduct = useServerFn(getProduct);
  const submitOrder = useServerFn(createOrder);
  const initCharge = useServerFn(initPayment);
  const checkCoupon = useServerFn(validateCoupon);

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [balanceUSD, setBalanceUSD] = useState<number | null>(null);
  const [cashbackUSD, setCashbackUSD] = useState<number>(0);
  const [useCashback, setUseCashback] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [coupon, setCoupon] = useState<{ code: string; pct: number } | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);
  const [shortfallUSD, setShortfallUSD] = useState<number | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpMethod, setTopUpMethod] = useState<PaymentMethod>("card");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [minipay, setMinipay] = useState<{ available: boolean }>({ available: false });
  const [minipayOpen, setMinipayOpen] = useState(false);
  // Gateway picker shown under "Debit/Credit Card".
  const [cardOpen, setCardOpen] = useState(true);
  const [gateway, setGateway] = useState<"flutterwave" | "paystack" | "minipay">("paystack");
  const [recommended, setRecommended] = useState<"flutterwave" | "paystack" | "minipay">("paystack");
  const loadOptions = useServerFn(getPaymentOptions);
  const loadPackages = useServerFn(getServicePackages);
  const [servicePackage, setServicePackage] = useState<ServicePackage | null>(null);
  const [brief, setBrief] = useState<BriefState>({
    goal: "",
    timeline: "",
    audience: "",
    references: "",
  });

  useEffect(() => {
    let cancelled = false;
    loadOptions({ data: { currency: homeCurrency, purpose: "order" } })
      .then((o) => {
        if (cancelled) return;
        setMinipay({ available: true });
        // Paystack is now recommended, Flutterwave remains unavailable
        setRecommended("paystack");
        setGateway("paystack");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadOptions, homeCurrency]);

  useEffect(() => {
    if (!pkg) {
      setServicePackage(null);
      return;
    }
    let cancelled = false;
    loadPackages({ data: { productId: id } })
      .then((rows) => {
        if (!cancelled) setServicePackage(rows.find((r) => r.id === pkg) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pkg, id, loadPackages]);

  const methods = useMemo(() => methodsForCountry(country), [country]);
  const unitUSD = servicePackage ? servicePackage.priceUsd : (product?.priceUSD ?? 0);
  const unitLocal = servicePackage ? servicePackage.originalAmount : (product?.originalAmount ?? 0);
  const subtotalUSD = useMemo(() => (product ? unitUSD * qty : 0), [product, unitUSD, qty]);
  // When viewing in the product's ORIGINAL currency, prefer the seller's exact
  // locked amount so the checkout total matches the listing card 1:1.
  const subtotalLocal = useMemo(() => (product ? unitLocal * qty : 0), [product, unitLocal, qty]);
  // Coupon discount — a coupon and cashback can never be combined.
  const discountUSD = useMemo(
    () => (coupon ? Number(((subtotalUSD * coupon.pct) / 100).toFixed(2)) : 0),
    [coupon, subtotalUSD],
  );
  // Cashback (spend-only) can be applied on ANY payment method, unless a coupon is used.
  const cashbackApplyUSD = useMemo(() => {
    if (!useCashback || coupon) return 0;
    return Math.min(cashbackUSD, Math.max(0, subtotalUSD));
  }, [useCashback, coupon, cashbackUSD, subtotalUSD]);
  const totalUSD = Number(Math.max(0, subtotalUSD - discountUSD - cashbackApplyUSD).toFixed(2));
  const ratio = subtotalUSD > 0 ? subtotalLocal / subtotalUSD : 0;
  const cashbackApplyLocal = Number((cashbackApplyUSD * ratio).toFixed(2));
  const discountLocal = Number((discountUSD * ratio).toFixed(2));
  const totalLocalExact = Number(Math.max(0, subtotalLocal - discountLocal - cashbackApplyLocal).toFixed(2));
  // Cashback earn is ALWAYS 2% of the full gross sale price — regardless of
  // whether the buyer applied any cashback on this order.
  const cashbackEarnUSD = coupon ? 0 : Number((subtotalUSD * WALLET_CASHBACK_PCT).toFixed(2));

  useEffect(() => {
    let cancelled = false;
    loadProduct({ data: { id } })
      .then((p) => {
        if (cancelled) return;
        // Services are showcase-only: they're arranged over chat, not bought.
        if (p.kind === "service") {
          void navigate({ to: "/product/$id", params: { id }, replace: true });
          return;
        }
        setProduct(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadErr(e.message || "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadProduct, navigate]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      // Read balance in the buyer's home currency (that's where Paystack top-ups
      // credit and that's what the wallet will actually be debited in).
      const { data: localRow } = await supabase
        .from("wallets")
        .select("available_balance")
        .eq("user_id", uid)
        .eq("currency", homeCurrency)
        .maybeSingle();
      // Cashback pot is USD-canonical.
      const { data: cbRow } = await supabase
        .from("wallets")
        .select("accumulated_cashback")
        .eq("user_id", uid)
        .eq("currency", "USD")
        .maybeSingle();
      if (!cancelled) {
        setBalanceUSD(Number(localRow?.available_balance ?? 0));
        setCashbackUSD(Number(cbRow?.accumulated_cashback ?? 0));
      }
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, [shortfallUSD, topUpBusy, homeCurrency]);

  // Prefill delivery email from the current auth user.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user?.email) setDeliveryEmail((prev) => prev || data.user!.email!);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDigital = product?.kind === "digital";
  const needsDelivery = Boolean(isDigital);
  const deliveryValid = !needsDelivery || /^\S+@\S+\.\S+$/.test(deliveryEmail.trim());
  const isService = product?.kind === "service";
  const briefValid =
    !isService || BRIEF_FIELDS.every((f) => !f.required || brief[f.key].trim().length >= 10);

  // `balanceUSD` state actually holds the buyer's balance in their HOME
  // currency (see the fetcher above). Compare it against the total in that
  // same currency so what the user sees on the button matches what the wallet
  // will be debited.
  const totalLocal =
    product && homeCurrency === (product.originalCurrency as Currency)
      ? totalLocalExact
      : Number((totalUSD * rateFor(homeCurrency)).toFixed(2));

  const insufficient = method === "wallet" && balanceUSD !== null && balanceUSD < totalLocal;

  const pay = async () => {
    if (!product || submitting) return;
    if (isService && !briefValid) {
      toast.error("Tell the seller about your project", {
        description: "Fill in the short project brief so they can start straight away.",
      });
      return;
    }
    if (needsDelivery && !deliveryValid) {
      toast.error("Add your delivery details", {
        description: "We need a valid email address to deliver your purchase.",
      });
      return;
    }
    // MiniPay is a manual (proof-of-transfer) flow — open its panel instead.
    if (method !== "wallet" && gateway === "minipay") {
      setMinipayOpen(true);
      return;
    }
    setSubmitting(true);
    setShortfallUSD(null);
    try {
      // Non-wallet methods: initialize the selected gateway and redirect to its secure checkout.
      if (method !== "wallet") {
        const channel: "card" | "bank_transfer" | "mobile_money" | undefined =
          method === "card"
            ? "card"
            : method === "bank_transfer"
              ? "bank_transfer"
              : method === "mobile_money"
                ? "mobile_money"
                : undefined;
        const init = await initCharge({
          data: {
            purpose: "order",
            productId: product.id,
            quantity: qty,
            displayCurrency: homeCurrency,
            couponCode: coupon?.code ?? null,
            deliveryEmail: needsDelivery ? deliveryEmail.trim() : null,
            deliveryWhatsapp: null,
            applyCashbackUSD: cashbackApplyUSD,
            servicePackageId: servicePackage?.id ?? null,
            serviceBrief: isService ? brief : null,
            channel,
            provider: gateway === "minipay" ? undefined : gateway,
          },
        });
        window.location.href = init.authorizationUrl;
        return;
      }

      const res = await submitOrder({
        data: {
          productId: product.id,
          quantity: qty,
          displayCurrency: homeCurrency,
          paymentMethod: method,
          couponCode: coupon?.code ?? null,
          deliveryEmail: needsDelivery ? deliveryEmail.trim() : null,
          deliveryWhatsapp: null,
          applyCashbackUSD: cashbackApplyUSD,
        },
      });

      const shortDisplay = res.walletShortfallDisplay;
      const shortUSD = res.walletShortfallUSD;
      if ((shortDisplay != null && shortDisplay > 0) || (shortUSD != null && shortUSD > 0)) {
        const shortLocal =
          shortDisplay != null
            ? shortDisplay
            : Number(((shortUSD ?? 0) * rateFor(homeCurrency)).toFixed(2));
        setShortfallUSD(shortUSD ?? Number((shortLocal / rateFor(homeCurrency)).toFixed(2)));
        setTopUpOpen(true);
        setTopUpAmount(String(Math.ceil(shortLocal)));
        toast.error("Wallet balance too low", {
          description: `Top up ${fmtLocal(shortLocal, homeCurrency)} to continue.`,
        });
        return;
      }
      if (res.cashbackUSD && res.cashbackUSD > 0) {
        toast.success("Payment successful", {
          description: `${fmt(res.cashbackUSD, homeCurrency)} cashback credited to your wallet.`,
        });
      } else {
        toast.success("Payment successful");
      }
      navigate({ to: "/order/$id", params: { id: res.order.id } });
    } catch (e) {
      toast.error("Payment failed", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const runTopUp = async () => {
    const amt = Number(topUpAmount);
    if (!(amt > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    setTopUpBusy(true);
    try {
      const channel =
        topUpMethod === "card"
          ? "card"
          : topUpMethod === "bank_transfer"
            ? "bank_transfer"
            : topUpMethod === "mobile_money"
              ? "mobile_money"
              : "card";
      const init = await initCharge({
        data: {
          purpose: "wallet_topup",
          amount: amt,
          currency: homeCurrency,
          channel,
          returnTo: `/checkout/${id}?qty=${qty}`,
        },
      });
      window.location.href = init.authorizationUrl;
    } catch (e) {
      toast.error("Top-up failed", { description: e instanceof Error ? e.message : "Try again." });
      setTopUpBusy(false);
    }
  };

  return (
    <div
      className={`min-h-screen overflow-x-hidden ${
        isAppShell
          ? "bg-[#0A0A0B] text-slate-200 selection:bg-[#E5484D]/30"
          : "page-light bg-white text-slate-900"
      }`}
    >
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0A0B]/80 border-b border-white/5">
        <Header onOpenMessages={() => {}} light={!isAppShell} desktopNav={!isAppShell} forceSiteNavbar={!isAppShell} />
      </div>
      <main
        className={`max-w-4xl mx-auto w-full min-w-0 ${
          isAppShell ? "px-0 py-0 pb-32 pt-0" : "px-4 py-8 pb-24"
        }`}
      >
        <Link
          to="/product/$id"
          params={{ id }}
          search={{ qty }}
          className={`inline-flex items-center gap-2 text-sm transition-all ${
            isAppShell
              ? "relative ml-4 mt-2 mb-4 z-20 w-10 h-10 items-center justify-center bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20"
              : "text-slate-600 hover:text-slate-900 bg-white shadow-sm border border-slate-200 rounded-[10px] px-3 py-2 mb-6"
          }`}
        >
          {isAppShell ? (
            <ArrowLeft className="w-6 h-6" />
          ) : (
            <>
              <ArrowLeft className="w-4 h-4" /> Back
            </>
          )}
        </Link>

        {/* No H1 needed as Header provides context */}

        {loadErr && (
          <div className={`${isAppShell ? "bg-white/[0.03] border-[#E5484D]/20 mx-4 shadow-sm" : "bg-white shadow-sm border-red-200"} border rounded-[10px] p-6 text-sm text-[#E5484D]`}>
            {loadErr}
          </div>
        )}

        {!product && !loadErr && (
          <div className={`flex items-center gap-2 text-sm ${isAppShell ? "text-slate-500 px-4" : "text-slate-500"}`}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading order…
          </div>
        )}

        {product && (
          <div
            className={`grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0 ${isAppShell ? "p-0" : ""}`}
          >
            {/* Payment methods */}
            <div className={`lg:col-span-2 space-y-4 min-w-0 ${isAppShell ? "px-4 pt-12" : ""}`}>
              {isAppShell && (
                <div className="flex items-center gap-4 mb-8 bg-white/[0.03] p-4 rounded-[10px] border border-white/5 shadow-sm">
                  {product.coverUrl && (
                    <ResponsiveImage
                      src={product.coverUrl}
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded-[10px] border border-white/10"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-black text-white truncate">{product.name}</h1>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Qty {qty} · Checkout</div>
                  </div>
                </div>
              )}
              <h2 className={`text-xs font-bold uppercase tracking-widest mb-3 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                Select Payment Method
              </h2>
              {methods.map((m) => {
                const active = method === m.id;
                const Icon = m.Icon;
                const walletTag = m.id === "wallet" && balanceUSD !== null;
                const hasGateways =
                  m.id === "card" || m.id === "mobile_money" || m.id === "bank_transfer";
                const expanded = hasGateways && active && cardOpen;
                const gateways: Array<{
                  id: "flutterwave" | "paystack" | "minipay";
                  label: string;
                  hint: string;
                  Icon: React.ComponentType<{ className?: string }>;
                  disabled?: boolean;
                }> = [
                  {
                    id: "minipay" as const,
                    label: "MiniPay",
                    hint: "Send manually, upload receipt · verified by our team",
                    Icon: Smartphone,
                  },
                  {
                    id: "flutterwave",
                    label: "Flutterwave",
                    hint: "Temporarily unavailable",
                    Icon: CreditCard,
                    disabled: true,
                  },
                  {
                    id: "paystack",
                    label: "Paystack",
                    hint: "Cards, bank transfer & USSD",
                    Icon: Building2,
                  },
                ];
                return (
                  <div key={m.id}>
                    <button
                      onClick={() => {
                        if (m.disabled) return;
                        setMethod(m.id);
                        if (hasGateways) setCardOpen(active ? !cardOpen : true);
                      }}
                      disabled={m.disabled}
                      aria-disabled={m.disabled}
                      aria-expanded={hasGateways ? expanded : undefined}
                      title={
                        m.disabled
                          ? "Wallet is reserved for bounties & ads. Pay directly instead."
                          : undefined
                      }
                      className={`w-full text-left rounded-[10px] border p-4 flex items-center gap-4 transition-all ${
                        m.disabled
                          ? isAppShell
                            ? "bg-white/[0.01] border-white/5 opacity-40 cursor-not-allowed"
                            : "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed"
                          : active
                            ? "bg-[#E5484D]/10 border-[#E5484D]/50"
                            : isAppShell
                              ? "bg-white/[0.03] border-white/5 hover:border-white/10"
                              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <span
                        className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${active && !m.disabled ? "bg-[#E5484D]/20" : isAppShell ? "bg-white/5" : "bg-slate-100"}`}
                      >
                        <Icon
                          className={`w-5 h-5 ${active && !m.disabled ? (isAppShell ? "text-[#E5484D]" : "text-[#E5484D]") : isAppShell ? "text-slate-300" : "text-slate-500"}`}
                        />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-semibold ${isAppShell ? "text-white" : "text-slate-900"}`}>
                          {m.label}
                          {m.disabled && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:text-slate-500">
                              Unavailable here
                            </span>
                          )}
                        </span>
                        <span className={`block text-xs ${isAppShell ? "text-slate-500" : "text-slate-600"}`}>
                          {hasGateways && active
                            ? `via ${gateways.find((g) => g.id === gateway)?.label ?? m.hint}`
                            : m.hint}
                        </span>
                      </span>
                      {walletTag && (
                        <span className={`text-[11px] font-mono ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                          {fmtLocal(balanceUSD ?? 0, homeCurrency)}
                        </span>
                      )}
                      {hasGateways && !m.disabled && (
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      )}
                    </button>

                    {expanded && (
                      <div className="mt-2 ml-4 pl-4 border-l border-white/10 md:border-slate-200 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 md:text-slate-500">
                          Choose payment provider
                        </div>
                        {gateways.map((g) => {
                          const on = gateway === g.id;
                          const isDisabled = g.disabled;
                          return (
                            <button
                              key={g.id}
                              onClick={() => !isDisabled && setGateway(g.id)}
                              disabled={isDisabled}
                              className={`w-full text-left rounded-[10px] border p-3 flex items-center gap-3 transition-all ${
                                isDisabled
                                  ? "opacity-50 cursor-not-allowed grayscale bg-white/[0.01] border-white/5"
                                  : on
                                    ? "bg-[#E5484D]/10 border-[#E5484D]/50"
                                    : isAppShell
                                      ? "bg-white/[0.03] border-white/5 hover:border-white/10"
                                      : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                              }`}
                            >
                              <g.Icon
                                className={`w-4 h-4 shrink-0 ${on ? "text-[#E5484D]" : "text-slate-400"}`}
                              />
                              <span className="flex-1 min-w-0">
                                <span
                                  className={`block text-sm font-semibold ${isAppShell ? "text-white" : "text-slate-900"}`}
                                >
                                  {g.label}
                                  {g.id === recommended && !isDisabled && (
                                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-[#E5484D]">
                                      Recommended
                                    </span>
                                  )}
                                </span>
                                <span
                                  className={`block text-[11px] ${isAppShell ? "text-slate-500" : "text-slate-600"}`}
                                >
                                  {g.hint}
                                </span>
                              </span>
                              {on && !isDisabled && <Check className="w-4 h-4 text-[#E5484D] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {insufficient && (
                <div
                  className={`mt-2 flex items-start gap-3 text-xs rounded-[10px] p-3 ${
                    isAppShell
                      ? "text-amber-300 bg-amber-500/5 border border-amber-500/20"
                      : "text-amber-700 bg-amber-50 border border-amber-200"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div>
                      Wallet has {fmtLocal(balanceUSD ?? 0, homeCurrency)} — you need{" "}
                      {fmtLocal(totalLocal, homeCurrency)}.
                    </div>
                    <button
                      onClick={() => {
                        const shortLocal = Math.max(0, totalLocal - (balanceUSD ?? 0));
                        setShortfallUSD(Number((shortLocal / rateFor(homeCurrency)).toFixed(2)));
                        setTopUpAmount(String(Math.ceil(shortLocal)));
                        setTopUpOpen(true);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-black"
                    >
                      Fund Wallet
                    </button>
                  </div>
                </div>
              )}

              {isService && (
                <>
                  {servicePackage && (
                    <div
                      className={`mt-2 rounded-[10px] border p-4 ${
                        isAppShell
                          ? "border-white/5 bg-white/[0.03] shadow-sm"
                          : "border-slate-200 bg-white shadow-sm"
                      }`}
                    >
                      <div
                        className={`text-xs font-bold uppercase tracking-widest mb-2 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}
                      >
                        Selected package
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={`text-sm font-black ${isAppShell ? "text-white" : "text-slate-900"}`}
                          >
                            {servicePackage.name}
                          </div>
                          {servicePackage.summary && (
                            <p
                              className={`mt-1 text-[11px] ${isAppShell ? "text-slate-400" : "text-slate-600"}`}
                            >
                              {servicePackage.summary}
                            </p>
                          )}
                          <div
                            className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${isAppShell ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {servicePackage.deliveryDays != null && (
                              <span>
                                {servicePackage.deliveryDays}-day delivery
                              </span>
                            )}
                            {servicePackage.revisions != null && (
                              <span>{servicePackage.revisions} revisions</span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-sm font-black ${isAppShell ? "text-white" : "text-slate-900"}`}
                        >
                          {fmtPrice(unitUSD, homeCurrency, product, unitLocal)}
                        </span>
                      </div>
                    </div>
                  )}
                  <ServiceBriefForm value={brief} onChange={setBrief} dark={isAppShell} />
                </>
              )}

              {needsDelivery && (
                <div
                  className={`mt-2 rounded-[10px] border p-4 ${
                    isAppShell
                      ? "border-white/5 bg-white/[0.03] shadow-sm"
                      : "border-slate-200 bg-white shadow-sm"
                  }`}
                >
                  <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                    Delivery details
                  </div>
                  <p className={`text-[11px] mb-3 ${isAppShell ? "text-slate-500" : "text-slate-600"}`}>
                    {product.requiresManualDelivery
                      ? "This product requires manual deployment. After payment is verified, the seller delivers it to you in your Oventric chat."
                      : "We’ll send the receipt and download link here after payment is verified."}
                  </p>
                  <label className="block mb-2">
                    <span className={`text-xs ${isAppShell ? "text-slate-300" : "text-slate-700 font-medium"}`}>Email Address</span>
                    <input
                      type="email"
                      value={deliveryEmail}
                      onChange={(e) => setDeliveryEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`mt-1 w-full border rounded-[10px] px-3 py-2 text-sm outline-none focus:border-[#E5484D]/60 ${
                        isAppShell
                          ? "bg-white/[0.03] border-white/10 text-white focus:border-[#E5484D]/60"
                          : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    />
                  </label>
                  {!deliveryValid && deliveryEmail && (
                    <div className="text-[11px] text-red-300 mt-2">
                      Enter a valid email address.
                    </div>
                  )}
                  <div className={`mt-3 rounded-[10px] border px-3 py-2 text-[11px] leading-relaxed ${isAppShell ? "border-[#E5484D]/30 bg-[#E5484D]/5 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                    <strong className={isAppShell ? "text-emerald-200" : "text-emerald-900"}>
                      Delivery happens in your Oventric chat.
                    </strong>{" "}
                    Your payment is held in escrow and only released after you confirm receipt.
                    Never move a trade to WhatsApp or any other app — we can only refund or mediate
                    deals completed here.
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div
              className={`h-max min-w-0 ${
                isAppShell
                  ? "lg:col-span-1 space-y-4 px-4 pb-8"
                  : "bg-white shadow-sm border border-slate-200 rounded-[10px] p-5 lg:col-span-1"
              }`}
            >
              {!isAppShell && (
                <h2 className={`text-xs font-bold uppercase tracking-widest mb-3 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                  Order Summary
                </h2>
              )}
              {isAppShell ? null : product.coverUrl ? (
                <ResponsiveImage
                  src={product.coverUrl}
                  alt={product.name}
                  sizes="(min-width: 1024px) 384px, 100vw"
                  className={`w-full h-32 object-cover rounded-[10px] mb-3 border ${isAppShell ? "border-white/5 bg-white/5" : "border-slate-200 bg-slate-100"}`}
                  loading="eager"
                  fetchPriority="high"
                />
              ) : (
                <div className="h-20 rounded-[10px] bg-white/5 md:bg-slate-100 mb-3" />
              )}
              {!isAppShell && (
                <>
                  <div className={`font-semibold text-sm mb-1 ${isAppShell ? "text-white" : "text-slate-900"}`}>
                    {product.name}
                  </div>
                  <div className={`text-xs mb-3 ${isAppShell ? "text-slate-500" : "text-slate-600"}`}>
                    by {product.vendor} · Qty {qty}
                  </div>
                </>
              )}

              {/* Coupon — mutually exclusive with cashback. */}
              <div
                className={`pt-3 mb-3 border-t ${
                  isAppShell ? "border-white/5" : "border-white/5 md:border-slate-200"
                }`}
              >
                <div className={`text-[10px] uppercase tracking-widest font-bold mb-1.5 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                  Coupon
                </div>
                {coupon ? (
                  <div className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-3 border bg-[#E5484D]/10 border-[#E5484D]/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <TicketPercent className="w-4 h-4 text-[#E5484D] shrink-0" />
                      <div className="min-w-0">
                        <div className={`text-xs font-bold truncate ${isAppShell ? "text-white" : "text-slate-900"}`}>
                          {coupon.code}
                        </div>
                        <div className="text-[11px] text-[#E5484D]">
                          {coupon.pct}% off applied · cashback not earned on this order
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCoupon(null);
                        setCouponInput("");
                      }}
                      className={`p-1.5 rounded-[8px] ${isAppShell ? "text-slate-400 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}
                      aria-label="Remove coupon"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code"
                      className={`flex-1 min-w-0 rounded-[10px] px-3 py-2.5 text-xs font-semibold tracking-wide outline-none border transition-colors ${
                        isAppShell
                          ? "bg-white/[0.03] border-white/10 text-white placeholder:text-slate-500 focus:border-[#E5484D]/50"
                          : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#E5484D]/60"
                      }`}
                    />
                    <button
                      type="button"
                      disabled={couponBusy || !couponInput.trim()}
                      onClick={async () => {
                        const code = couponInput.trim().toUpperCase();
                        if (!code) return;
                        setCouponBusy(true);
                        try {
                          const res = await checkCoupon({
                            data: { code, productId: product?.id, quantity: qty },
                          });
                          if (res.valid) {
                            setCoupon({ code: res.code, pct: Number(res.discountPct) });
                            setUseCashback(false);
                            toast.success(`Coupon applied · ${res.discountPct}% off`);
                          } else {
                            toast.error(res.reason);
                          }
                        } catch {
                          toast.error("Could not verify that coupon");
                        } finally {
                          setCouponBusy(false);
                        }
                      }}
                      className="shrink-0 rounded-[10px] px-4 py-2.5 text-xs font-bold bg-[#E5484D] text-white disabled:opacity-40"
                    >
                      {couponBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                )}
              </div>

              {/* Cashback Wallet — spend-only. Toggle always visible; disabled when empty. */}
              <div
                className={`pt-3 mb-3 border-t ${
                  isAppShell ? "border-white/5" : "border-white/5 md:border-slate-200"
                }`}
              >
                <div className={`text-[10px] uppercase tracking-widest font-bold mb-1.5 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                  Cashback Wallet
                </div>
                <label
                  className={`flex items-start gap-3 rounded-[10px] px-3 py-3 border transition-all ${
                    cashbackUSD > 0 && !coupon
                      ? isAppShell
                        ? "bg-[#E5484D]/5 border-[#E5484D]/20 cursor-pointer shadow-sm"
                        : "bg-[#E5484D]/10 border-[#E5484D]/40 cursor-pointer shadow-sm"
                      : isAppShell
                        ? "bg-white/[0.01] border-white/5 opacity-50 cursor-not-allowed"
                        : "bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={useCashback}
                    disabled={cashbackUSD <= 0 || !!coupon}
                    onChange={(e) => setUseCashback(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#E5484D] cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold ${isAppShell ? "text-white" : "text-slate-900"}`}>
                      Use Cashback
                    </div>
                    <div
                      className={`text-[11px] ${cashbackUSD > 0 ? (isAppShell ? "text-[#E5484D]" : "text-[#E5484D]") : "text-slate-500"}`}
                    >
                      Available: {fmt(cashbackUSD, homeCurrency)} · spend-only, not withdrawable
                    </div>
                    {coupon ? (
                      <div className="text-[11px] mt-0.5 text-slate-500">
                        Unavailable while a coupon is applied
                      </div>
                    ) : (
                      <div className={`text-[11px] mt-0.5 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                        You earn back: + {fmt(cashbackEarnUSD, homeCurrency)} (Oventric Bonus)
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div
                className={`pt-3 space-y-1 text-sm border-t ${
                  isAppShell ? "border-white/5" : "border-slate-200"
                }`}
              >
                <div className={`flex justify-between ${isAppShell ? "text-slate-400" : "text-slate-500"}`}>
                  <span>Subtotal</span>
                  <span>{fmtPrice(subtotalUSD, homeCurrency, product, subtotalLocal)}</span>
                </div>
                {discountUSD > 0 && (
                  <div className="flex justify-between text-[#E5484D]">
                    <span>Coupon ({coupon?.code})</span>
                    <span>− {fmtPrice(discountUSD, homeCurrency, product, discountLocal)}</span>
                  </div>
                )}
                {cashbackApplyUSD > 0 && (
                  <div className="flex justify-between text-[#E5484D]">
                    <span>Cashback applied</span>
                    <span>
                      − {fmtPrice(cashbackApplyUSD, homeCurrency, product, cashbackApplyLocal)}
                    </span>
                  </div>
                )}
                <div className={`flex justify-between ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                  <span>Processing</span>
                  <span className="text-[10px] uppercase font-bold text-[#E5484D]">Free</span>
                </div>
                <div
                  className={`flex justify-between font-black text-lg pt-2 border-t ${
                    isAppShell
                      ? "text-white border-white/5"
                      : "text-slate-900 border-slate-200"
                  }`}
                >
                  <span>Total</span>
                  <span>{fmtPrice(totalUSD, homeCurrency, product, totalLocalExact)}</span>
                </div>
              </div>

              {isAppShell ? (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0B]/80 backdrop-blur-xl border-t border-white/5 p-4 flex flex-col gap-3 pb-safe">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs text-slate-400">Total to pay</span>
                    <span className="text-lg font-black text-white">
                      {fmtPrice(totalUSD, homeCurrency, product, totalLocalExact)}
                    </span>
                  </div>
                  <button
                    onClick={pay}
                    disabled={submitting || (needsDelivery && !deliveryValid)}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-[10px] bg-[#E5484D] hover:bg-[#d13a3f] text-white font-black text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_8px_30px_rgb(229,72,77,0.2)]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                      </>
                    ) : method === "wallet" ? (
                      `Pay ${fmtPrice(totalUSD, homeCurrency, product, totalLocalExact)}`
                    ) : gateway === "minipay" ? (
                      `Pay with MiniPay`
                    ) : (
                      `Pay with ${gateway === "paystack" ? "Paystack" : "Flutterwave"}`
                    )}
                  </button>
                  <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1 opacity-60">
                    <ShieldCheck className="w-3 h-3 text-[#E5484D]/50" /> Secured by Oventric
                    escrow
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={pay}
                    disabled={submitting || (needsDelivery && !deliveryValid)}
                    className="w-full mt-4 inline-flex items-center justify-center gap-2 py-3 rounded-[10px] bg-[#E5484D] hover:bg-[#d13a3f] text-white font-black text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                      </>
                    ) : method === "wallet" ? (
                      `Pay ${fmtPrice(totalUSD, homeCurrency, product, totalLocalExact)}`
                    ) : gateway === "minipay" ? (
                      `Pay with MiniPay · ${fmtPrice(totalUSD, homeCurrency, product, totalLocalExact)}`
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        Pay with {gateway === "paystack" ? "Paystack" : "Flutterwave"} · {fmtPrice(totalUSD, homeCurrency, product, totalLocalExact)}
                      </span>
                    )}
                  </button>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#E5484D]" /> Secured by Oventric buyer
                      protection
                    </div>
                    <Link
                      to="/help-board"
                      className="text-[11px] font-medium text-[#E5484D] hover:text-emerald-500 inline-flex items-center gap-1"
                    >
                      <Headphones className="w-3 h-3" /> Get help
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {topUpOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => !topUpBusy && setTopUpOpen(false)}
        >
          <div
            className={`w-full max-w-md border rounded-2xl p-6 ${
              isAppShell ? "bg-white/[0.03] backdrop-blur-xl border-white/5" : "bg-white shadow-sm border-slate-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`font-black text-lg mb-1 ${isAppShell ? "text-white" : "text-slate-900"}`}>
              Fund your wallet
            </h3>
            <p className="text-xs text-slate-400 md:text-slate-500 mb-4">
              Add {shortfallUSD ? fmt(shortfallUSD, homeCurrency) : "credit"} or more to complete
              this purchase.
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 md:text-slate-500 mb-1.5">
              Amount ({homeCurrency})
            </label>
            <input
              type="number"
              min={1}
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className={`w-full border rounded-[10px] px-3 py-2 text-sm mb-4 outline-none focus:border-[#E5484D]/60 ${
                isAppShell ? "bg-white/[0.03] border-white/10 text-white focus:border-[#E5484D]/60" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 md:text-slate-500 mb-1.5">
              Fund via
            </label>
            <div className="space-y-2 mb-5">
              {methodsForCountry(country)
                .filter((m) => m.id !== "wallet")
                .map((m) => {
                  const Icon = m.Icon;
                  const active = topUpMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setTopUpMethod(m.id)}
                      className={`w-full text-left rounded-[10px] border p-3 flex items-center gap-3 transition-all ${
                        active
                          ? "bg-[#E5484D]/10 border-[#E5484D]/50"
                          : isAppShell
                            ? "bg-white/[0.03] border-white/5"
                            : "bg-white border-slate-200"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${active ? "text-[#E5484D]" : "text-slate-400"}`}
                      />
                      <span className={`text-sm ${isAppShell ? "text-white" : "text-slate-900"}`}>{m.label}</span>
                    </button>
                  );
                })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTopUpOpen(false)}
                disabled={topUpBusy}
                className="flex-1 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 text-slate-200 md:text-slate-700 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={runTopUp}
                disabled={topUpBusy}
                className="flex-1 py-2 rounded-[10px] bg-[#E5484D] hover:bg-[#d13a3f] text-black text-sm font-black inline-flex items-center justify-center gap-2"
              >
                {topUpBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Charging…
                  </>
                ) : (
                  "Fund Wallet"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {minipayOpen && product && (
        <MiniPayPanel
          purpose="order"
          targetId={product.id}
          quantity={qty}
          currency={homeCurrency}
          onClose={() => setMinipayOpen(false)}
        />
      )}
    </div>
  );
}

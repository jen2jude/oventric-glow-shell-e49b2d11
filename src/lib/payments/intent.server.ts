/**
 * Provider-agnostic payment intent builder.
 *
 * Turns a user's checkout/top-up request into an authoritative
 * { amount, currency, metadata } triple, using DB prices (never client
 * amounts) and atomically debiting any Cashback Wallet spend.
 *
 * Both Flutterwave and Paystack consume this, so the money maths lives in
 * exactly one place.
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import { primeRuntimeFxRates } from "@/lib/fx.server";
import { convertViaSnapshot } from "@/lib/fx-display";
import { currencyDecimals } from "@/lib/currency/africa";
import { FX_FROM_USD, type OrderCurrency } from "@/lib/marketplace.functions";

export type WalletTopupIntent = {
  purpose: "wallet_topup";
  amount: number;
  currency: OrderCurrency;
  returnTo?: string;
};

export type OrderIntent = {
  purpose: "order";
  productId: string;
  quantity: number;
  displayCurrency: OrderCurrency;
  couponCode?: string | null;
  deliveryEmail?: string | null;
  deliveryWhatsapp?: string | null;
  /** Amount of Cashback Wallet (USD) to spend on this order. Debited atomically. */
  applyCashbackUSD?: number | null;
  /** Service listings: the tier the buyer chose (authoritative price source). */
  servicePackageId?: string | null;
  /** Service listings: the buyer's project brief. */
  serviceBrief?: Record<string, string> | null;
};

export type PaymentIntentInput = WalletTopupIntent | OrderIntent;

export interface BuiltIntent {
  /** Amount in the user's own (display / home) currency. */
  amount: number;
  currency: OrderCurrency;
  metadata: Record<string, unknown>;
  /** For top-ups: the amount to credit the wallet with (fee excluded). */
  topupNet: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export async function buildPaymentIntent(
  supabase: Sb,
  userId: string,
  data: PaymentIntentInput,
): Promise<BuiltIntent> {
  await primeRuntimeFxRates();

  const metadata: Record<string, unknown> = { user_id: userId, purpose: data.purpose };

  if (data.purpose === "wallet_topup") {
    const topupNet = Number(data.amount);
    if (!(topupNet > 0)) throw new Error("Top-up amount must be greater than zero.");
    metadata.wallet_credit_amount = topupNet;
    metadata.credit_currency = data.currency;
    if (typeof data.returnTo === "string" && data.returnTo.startsWith("/")) {
      metadata.return_to = data.returnTo;
    }
    return { amount: topupNet, currency: data.currency, metadata, topupNet };
  }

  // Order — resolve the authoritative price from the database.
  const { data: p, error } = await supabase
    .from("products")
    .select("id, seller_id, kind, status, in_stock, price_usd, original_currency, original_amount, fx_snapshot")
    .eq("id", data.productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("Product not found");
  // Purchasability is decided here, server-side, never by the client.
  if ((p.status as string) !== "active") throw new Error("This listing is not available for purchase");
  if ((p.in_stock as boolean) === false) throw new Error("This product is currently out of stock");
  if (!["digital", "service"].includes((p.kind as string) ?? "digital")) {
    throw new Error("This listing type is not supported on Oventric");
  }
  if ((p.seller_id as string) === userId) throw new Error("You cannot purchase your own listing");

  const qty = Math.max(1, Math.min(20, Number(data.quantity ?? 1)));
  const displayCurrency = data.displayCurrency;

  // Service tiers price the order, not the listing's "starting from" figure.
  let unitUSD = Number(p.price_usd);
  let pkgOriginalCurrency = (p.original_currency as string) ?? "USD";
  let pkgOriginalAmount = Number(p.original_amount ?? 0);
  let servicePackageId: string | null = null;
  if (data.servicePackageId) {
    const { data: pkg } = await supabase
      .from("service_packages")
      .select("id, price_usd, original_currency, original_amount")
      .eq("id", data.servicePackageId)
      .eq("product_id", data.productId)
      .maybeSingle();
    if (!pkg) throw new Error("That service package is no longer available");
    unitUSD = Number(pkg.price_usd);
    pkgOriginalCurrency = (pkg.original_currency as string) ?? "USD";
    pkgOriginalAmount = Number(pkg.original_amount ?? 0);
    servicePackageId = String(pkg.id);
  }
  const grossUSD = unitUSD * qty;

  let discountUSD = 0;
  let appliedCouponCode: string | null = null;
  if (data.couponCode) {
    const { validateCouponServer } = await import("@/lib/promotions.server");
    const check = await validateCouponServer(supabase, data.couponCode, {
      userId,
      productId: String(p.id),
      sellerId: (p.seller_id as string) ?? null,
      grossUSD,
    });
    if (!check.valid) throw new Error(check.reason);
    discountUSD = check.discountUSD;
    appliedCouponCode = check.code;
  }
  const totalAfterCouponUSD = Number((grossUSD - discountUSD).toFixed(2));

  // Cashback Wallet spend — debited BEFORE the gateway charge is created so
  // the charge amount is reduced. Refunded if the payment never settles.
  let cashbackAppliedUSD = 0;
  // A coupon purchase can never be combined with cashback spend.
  const requestedCB = discountUSD > 0 ? 0 : Math.max(0, Number(data.applyCashbackUSD ?? 0));
  if (requestedCB > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wRow } = await supabaseAdmin
      .from("wallets")
      .select("accumulated_cashback")
      .eq("user_id", userId)
      .eq("currency", "USD")
      .maybeSingle();
    const availableCB = Number(wRow?.accumulated_cashback ?? 0);
    const spend = Number(Math.min(requestedCB, availableCB, totalAfterCouponUSD).toFixed(2));
    if (spend > 0) {
      const { data: cbOk, error: cbErr } = await supabaseAdmin.rpc("cashback_debit", {
        _user_id: userId,
        _amount: spend,
      });
      if (cbErr) throw new Error(cbErr.message);
      if (cbOk) cashbackAppliedUSD = spend;
    }
  }

  const totalUSD = Number((totalAfterCouponUSD - cashbackAppliedUSD).toFixed(2));

  // Prefer the seller's exact locked amount when the buyer pays in the
  // product's ORIGINAL currency — avoids USD round-trip drift.
  const originalCurrency = pkgOriginalCurrency as OrderCurrency;
  const originalAmount = pkgOriginalAmount;
  let converted = 0;
  if (originalAmount > 0 && displayCurrency === originalCurrency && totalAfterCouponUSD > 0) {
    const ratio = totalUSD / totalAfterCouponUSD;
    converted = Number((originalAmount * qty * ratio).toFixed(2));
  } else {
    const snapRaw = (p.fx_snapshot as { base?: string; rates?: Record<string, number> } | null) ?? null;
    const snap = snapRaw && snapRaw.rates ? { base: "USD" as const, rates: snapRaw.rates } : null;
    converted = convertViaSnapshot(totalUSD, "USD", displayCurrency, snap);
  }

  // Round to the SAME precision the UI displays, so the amount the buyer sees
  // (e.g. ₵191) is exactly what the gateway charges — not ₵190.98.
  const raw = converted > 0 ? converted : totalUSD * (FX_FROM_USD[displayCurrency] ?? 1);
  const amount =
    currencyDecimals(displayCurrency) === 0 ? Math.round(raw) : Number(raw.toFixed(2));

  metadata.product_id = p.id;
  metadata.quantity = qty;
  metadata.display_currency = displayCurrency;
  metadata.coupon_code = appliedCouponCode;
  metadata.total_usd = totalUSD;
  metadata.cashback_applied_usd = cashbackAppliedUSD;
  metadata.service_package_id = servicePackageId;
  metadata.service_brief = servicePackageId ? (data.serviceBrief ?? null) : null;
  metadata.delivery_email = data.deliveryEmail ? String(data.deliveryEmail).trim().slice(0, 320) : null;
  metadata.delivery_whatsapp = data.deliveryWhatsapp
    ? String(data.deliveryWhatsapp).replace(/\D/g, "").slice(0, 20)
    : null;

  return { amount, currency: displayCurrency, metadata, topupNet: 0 };
}

/** Best-effort email lookup — gateways require a valid-format address. */
export async function resolveUserEmail(
  supabase: Sb,
  userId: string,
  claims: { email?: string } | null,
): Promise<string> {
  let email = claims?.email;
  if (!email) {
    const { data: userRes } = await supabase.auth.getUser();
    email = userRes?.user?.email ?? undefined;
  }
  if (!email) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.SUPABASE_URL;
    if (key && url) {
      const r = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const j = await r.json().catch(() => null);
      email = (j?.email && String(j.email)) || (j?.user?.email && String(j.user.email)) || undefined;
    }
  }
  return email || `guest-${userId}@guest.oventric.com`;
}

const CANONICAL_ORIGIN = "https://oventric.com";

/**
 * Public origin of the current request (for gateway redirect URLs).
 *
 * The gateway sends the shopper back to `${origin}/payment/return`, so the
 * origin MUST be a real, publicly reachable https site. Native/PWA shells can
 * send exotic origins (capacitor://localhost, http://localhost) and the
 * editor preview host sits behind an auth bridge — both produce a
 * "page not found" instead of the payment status screen. Normalise here.
 */
function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.host;
  // Editor preview host is auth-gated; use its stable, ungated twin.
  const preview = /^id-preview--([0-9a-f-]+)\.lovable\.app$/i.exec(host);
  if (preview) return `https://project--${preview[1]}-dev.lovable.app`;
  if (/(^|\.)oventric\.com$/i.test(host)) return `${u.protocol}//${host}`;
  if (/\.lovable\.app$/i.test(host)) return `https://${host}`;
  return null;
}

export function inferOrigin(): string {
  const host = getRequestHeader("host");
  const proto = getRequestHeader("x-forwarded-proto") || "https";
  return (
    normalizeOrigin(getRequestHeader("origin")) ||
    normalizeOrigin(host ? `${proto}://${host}` : null) ||
    CANONICAL_ORIGIN
  );
}


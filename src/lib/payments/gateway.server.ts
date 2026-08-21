/**
 * Gateway orchestration: settings, charge creation and verification.
 *
 * Server-only. Both providers converge on the same settlement functions in
 * `settle.server.ts`, and both use the same reference-prefix convention:
 *   OVF_… → Flutterwave      OV_… / OVP_… → Paystack
 */
import { resolveFxRates } from "@/lib/fx.server";
import { paystackFee } from "@/lib/paystack-fees";
import { flutterwaveFee } from "@/lib/flutterwave-fees";
import { dbCurrency, currencyDecimals } from "@/lib/currency/africa";
import {
  DEFAULT_GATEWAY_SETTINGS,
  routeGateway,
  type GatewaySettings,
} from "@/lib/payments/providers";
import { settleOrder, settleWalletTopup } from "@/lib/payments/settle.server";
import type { OrderCurrency } from "@/lib/marketplace.functions";
import type { BuiltIntent, PaymentIntentInput } from "@/lib/payments/intent.server";

// ---- Settings ----------------------------------------------------------------

export async function loadGatewaySettings(): Promise<GatewaySettings> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payment_gateway_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!data) return DEFAULT_GATEWAY_SETTINGS;
    return {
      flutterwaveEnabled: Boolean(data.flutterwave_enabled) && Boolean(process.env.FLUTTERWAVE_SECRET_KEY),
      paystackEnabled: Boolean(data.paystack_enabled) && Boolean(process.env.PAYSTACK_SECRET_KEY),
      minipayEnabled: Boolean(data.minipay_enabled),
      minipayHandle: (data.minipay_handle as string) ?? null,
      minipayAccountName: (data.minipay_account_name as string) ?? null,
      minipayInstructions: (data.minipay_instructions as string) ?? null,
      minipayCurrencies: (data.minipay_currencies as string[]) ?? [],
    };
  } catch (e) {
    console.error("[gateway] settings load failed", e);
    return DEFAULT_GATEWAY_SETTINGS;
  }
}

// ---- Charge creation ---------------------------------------------------------

export interface CreateChargeResult {
  authorizationUrl: string;
  reference: string;
  provider: "flutterwave" | "paystack";
  chargeAmount: number;
  chargeCurrency: string;
}

function subunit(amount: number) {
  return Math.max(1, Math.round(amount * 100));
}

async function paystackInit(body: Record<string, unknown>) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack is not configured on the server.");
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: { status?: boolean; message?: string; data?: { authorization_url: string; reference: string } } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message || `Paystack request failed (${res.status})`);
  }
  return json.data;
}

export async function createCharge(opts: {
  userId: string;
  email: string;
  origin: string;
  intent: BuiltIntent;
  input: PaymentIntentInput;
  settings: GatewaySettings;
  channel?: "card" | "bank_transfer" | "mobile_money" | "ussd";
  /** Force a specific gateway (admin/testing). */
  preferProvider?: "flutterwave" | "paystack";
}): Promise<CreateChargeResult> {
  const { intent, settings, input } = opts;
  const route = routeGateway(intent.currency, settings);
  const provider =
    opts.preferProvider && (opts.preferProvider === "flutterwave" ? settings.flutterwaveEnabled : settings.paystackEnabled)
      ? opts.preferProvider
      : route.provider;
  let chargeCurrency = route.chargeCurrency;
  if (provider !== route.provider) {
    // Forced provider — recompute a currency it can actually settle.
    const forced = routeGateway(intent.currency, {
      ...settings,
      flutterwaveEnabled: provider === "flutterwave",
      paystackEnabled: provider === "paystack",
    });
    chargeCurrency = forced.chargeCurrency;
  }

  let chargeAmount = intent.amount;
  if (chargeCurrency !== intent.currency) {
    const { rates } = await resolveFxRates();
    const rate = Number(rates[intent.currency]) > 0 ? Number(rates[intent.currency]) : 1;
    const raw = intent.amount / rate;
    chargeAmount = currencyDecimals(chargeCurrency) === 0 ? Math.round(raw) : Number(raw.toFixed(2));
  }

  const metadata: Record<string, unknown> = { ...intent.metadata, gateway: provider, charge_currency: chargeCurrency };

  // Wallet top-ups: the user covers the gateway fee, so it is added on top.
  if (input.purpose === "wallet_topup") {
    const { fee, charge } =
      provider === "flutterwave"
        ? flutterwaveFee(chargeAmount, chargeCurrency)
        : paystackFee(chargeAmount, chargeCurrency);
    chargeAmount = charge;
    metadata.topup_fee = fee;
    metadata.topup_fee_currency = chargeCurrency;
  }

  const stamp = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
  const reference = provider === "flutterwave" ? `OVF_${stamp}` : `OVP_${stamp}`;
  const redirectUrl = `${opts.origin}/api/public/payment-return`;

  let authorizationUrl: string;
  if (provider === "flutterwave") {
    const { createHostedPayment } = await import("@/lib/flutterwave.server");
    const optionsMap: Record<string, string> = {
      card: "card",
      bank_transfer: "banktransfer,account",
      mobile_money: "mobilemoney,mobilemoneyghana,mpesa,mobilemoneyuganda,mobilemoneyrwanda,mobilemoneyzambia,mobilemoneyfranco",
      ussd: "ussd",
    };
    const res = await createHostedPayment({
      reference,
      amount: chargeAmount,
      currency: chargeCurrency,
      redirectUrl,
      email: opts.email,
      title: "Oventric",
      description: input.purpose === "wallet_topup" ? "Wallet funding" : "Marketplace purchase",
      paymentOptions: opts.channel ? optionsMap[opts.channel] : undefined,
      meta: metadata,
    });
    authorizationUrl = res.link;
  } else {
    const channelsMap: Record<string, string[]> = {
      card: ["card"],
      bank_transfer: ["bank_transfer", "bank"],
      mobile_money: ["mobile_money"],
      ussd: ["ussd"],
    };
    const res = await paystackInit({
      email: opts.email,
      amount: subunit(chargeAmount),
      currency: chargeCurrency,
      reference,
      callback_url: redirectUrl,
      metadata,
      ...(opts.channel ? { channels: channelsMap[opts.channel] } : {}),
    });
    authorizationUrl = res.authorization_url;
  }

  // Record a pending top-up so the user's history reflects the intent even if
  // they abandon the hosted page.
  if (input.purpose === "wallet_topup") {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: opts.userId,
        paystack_ref: reference,
        tx_hash: reference,
        type: "Wallet Top-Up",
        amount: intent.topupNet,
        currency: dbCurrency(intent.currency),
        inflow: true,
        status: "pending",
        occurred_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[gateway] pending top-up row failed", e);
    }
  }

  return { authorizationUrl, reference, provider, chargeAmount, chargeCurrency };
}

// ---- Verification ------------------------------------------------------------

export interface VerifyResult {
  ok: boolean;
  status: string;
  redirectTo: string | null;
  cashbackEarnedUSD: number;
  displayCurrency: string;
}

export function providerForReference(reference: string): "flutterwave" | "paystack" {
  return reference.toUpperCase().startsWith("OVF") ? "flutterwave" : "paystack";
}

async function markTopupFailed(reference: string, meta: Record<string, unknown>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "failed" })
      .eq("paystack_ref", reference)
      .eq("type", "Wallet Top-Up")
      .eq("status", "pending");
    const failedUser = String(meta.user_id ?? "");
    const refund = Math.max(0, Number(meta.cashback_applied_usd ?? 0));
    if (failedUser && refund > 0) {
      await supabaseAdmin.rpc("cashback_credit", { _user_id: failedUser, _amount: refund });
    }
  } catch (e) {
    console.error("[gateway] mark top-up failed error", e);
  }
}

/** Settle a confirmed payment from its gateway metadata. */
export async function settleFromMetadata(
  reference: string,
  meta: Record<string, unknown>,
  paidCurrency: string,
  paidAmount: number,
): Promise<VerifyResult> {
  const userId = String(meta.user_id ?? "");
  if (!userId) throw new Error("Payment metadata missing user context.");
  const purpose = String(meta.purpose ?? "wallet_topup");

  if (purpose === "order") {
    const res = await settleOrder(userId, reference, {
      productId: String(meta.product_id ?? ""),
      quantity: Number(meta.quantity ?? 1),
      displayCurrency: ((meta.display_currency as OrderCurrency) ?? (paidCurrency as OrderCurrency)),
      couponCode: (meta.coupon_code as string | null) ?? null,
      deliveryEmail: (meta.delivery_email as string | null) ?? null,
      deliveryWhatsapp: (meta.delivery_whatsapp as string | null) ?? null,
      cashbackAppliedUSD: Number(meta.cashback_applied_usd ?? 0),
      servicePackageId: (meta.service_package_id as string | null) ?? null,
      serviceBrief: (meta.service_brief as Record<string, string> | null) ?? null,
    });
    return {
      ok: true,
      status: "success",
      redirectTo: `/order/${res.orderId}`,
      cashbackEarnedUSD: "cashbackEarnUSD" in res ? (res.cashbackEarnUSD ?? 0) : 0,
      displayCurrency: String((meta.display_currency as string) ?? paidCurrency),
    };
  }

  const creditAmount = Number(meta.wallet_credit_amount);
  const netAmount = Number.isFinite(creditAmount) && creditAmount > 0 ? creditAmount : paidAmount;
  const creditCurrency = ((meta.credit_currency as string) || paidCurrency) as OrderCurrency;
  await settleWalletTopup(userId, reference, netAmount, creditCurrency);
  const returnTo =
    typeof meta.return_to === "string" && meta.return_to.startsWith("/")
      ? meta.return_to
      : "/?section=Wallet&wallet=funded";
  return { ok: true, status: "success", redirectTo: returnTo, cashbackEarnedUSD: 0, displayCurrency: creditCurrency };
}

/** Verify a reference with whichever gateway created it, then settle. */
export async function verifyAndSettle(reference: string): Promise<VerifyResult> {
  if (providerForReference(reference) === "flutterwave") {
    const { verifyByReference } = await import("@/lib/flutterwave.server");
    const tx = await verifyByReference(reference);
    const meta = (tx.meta ?? {}) as Record<string, unknown>;
    if (String(tx.status).toLowerCase() !== "successful") {
      await markTopupFailed(reference, meta);
      return {
        ok: false,
        status: String(tx.status || "failed"),
        redirectTo: null,
        cashbackEarnedUSD: 0,
        displayCurrency: tx.currency,
      };
    }
    return settleFromMetadata(reference, meta, tx.currency, Number(tx.amount));
  }

  const { verifyAndSettleByReference } = await import("@/lib/paystack.functions");
  const res = await verifyAndSettleByReference(reference);
  return {
    ok: res.ok,
    status: res.status,
    redirectTo: res.redirectTo,
    cashbackEarnedUSD: res.cashbackEarnedUSD,
    displayCurrency: String(res.displayCurrency ?? "USD"),
  };
}

/**
 * Server-only logic for crypto wallet funding.
 *
 * Money rules kept identical to card/bank funding:
 *  - the credit amount is quoted server-side, never taken from the browser
 *  - the wallet is credited only through settleWalletTopup()
 *  - the credit reference is deterministic, so a repeated webhook or poll
 *    can never credit twice
 */
import { primeRuntimeFxRates } from "@/lib/fx.server";
import { usdRate } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { settleWalletTopup } from "@/lib/payments/settle.server";
import type { OrderCurrency } from "@/lib/marketplace.functions";
import {
  createCryptoPayment,
  fetchCryptoPayment,
  mapProviderStatus,
  type CryptoPayCurrency,
} from "@/lib/crypto/nowpayments.server";

export const DEPOSIT_WINDOW_MINUTES = 30;
/** Tolerance for provider-side rounding on the received amount. */
const UNDERPAY_TOLERANCE = 0.995;

export interface CryptoDepositDTO {
  id: string;
  status: string;
  currency: string;
  amount: number;
  usdAmount: number;
  payCurrency: string;
  payAmount: number | null;
  payAddress: string | null;
  receivedAmount: number | null;
  expiresAt: string;
  createdAt: string;
  note: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDTO(row: any): CryptoDepositDTO {
  return {
    id: String(row.id),
    status: String(row.status),
    currency: String(row.currency),
    amount: Number(row.amount ?? 0),
    usdAmount: Number(row.usd_amount ?? 0),
    payCurrency: String(row.pay_currency),
    payAmount: row.pay_amount === null || row.pay_amount === undefined ? null : Number(row.pay_amount),
    payAddress: row.pay_address ?? null,
    receivedAmount:
      row.received_amount === null || row.received_amount === undefined ? null : Number(row.received_amount),
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
    note: row.note ?? null,
  };
}

export function creditReferenceFor(paymentId: string) {
  return `crypto_nowpayments_${paymentId}`;
}

export async function quoteUsd(amount: number, currency: Currency) {
  await primeRuntimeFxRates();
  const rate = usdRate(currency) || 1;
  const usdAmount = Number((amount / rate).toFixed(2));
  return { usdAmount, rate };
}

export async function startCryptoDeposit(args: {
  userId: string;
  amount: number;
  currency: Currency;
  payCurrency: CryptoPayCurrency;
  origin: string;
}): Promise<CryptoDepositDTO> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { usdAmount, rate } = await quoteUsd(args.amount, args.currency);
  if (usdAmount < 1) throw new Error("Minimum crypto funding is about $1.");

  const expiresAt = new Date(Date.now() + DEPOSIT_WINDOW_MINUTES * 60_000).toISOString();

  const inserted = await supabaseAdmin
    .from("crypto_deposits")
    .insert({
      user_id: args.userId,
      currency: args.currency,
      amount: args.amount,
      usd_amount: usdAmount,
      fx_rate: rate,
      pay_currency: args.payCurrency,
      provider: "nowpayments",
      provider_payment_id: `pending_${crypto.randomUUID()}`,
      status: "awaiting_payment",
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (inserted.error || !inserted.data) {
    console.error("[crypto] insert deposit failed", inserted.error);
    throw new Error("Could not start the crypto payment. Please try again.");
  }

  try {
    const payment = await createCryptoPayment({
      usdAmount,
      payCurrency: args.payCurrency,
      orderId: inserted.data.id,
      description: "Oventric wallet funding",
      callbackUrl: `${args.origin}/api/public/crypto-webhook`,
    });

    const updated = await supabaseAdmin
      .from("crypto_deposits")
      .update({
        provider_payment_id: payment.paymentId,
        pay_address: payment.payAddress,
        pay_amount: payment.payAmount,
        pay_currency: payment.payCurrency,
        last_provider_status: payment.status,
      })
      .eq("id", inserted.data.id)
      .select("*")
      .single();

    if (updated.error || !updated.data) throw new Error("Could not save the crypto payment.");
    return toDTO(updated.data);
  } catch (err) {
    await supabaseAdmin
      .from("crypto_deposits")
      .update({ status: "failed", note: err instanceof Error ? err.message : "Provider error" })
      .eq("id", inserted.data.id);
    throw err;
  }
}

/**
 * Apply a provider status (from the IPN webhook or a status poll) to a deposit
 * and credit the wallet when the payment is genuinely complete.
 */
export async function applyProviderUpdate(args: {
  providerPaymentId: string;
  providerStatus: string;
  actuallyPaid: number | null;
  payAmount: number | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("crypto_deposits")
    .select("*")
    .eq("provider", "nowpayments")
    .eq("provider_payment_id", args.providerPaymentId)
    .maybeSingle();

  if (!row) return { ok: false as const, reason: "unknown_payment" };
  if (row.status === "credited") return { ok: true as const, status: "credited" as const };

  const expected = Number(args.payAmount ?? row.pay_amount ?? 0);
  const received = args.actuallyPaid === null ? null : Number(args.actuallyPaid);
  let next = mapProviderStatus(args.providerStatus);

  // Never credit on a short payment, whatever the provider calls it.
  if (next === "credited" && expected > 0 && received !== null && received < expected * UNDERPAY_TOLERANCE) {
    next = "underpaid";
  }

  if (next === "credited") {
    const reference = creditReferenceFor(String(row.provider_payment_id));
    await settleWalletTopup(
      String(row.user_id),
      reference,
      Number(row.amount),
      String(row.currency) as OrderCurrency,
    );
    await supabaseAdmin
      .from("crypto_deposits")
      .update({
        status: "credited",
        credit_reference: reference,
        received_amount: received,
        last_provider_status: args.providerStatus,
      })
      .eq("id", row.id);
    return { ok: true as const, status: "credited" as const };
  }

  await supabaseAdmin
    .from("crypto_deposits")
    .update({
      status: next,
      received_amount: received,
      last_provider_status: args.providerStatus,
      note:
        next === "underpaid"
          ? `Received ${received ?? 0} of ${expected} ${row.pay_currency}. Contact support to resolve.`
          : row.note,
    })
    .eq("id", row.id);

  return { ok: true as const, status: next };
}

/** Read one deposit for its owner, refreshing from the provider when still open. */
export async function readCryptoDeposit(userId: string, depositId: string): Promise<CryptoDepositDTO | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("crypto_deposits")
    .select("*")
    .eq("id", depositId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;

  const open = row.status === "awaiting_payment" || row.status === "confirming";
  if (open && !String(row.provider_payment_id).startsWith("pending_")) {
    const remote = await fetchCryptoPayment(String(row.provider_payment_id));
    if (remote) {
      await applyProviderUpdate({
        providerPaymentId: String(row.provider_payment_id),
        providerStatus: String(remote["payment_status"] ?? ""),
        actuallyPaid: remote["actually_paid"] === undefined ? null : Number(remote["actually_paid"]),
        payAmount: remote["pay_amount"] === undefined ? null : Number(remote["pay_amount"]),
      });
    } else if (new Date(String(row.expires_at)).getTime() < Date.now()) {
      await supabaseAdmin.from("crypto_deposits").update({ status: "expired" }).eq("id", row.id);
    }
    const { data: fresh } = await supabaseAdmin
      .from("crypto_deposits")
      .select("*")
      .eq("id", depositId)
      .maybeSingle();
    if (fresh) return toDTO(fresh);
  }

  return toDTO(row);
}

export function cryptoFundingConfigured() {
  return Boolean(process.env["NOWPAYMENTS_API_KEY"] && process.env["NOWPAYMENTS_IPN_SECRET"]);
}

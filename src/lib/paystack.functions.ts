/**
 * Paystack verification + top-up history.
 *
 * Charge CREATION lives in one place only — `src/lib/payments.functions.ts`
 * (`initPayment`) → `intent.server.ts` (authoritative pricing) →
 * `gateway.server.ts` (provider call). This module deliberately exposes no
 * second initialization endpoint and no second pricing engine.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrderCurrency } from "./marketplace.functions";

const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackFetch<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack is not configured on the server.");
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: { status?: boolean; message?: string; data?: T } = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  if (!res.ok || !json.status) {
    throw new Error(json.message || `Paystack request failed (${res.status})`);
  }
  return json.data as T;
}

// ---- Verification / settlement ------------------------------------------------

interface PaystackVerifyPayload {
  status: string; // "success" | "failed" | ...
  reference: string;
  amount: number; // subunit
  currency: string;
  metadata: Record<string, unknown> | null;
  customer: { email: string };
  paid_at: string | null;
}

/**
 * Ask Paystack for the authoritative status of a reference, then settle.
 *
 * Settlement itself is delegated to the shared provider-agnostic path
 * (`settleFromMetadata`), which validates the paid amount/currency against
 * the amount we created the charge for and is idempotent per reference.
 */
export async function verifyAndSettleByReference(reference: string) {
  const payload = await paystackFetch<PaystackVerifyPayload>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
  const meta = (payload.metadata ?? {}) as Record<string, unknown>;

  if (payload.status !== "success") {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("wallet_transactions")
        .update({ status: "failed" })
        .eq("paystack_ref", payload.reference)
        .eq("type", "Wallet Top-Up")
        .eq("status", "pending");
      // Refund any cashback that was atomically debited at init time.
      const failedUser = String(meta.user_id ?? "");
      const refund = Math.max(0, Number(meta.cashback_applied_usd ?? 0));
      if (failedUser && refund > 0) {
        await supabaseAdmin.rpc("cashback_credit", { _user_id: failedUser, _amount: refund });
      }
    } catch (e) {
      console.error("[paystack] mark topup failed error", e);
    }
    return {
      ok: false as const,
      status: payload.status,
      redirectTo: null as string | null,
      cashbackEarnedUSD: 0,
      displayCurrency: payload.currency as OrderCurrency,
      payerId: String(meta.user_id ?? "") || null,
    };
  }

  const { settleFromMetadata } = await import("@/lib/payments/gateway.server");
  const res = await settleFromMetadata(
    payload.reference,
    meta,
    payload.currency,
    payload.amount / 100,
  );
  return { ...res, payerId: String(meta.user_id ?? "") || null };
}

// ---- History ----------------------------------------------------------------

export interface PaystackTopupRow {
  id: string;
  reference: string;
  amount: number;
  currency: OrderCurrency;
  status: "pending" | "success" | "failed";
  occurredAt: string;
  createdAt: string;
}

export const listMyPaystackTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaystackTopupRow[]> => {
    const { data, error } = await context.supabase
      .from("wallet_transactions")
      .select("id, paystack_ref, amount, currency, status, occurred_at, created_at")
      .eq("user_id", context.userId)
      .eq("type", "Wallet Top-Up")
      .not("paystack_ref", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      reference: (r.paystack_ref as string) ?? "",
      amount: Number(r.amount),
      currency: r.currency as OrderCurrency,
      status: r.status as "pending" | "success" | "failed",
      occurredAt: r.occurred_at as string,
      createdAt: r.created_at as string,
    }));
  });

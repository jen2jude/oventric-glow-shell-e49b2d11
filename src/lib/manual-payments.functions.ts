/**
 * MiniPay (and any future manual, proof-of-payment rail).
 *
 * A user pays the platform's MiniPay handle out of band, uploads the receipt,
 * and an admin/finance reviewer approves it. Approval runs the SAME settlement
 * path an automated gateway would:
 *   - order  → full escrow / 80-20 split / cashback settlement
 *   - course → the paid amount is credited to the buyer's wallet so they can
 *              complete enrolment instantly at zero extra cost
 *   - bounty → the amount is credited to the poster's wallet so the bounty can
 *              be published and escrowed
 *
 * Manual payments are never offered for wallet top-ups.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupportedCurrency } from "@/lib/currency/africa";
import {
  buildManualPayment,
  listManualPayments,
  reviewManualPayment,
  signProofUrl,
  type ManualPaymentRow,
} from "@/lib/payments/manual.server";

import { isManualRail, type ManualRail } from "@/lib/payments/active-rails";

export type ManualPurpose = "order" | "course" | "bounty";

export interface CreateManualPaymentInput {
  /** Which manual rail the buyer chose: MiniPay or Binance. */
  provider: ManualRail;
  purpose: ManualPurpose;
  targetId?: string | null;
  /** Orders only. */
  quantity?: number;
  couponCode?: string | null;
  /** Bounties only — the poster chooses the amount. */
  amount?: number;
  currency: string;
  payerNote?: string | null;
}

export const createManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateManualPaymentInput) => {
    const purpose = (["order", "course", "bounty"] as const).includes(input?.purpose as never)
      ? (input.purpose as ManualPurpose)
      : null;
    if (!purpose) throw new Error("Invalid purpose");
    const currency = String(input?.currency ?? "USD").toUpperCase();
    if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");
    return {
      provider: isManualRail(String(input?.provider)) ? (input.provider as ManualRail) : "minipay",
      purpose,
      targetId: input?.targetId ? String(input.targetId) : null,
      quantity: Math.max(1, Math.min(20, Number(input?.quantity ?? 1))),
      couponCode: input?.couponCode ? String(input.couponCode).trim().toUpperCase() : null,
      amount: Math.max(0, Number(input?.amount ?? 0)),
      currency,
      payerNote: input?.payerNote ? String(input.payerNote).slice(0, 500) : null,
    };
  })
  .handler(async ({ data, context }) => buildManualPayment(context.supabase, context.userId, data));

export const getProofUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filename: string }) => ({ filename: String(input?.filename ?? "proof.jpg") }))
  .handler(async ({ data, context }) => {
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "proof.jpg";
    const path = `${context.userId}/${Date.now()}-${safe}`;
    const { data: signed, error } = await context.supabase.storage
      .from("payment-proofs")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const attachManualProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; proofPath: string; payerNote?: string | null }) => ({
    id: String(input?.id ?? ""),
    proofPath: String(input?.proofPath ?? ""),
    payerNote: input?.payerNote ? String(input.payerNote).slice(0, 500) : null,
  }))
  .handler(async ({ data, context }) => {
    if (!data.id || !data.proofPath) throw new Error("Missing payment or proof");
    const { error } = await context.supabase
      .from("manual_payments")
      .update({
        proof_path: data.proofPath,
        ...(data.payerNote ? { payer_note: data.payerNote } : {}),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyManualPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManualPaymentRow[]> =>
    listManualPayments(context.supabase, { userId: context.userId }),
  );

export const cancelManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("manual_payments")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Admin -------------------------------------------------------------------

export const adminListManualPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string }) => ({ status: String(input?.status ?? "pending") }))
  .handler(async ({ data, context }): Promise<ManualPaymentRow[]> =>
    listManualPayments(context.supabase, { status: data.status, admin: true, adminId: context.userId }),
  );

export const adminReviewManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; approve: boolean; reason?: string | null }) => ({
    id: String(input?.id ?? ""),
    approve: Boolean(input?.approve),
    reason: input?.reason ? String(input.reason).slice(0, 300) : null,
  }))
  .handler(async ({ data, context }) =>
    reviewManualPayment(context.supabase, context.userId, data.id, data.approve, data.reason),
  );

export const getManualProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => ({ path: String(input?.path ?? "") }))
  .handler(async ({ data, context }) => ({ url: await signProofUrl(context.supabase, data.path) }));

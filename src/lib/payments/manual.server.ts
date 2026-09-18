/**
 * Manual (MiniPay) payment engine — server only.
 *
 * Pricing is always resolved from the database; the client never supplies an
 * amount except for bounty funding, where the poster chooses it and a reviewer
 * verifies it against the uploaded proof.
 */
import { buildPaymentIntent } from "@/lib/payments/intent.server";
import { settleFromMetadata, loadGatewaySettings } from "@/lib/payments/gateway.server";
import { manualRailAvailable } from "@/lib/payments/providers";
import {
  BINANCE_USER_ID,
  MANUAL_RAIL_LABEL,
  MINIPAY_HANDLE_FALLBACK,
  type ManualRail,
} from "@/lib/payments/active-rails";
import { resolveFxRates } from "@/lib/fx.server";
import { currencyDecimals, dbCurrency } from "@/lib/currency/africa";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export interface ManualPaymentRow {
  id: string;
  userId: string;
  /** Which manual rail the buyer used. */
  provider: ManualRail;
  purpose: "order" | "course" | "bounty";
  targetId: string | null;
  targetLabel: string | null;
  currency: string;
  amount: number;
  amountUsd: number;
  reference: string;
  proofPath: string | null;
  payerNote: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  payerName?: string | null;
  payerUsername?: string | null;
}

function mapRow(r: Record<string, unknown>): ManualPaymentRow {
  const profile = (r.profiles ?? null) as { display_name?: string; username?: string } | null;
  return {
    id: r.id as string,
    userId: r.user_id as string,
    provider: ((r.provider as string) === "binance" ? "binance" : "minipay") as ManualRail,
    purpose: r.purpose as ManualPaymentRow["purpose"],
    targetId: (r.target_id as string) ?? null,
    targetLabel: (r.target_label as string) ?? null,
    currency: r.currency as string,
    amount: Number(r.amount ?? 0),
    amountUsd: Number(r.amount_usd ?? 0),
    reference: r.reference as string,
    proofPath: (r.proof_path as string) ?? null,
    payerNote: (r.payer_note as string) ?? null,
    status: r.status as ManualPaymentRow["status"],
    rejectReason: (r.reject_reason as string) ?? null,
    createdAt: r.created_at as string,
    reviewedAt: (r.reviewed_at as string) ?? null,
    payerName: profile?.display_name ?? null,
    payerUsername: profile?.username ?? null,
  };
}

async function usdOf(amount: number, currency: string): Promise<number> {
  if (currency === "USD") return Number(amount.toFixed(2));
  const { rates } = await resolveFxRates();
  const rate = Number(rates[currency]) > 0 ? Number(rates[currency]) : 1;
  return Number((amount / rate).toFixed(2));
}

async function localOf(amountUsd: number, currency: string): Promise<number> {
  if (currency === "USD") return Number(amountUsd.toFixed(2));
  const { rates } = await resolveFxRates();
  const rate = Number(rates[currency]) > 0 ? Number(rates[currency]) : 1;
  return Number((amountUsd * rate).toFixed(currencyDecimals(currency)));
}

export interface BuildManualInput {
  provider: ManualRail;
  purpose: "order" | "course" | "bounty";
  targetId: string | null;
  quantity: number;
  couponCode: string | null;
  amount: number;
  currency: string;
  payerNote: string | null;
}

export async function buildManualPayment(supabase: Sb, userId: string, input: BuildManualInput) {
  const settings = await loadGatewaySettings();
  if (!manualRailAvailable(input.provider, input.purpose, input.currency, settings)) {
    throw new Error(`${MANUAL_RAIL_LABEL[input.provider]} is not available for this payment.`);
  }

  let amount = 0;
  let amountUsd = 0;
  let label = "";
  let meta: Record<string, unknown> = {};

  if (input.purpose === "order") {
    if (!input.targetId) throw new Error("Product required");
    const intent = await buildPaymentIntent(supabase, userId, {
      purpose: "order",
      productId: input.targetId,
      quantity: input.quantity,
      displayCurrency: input.currency as never,
      couponCode: input.couponCode,
      applyCashbackUSD: 0,
    });
    amount = intent.amount;
    amountUsd = Number(intent.metadata.total_usd ?? 0);
    meta = intent.metadata;
    const { data: p } = await supabase.from("products").select("name").eq("id", input.targetId).maybeSingle();
    label = (p?.name as string) ?? "Marketplace order";
  } else if (input.purpose === "course") {
    if (!input.targetId) throw new Error("Course required");
    const { data: c, error } = await supabase
      .from("courses")
      .select("id, title, price_usd, is_free, is_published")
      .eq("id", input.targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Course not found");
    if (c.is_free) throw new Error("This course is free");
    amountUsd = Number(Number(c.price_usd).toFixed(2));
    amount = await localOf(amountUsd, input.currency);
    label = (c.title as string) ?? "Academy course";
    meta = { course_id: c.id, display_currency: input.currency };
  } else {
    if (!(input.amount > 0)) throw new Error("Enter the bounty amount");
    amount = Number(input.amount.toFixed(currencyDecimals(input.currency)));
    amountUsd = await usdOf(amount, input.currency);
    label = "Bounty funding";
    meta = { display_currency: input.currency, bounty_id: input.targetId ?? null };
  }

  if (!(amount > 0)) throw new Error("Nothing to pay");

  const reference = `MP_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

  const { data: row, error } = await supabase
    .from("manual_payments")
    .insert({
      user_id: userId,
      provider: input.provider,
      purpose: input.purpose,
      target_id: input.targetId,
      target_label: label.slice(0, 200),
      currency: input.currency,
      amount,
      amount_usd: amountUsd,
      reference,
      payer_note: input.payerNote,
      meta: meta as never,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return {
    payment: mapRow(row as Record<string, unknown>),
    instructions: {
      rail: input.provider,
      /** MiniPay handle — null on the Binance rail. */
      handle: input.provider === "minipay" ? (settings.minipayHandle ?? MINIPAY_HANDLE_FALLBACK) : null,
      accountName: input.provider === "minipay" ? settings.minipayAccountName : "Oventric",
      binanceUserId: input.provider === "binance" ? BINANCE_USER_ID : null,
      instructions: input.provider === "minipay" ? settings.minipayInstructions : null,
    },
  };
}

export async function listManualPayments(
  supabase: Sb,
  opts: { userId?: string; status?: string; admin?: boolean; adminId?: string },
): Promise<ManualPaymentRow[]> {
  if (opts.admin) {
    // Legacy MiniPay rail stays disabled; admin listing is limited to the same
    // roles that may review a payment (super admin / finance).
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: opts.adminId,
      _role: "admin",
    });
    const { data: isFinance } = isAdmin
      ? { data: true }
      : await supabase.rpc("has_role", { _user_id: opts.adminId, _role: "finance" });
    if (!isAdmin && !isFinance) throw new Error("Forbidden");
  }
  let q = supabase
    .from("manual_payments")
    .select("*, profiles:profiles!manual_payments_user_id_fkey(display_name, username)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.status && opts.status !== "ALL") q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) {
    // Profile join is optional — retry flat if the relationship isn't exposed.
    let q2 = supabase.from("manual_payments").select("*").order("created_at", { ascending: false }).limit(200);
    if (opts.userId) q2 = q2.eq("user_id", opts.userId);
    if (opts.status && opts.status !== "ALL") q2 = q2.eq("status", opts.status);
    const retry = await q2;
    if (retry.error) throw new Error(retry.error.message);
    return (retry.data ?? []).map(mapRow);
  }
  return (data ?? []).map(mapRow);
}

export async function signProofUrl(supabase: Sb, path: string): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/** Immutable audit trail for manual (Binance / MiniPay) payment decisions. */
async function writeManualAudit(
  actorId: string,
  paymentId: string,
  action: "manual_payment.approve" | "manual_payment.reject",
  meta: Record<string, unknown>,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("audit_logs").insert({
      actor_id: actorId,
      action,
      target_kind: "manual_payment",
      target_id: paymentId,
      meta,
    });
  } catch (e) {
    console.error("[manual payment audit] insert failed", e);
  }
}

export async function reviewManualPayment(
  supabase: Sb,
  reviewerId: string,
  id: string,
  approve: boolean,
  reason: string | null,
) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: reviewerId, _role: "admin" });
  const { data: isFinance } = await supabase.rpc("has_role", { _user_id: reviewerId, _role: "finance" });
  if (!isAdmin && !isFinance) throw new Error("Forbidden");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("manual_payments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Payment not found");
  if (row.status !== "pending") throw new Error("Already reviewed");
  const railLabel = (row.provider as string) === "binance" ? "Binance" : "MiniPay";

  if (!approve) {
    await supabaseAdmin
      .from("manual_payments")
      .update({
        status: "rejected",
        reject_reason: reason ?? "Proof could not be verified",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    await supabaseAdmin.from("notifications").insert({
      user_id: row.user_id as string,
      kind: "manual_payment_rejected",
      title: `${railLabel} payment not verified`,
      body: reason ?? "We couldn't match your transfer. Reply with a clearer receipt.",
    });
    await writeManualAudit(reviewerId, id, "manual_payment.reject", {
      provider: row.provider,
      purpose: row.purpose,
      amount: row.amount,
      currency: row.currency,
      reason: reason ?? null,
      payer_id: row.user_id,
    });
    return { ok: true, approved: false };
  }

  // Claim the row BEFORE any money moves. The conditional update is atomic:
  // a second concurrent approval finds no pending row and exits without
  // settling again, so seller earnings, platform revenue, cashback, referral
  // rewards and ledger entries can never be duplicated.
  const claim = await supabaseAdmin
    .from("manual_payments")
    .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claim.error) throw new Error(claim.error.message);
  if (!claim.data) return { ok: true, approved: true, redirectTo: null, alreadyApproved: true };

  const meta = (row.meta ?? {}) as Record<string, unknown>;
  const purpose = row.purpose as "order" | "course" | "bounty";
  const currency = row.currency as string;
  const amount = Number(row.amount ?? 0);
  const reference = row.reference as string;

  let redirectTo: string | null = null;

  try {
  if (purpose === "order") {
    const res = await settleFromMetadata(
      reference,
      { ...meta, user_id: row.user_id, purpose: "order" },
      currency,
      amount,
    );
    redirectTo = res.redirectTo;
  } else {
    // Course + bounty: credit the payer's wallet in the currency they paid, so
    // the existing wallet-funded enrolment / bounty-escrow flows complete it.
    await supabaseAdmin.rpc("wallet_credit_currency", {
      _user_id: row.user_id as string,
      _amount: amount,
      _currency: currency,
    });
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: row.user_id as string,
      tx_hash: reference,
      type: "Wallet Top-Up",
      amount,
      currency: dbCurrency(currency),
      inflow: true,
      status: "success",
      occurred_at: new Date().toISOString(),
    });
    // Academy and bounty top-ups are paused; manual funding returns to the wallet.
    redirectTo = "/wallet";
  }
  } catch (err) {
    // Settlement failed — release the claim so finance can retry.
    await supabaseAdmin
      .from("manual_payments")
      .update({ status: "pending", reviewed_by: null, reviewed_at: null })
      .eq("id", id);
    throw err;
  }

  await supabaseAdmin.from("notifications").insert({
    user_id: row.user_id as string,
    kind: "manual_payment_approved",
    title: `${railLabel} payment confirmed`,
    body:
      purpose === "order"
        ? "Your payment is verified and your order is now live."
        : purpose === "course"
          ? "Your payment is verified — the amount is in your wallet, finish enrolling now."
          : "Your payment is verified — the amount is in your wallet, publish your bounty now.",
    link: redirectTo,
  });

  await writeManualAudit(reviewerId, id, "manual_payment.approve", {
    provider: row.provider,
    purpose,
    amount,
    currency,
    reference,
    payer_id: row.user_id,
  });

  return { ok: true, approved: true, redirectTo };
}

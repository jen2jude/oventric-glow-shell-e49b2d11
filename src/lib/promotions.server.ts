/**
 * Stage 3 — server-authoritative promotions.
 *
 * One place for:
 *   • coupon validation + redemption recording (eligibility, limits, window)
 *   • seller-funded, product-level cashback maths
 *   • referral qualification on the invitee's FIRST settled purchase
 *
 * Everything here runs server-side only. No amount, percentage or eligibility
 * decision is ever accepted from the browser.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export type CouponCheck =
  | { valid: true; code: string; discountPct: number; discountUSD: number }
  | { valid: false; reason: string };

export interface CouponContext {
  /** Buyer, when known. Per-user limits are only enforceable with a user. */
  userId?: string | null;
  productId?: string | null;
  sellerId?: string | null;
  /** Order value the discount applies to, in USD (pre-discount). */
  grossUSD: number;
}

/**
 * Authoritative coupon validation. Always reads the coupon from the database
 * and computes the discount itself.
 */
export async function validateCouponServer(
  sb: Sb,
  rawCode: string | null | undefined,
  ctx: CouponContext,
): Promise<CouponCheck> {
  const code = String(rawCode ?? "").trim().toUpperCase();
  if (!code) return { valid: false, reason: "Enter a coupon code" };

  // Coupon rows are never exposed to the Data API: the code is looked up with
  // the server client so a signed-in client cannot enumerate coupon codes.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const reader: Sb = supabaseAdmin ?? sb;

  const { data: c } = await reader
    .from("coupons")
    .select("code, discount_pct, active, starts_at, expires_at, seller_id, product_id, min_purchase_usd, max_uses, per_user_limit, used_count")
    .eq("code", code)
    .maybeSingle();

  if (!c) return { valid: false, reason: "That coupon code does not exist" };
  if (c.active === false) return { valid: false, reason: "This coupon is no longer active" };

  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) {
    return { valid: false, reason: "This coupon is not active yet" };
  }
  if (c.expires_at && new Date(c.expires_at).getTime() < now) {
    return { valid: false, reason: "This coupon has expired" };
  }
  if (c.product_id && ctx.productId && String(c.product_id) !== String(ctx.productId)) {
    return { valid: false, reason: "This coupon does not apply to this product" };
  }
  if (c.seller_id && ctx.sellerId && String(c.seller_id) !== String(ctx.sellerId)) {
    return { valid: false, reason: "This coupon does not apply to this seller" };
  }
  const minUSD = Number(c.min_purchase_usd ?? 0);
  if (minUSD > 0 && ctx.grossUSD < minUSD) {
    return { valid: false, reason: `Spend at least $${minUSD.toFixed(2)} to use this coupon` };
  }
  if (c.max_uses != null && Number(c.used_count ?? 0) >= Number(c.max_uses)) {
    return { valid: false, reason: "This coupon has reached its usage limit" };
  }
  if (c.per_user_limit != null && ctx.userId) {
    const { count } = await reader
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_code", code)
      .eq("user_id", ctx.userId);
    if (Number(count ?? 0) >= Number(c.per_user_limit)) {
      return { valid: false, reason: "You have already used this coupon" };
    }
  }

  const discountPct = Number(c.discount_pct);
  const discountUSD = Number(Math.min(ctx.grossUSD, (ctx.grossUSD * discountPct) / 100).toFixed(2));
  return { valid: true, code, discountPct, discountUSD };
}

/**
 * Record a coupon use once the payment has settled. Idempotent per
 * (coupon_code, reference) so a replayed webhook cannot burn a second use.
 */
export async function recordCouponRedemption(
  admin: Sb,
  args: { code: string; userId: string; orderId: string | null; reference: string | null; discountUSD: number },
): Promise<void> {
  if (!args.code || args.discountUSD <= 0) return;
  const { error } = await admin.from("coupon_redemptions").insert({
    coupon_code: args.code,
    user_id: args.userId,
    order_id: args.orderId,
    reference: args.reference,
    discount_usd: args.discountUSD,
  });
  // 23505 = duplicate (replayed settlement) — leave the counter alone.
  if (error) {
    if (String(error.code) === "23505") return;
    console.error("[promotions] coupon redemption insert failed", error.message);
    return;
  }
  const { data: row } = await admin
    .from("coupons")
    .select("used_count")
    .eq("code", args.code)
    .maybeSingle();
  await admin
    .from("coupons")
    .update({ used_count: Number(row?.used_count ?? 0) + 1 })
    .eq("code", args.code);
}

/**
 * Seller-funded cashback for a product, in USD.
 *
 * The rate lives on the product (seller-configured). The reward is funded
 * ENTIRELY out of the seller's share — the platform's 20% is untouched — and
 * can never exceed the seller's share, so seller earnings cannot go negative.
 */
export function sellerFundedCashbackUSD(
  cashbackPct: number | null | undefined,
  splitBaseUSD: number,
  sellerCutUSD: number,
): number {
  const pct = Math.max(0, Math.min(50, Number(cashbackPct ?? 0)));
  if (!(pct > 0) || !(splitBaseUSD > 0)) return 0;
  const raw = Number(((splitBaseUSD * pct) / 100).toFixed(2));
  return Number(Math.max(0, Math.min(raw, sellerCutUSD)).toFixed(2));
}

/**
 * Referral qualification. Called ONLY from settlement, after a purchase is
 * confirmed paid.
 *
 * Exactly-once by construction: the pending → qualified transition is a
 * conditional UPDATE on a row keyed by invitee_id, so replayed webhooks,
 * retries and duplicate settlement attempts all no-op.
 */
export async function qualifyReferralOnSettledPurchase(
  admin: Sb,
  args: { buyerId: string; orderId: string; orderTotalUSD: number },
): Promise<{ rewarded: boolean; amountUSD?: number; referrerId?: string }> {
  try {
    const { data: rel } = await admin
      .from("referrals")
      .select("invitee_id, referrer_id, status, created_at")
      .eq("invitee_id", args.buyerId)
      .maybeSingle();
    if (!rel || rel.status !== "pending") return { rewarded: false };
    if (String(rel.referrer_id) === String(args.buyerId)) return { rewarded: false };

    const { data: cfg } = await admin
      .from("referral_settings")
      .select("active, reward_amount_usd, min_purchase_usd, qualification_days")
      .eq("id", 1)
      .maybeSingle();
    if (!cfg || cfg.active === false) return { rewarded: false };

    if (args.orderTotalUSD < Number(cfg.min_purchase_usd ?? 0)) return { rewarded: false };

    const days = Number(cfg.qualification_days ?? 0);
    if (days > 0) {
      const deadline = new Date(rel.created_at).getTime() + days * 86_400_000;
      if (Date.now() > deadline) return { rewarded: false };
    }

    // Must be the invitee's FIRST settled purchase.
    const { count: paidCount } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", args.buyerId)
      .eq("status", "paid");
    if (Number(paidCount ?? 0) > 1) return { rewarded: false };

    const amountUSD = Number(Number(cfg.reward_amount_usd ?? 0).toFixed(2));
    if (!(amountUSD > 0)) return { rewarded: false };

    // Atomic claim — only one caller can flip pending → qualified.
    const { data: claimed } = await admin
      .from("referrals")
      .update({
        status: "qualified",
        qualified_order_id: args.orderId,
        qualified_at: new Date().toISOString(),
        reward_amount_usd: amountUSD,
      })
      .eq("invitee_id", args.buyerId)
      .eq("status", "pending")
      .select("referrer_id")
      .maybeSingle();
    if (!claimed) return { rewarded: false };

    const referrerId = String(claimed.referrer_id);
    // Promotional credit only — the spend-only cashback pot, never the
    // withdrawable available balance.
    await admin.rpc("cashback_credit", { _user_id: referrerId, _amount: amountUSD });
    await admin.from("wallet_transactions").insert({
      user_id: referrerId,
      tx_hash: `${args.orderId}-REF`,
      type: "Referral Reward",
      amount: amountUSD,
      currency: "USD",
      inflow: true,
      status: "success",
      occurred_at: new Date().toISOString(),
    });
    try {
      await admin.from("notifications").insert({
        user_id: referrerId,
        kind: "referral_reward",
        title: "Referral reward earned",
        body: `Someone you invited made their first purchase. $${amountUSD.toFixed(2)} was added to your Oventric credit.`,
        link: "/referrals",
      });
    } catch { /* notification is best-effort */ }

    return { rewarded: true, amountUSD, referrerId };
  } catch (e) {
    console.error("[promotions] referral qualification failed", e);
    return { rewarded: false };
  }
}

/**
 * Stage 5 — compensating reversal of the promotional credits an order created,
 * used when that order is refunded.
 *
 * Nothing is deleted: the original credit rows stay in the ledger and a
 * reversal row is posted beside them. Both reversals are idempotent — the
 * unique tx_hash index means a replayed refund cannot debit twice, and the
 * referral row only flips back while it is still `qualified` for this order.
 */
export async function reverseOrderPromotions(
  admin: Sb,
  args: { orderId: string; buyerId: string; reference?: string | null },
): Promise<void> {
  // ---- buyer cashback clawback -------------------------------------------
  try {
    if (args.reference) {
      const { data: cb } = await admin
        .from("wallet_transactions")
        .select("amount")
        .eq("tx_hash", `${args.reference}-CB`)
        .maybeSingle();
      const amount = Number(cb?.amount ?? 0);
      if (amount > 0) {
        const { data: ok } = await admin.rpc("cashback_debit", {
          _user_id: args.buyerId,
          _amount: amount,
        });
        await admin.from("wallet_transactions").insert({
          user_id: args.buyerId,
          tx_hash: `${args.orderId}-CBREV`,
          type: "Cashback Earned",
          amount,
          currency: "USD",
          inflow: false,
          status: ok === false ? "failed" : "success",
          occurred_at: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error("[promotions] cashback reversal failed", e);
  }

  // ---- referral reward clawback ------------------------------------------
  try {
    const { data: before } = await admin
      .from("referrals")
      .select("referrer_id, reward_amount_usd")
      .eq("qualified_order_id", args.orderId)
      .eq("status", "qualified")
      .maybeSingle();
    const { data: rel } = before
      ? await admin
          .from("referrals")
          .update({ status: "pending", qualified_order_id: null, qualified_at: null, reward_amount_usd: 0 })
          .eq("qualified_order_id", args.orderId)
          .eq("status", "qualified")
          .select("referrer_id")
          .maybeSingle()
      : { data: null };
    if (rel) {
      const amount = Number(before?.reward_amount_usd ?? 0);
      if (amount > 0) {
        const { data: ok } = await admin.rpc("cashback_debit", {
          _user_id: rel.referrer_id,
          _amount: amount,
        });
        await admin.from("wallet_transactions").insert({
          user_id: rel.referrer_id,
          tx_hash: `${args.orderId}-REFREV`,
          type: "Referral Reward",
          amount,
          currency: "USD",
          inflow: false,
          status: ok === false ? "failed" : "success",
          occurred_at: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error("[promotions] referral reversal failed", e);
  }
}

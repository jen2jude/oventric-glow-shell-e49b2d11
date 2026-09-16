/**
 * Admin Stage 4 — promotions administration (coupons, cashback config, referrals).
 *
 * Everything here is either a READ of authoritative backend records or a
 * configuration mutation through the existing tables that the server-side
 * promotion engine (src/lib/promotions.server.ts) already reads from.
 *
 * Explicitly NOT here, by design:
 *   • no "credit cashback" / "reward this referral" path — rewards originate
 *     only from settlement (settleOrder → qualifyReferralOnSettledPurchase),
 *   • no wallet, ledger, earnings or revenue mutation,
 *   • no coupon redemption creation — redemptions are written by settlement.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { supabase: any; userId: string };

/** Super admin always passes; other management roles only when listed. */
async function assertRole(ctx: Ctx, allowed: readonly string[]) {
  const { data: isSuper, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (isSuper) return;
  for (const role of allowed) {
    const { data: ok } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
    if (ok) return;
  }
  throw new Error(`Forbidden: requires one of admin, ${allowed.join(", ")}`);
}

async function writeAudit(
  actorId: string,
  action: string,
  targetKind: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any)
    .from("audit_logs")
    .insert({ actor_id: actorId, action, target_kind: targetKind, target_id: targetId, meta });
}

async function nameMap(sb: any, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, { name: string; username: string | null }>();
  if (!unique.length) return map;
  const { data } = await sb
    .from("profiles")
    .select("user_id, display_name, username")
    .in("user_id", unique);
  for (const p of (data ?? []) as any[]) {
    map.set(String(p.user_id), {
      name: (p.display_name as string) || (p.username as string) || "Oventric member",
      username: (p.username as string) ?? null,
    });
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Coupons                                                             */
/* ------------------------------------------------------------------ */

export interface AdminCouponRow {
  code: string;
  discountPct: number;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  minPurchaseUsd: number;
  maxUses: number | null;
  perUserLimit: number | null;
  usedCount: number;
  redemptionCount: number;
  discountedUsd: number;
  sellerId: string | null;
  sellerName: string | null;
  productId: string | null;
  productName: string | null;
  createdAt: string;
}

export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCouponRow[]> => {
    await assertRole(context as Ctx, ["content", "finance"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data, error } = await sb
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];

    const { data: reds } = await sb.from("coupon_redemptions").select("coupon_code, discount_usd");
    const redMap = new Map<string, { count: number; total: number }>();
    for (const r of (reds ?? []) as any[]) {
      const k = String(r.coupon_code);
      const e = redMap.get(k) ?? { count: 0, total: 0 };
      e.count += 1;
      e.total += Number(r.discount_usd ?? 0);
      redMap.set(k, e);
    }

    const sellers = await nameMap(sb, rows.map((r) => String(r.seller_id ?? "")));
    const productIds = rows.map((r) => r.product_id).filter(Boolean);
    const pMap = new Map<string, string>();
    if (productIds.length) {
      const { data: prods } = await sb.from("products").select("id, name").in("id", productIds);
      for (const p of (prods ?? []) as any[]) pMap.set(String(p.id), String(p.name));
    }

    return rows.map((c) => {
      const red = redMap.get(String(c.code)) ?? { count: 0, total: 0 };
      return {
        code: String(c.code),
        discountPct: Number(c.discount_pct ?? 0),
        active: c.active !== false,
        startsAt: (c.starts_at as string | null) ?? null,
        expiresAt: (c.expires_at as string | null) ?? null,
        minPurchaseUsd: Number(c.min_purchase_usd ?? 0),
        maxUses: c.max_uses == null ? null : Number(c.max_uses),
        perUserLimit: c.per_user_limit == null ? null : Number(c.per_user_limit),
        usedCount: Number(c.used_count ?? 0),
        redemptionCount: red.count,
        discountedUsd: Number(red.total.toFixed(2)),
        sellerId: (c.seller_id as string | null) ?? null,
        sellerName: c.seller_id ? sellers.get(String(c.seller_id))?.name ?? null : null,
        productId: (c.product_id as string | null) ?? null,
        productName: c.product_id ? pMap.get(String(c.product_id)) ?? null : null,
        createdAt: c.created_at as string,
      };
    });
  });

const CouponInput = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes or underscores only"),
  discountPct: z.number().min(1).max(100),
  active: z.boolean(),
  startsAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  minPurchaseUsd: z.number().min(0).max(100000),
  maxUses: z.number().int().min(1).nullable().optional(),
  perUserLimit: z.number().int().min(1).nullable().optional(),
  sellerId: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  isNew: z.boolean().default(false),
});

/** Create or edit a coupon. The customer quote still validates eligibility server-side. */
export const adminUpsertCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CouponInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, ["content"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const code = data.code.trim().toUpperCase();

    if (data.startsAt && data.expiresAt && new Date(data.startsAt) >= new Date(data.expiresAt)) {
      throw new Error("The end date must be after the start date");
    }
    if (data.productId) {
      const { data: p } = await sb
        .from("products")
        .select("id, seller_id")
        .eq("id", data.productId)
        .maybeSingle();
      if (!p) throw new Error("That product does not exist");
    }
    if (data.sellerId) {
      const { data: s } = await sb
        .from("profiles")
        .select("user_id")
        .eq("user_id", data.sellerId)
        .maybeSingle();
      if (!s) throw new Error("That seller does not exist");
    }

    const { data: existing } = await sb.from("coupons").select("*").eq("code", code).maybeSingle();
    if (data.isNew && existing) throw new Error("A coupon with that code already exists");
    if (!data.isNew && !existing) throw new Error("That coupon no longer exists");

    const payload = {
      code,
      discount_pct: data.discountPct,
      active: data.active,
      starts_at: data.startsAt || null,
      expires_at: data.expiresAt || null,
      min_purchase_usd: data.minPurchaseUsd,
      max_uses: data.maxUses ?? null,
      per_user_limit: data.perUserLimit ?? null,
      seller_id: data.sellerId ?? null,
      product_id: data.productId ?? null,
    };

    if (existing) {
      const { error } = await sb.from("coupons").update(payload).eq("code", code);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("coupons").insert(payload);
      if (error) throw new Error(error.message);
    }
    await writeAudit(context.userId, existing ? "coupon.update" : "coupon.create", "coupon", code, {
      before: existing ?? null,
      after: payload,
    });
    return { code };
  });

export const adminSetCouponActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ code: z.string().min(1), active: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, ["content"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const code = data.code.toUpperCase();
    const { error } = await sb.from("coupons").update({ active: data.active }).eq("code", code);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, "coupon.set_active", "coupon", code, { active: data.active });
    return { ok: true };
  });

export const adminListCouponRedemptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, ["content", "finance"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: rows } = await sb
      .from("coupon_redemptions")
      .select("id, user_id, order_id, reference, discount_usd, created_at")
      .eq("coupon_code", data.code.toUpperCase())
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (rows ?? []) as any[];
    const users = await nameMap(sb, list.map((r) => String(r.user_id)));
    return list.map((r) => ({
      id: String(r.id),
      userName: users.get(String(r.user_id))?.name ?? "Oventric member",
      orderId: (r.order_id as string | null) ?? null,
      reference: (r.reference as string | null) ?? null,
      discountUsd: Number(r.discount_usd ?? 0),
      createdAt: r.created_at as string,
    }));
  });

/* ------------------------------------------------------------------ */
/* Cashback                                                            */
/* ------------------------------------------------------------------ */

export interface CashbackConfigRow {
  productId: string;
  productName: string;
  sellerId: string | null;
  sellerName: string | null;
  cashbackPct: number;
  status: string;
  priceUsd: number | null;
}

export const adminListCashbackConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashbackConfigRow[]> => {
    await assertRole(context as Ctx, ["content", "finance", "moderator"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data, error } = await sb
      .from("products")
      .select("id, name, seller_id, cashback_pct, status, price_usd")
      .gt("cashback_pct", 0)
      .order("cashback_pct", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const sellers = await nameMap(sb, rows.map((r) => String(r.seller_id ?? "")));
    return rows.map((p) => ({
      productId: String(p.id),
      productName: String(p.name),
      sellerId: (p.seller_id as string | null) ?? null,
      sellerName: p.seller_id ? sellers.get(String(p.seller_id))?.name ?? null : null,
      cashbackPct: Number(p.cashback_pct ?? 0),
      status: String(p.status ?? ""),
      priceUsd: p.price_usd == null ? null : Number(p.price_usd),
    }));
  });

/**
 * Change a product's seller-funded cashback rate. The database constraint caps
 * this at 50%; this function re-validates the same bound before writing.
 * It never moves money — it only changes what future settlements will compute.
 */
export const adminSetProductCashbackPct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ productId: z.string().uuid(), pct: z.number().min(0).max(50) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, ["content"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: before } = await sb
      .from("products")
      .select("id, cashback_pct")
      .eq("id", data.productId)
      .maybeSingle();
    if (!before) throw new Error("That product does not exist");
    const { error } = await sb
      .from("products")
      .update({ cashback_pct: data.pct })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, "product.cashback_pct", "product", data.productId, {
      before: Number(before.cashback_pct ?? 0),
      after: data.pct,
    });
    return { ok: true };
  });

export interface CashbackAwardRow {
  id: string;
  userId: string;
  userName: string;
  amountUsd: number;
  inflow: boolean;
  txHash: string;
  status: string;
  occurredAt: string;
  reference: string | null;
  orderId: string | null;
  productName: string | null;
  sellerName: string | null;
}

/** Cashback awards and their reversals, joined back to the order that caused them. */
export const adminListCashbackAwards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashbackAwardRow[]> => {
    await assertRole(context as Ctx, ["finance", "content"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data, error } = await sb
      .from("wallet_transactions")
      .select("id, user_id, amount, inflow, tx_hash, status, occurred_at")
      .eq("type", "Cashback Earned")
      .order("occurred_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];

    const refs = rows
      .map((r) => String(r.tx_hash ?? ""))
      .filter((h) => h.endsWith("-CB"))
      .map((h) => h.slice(0, -3));
    const orderIds = rows
      .map((r) => String(r.tx_hash ?? ""))
      .filter((h) => h.endsWith("-CBREV"))
      .map((h) => h.slice(0, -6));

    const byRef = new Map<string, any>();
    const byId = new Map<string, any>();
    if (refs.length) {
      const { data: o } = await sb
        .from("orders")
        .select("id, paystack_ref, product_name_snapshot, seller_id")
        .in("paystack_ref", refs);
      for (const r of (o ?? []) as any[]) byRef.set(String(r.paystack_ref), r);
    }
    if (orderIds.length) {
      const { data: o } = await sb
        .from("orders")
        .select("id, paystack_ref, product_name_snapshot, seller_id")
        .in("id", orderIds);
      for (const r of (o ?? []) as any[]) byId.set(String(r.id), r);
    }

    const people = await nameMap(sb, [
      ...rows.map((r) => String(r.user_id)),
      ...[...byRef.values(), ...byId.values()].map((o) => String(o.seller_id ?? "")),
    ]);

    return rows.map((r) => {
      const hash = String(r.tx_hash ?? "");
      const order = hash.endsWith("-CBREV")
        ? byId.get(hash.slice(0, -6))
        : hash.endsWith("-CB")
          ? byRef.get(hash.slice(0, -3))
          : null;
      return {
        id: String(r.id),
        userId: String(r.user_id),
        userName: people.get(String(r.user_id))?.name ?? "Oventric member",
        amountUsd: Number(r.amount ?? 0),
        inflow: Boolean(r.inflow),
        txHash: hash,
        status: String(r.status ?? ""),
        occurredAt: r.occurred_at as string,
        reference: order?.paystack_ref ?? null,
        orderId: order ? String(order.id) : null,
        productName: order?.product_name_snapshot ?? null,
        sellerName: order?.seller_id ? people.get(String(order.seller_id))?.name ?? null : null,
      };
    });
  });

/* ------------------------------------------------------------------ */
/* Referrals                                                           */
/* ------------------------------------------------------------------ */

export interface AdminReferralRow {
  inviteeId: string;
  inviteeName: string;
  referrerId: string;
  referrerName: string;
  status: string;
  createdAt: string;
  qualifiedAt: string | null;
  qualifiedOrderId: string | null;
  orderReference: string | null;
  orderTotalUsd: number | null;
  orderStatus: string | null;
  rewardUsd: number;
  rewardStatus: "none" | "credited" | "reversed" | "failed";
  rewardTxHash: string | null;
}

export interface AdminReferralSettings {
  active: boolean;
  rewardAmountUsd: number;
  minPurchaseUsd: number;
  qualificationDays: number;
  updatedAt: string | null;
}

export const adminReferralOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ settings: AdminReferralSettings; referrals: AdminReferralRow[] }> => {
      await assertRole(context as Ctx, ["finance", "support"]);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;

      const { data: cfg } = await sb
        .from("referral_settings")
        .select("active, reward_amount_usd, min_purchase_usd, qualification_days, updated_at")
        .eq("id", 1)
        .maybeSingle();

      const { data, error } = await sb
        .from("referrals")
        .select("invitee_id, referrer_id, status, created_at, qualified_at, qualified_order_id, reward_amount_usd")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as any[];

      const orderIds = rows.map((r) => r.qualified_order_id).filter(Boolean);
      const orders = new Map<string, any>();
      if (orderIds.length) {
        const { data: o } = await sb
          .from("orders")
          .select("id, paystack_ref, total_usd, status")
          .in("id", orderIds);
        for (const r of (o ?? []) as any[]) orders.set(String(r.id), r);
      }

      // Reward ledger rows are keyed `${orderId}-REF`.
      const rewardHashes = orderIds.map((id: string) => `${id}-REF`);
      const rewards = new Map<string, any>();
      if (rewardHashes.length) {
        const { data: tx } = await sb
          .from("wallet_transactions")
          .select("tx_hash, amount, status, inflow")
          .in("tx_hash", rewardHashes);
        for (const t of (tx ?? []) as any[]) rewards.set(String(t.tx_hash), t);
      }

      const people = await nameMap(sb, [
        ...rows.map((r) => String(r.invitee_id)),
        ...rows.map((r) => String(r.referrer_id)),
      ]);

      const referrals: AdminReferralRow[] = rows.map((r) => {
        const order = r.qualified_order_id ? orders.get(String(r.qualified_order_id)) : null;
        const tx = r.qualified_order_id ? rewards.get(`${r.qualified_order_id}-REF`) : null;
        const rewardStatus: AdminReferralRow["rewardStatus"] = !tx
          ? "none"
          : String(tx.status) === "failed"
            ? "failed"
            : tx.inflow === false
              ? "reversed"
              : String(r.status) === "reversed"
                ? "reversed"
                : "credited";
        return {
          inviteeId: String(r.invitee_id),
          inviteeName: people.get(String(r.invitee_id))?.name ?? "Oventric member",
          referrerId: String(r.referrer_id),
          referrerName: people.get(String(r.referrer_id))?.name ?? "Oventric member",
          status: String(r.status),
          createdAt: r.created_at as string,
          qualifiedAt: (r.qualified_at as string | null) ?? null,
          qualifiedOrderId: (r.qualified_order_id as string | null) ?? null,
          orderReference: order?.paystack_ref ?? null,
          orderTotalUsd: order ? Number(order.total_usd ?? 0) : null,
          orderStatus: order?.status ?? null,
          rewardUsd: Number(r.reward_amount_usd ?? 0),
          rewardStatus,
          rewardTxHash: tx ? String(tx.tx_hash) : null,
        };
      });

      return {
        settings: {
          active: cfg?.active !== false,
          rewardAmountUsd: Number(cfg?.reward_amount_usd ?? 0),
          minPurchaseUsd: Number(cfg?.min_purchase_usd ?? 0),
          qualificationDays: Number(cfg?.qualification_days ?? 0),
          updatedAt: (cfg?.updated_at as string | null) ?? null,
        },
        referrals,
      };
    },
  );

/**
 * Update the referral programme configuration. This changes what FUTURE
 * qualifying settlements pay — it never issues a reward by itself.
 */
export const adminUpdateReferralSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        active: z.boolean(),
        rewardAmountUsd: z.number().min(0).max(1000),
        minPurchaseUsd: z.number().min(0).max(100000),
        qualificationDays: z.number().int().min(0).max(3650),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Configuration of a reward amount is a financial policy change: super admin only.
    await assertRole(context as Ctx, []);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: before } = await sb.from("referral_settings").select("*").eq("id", 1).maybeSingle();
    const payload = {
      id: 1,
      active: data.active,
      reward_amount_usd: data.rewardAmountUsd,
      min_purchase_usd: data.minPurchaseUsd,
      qualification_days: data.qualificationDays,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from("referral_settings").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, "referral_settings.update", "referral_settings", "1", {
      before: before ?? null,
      after: payload,
    });
    return { ok: true };
  });

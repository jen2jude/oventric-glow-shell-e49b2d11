import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Referral programme (Stage 3).
 *
 * Attribution and rewards are strictly separated:
 *  - `attachReferral` only records WHO invited WHOM. It never pays anything.
 *  - The reward is issued exclusively by `qualifyReferralOnSettledPurchase`
 *    (src/lib/promotions.server.ts), called from settlement after a payment is
 *    confirmed paid.
 *
 * This is NOT a reseller programme: there are no tiers, no commissions and no
 * per-sale percentages. A referral reward is a one-off promotional Oventric
 * credit configured in `referral_settings`.
 */

/** Read (and lazily create) the signed-in user's referral code + status list. */
export const getMyReferralOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("user_id", userId)
      .maybeSingle();

    let code = (me?.referral_code as string | null) ?? null;
    if (!code) {
      code = `OV${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      await supabaseAdmin.from("profiles").update({ referral_code: code }).eq("user_id", userId);
    }

    const { data: rows } = await supabaseAdmin
      .from("referrals")
      .select("invitee_id, status, created_at, qualified_at, reward_amount_usd")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const list = rows ?? [];
    const inviteeIds = list.map((r) => String(r.invitee_id));
    const names = new Map<string, { name: string; avatar: string | null }>();
    if (inviteeIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name, username, avatar_path")
        .in("id", inviteeIds);
      for (const p of profs ?? []) {
        names.set(String(p.user_id), {
          name: (p.display_name as string) || (p.username as string) || "Oventric member",
          avatar: (p.avatar_path as string | null) ?? null,
        });
      }
    }

    const { data: cfg } = await supabaseAdmin
      .from("referral_settings")
      .select("active, reward_amount_usd, min_purchase_usd")
      .eq("id", 1)
      .maybeSingle();

    return {
      code,
      active: cfg?.active !== false,
      rewardUSD: Number(cfg?.reward_amount_usd ?? 0),
      minPurchaseUSD: Number(cfg?.min_purchase_usd ?? 0),
      totalInvited: list.length,
      qualified: list.filter((r) => r.status === "qualified").length,
      earnedUSD: list.reduce((s, r) => s + Number(r.reward_amount_usd ?? 0), 0),
      referrals: list.map((r) => ({
        status: String(r.status),
        createdAt: r.created_at as string,
        qualifiedAt: (r.qualified_at as string | null) ?? null,
        rewardUSD: Number(r.reward_amount_usd ?? 0),
        name: names.get(String(r.invitee_id))?.name ?? "Oventric member",
        avatar: names.get(String(r.invitee_id))?.avatar ?? null,
      })),
    };
  });

/**
 * Record attribution for the signed-in user. Server-authoritative:
 *  - self-referral rejected (own code, own id)
 *  - existing attribution is never overwritten by a later claim
 *  - only new accounts with no settled purchase yet can be attributed
 *  - no money is created here under any circumstance
 */
export const attachReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({
    code: String(input.code ?? "").trim().toUpperCase(),
  }))
  .handler(async ({ data, context }) => {
    if (!data.code) return { attached: false, reason: "no-code" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Attribution is immutable once set — a client cannot re-point it.
    const { data: existing } = await supabaseAdmin
      .from("referrals")
      .select("invitee_id")
      .eq("invitee_id", userId)
      .maybeSingle();
    if (existing) return { attached: false, reason: "already-attributed" as const };

    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", data.code)
      .maybeSingle();
    if (!referrer) return { attached: false, reason: "unknown-code" as const };
    if (String(referrer.id) === userId) return { attached: false, reason: "self" as const };

    // Only before the invitee's first settled purchase.
    const { count: paidCount } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", userId)
      .eq("status", "paid");
    if (Number(paidCount ?? 0) > 0) return { attached: false, reason: "too-late" as const };

    const { error } = await supabaseAdmin.from("referrals").insert({
      invitee_id: userId,
      referrer_id: referrer.id,
      status: "pending",
    });
    if (error && String(error.code) !== "23505") {
      return { attached: false, reason: "failed" as const };
    }
    return { attached: true, reason: "ok" as const };
  });

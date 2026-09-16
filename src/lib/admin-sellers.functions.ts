import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Read-only seller + shop admin surface. A "seller" is an existing profile that
 * owns at least one product — there is no separate seller or shop table, so this
 * reuses `profiles` (shop branding lives there) and `products`/`orders` counts.
 * Mutations continue to use the existing verifySeller / suspendSeller functions.
 */
export interface AdminSellerRow {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarPath: string | null;
  country: string | null;
  createdAt: string;
  verificationTier: string | null;
  kycCompletedAt: string | null;
  flagged: boolean;
  flagReason: string | null;
  bannedAt: string | null;
  shopName: string | null;
  shopAbout: string | null;
  shopSlug: string | null;
  productCount: number;
  activeProductCount: number;
  promotedProductCount: number;
  salesCount: number;
  grossSalesUsd: number;
}

export const adminListSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSellerRow[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbUser = context.supabase as any;
    const { data: allowed, error: rErr } = await sbUser.rpc("has_any_management_role", {
      _user_id: context.userId,
    });
    if (rErr) throw new Error(rErr.message);
    if (!allowed) throw new Error("Forbidden: management role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;

    const { data: products, error: pErr } = await sb
      .from("products")
      .select("id, seller_id, status, promoted")
      .limit(5000);
    if (pErr) throw new Error(pErr.message);

    const stats = new Map<
      string,
      { total: number; active: number; promoted: number; sales: number; gross: number }
    >();
    const bump = (id: string) => {
      const s = stats.get(id) ?? { total: 0, active: 0, promoted: 0, sales: 0, gross: 0 };
      stats.set(id, s);
      return s;
    };
    for (const p of (products ?? []) as Array<Record<string, unknown>>) {
      if (!p.seller_id) continue;
      const s = bump(p.seller_id as string);
      s.total += 1;
      if (p.status === "active") s.active += 1;
      if (p.promoted) s.promoted += 1;
    }

    const sellerIds = Array.from(stats.keys());
    if (sellerIds.length === 0) return [];

    const { data: orders } = await sb
      .from("orders")
      .select("seller_id, total_usd, status")
      .eq("status", "paid")
      .in("seller_id", sellerIds);
    for (const o of (orders ?? []) as Array<Record<string, unknown>>) {
      const s = bump(o.seller_id as string);
      s.sales += 1;
      s.gross += Number(o.total_usd ?? 0);
    }

    const { data: profiles, error: prErr } = await sb
      .from("profiles")
      .select(
        "user_id, slug, username, display_name, avatar_path, country, created_at, verification_tier, kyc_completed_at, flagged, flag_reason, banned_at, shop_name, shop_about",
      )
      .in("user_id", sellerIds);
    if (prErr) throw new Error(prErr.message);

    return ((profiles ?? []) as Array<Record<string, unknown>>)
      .map((p) => {
        const s = stats.get(p.user_id as string)!;
        return {
          userId: p.user_id as string,
          username: (p.username as string) ?? null,
          displayName: (p.display_name as string) ?? null,
          avatarPath: (p.avatar_path as string) ?? null,
          country: (p.country as string) ?? null,
          createdAt: p.created_at as string,
          verificationTier: (p.verification_tier as string) ?? null,
          kycCompletedAt: (p.kyc_completed_at as string) ?? null,
          flagged: Boolean(p.flagged),
          flagReason: (p.flag_reason as string) ?? null,
          bannedAt: (p.banned_at as string) ?? null,
          shopName: (p.shop_name as string) ?? null,
          shopAbout: (p.shop_about as string) ?? null,
          shopSlug: (p.slug as string) ?? null,
          productCount: s.total,
          activeProductCount: s.active,
          promotedProductCount: s.promoted,
          salesCount: s.sales,
          grossSalesUsd: Number(s.gross.toFixed(2)),
        };
      })
      .sort((a, b) => b.productCount - a.productCount);
  });

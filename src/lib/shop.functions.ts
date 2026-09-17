import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Seller shop branding + shop-page discovery rails.
// The shop is a commerce surface that is intentionally separate from the
// social identity hub: it has its own name, logo, cover and about copy.
// ---------------------------------------------------------------------------

export interface ShopBranding {
  userId: string;
  slug: string;
  shopName: string;
  shopAbout: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  verificationTier: string;
  country: string | null;
  /** True only when an admin has approved a seller verification request. */
  verified: boolean;
}

export interface ShopRailItem {
  id: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  priceUsd?: number;
  meta?: string | null;
}

export interface ShopDiscovery {
  similarProducts: ShopRailItem[];
  blog: ShopRailItem[];
  bounties: ShopRailItem[];
  courses: ShopRailItem[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serverPublicClient() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function sign(
  sb: ReturnType<typeof serverPublicClient>,
  bucket: string,
  paths: (string | null | undefined)[],
): Promise<(string | null)[]> {
  const clean = paths.map((p) => (typeof p === "string" && p ? p : null));
  const unique = Array.from(new Set(clean.filter((p): p is string => !!p)));
  if (unique.length === 0) return clean.map(() => null);
  const { data } = await sb.storage.from(bucket).createSignedUrls(unique, 60 * 60 * 24 * 7);
  const map = new Map<string, string>();
  (data ?? []).forEach((r) => {
    if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
  });
  return clean.map((p) => (p ? (map.get(p) ?? null) : null));
}

const IdInput = z.object({ idOrSlug: z.string().trim().min(1).max(120) });

export const getShopBranding = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }): Promise<{ shop: ShopBranding | null }> => {
    const sb = serverPublicClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const query = supabaseAdmin
      .from("profiles")
      .select(
        "user_id, slug, display_name, username, bio, avatar_path, cover_path, shop_name, shop_about, shop_logo_path, shop_cover_path, verification_tier, country",
      )
      .limit(1);

    const { data: row } = UUID_RE.test(data.idOrSlug)
      ? await query.eq("user_id", data.idOrSlug).maybeSingle()
      : await query.or(`slug.eq.${data.idOrSlug},username.eq.${data.idOrSlug}`).maybeSingle();

    if (!row) return { shop: null };
    const r = row as Record<string, string | null>;

    const [logoShop, coverShop, avatar, cover] = await Promise.all([
      sign(sb, "avatars", [r['shop_logo_path']]).then((a) => a[0]),
      sign(sb, "profile-covers", [r['shop_cover_path']]).then((a) => a[0]),
      sign(sb, "avatars", [r['avatar_path']]).then((a) => a[0]),
      sign(sb, "profile-covers", [r['cover_path']]).then((a) => a[0]),
    ]);

    return {
      shop: {
        userId: r['user_id'] as string,
        slug: r['slug'] as string,
        shopName:
          (r['shop_name'] ?? "").trim() ||
          (r['display_name'] ?? "").trim() ||
          (r['username'] ?? "").trim() ||
          (r['slug'] as string),
        shopAbout: (r['shop_about'] ?? "")?.trim() || r['bio'] || null,
        logoUrl: logoShop ?? avatar,
        coverUrl: coverShop ?? cover,
        verificationTier: r['verification_tier'] ?? "none",
        country: r['country'] ?? null,
      },
    };
  });

const UpdateShopInput = z.object({
  shopName: z.string().trim().max(60).optional(),
  shopAbout: z.string().trim().max(2000).optional(),
  shopLogoPath: z.string().trim().max(400).nullable().optional(),
  shopCoverPath: z.string().trim().max(400).nullable().optional(),
});

export const updateMyShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateShopInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      shop_name?: string | null;
      shop_about?: string | null;
      shop_logo_path?: string | null;
      shop_cover_path?: string | null;
    } = {};
    if (data.shopName !== undefined) patch.shop_name = data.shopName || null;
    if (data.shopAbout !== undefined) patch.shop_about = data.shopAbout || null;
    if (data.shopLogoPath !== undefined) patch.shop_logo_path = data.shopLogoPath;
    if (data.shopCoverPath !== undefined) patch.shop_cover_path = data.shopCoverPath;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);

    if (error) {
      console.error("[updateMyShop] failed", error);
      throw new Error("Failed to update shop details");
    }
    return { ok: true };
  });

const DiscoveryInput = z.object({
  sellerId: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).optional(),
});

export const getShopDiscovery = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => DiscoveryInput.parse(input))
  .handler(async ({ data }): Promise<ShopDiscovery> => {
    const sb = serverPublicClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const productQuery = sb
      .from("products")
      .select("id, slug, name, category, price_usd, cover_path, vendor, seller_id, status, rating")
      .eq("status", "active")
      .neq("seller_id", data.sellerId)
      .limit(18);

    const [prodRes, blogRes, bntRes, courseRes] = await Promise.all([
      data.category ? productQuery.eq("category", data.category) : productQuery,
      supabaseAdmin
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_path, published_at, status")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(8),
      sb
        .from("bounties")
        .select("id, title, price_usd, cover_path, category, status")
        .eq("status", "active")
        .order("price_usd", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("courses")
        .select("id, title, category, cover_path, price_usd, is_free, instructor_name, is_published")
        .eq("is_published", true)
        .limit(8),
    ]);

    const pRows = (prodRes.data ?? []) as Array<Record<string, unknown>>;
    let pAll = pRows;
    if (data.category && pRows.length < 6) {
      const { data: fallback } = await sb
        .from("products")
        .select("id, slug, name, category, price_usd, cover_path, vendor, seller_id, status, rating")
        .eq("status", "active")
        .neq("seller_id", data.sellerId)
        .limit(18);
      const seen = new Set(pRows.map((p) => p['id'] as string));
      pAll = [
        ...pRows,
        ...((fallback ?? []) as Array<Record<string, unknown>>).filter(
          (p) => !seen.has(p['id'] as string),
        ),
      ];
    }
    pAll = pAll.slice(0, 12);

    const pCovers = await sign(sb, "product-covers", pAll.map((p) => p['cover_path'] as string));
    const similarProducts: ShopRailItem[] = pAll.map((p, i) => ({
      id: ((p['slug'] as string) || (p['id'] as string)),
      title: (p['name'] as string) ?? "Product",
      subtitle: (p['vendor'] as string) ?? null,
      coverUrl: pCovers[i] ?? null,
      priceUsd: Number(p['price_usd'] ?? 0),
      meta: (p['category'] as string) ?? null,
    }));

    const bRows = (blogRes.data ?? []) as Array<Record<string, unknown>>;
    const bCovers = await sign(supabaseAdmin as never, "blog-covers", bRows.map((b) => b['cover_path'] as string));
    const blog: ShopRailItem[] = bRows.map((b, i) => ({
      id: (b['slug'] as string) ?? (b['id'] as string),
      title: (b['title'] as string) ?? "Article",
      subtitle: (b['excerpt'] as string) ?? null,
      coverUrl: bCovers[i] ?? null,
      meta: (b['published_at'] as string) ?? null,
    }));

    const bntRows = (bntRes.data ?? []) as Array<Record<string, unknown>>;
    const bntCovers = await sign(sb, "bounty-covers", bntRows.map((b) => b['cover_path'] as string));
    const bounties: ShopRailItem[] = bntRows.map((b, i) => ({
      id: b['id'] as string,
      title: (b['title'] as string) ?? "Bounty",
      subtitle: (b['category'] as string) ?? null,
      coverUrl: bntCovers[i] ?? null,
      priceUsd: Number(b['price_usd'] ?? 0),
    }));

    const cRows = (courseRes.data ?? []) as Array<Record<string, unknown>>;
    const cCovers = await sign(supabaseAdmin as never, "course-covers", cRows.map((c) => c['cover_path'] as string));
    const courses: ShopRailItem[] = cRows.map((c, i) => ({
      id: c['id'] as string,
      title: (c['title'] as string) ?? "Course",
      subtitle: (c['instructor_name'] as string) ?? null,
      coverUrl: cCovers[i] ?? null,
      priceUsd: c['is_free'] ? 0 : Number(c['price_usd'] ?? 0),
      meta: (c['category'] as string) ?? null,
    }));

    return { similarProducts, blog, bounties, courses };
  });

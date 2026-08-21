import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface DiscoveryPeer {
  id: string;
  slug: string;
  name: string;
  initials: string;
  stars: number;
  avatarUrl: string | null;
  gradient: string;
}

export interface DiscoveryBounty {
  id: string;
  title: string;
  amountUsd: number;
  coverUrl: string | null;
  category: string | null;
}

export interface DiscoveryProduct {
  id: string;
  title: string;
  category: string;
  priceUsd: number;
  coverUrl: string | null;
  hue: string;
  vendor: string;
  originalCurrency: string;
  originalAmount: number;
  fxSnapshot: number | null;
}

export interface DiscoveryAd {
  id: string;
  advertiser: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  tier: "text" | "image" | "video";
  coverUrl: string | null;
}

export interface DiscoveryFeed {
  peers: DiscoveryPeer[];
  topPeersAny: DiscoveryPeer[];
  bounties: DiscoveryBounty[];
  products: DiscoveryProduct[];
  ads: DiscoveryAd[];
}

const GRADIENTS = [
  "from-purple-500 to-pink-500",
  "from-orange-400 to-red-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-indigo-500",
  "from-fuchsia-500 to-purple-700",
  "from-amber-400 to-orange-600",
  "from-cyan-400 to-blue-600",
  "from-rose-400 to-pink-600",
];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function serverPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function signBucket(
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

export const getDiscoveryFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<DiscoveryFeed> => {
    const sb = serverPublicClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profilesRes, bountiesRes, productsRes, adsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, slug, display_name, username, avatar_path")
        .not("display_name", "is", null)
        .limit(200),
      sb
        .from("bounties")
        .select("id, title, price_usd, cover_path, category, status, end_at")
        .eq("status", "active")
        .order("price_usd", { ascending: false })
        .limit(25),
      sb
        .from("products")
        .select("id, name, category, price_usd, original_currency, original_amount, fx_snapshot, cover_path, hue, vendor, promoted, reviews, rating")
        .order("promoted", { ascending: false })
        .order("reviews", { ascending: false })
        .order("rating", { ascending: false })
        .limit(30),
      sb
        .from("ad_campaigns")
        .select("id, advertiser, title, header, body, cta_label, cta_url, tier, media_url, media_path, placements, status, start_at, end_at")
        .eq("status", "active")
        .limit(20),
    ]);

    // ---- Peers: compute REAL reputation stars from live activity; keep only top-tier (>= 4.0) ----
    const profileRows = (profilesRes.data ?? []).filter(
      (p) => !!p.display_name && p.slug && !/^user-[a-f0-9]+$/i.test(p.slug as string),
    );
    const candidateIds = profileRows.map((p) => p.user_id as string);

    let allProducts: Array<{ seller_id: string; rating: number | null; reviews: number | null }> = [];
    let allBounties: Array<{ poster_id: string; status: string | null }> = [];
    let allPosts: Array<{ author_id: string; created_at: string }> = [];

    if (candidateIds.length > 0) {
      const [prodAll, bntAll, postAll] = await Promise.all([
        supabaseAdmin.from("products").select("seller_id, rating, reviews").in("seller_id", candidateIds),
        supabaseAdmin.from("bounties").select("poster_id, status").in("poster_id", candidateIds),
        supabaseAdmin.from("posts").select("author_id, created_at").in("author_id", candidateIds),
      ]);
      allProducts = (prodAll.data ?? []) as typeof allProducts;
      allBounties = (bntAll.data ?? []) as typeof allBounties;
      allPosts = (postAll.data ?? []) as typeof allPosts;
    }

    const since30d = Date.now() - 30 * 24 * 3600 * 1000;
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

    const statsByUser = new Map<string, {
      ratingWeighted: number; reviewSum: number; productsListed: number;
      bountiesSolved: number; bountiesPosted: number;
      postsTotal: number; postsLast30d: number;
    }>();
    const stat = (uid: string) => {
      let s = statsByUser.get(uid);
      if (!s) {
        s = { ratingWeighted: 0, reviewSum: 0, productsListed: 0, bountiesSolved: 0, bountiesPosted: 0, postsTotal: 0, postsLast30d: 0 };
        statsByUser.set(uid, s);
      }
      return s;
    };
    for (const p of allProducts) {
      const s = stat(p.seller_id);
      s.productsListed += 1;
      const r = Number(p.rating ?? 0);
      const rv = Number(p.reviews ?? 0);
      if (rv > 0 && r > 0) { s.ratingWeighted += r * rv; s.reviewSum += rv; }
    }
    for (const b of allBounties) {
      const s = stat(b.poster_id);
      s.bountiesPosted += 1;
      if (b.status === "solved") s.bountiesSolved += 1;
    }
    for (const p of allPosts) {
      const s = stat(p.author_id);
      s.postsTotal += 1;
      if (new Date(p.created_at).getTime() >= since30d) s.postsLast30d += 1;
    }

    const scored = profileRows.map((p) => {
      const s = statsByUser.get(p.user_id as string) ?? { ratingWeighted: 0, reviewSum: 0, productsListed: 0, bountiesSolved: 0, bountiesPosted: 0, postsTotal: 0, postsLast30d: 0 };
      const avgRating = s.reviewSum > 0 ? s.ratingWeighted / s.reviewSum : 0;
      const weighted =
        clamp01(avgRating / 5) * 0.3 +
        clamp01(s.bountiesSolved / 15) * 0.25 +
        clamp01(s.productsListed / 10) * 0.15 +
        clamp01(s.postsLast30d / 20) * 0.15 +
        clamp01((s.postsTotal + s.bountiesPosted) / 60) * 0.15;
      const stars = Math.round(weighted * 5 * 10) / 10;
      return { p, stars };
    });

    // Only top-tier peers (>= 4.0 stars), highest first — used by the legacy
    // sticky-peers widget.
    const topScored = scored
      .filter((x) => x.stars >= 4.0)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 10);

    // Top peers ANY tier — walk down from 5★ to 1★ until we have 5 candidates.
    const anyScored = scored
      .filter((x) => x.stars >= 1.0)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 5);

    const combined = Array.from(
      new Map([...topScored, ...anyScored].map((s) => [s.p.user_id, s])).values(),
    );
    const avatarUrls = await signBucket(sb, "avatars", combined.map((x) => x.p.avatar_path));
    const urlByUser = new Map<string, string | null>();
    combined.forEach((x, i) => urlByUser.set(x.p.user_id as string, avatarUrls[i]));

    const toPeer = (x: typeof topScored[number], i: number): DiscoveryPeer => {
      const name = (x.p.display_name || x.p.username || x.p.slug) as string;
      return {
        id: x.p.user_id as string,
        slug: x.p.slug as string,
        name,
        initials: initialsFor(name),
        stars: x.stars,
        avatarUrl: urlByUser.get(x.p.user_id as string) ?? null,
        gradient: GRADIENTS[i % GRADIENTS.length],
      };
    };
    const peers: DiscoveryPeer[] = topScored.map(toPeer);
    const topPeersAny: DiscoveryPeer[] = anyScored.map(toPeer);

    // ---- Bounties (top 5 by escrow) ----
    const bRows = bountiesRes.data ?? [];
    const bCovers = await signBucket(sb, "bounty-covers", bRows.map((b) => b.cover_path));
    const bountiesAll: DiscoveryBounty[] = bRows.map((b, i) => ({
      id: b.id as string,
      title: b.title as string,
      amountUsd: Number(b.price_usd ?? 0),
      coverUrl: bCovers[i],
      category: (b.category as string) ?? null,
    }));
    const bounties = bountiesAll.slice(0, 5);

    // ---- Products (10 trending, randomized between visits) ----
    const pRows = productsRes.data ?? [];
    const pCovers = await signBucket(sb, "product-covers", pRows.map((p) => p.cover_path));
    const productsAll: DiscoveryProduct[] = pRows.map((p, i) => ({
      id: p.id as string,
      title: p.name as string,
      category: (p.category as string) ?? "misc",
      priceUsd: Number(p.price_usd ?? 0),
      coverUrl: pCovers[i],
      hue: (p.hue as string) ?? "from-emerald-500 to-teal-600",
      vendor: (p.vendor as string) ?? "",
      originalCurrency: (p.original_currency as string) ?? "USD",
      originalAmount: Number(p.original_amount ?? p.price_usd ?? 0),
      fxSnapshot: p.fx_snapshot == null ? null : Number(p.fx_snapshot),
    }));
    const products = shuffle(productsAll).slice(0, 10);

    // ---- Sponsored (filter by placement + active window, randomize) ----
    const now = Date.now();
    const adRows = (adsRes.data ?? []).filter((a) => {
      const placements = (a.placements as string[]) ?? [];
      if (!placements.includes("feed") && !placements.includes("marketplace")) return false;
      if (a.start_at && new Date(a.start_at as string).getTime() > now) return false;
      if (a.end_at && new Date(a.end_at as string).getTime() < now) return false;
      return true;
    });
    const adCovers = await signBucket(
      sb,
      "product-covers",
      adRows.map((a) => (a.media_path && !a.media_url ? (a.media_path as string) : null)),
    );
    const adsAll: DiscoveryAd[] = adRows.map((a, i) => ({
      id: a.id as string,
      advertiser: (a.advertiser as string) ?? "Sponsor",
      title: (a.title as string) || (a.header as string) || "Sponsored placement",
      body: (a.body as string) ?? "",
      ctaLabel: (a.cta_label as string) || "Learn more",
      ctaUrl: (a.cta_url as string) || "#",
      tier: ((a.tier as "text" | "image" | "video") ?? "text"),
      coverUrl: (a.media_url as string) || adCovers[i],
    }));
    const ads = shuffle(adsAll).slice(0, 5);

    return { peers, topPeersAny, bounties, products, ads };
  },
);

// ─── Academy recommendations ─────────────────────────────────────────────────

export interface RecoCourse {
  id: string;
  title: string;
  category: string;
  coverUrl: string | null;
  priceUsd: number;
  isFree: boolean;
  instructor: string | null;
  enrollments: number;
}
export interface RecoCircle {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  category: string;
  memberCount: number;
  coverUrl: string | null;
  avatarUrl: string | null;
}
export interface RecoBlog {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  categoryName: string | null;
  publishedAt: string | null;
}

export interface AcademyRecommendations {
  courses: RecoCourse[];
  products: DiscoveryProduct[];
  bounties: DiscoveryBounty[];
  circles: RecoCircle[];
  blog: RecoBlog[];
  promoted: DiscoveryAd[];
}

export const getAcademyRecommendations = createServerFn({ method: "GET" }).handler(
  async (): Promise<AcademyRecommendations> => {
    const sb = serverPublicClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [coursesRes, enrollRes, prodRes, bntRes, circleRes, memberRes, blogRes, adsRes] = await Promise.all([
      supabaseAdmin
        .from("courses")
        .select("id, title, category, cover_path, price_usd, is_free, instructor_name, is_published, promoted")
        .eq("is_published", true)
        .limit(60),
      supabaseAdmin.from("course_enrollments").select("course_id"),
      sb
        .from("products")
        .select("id, name, category, price_usd, original_currency, original_amount, fx_snapshot, cover_path, hue, vendor, kind, status, reviews, rating, promoted")
        .eq("status", "active")
        .order("promoted", { ascending: false })
        .order("reviews", { ascending: false })
        .order("rating", { ascending: false })
        .limit(24),
      sb
        .from("bounties")
        .select("id, title, price_usd, cover_path, category, status")
        .eq("status", "active")
        .order("price_usd", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("circles")
        .select("id, slug, name, emoji, category, cover_url, avatar_url")
        .limit(60),
      supabaseAdmin.from("circle_members").select("circle_id"),
      supabaseAdmin
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_path, published_at, category_id, status")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(8),
      sb
        .from("ad_campaigns")
        .select("id, advertiser, title, header, body, cta_label, cta_url, tier, media_url, media_path, placements, status, start_at, end_at")
        .eq("status", "active")
        .limit(20),
    ]);

    // ---- Courses (most enrolled) ----
    const enrollCount = new Map<string, number>();
    (enrollRes.data ?? []).forEach((r: any) => {
      if (r.course_id) enrollCount.set(r.course_id, (enrollCount.get(r.course_id) ?? 0) + 1);
    });
    const cRows = coursesRes.data ?? [];
    const cCovers = await signBucket(supabaseAdmin as any, "course-covers", cRows.map((c: any) => c.cover_path));
    const coursesAll: RecoCourse[] = cRows.map((c: any, i: number) => ({
      id: c.id,
      title: c.title,
      category: c.category ?? "misc",
      coverUrl: cCovers[i],
      priceUsd: Number(c.price_usd ?? 0),
      isFree: !!c.is_free,
      instructor: c.instructor_name ?? null,
      enrollments: enrollCount.get(c.id) ?? 0,
    }));
    const courses = coursesAll
      .sort((a, b) => b.enrollments - a.enrollments || (b.priceUsd > 0 ? 1 : -1))
      .slice(0, 6);

    // ---- Products (mixed digital + physical, top rated / most reviewed) ----
    const pRows = prodRes.data ?? [];
    const pCovers = await signBucket(sb, "product-covers", pRows.map((p: any) => p.cover_path));
    const productsAll: DiscoveryProduct[] = pRows.map((p: any, i: number) => ({
      id: p.id,
      title: p.name,
      category: p.category ?? "misc",
      priceUsd: Number(p.price_usd ?? 0),
      coverUrl: pCovers[i],
      hue: p.hue ?? "from-emerald-500 to-teal-600",
      vendor: p.vendor ?? "",
      originalCurrency: p.original_currency ?? "USD",
      originalAmount: Number(p.original_amount ?? p.price_usd ?? 0),
      fxSnapshot: p.fx_snapshot == null ? null : Number(p.fx_snapshot),
    }));
    // Split by kind to keep the mix balanced
    const digital = pRows.map((p: any, i: number) => ({ p: productsAll[i], kind: p.kind }))
      .filter((x) => x.kind === "digital").slice(0, 4).map((x) => x.p);
    const physical = pRows.map((p: any, i: number) => ({ p: productsAll[i], kind: p.kind }))
      .filter((x) => x.kind !== "digital").slice(0, 4).map((x) => x.p);
    const products = [...digital, ...physical].slice(0, 6);

    // ---- Bounties ----
    const bRows = bntRes.data ?? [];
    const bCovers = await signBucket(supabaseAdmin as any, "bounty-covers", bRows.map((b: any) => b.cover_path));
    const bounties: DiscoveryBounty[] = bRows.map((b: any, i: number) => ({
      id: b.id,
      title: b.title,
      amountUsd: Number(b.price_usd ?? 0),
      coverUrl: bCovers[i],
      category: b.category ?? null,
    })).slice(0, 6);

    // ---- Circles (top by member count) ----
    const memberByCircle = new Map<string, number>();
    (memberRes.data ?? []).forEach((m: any) => {
      if (m.circle_id) memberByCircle.set(m.circle_id, (memberByCircle.get(m.circle_id) ?? 0) + 1);
    });
    const clRows = circleRes.data ?? [];
    const clAvatars = await signBucket(supabaseAdmin as any, "circle-avatars", clRows.map((c: any) => {
      const v = c.avatar_url as string | null;
      return v && !/^https?:\/\//.test(v) ? v : null;
    }));
    const clCovers = await signBucket(supabaseAdmin as any, "circle-covers", clRows.map((c: any) => {
      const v = c.cover_url as string | null;
      return v && !/^https?:\/\//.test(v) ? v : null;
    }));
    const circles: RecoCircle[] = clRows.map((c: any, i: number) => {
      const avatarRaw = c.avatar_url as string | null;
      const coverRaw = c.cover_url as string | null;
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        emoji: c.emoji ?? "🌐",
        category: c.category ?? "general",
        memberCount: memberByCircle.get(c.id) ?? 0,
        coverUrl: coverRaw && /^https?:\/\//.test(coverRaw) ? coverRaw : clCovers[i],
        avatarUrl: avatarRaw && /^https?:\/\//.test(avatarRaw) ? avatarRaw : clAvatars[i],
      };
    })
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 6);

    // ---- Blog news ----
    const blRows = blogRes.data ?? [];
    const blCovers = await signBucket(supabaseAdmin as any, "blog-covers", blRows.map((b: any) => b.cover_path));
    const catIds = Array.from(new Set(blRows.map((b: any) => b.category_id).filter(Boolean))) as string[];
    let catMap = new Map<string, string>();
    if (catIds.length) {
      const { data: cats } = await supabaseAdmin.from("blog_categories").select("id, name").in("id", catIds);
      catMap = new Map((cats ?? []).map((c: any) => [c.id as string, c.name as string]));
    }
    const blog: RecoBlog[] = blRows.map((b: any, i: number) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      excerpt: b.excerpt ?? "",
      coverUrl: blCovers[i],
      categoryName: b.category_id ? (catMap.get(b.category_id) ?? null) : null,
      publishedAt: b.published_at,
    })).slice(0, 6);

    // ---- Promoted ads (any feed/marketplace/academy) ----
    const now = Date.now();
    const adRows = (adsRes.data ?? []).filter((a: any) => {
      const placements = (a.placements as string[]) ?? [];
      if (!placements.some((p) => ["feed", "marketplace", "academy"].includes(p))) return false;
      if (a.start_at && new Date(a.start_at).getTime() > now) return false;
      if (a.end_at && new Date(a.end_at).getTime() < now) return false;
      return true;
    });
    const adCovers = await signBucket(sb, "product-covers",
      adRows.map((a: any) => (a.media_path && !a.media_url ? a.media_path : null)));
    const promoted: DiscoveryAd[] = adRows.map((a: any, i: number) => ({
      id: a.id,
      advertiser: a.advertiser ?? "Sponsor",
      title: a.title || a.header || "Sponsored",
      body: a.body ?? "",
      ctaLabel: a.cta_label || "Learn more",
      ctaUrl: a.cta_url || "#",
      tier: (a.tier as "text" | "image" | "video") ?? "text",
      coverUrl: a.media_url || adCovers[i],
    })).slice(0, 4);

    return { courses, products, bounties, circles, blog, promoted };
  },
);

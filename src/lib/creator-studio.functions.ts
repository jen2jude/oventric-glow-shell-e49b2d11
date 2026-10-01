import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { stableImageUrl } from "@/lib/storage/stable-image";

export interface StudioPostDTO {
  id: string;
  title: string;
  status: "draft" | "published";
  visibility: string;
  contentType: string | null;
  views: number;
  thumbUrl: string | null;
  isVideo: boolean;
  createdAt: string;
  productId: string | null;
}

export interface StudioResourceDTO {
  postId: string;
  productId: string;
  title: string;
  type: string | null;
  isFree: boolean;
  priceUsd: number;
  downloads: number;
  sales: number;
  revenueUsd: number;
  status: string;
}

export interface StudioChallengeDTO {
  id: string;
  title: string;
  endsAt: string;
  entered: number;
}

export interface CreatorStudioDTO {
  stats: { views: number; followers: number; downloads: number; sales: number; earningsUsd: number; published: number; drafts: number };
  posts: StudioPostDTO[];
  resources: StudioResourceDTO[];
  challenges: StudioChallengeDTO[];
  profile: {
    name: string;
    slug: string | null;
    bio: string;
    category: string;
    fields: string[];
    tools: string[];
    avatarUrl: string | null;
    coverUrl: string | null;
    featuredPostId: string | null;
    featuredResourceId: string | null;
  };
}

const img = (bucket: "avatars" | "profile-covers" | "post-media", p: string | null | undefined) =>
  !p ? null : /^https?:\/\//.test(p) ? p : stableImageUrl(bucket, p);

/** Private Creator Studio snapshot — the signed-in creator's own rows only. */
export const getCreatorStudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioDTO> => {
    const me = context.userId;
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");

    const [{ data: postRows }, { count: followers }, { data: prof }] = await Promise.all([
      sb.from("creator_posts")
        .select("id, title, caption, status, visibility, content_type, view_count, media_paths, media_type, product_id, resource_type, created_at")
        .eq("author_id", me)
        .order("created_at", { ascending: false })
        .limit(300),
      sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", me),
      sb.from("profiles").select("display_name, slug, bio, tools, avatar_path, cover_path, creator_profile").eq("user_id", me).maybeSingle(),
    ]);
    const rows = postRows ?? [];

    const posts: StudioPostDTO[] = rows.map((r) => {
      const first = (r.media_paths ?? [])[0] ?? null;
      const isVideo = r.media_type === "video";
      return {
        id: r.id,
        title: r.title || (r.caption ?? "").slice(0, 80) || "Untitled post",
        status: r.status === "draft" ? "draft" : "published",
        visibility: r.visibility ?? "public",
        contentType: r.content_type ?? null,
        views: Number(r.view_count) || 0,
        thumbUrl: first ? img("post-media", isVideo && !/^https?:/.test(first) ? `${first}.poster.jpg` : first) : null,
        isVideo,
        createdAt: r.created_at,
        productId: r.product_id ?? null,
      };
    });

    // Resources = posts with an attached file product. Money/downloads come
    // only from the seller's own PAID orders on those products.
    const resRows = rows.filter((r) => r.product_id);
    const productIds = Array.from(new Set(resRows.map((r) => r.product_id as string)));
    const products = new Map<string, { status: string; price: number }>();
    const agg = new Map<string, { downloads: number; sales: number; revenue: number }>();
    if (productIds.length) {
      const [{ data: prods }, { data: orders }] = await Promise.all([
        sb.from("products").select("id, status, price_usd").in("id", productIds).eq("seller_id", me),
        sb.from("orders").select("product_id, total_usd, seller_share_usd").in("product_id", productIds).eq("seller_id", me).eq("status", "paid"),
      ]);
      (prods ?? []).forEach((p) => products.set(p.id, { status: p.status as string, price: Number(p.price_usd) || 0 }));
      (orders ?? []).forEach((o) => {
        if (!o.product_id) return;
        const a = agg.get(o.product_id) ?? { downloads: 0, sales: 0, revenue: 0 };
        a.downloads += 1;
        if (Number(o.total_usd) > 0) { a.sales += 1; a.revenue += Number(o.seller_share_usd) || 0; }
        agg.set(o.product_id, a);
      });
    }
    const seenProduct = new Set<string>();
    const resources: StudioResourceDTO[] = [];
    for (const r of resRows) {
      const pid = r.product_id as string;
      const prod = products.get(pid);
      if (!prod || seenProduct.has(pid)) continue;
      seenProduct.add(pid);
      const a = agg.get(pid) ?? { downloads: 0, sales: 0, revenue: 0 };
      resources.push({
        postId: r.id,
        productId: pid,
        title: r.title || "Untitled resource",
        type: r.resource_type ?? null,
        isFree: prod.price <= 0,
        priceUsd: prod.price,
        downloads: a.downloads,
        sales: a.sales,
        revenueUsd: Math.round(a.revenue * 100) / 100,
        status: prod.status === "active" ? (r.status === "draft" ? "Draft" : "Live") : prod.status === "pending" ? "In review" : prod.status,
      });
    }

    // Open challenges + how many of my posts are entered.
    const nowIso = new Date().toISOString();
    const { data: ch } = await sb.from("creator_challenges").select("id, title, ends_at").eq("status", "published").lte("starts_at", nowIso).gt("ends_at", nowIso).order("ends_at").limit(20);
    const chIds = (ch ?? []).map((c) => c.id);
    const { data: mySubs } = chIds.length ? await sb.from("creator_challenge_submissions").select("challenge_id").eq("user_id", me).in("challenge_id", chIds) : { data: [] as { challenge_id: string }[] };
    const challenges = (ch ?? []).map((c) => ({ id: c.id, title: c.title, endsAt: c.ends_at, entered: (mySubs ?? []).filter((s) => s.challenge_id === c.id).length }));

    const cp = (prof?.creator_profile && typeof prof.creator_profile === "object" ? prof.creator_profile : {}) as Record<string, unknown>;
    const fields = Array.isArray(cp.fields) ? (cp.fields as unknown[]).filter((f): f is string => typeof f === "string") : [];
    const totalAgg = [...agg.values()].reduce((s, a) => ({ d: s.d + a.downloads, s: s.s + a.sales, r: s.r + a.revenue }), { d: 0, s: 0, r: 0 });

    return {
      stats: {
        views: posts.filter((p) => p.status === "published").reduce((s, p) => s + p.views, 0),
        followers: followers ?? 0,
        downloads: totalAgg.d,
        sales: totalAgg.s,
        earningsUsd: Math.round(totalAgg.r * 100) / 100,
        published: posts.filter((p) => p.status === "published").length,
        drafts: posts.filter((p) => p.status === "draft").length,
      },
      posts,
      resources,
      challenges,
      profile: {
        name: prof?.display_name ?? "Creator",
        slug: prof?.slug ?? null,
        bio: prof?.bio ?? "",
        category: fields[0] ?? "",
        fields,
        tools: Array.isArray(prof?.tools) ? (prof!.tools as string[]) : [],
        avatarUrl: img("avatars", prof?.avatar_path),
        coverUrl: img("profile-covers", prof?.cover_path),
        featuredPostId: typeof cp.featured_post_id === "string" ? cp.featured_post_id : null,
        featuredResourceId: typeof cp.featured_resource_id === "string" ? cp.featured_resource_id : null,
      },
    };
  });

/** Saves the creator-specific profile bits (category + featured picks) onto creator_profile. */
export const saveCreatorStudioProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      category: z.string().trim().max(40),
      featuredPostId: z.string().uuid().nullable(),
      featuredResourceId: z.string().uuid().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    // Featured picks must be the creator's own published posts.
    const ids = [data.featuredPostId, data.featuredResourceId].filter((x): x is string => !!x);
    if (ids.length) {
      const { data: own } = await sb.from("creator_posts").select("id").eq("author_id", me).eq("status", "published").in("id", ids);
      if ((own ?? []).length !== new Set(ids).size) throw new Error("Pick one of your own published posts.");
    }
    const { data: row } = await sb.from("profiles").select("creator_profile").eq("user_id", me).maybeSingle();
    const cp = { ...((row?.creator_profile && typeof row.creator_profile === "object" ? row.creator_profile : {}) as Record<string, unknown>) };
    const fields = Array.isArray(cp.fields) ? (cp.fields as string[]).filter((f) => f !== data.category) : [];
    cp.fields = data.category ? [data.category, ...fields].slice(0, 10) : fields;
    cp.is_creator = true;
    cp.featured_post_id = data.featuredPostId;
    cp.featured_resource_id = data.featuredResourceId;
    const { error } = await sb.from("profiles").update({ creator_profile: cp as never }).eq("user_id", me);
    if (error) throw new Error("Couldn't save your creator profile");
    return { ok: true };
  });

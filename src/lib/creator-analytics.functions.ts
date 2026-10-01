import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Creator analytics — aggregated counts over the signed-in creator's OWN
 * posts, resources and profile only. Every number is a count of real rows;
 * no viewer identities are returned.
 *
 * Sources: creator_post_views (views), creator_post_likes, creator_post_comments,
 * creator_post_events kind=share (shares, tracked from Stage 8 on),
 * collection_items saved with the creator post URL (saves), follows (followers),
 * seller_view_events (profile / product views), orders status=paid (downloads,
 * purchases on resource products).
 */
export type AnalyticsRange = 7 | 30 | 90 | 0;

export interface CreatorAnalyticsDTO {
  range: AnalyticsRange;
  since: string | null;
  content: { views: number; likes: number; comments: number; shares: number; saves: number; followersGained: number };
  resources: { count: number; views: number; downloads: number; productViews: number; purchases: number; conversionRate: number | null };
  profile: { profileViews: number; followersTotal: number; followerSeries: { date: string; gained: number; total: number }[] };
  performance: {
    topContent: { id: string; title: string; views: number; likes: number } | null;
    topResource: { id: string; title: string; downloads: number; views: number } | null;
    topCategory: { name: string; views: number } | null;
    topTool: { name: string; views: number } | null;
  };
  posts: { id: string; title: string; views: number; likes: number; comments: number; shares: number; saves: number }[];
  sharesTrackedSince: string | null;
}

const MIN_PRODUCT_VIEWS_FOR_CONVERSION = 20;
const dayKey = (iso: string) => iso.slice(0, 10);

export const getCreatorAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ range: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(0)]) }).parse(d))
  .handler(async ({ data, context }): Promise<CreatorAnalyticsDTO> => {
    const me = context.userId;
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const since = data.range ? new Date(Date.now() - data.range * 86_400_000).toISOString() : null;
    const after = <T extends { gte: (c: string, v: string) => T }>(q: T) => (since ? q.gte("created_at", since) : q);

    const { data: postRows } = await sb
      .from("creator_posts")
      .select("id, title, caption, category, fields, tools, product_id, view_count")
      .eq("author_id", me)
      .eq("status", "published")
      .limit(1000);
    const posts = postRows ?? [];
    const ids = posts.map((p) => p.id);
    const none = Promise.resolve({ data: [] as never[] });

    const [views, likes, comments, shares, saves, follows, profileViews, firstShare] = await Promise.all([
      ids.length ? after(sb.from("creator_post_views").select("post_id, created_at").in("post_id", ids)).limit(100000) : none,
      ids.length ? after(sb.from("creator_post_likes").select("post_id, created_at").in("post_id", ids).neq("user_id", me)).limit(100000) : none,
      ids.length ? after(sb.from("creator_post_comments").select("post_id, created_at").in("post_id", ids).neq("user_id", me)).limit(100000) : none,
      ids.length ? after(sb.from("creator_post_events").select("post_id, created_at").eq("author_id", me).eq("kind", "share")).limit(100000) : none,
      ids.length ? after(sb.from("collection_items").select("url, created_at").in("url", ids.map((id) => `/feed?tab=creators&post=${id}`)).neq("user_id", me)).limit(100000) : none,
      sb.from("follows").select("created_at").eq("followee_id", me).order("created_at").limit(100000),
      after(sb.from("seller_view_events").select("id", { count: "exact", head: true }).eq("seller_id", me).in("kind", ["profile_visit", "profile_visit_post"])),
      sb.from("creator_post_events").select("created_at").eq("kind", "share").order("created_at").limit(1),
    ]);

    const tally = (rows: { post_id: string }[] | null) => {
      const m = new Map<string, number>();
      (rows ?? []).forEach((r) => m.set(r.post_id, (m.get(r.post_id) ?? 0) + 1));
      return m;
    };
    const vM = tally(views.data as { post_id: string }[]);
    const lM = tally(likes.data as { post_id: string }[]);
    const cM = tally(comments.data as { post_id: string }[]);
    const shM = tally(shares.data as { post_id: string }[]);
    const svM = new Map<string, number>();
    ((saves.data ?? []) as { url: string }[]).forEach((r) => {
      const id = r.url.split("post=")[1];
      if (id) svM.set(id, (svM.get(id) ?? 0) + 1);
    });
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

    // Followers
    const followRows = (follows.data ?? []) as { created_at: string }[];
    const gained = since ? followRows.filter((f) => f.created_at >= since).length : followRows.length;
    const followerSeries: CreatorAnalyticsDTO["profile"]["followerSeries"] = [];
    if (data.range) {
      let total = followRows.length - gained;
      const perDay = new Map<string, number>();
      followRows.forEach((f) => { if (f.created_at >= since!) perDay.set(dayKey(f.created_at), (perDay.get(dayKey(f.created_at)) ?? 0) + 1); });
      for (let i = data.range - 1; i >= 0; i--) {
        const d = dayKey(new Date(Date.now() - i * 86_400_000).toISOString());
        const g = perDay.get(d) ?? 0;
        total += g;
        followerSeries.push({ date: d, gained: g, total });
      }
    }

    // Resources
    const resPosts = posts.filter((p) => p.product_id);
    const productIds = Array.from(new Set(resPosts.map((p) => p.product_id as string)));
    let downloads = 0, purchases = 0, productViews = 0;
    const dlByProduct = new Map<string, number>();
    if (productIds.length) {
      const [orders, pv] = await Promise.all([
        after(sb.from("orders").select("product_id, total_usd, created_at").in("product_id", productIds).eq("seller_id", me).eq("status", "paid")).limit(100000),
        after(sb.from("seller_view_events").select("id", { count: "exact", head: true }).eq("seller_id", me).eq("kind", "product_view").in("product_id", productIds)),
      ]);
      ((orders.data ?? []) as { product_id: string; total_usd: number }[]).forEach((o) => {
        downloads += 1;
        if (Number(o.total_usd) > 0) purchases += 1;
        dlByProduct.set(o.product_id, (dlByProduct.get(o.product_id) ?? 0) + 1);
      });
      productViews = pv.count ?? 0;
    }
    const resourceViews = resPosts.reduce((s, p) => s + (vM.get(p.id) ?? 0), 0);

    // Performance
    const perPost = posts.map((p) => ({
      id: p.id,
      title: p.title || (p.caption ?? "").slice(0, 80) || "Untitled post",
      views: vM.get(p.id) ?? 0,
      likes: lM.get(p.id) ?? 0,
      comments: cM.get(p.id) ?? 0,
      shares: shM.get(p.id) ?? 0,
      saves: svM.get(p.id) ?? 0,
    })).sort((a, b) => b.views - a.views || b.likes - a.likes);
    const topContent = perPost[0] && perPost[0].views + perPost[0].likes > 0 ? perPost[0] : null;
    const resRank = resPosts
      .map((p) => ({ id: p.id, title: p.title || "Untitled resource", downloads: dlByProduct.get(p.product_id as string) ?? 0, views: vM.get(p.id) ?? 0 }))
      .sort((a, b) => b.downloads - a.downloads || b.views - a.views);
    const topResource = resRank[0] && resRank[0].downloads + resRank[0].views > 0 ? resRank[0] : null;
    const catM = new Map<string, number>(), toolM = new Map<string, number>();
    posts.forEach((p) => {
      const v = vM.get(p.id) ?? 0;
      if (!v) return;
      const cat = p.category || (p.fields ?? [])[0];
      if (cat) catM.set(cat, (catM.get(cat) ?? 0) + v);
      (p.tools ?? []).forEach((t: string) => toolM.set(t, (toolM.get(t) ?? 0) + v));
    });
    const best = (m: Map<string, number>) => {
      const e = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      return e ? { name: e[0], views: e[1] } : null;
    };

    return {
      range: data.range,
      since,
      content: { views: sum(vM), likes: sum(lM), comments: sum(cM), shares: sum(shM), saves: sum(svM), followersGained: gained },
      resources: {
        count: productIds.length,
        views: resourceViews,
        downloads,
        productViews,
        purchases,
        conversionRate: productViews >= MIN_PRODUCT_VIEWS_FOR_CONVERSION ? Math.round((purchases / productViews) * 1000) / 10 : null,
      },
      profile: { profileViews: profileViews.count ?? 0, followersTotal: followRows.length, followerSeries },
      performance: { topContent: topContent && { id: topContent.id, title: topContent.title, views: topContent.views, likes: topContent.likes }, topResource, topCategory: best(catM), topTool: best(toolM) },
      posts: perPost.slice(0, 10),
      sharesTrackedSince: (firstShare.data?.[0] as { created_at: string } | undefined)?.created_at ?? null,
    };
  });

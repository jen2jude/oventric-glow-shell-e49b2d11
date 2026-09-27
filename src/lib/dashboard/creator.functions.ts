import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface CreatorPostStat {
  id: string;
  kind: "post" | "showcase";
  title: string;
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  score: number;
}

export interface CreatorHubData {
  followers: number;
  newFollowers7d: number;
  followerGrowth: { label: string; count: number }[];
  followerCountries: { country: string; count: number }[];
  topFans: { userId: string; name: string; avatarPath: string | null; interactions: number }[];
  totals: { posts: number; showcases: number; views: number; likes: number; comments: number; saves: number; shares: number };
  engagementRate: number;
  reach: { postViews: number; showcaseViews: number; uniqueShowcaseViewers: number; nonFollowerShare: number };
  bestHours: { hour: number; count: number }[];
  bestDays: { day: number; count: number }[];
  posts: CreatorPostStat[];
  showcase: {
    items: number; views: number; uniqueViewers: number; linkedSales: number; linkedRevenueUSD: number;
    freeDownloads: number; paidDownloads: number; plays: number; watchSeconds: number; avgWatchSeconds: number;
    linkClicks: number; fullVideoClicks: number; engagementRate: number;
    topLinks: { target: string; clicks: number }[];
    perItem: { id: string; title: string; views: number; plays: number; watchSeconds: number; freeDownloads: number; paidDownloads: number; clicks: number }[];
  };
  postSales: { sales: number; revenueUSD: number; topProducts: { name: string; sales: number; revenueUSD: number }[] };
}

const PAID = ["paid", "delivered", "completed", "released"];

export const getCreatorHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tzOffset: z.number().min(-900).max(900).default(0) }).parse(d ?? {}))
  .handler(async ({ context, data }): Promise<CreatorHubData> => buildCreatorHubData(context.userId, data.tzOffset));

export async function buildCreatorHubData(me: string, tzOffset: number): Promise<CreatorHubData> {
    // Privileged reads, strictly scoped to the signed-in creator's own content.
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");

    const [followsRes, postsRes, showRes] = await Promise.all([
      sb.from("follows").select("follower_id, created_at").eq("followee_id", me).limit(50000),
      sb.from("posts").select("id, text, created_at, views_count").eq("author_id", me).limit(5000),
      sb.from("creator_posts").select("id, title, caption, created_at, view_count, product_id, status").eq("author_id", me).limit(2000),
    ]);
    const follows = followsRes.data ?? [];
    const followerIds = new Set(follows.map((f) => f.follower_id));
    const posts = postsRes.data ?? [];
    const shows = showRes.data ?? [];
    const postIds = posts.map((p) => p.id);
    const showIds = shows.map((s) => s.id);

    const empty = { data: [] as any[] };
    const [likesRes, commentsRes, savesRes, sharesRes, showViewsRes, attachRes] = await Promise.all([
      postIds.length ? sb.from("post_likes").select("post_id, user_id, created_at").in("post_id", postIds).limit(50000) : empty,
      postIds.length ? sb.from("post_comments").select("post_id, author_id, created_at").in("post_id", postIds).limit(50000) : empty,
      postIds.length ? sb.from("post_saves").select("post_id, user_id, created_at").in("post_id", postIds).limit(50000) : empty,
      postIds.length ? sb.from("post_shares").select("post_id, user_id, created_at").in("post_id", postIds).limit(50000) : empty,
      showIds.length ? sb.from("creator_post_views").select("post_id, viewer_id, session_key").in("post_id", showIds).limit(50000) : empty,
      postIds.length ? sb.from("post_product_attachments").select("post_id, product_id, created_at").in("post_id", postIds).limit(5000) : empty,
    ]);
    const likes = likesRes.data ?? [];
    const comments = commentsRes.data ?? [];
    const saves = savesRes.data ?? [];
    const shares = sharesRes.data ?? [];
    const showViews = showViewsRes.data ?? [];
    const attaches = attachRes.data ?? [];

    // Follower growth: last 8 weeks
    const now = Date.now();
    const WEEK = 7 * 864e5;
    const followerGrowth = Array.from({ length: 8 }, (_, i) => {
      const end = now - (7 - i) * WEEK;
      const start = end - WEEK;
      const count = follows.filter((f) => { const t = +new Date(f.created_at); return t > start && t <= end; }).length;
      const d = new Date(end);
      return { label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, count };
    });
    const newFollowers7d = followerGrowth[7].count;

    // Countries + fans need profile rows
    const interactCount = new Map<string, number>();
    for (const r of likes) if (r.user_id !== me) interactCount.set(r.user_id, (interactCount.get(r.user_id) ?? 0) + 1);
    for (const r of comments) if (r.author_id && r.author_id !== me) interactCount.set(r.author_id, (interactCount.get(r.author_id) ?? 0) + 1);
    for (const r of saves) if (r.user_id !== me) interactCount.set(r.user_id, (interactCount.get(r.user_id) ?? 0) + 1);
    const fanIds = [...interactCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    const lookupIds = [...new Set([...followerIds, ...fanIds])].slice(0, 5000);
    const profRes = lookupIds.length
      ? await sb.from("profiles").select("user_id, display_name, username, avatar_path, country").in("user_id", lookupIds)
      : { data: [] as any[] };
    const profMap = new Map((profRes.data ?? []).map((p: any) => [p.user_id, p]));
    const countryCount = new Map<string, number>();
    for (const id of followerIds) {
      const c = (profMap.get(id)?.country as string | undefined)?.trim() || "Unknown";
      countryCount.set(c, (countryCount.get(c) ?? 0) + 1);
    }
    const followerCountries = [...countryCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([country, count]) => ({ country, count }));
    const topFans = fanIds.map((id) => {
      const p: any = profMap.get(id);
      return { userId: id, name: p?.display_name || p?.username || "Oventric user", avatarPath: p?.avatar_path ?? null, interactions: interactCount.get(id) ?? 0 };
    });

    // Per-post stats
    const tally = (rows: any[]) => { const m = new Map<string, number>(); for (const r of rows) m.set(r.post_id, (m.get(r.post_id) ?? 0) + 1); return m; };
    const lm = tally(likes), cm = tally(comments), sm = tally(saves), shm = tally(shares), svm = tally(showViews);
    const postStats: CreatorPostStat[] = [
      ...posts.map((p) => {
        const s = { likes: lm.get(p.id) ?? 0, comments: cm.get(p.id) ?? 0, saves: sm.get(p.id) ?? 0, shares: shm.get(p.id) ?? 0 };
        const views = Number(p.views_count || 0);
        return { id: p.id, kind: "post" as const, title: (p.text || "Media post").slice(0, 80), createdAt: p.created_at, views, ...s, score: views + (s.likes + s.comments * 2 + s.saves * 2 + s.shares * 3) * 5 };
      }),
      ...shows.map((s) => {
        const views = Math.max(Number(s.view_count || 0), svm.get(s.id) ?? 0);
        return { id: s.id, kind: "showcase" as const, title: (s.title || s.caption || "Showcase").slice(0, 80), createdAt: s.created_at, views, likes: 0, comments: 0, saves: 0, shares: 0, score: views };
      }),
    ].sort((a, b) => b.score - a.score);

    const totals = {
      posts: posts.length, showcases: shows.length,
      views: postStats.reduce((a, p) => a + p.views, 0),
      likes: likes.length, comments: comments.length, saves: saves.length, shares: shares.length,
    };
    const postViews = posts.reduce((a, p) => a + Number(p.views_count || 0), 0);
    const interactions = likes.length + comments.length + saves.length + shares.length;
    const engBase = postViews > 0 ? postViews : Math.max(followerIds.size, 1) * Math.max(posts.length, 1);
    const engagementRate = posts.length ? Math.min(100, Number(((interactions / engBase) * 100).toFixed(1))) : 0;

    // Reach
    const viewerKeys = new Set(showViews.map((v: any) => v.viewer_id ?? v.session_key));
    const knownViewers = showViews.filter((v: any) => v.viewer_id && v.viewer_id !== me);
    const nonFollower = knownViewers.filter((v: any) => !followerIds.has(v.viewer_id)).length;
    const engagers = [...interactCount.keys()];
    const engNonFollower = engagers.filter((id) => !followerIds.has(id)).length;
    const denom = knownViewers.length + engagers.length;
    const nonFollowerShare = denom ? Math.round(((nonFollower + engNonFollower) / denom) * 100) : 0;

    // Timing (viewer local time via tzOffset minutes, JS getTimezoneOffset sign)
    const hours = Array(24).fill(0), days = Array(7).fill(0);
    for (const r of [...likes, ...comments, ...saves, ...shares]) {
      const d = new Date(+new Date(r.created_at) - tzOffset * 60000);
      hours[d.getUTCHours()]++; days[d.getUTCDay()]++;
    }

    // Sales from posts & showcases
    const productIds = [...new Set([...attaches.map((a: any) => a.product_id), ...shows.map((s) => s.product_id).filter(Boolean)])] as string[];
    let orders: any[] = [];
    if (productIds.length) {
      const o = await sb.from("orders").select("product_id, total_usd, status, created_at, product_name_snapshot").eq("seller_id", me).in("product_id", productIds).in("status", PAID).limit(20000);
      orders = o.data ?? [];
    }
    const firstAttach = new Map<string, number>();
    for (const a of attaches) { const t = +new Date(a.created_at); if (!firstAttach.has(a.product_id) || t < firstAttach.get(a.product_id)!) firstAttach.set(a.product_id, t); }
    const postOrders = orders.filter((o) => firstAttach.has(o.product_id) && +new Date(o.created_at) >= firstAttach.get(o.product_id)!);
    const byProd = new Map<string, { name: string; sales: number; revenueUSD: number }>();
    for (const o of postOrders) {
      const e = byProd.get(o.product_id) ?? { name: o.product_name_snapshot || "Product", sales: 0, revenueUSD: 0 };
      e.sales++; e.revenueUSD += Number(o.total_usd || 0); byProd.set(o.product_id, e);
    }
    const showFirst = new Map<string, number>();
    for (const s of shows) if (s.product_id) { const t = +new Date(s.created_at); if (!showFirst.has(s.product_id) || t < showFirst.get(s.product_id)!) showFirst.set(s.product_id, t); }
    const showOrders = orders.filter((o) => showFirst.has(o.product_id) && +new Date(o.created_at) >= showFirst.get(o.product_id)!);

    // Creators-tab engagement: real watch time (user-initiated plays only), link clicks, downloads
    const evRes = showIds.length
      ? await sb.from("creator_post_events").select("post_id, kind, seconds, target").eq("author_id", me).limit(50000)
      : { data: [] as any[] };
    const events = (evRes.data ?? []) as { post_id: string; kind: string; seconds: number; target: string | null }[];
    const plays = events.filter((e) => e.kind === "play");
    const clicks = events.filter((e) => e.kind !== "play");
    const watchSeconds = Math.round(plays.reduce((a, e) => a + Number(e.seconds || 0), 0));
    const prodToShow = new Map<string, string>();
    for (const sh of shows) if (sh.product_id) prodToShow.set(sh.product_id, sh.id);
    const freeDl = showOrders.filter((o) => Number(o.total_usd || 0) === 0);
    const paidDl = showOrders.filter((o) => Number(o.total_usd || 0) > 0);
    const linkMap = new Map<string, number>();
    for (const c of clicks) if (c.target) linkMap.set(c.target, (linkMap.get(c.target) ?? 0) + 1);
    const showViewTotal = shows.reduce((a, s) => a + Math.max(Number(s.view_count || 0), svm.get(s.id) ?? 0), 0);
    const perItem = shows.map((sh) => {
      const mine = events.filter((e) => e.post_id === sh.id);
      const ords = showOrders.filter((o) => prodToShow.get(o.product_id) === sh.id);
      return {
        id: sh.id,
        title: sh.title,
        views: Math.max(Number(sh.view_count || 0), svm.get(sh.id) ?? 0),
        plays: mine.filter((e) => e.kind === "play").length,
        watchSeconds: Math.round(mine.filter((e) => e.kind === "play").reduce((a, e) => a + Number(e.seconds || 0), 0)),
        freeDownloads: ords.filter((o) => Number(o.total_usd || 0) === 0).length,
        paidDownloads: ords.filter((o) => Number(o.total_usd || 0) > 0).length,
        clicks: mine.filter((e) => e.kind !== "play").length,
      };
    }).sort((a, b) => (b.plays + b.clicks + b.freeDownloads + b.paidDownloads) - (a.plays + a.clicks + a.freeDownloads + a.paidDownloads)).slice(0, 10);
    const showActions = plays.length + clicks.length + showOrders.length;

    return {
      followers: followerIds.size,
      newFollowers7d,
      followerGrowth,
      followerCountries,
      topFans,
      totals,
      engagementRate,
      reach: { postViews, showcaseViews: shows.reduce((a, s) => a + Math.max(Number(s.view_count || 0), svm.get(s.id) ?? 0), 0), uniqueShowcaseViewers: viewerKeys.size, nonFollowerShare },
      bestHours: hours.map((count, hour) => ({ hour, count })),
      bestDays: days.map((count, day) => ({ day, count })),
      posts: postStats.slice(0, 10),
      showcase: {
        items: shows.length,
        views: shows.reduce((a, s) => a + Math.max(Number(s.view_count || 0), svm.get(s.id) ?? 0), 0),
        uniqueViewers: viewerKeys.size,
        linkedSales: showOrders.length,
        linkedRevenueUSD: Number(showOrders.reduce((a, o) => a + Number(o.total_usd || 0), 0).toFixed(2)),
        freeDownloads: freeDl.length,
        paidDownloads: paidDl.length,
        plays: plays.length,
        watchSeconds,
        avgWatchSeconds: plays.length ? Math.round(watchSeconds / plays.length) : 0,
        linkClicks: clicks.filter((c) => c.kind === "link_click").length,
        fullVideoClicks: clicks.filter((c) => c.kind === "full_video_click").length,
        engagementRate: showViewTotal ? Math.min(100, Number(((showActions / showViewTotal) * 100).toFixed(1))) : 0,
        topLinks: [...linkMap.entries()].map(([target, c]) => ({ target, clicks: c })).sort((a, b) => b.clicks - a.clicks).slice(0, 5),
        perItem,
      },
      postSales: {
        sales: postOrders.length,
        revenueUSD: Number(postOrders.reduce((a, o) => a + Number(o.total_usd || 0), 0).toFixed(2)),
        topProducts: [...byProd.values()].sort((a, b) => b.revenueUSD - a.revenueUSD).slice(0, 5),
      },
    };
}

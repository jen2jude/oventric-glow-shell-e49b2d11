import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type ReactionType = "love" | "like" | "dislike" | "laugh" | "crown";
export const REACTION_TYPES: ReactionType[] = ["love", "like", "dislike", "laugh", "crown"];

export interface MentionRef {
  user_id: string;
  name: string;
  slug: string | null;
}

export interface MediaTag {
  productId: string;
  productName: string;
  mediaIndex: number;
  x?: number;
  y?: number;
}

export interface PostMediaItem {
  url: string;
  type: "image" | "video";
  poster_url?: string | null;
  tags?: MediaTag[];
}

export interface PostCircleRef {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  viewerIsMember: boolean;
}

export interface ProductAttachment {
  id: string;
  name: string;
  priceUsd: number;
  /** Publish-time currency + amount so the feed price matches the marketplace exactly. */
  originalCurrency?: string | null;
  originalAmount?: number | null;
  fxSnapshot?: {
    base?: string;
    rates?: Record<string, number>;
    source?: string;
    fetched_at?: string;
  } | null;
  coverUrl: string | null;
  vendor: string;
  vendorId: string;
  vendorSlug: string | null;
  vendorAvatarUrl: string | null;
  shortDescription?: string | null;
}


export interface FeedPost {
  id: string;
  author_id: string;
  author_name: string;
  author_slug: string | null;
  author_avatar_url: string | null;
  initials: string;
  text: string;
  created_at: string;
  likes_count: number;
  viewer_liked: boolean;
  viewer_reaction: ReactionType | null;
  reactions: Record<ReactionType, number>;
  comments_count: number;
  views_count: number;
  /** Number of times this post has been reposted. */
  reposts_count: number;
  /** Number of times this post has been shared (logged). */
  shares_count: number;
  /** Whether the viewer bookmarked/saved this post. */
  viewer_saved: boolean;
  /** Whether the viewer already reposted this post. */
  viewer_reposted: boolean;

  /** Original post when this row is a repost (quote repost). */
  repost_of: FeedPost | null;
  // Legacy fields (kept so existing render paths keep working for single-media rows).
  media_url: string | null;
  media_type: "image" | "video" | null;
  poster_url: string | null;
  // Ordered list of all media items for this post (up to 10 images, or 1 video).
  media: PostMediaItem[];
  mentions: MentionRef[];
  circle: PostCircleRef | null;
  product_attachments?: ProductAttachment[];
}



function initialsFrom(name: string | null | undefined, fallback: string): string {
  const src = (name ?? "").trim();
  if (!src) return fallback.slice(0, 2).toUpperCase();
  const parts = src.split(/\s+/).filter(Boolean);
  const chars = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return chars.toUpperCase();
}

async function getViewerClient(): Promise<{ sb: SupabaseClient<Database>; userId: string | null }> {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const req = getRequest();
  const authHeader = req?.headers?.get?.("authorization") ?? null;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (token && token.split(".").length === 3) {
    const sb = createClient<Database>(SUPABASE_URL, KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    try {
      const { data } = await sb.auth.getClaims(token);
      const userId = (data?.claims?.sub as string | undefined) ?? null;
      return { sb, userId };
    } catch {
      /* fall through */
    }
  }
  const sb = createClient<Database>(SUPABASE_URL, KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return { sb, userId: null };
}

function zeroReactions(): Record<ReactionType, number> {
  return { love: 0, like: 0, dislike: 0, laugh: 0, crown: 0 };
}

const POST_SELECT =
  "id, author_id, text, created_at, media_path, media_type, media_paths, mentioned_user_ids, circle_id, audience, shared_to_feed, wall_user_id, views_count, repost_of";

async function buildFeedPosts(
  sb: SupabaseClient<Database>,
  userId: string | null,
  rows: any[],
  depth = 0,
): Promise<FeedPost[]> {
  if (rows.length === 0) return [];


  const authorIds = new Set<string>(rows.map((r) => r.author_id));
  const mentionedByPost = new Map<string, string[]>();
  rows.forEach((r) => {
    const ids = Array.isArray(r.mentioned_user_ids) ? (r.mentioned_user_ids as string[]) : [];
    mentionedByPost.set(r.id, ids);
    ids.forEach((id) => authorIds.add(id));
  });
  const allProfileIds = Array.from(authorIds);
  const postIds = rows.map((r) => r.id);

  const [{ data: profiles }, likesRes, { data: commentRows }, { data: tagRows }, { data: attachmentRows }] = await Promise.all([
    sb.from("profiles").select("user_id, display_name, username, slug, avatar_path").in("user_id", allProfileIds),
    sb.from("post_likes").select("post_id, user_id, reaction" as any).in("post_id", postIds),
    sb.from("post_comments").select("post_id").in("post_id", postIds),
    sb.from("post_media_tags").select("id, post_id, product_id, media_index, x_percent, y_percent, products(name)").in("post_id", postIds),
    sb.from("post_product_attachments").select("post_id, product_id").in("post_id", postIds),
  ]);


  const avatarPaths = Array.from(
    new Set(((profiles ?? []).map((p) => p.avatar_path).filter((p): p is string => !!p))),
  );
  const avatarByPath = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: signed } = await sb.storage.from("avatars").createSignedUrls(avatarPaths, 60 * 60 * 6);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) avatarByPath.set(s.path, s.signedUrl); });
  }

  const allMediaPaths = new Set<string>();
  const posterCandidates = new Set<string>();
  rows.forEach((r) => {
    if (r.media_path) {
      allMediaPaths.add(r.media_path as string);
      if (r.media_type === "video") posterCandidates.add(`${r.media_path}.poster.jpg`);
    }
    const arr = Array.isArray(r.media_paths) ? (r.media_paths as string[]) : [];
    arr.forEach((p) => {
      if (!p) return;
      allMediaPaths.add(p);
      if (r.media_type === "video") posterCandidates.add(`${p}.poster.jpg`);
    });
  });
  const signedByPath = new Map<string, string>();
  const posterByVideoPath = new Map<string, string>();
  if (allMediaPaths.size > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("post-media")
      .createSignedUrls(Array.from(allMediaPaths), 60 * 60 * 6);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl); });
    if (posterCandidates.size > 0) {
      const { data: posters } = await supabaseAdmin.storage
        .from("post-media")
        .createSignedUrls(Array.from(posterCandidates), 60 * 60 * 6);
      (posters ?? []).forEach((s) => {
        if (s.path && s.signedUrl && !(s as any).error) {
          const videoPath = s.path.replace(/\.poster\.jpg$/, "");
          posterByVideoPath.set(videoPath, s.signedUrl);
        }
      });
    }
  }

  const circleIds = Array.from(new Set(rows.map((r) => r.circle_id).filter((x): x is string => !!x)));
  const circleById = new Map<string, { id: string; name: string; slug: string; avatar_url: string | null }>();
  let viewerCircleIds = new Set<string>();
  if (circleIds.length > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: circles } = await supabaseAdmin
      .from("circles")
      .select("id, name, slug, avatar_url")
      .in("id", circleIds);
    (circles ?? []).forEach((c: any) => {
      circleById.set(c.id, { id: c.id, name: c.name, slug: c.slug, avatar_url: c.avatar_url ?? null });
    });
    if (userId) {
      const { data: mem } = await supabaseAdmin
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", userId)
        .in("circle_id", circleIds);
      viewerCircleIds = new Set((mem ?? []).map((m: any) => m.circle_id as string));
    }
  }
  const circleAvatarPaths = Array.from(
    new Set(
      Array.from(circleById.values())
        .map((c) => c.avatar_url)
        .filter((v): v is string => !!v && !/^https?:\/\//i.test(v) && !v.startsWith("data:")),
    ),
  );
  const circleAvatarByPath = new Map<string, string>();
  if (circleAvatarPaths.length > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("circle-avatars")
      .createSignedUrls(circleAvatarPaths, 60 * 60 * 6);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) circleAvatarByPath.set(s.path, s.signedUrl); });
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const reactionsByPost = new Map<string, Record<ReactionType, number>>();
  const viewerReactionByPost = new Map<string, ReactionType>();
  ((likesRes.data ?? []) as any[]).forEach((row) => {
    const kind = (REACTION_TYPES as string[]).includes(row.reaction) ? (row.reaction as ReactionType) : "love";
    const bucket = reactionsByPost.get(row.post_id) ?? zeroReactions();
    bucket[kind] += 1;
    reactionsByPost.set(row.post_id, bucket);
    if (userId && row.user_id === userId) viewerReactionByPost.set(row.post_id, kind);
  });
  const tagsByPost = new Map<string, MediaTag[]>();
  (tagRows ?? []).forEach((t: any) => {
    const list = tagsByPost.get(t.post_id) ?? [];
    list.push({
      productId: t.product_id,
      productName: t.products?.name ?? "Product",
      mediaIndex: t.media_index,
      x: t.x_percent ? Number(t.x_percent) : undefined,
      y: t.y_percent ? Number(t.y_percent) : undefined,
    });
    tagsByPost.set(t.post_id, list);
  });
  const attachmentsByPost = new Map<string, ProductAttachment[]>();
  {
    const productIds = Array.from(
      new Set(((attachmentRows ?? []) as any[]).map((a) => a.product_id).filter(Boolean)),
    );
    if (productIds.length) {
      const { data: prodRows } = await sb
        .from("products")
        .select(
          "id, seller_id, name, price_usd, original_currency, original_amount, fx_snapshot, cover_path, description",
        )
        .in("id", productIds);
      const products = (prodRows ?? []) as any[];

      // Vendor profiles
      const sellerIds = Array.from(new Set(products.map((p) => p.seller_id).filter(Boolean)));
      const vendorById = new Map<string, any>();
      if (sellerIds.length) {
        const { data: vRows } = await sb
          .from("profiles")
          .select("user_id, display_name, username, slug, avatar_path")
          .in("user_id", sellerIds);
        (vRows ?? []).forEach((v: any) => vendorById.set(v.user_id, v));
        const vPaths = Array.from(
          new Set((vRows ?? []).map((v: any) => v.avatar_path).filter(Boolean)),
        ) as string[];
        if (vPaths.length) {
          const { data: signedV } = await sb.storage
            .from("avatars")
            .createSignedUrls(vPaths, 60 * 60 * 6);
          (signedV ?? []).forEach((s) => {
            if (s.path && s.signedUrl) avatarByPath.set(s.path, s.signedUrl);
          });
        }
      }

      // Cover URLs (private bucket → signed)
      const coverPaths = Array.from(
        new Set(products.map((p) => p.cover_path).filter(Boolean)),
      ) as string[];
      const coverByPath = new Map<string, string>();
      if (coverPaths.length) {
        const { data: signedC } = await sb.storage
          .from("product-covers")
          .createSignedUrls(coverPaths, 60 * 60 * 24 * 7);
        (signedC ?? []).forEach((s) => {
          if (s.path && s.signedUrl) coverByPath.set(s.path, s.signedUrl);
        });
      }

      const attachmentByProductId = new Map<string, ProductAttachment>();
      products.forEach((p) => {
        const vendor = vendorById.get(p.seller_id);
        const avatarPath = vendor?.avatar_path as string | undefined;
        attachmentByProductId.set(p.id, {
          id: p.id,
          name: p.name,
          priceUsd: Number(p.price_usd ?? 0),
          coverUrl: p.cover_path
            ? String(p.cover_path).startsWith("http")
              ? p.cover_path
              : (coverByPath.get(p.cover_path) ?? null)
            : null,
          vendor: vendor?.display_name || vendor?.username || "Seller",
          vendorId: p.seller_id,
          vendorSlug: vendor?.slug || null,
          vendorAvatarUrl: avatarPath
            ? avatarPath.startsWith("http")
              ? avatarPath
              : (avatarByPath.get(avatarPath) ?? null)
            : null,
          shortDescription: p.description ?? null,
        });
      });

      ((attachmentRows ?? []) as any[]).forEach((at) => {
        const item = attachmentByProductId.get(at.product_id);
        if (!item) return;
        const list = attachmentsByPost.get(at.post_id) ?? [];
        list.push(item);
        attachmentsByPost.set(at.post_id, list);
      });
    }
  }
  const commentCounts = new Map<string, number>();
  (commentRows ?? []).forEach((c) => commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1));


  // Repost counts for these posts + whether the viewer already reposted them.
  const repostCounts = new Map<string, number>();
  const viewerReposted = new Set<string>();
  {
    const { data: rp } = await sb
      .from("posts")
      .select("author_id, repost_of" as any)
      .in("repost_of" as any, postIds);
    ((rp ?? []) as any[]).forEach((row) => {
      repostCounts.set(row.repost_of, (repostCounts.get(row.repost_of) ?? 0) + 1);
      if (userId && row.author_id === userId) viewerReposted.add(row.repost_of);
    });
  }

  // Share counts + viewer saves (bookmarks).
  const shareCounts = new Map<string, number>();
  {
    const { data: sh } = await sb
      .from("post_shares")
      .select("post_id" as any)
      .in("post_id", postIds);
    ((sh ?? []) as any[]).forEach((row) => {
      shareCounts.set(row.post_id, (shareCounts.get(row.post_id) ?? 0) + 1);
    });
  }
  const viewerSaved = new Set<string>();
  if (userId) {
    const { data: sv } = await sb
      .from("post_saves")
      .select("post_id" as any)
      .eq("user_id", userId)
      .in("post_id", postIds);
    ((sv ?? []) as any[]).forEach((row) => viewerSaved.add(row.post_id));
  }


  // Quoted originals (one level deep only).
  const quotedById = new Map<string, FeedPost>();
  if (depth === 0) {
    const quotedIds = Array.from(
      new Set(rows.map((r) => r.repost_of).filter((x: unknown): x is string => !!x)),
    );
    if (quotedIds.length > 0) {
      const { data: originals } = await sb
        .from("posts")
        .select(POST_SELECT as any)
        .in("id", quotedIds);
      const built = await buildFeedPosts(sb, userId, (originals ?? []) as any[], 1);
      built.forEach((p) => quotedById.set(p.id, p));
    }
  }

  return rows.map((r) => {

    const prof = profileById.get(r.author_id);
    const name = prof?.display_name || prof?.username || "Member";
    const reactions = reactionsByPost.get(r.id) ?? zeroReactions();
    const total = reactions.love + reactions.like + reactions.dislike + reactions.laugh + reactions.crown;
    const viewer_reaction = viewerReactionByPost.get(r.id) ?? null;
    const legacyType = (r.media_type as "image" | "video" | null) ?? null;
    const arrPaths = Array.isArray(r.media_paths) ? (r.media_paths as string[]) : [];
    const media: PostMediaItem[] = [];
    if (arrPaths.length > 0) {
      const kind: "image" | "video" = legacyType === "video" && arrPaths.length === 1 ? "video" : "image";
      arrPaths.forEach((p) => {
        const url = signedByPath.get(p);
        if (url) {
          const poster = kind === "video" ? (posterByVideoPath.get(p) ?? null) : null;
          const tags = (tagsByPost.get(r.id) ?? []).filter(t => t.mediaIndex === media.length);
          media.push({ url, type: kind, poster_url: poster, tags });
        }
      });
    } else if (r.media_path) {
      const url = signedByPath.get(r.media_path);
      if (url) {
        const kind = legacyType ?? "image";
        const poster = kind === "video" ? (posterByVideoPath.get(r.media_path) ?? null) : null;
        media.push({ url, type: kind, poster_url: poster });
      }
    }
    const primary = media[0] ?? null;
    let circle: PostCircleRef | null = null;
    if (r.circle_id) {
      const c = circleById.get(r.circle_id);
      if (c) {
        const raw = c.avatar_url;
        const url = raw
          ? (/^https?:\/\//i.test(raw) || raw.startsWith("data:") ? raw : (circleAvatarByPath.get(raw) ?? null))
          : null;
        circle = { id: c.id, name: c.name, slug: c.slug, avatarUrl: url, viewerIsMember: viewerCircleIds.has(c.id) };
      }
    }
    const productAttachments = attachmentsByPost.get(r.id) ?? [];
    return {
      product_attachments: productAttachments,

      reposts_count: repostCounts.get(r.id) ?? 0,
      shares_count: shareCounts.get(r.id) ?? 0,
      viewer_saved: viewerSaved.has(r.id),
      viewer_reposted: viewerReposted.has(r.id),

      repost_of: r.repost_of ? (quotedById.get(r.repost_of) ?? null) : null,
      id: r.id,
      author_id: r.author_id,
      author_name: name,
      author_slug: prof?.slug ?? null,
      author_avatar_url: prof?.avatar_path ? (avatarByPath.get(prof.avatar_path) ?? null) : null,
      initials: initialsFrom(name, "OV"),
      text: r.text,
      created_at: r.created_at,
      likes_count: total,
      viewer_liked: viewer_reaction !== null,
      viewer_reaction,
      reactions,
      comments_count: commentCounts.get(r.id) ?? 0,
      views_count: Number((r as any).views_count ?? 0),
      media_url: primary?.url ?? null,
      media_type: primary?.type ?? null,
      poster_url: primary?.type === "video" ? (primary?.poster_url ?? null) : null,
      media,
      mentions: (mentionedByPost.get(r.id) ?? [])
        .map((uid): MentionRef | null => {
          const p = profileById.get(uid);
          if (!p) return null;
          return {
            user_id: uid,
            name: (p.display_name || p.username || "Member") as string,
            slug: (p.slug as string) ?? null,
          };
        })
        .filter((m): m is MentionRef => m !== null),
      circle,
    };
  });
}

export const listPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { sb, userId } = await getViewerClient();
  const { data: posts, error } = await sb
    .from("posts")
    .select(POST_SELECT as any)
    .is("wall_user_id" as any, null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[listPosts] failed", error);
    throw new Error("Failed to load posts");
  }
  const out = await buildFeedPosts(sb, userId, (posts ?? []) as any[]);
  return { posts: out };
});

/** Fetch a single post (with quoted original) for the dedicated post screen. */
export const getPost = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { sb, userId } = await getViewerClient();
    const { data: row, error } = await sb
      .from("posts")
      .select(POST_SELECT as any)
      .eq("id", data.id)
      .maybeSingle();
    if (error) {
      console.error("[getPost] failed", error);
      throw new Error("Failed to load post");
    }
    if (!row) return { post: null as FeedPost | null };
    const out = await buildFeedPosts(sb, userId, [row as any]);
    return { post: (out[0] ?? null) as FeedPost | null };
  });



export const listWallPosts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ wallUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { sb, userId } = await getViewerClient();
    // Include: (a) posts written directly on the wall, AND
    //         (b) the wall owner's own public newsfeed posts (no circle, no other wall).
    const { data: rows, error } = await sb
      .from("posts")
      .select(POST_SELECT as any)
      .or(
        `wall_user_id.eq.${data.wallUserId},and(wall_user_id.is.null,author_id.eq.${data.wallUserId},audience.eq.public,circle_id.is.null)`,
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("[listWallPosts] failed", error);
      throw new Error("Failed to load wall posts");
    }
    const out = await buildFeedPosts(sb, userId, (rows ?? []) as any[]);
    return { posts: out };
  });

export const canPostOnWall = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ wallUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Walls are open — any signed-in, non-anonymous user can post on any wall.
    if (data.wallUserId === context.userId) return { allowed: true, reason: "self" as const };
    return { allowed: true, reason: "open" as const };
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      text: z.string().trim().max(4000).optional().default(""),
      mediaPath: z.string().trim().min(1).max(500).optional(),
      mediaType: z.enum(["image", "video"]).optional(),
      mediaPaths: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
      audience: z.enum(["public", "circle", "followers"]).optional(),
      circleId: z.string().uuid().nullable().optional(),
      mentionedUserIds: z.array(z.string().uuid()).max(20).optional(),
      productTags: z.array(z.object({
        productId: z.string().uuid(),
        mediaIndex: z.number().int().min(0).max(10),
        x: z.number().min(0).max(100).optional(),
        y: z.number().min(0).max(100).optional(),
      })).max(20).optional(),
      productAttachmentIds: z.array(z.string().uuid()).max(10).optional(),
      wallUserId: z.string().uuid().nullable().optional(),
    }).refine(data => {
      const hasMedia = (data.mediaPaths && data.mediaPaths.length > 0) || !!data.mediaPath;
      const hasProducts = (data.productAttachmentIds && data.productAttachmentIds.length > 0);
      const hasText = data.text && data.text.trim().length > 0;
      return hasMedia || hasProducts || hasText;
    }, {
      message: "Post must have text, media, or a product attached",
      path: ["text"]
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const wallUserId = data.wallUserId ?? null;
    // Wall posts are always public + not circle-scoped; RLS enforces follower check.
    const audience = wallUserId ? "public" : (data.audience ?? "public");
    const circleId = wallUserId ? null : (audience === "circle" ? (data.circleId ?? null) : null);
    if (!wallUserId && audience === "circle" && !circleId) {
      throw new Error("Choose a circle to share to");
    }
    if (circleId) {
      const { data: mem } = await context.supabase
        .from("circle_members")
        .select("circle_id")
        .eq("circle_id", circleId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!mem) throw new Error("You are not a member of that circle");
    }
    const mentioned = Array.from(new Set(data.mentionedUserIds ?? [])).filter(
      (id) => id !== context.userId,
    );

    const paths = Array.isArray(data.mediaPaths) ? data.mediaPaths.slice(0, 10) : [];
    const isVideo = data.mediaType === "video" && !!data.mediaPath;
    const legacyPath = isVideo ? data.mediaPath! : (paths.length === 0 ? (data.mediaPath ?? null) : null);
    const legacyType = isVideo ? "video" : (paths.length === 0 ? (data.mediaPath ? (data.mediaType ?? null) : null) : "image");

    const { data: row, error } = await (context.supabase as any)
      .from("posts")
      .insert({
        author_id: context.userId,
        text: data.text || "",
        media_path: legacyPath,
        media_type: legacyType,
        media_paths: paths,
        audience,
        circle_id: circleId,
        mentioned_user_ids: mentioned,
        wall_user_id: wallUserId,
      })
      .select("id, author_id, text, created_at")
      .single();
    if (error || !row) {
      console.error("[createPost] failed", error);
      throw new Error("Failed to create post");
    }

    if (data.productAttachmentIds?.length) {
      const attachments = data.productAttachmentIds.map(pid => ({
        post_id: row.id,
        product_id: pid
      }));
      await context.supabase.from("post_product_attachments").insert(attachments);
    }


    if (data.productTags && data.productTags.length > 0) {
      const tagRows = data.productTags.map(t => ({
        post_id: row.id,
        product_id: t.productId,
        media_index: t.mediaIndex,
        x_percent: t.x,
        y_percent: t.y,
      }));
      const { error: tagErr } = await context.supabase.from("post_media_tags").insert(tagRows);
      if (tagErr) console.error("[createPost] tag insert failed", tagErr);
    }

    if (mentioned.length > 0) {
      const { data: me } = await context.supabase
        .from("profiles")
        .select("display_name, username, slug")
        .eq("user_id", context.userId)
        .maybeSingle();
      const authorName = me?.display_name || me?.username || "Someone";
      const rows = mentioned.map((uid) => ({
        user_id: uid,
        from_user_id: context.userId,
        kind: "mention",
        title: `${authorName} mentioned you`,
        body: data.text.slice(0, 140),
        link: `/#post-${row.id}`,
      }));
      const { error: notifErr } = await context.supabase.from("notifications").insert(rows);
      if (notifErr) console.error("[createPost] mention notif insert failed", notifErr);
    }

    return { post: row };
  });

/**
 * Repost (quote repost): creates a new post on the reposter's wall/feed that
 * points at the original via `repost_of`. Optional `comment` is the quote text.
 */
export const repostPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        comment: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: original } = await (context.supabase as any)
      .from("posts")
      .select("id, author_id, repost_of")
      .eq("id", data.postId)
      .maybeSingle();
    if (!original) throw new Error("Post unavailable");
    // Reposting a repost points at the underlying original.
    const targetId: string = original.repost_of ?? original.id;

    const { data: row, error } = await (context.supabase as any)
      .from("posts")
      .insert({
        author_id: context.userId,
        text: (data.comment ?? "").trim(),
        audience: "public",
        media_paths: [],
        repost_of: targetId,
      })
      .select("id, author_id, text, created_at")
      .single();
    if (error || !row) {
      console.error("[repostPost] failed", error);
      throw new Error("Failed to repost");
    }

    if (original.author_id !== context.userId) {
      const { data: me } = await context.supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", context.userId)
        .maybeSingle();
      const who = me?.display_name || me?.username || "Someone";
      await context.supabase.from("notifications").insert({
        user_id: original.author_id,
        from_user_id: context.userId,
        kind: "repost",
        title: `${who} reposted your post`,
        body: (data.comment ?? "").slice(0, 140),
        link: `/#post-${row.id}`,
      });
    }

    return { post: row };
  });

/** Remove the viewer's repost of a post (undo repost). */
export const undoRepost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("posts")
      .delete()
      .eq("author_id", context.userId)
      .eq("repost_of", data.postId);
    if (error) throw new Error("Failed to undo repost");
    return { ok: true };
  });



export const searchMentionCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const like = `%${data.q.replace(/[\\%_,]/g, (m) => `\\${m}`)}%`;
    const { data: rows } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username, slug, avatar_path")
      .or(`display_name.ilike.${like},username.ilike.${like},slug.ilike.${like}`)
      .limit(8);
    const list = (rows ?? []).filter((p) => p.user_id !== context.userId);
    const paths = list.map((p) => p.avatar_path).filter((p): p is string => !!p);
    const map = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await context.supabase.storage
        .from("avatars")
        .createSignedUrls(paths, 60 * 60);
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
      });
    }
    return {
      users: list.map((p) => ({
        userId: p.user_id as string,
        name: (p.display_name || p.username || p.slug || "Member") as string,
        username: (p.username as string) ?? null,
        slug: (p.slug as string) ?? null,
        avatarUrl: p.avatar_path ? (map.get(p.avatar_path) ?? null) : null,
      })),
    };
  });

export const listMyPostableCircles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: mem } = await context.supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", context.userId);
    const ids = (mem ?? []).map((r: any) => r.circle_id as string);
    if (ids.length === 0) return { circles: [] as { id: string; name: string }[] };
    const { data: rows } = await context.supabase
      .from("circles")
      .select("id, name")
      .in("id", ids)
      .order("name", { ascending: true });
    return { circles: (rows ?? []).map((r: any) => ({ id: r.id, name: r.name })) };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("posts")
      .delete()
      .eq("id", data.id)
      .eq("author_id", context.userId);
    if (error) {
      console.error("[deletePost] failed", error);
      throw new Error("Failed to delete post");
    }
    return { id: data.id };
  });

// Set (or clear) the viewer's reaction on a post. Passing null removes it.
export const setReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      postId: z.string().uuid(),
      reaction: z.enum(["love", "like", "dislike", "laugh", "crown"]).nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.reaction === null) {
      const { error } = await context.supabase
        .from("post_likes")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", context.userId);
      if (error) {
        console.error("[setReaction] delete failed", error);
        throw new Error("Failed to remove reaction");
      }
    } else {
      const { error } = await context.supabase
        .from("post_likes")
        .upsert(
          { post_id: data.postId, user_id: context.userId, reaction: data.reaction } as any,
          { onConflict: "post_id,user_id" },
        );
      if (error) {
        console.error("[setReaction] upsert failed", error);
        throw new Error("Failed to react");
      }
    }
    return { postId: data.postId, reaction: data.reaction };
  });

// Legacy alias kept so any older callers still compile. Prefer setReaction.
export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid(), like: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.like) {
      const { error } = await context.supabase
        .from("post_likes")
        .upsert(
          { post_id: data.postId, user_id: context.userId, reaction: "love" } as any,
          { onConflict: "post_id,user_id" },
        );
      if (error && (error as any).code !== "23505") {
        console.error("[toggleLike] upsert failed", error);
        throw new Error("Failed to like");
      }
    } else {
      const { error } = await context.supabase
        .from("post_likes")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", context.userId);
      if (error) {
        console.error("[toggleLike] delete failed", error);
        throw new Error("Failed to unlike");
      }
    }
    return { postId: data.postId, liked: data.like };
  });

export interface UserPhoto {
  url: string;
  source: "avatar" | "cover" | "post";
  postId: string | null;
  createdAt: string; // ISO
}

/**
 * List every image the user has shared (avatar, cover, and post images).
 * Signed in only — signs URLs against the viewer's session.
 * `slugOrId` may be a profile slug OR a user_id (UUID). When omitted,
 * returns photos for the current viewer ("My Memories").
 */
export const listUserPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      slugOrId: z.string().trim().min(1).max(120).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId: viewerId } = context;
    // Resolve target user.
    let targetId: string | null = null;
    let profileRow: { avatar_path: string | null; cover_path: string | null; updated_at: string | null; created_at: string | null } | null = null;
    if (!data.slugOrId) {
      targetId = viewerId;
    } else if (/^[0-9a-f-]{36}$/i.test(data.slugOrId)) {
      targetId = data.slugOrId;
    }
    if (targetId) {
      const { data: p } = await sb
        .from("profiles")
        .select("user_id, avatar_path, cover_path, updated_at, created_at" as any)
        .eq("user_id", targetId)
        .maybeSingle();
      profileRow = (p as any) ?? null;
    } else {
      const { data: p } = await sb
        .from("profiles")
        .select("user_id, avatar_path, cover_path, updated_at, created_at" as any)
        .eq("slug", data.slugOrId!)
        .maybeSingle();
      if (p) {
        targetId = (p as any).user_id;
        profileRow = p as any;
      }
    }
    if (!targetId) return { photos: [] as UserPhoto[] };

    const { data: postRows } = await sb
      .from("posts")
      .select("id, created_at, media_path, media_type, media_paths" as any)
      .eq("author_id", targetId)
      .order("created_at", { ascending: false })
      .limit(200);

    // Gather every path to sign.
    const items: Array<{ path: string; source: UserPhoto["source"]; postId: string | null; createdAt: string; bucket: "avatars" | "profile-covers" | "post-media" }> = [];
    if (profileRow?.avatar_path) {
      items.push({
        path: profileRow.avatar_path,
        source: "avatar",
        postId: null,
        createdAt: profileRow.updated_at ?? profileRow.created_at ?? new Date().toISOString(),
        bucket: "avatars",
      });
    }
    if (profileRow?.cover_path) {
      items.push({
        path: profileRow.cover_path,
        source: "cover",
        postId: null,
        createdAt: profileRow.updated_at ?? profileRow.created_at ?? new Date().toISOString(),
        bucket: "profile-covers",
      });
    }
    (postRows ?? []).forEach((r: any) => {
      const arr: string[] = Array.isArray(r.media_paths) ? r.media_paths : [];
      if (arr.length > 0) {
        const isImage = r.media_type !== "video" || arr.length > 1;
        if (isImage) {
          arr.forEach((p) => items.push({ path: p, source: "post", postId: r.id, createdAt: r.created_at, bucket: "post-media" }));
        }
      } else if (r.media_path && r.media_type !== "video") {
        items.push({ path: r.media_path, source: "post", postId: r.id, createdAt: r.created_at, bucket: "post-media" });
      }
    });

    // Sign per-bucket in parallel.
    const buckets: Array<UserPhoto["source"] extends string ? "avatars" | "profile-covers" | "post-media" : never> = ["avatars", "profile-covers", "post-media"];
    const byBucket = new Map<string, string[]>();
    items.forEach((it) => {
      const arr = byBucket.get(it.bucket) ?? [];
      arr.push(it.path);
      byBucket.set(it.bucket, arr);
    });
    const signedByPath = new Map<string, string>();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await Promise.all(
      buckets.map(async (b) => {
        const paths = Array.from(new Set(byBucket.get(b) ?? []));
        if (paths.length === 0) return;
        const { data: signed } = await supabaseAdmin.storage.from(b).createSignedUrls(paths, 60 * 60 * 6);
        (signed ?? []).forEach((s) => {
          if (s.path && s.signedUrl) signedByPath.set(`${b}:${s.path}`, s.signedUrl);

        });
      }),
    );

    const photos: UserPhoto[] = items
      .map((it) => {
        const url = signedByPath.get(`${it.bucket}:${it.path}`);
        if (!url) return null;
        return { url, source: it.source, postId: it.postId, createdAt: it.createdAt };
      })
      .filter((v): v is UserPhoto => v !== null);

    return { photos };
  });


/** Log a share of a post (link copy, native share, or a specific channel). */
export const logPostShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        postId: z.string().uuid(),
        channel: z.string().trim().min(1).max(40).default("link"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("post_shares")
      .insert({ post_id: data.postId, user_id: context.userId, channel: data.channel } as any);
    if (error) {
      console.error("[logPostShare] insert failed", error);
      throw new Error("Failed to log share");
    }
    const { count } = await context.supabase
      .from("post_shares")
      .select("post_id", { count: "exact", head: true })
      .eq("post_id", data.postId);
    return { postId: data.postId, shares_count: count ?? 0 };
  });

/** Save (bookmark) or unsave a post for the current viewer. */
export const setPostSaved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid(), saved: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.saved) {
      const { error } = await context.supabase
        .from("post_saves")
        .upsert({ post_id: data.postId, user_id: context.userId } as any, {
          onConflict: "post_id,user_id",
        });
      if (error && (error as any).code !== "23505") {
        console.error("[setPostSaved] upsert failed", error);
        throw new Error("Failed to save post");
      }
    } else {
      const { error } = await context.supabase
        .from("post_saves")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", context.userId);
      if (error) {
        console.error("[setPostSaved] delete failed", error);
        throw new Error("Failed to unsave post");
      }
    }
    return { postId: data.postId, saved: data.saved };
  });

/** Posts the current viewer has bookmarked, newest saved first. */
export const listSavedPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: saves } = await context.supabase
      .from("post_saves")
      .select("post_id, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    const ids = (saves ?? []).map((s: any) => s.post_id);
    if (ids.length === 0) return { posts: [] as FeedPost[] };
    const { data: rows } = await context.supabase
      .from("posts")
      .select(POST_SELECT as any)
      .in("id", ids);
    const built = await buildFeedPosts(context.supabase, context.userId, (rows ?? []) as any[]);
    const order = new Map(ids.map((id: string, i: number) => [id, i]));
    built.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { posts: built };
  });

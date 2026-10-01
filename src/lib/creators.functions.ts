import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { parseVideoEmbed } from "./video-embed";
import { stableImageUrl } from "@/lib/storage/stable-image";

export const CREATOR_FIELDS = [
  "Graphic Designer",
  "Video Editor",
  "Video Content Creator",
  "Photographer",
  "Web Developer",
  "App Developer",
  "Music / Audio",
  "Writer / Copywriter",
  "3D & Motion",
  "Social Media Manager",
] as const;

export interface CreatorProfileDTO {
  isCreator: boolean;
  fields: string[];
  tools: string[];
  workLinks: string[];
  onboardedAt: string | null;
}

export interface CreatorMedia {
  url: string;
  type: "image" | "video";
  posterUrl: string | null;
}

export interface CreatorAssetDTO {
  productId: string;
  /** Null when the linked product is still in review (not publicly readable yet). */
  available: boolean;
  isFree: boolean;
  priceUsd: number;
  originalCurrency: string | null;
  originalAmount: number | null;
  fxSnapshot: { base: string; rates: Record<string, number> } | null;
  downloadCount: number;
  /** Marketplace category of the linked resource (e.g. Templates). */
  category?: string | null;
}

export interface CreatorPostDTO {
  id: string;
  title: string;
  caption: string | null;
  media: CreatorMedia[];
  communityLink: string | null;
  /** Full-length video link when the uploaded clip was auto-trimmed. */
  fullVideoUrl: string | null;
  externalUrl: string | null;
  externalEmbedUrl: string | null;
  externalProvider: string | null;
  fields: string[];
  createdAt: string;
  viewCount: number;
  asset: CreatorAssetDTO | null;
  author: {
    userId: string;
    name: string;
    slug: string | null;
    avatarUrl: string | null;
    workLinks: string[];
    /** Tools the creator listed during onboarding. */
    tools?: string[];
  };
}


function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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

function readCreatorProfile(raw: unknown): CreatorProfileDTO {
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown, max: number) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : [];
  return {
    isCreator: obj["is_creator"] === true,
    fields: list(obj["fields"], 10),
    tools: [],
    workLinks: list(obj["work_links"], 3),
    onboardedAt: typeof obj["onboarded_at"] === "string" ? obj["onboarded_at"] : null,
  };
}

/** Current user's creator status — drives whether + opens onboarding or the publish form. */
export const getMyCreatorProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorProfileDTO> => {
    // Own-row read only: the profiles table isn't readable by the signed-in
    // role, so a scoped admin read is what keeps returning creators as creators.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("creator_profile, tools")
      .eq("user_id", context.userId)
      .maybeSingle();
    const dto = readCreatorProfile((data as { creator_profile?: unknown } | null)?.creator_profile);
    const tools = (data as { tools?: unknown } | null)?.tools;
    dto.tools = Array.isArray(tools) ? tools.filter((t): t is string => typeof t === "string") : [];
    if (!dto.isCreator) {
      // Anyone who already published a showcase is a creator, even if the
      // questionnaire row was never written.
      const { count } = await supabaseAdmin
        .from("creator_posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", context.userId);
      if ((count ?? 0) > 0) dto.isCreator = true;
    }
    return dto;
  });


const OnboardingInput = z.object({
  fields: z.array(z.string().trim().min(1).max(40)).min(1).max(10),
  tools: z.array(z.string().trim().min(1).max(40)).max(12),
  workLinks: z.array(z.string().trim().max(300)).max(3).optional(),
});

/** Saves the short creator questionnaire onto the profile (skills + tools + links). */
export const saveCreatorOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OnboardingInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = supabaseAdmin;
    const { data: row } = await supabase
      .from("profiles")
      .select("skills, skill_levels")
      .eq("user_id", userId)
      .maybeSingle();


    const existingSkills = Array.isArray((row as { skills?: unknown } | null)?.skills)
      ? ((row as { skills: unknown[] }).skills.filter((s): s is string => typeof s === "string"))
      : [];
    const levelsRaw = (row as { skill_levels?: unknown } | null)?.skill_levels;
    const levels: Record<string, number> =
      levelsRaw && typeof levelsRaw === "object" && !Array.isArray(levelsRaw)
        ? { ...(levelsRaw as Record<string, number>) }
        : {};

    const skills = [...existingSkills];
    for (const f of data.fields) {
      if (!skills.some((s) => s.toLowerCase() === f.toLowerCase())) skills.push(f);
      if (levels[f] === undefined) levels[f] = 80;
    }

    const workLinks = (data.workLinks ?? []).map((l) => l.trim()).filter(Boolean);

    const { error } = await supabase
      .from("profiles")
      .update({
        skills: skills.slice(0, 20),
        skill_levels: levels,
        tools: data.tools.slice(0, 12),
        creator_profile: {
          is_creator: true,
          fields: data.fields,
          work_links: workLinks,
          onboarded_at: new Date().toISOString(),
        },
      })
      .eq("user_id", userId);
    if (error) {
      console.error("[saveCreatorOnboarding]", error);
      throw new Error("Couldn't save your creator profile");
    }
    return { ok: true };
  });

const ViewInput = z.object({
  postId: z.string().uuid(),
  sessionKey: z.string().trim().min(12).max(100),
});

/** Records one real view per browser/session for a published creator post. */
export const recordCreatorPostView = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ViewInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await sb.from("creator_post_views").insert({
      post_id: data.postId,
      session_key: data.sessionKey,
    });
    if (error) {
      if (error.code === "23505") return { ok: true, recorded: false };
      console.error("[recordCreatorPostView]", error);
      return { ok: false, recorded: false };
    }
    return { ok: true, recorded: true };
  });

const PublishInput = z.object({
  title: z.string().trim().min(2).max(120),
  caption: z.string().trim().max(2000).optional(),
  mediaPaths: z.array(z.string().trim().max(300)).max(10).optional(),
  mediaType: z.enum(["image", "video"]).optional(),
  communityLink: z.string().trim().max(300).optional(),
  fullVideoUrl: z.string().trim().max(500).regex(/^https?:\/\//i).optional(),
  externalUrl: z.string().trim().max(500).optional(),
  /** Marketplace product created by the same creator, sold as an instant download. */
  productId: z.string().uuid().optional(),
});

/** Publishes a creator showcase item. */
export const publishCreatorPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PublishInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const embed = data.externalUrl ? parseVideoEmbed(data.externalUrl) : null;

    const { supabaseAdmin: adminForProfile } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: prof } = await adminForProfile
      .from("profiles")
      .select("creator_profile")
      .eq("user_id", userId)
      .maybeSingle();

    const fields = readCreatorProfile((prof as { creator_profile?: unknown } | null)?.creator_profile).fields;

    // Only the creator's own listing may be attached — never a product id a
    // client hands us for someone else's asset.
    let productId: string | null = null;
    if (data.productId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("id, seller_id")
        .eq("id", data.productId)
        .maybeSingle();
      if (!prod || prod.seller_id !== userId) throw new Error("That asset isn't yours");
      productId = prod.id;
    }

    const { data: row, error } = await supabase
      .from("creator_posts")
      .insert({
        author_id: userId,
        title: data.title,
        caption: data.caption ?? null,
        media_paths: data.mediaPaths ?? [],
        media_type: data.mediaType ?? null,
        community_link: data.communityLink || null,
        full_video_url: data.mediaType === "video" ? data.fullVideoUrl || null : null,
        external_url: embed?.url ?? null,
        external_provider: embed?.provider ?? null,
        product_id: productId,
        fields,
        status: "published",
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[publishCreatorPost]", error);
      throw new Error("Couldn't publish. Try again.");
    }
    return { id: (row as { id: string } | null)?.id ?? null };
  });


const EditInput = z.object({
  postId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  caption: z.string().trim().max(2000).optional().nullable(),
  communityLink: z.string().trim().max(300).optional().nullable(),
});

/** Owner-only edit of a showcase post's text and community link. */
export const updateCreatorPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EditInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("creator_posts")
      .update({
        title: data.title,
        caption: data.caption || null,
        community_link: data.communityLink || null,
      })
      .eq("id", data.postId)
      .eq("author_id", context.userId);
    if (error) {
      console.error("[updateCreatorPost]", error);
      throw new Error("Couldn't save your changes");
    }
    return { ok: true };
  });

/** Owner-only delete of a showcase post. */
export const deleteCreatorPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("creator_posts")
      .delete()
      .eq("id", data.postId)
      .eq("author_id", context.userId);
    if (error) {
      console.error("[deleteCreatorPost]", error);
      throw new Error("Couldn't delete this post");
    }
    return { ok: true };
  });

const SaveInput = z.object({
  postId: z.string().uuid(),
  title: z.string().trim().max(160),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
});

/** Saves a showcase post into the signed-in member's "Saved" board. */
export const saveCreatorPostToCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const url = `/feed?tab=creators&post=${data.postId}`;

    let boardId: string | null = null;
    const { data: existing } = await supabase
      .from("collections")
      .select("id")
      .eq("user_id", userId)
      .eq("title", "Saved")
      .maybeSingle();
    boardId = (existing as { id: string } | null)?.id ?? null;

    if (!boardId) {
      const { data: created, error } = await supabase
        .from("collections")
        .insert({
          user_id: userId,
          title: "Saved",
          slug: `saved-${Math.random().toString(36).slice(2, 6)}`,
          is_public: false,
        })
        .select("id")
        .single();
      if (error) throw new Error("Couldn't create your saved board");
      boardId = created.id as string;
    }

    const { data: dupe } = await supabase
      .from("collection_items")
      .select("id")
      .eq("user_id", userId)
      .eq("collection_id", boardId)
      .eq("url", url)
      .maybeSingle();
    if (dupe) return { ok: true, alreadySaved: true };

    const { error: itemError } = await supabase.from("collection_items").insert({
      collection_id: boardId,
      user_id: userId,
      kind: "link",
      ref_id: data.postId,
      url,
      title: data.title,
      image_url: data.imageUrl || null,
    });
    if (itemError) {
      console.error("[saveCreatorPostToCollection]", itemError);
      throw new Error("Couldn't save this post");
    }
    return { ok: true, alreadySaved: false };
  });

async function loadCreatorPosts(postId?: string): Promise<CreatorPostDTO[]> {
    const sb = publicClient();
    let query = sb
      .from("creator_posts")
      .select(
        "id, author_id, title, caption, media_paths, media_type, community_link, full_video_url, external_url, external_provider, product_id, fields, created_at, view_count",
      )
      .eq("status", "published");
    if (postId) query = query.eq("id", postId);
    const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(postId ? 1 : 40);
    if (error || !rows || rows.length === 0) return [];

    // Linked assets: only active (approved) listings are publicly readable, so
    // anything missing here is still in review.
    const productIds = Array.from(
      new Set(rows.map((r) => r.product_id).filter((id): id is string => !!id)),
    );
    const assets = new Map<string, CreatorAssetDTO>();
    const downloadCounts = new Map<string, number>();
    if (productIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("product_id")
        .in("product_id", productIds)
        .eq("status", "paid");
      (orders ?? []).forEach((o) => {
        if (!o.product_id) return;
        downloadCounts.set(o.product_id, (downloadCounts.get(o.product_id) ?? 0) + 1);
      });

      const { data: prods } = await sb
        .from("products")
        .select("id, price_usd, original_currency, original_amount, fx_snapshot, category")
        .in("id", productIds)
        .eq("status", "active");
      (prods ?? []).forEach((p) => {
        const priceUsd = Number(p.price_usd) || 0;
        assets.set(p.id, {
          productId: p.id,
          available: true,
          isFree: priceUsd <= 0,
          priceUsd,
          originalCurrency: (p.original_currency as string) ?? null,
          originalAmount: p.original_amount === null ? null : Number(p.original_amount),
          fxSnapshot: (p.fx_snapshot as { base: string; rates: Record<string, number> } | null) ?? null,
          downloadCount: downloadCounts.get(p.id) ?? 0,
          category: (p as { category?: string | null }).category ?? null,
        });
      });
    }


    const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
    // Read only the public creator identity fields needed by the feed. The
    // profiles table's browser-facing policy intentionally hides private data.
    const { supabaseAdmin: adminForProfiles } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await adminForProfiles
      .from("profiles")
      .select("user_id, display_name, slug, avatar_path, creator_profile, tools")
      .in("user_id", authorIds);
    const byAuthor = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    // Sign media + posters from the shared post-media bucket.
    const mediaPaths = new Set<string>();
    const posterPaths = new Set<string>();
    for (const r of rows) {
      for (const p of r.media_paths ?? []) {
        if (!p || /^https?:\/\//.test(p)) continue;
        mediaPaths.add(p);
        if (r.media_type === "video") posterPaths.add(`${p}.poster.jpg`);
      }
    }
    const signed = new Map<string, string>();
    const all = [...mediaPaths, ...posterPaths];
    for (const p of all) {
      const url = stableImageUrl("post-media", p);
      if (url) signed.set(p, url);
    }

    const avatarPaths = Array.from(
      new Set(
        (profiles ?? [])
          .map((p) => p.avatar_path)
          .filter((p): p is string => !!p && !/^https?:\/\//.test(p)),
      ),
    );
    const signedAvatars = new Map<string, string>();
    for (const p of avatarPaths) {
      const url = stableImageUrl("avatars", p);
      if (url) signedAvatars.set(p, url);
    }

    return rows.map((r) => {
      const prof = byAuthor.get(r.author_id);
      const kind: "image" | "video" = r.media_type === "video" ? "video" : "image";
      const media: CreatorMedia[] = (r.media_paths ?? [])
        .map((p) => {
          const url = /^https?:\/\//.test(p) ? p : signed.get(p);
          if (!url) return null;
          return {
            url,
            type: kind,
            posterUrl: kind === "video" ? (signed.get(`${p}.poster.jpg`) ?? null) : null,
          } satisfies CreatorMedia;
        })
        .filter((m): m is CreatorMedia => m !== null);

      const embed = r.external_url ? parseVideoEmbed(r.external_url) : null;
      const avatar = prof?.avatar_path
        ? /^https?:\/\//.test(prof.avatar_path)
          ? prof.avatar_path
          : (signedAvatars.get(prof.avatar_path) ?? null)
        : null;

      return {
        id: r.id,
        title: r.title,
        caption: r.caption,
        media,
        communityLink: r.community_link,
        fullVideoUrl: (r as { full_video_url?: string | null }).full_video_url ?? null,
        externalUrl: r.external_url,
        externalEmbedUrl: embed?.embedUrl ?? null,
        externalProvider: r.external_provider,
        fields: r.fields ?? [],
        createdAt: r.created_at,
        viewCount: Number(r.view_count ?? 0),
        asset: r.product_id
          ? (assets.get(r.product_id) ?? {
              productId: r.product_id,
              available: false,
              isFree: false,
              priceUsd: 0,
              originalCurrency: null,
              originalAmount: null,
              fxSnapshot: null,
              downloadCount: downloadCounts.get(r.product_id) ?? 0,
            })
          : null,

        author: {
          userId: r.author_id,
          name: prof?.display_name ?? "Creator",
          slug: prof?.slug ?? null,
          avatarUrl: avatar,
          workLinks: readCreatorProfile((prof as { creator_profile?: unknown } | undefined)?.creator_profile).workLinks,
          tools: Array.isArray((prof as { tools?: unknown } | undefined)?.tools)
            ? ((prof as { tools: unknown[] }).tools.filter((x): x is string => typeof x === "string").slice(0, 6))
            : [],
        },
      } satisfies CreatorPostDTO;
    });
}

/** Public creator showcase feed. */
export const listCreatorFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<CreatorPostDTO[]> => loadCreatorPosts(),
);

export interface TopCreatorDTO {
  id: string;
  name: string;
  slug: string | null;
  avatarUrl: string | null;
  country: string | null;
  verified: boolean;
  followersCount: number;
  postsCount: number;
  viewsCount: number;
  /** Creator fields they post in most (top 3). */
  fields: string[];
  /** Tools listed on the creator profile. */
  tools?: string[];
  /** Date of the creator's first published post. */
  firstPostAt?: string | null;
}

/** Live leaderboard of showcase creators ranked by followers, with post counts and views. */
export const getTopCreators = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(input ?? {}),
  )
  .handler(
  async ({ data: input }): Promise<TopCreatorDTO[]> => {
    const sb = publicClient();
    const { data: postRows } = await sb
      .from("creator_posts")
      .select("author_id, fields, view_count, created_at")
      .eq("status", "published")
      .limit(2000);
    if (!postRows || postRows.length === 0) return [];

    const postsByAuthor = new Map<string, number>();
    const viewsByAuthor = new Map<string, number>();
    const fieldsByAuthor = new Map<string, Map<string, number>>();
    const firstByAuthor = new Map<string, string>();
    postRows.forEach((r) => {
      const aid = r.author_id as string;
      if (!aid) return;
      postsByAuthor.set(aid, (postsByAuthor.get(aid) ?? 0) + 1);
      const at = (r as { created_at?: string }).created_at;
      if (at && (!firstByAuthor.has(aid) || at < firstByAuthor.get(aid)!)) firstByAuthor.set(aid, at);
      viewsByAuthor.set(aid, (viewsByAuthor.get(aid) ?? 0) + Number(r.view_count ?? 0));
      (r.fields ?? []).forEach((f) => {
        const counts = fieldsByAuthor.get(aid) ?? new Map<string, number>();
        counts.set(f, (counts.get(f) ?? 0) + 1);
        fieldsByAuthor.set(aid, counts);
      });
    });
    const authorIds = Array.from(postsByAuthor.keys()).slice(0, 200);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profileRes, followRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, display_name, slug, avatar_path, country, verification_tier, banned_at, deleted_at, tools")
        .in("user_id", authorIds),
      sb.from("follows").select("followee_id").in("followee_id", authorIds).limit(10000),
    ]);

    const followersByAuthor = new Map<string, number>();
    (followRes.data ?? []).forEach((f: any) => {
      const id = f.followee_id as string;
      followersByAuthor.set(id, (followersByAuthor.get(id) ?? 0) + 1);
    });

    const profiles = (profileRes.data ?? []).filter(
      (p: any) => !p.banned_at && !p.deleted_at,
    );
    const avatarPaths = Array.from(
      new Set(
        profiles
          .map((p: any) => p.avatar_path as string | null)
          .filter((p): p is string => !!p && !/^https?:\/\//.test(p)),
      ),
    );
    const signedAvatars = new Map<string, string>();
    for (const p of avatarPaths) {
      const url = stableImageUrl("avatars", p);
      if (url) signedAvatars.set(p, url);
    }

    return profiles
      .map((p: any) => {
        const aid = p.user_id as string;
        const fieldCounts = fieldsByAuthor.get(aid) ?? new Map<string, number>();
        const fields = Array.from(fieldCounts.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 3)
          .map(([f]) => f);
        const avatarPath = p.avatar_path as string | null;
        const tier = String(p.verification_tier ?? "").toLowerCase();
        return {
          id: aid,
          name: (p.display_name as string) ?? "Creator",
          slug: (p.slug as string | null) ?? null,
          avatarUrl: avatarPath
            ? /^https?:\/\//.test(avatarPath)
              ? avatarPath
              : (signedAvatars.get(avatarPath) ?? null)
            : null,
          country: (p.country as string | null) ?? null,
          verified: !!tier && tier !== "none",
          followersCount: followersByAuthor.get(aid) ?? 0,
          postsCount: postsByAuthor.get(aid) ?? 0,
          viewsCount: viewsByAuthor.get(aid) ?? 0,
          fields,
          tools: Array.isArray(p.tools) ? (p.tools as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 6) : [],
          firstPostAt: firstByAuthor.get(aid) ?? null,
        } satisfies TopCreatorDTO;
      })
      .sort((a, b) => b.followersCount - a.followersCount || b.postsCount - a.postsCount)
      .slice(0, input.limit ?? 10);
  },
);

/** One published showcase post for collection previews and direct opening. */
export const getCreatorPost = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<CreatorPostDTO | null> => {
    const posts = await loadCreatorPosts(data.postId);
    return posts[0] ?? null;
  });

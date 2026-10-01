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
  contentType?: string;
  category?: string | null;
  postTools?: string[];
  tags?: string[];
  visibility?: "public" | "unlisted";
  resource?: { type: string | null; license: string[]; licenseNote: string | null } | null;
  showcaseProduct?: {
    id: string;
    slug: string | null;
    name: string;
    coverUrl: string | null;
    priceUsd: number;
    originalCurrency: string | null;
    originalAmount: number | null;
    fxSnapshot: { base: string; rates: Record<string, number> } | null;
  } | null;
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

export const CREATOR_CONTENT_TYPES = [
  { key: "showcase", label: "Showcase" },
  { key: "tutorial", label: "Tutorial" },
  { key: "tip", label: "Tip" },
  { key: "educational", label: "Educational" },
  { key: "behind_the_scenes", label: "Behind the Scenes" },
  { key: "resource", label: "Resource Post" },
  { key: "product_showcase", label: "Product Showcase" },
] as const;
export type CreatorContentType = (typeof CREATOR_CONTENT_TYPES)[number]["key"];

export const CREATOR_RESOURCE_TYPES = [
  "PDF", "Video", "ZIP", "Canva template", "CapCut project", "Figma file", "Preset",
  "Ebook", "Checklist", "Prompt pack", "Audio", "Other digital asset",
] as const;

export const CREATOR_LICENSES = ["Personal Use", "Commercial Use", "No Redistribution", "Editable", "Other"] as const;

const ContentTypeEnum = z.enum([
  "showcase", "tutorial", "tip", "educational", "behind_the_scenes", "resource", "product_showcase",
]);

const PublishInput = z.object({
  /** When set, updates the creator's own existing post (draft or published). */
  postId: z.string().uuid().optional(),
  status: z.enum(["draft", "published"]).default("published"),
  title: z.string().trim().min(2).max(120),
  caption: z.string().trim().max(2000).optional(),
  mediaPaths: z.array(z.string().trim().max(300)).max(10).optional(),
  mediaType: z.enum(["image", "video"]).optional(),
  communityLink: z.string().trim().max(300).optional(),
  fullVideoUrl: z.string().trim().max(500).regex(/^https?:\/\//i).optional(),
  externalUrl: z.string().trim().max(500).optional(),
  /** Marketplace product created by the same creator, sold as an instant download. */
  productId: z.string().uuid().optional(),
  contentType: ContentTypeEnum.default("showcase"),
  category: z.string().trim().max(60).optional(),
  tools: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  visibility: z.enum(["public", "unlisted"]).default("public"),
  resourceType: z.string().trim().max(40).optional(),
  resourceLicense: z.array(z.string().trim().max(40)).max(5).optional(),
  resourceLicenseNote: z.string().trim().max(300).optional(),
  rightsConfirmed: z.boolean().optional(),
  /** An existing Oventric product of the creator to feature with this post. */
  showcaseProductId: z.string().uuid().optional().nullable(),
});

async function assertOwnProduct(productId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prod } = await supabaseAdmin
    .from("products")
    .select("id, seller_id")
    .eq("id", productId)
    .maybeSingle();
  if (!prod || prod.seller_id !== userId) throw new Error("That product isn't yours");
  return prod.id as string;
}

/** Creates or updates a creator post — as a draft or published. */
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
    const productId = data.productId ? await assertOwnProduct(data.productId, userId) : null;
    const showcaseProductId = data.showcaseProductId
      ? await assertOwnProduct(data.showcaseProductId, userId)
      : null;

    let existing: { id: string; product_id: string | null; rights_confirmed_at: string | null } | null = null;
    if (data.postId) {
      const { data: row } = await supabase
        .from("creator_posts")
        .select("id, author_id, product_id, rights_confirmed_at")
        .eq("id", data.postId)
        .maybeSingle();
      if (!row || row.author_id !== userId) throw new Error("That post isn't yours");
      existing = row;
    }
    const finalProductId = productId ?? existing?.product_id ?? null;
    let rightsAt = existing?.rights_confirmed_at ?? null;
    if (data.rightsConfirmed) rightsAt = rightsAt ?? new Date().toISOString();
    if (data.status === "published" && finalProductId && !rightsAt) {
      throw new Error("Confirm you own the rights to this resource before publishing");
    }

    const meta = {
      title: data.title,
      caption: data.caption ?? null,
      community_link: data.communityLink || null,
      content_type: data.contentType,
      category: data.category || null,
      tools: data.tools ?? [],
      tags: (data.tags ?? []).map((t) => t.replace(/^#/, "").toLowerCase()),
      visibility: data.visibility,
      resource_type: finalProductId ? data.resourceType || null : null,
      resource_license: finalProductId ? data.resourceLicense ?? [] : [],
      resource_license_note: finalProductId ? data.resourceLicenseNote || null : null,
      rights_confirmed_at: rightsAt,
      showcase_product_id: showcaseProductId,
      status: data.status,
      product_id: finalProductId,
    };

    if (existing) {
      const patch: Record<string, unknown> = { ...meta };
      if (data.mediaPaths) {
        patch.media_paths = data.mediaPaths;
        patch.media_type = data.mediaType ?? null;
      }
      // Re-publishing a draft surfaces it as new.
      const { error } = await supabase.from("creator_posts").update(patch).eq("id", existing.id).eq("author_id", userId);
      if (error) {
        console.error("[publishCreatorPost:update]", error);
        throw new Error(error.message || "Couldn't save. Try again.");
      }
      return { id: existing.id };
    }

    const { data: row, error } = await supabase
      .from("creator_posts")
      .insert({
        author_id: userId,
        media_paths: data.mediaPaths ?? [],
        media_type: data.mediaType ?? null,
        full_video_url: data.mediaType === "video" ? data.fullVideoUrl || null : null,
        external_url: embed?.url ?? null,
        external_provider: embed?.provider ?? null,
        fields,
        ...meta,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[publishCreatorPost]", error);
      throw new Error("Couldn't publish. Try again.");
    }
    return { id: (row as { id: string } | null)?.id ?? null };
  });

export interface CreatorDraftDTO {
  id: string;
  status: "draft" | "published";
  title: string;
  caption: string | null;
  communityLink: string | null;
  contentType: CreatorContentType;
  category: string | null;
  tools: string[];
  tags: string[];
  visibility: "public" | "unlisted";
  resourceType: string | null;
  resourceLicense: string[];
  resourceLicenseNote: string | null;
  rightsConfirmed: boolean;
  productId: string | null;
  showcaseProductId: string | null;
  mediaPaths: string[];
  mediaType: "image" | "video" | null;
  mediaUrls: string[];
  updatedAt: string;
}

function toDraftDTO(r: Record<string, unknown>): CreatorDraftDTO {
  const paths = ((r.media_paths as string[] | null) ?? []).filter(Boolean);
  return {
    id: r.id as string,
    status: (r.status as "draft" | "published") ?? "draft",
    title: (r.title as string) ?? "",
    caption: (r.caption as string | null) ?? null,
    communityLink: (r.community_link as string | null) ?? null,
    contentType: ((r.content_type as CreatorContentType) ?? "showcase"),
    category: (r.category as string | null) ?? null,
    tools: (r.tools as string[] | null) ?? [],
    tags: (r.tags as string[] | null) ?? [],
    visibility: (r.visibility as "public" | "unlisted") ?? "public",
    resourceType: (r.resource_type as string | null) ?? null,
    resourceLicense: (r.resource_license as string[] | null) ?? [],
    resourceLicenseNote: (r.resource_license_note as string | null) ?? null,
    rightsConfirmed: !!r.rights_confirmed_at,
    productId: (r.product_id as string | null) ?? null,
    showcaseProductId: (r.showcase_product_id as string | null) ?? null,
    mediaPaths: paths,
    mediaType: (r.media_type as "image" | "video" | null) ?? null,
    mediaUrls: paths.map((p) => (/^https?:\/\//.test(p) ? p : stableImageUrl("post-media", p) ?? "")).filter(Boolean),
    updatedAt: (r.updated_at as string) ?? (r.created_at as string),
  };
}

const DRAFT_COLS =
  "id, author_id, status, title, caption, community_link, content_type, category, tools, tags, visibility, resource_type, resource_license, resource_license_note, rights_confirmed_at, product_id, showcase_product_id, media_paths, media_type, created_at, updated_at";

/** The signed-in creator's unpublished drafts. */
export const listMyCreatorDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorDraftDTO[]> => {
    const { data, error } = await context.supabase
      .from("creator_posts")
      .select(DRAFT_COLS)
      .eq("author_id", context.userId)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Couldn't load drafts");
    return (data ?? []).map((r) => toDraftDTO(r as Record<string, unknown>));
  });

/** Owner-only full post for the composer's edit mode. */
export const getMyCreatorPostForEdit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<CreatorDraftDTO> => {
    const { data: row } = await context.supabase
      .from("creator_posts")
      .select(DRAFT_COLS)
      .eq("id", data.postId)
      .eq("author_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Post not found");
    return toDraftDTO(row as Record<string, unknown>);
  });

/**
 * Secure resource access. Authorizes against authoritative order state:
 * the creator themselves, or a buyer with a PAID order for the linked product.
 * Never trusts the client. Returns a short-lived signed link.
 */
export const getCreatorResourceDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post } = await supabaseAdmin
      .from("creator_posts")
      .select("id, author_id, status, product_id")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post?.product_id || (post.status !== "published" && post.author_id !== context.userId)) {
      return { authorized: false as const, reason: "not_found" as const };
    }
    const { data: prod } = await supabaseAdmin
      .from("products")
      .select("id, seller_id, file_path, external_url, status, requires_manual_delivery")
      .eq("id", post.product_id)
      .maybeSingle();
    if (!prod) return { authorized: false as const, reason: "not_found" as const };

    let allowed = prod.seller_id === context.userId;
    if (!allowed) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("buyer_id", context.userId)
        .eq("product_id", prod.id)
        .eq("status", "paid")
        .limit(1)
        .maybeSingle();
      allowed = !!order;
    }
    if (!allowed) return { authorized: false as const, reason: "no_access" as const };

    let url: string | null = null;
    if (prod.file_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("product-files")
        .createSignedUrl(prod.file_path as string, 60 * 10);
      url = signed?.signedUrl ?? null;
    } else if (prod.external_url) {
      url = prod.external_url as string;
    }
    if (!url) return { authorized: false as const, reason: "unavailable" as const };
    return { authorized: true as const, url };
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

async function loadCreatorPosts(postId?: string, authorId?: string, limit = 40): Promise<CreatorPostDTO[]> {
    const sb = publicClient();
    let query = sb
      .from("creator_posts")
      .select(
        "id, author_id, title, caption, media_paths, media_type, community_link, full_video_url, external_url, external_provider, product_id, fields, created_at, view_count, content_type, category, tools, tags, visibility, resource_type, resource_license, resource_license_note, showcase_product_id",
      )
      .eq("status", "published");
    if (postId) query = query.eq("id", postId);
    // Unlisted posts open by direct link only — never in feeds or profiles.
    else query = query.eq("visibility", "public");
    if (authorId) query = query.eq("author_id", authorId);
    const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(postId ? 1 : limit);
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


    const showcaseIds = Array.from(
      new Set(rows.map((r) => r.showcase_product_id).filter((id): id is string => !!id)),
    );
    const showcase = new Map<string, NonNullable<CreatorPostDTO["showcaseProduct"]>>();
    if (showcaseIds.length > 0) {
      const { data: sp } = await sb
        .from("products")
        .select("id, slug, name, cover_path, price_usd, original_currency, original_amount, fx_snapshot")
        .in("id", showcaseIds)
        .eq("status", "active");
      (sp ?? []).forEach((p) => {
        showcase.set(p.id, {
          id: p.id,
          slug: (p.slug as string | null) ?? null,
          name: p.name as string,
          coverUrl: p.cover_path ? (/^https?:\/\//.test(p.cover_path) ? p.cover_path : stableImageUrl("product-covers", p.cover_path)) : null,
          priceUsd: Number(p.price_usd) || 0,
          originalCurrency: (p.original_currency as string) ?? null,
          originalAmount: p.original_amount === null ? null : Number(p.original_amount),
          fxSnapshot: (p.fx_snapshot as { base: string; rates: Record<string, number> } | null) ?? null,
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
        contentType: r.content_type ?? "showcase",
        category: r.category ?? null,
        postTools: r.tools ?? [],
        tags: r.tags ?? [],
        visibility: (r.visibility as "public" | "unlisted") ?? "public",
        resource: r.product_id
          ? { type: r.resource_type ?? null, license: r.resource_license ?? [], licenseNote: r.resource_license_note ?? null }
          : null,
        showcaseProduct: r.showcase_product_id ? (showcase.get(r.showcase_product_id) ?? null) : null,

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


// ---------------------------------------------------------------------------
// Public creator profile (/creators/@username) — reuses the profiles identity.
// ---------------------------------------------------------------------------

export interface CreatorShopItemDTO {
  id: string;
  slug: string | null;
  name: string;
  coverUrl: string | null;
  category: string;
}

export interface PublicCreatorProfileDTO {
  userId: string;
  slug: string | null;
  username: string | null;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  verified: boolean;
  isCreator: boolean;
  category: string | null;
  fields: string[];
  tools: string[];
  stats: { followers: number; content: number; resources: number; downloads: number };
  posts: CreatorPostDTO[];
  shop: { count: number; items: CreatorShopItemDTO[] };
}

/** Public creator profile by @username / slug. Banned or deactivated accounts are hidden. */
export const getPublicCreatorProfile = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ handle: z.string().trim().min(1).max(80).regex(/^@?[A-Za-z0-9._-]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicCreatorProfileDTO | null> => {
    const handle = data.handle.replace(/^@/, "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("user_id, slug, username, display_name, bio, avatar_path, cover_path, tools, creator_profile, verification_tier, banned_at, deleted_at")
      .or(`slug.ilike.${handle},username.ilike.${handle}`)
      .limit(1)
      .maybeSingle();
    if (!row || row.banned_at || row.deleted_at) return null;

    const uid = row.user_id as string;
    const sb = publicClient();
    const [posts, followRes, prodRes] = await Promise.all([
      loadCreatorPosts(undefined, uid, 60),
      sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", uid),
      sb
        .from("products")
        .select("id, slug, name, cover_path, category", { count: "exact" })
        .eq("seller_id", uid)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const cp = readCreatorProfile(row.creator_profile);
    const resources = posts.filter((p) => p.asset?.available);
    const downloads = resources.reduce((n, p) => n + (p.asset?.downloadCount ?? 0), 0);
    const tools = Array.isArray(row.tools) ? (row.tools as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 12) : [];
    const pic = (bucket: string, path: string | null) =>
      path ? (/^https?:\/\//.test(path) ? path : stableImageUrl(bucket, path) ?? null) : null;
    const tier = String(row.verification_tier ?? "").toLowerCase();
    const fields = cp.fields.length ? cp.fields : Array.from(new Set(posts.flatMap((p) => p.fields))).slice(0, 3);

    return {
      userId: uid,
      slug: (row.slug as string | null) ?? null,
      username: (row.username as string | null) ?? null,
      name: ((row.display_name as string | null) ?? "").trim() || (row.username as string | null) || (row.slug as string | null) || "Creator",
      bio: (row.bio as string | null) ?? null,
      avatarUrl: pic("avatars", row.avatar_path as string | null),
      coverUrl: pic("profile-covers", row.cover_path as string | null),
      verified: !!tier && tier !== "none",
      isCreator: cp.isCreator,
      category: fields[0] ?? null,
      fields,
      tools,
      stats: { followers: followRes.count ?? 0, content: posts.length, resources: resources.length, downloads },
      posts,
      shop: {
        count: prodRes.count ?? 0,
        items: (prodRes.data ?? []).map((p) => ({
          id: p.id as string,
          slug: (p.slug as string | null) ?? null,
          name: p.name as string,
          coverUrl: pic("product-covers", p.cover_path as string | null),
          category: p.category as string,
        })),
      },
    };
  });

/** Whether either side has blocked the other — mirrors existing block rules. */
export const getCreatorBlockState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ targetId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ blocked: boolean }> => {
    if (data.targetId === context.userId) return { blocked: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("user_blocks")
      .select("id")
      .or(
        `and(blocker_id.eq.${context.userId},blocked_id.eq.${data.targetId}),and(blocker_id.eq.${data.targetId},blocked_id.eq.${context.userId})`,
      )
      .limit(1);
    return { blocked: (rows ?? []).length > 0 };
  });

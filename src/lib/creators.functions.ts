import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { parseVideoEmbed } from "./video-embed";

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
}

export interface CreatorPostDTO {
  id: string;
  title: string;
  caption: string | null;
  media: CreatorMedia[];
  communityLink: string | null;
  externalUrl: string | null;
  externalEmbedUrl: string | null;
  externalProvider: string | null;
  fields: string[];
  createdAt: string;
  asset: CreatorAssetDTO | null;
  author: {
    userId: string;
    name: string;
    slug: string | null;
    avatarUrl: string | null;
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
    const { data } = await context.supabase
      .from("profiles")
      .select("creator_profile, tools")
      .eq("user_id", context.userId)
      .maybeSingle();
    const dto = readCreatorProfile((data as { creator_profile?: unknown } | null)?.creator_profile);
    const tools = (data as { tools?: unknown } | null)?.tools;
    dto.tools = Array.isArray(tools) ? tools.filter((t): t is string => typeof t === "string") : [];
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
    const { supabase, userId } = context;
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

const PublishInput = z.object({
  title: z.string().trim().min(2).max(120),
  caption: z.string().trim().max(2000).optional(),
  mediaPaths: z.array(z.string().trim().max(300)).max(10).optional(),
  mediaType: z.enum(["image", "video"]).optional(),
  communityLink: z.string().trim().max(300).optional(),
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

    const { data: prof } = await supabase
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


/** Public creator showcase feed. */
export const listCreatorFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<CreatorPostDTO[]> => {
    const sb = publicClient();
    const { data: rows, error } = await sb
      .from("creator_posts")
      .select(
        "id, author_id, title, caption, media_paths, media_type, community_link, external_url, external_provider, product_id, fields, created_at",
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error || !rows || rows.length === 0) return [];

    // Linked assets: only active (approved) listings are publicly readable, so
    // anything missing here is still in review.
    const productIds = Array.from(
      new Set(rows.map((r) => r.product_id).filter((id): id is string => !!id)),
    );
    const assets = new Map<string, CreatorAssetDTO>();
    if (productIds.length > 0) {
      const { data: prods } = await sb
        .from("products")
        .select("id, price_usd, original_currency, original_amount, fx_snapshot")
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
        });
      });
    }


    const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
    const { data: profiles } = await sb
      .from("profiles")
      .select("user_id, display_name, slug, avatar_path")
      .in("user_id", authorIds);
    const byAuthor = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    const { imageStorage } = await import("@/lib/storage/images.server");
    const storage = await imageStorage();

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
    if (all.length > 0) {
      const { data: urls } = await storage.from("post-media").createSignedUrls(all, 60 * 60 * 6);
      (urls ?? []).forEach((u) => {
        if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
      });
    }

    const avatarPaths = Array.from(
      new Set(
        (profiles ?? [])
          .map((p) => p.avatar_path)
          .filter((p): p is string => !!p && !/^https?:\/\//.test(p)),
      ),
    );
    const signedAvatars = new Map<string, string>();
    if (avatarPaths.length > 0) {
      const { data: urls } = await storage.from("avatars").createSignedUrls(avatarPaths, 60 * 60 * 6);
      (urls ?? []).forEach((u) => {
        if (u.signedUrl && u.path) signedAvatars.set(u.path, u.signedUrl);
      });
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
        externalUrl: r.external_url,
        externalEmbedUrl: embed?.embedUrl ?? null,
        externalProvider: r.external_provider,
        fields: r.fields ?? [],
        createdAt: r.created_at,
        author: {
          userId: r.author_id,
          name: prof?.display_name ?? "Creator",
          slug: prof?.slug ?? null,
          avatarUrl: avatar,
        },
      } satisfies CreatorPostDTO;
    });
  },
);

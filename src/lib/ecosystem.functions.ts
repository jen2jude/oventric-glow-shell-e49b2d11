import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { EcosystemCounts } from "./ecosystem/sections";
import { imageStorage } from "@/lib/storage/images.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Input = z.object({ idOrSlug: z.string().trim().min(1).max(120) });

export interface ProfileEcosystem {
  userId: string | null;
  slug: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  skills: string[];
  counts: EcosystemCounts;
}

const EMPTY: ProfileEcosystem = {
  userId: null,
  slug: null,
  displayName: null,
  avatarUrl: null,
  skills: [],
  counts: {},
};

/**
 * Public, read-only summary of everything a person has on Oventric.
 * Drives the adaptive profile sections and every cross-entity link row.
 */
export const getProfileEcosystem = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ProfileEcosystem> => {
    const { createEcosystemClient } = await import("./ecosystem/public-client.server");
    const supabase = await createEcosystemClient();

    const q = supabase
      .from("profiles")
      .select("user_id, slug, display_name, avatar_path, skills")
      .is("deleted_at", null);
    const { data: prof } = UUID_RE.test(data.idOrSlug)
      ? await q.eq("user_id", data.idOrSlug).maybeSingle()
      : await q.eq("slug", data.idOrSlug).maybeSingle();

    if (!prof) return EMPTY;
    const userId = prof.user_id as string;

    const head = { count: "exact" as const, head: true };
    const [posts, shop, services, courses, bountiesOpen, bountiesSolved, circles] =
      await Promise.all([
        supabase.from("posts").select("id", head).eq("author_id", userId),
        supabase
          .from("products")
          .select("id", head)
          .eq("seller_id", userId)
          .neq("kind", "service"),
        supabase.from("products").select("id", head).eq("seller_id", userId).eq("kind", "service"),
        supabase
          .from("courses")
          .select("id", head)
          .eq("owner_id", userId)
          .eq("is_published", true),
        // Bounties are a paused legacy feature and unreadable by public visitors.
        Promise.resolve({ count: 0 }),
        Promise.resolve({ count: 0 }),

        supabase.from("circle_members").select("circle_id", head).eq("user_id", userId),
      ]);

    const collections = await supabase
      .from("collections")
      .select("id", head)
      .eq("user_id", userId)
      .eq("is_public", true);

    const skills = Array.isArray(prof.skills)
      ? (prof.skills as unknown[]).filter((s): s is string => typeof s === "string" && !!s.trim())
      : [];

    let avatarUrl: string | null = null;
    if (typeof prof.avatar_path === "string" && prof.avatar_path) {
      const { data: signed } = await (await imageStorage()).from("avatars")
        .createSignedUrl(prof.avatar_path, 60 * 60 * 24 * 7);
      avatarUrl =
        signed?.signedUrl ??
        (await imageStorage()).from("avatars").getPublicUrl(prof.avatar_path).data.publicUrl ??
        null;
    }

    return {
      userId,
      slug: (prof.slug as string) ?? null,
      displayName: (prof.display_name as string) ?? null,
      avatarUrl,
      skills,
      counts: {
        posts: posts.count ?? 0,
        marketplace: shop.count ?? 0,
        services: services.count ?? 0,
        courses: courses.count ?? 0,
        posted: bountiesOpen.count ?? 0,
        solved: bountiesSolved.count ?? 0,
        groups: circles.count ?? 0,
        skills: skills.length,
        collections: collections.count ?? 0,
      },
    };
  });

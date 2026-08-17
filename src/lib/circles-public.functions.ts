import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export interface PublicCircle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  category: string;
  emoji: string;
  bannerHue: string;
  avatarHue: string;
  createdAt: string;
  memberCount: number;
  postCount: number;
}

/**
 * Public, read-only directory of open circles for the web (URL) version.
 * Uses the publishable key: no session required, private circles excluded
 * by the underlying database function.
 */
export const getPublicCircleDirectory = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicCircle[]> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Backend is not configured");
    const sb = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.rpc("public_circle_directory");
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      slug: String(r.slug ?? ""),
      description: (r.description as string | null) ?? null,
      avatarUrl: (r.avatar_url as string | null) ?? null,
      coverUrl: (r.cover_url as string | null) ?? null,
      category: String(r.category ?? "Community"),
      emoji: String(r.emoji ?? "◎"),
      bannerHue: String(r.banner_hue ?? "#E5484D"),
      avatarHue: String(r.avatar_hue ?? "#E5484D"),
      createdAt: String(r.created_at ?? new Date().toISOString()),
      memberCount: Number(r.member_count ?? 0),
      postCount: Number(r.post_count ?? 0),
    }));
  },
);

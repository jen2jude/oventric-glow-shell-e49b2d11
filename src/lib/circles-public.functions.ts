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

    // Circle branding lives in private buckets; sign it with the admin client
    // (only rows the public directory already exposes reach this point).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sign = async (bucket: string, value: unknown): Promise<string | null> => {
      const v = typeof value === "string" && value ? value : null;
      if (!v) return null;
      if (/^https?:\/\//i.test(v) || v.startsWith("data:")) return v;
      try {
        const res = await supabaseAdmin.storage.from(bucket).createSignedUrl(v, 60 * 60 * 24 * 7);
        return res.data?.signedUrl ?? null;
      } catch {
        return null;
      }
    };

    const rows = (data ?? []) as Record<string, unknown>[];
    return Promise.all(
      rows.map(async (r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      slug: String(r.slug ?? ""),
      description: (r.description as string | null) ?? null,
      avatarUrl: await sign("circle-avatars", r.avatar_url),
      coverUrl: await sign("circle-covers", r.cover_url),
      category: String(r.category ?? "Community"),
      emoji: String(r.emoji ?? "◎"),
      bannerHue: String(r.banner_hue ?? "#E5484D"),
      avatarHue: String(r.avatar_hue ?? "#E5484D"),
      createdAt: String(r.created_at ?? new Date().toISOString()),
      memberCount: Number(r.member_count ?? 0),
      postCount: Number(r.post_count ?? 0),
      })),
    );
  },
);

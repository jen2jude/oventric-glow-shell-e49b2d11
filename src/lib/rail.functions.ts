import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imageStorage } from "@/lib/storage/images.server";

function serverPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function signAvatar(
  sb: ReturnType<typeof serverPublicClient>,
  paths: (string | null)[],
): Promise<(string | null)[]> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return paths.map(() => null);
  const { data } = await (await imageStorage()).from("avatars").createSignedUrls(unique, 60 * 60 * 24 * 7);
  const map = new Map<string, string>();
  (data ?? []).forEach((r) => { if (r.path && r.signedUrl) map.set(r.path, r.signedUrl); });
  return paths.map((p) => (p ? map.get(p) ?? null : null));
}

export interface BirthdayPerson {
  userId: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
}

export const getBirthdaysToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BirthdayPerson[]> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // People I follow (or are in my circle_requests accepted)
    const [followsRes, circleRes] = await Promise.all([
      supabaseAdmin.from("follows").select("followee_id").eq("follower_id", userId),
      supabaseAdmin.from("circle_requests").select("target_slug").eq("requester_id", userId).eq("status", "accepted"),
    ]);
    const followeeIds = new Set<string>((followsRes.data ?? []).map((r) => r.followee_id as string));

    // Resolve circle target_slugs -> user_ids
    const slugs = (circleRes.data ?? []).map((r) => r.target_slug as string).filter(Boolean);
    if (slugs.length > 0) {
      const { data: slugRows } = await supabaseAdmin
        .from("profiles")
        .select("user_id, slug")
        .in("slug", slugs);
      (slugRows ?? []).forEach((p) => followeeIds.add(p.user_id as string));
    }
    if (followeeIds.size === 0) return [];

    const today = new Date();
    const m = today.getUTCMonth() + 1;
    const d = today.getUTCDate();

    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("user_id, slug, display_name, username, avatar_path, date_of_birth")
      .in("user_id", Array.from(followeeIds))
      .not("date_of_birth", "is", null);

    const matching = (rows ?? []).filter((p) => {
      const dob = p.date_of_birth as string | null;
      if (!dob) return false;
      const dt = new Date(dob);
      return dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
    });
    if (matching.length === 0) return [];

    const sb = serverPublicClient();
    const avatars = await signAvatar(sb, matching.map((p) => (p.avatar_path as string) ?? null));

    return matching.map((p, i) => ({
      userId: p.user_id as string,
      slug: p.slug as string,
      name: (p.display_name || p.username || p.slug) as string,
      avatarUrl: avatars[i],
    }));
  });

export interface OnlinePerson {
  userId: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  stars: number;
}

const IdsInput = z.object({ userIds: z.array(z.string().uuid()).max(50) });

export const getProfilesLite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdsInput.parse(input))
  .handler(async ({ data, context }): Promise<OnlinePerson[]> => {
    if (data.userIds.length === 0) return [];
    const { userId: me } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("user_id, slug, display_name, username, avatar_path, reputation_stars")
      .in("user_id", data.userIds);
    const filtered = (rows ?? []).filter((r) => r.user_id !== me);
    const sb = serverPublicClient();
    const avatars = await signAvatar(sb, filtered.map((p) => (p.avatar_path as string) ?? null));
    return filtered.map((p, i) => ({
      userId: p.user_id as string,
      slug: p.slug as string,
      name: (p.display_name || p.username || p.slug) as string,
      avatarUrl: avatars[i],
      stars: Number(p.reputation_stars ?? 0),
    }));
  });

const WishInput = z.object({
  recipientId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});

export const sendBirthdayWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WishInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: userId,
      recipient_id: data.recipientId,
      body: `🎂 ${data.body}`,
    });
    if (error) throw new Error("Failed to send wish");
    return { ok: true };
  });

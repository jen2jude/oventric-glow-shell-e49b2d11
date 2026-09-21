import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stableImageUrl, stableImageUrls } from "@/lib/storage/stable-image";

export interface TopUser {
  userId: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  reputationStars: number;
}

export const getTopUsers = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ users: TopUser[] }> => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, slug, avatar_path, reputation_stars")
      .order("reputation_stars", { ascending: false })
      .limit(5);

    if (error) {
      console.error("[getTopUsers] failed", error);
      return { users: [] };
    }

    const users = await Promise.all((data || []).map(async (row) => {
      let avatarUrl = null;
      if (row.avatar_path) avatarUrl = stableImageUrl("avatars", row.avatar_path);
      return {
        userId: row.user_id,
        displayName: row.display_name || row.slug,
        slug: row.slug,
        avatarUrl,
        reputationStars: Number(row.reputation_stars || 0),
      };
    }));

    return { users };
  });

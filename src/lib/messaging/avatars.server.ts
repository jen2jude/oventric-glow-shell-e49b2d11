import type { SupabaseClient } from "@supabase/supabase-js";
import { imageStorage } from "@/lib/storage/images.server";
import { isStableBucket, stableImageUrl, stableImageUrls } from "@/lib/storage/stable-image";

/**
 * Batch-sign avatar storage paths into usable image URLs.
 * Returns a map of storage path -> signed URL.
 */
export async function signAvatars(
  supabase: SupabaseClient<any, any, any>,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  for (const p of unique) {
    const url = stableImageUrl("avatars", p);
    if (url) map.set(p, url);
  }
  return map;
}

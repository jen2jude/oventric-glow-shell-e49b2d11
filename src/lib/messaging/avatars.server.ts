import type { SupabaseClient } from "@supabase/supabase-js";
import { imageStorage } from "@/lib/storage/images.server";

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
  if (!unique.length) return map;
  const { data: signed } = await (await imageStorage()).from("avatars")
    .createSignedUrls(unique, 60 * 60 * 6);
  (signed ?? []).forEach((s) => {
    if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
  });
  return map;
}

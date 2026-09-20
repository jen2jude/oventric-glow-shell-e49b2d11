/**
 * Server-side image signing.
 *
 * Profile, shop and product imagery lives in private buckets. Storage read
 * policies are bound to the file owner, so public pages can no longer sign
 * other people's images with the publishable key — every server-rendered
 * image URL is signed here with the service-role client instead.
 */
export async function imageStorage() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin.storage;
}

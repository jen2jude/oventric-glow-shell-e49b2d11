import { createFileRoute } from "@tanstack/react-router";
import { STABLE_IMAGE_BUCKETS } from "@/lib/storage/stable-image";

/**
 * Stable, never-expiring image URL used by social link previews and by every
 * public-facing image in the app. Because the address never changes, browsers
 * and the edge cache can reuse the bytes instead of re-downloading a freshly
 * signed URL on each page load.
 *
 * /api/public/img/<bucket>/<object path>
 */
export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const splat = String((params as Record<string, string>)._splat ?? "");
        const [bucket, ...rest] = splat.split("/");
        const path = rest.map((s) => decodeURIComponent(s)).join("/");
        if (!bucket || !path || !STABLE_IMAGE_BUCKETS.has(bucket)) {
          return new Response("Not found", { status: 404 });
        }
        // The object at a given path is treated as immutable content, so a
        // path-derived ETag lets repeat visits finish with a cheap 304.
        const etag = `"${bucket}/${path}"`;
        if (request.headers.get("if-none-match") === etag) {
          return new Response(null, {
            status: 304,
            headers: { etag, "cache-control": "public, max-age=31536000, immutable" },
          });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
          if (error || !data) return new Response("Not found", { status: 404 });
          // Stream the blob straight through instead of buffering it in memory.
          return new Response(data.stream(), {
            status: 200,
            headers: {
              "content-type": data.type || "image/jpeg",
              "cache-control": "public, max-age=31536000, immutable",
              etag,
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});

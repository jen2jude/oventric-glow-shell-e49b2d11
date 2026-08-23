import { createFileRoute } from "@tanstack/react-router";

/**
 * Stable, never-expiring image URL for social link previews.
 * /api/public/img/<bucket>/<object path>
 * Only whitelisted public-preview buckets are served.
 */
const ALLOWED = new Set(["blog-covers", "product-covers", "avatars", "profile-covers"]);

export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = String((params as Record<string, string>)._splat ?? "");
        const [bucket, ...rest] = splat.split("/");
        const path = rest.join("/");
        if (!bucket || !path || !ALLOWED.has(bucket)) {
          return new Response("Not found", { status: 404 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
          if (error || !data) return new Response("Not found", { status: 404 });
          const buf = await data.arrayBuffer();
          return new Response(buf, {
            status: 200,
            headers: {
              "content-type": data.type || "image/jpeg",
              "cache-control": "public, max-age=31536000, immutable",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});

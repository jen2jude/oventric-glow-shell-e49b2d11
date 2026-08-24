import { createFileRoute } from "@tanstack/react-router";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export const Route = createFileRoute("/api/public/p/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = params.id;
        const origin = new URL(request.url).origin;
        let destination = `${origin}/product/${encodeURIComponent(id)}`;

        let title = "Product · Oventric Marketplace";
        let description = "Buy on Oventric's marketplace.";
        let image: string | null = null;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          const base = supabaseAdmin
            .from("products")
            .select("slug, name, description, vendor, cover_path, image_paths, kind");
          const { data: row } = isUuid
            ? await base.eq("id", id).maybeSingle()
            : await base.eq("slug", id).maybeSingle();
          if (row) {
            const r = row as Record<string, unknown>;
            const rowSlug = typeof r.slug === "string" && r.slug ? r.slug : null;
            if (rowSlug) destination = `${origin}/product/${encodeURIComponent(rowSlug)}`;
            const name = typeof r.name === "string" ? r.name : "";
            const vendor = typeof r.vendor === "string" ? r.vendor : "";
            const desc = typeof r.description === "string" ? r.description : "";
            if (name) title = `${name}${vendor ? ` — ${vendor}` : ""} · Oventric`;
            if (desc) description = desc.slice(0, 200);

            const coverPath = typeof r.cover_path === "string" && r.cover_path ? r.cover_path : null;
            const imagePaths = Array.isArray(r.image_paths) ? (r.image_paths as unknown[]).filter((v): v is string => typeof v === "string") : [];
            const path = coverPath ?? imagePaths[0] ?? null;
            if (path) {
              const { data: signed } = await supabaseAdmin
                .storage
                .from("product-covers")
                .createSignedUrl(path, 60 * 60 * 24 * 7);
              if (signed?.signedUrl) image = signed.signedUrl;
            }
          }
        } catch {
          // fall through with defaults
        }

        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:type" content="product" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(destination)}" />
${image ? `<meta property="og:image" content="${esc(image)}" />\n<meta property="og:image:secure_url" content="${esc(image)}" />\n<meta name="twitter:image" content="${esc(image)}" />` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta http-equiv="refresh" content="0; url=${esc(destination)}" />
<link rel="canonical" href="${esc(destination)}" />
</head>
<body>
<script>window.location.replace(${JSON.stringify(destination)});</script>
<p>Redirecting to <a href="${esc(destination)}">${esc(destination)}</a>…</p>
</body>
</html>`;

        return new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});

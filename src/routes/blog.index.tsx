import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Share2 } from "lucide-react";
import { listBlogPosts, type BlogListItem } from "@/lib/blog.functions";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { ShareSheet } from "@/components/oventric/ShareSheet";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Oventric" },
      { name: "description", content: "Long-form technical writing from the Oventric network." },
      { property: "og:title", content: "Blog — Oventric" },
      {
        property: "og:description",
        content: "Long-form technical writing from the Oventric network.",
      },
      { property: "og:url", content: "https://oventric.com/blog" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const listFn = useServerFn(listBlogPosts);
  const loadProfile = useServerFn(getMyFullProfile);
  const { isAuthenticated } = useAuthGate();
  const [rows, setRows] = useState<BlogListItem[] | null>(null);
  const [shareItem, setShareItem] = useState<BlogListItem | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    listFn()
      .then((r) => setRows(r.posts))
      .catch(() => setRows([]));
  }, [listFn]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAvatarUrl(null);
      setName("");
      return;
    }
    let cancelled = false;
    loadProfile()
      .then((r) => {
        if (cancelled || !r?.profile) return;
        setAvatarUrl(r.profile.avatarUrl ?? null);
        setName(r.profile.displayName || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loadProfile]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <PublicChrome lightDesktop hubMobileHeader avatarUrl={avatarUrl} name={name}>
      <div className="min-h-screen bg-[#0b0b0d] md:bg-white text-slate-200 md:text-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <header className="mb-8">
            <h1 className="text-white md:text-slate-900 text-4xl font-black">Oventric Journal</h1>
            <p className="text-slate-400 md:text-slate-600 mt-2">
              Stories, playbooks, and signals for Africa's builder economy.
            </p>
          </header>
          {!rows ? (
            <div className="flex justify-center p-10">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-slate-500 p-12">
              No articles published yet. Check back soon.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((p) => (
                <div
                  key={p.id}
                  className="relative group bg-[#141418] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm rounded-xl overflow-hidden hover:border-emerald-500/40 md:hover:border-emerald-500/40 md:hover:shadow-md transition"
                >
                  <Link to="/blog/$slug" params={{ slug: p.slug }} className="block">
                    <div className="aspect-video bg-black/50 md:bg-slate-100 overflow-hidden">
                      {p.cover_url ? (
                        <ResponsiveImage
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          src={p.cover_url}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                        />
                      ) : null}
                    </div>
                    <div className="p-4">
                      {p.category_name && (
                        <div className="text-[10px] uppercase tracking-wider text-emerald-400 md:text-emerald-600 font-bold mb-1">
                          Blog · {p.category_name}
                        </div>
                      )}
                      <h2 className="text-white md:text-slate-900 font-bold leading-tight line-clamp-2">
                        {p.title}
                      </h2>
                      <p className="mt-2 text-sm text-slate-400 md:text-slate-600 line-clamp-3">
                        {p.excerpt}
                      </p>
                      <div className="mt-3 text-[11px] text-slate-500">
                        {p.author_name} ·{" "}
                        {p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShareItem(p);
                    }}
                    className="absolute top-2 right-2 p-2 rounded-full bg-black md:bg-white border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700 hover:text-white md:hover:text-slate-900 hover:bg-black md:hover:bg-white"
                    aria-label="Share article"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <ShareSheet
          open={!!shareItem}
          onClose={() => setShareItem(null)}
          url={shareItem ? `${origin}/blog/${shareItem.slug}` : ""}
          title={shareItem?.title ?? "Oventric Blog"}
          text={shareItem?.excerpt || undefined}
        />
      </div>
    </PublicChrome>
  );
}

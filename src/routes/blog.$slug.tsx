import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowLeft, Share2, MessageSquare, Send, Flag } from "lucide-react";
import {
  getBlogPost,
  listBlogComments,
  addBlogComment,
  setBlogReaction,
  type BlogDetail,
  type BlogReaction,
} from "@/lib/blog.functions";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { REACTION_META } from "@/components/oventric/feed/Reactions";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { ReportModal } from "@/components/oventric/ReportModal";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { ShareSheet } from "@/components/oventric/ShareSheet";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/blog/$slug")({
  // Run loader + head on the server so crawlers get real preview tags,
  // while the page itself still hydrates/renders on the client.
  ssr: "data-only",
  loader: async ({ params }) => {
    try {
      const r = await getBlogPost({ data: { slug: params.slug } });
      const p = r.post;
      return p
        ? {
            title: p.title,
            description: p.excerpt || "Read this article on the Oventric Blog.",
            image: p.cover_path
              ? `https://oventric.com/api/public/img/blog-covers/${p.cover_path}`
              : null,
          }
        : null;
    } catch {
      return null;
    }
  },
  head: ({ params, loaderData }) => {
    const url = `https://oventric.com/blog/${params.slug}`;
    const title = loaderData?.title ? `${loaderData.title} — Oventric Blog` : "Oventric Blog";
    const description = loaderData?.description ?? "Read this article on the Oventric Blog.";
    const image = loaderData?.image;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: loaderData?.title
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: loaderData.title,
                description,
                url,
                mainEntityOfPage: url,
                ...(image ? { image } : {}),
                publisher: { "@id": "https://oventric.com/#organization" },
              }),
            },
          ]
        : [],
    };
  },
  component: BlogArticle,
});

type Comment = {
  id: string;
  post_id: string;
  author_name: string;
  initials: string;
  text: string;
  created_at: string;
};

function BlogArticle() {
  const { slug } = useParams({ from: "/blog/$slug" });
  const { require } = useOnboarding();
  const getFn = useServerFn(getBlogPost);
  const listCmtFn = useServerFn(listBlogComments);
  const addCmtFn = useServerFn(addBlogComment);
  const reactFn = useServerFn(setBlogReaction);
  const loadProfile = useServerFn(getMyFullProfile);
  const { isAuthenticated } = useAuthGate();

  const [post, setPost] = useState<BlogDetail | null | undefined>(undefined);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; author: string } | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState<string>("");

  const refresh = useCallback(async () => {
    const r = await getFn({ data: { slug } });
    setPost(r.post);
    if (r.post) {
      const c = await listCmtFn({ data: { postId: r.post.id } });
      setComments(c.comments as any);
    }
  }, [getFn, listCmtFn, slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const openShare = () => setShareOpen(true);

  const react = (r: BlogReaction) => {
    require(1, async () => {
      if (!post) return;
      const prev = post.viewer_reaction;
      const next = prev === r ? null : r;
      setPost({
        ...post,
        viewer_reaction: next,
        reactions_count: post.reactions_count + (next ? (prev ? 0 : 1) : -1),
      });
      try {
        await reactFn({ data: { postId: post.id, reaction: next } });
      } catch {
        refresh();
      }
    }, "interaction");
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || !post) return;
    require(1, async () => {
      setPosting(true);
      try {
        await addCmtFn({ data: { postId: post.id, text } });
        setDraft("");
        const c = await listCmtFn({ data: { postId: post.id } });
        setComments(c.comments as any);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setPosting(false);
      }
    }, "interaction");
  };

  if (post === undefined) {
    return (
      <PublicChrome lightDesktop hubMobileHeader avatarUrl={avatarUrl} name={name}>
        <div className="min-h-screen bg-[#0b0b0d] md:bg-white flex justify-center pt-20">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      </PublicChrome>
    );
  }
  if (post === null) {
    return (
      <PublicChrome lightDesktop>
        <div className="min-h-screen bg-[#0b0b0d] md:bg-white text-slate-200 md:text-slate-700 flex flex-col items-center justify-center p-6">
          <p className="text-white md:text-slate-900 text-xl font-black">Article not found.</p>
          <Link
            to="/blog"
            className="mt-3 text-emerald-400 md:text-emerald-600 hover:text-emerald-300 text-sm"
          >
            ← Back to blog
          </Link>
        </div>
      </PublicChrome>
    );
  }

  return (
    <PublicChrome lightDesktop>
      <div className="min-h-screen bg-[#0b0b0d] md:bg-white text-slate-200 md:text-slate-700">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1 text-slate-400 md:text-slate-600 hover:text-white md:hover:text-slate-900 text-sm mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Blog
          </Link>
          {post.category_name && (
            <div className="text-xs uppercase tracking-wider text-emerald-400 md:text-emerald-600 font-bold mb-2">
              {post.category_name}
            </div>
          )}
          <h1 className="text-white md:text-slate-900 text-3xl sm:text-4xl font-black leading-tight">
            {post.title}
          </h1>
          <div className="mt-3 text-sm text-slate-500">
            By {post.author_name} ·{" "}
            {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}
          </div>
          {post.cover_url && (
            <ResponsiveImage
              sizes="(min-width: 768px) 768px, 100vw"
              src={post.cover_url}
              alt={post.title}
              className="w-full mt-6 rounded-xl border border-white/10 md:border-slate-200 aspect-video object-cover"
            />
          )}

          <article
            className="blog-article mt-8 text-slate-200 md:text-slate-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: post.body_html }}
          />

          {post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-1">
              {post.tags.map((t) => (
                <span
                  key={t.slug}
                  className="text-[10px] px-2 py-1 rounded-full border border-white/10 md:border-slate-200 text-slate-400 md:text-slate-600"
                >
                  #{t.name}
                </span>
              ))}
            </div>
          )}

          {/* Reactions + share */}
          <div className="mt-8 flex items-center justify-between border-t border-white/10 md:border-slate-200 pt-4">
            <div className="flex items-center gap-1">
              {(["love", "like", "laugh", "crown"] as BlogReaction[]).map((r) => {
                const Icon = REACTION_META[r].Icon;
                const on = post.viewer_reaction === r;
                return (
                  <button
                    key={r}
                    onClick={() => react(r)}
                    className={`p-2 rounded-[10px] hover:bg-white/5 md:hover:bg-slate-100 ${on ? "bg-white/5 md:bg-slate-100" : ""}`}
                    style={{ color: on ? REACTION_META[r].color : undefined }}
                    aria-label={r}
                  >
                    <Icon className={`w-5 h-5 ${on ? "fill-current" : ""}`} />
                  </button>
                );
              })}
              <span className="text-sm text-slate-400 md:text-slate-600 ml-2">
                {post.reactions_count}
              </span>
            </div>
            <button
              onClick={openShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] hover:bg-white/5 md:hover:bg-slate-100 text-slate-400 md:text-slate-600 hover:text-white md:hover:text-slate-900 text-sm"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>

          {/* Comments */}
          <section className="mt-6">
            <h2 className="text-white md:text-slate-900 text-lg font-bold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Comments ({comments.length})
            </h2>
            <div className="mt-3 flex items-start gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Write a comment…"
                className="flex-1 bg-[#141418] md:bg-white border border-white/10 md:border-slate-200 rounded-[10px] px-3 py-2 text-sm text-slate-200 md:text-slate-800 md:placeholder:text-slate-400"
              />
              <button
                onClick={submit}
                disabled={!draft.trim() || posting}
                className="px-3 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-sm inline-flex items-center gap-1"
              >
                {posting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Post
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {comments.map((c) => {
                const reported = reportedIds.has(c.id);
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black text-[10px] font-bold">
                      {c.initials}
                    </div>
                    <div className="flex-1 bg-[#141418] md:bg-slate-50 border border-white/10 md:border-slate-200 rounded-[10px] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-white md:text-slate-900">
                          {c.author_name}
                        </div>
                        <button
                          onClick={() =>
                            require(1, () =>
                              setReportTarget({ id: c.id, author: c.author_name }), "interaction")
                          }
                          disabled={reported}
                          className="text-[10px] inline-flex items-center gap-1 text-slate-500 hover:text-red-300 md:hover:text-red-600 disabled:opacity-60 disabled:hover:text-slate-500"
                          title={reported ? "Reported" : "Report comment"}
                        >
                          <Flag className="w-3 h-3" /> {reported ? "Reported" : "Report"}
                        </button>
                      </div>
                      <div className="text-sm text-slate-300 md:text-slate-700 whitespace-pre-wrap mt-0.5">
                        {c.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              {comments.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">Be the first to comment.</p>
              )}
            </div>
          </section>
        </div>

        <ShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          url={typeof window !== "undefined" ? window.location.href : ""}
          title={post.title}
          text={post.excerpt || undefined}
        />
        <ReportModal
          open={!!reportTarget}
          onClose={() => setReportTarget(null)}
          target={reportTarget ? `comment by ${reportTarget.author}` : "comment"}
          targetId={reportTarget?.id}
          targetKind="blog_comment"
          onReported={(id) => setReportedIds((s) => new Set(s).add(id))}
        />
      </div>
    </PublicChrome>
  );
}

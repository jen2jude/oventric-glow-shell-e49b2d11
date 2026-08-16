import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Heart, MessageCircle, ShoppingBag, Star } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { getTopSellers } from "@/lib/marketplace.functions";
import { listPosts, type FeedPost } from "@/lib/posts.functions";

type Variant = "light" | "dark";

type Seller = {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  verified: boolean;
  rating: number;
  followersCount: number;
  productsCount: number;
  salesCount: number;
};

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Live social-proof rails ("Top Sellers" + "From our Community") shown above the
 * fold on the homepage and the marketplace landing. Purely presentational on top
 * of existing marketplace/feed data; renders nothing until live data arrives.
 */
export function SocialProofRails({
  variant = "light",
  onOpenFeed,
  className = "",
}: {
  variant?: Variant;
  onOpenFeed?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const loadSellers = useServerFn(getTopSellers);
  const loadPosts = useServerFn(listPosts);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadSellers({ data: { kind: "all" } })
      .then((rows) => {
        if (cancelled) return;
        setSellers(
          [...(rows ?? [])]
            .sort((a, b) => b.salesCount - a.salesCount || b.followersCount - a.followersCount)
            .slice(0, 10),
        );
      })
      .catch(() => {});
    loadPosts()
      .then((r) => {
        if (cancelled) return;
        setPosts((r?.posts ?? []).filter((p) => p.text || p.media.length > 0).slice(0, 8));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadSellers, loadPosts]);

  if (sellers.length === 0 && posts.length === 0) return null;

  const dark = variant === "dark";
  const card = dark
    ? "border border-white/[0.06] bg-[#141416]"
    : "web-card border border-slate-200 bg-white";
  const title = dark ? "text-white" : "text-slate-900";
  const muted = dark ? "text-white/45" : "text-slate-500";

  return (
    <section
      aria-label="Live social proof"
      className={`${dark ? "" : "border-b border-slate-200 bg-white"} ${className}`}
    >
      <div
        className={`mx-auto w-full max-w-[1200px] ${dark ? "px-4 py-6" : "px-5 py-10 sm:px-8"} space-y-8`}
      >
        {sellers.length > 0 && (
          <div>
            <RailHead
              dark={dark}
              eyebrow="Live right now"
              heading="Top Sellers"
              action="See all"
              onAction={() => navigate({ to: "/", search: { section: "Marketplace" } as never })}
            />
            <div className="web-rail no-scrollbar mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
              {sellers.map((s, i) => (
                <Link
                  key={s.id}
                  to="/shop/$id"
                  params={{ id: s.slug || s.id }}
                  className={`group w-[220px] shrink-0 snap-start rounded-[10px] p-4 transition-transform active:scale-[0.99] ${card}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className={`h-12 w-12 overflow-hidden rounded-full ${dark ? "border border-white/10" : "border border-slate-200"}`}
                      >
                        <AvatarImage src={s.avatarUrl} alt={s.name} />
                      </div>
                      <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-crimson text-[10px] font-black text-white">
                        {i + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className={`flex items-center gap-1 truncate text-[13px] font-bold ${title}`}>
                        <span className="truncate">{s.name}</span>
                        {s.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-crimson" />}
                      </div>
                      <div className={`mt-0.5 flex items-center gap-1 text-[11px] ${muted}`}>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {s.rating ? s.rating.toFixed(1) : "New"} · {compact(s.followersCount)} followers
                      </div>
                    </div>
                  </div>
                  <div className={`mt-3 flex items-center gap-3 text-[11px] font-semibold ${muted}`}>
                    <span className="inline-flex items-center gap-1">
                      <ShoppingBag className="h-3.5 w-3.5" /> {compact(s.salesCount)} sales
                    </span>
                    <span>{compact(s.productsCount)} listings</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {posts.length > 0 && (
          <div>
            <RailHead
              dark={dark}
              eyebrow="Happening now"
              heading="From our Community"
              action="Open feed"
              onAction={onOpenFeed}
            />
            <div className="web-rail no-scrollbar mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
              {posts.map((post) => {
                const image = post.media.find((m) => m.type === "image");
                const video = post.media.find((m) => m.type === "video" && m.poster_url);
                const thumb =
                  image?.url ??
                  video?.poster_url ??
                  post.poster_url ??
                  (post.media_type === "image" ? post.media_url : null);
                return (
                  <Link
                    key={post.id}
                    to="/post/$id"
                    params={{ id: post.id }}
                    className={`w-[260px] shrink-0 snap-start overflow-hidden rounded-[10px] transition-transform active:scale-[0.99] ${card}`}
                  >
                    {thumb && (
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-[130px] w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div className="space-y-2 p-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-8 w-8 shrink-0 overflow-hidden rounded-full ${dark ? "border border-white/10" : "border border-slate-200"}`}
                        >
                          <AvatarImage src={post.author_avatar_url} alt={post.author_name} />
                        </div>
                        <div className="min-w-0">
                          <div className={`truncate text-[12px] font-bold ${title}`}>
                            {post.author_name}
                          </div>
                          <div className={`text-[11px] ${muted}`}>{timeAgo(post.created_at)} ago</div>
                        </div>
                      </div>
                      {post.text && (
                        <p
                          className={`line-clamp-2 text-[12px] leading-snug ${dark ? "text-white/70" : "text-slate-600"}`}
                        >
                          {post.text}
                        </p>
                      )}
                      <div className={`flex items-center gap-4 text-[11px] font-semibold ${muted}`}>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5" /> {compact(post.likes_count)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" /> {compact(post.comments_count)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function RailHead({
  dark,
  eyebrow,
  heading,
  action,
  onAction,
}: {
  dark: boolean;
  eyebrow: string;
  heading: string;
  action: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
            dark ? "bg-white/[0.06] text-white/60" : "border border-crimson/30 text-crimson"
          }`}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-crimson" />
          {eyebrow}
        </span>
        <h2
          className={`mt-2 text-[20px] font-bold tracking-tight sm:text-[24px] ${dark ? "text-white" : "text-slate-900"}`}
        >
          {heading}
        </h2>
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className={`shrink-0 text-[12px] font-bold ${dark ? "text-white/50 hover:text-white" : "text-slate-500 hover:text-crimson"}`}
        >
          {action}
        </button>
      )}
    </div>
  );
}

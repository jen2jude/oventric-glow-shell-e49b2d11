import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2, Play, Loader2 } from "lucide-react";
import { listPosts, toggleLike } from "@/lib/posts.functions";
import { CommentsSheet } from "@/components/oventric/feed/CommentsSheet";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";

type Post = Awaited<ReturnType<typeof listPosts>>["posts"][number];

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

/** Native app feed: full-screen snap cards, actions stacked on the right edge. */
export function AppFeed() {
  const fetchPosts = useServerFn(listPosts);
  const like = useServerFn(toggleLike);
  const navigate = useNavigate();
  const { openGate } = useAuthGate() as any;
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);

  useEffect(() => {
    fetchPosts()
      .then((r) => setPosts(r.posts.filter((p) => !p.repost_of || p.text || p.media_url)))
      .catch(() => setPosts([]));
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, [fetchPosts]);

  const onLike = async (p: Post) => {
    if (!signedIn) return openGate?.("social");
    haptic("select");
    const next = !p.viewer_liked;
    setPosts((xs) =>
      xs!.map((x) =>
        x.id === p.id ? { ...x, viewer_liked: next, likes_count: x.likes_count + (next ? 1 : -1) } : x,
      ),
    );
    try {
      await like({ data: { postId: p.id, like: next } });
    } catch {
      setPosts((xs) =>
        xs!.map((x) =>
          x.id === p.id ? { ...x, viewer_liked: !next, likes_count: x.likes_count + (next ? -1 : 1) } : x,
        ),
      );
    }
  };

  const onShare = async (p: Post) => {
    const url = `${window.location.origin}/post/${p.id}`;
    haptic("light");
    try {
      if (navigator.share) await navigator.share({ title: p.author_name, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* dismissed */
    }
  };

  if (!posts) {
    return (
      <div className="flex h-[calc(100dvh-80px)] items-center justify-center bg-[#070A08]">
        <Loader2 className="h-6 w-6 animate-spin text-[#E5484D]" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-80px)] items-center justify-center bg-[#070A08] px-8 text-center text-[13px] text-white/50">
        No posts yet — tap + to share the first one.
      </div>
    );
  }

  return (
    <div className="relative bg-[#070A08]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-[max(env(safe-area-inset-top),12px)]">
        <span className="rounded-full bg-black/40 px-3 py-1 text-[12px] font-semibold tracking-wide backdrop-blur" style={{ color: "#ffffff" }}>
          For you
        </span>
      </div>
      <div className="h-[calc(100dvh-80px)] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]">
        {posts.map((p) => {
          const img = p.media_type === "video" ? p.poster_url : p.media_url;
          return (
            <section key={p.id} className="relative h-[calc(100dvh-80px)] w-full snap-start overflow-hidden">
              {img ? (
                <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center bg-gradient-to-br from-[#2A0E10] via-[#110A0B] to-[#070A08] px-8">
                  <p className="line-clamp-[10] text-[22px] font-semibold leading-snug" style={{ color: "#ffffff" }}>
                    {p.text}
                  </p>
                </div>
              )}
              {p.media_type === "video" && (
                <button
                  onClick={() => navigate({ to: "/post/$id", params: { id: p.id } })}
                  className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 backdrop-blur"
                  aria-label="Play video"
                >
                  <Play className="h-7 w-7 fill-current" style={{ color: "#ffffff" }} />
                </button>
              )}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

              {/* Right action rail */}
              <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-5">
                <button
                  onClick={() =>
                    p.author_slug || p.author_id
                      ? navigate({ to: "/profile/$id", params: { id: p.author_slug ?? p.author_id } })
                      : undefined
                  }
                  className="h-11 w-11 overflow-hidden rounded-full ring-2 ring-[#E5484D]"
                  aria-label={`Open ${p.author_name}`}
                >
                  {p.author_avatar_url ? (
                    <img src={p.author_avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[#E5484D] text-[13px] font-bold" style={{ color: "#ffffff" }}>
                      {p.initials}
                    </span>
                  )}
                </button>
                <Action label={compact(p.likes_count)} onClick={() => onLike(p)} aria="Like">
                  <Heart className={`h-7 w-7 ${p.viewer_liked ? "fill-[#E5484D] text-[#E5484D]" : ""}`} style={p.viewer_liked ? undefined : { color: "#ffffff" }} />
                </Action>
                <Action label={compact(p.comments_count)} onClick={() => setCommentsFor(p)} aria="Comments">
                  <MessageCircle className="h-7 w-7" style={{ color: "#ffffff" }} />
                </Action>
                <Action label="Share" onClick={() => onShare(p)} aria="Share">
                  <Share2 className="h-7 w-7" style={{ color: "#ffffff" }} />
                </Action>
              </div>

              {/* Caption */}
              <div className="absolute bottom-6 left-4 right-20 z-10">
                <p className="text-[14px] font-bold" style={{ color: "#ffffff" }}>
                  {p.author_name} <span className="font-normal text-white/50">· {ago(p.created_at)}</span>
                </p>
                {img && p.text && (
                  <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-white/85">{p.text}</p>
                )}
                {p.product_attachments?.[0] && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#E5484D]/90 px-2.5 py-1 text-[11px] font-semibold" style={{ color: "#ffffff" }}>
                    Shop this post
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {commentsFor && (
        <CommentsSheet
          postId={commentsFor.id}
          postAuthorName={commentsFor.author_name}
          onClose={() => setCommentsFor(null)}
          viewerName="You"
          viewerInitials="OV"
        />
      )}
    </div>
  );
}

function Action({
  children,
  label,
  onClick,
  aria,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  aria: string;
}) {
  return (
    <button onClick={onClick} aria-label={aria} className="flex flex-col items-center gap-1 drop-shadow-lg active:scale-90 transition-transform">
      {children}
      <span className="text-[11px] font-semibold" style={{ color: "#ffffff" }}>
        {label}
      </span>
    </button>
  );
}

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Heart, MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listPosts, deletePost as deletePostFn, type FeedPost } from "@/lib/posts.functions";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { PostActionsMenu, shareUrl } from "@/components/oventric/PostActionsMenu";
import { ReportModal } from "@/components/oventric/ReportModal";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function CommunityRail({ onOpenFeed }: { onOpenFeed: () => void }) {
  const loadPosts = useServerFn(listPosts);
  const deletePost = useServerFn(deletePostFn);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPosts()
      .then((r) => {
        if (cancelled) return;
        setPosts((r?.posts ?? []).filter((p) => p.text || p.media.length > 0).slice(0, 8));
      })
      .catch(() => {});
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!cancelled) setMeId(data.user?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadPosts]);

  if (posts.length === 0) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {posts.map((post) => {
          const imageItem = post.media.find((m) => m.type === "image");
          const videoItem = post.media.find((m) => m.type === "video" && m.poster_url);
          const thumb =
            imageItem?.url ??
            videoItem?.poster_url ??
            post.poster_url ??
            (post.media_type === "image" ? post.media_url : null);
          return (
            <div
              key={post.id}
              className="shrink-0 w-[280px] snap-start rounded-[16px] border border-white/[0.06] bg-[#141416] p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/profile/$id"
                  params={{ id: post.author_slug || post.author_id }}
                  className="flex items-center gap-2 min-w-0"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 shrink-0">
                    <AvatarImage src={post.author_avatar_url} alt={post.author_name} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[12.5px] font-bold text-white truncate hover:text-[#E5484D] transition-colors">
                        {post.author_name}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-white/30 truncate">
                      {timeAgo(post.created_at)}
                    </span>
                  </div>
                </Link>

                <div className="shrink-0">
                  <PostActionsMenu
                    postId={post.id}
                    shareTitle={`${post.author_name} on Oventric`}
                    shareHref={`${origin}/#post-${post.id}`}
                    onReport={() => setReportOpen(post.id)}
                    isOwn={!!meId && meId === post.author_id}
                    onDelete={() => {
                      if (typeof window !== "undefined" && !window.confirm("Delete this post?")) return;
                      deletePost({ data: { id: post.id } })
                        .then(() => setPosts((prev) => prev.filter((p) => p.id !== post.id)))
                        .catch(() => {});
                    }}
                  />
                </div>
              </div>

              <button type="button" onClick={onOpenFeed} className="w-full flex items-start gap-3 text-left">
                {post.text ? (
                  <p className="flex-1 min-w-0 text-[12.5px] leading-relaxed text-white/80 line-clamp-4">
                    {post.text}
                  </p>
                ) : null}
                {thumb ? (
                  <span className="shrink-0 w-16 h-16 rounded-[10px] overflow-hidden bg-[#1A1A1F] border border-white/5">
                    <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </span>
                ) : null}
              </button>

              <div className="flex items-center gap-5 pt-0.5">
                <div className="flex items-center gap-1.5 text-white/40">
                  <Heart
                    className={`w-4 h-4 ${post.viewer_liked ? "fill-[#E5484D] text-[#E5484D]" : ""}`}
                  />
                  <span className="text-[11px] font-bold tabular-nums">{post.likes_count}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/40">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[11px] font-bold tabular-nums">{post.comments_count}</span>
                </div>
                <button
                  type="button"
                  onClick={() => shareUrl(`${origin}/#post-${post.id}`, `${post.author_name} on Oventric`)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ReportModal
        open={!!reportOpen}
        onClose={() => setReportOpen(null)}
        target="post"
        targetId={reportOpen ?? undefined}
        targetKind="post"
      />
    </>
  );
}

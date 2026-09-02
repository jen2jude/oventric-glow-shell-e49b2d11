import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  PenSquare,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import {
  listWallPosts as listWallPostsFn,
  setReaction as setReactionFn,
  deletePost as deletePostFn,
  type FeedPost,
  type ReactionType,
} from "@/lib/posts.functions";
import { supabase } from "@/integrations/supabase/client";
import { PostComposerModal } from "@/components/oventric/PostComposerModal";
import { CommentsSheet } from "@/components/oventric/feed/CommentsSheet";
import {
  ReactionPicker,
  ReactionButton,
  REACTION_META,
} from "@/components/oventric/feed/Reactions";
import { TruncatedText } from "@/components/oventric/feed/TruncatedText";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { ProductAttachmentCard } from "@/components/oventric/feed/ProductAttachmentCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  /** Owner of the wall being viewed. */
  wallUserId: string;
  wallOwnerName: string;
  viewerId: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The profile "Posts" tab: one live wall feed with a newsfeed-style composer
 * on top. Reactions, comments and sharing use the same wiring as the wall.
 */
export function ProfilePostsFeed({ wallUserId, wallOwnerName, viewerId }: Props) {
  const listWall = useServerFn(listWallPostsFn);
  const react = useServerFn(setReactionFn);
  const del = useServerFn(deletePostFn);

  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<FeedPost | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [meAvatarUrl, setMeAvatarUrl] = useState<string | null>(null);
  const [meInitials, setMeInitials] = useState("Me");

  const isSelf = viewerId === wallUserId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listWall({ data: { wallUserId } });
      setPosts(r.posts);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [listWall, wallUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Viewer avatar for the composer row, mirroring the main newsfeed.
  useEffect(() => {
    if (!viewerId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_path")
          .eq("user_id", viewerId)
          .maybeSingle();
        const name = (prof?.display_name || prof?.username || "").trim();
        if (name && !cancelled) {
          setMeInitials(
            name
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("") || "Me",
          );
        }
        if (prof?.avatar_path) {
          const { data: signed } = await supabase.storage
            .from("avatars")
            .createSignedUrl(prof.avatar_path, 60 * 60 * 24 * 7);
          if (signed?.signedUrl && !cancelled) setMeAvatarUrl(signed.signedUrl);
        }
      } catch {
        /* avatar is decorative */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  const onReact = async (post: FeedPost, next: ReactionType | null) => {
    if (!viewerId) {
      toast.error("Sign in to react");
      return;
    }
    setPosts((cur) =>
      cur
        ? cur.map((p) => {
            if (p.id !== post.id) return p;
            const reactions = { ...p.reactions };
            if (p.viewer_reaction)
              reactions[p.viewer_reaction] = Math.max(0, reactions[p.viewer_reaction] - 1);
            if (next) reactions[next] = (reactions[next] ?? 0) + 1;
            const total = reactions.love + reactions.like + reactions.laugh + reactions.crown;
            return {
              ...p,
              reactions,
              viewer_reaction: next,
              viewer_liked: !!next,
              likes_count: total,
            };
          })
        : cur,
    );
    try {
      await react({ data: { postId: post.id, reaction: next } });
    } catch {
      void load();
    }
  };

  const onDelete = async (post: FeedPost) => {
    if (!viewerId || post.author_id !== viewerId) return;
    if (!confirm("Delete this post?")) return;
    try {
      await del({ data: { postId: post.id } });
      setPosts((cur) => (cur ? cur.filter((p) => p.id !== post.id) : cur));
    } catch (e: any) {
      toast.error(e?.message || "Couldn't delete post");
    }
  };

  const onShare = async (post: FeedPost) => {
    const url = `${window.location.origin}/profile/${wallUserId}/item/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: post.author_name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="pb-2">
      {/* Composer trigger — avatar, prompt, media shortcut */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141418] p-3 md:rounded-[10px] md:border-slate-200 md:bg-slate-50">
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-neutral-800 md:bg-slate-200">
          <AvatarImage src={meAvatarUrl} alt="Your profile" initials={meInitials} />
        </span>
        <button
          type="button"
          disabled={!viewerId}
          onClick={() => setComposerOpen(true)}
          className="min-w-0 flex-1 truncate rounded-full px-3 py-3 text-left text-sm text-slate-400 md:bg-slate-100 md:text-slate-500 disabled:opacity-60"
        >
          {!viewerId
            ? "Sign in to post"
            : isSelf
              ? "What's on your mind today?"
              : `Post on ${wallOwnerName}'s wall…`}
        </button>
        <button
          type="button"
          disabled={!viewerId}
          onClick={() => setComposerOpen(true)}
          aria-label="Add photo or video"
          className="shrink-0 rounded-full p-1.5 text-[#E5484D] disabled:opacity-60"
        >
          <ImageIcon className="h-6 w-6" strokeWidth={1.5} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading posts…
        </div>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-3">
          {posts.map((p) => {
            const meta = p.viewer_reaction ? REACTION_META[p.viewer_reaction] : null;
            return (
              <article
                key={p.id}
                className="rounded-2xl border border-white/10 bg-[#141418] md:rounded-[10px] md:border-slate-200 md:bg-white md:shadow-sm"
              >
                <header className="flex items-center gap-3 px-4 pt-4">
                  <Link
                    to="/profile/$id"
                    params={{ id: p.author_slug || p.author_id }}
                    className="block h-11 w-11 shrink-0 overflow-hidden rounded-full"
                  >
                    <AvatarImage
                      src={p.author_avatar_url}
                      alt={p.author_name}
                      initials={p.initials}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/profile/$id"
                      params={{ id: p.author_slug || p.author_id }}
                      className="block truncate text-sm font-bold text-white md:text-slate-900"
                    >
                      {p.author_name}
                    </Link>
                    <p className="text-[11px] text-slate-500">{timeAgo(p.created_at)}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-white/5 hover:text-white md:hover:bg-slate-100 md:hover:text-slate-900"
                      aria-label="Post options"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[120]">
                      <DropdownMenuItem onClick={() => void onShare(p)}>
                        Copy / share link
                      </DropdownMenuItem>
                      {p.author_id === viewerId && (
                        <DropdownMenuItem onClick={() => void onDelete(p)}>
                          Delete post
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </header>

                {p.text && (
                  <div className="px-4 pt-3">
                    <TruncatedText
                      text={p.text}
                      lines={5}
                      className="text-[15px] leading-relaxed text-slate-200 md:text-slate-800"
                    />
                  </div>
                )}

                {p.media.length > 0 && (
                  <div
                    className={`grid gap-1.5 px-4 pt-3 md:gap-2 ${
                      p.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    }`}
                  >
                    {p.media.slice(0, 4).map((m, i) => (
                      <div key={i} className="overflow-hidden rounded-xl bg-black/40">
                        {m.type === "video" ? (
                          <video
                            src={`${m.url}#t=0.1`}
                            poster={m.poster_url || undefined}
                            preload="metadata"
                            controls
                            playsInline
                            className="max-h-[420px] w-full object-cover"
                          />
                        ) : (
                          <img loading="lazy" decoding="async"
                            src={m.url}
                            alt=""
                            className="max-h-[420px] w-full object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {p.product_attachments && p.product_attachments.length > 0 && (
                  <div className="px-4">
                    {p.product_attachments.map((pa) => (
                      <ProductAttachmentCard key={pa.id} product={pa} />
                    ))}
                  </div>
                )}



                <footer className="flex items-center gap-5 px-4 py-3">
                  <div className="relative flex items-center gap-2">
                    {pickerFor === p.id && (
                      <ReactionPicker
                        onPick={(r) => {
                          setPickerFor(null);
                          void onReact(p, r === p.viewer_reaction ? null : r);
                        }}
                        onClose={() => setPickerFor(null)}
                      />
                    )}
                    <ReactionButton
                      reaction={p.viewer_reaction ?? "love"}
                      size="sm"
                      ariaLabel="React"
                      onClick={() => setPickerFor(pickerFor === p.id ? null : p.id)}
                    />
                    <span
                      className="text-sm font-semibold text-slate-400"
                      style={meta ? { color: meta.color } : undefined}
                    >
                      {p.likes_count}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCommentsFor(p)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white md:hover:text-slate-900"
                  >
                    <MessageCircle className="h-5 w-5" aria-hidden />
                    {p.comments_count}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onShare(p)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white md:hover:text-slate-900"
                  >
                    <Share2 className="h-5 w-5" aria-hidden />
                    Share
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#141418] p-8 text-center md:border-slate-200 md:bg-white md:shadow-sm">
          <p className="text-sm text-slate-400 md:text-slate-500">
            {isSelf ? "Your wall is empty. Drop the first post." : `${wallOwnerName}'s wall is empty.`}
          </p>
          {viewerId && (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#C43D42]"
            >
              <PenSquare className="h-3.5 w-3.5" /> Write a post
            </button>
          )}
        </div>
      )}

      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={async () => {
          setComposerOpen(false);
          await load();
        }}
        wallUserId={wallUserId}
        wallOwnerName={wallOwnerName}
      />
      {commentsFor && (
        <CommentsSheet
          postId={commentsFor.id}
          postAuthorName={commentsFor.author_name}
          onClose={() => {
            setCommentsFor(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

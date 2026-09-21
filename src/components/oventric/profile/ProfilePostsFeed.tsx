import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Image as ImageIcon,
  Loader2,
  MessageCircle,
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
import { PostActionsMenu, shareUrl } from "@/components/oventric/PostActionsMenu";
import { ReportModal } from "@/components/oventric/ReportModal";
import { ImageLightbox } from "@/components/oventric/feed/ImageLightbox";

interface Props {
  /** Owner of the wall being viewed. */
  wallUserId: string;
  wallOwnerName: string;
  viewerId: string | null;
  showComposer?: boolean;
  limit?: number;
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
export function ProfilePostsFeed({
  wallUserId,
  wallOwnerName,
  viewerId,
  showComposer = true,
  limit,
}: Props) {
  const listWall = useServerFn(listWallPostsFn);
  const react = useServerFn(setReactionFn);
  const del = useServerFn(deletePostFn);

  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<FeedPost | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
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

  const visiblePosts = typeof limit === "number" ? posts?.slice(0, limit) : posts;

  return (
    <div className="pb-2">
      {/* Composer trigger — avatar, prompt, media shortcut */}
      {showComposer && <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141418] p-3 md:rounded-[10px] md:border-slate-200 md:bg-slate-50">
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
      </div>}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading posts…
        </div>
      ) : visiblePosts && visiblePosts.length > 0 ? (
        <div className="space-y-3">
          {visiblePosts.map((p) => {
            const meta = p.viewer_reaction ? REACTION_META[p.viewer_reaction] : null;
            const shareHref = `${typeof window !== "undefined" ? window.location.origin : ""}/profile/${wallUserId}/item/post/${p.id}`;
            const images = p.media.filter((item) => item.type === "image");
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
                  <PostActionsMenu
                    postId={p.id}
                    shareTitle={`${p.author_name} on Oventric`}
                    shareHref={shareHref}
                    onReport={() => setReportFor(p.id)}
                    isOwn={p.author_id === viewerId}
                    onDelete={() => void onDelete(p)}
                    authorId={p.author_id}
                    authorName={p.author_name}
                  />
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

                {p.mentions.length > 0 && (
                  <div className="px-4 pt-2 text-xs text-slate-500">
                    With{" "}
                    {p.mentions.map((mention, index) => (
                      <span key={mention.user_id}>
                        {index > 0 ? ", " : ""}
                        <Link
                          to="/profile/$id"
                          params={{ id: mention.slug || mention.user_id }}
                          className="font-semibold text-[#E5484D] hover:underline"
                        >
                          {mention.name}
                        </Link>
                      </span>
                    ))}
                  </div>
                )}

                {images.length > 0 && (
                  <div
                    className={`grid gap-1.5 px-4 pt-3 md:gap-2 ${
                      images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    }`}
                  >
                    {images.slice(0, 4).map((m, i) => (
                      <button
                        type="button"
                        key={`${m.url}-${i}`}
                        onClick={() => setLightbox({ images: images.map((item) => item.url), index: i })}
                        className="relative overflow-hidden rounded-xl bg-black/40 text-left"
                        aria-label={`Open image ${i + 1} of ${images.length}`}
                      >
                        <img loading="lazy" decoding="async"
                          src={m.url}
                          alt=""
                          className={`w-full object-cover ${images.length === 1 ? "max-h-[520px]" : "aspect-square"}`}
                        />
                        {images.length > 4 && i === 3 && (
                          <span className="absolute inset-0 grid place-items-center bg-black/55 text-xl font-bold text-white">
                            +{images.length - 4}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {p.media.filter((item) => item.type === "video").map((m, i) => (
                  <div key={`${m.url}-${i}`} className="px-4 pt-3">
                    <video
                      src={`${m.url}#t=0.1`}
                      poster={m.poster_url || undefined}
                      preload={m.poster_url ? "none" : "metadata"}
                      controls
                      playsInline
                      className="max-h-[520px] w-full rounded-xl bg-black object-cover"
                    />
                  </div>
                ))}

                {p.product_attachments && p.product_attachments.length > 0 && (
                  <div className="px-4">
                    {p.product_attachments.map((pa) => (
                      <ProductAttachmentCard key={pa.id} product={pa} />
                    ))}
                  </div>
                )}

                {p.repost_of && (
                  <div className="mx-4 mt-3 rounded-[10px] border border-white/10 p-3 md:border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                        <AvatarImage
                          src={p.repost_of.author_avatar_url}
                          alt={p.repost_of.author_name}
                          initials={p.repost_of.initials}
                        />
                      </span>
                      <span className="min-w-0 truncate text-xs font-bold text-white md:text-slate-900">
                        {p.repost_of.author_name}
                      </span>
                    </div>
                    {p.repost_of.text && (
                      <TruncatedText
                        text={p.repost_of.text}
                        lines={3}
                        className="mt-2 text-sm leading-relaxed text-slate-300 md:text-slate-700"
                      />
                    )}
                  </div>
                )}

                {(p.likes_count > 0 || p.comments_count > 0 || p.reposts_count > 0 || p.views_count > 0) && (
                  <div className="mx-4 mt-3 flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-500 md:border-slate-100">
                    <span>{p.likes_count} reaction{p.likes_count === 1 ? "" : "s"}</span>
                    <span>
                      {p.comments_count} comment{p.comments_count === 1 ? "" : "s"}
                      {p.reposts_count > 0 ? ` · ${p.reposts_count} repost${p.reposts_count === 1 ? "" : "s"}` : ""}
                    </span>
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
                    onClick={() => void shareUrl(shareHref, `${p.author_name} on Oventric`)}
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
          {showComposer && viewerId && (
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
      <ReportModal
        open={!!reportFor}
        onClose={() => setReportFor(null)}
        target="post"
        targetId={reportFor ?? undefined}
        targetKind="post"
      />
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Heart, MessageCircle, Loader2, PenSquare, Lock } from "lucide-react";
import {
  listWallPosts as listWallPostsFn,
  canPostOnWall as canPostOnWallFn,
  setReaction as setReactionFn,
  deletePost as deletePostFn,
  type FeedPost,
  type ReactionType,
} from "@/lib/posts.functions";
import { PostComposerModal } from "./PostComposerModal";
import { CommentsSheet } from "./feed/CommentsSheet";
import { ReactionPicker, ReactionButton, REACTION_META } from "./feed/Reactions";
import { TruncatedText } from "./feed/TruncatedText";
import { AvatarImage } from "./AvatarImage";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

interface Props {
  wallUserId: string;
  wallOwnerName: string;
  viewerId: string | null;
  viewerName?: string;
  viewerInitials?: string;
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

export function ProfileWall({
  wallUserId,
  wallOwnerName,
  viewerId,
  viewerName,
  viewerInitials,
}: Props) {
  const listWall = useServerFn(listWallPostsFn);
  const checkCanPost = useServerFn(canPostOnWallFn);
  const react = useServerFn(setReactionFn);
  const del = useServerFn(deletePostFn);

  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<null | { ok: boolean; reason: string }>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<FeedPost | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listWall({ data: { wallUserId } });
      setPosts(r.posts);
    } catch (e) {
      console.error("[ProfileWall] load", e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [listWall, wallUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!viewerId) {
      setAllowed({ ok: false, reason: "signed_out" });
      return;
    }
    checkCanPost({ data: { wallUserId } })
      .then((r) => setAllowed({ ok: r.allowed, reason: r.reason }))
      .catch(() => setAllowed({ ok: false, reason: "error" }));
  }, [checkCanPost, viewerId, wallUserId]);

  const isSelf = viewerId === wallUserId;

  const cta = useMemo(() => {
    if (!viewerId) return { label: "Sign in to post", disabled: true, hint: null as string | null };
    const label = isSelf ? "Post on your wall" : `Post on ${wallOwnerName}'s wall`;
    return { label, disabled: false, hint: null as string | null };
  }, [isSelf, viewerId, wallOwnerName]);

  const onReact = async (post: FeedPost, next: ReactionType | null) => {
    if (!viewerId) {
      toast.error("Sign in to react");
      return;
    }
    // Optimistic
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

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-white md:text-slate-900">
          {isSelf ? "Your wall" : `${wallOwnerName}'s wall`}
        </h3>
      </div>

      {/* Newsfeed-style composer trigger, open to any signed-in visitor */}
      <button
        type="button"
        onClick={() => !cta.disabled && setComposerOpen(true)}
        disabled={cta.disabled}
        className="w-full mb-4 flex items-center gap-3 bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl p-3 text-left hover:border-white/20 md:border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <div className="w-10 h-10 rounded-full bg-white/5 md:bg-slate-100 flex items-center justify-center text-slate-300 md:text-slate-600 text-sm font-semibold">
          {viewerInitials || "You"}
        </div>
        <span className="flex-1 text-slate-400 md:text-slate-500 text-sm">
          {cta.disabled
            ? cta.label
            : isSelf
              ? "What's on your mind today?"
              : `Post on ${wallOwnerName}'s wall…`}
        </span>
        {cta.disabled ? (
          <Lock className="w-4 h-4 text-slate-500" />
        ) : (
          <PenSquare className="w-4 h-4 text-emerald-400" />
        )}
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading wall…
        </div>
      ) : posts && posts.length > 0 ? (
        <ul className="space-y-3">
          {posts.map((p) => {
            const meta = p.viewer_reaction ? REACTION_META[p.viewer_reaction] : null;
            return (
              <li
                key={p.id}
                className="bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  <Link
                    to="/profile/$id"
                    params={{ id: p.author_slug || p.author_id }}
                    className="shrink-0"
                  >
                    <AvatarImage
                      src={p.author_avatar_url}
                      alt={p.author_name}
                      initials={p.initials}
                      className="w-10 h-10 rounded-full"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Link
                        to="/profile/$id"
                        params={{ id: p.author_slug || p.author_id }}
                        className="font-semibold text-white md:text-slate-900 hover:text-emerald-400 truncate"
                      >
                        {p.author_name}
                      </Link>
                      <span className="text-xs text-slate-500">· {timeAgo(p.created_at)}</span>
                      {p.author_id === viewerId && (
                        <button
                          onClick={() => onDelete(p)}
                          className="ml-auto text-[11px] text-slate-500 hover:text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    {p.text && (
                      <TruncatedText
                        text={p.text}
                        lines={3}
                        className="mt-1.5 text-slate-100 text-sm"
                      />
                    )}
                    {p.media.length > 0 && (
                      <div
                        className={`mt-3 grid gap-1.5 ${
                          p.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
                        }`}
                      >
                        {p.media.slice(0, 4).map((m, i) => (
                          <div key={i} className="relative rounded-[10px] overflow-hidden bg-black/40">
                            {m.type === "video" ? (
                              <video
                                src={`${m.url}#t=0.1`}
                                poster={m.poster_url || undefined}
                                preload="none"
                                controls
                                playsInline
                                className="w-full max-h-[420px] object-cover"
                              />
                            ) : (
                              <img loading="lazy" decoding="async"
                                src={m.url}
                                alt=""
                                className="w-full max-h-[420px] object-cover"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-slate-400 md:text-slate-500 text-xs">
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
                          className="font-semibold"
                          style={meta ? { color: meta.color } : undefined}
                        >
                          {p.likes_count}
                        </span>
                      </div>
                      <button
                        onClick={() => setCommentsFor(p)}
                        className="inline-flex items-center gap-1.5 hover:text-white md:text-slate-900"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{p.comments_count}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="bg-[#141418] md:bg-white md:shadow-sm border border-dashed border-white/10 md:border-slate-200 rounded-2xl p-8 text-center">
          <div className="text-slate-400 md:text-slate-500 text-sm">
            {isSelf
              ? "Your wall is empty. Drop the first post."
              : `${wallOwnerName}'s wall is empty.`}
          </div>
          {allowed?.ok && (
            <button
              onClick={() => setComposerOpen(true)}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm"
            >
              <PenSquare className="w-3.5 h-3.5" /> Write a post
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
          viewerName={viewerName}
          viewerInitials={viewerInitials}
          onClose={() => {
            setCommentsFor(null);
            void load();
          }}
        />
      )}
    </section>
  );
}

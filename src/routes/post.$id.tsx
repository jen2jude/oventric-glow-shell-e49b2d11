import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  MoreHorizontal,
  BadgeCheck,
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
  Send,
  Link2,
  Flag,
  Loader2,
  Play,
  CornerDownRight,
} from "lucide-react";
import {
  getPost,
  setReaction,
  logPostShare,
  setPostSaved,
  type FeedPost,
  type ReactionType,
} from "@/lib/posts.functions";
import {
  listComments,
  addComment,
  setCommentReaction,
  type FeedComment,
} from "@/lib/comments.functions";
import { RepostDialog } from "@/components/oventric/feed/RepostDialog";
import { ShareSheet } from "@/components/oventric/ShareSheet";
import { ReportModal } from "@/components/oventric/ReportModal";
import { ProductAttachmentCard } from "@/components/oventric/feed/ProductAttachmentCard";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { toast } from "sonner";

export const Route = createFileRoute("/post/$id")({
  head: () => ({
    meta: [
      { title: "Post — Oventric" },
      {
        name: "description",
        content: "Read this Oventric post, join the conversation, react, repost and share it.",
      },
      { property: "og:title", content: "Post — Oventric" },
      {
        property: "og:description",
        content: "Read this Oventric post, join the conversation, react, repost and share it.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostScreen,
});

const ACCENT = "#E5484D";

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function fullStamp(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return `${time} · ${date}`;
}

function relative(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Avatar({
  url,
  initials,
  size = 44,
}: {
  url: string | null;
  initials: string;
  size?: number;
}) {
  return url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover ring-2 ring-white/10"
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-black text-white ring-2 ring-white/10"
    >
      {initials}
    </div>
  );
}

function CommentRow({
  c,
  replies,
  onReply,
  onLike,
}: {
  c: FeedComment;
  replies: FeedComment[];
  onReply: (c: FeedComment) => void;
  onLike: (c: FeedComment) => void;
}) {
  const total = Object.values(c.reactions).reduce((a, b) => a + b, 0);
  const liked = !!c.viewer_reaction;
  return (
    <div className="py-3">
      <div className="flex gap-3">
        <Avatar url={null} initials={c.initials} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-bold text-white">{c.author_name}</span>
            <span className="text-[11px] text-white/35">{relative(c.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-white/80">
            {c.text}
          </p>
          <div className="mt-2 flex items-center gap-5 text-[12px] text-white/45">
            <button
              type="button"
              onClick={() => onLike(c)}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
              style={{ color: liked ? ACCENT : undefined }}
            >
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
              {total > 0 && <span>{compact(total)}</span>}
            </button>
            <button
              type="button"
              onClick={() => onReply(c)}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <CornerDownRight className="h-4 w-4" /> Reply
            </button>
          </div>

          {replies.length > 0 && (
            <div className="mt-3 space-y-3 border-l border-white/10 pl-3">
              {replies.map((r) => {
                const rTotal = Object.values(r.reactions).reduce((a, b) => a + b, 0);
                const rLiked = !!r.viewer_reaction;
                return (
                  <div key={r.id} className="flex gap-2.5">
                    <Avatar url={null} initials={r.initials} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[12px] font-bold text-white">
                          {r.author_name}
                        </span>
                        <span className="text-[10px] text-white/35">{relative(r.created_at)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/75">
                        {r.text}
                      </p>
                      <button
                        type="button"
                        onClick={() => onLike(r)}
                        className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white"
                        style={{ color: rLiked ? ACCENT : undefined }}
                      >
                        <Heart className={`h-3.5 w-3.5 ${rLiked ? "fill-current" : ""}`} />
                        {rTotal > 0 && <span>{compact(rTotal)}</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostScreen() {
  const { id } = useParams({ from: "/post/$id" });
  const navigate = useNavigate();
  const { require } = useOnboarding();

  const fetchPost = useServerFn(getPost);
  const fetchComments = useServerFn(listComments);
  const createComment = useServerFn(addComment);
  const reactPost = useServerFn(setReaction);
  const reactComment = useServerFn(setCommentReaction);
  const shareLogFn = useServerFn(logPostShare);
  const savePostFn = useServerFn(setPostSaved);

  const [post, setPost] = useState<FeedPost | null | undefined>(undefined);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [posting, setPosting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shares, setShares] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchPost({ data: { id } });
      setPost(r.post ?? null);
      if (r.post) {
        setSaved(!!r.post.viewer_saved);
        setShares(r.post.shares_count ?? 0);
      }
      if (r.post) {
        const c = await fetchComments({ data: { postId: id } });
        setComments(c.comments);
      }
    } catch {
      setPost(null);
    }
  }, [fetchPost, fetchComments, id]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    void load();
  }, [load]);

  const roots = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const repliesOf = useCallback(
    (pid: string) => comments.filter((c) => c.parent_id === pid),
    [comments],
  );

  const shareUrl =
    typeof window !== "undefined" ? window.location.href : `https://oventric.com/post/${id}`;

  const logShare = useCallback(
    async (channel: string) => {
      setShares((n) => n + 1);
      try {
        const r = await shareLogFn({ data: { postId: id, channel } });
        setShares(r.shares_count);
      } catch {
        /* share still happened; count refreshes on next load */
      }
    },
    [shareLogFn, id],
  );

  const toggleSave = useCallback(() => {
    require(
      1,
      async () => {
        const next = !saved;
        setSaved(next);
        try {
          await savePostFn({ data: { postId: id, saved: next } });
          toast.success(next ? "Saved — find it in your bookmarks" : "Removed from saved");
        } catch {
          setSaved(!next);
          toast.error("Could not update your saved posts");
        }
      },
      "interaction",
    );
  }, [require, saved, savePostFn, id]);



  const onReact = () => {
    if (!post) return;
    require(
      1,
      async () => {
        const next: ReactionType | null = post.viewer_reaction ? null : "love";
        setPost({
          ...post,
          viewer_reaction: next,
          likes_count: Math.max(0, post.likes_count + (next ? 1 : -1)),
        });
        try {
          await reactPost({ data: { postId: post.id, reaction: next } });
        } catch {
          void load();
        }
      },
      "interaction",
    );
  };

  const onLikeComment = (c: FeedComment) => {
    require(
      1,
      async () => {
        const next: ReactionType | null = c.viewer_reaction ? null : "love";
        setComments((list) =>
          list.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  viewer_reaction: next,
                  reactions: {
                    ...x.reactions,
                    love: Math.max(0, x.reactions.love + (next ? 1 : -1)),
                  },
                }
              : x,
          ),
        );
        try {
          await reactComment({ data: { commentId: c.id, reaction: next } });
        } catch {
          void load();
        }
      },
      "interaction",
    );
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || !post) return;
    require(
      1,
      async () => {
        setPosting(true);
        try {
          await createComment({
            data: { postId: post.id, text, parentId: replyTo?.id ?? null },
          });
          setDraft("");
          setReplyTo(null);
          const c = await fetchComments({ data: { postId: post.id } });
          setComments(c.comments);
          setPost((p) => (p ? { ...p, comments_count: p.comments_count + 1 } : p));
        } catch (e) {
          toast.error((e as Error).message || "Couldn't post comment");
        } finally {
          setPosting(false);
        }
      },
      "interaction",
    );
  };

  if (post === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (post === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0A0A0B] px-6">
        <p className="text-lg font-black text-white">Post not found</p>
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ background: ACCENT }}
        >
          Back to feed
        </button>
      </div>
    );
  }

  const handle = post.author_slug ? `@${post.author_slug}` : "";
  const profileHref = post.author_slug ? `/profile/${post.author_slug}` : `/profile/${post.author_id}`;

  const metrics: { label: string; value: number }[] = [
    { label: post.likes_count === 1 ? "Like" : "Likes", value: post.likes_count },
    { label: post.comments_count === 1 ? "Comment" : "Comments", value: post.comments_count },
    { label: post.reposts_count === 1 ? "Repost" : "Reposts", value: post.reposts_count },
    { label: shares === 1 ? "Share" : "Shares", value: shares },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0B] pb-28 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/[0.06] bg-[#0A0A0B]/95 px-3 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: "/" }))}
          aria-label="Back"
          className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[15px] font-black">Post</h1>
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Post options"
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#141418] py-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(shareUrl);
                    void logShare("copy_link");
                    toast.success("Link copied");
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] text-white/85 hover:bg-white/5"
                >
                  <Link2 className="h-4 w-4" /> Copy post link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] text-white/85 hover:bg-white/5"
                >
                  <Flag className="h-4 w-4" /> Report post
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Author */}
      <section className="flex items-center gap-3 px-4 pt-4">
        <Link to={profileHref}>
          <Avatar url={post.author_avatar_url} initials={post.initials} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={profileHref} className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-black">{post.author_name}</span>
            <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
          </Link>
          <p className="truncate text-[12px] text-white/45">
            {handle}
            {handle && " · "}
            {relative(post.created_at)}
          </p>
        </div>
      </section>

      {/* Body */}
      {post.text && (
        <p className="whitespace-pre-wrap break-words px-4 pt-4 text-[16px] leading-[1.6] text-white/90">
          {post.text}
        </p>
      )}

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <div className="mt-4 px-4">
          <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-black">
            {post.media.length === 1 ? (
              post.media[0].type === "video" ? (
                <video
                  src={post.media[0].url}
                  poster={post.media[0].poster_url ?? undefined}
                  controls
                  playsInline
                  className="max-h-[70vh] w-full object-cover"
                />
              ) : (
                <img loading="lazy" decoding="async"
                  src={post.media[0].url}
                  alt=""
                  className="max-h-[70vh] w-full object-cover"
                />
              )
            ) : (
              <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto">
                {post.media.map((m, i) => (
                  <div key={i} className="relative w-full shrink-0 snap-center">
                    {m.type === "video" ? (
                      <>
                        <video
                          src={m.url}
                          poster={m.poster_url ?? undefined}
                          controls
                          playsInline
                          className="aspect-square w-full object-cover"
                        />
                        <Play className="pointer-events-none absolute inset-0 m-auto h-10 w-10 opacity-0" />
                      </>
                    ) : (
                      <img loading="lazy" decoding="async" src={m.url} alt="" className="aspect-square w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {post.product_attachments && post.product_attachments.length > 0 && (
        <div className="px-4">
          {post.product_attachments.map((pa) => (
            <ProductAttachmentCard key={pa.id} product={pa} />
          ))}
        </div>
      )}



      {/* Quoted repost */}
      {post.repost_of && (
        <div className="mt-4 px-4">
          <Link
            to="/post/$id"
            params={{ id: post.repost_of.id }}
            className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
          >
            {(post.repost_of.poster_url || post.repost_of.media_url) && (
              <img
                src={post.repost_of.poster_url ?? post.repost_of.media_url ?? ""}
                alt=""
                loading="lazy"
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">{post.repost_of.author_name}</p>
              <p className="mt-0.5 line-clamp-3 text-xs text-white/60">{post.repost_of.text}</p>
            </div>
          </Link>
        </div>
      )}

      {/* Attribution */}
      <p className="px-4 pt-4 text-[12px] text-white/40">
        {fullStamp(post.created_at)} · <span className="text-white/55">Oventric</span>
      </p>

      {/* Metric strip */}
      <div className="mx-4 mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-2 py-3">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-[15px] font-black">{compact(m.value)}</div>
            <div className="text-[10px] uppercase tracking-wide text-white/40">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="mx-4 mt-3 flex items-center border-y border-white/[0.07] py-2">
        <button
          type="button"
          onClick={onReact}
          aria-label="Like"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold text-white/60 hover:bg-white/5"
          style={{ color: post.viewer_reaction ? ACCENT : undefined }}
        >
          <Heart className={`h-[19px] w-[19px] ${post.viewer_reaction ? "fill-current" : ""}`} />
          {post.likes_count > 0 && <span>{compact(post.likes_count)}</span>}
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          aria-label="Comment"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold text-white/60 hover:bg-white/5"
        >
          <MessageCircle className="h-[19px] w-[19px]" />
          {post.comments_count > 0 && <span>{compact(post.comments_count)}</span>}
        </button>
        <button
          type="button"
          onClick={() => require(1, () => setRepostOpen(true), "interaction")}
          aria-label="Repost"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold text-white/60 hover:bg-white/5"
          style={{ color: post.viewer_reposted ? ACCENT : undefined }}
        >
          <Repeat2 className="h-[19px] w-[19px]" />
          {post.reposts_count > 0 && <span>{compact(post.reposts_count)}</span>}
        </button>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label="Share"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold text-white/60 hover:bg-white/5"
        >
          <Share2 className="h-[19px] w-[19px]" />
          {shares > 0 && <span>{compact(shares)}</span>}
        </button>
        <button
          type="button"
          onClick={() => toggleSave()}
          aria-label="Save post"
          className="flex flex-1 items-center justify-center rounded-xl py-2 text-white/60 hover:bg-white/5"
          style={{ color: saved ? ACCENT : undefined }}
        >
          <Bookmark className={`h-[19px] w-[19px] ${saved ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Comments */}
      <section className="mt-5 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-black">Comments</h2>
          <span className="text-[12px] text-white/40">Most recent</span>
        </div>
        <div className="mt-1 divide-y divide-white/[0.06]">
          {roots.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-white/40">
              No comments yet — start the conversation.
            </p>
          ) : (
            [...roots]
              .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
              .map((c) => (
                <CommentRow
                  key={c.id}
                  c={c}
                  replies={repliesOf(c.id)}
                  onReply={(t) => {
                    setReplyTo(t);
                    inputRef.current?.focus();
                  }}
                  onLike={onLikeComment}
                />
              ))
          )}
        </div>
      </section>

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#0A0A0B]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur-xl">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 text-[11px] text-white/50">
            <CornerDownRight className="h-3.5 w-3.5" />
            Replying to {replyTo.author_name}
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-auto text-white/40 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Add a comment..."
            className="h-11 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-4 text-[14px] text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || posting}
            aria-label="Send comment"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <RepostDialog
        open={repostOpen}
        post={
          repostOpen
            ? {
                id: post.id,
                author_name: post.author_name,
                text: post.text,
                media_url: post.media_url,
                poster_url: post.poster_url,
                author_avatar_url: post.author_avatar_url,
                initials: post.initials,
              }
            : null
        }
        onClose={() => setRepostOpen(false)}
        onDone={() => void load()}
      />
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={shareUrl}
        title={`${post.author_name} on Oventric`}
        text={post.text?.slice(0, 140) || undefined}
        onShared={(channel) => void logShare(channel)}
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target="post"
        targetId={post.id}
        targetKind="post"
      />
    </div>
  );
}

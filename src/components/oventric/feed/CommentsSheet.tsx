import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { X, Send, Heart, ChevronDown } from "lucide-react";
import {
  listComments,
  addComment,
  setCommentReaction,
  type FeedComment,
} from "@/lib/comments.functions";
import type { ReactionType } from "@/lib/posts.functions";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { toast } from "sonner";

interface Props {
  postId: string;
  postAuthorName: string;
  onClose: () => void;
  viewerName?: string;
  viewerInitials?: string;
}

type SortKey = "recent" | "relevant" | "newest" | "all";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Most recent" },
  { key: "relevant", label: "Most relevant" },
  { key: "newest", label: "Newest" },
  { key: "all", label: "All comments" },
];

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function CommentRow({
  c,
  replies,
  onReply,
  onReact,
  depth = 0,
}: {
  c: FeedComment;
  replies: FeedComment[];
  onReply: (parent: FeedComment) => void;
  onReact: (id: string, r: ReactionType | null) => void;
  depth?: number;
}) {
  const [openReplies, setOpenReplies] = useState(false);
  const total =
    c.reactions.love + c.reactions.like + c.reactions.laugh + c.reactions.crown;
  const liked = !!c.viewer_reaction;

  const avatar = (
    <span className="w-9 h-9 shrink-0 rounded-full overflow-hidden block">
      <AvatarImage src={c.author_avatar_url} alt={c.author_name} />
    </span>
  );

  return (
    <div className={`flex gap-3 py-3 ${depth ? "" : "border-b border-white/[0.06] md:border-slate-200"}`}>
      {c.author_slug ? (
        <Link to="/profile/$id" params={{ id: c.author_slug }} aria-label={`Open ${c.author_name}'s profile`}>
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {c.author_slug ? (
            <Link
              to="/profile/$id"
              params={{ id: c.author_slug }}
              className="text-[13px] font-semibold text-slate-100 md:text-slate-900 truncate hover:underline"
            >
              {c.author_name}
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-slate-100 md:text-slate-900 truncate">
              {c.author_name}
            </span>
          )}
          {c.author_username && (
            <span className="text-[12px] text-slate-500 truncate">@{c.author_username}</span>
          )}
          <span className="ml-auto text-[11px] text-slate-500 shrink-0">{timeAgo(c.created_at)}</span>
        </div>
        <div className="mt-0.5 text-[13.5px] leading-snug text-slate-200 md:text-slate-800 whitespace-pre-wrap break-words">
          {c.text}
        </div>
        <div className="flex items-center mt-1.5">
          <button
            type="button"
            onClick={() => onReply(c)}
            className="text-[12px] text-slate-400 md:text-slate-600 hover:text-slate-200 md:hover:text-slate-900"
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => onReact(c.id, liked ? null : "love")}
            className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-slate-400 md:text-slate-600"
            aria-label={liked ? "Remove reaction" : "React"}
          >
            <Heart
              className={`w-4 h-4 ${liked ? "app-feed-accent" : ""}`}
              fill={liked ? "currentColor" : "none"}
              strokeWidth={1.8}
            />
            {total > 0 && <span>{total}</span>}
          </button>
        </div>

        {replies.length > 0 && (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => setOpenReplies((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] text-slate-400 md:text-slate-600 hover:text-slate-200"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${openReplies ? "rotate-180" : ""}`}
              />
              {openReplies
                ? "Hide replies"
                : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
            </button>
            {openReplies && (
              <div className="mt-1 pl-3 border-l border-white/10 md:border-slate-200">
                {replies.map((r) => (
                  <CommentRow
                    key={r.id}
                    c={r}
                    replies={[]}
                    onReply={onReply}
                    onReact={onReact}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentsSheet({
  postId,
  postAuthorName,
  onClose,
  viewerName,
  viewerInitials,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listComments);
  const addFn = useServerFn(addComment);
  const reactFn = useServerFn(setCommentReaction);
  const { require } = useOnboarding();

  const { data } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => listFn({ data: { postId } }),
    staleTime: 15_000,
  });
  const comments = (data?.comments ?? []) as FeedComment[];

  const [sort, setSort] = useState<SortKey>("recent");
  const [sortOpen, setSortOpen] = useState(false);

  const { topLevel, repliesMap } = useMemo(() => {
    const map = new Map<string, FeedComment[]>();
    comments.forEach((c) => {
      if (c.parent_id) {
        const arr = map.get(c.parent_id) ?? [];
        arr.push(c);
        map.set(c.parent_id, arr);
      }
    });
    let top = comments.filter((c) => !c.parent_id);
    const score = (c: FeedComment) =>
      c.reactions.love + c.reactions.like + c.reactions.laugh + c.reactions.crown +
      (map.get(c.id)?.length ?? 0);
    const byNew = (a: FeedComment, b: FeedComment) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "recent" || sort === "newest") top = [...top].sort(byNew);
    else if (sort === "relevant") top = [...top].sort((a, b) => score(b) - score(a) || byNew(a, b));
    else top = [...top].sort((a, b) => -byNew(a, b));
    return { topLevel: top, repliesMap: map };
  }, [comments, sort]);

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const addMut = useMutation({
    mutationFn: (payload: { text: string; parentId: string | null }) =>
      addFn({
        data: {
          postId,
          text: payload.text,
          authorName: viewerName || "You",
          initials: viewerInitials || "YO",
          parentId: payload.parentId,
        },
      }),
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["feed-posts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to post comment"),
  });

  const reactMut = useMutation({
    mutationFn: (v: { commentId: string; reaction: ReactionType | null }) => reactFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["comments", postId] });
      const prev = qc.getQueryData<{ comments: FeedComment[] }>(["comments", postId]);
      if (prev) {
        qc.setQueryData(["comments", postId], {
          comments: prev.comments.map((c) => {
            if (c.id !== v.commentId) return c;
            const nx = { ...c.reactions };
            if (c.viewer_reaction) nx[c.viewer_reaction] = Math.max(0, nx[c.viewer_reaction] - 1);
            if (v.reaction) nx[v.reaction] += 1;
            return { ...c, reactions: nx, viewer_reaction: v.reaction };
          }),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["comments", postId], ctx.prev);
      toast.error("Reaction failed");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["comments", postId] }),
  });

  const handleSubmit = () => {
    const t = text.trim();
    if (!t) return;
    require(2, () => addMut.mutate({ text: t, parentId: replyTo?.id ?? null }), "interaction");
  };

  const sortLabel = SORTS.find((s) => s.key === sort)!.label;

  return (
    <div
      className="modal-light fixed inset-0 z-[110] bg-black/70 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Comments on ${postAuthorName}'s post`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg h-[80vh] sm:h-[75vh] bg-[#0F0F11] md:bg-white border border-white/10 md:border-slate-200 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden slide-up"
      >
        {/* Grabber */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-white/25 md:bg-slate-300" />
        </div>

        <div className="flex items-center justify-between px-4 pb-3 shrink-0 relative">
          <h2 className="text-[18px] font-semibold text-slate-100 md:text-slate-900">Comments</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-[13px] text-slate-400 md:text-slate-600"
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
            >
              {sortLabel}
              <ChevronDown className={`w-4 h-4 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 md:hover:bg-slate-100 text-slate-400 md:text-slate-600 sm:inline-flex hidden"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {sortOpen && (
            <>
              <button
                className="fixed inset-0 z-[1] cursor-default"
                aria-hidden
                onClick={() => setSortOpen(false)}
              />
              <ul
                role="listbox"
                className="absolute right-3 top-9 z-[2] w-44 rounded-xl bg-[#1A1A1D] md:bg-white border border-white/10 md:border-slate-200 shadow-xl overflow-hidden"
              >
                {SORTS.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={sort === s.key}
                      onClick={() => {
                        setSort(s.key);
                        setSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-3 text-[13px] hover:bg-white/5 md:hover:bg-slate-50 ${
                        sort === s.key
                          ? "app-feed-accent font-semibold"
                          : "text-slate-200 md:text-slate-700"
                      }`}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {topLevel.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-10">No comments yet — be first.</div>
          ) : (
            topLevel.map((c) => (
              <CommentRow
                key={c.id}
                c={c}
                replies={repliesMap.get(c.id) ?? []}
                onReply={(p) => {
                  setReplyTo(p);
                  inputRef.current?.focus();
                }}
                onReact={(id, r) =>
                  require(2, () => reactMut.mutate({ commentId: id, reaction: r }), "interaction")
                }
              />
            ))
          )}
        </div>

        <div className="px-4 py-3 shrink-0 bg-[#0F0F11] md:bg-white">
          {replyTo && (
            <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-400 md:text-slate-600">
              <span>Replying to {replyTo.author_name}</span>
              <button
                className="hover:text-slate-200 md:hover:text-slate-800"
                onClick={() => setReplyTo(null)}
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-full bg-white/[0.04] md:bg-slate-100 border border-white/10 md:border-slate-200 pl-4 pr-1.5 py-1.5">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyTo ? "Write a reply…" : "Add a comment..."}
              rows={1}
              className="flex-1 resize-none bg-transparent text-[13.5px] text-slate-100 md:text-slate-800 placeholder:text-slate-500 outline-none max-h-28 py-1.5"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || addMut.isPending}
              className="app-feed-accent p-2 rounded-full disabled:opacity-40 hover:bg-white/5 md:hover:bg-slate-200"
              aria-label="Send"
            >
              <Send className="w-4.5 h-4.5 w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

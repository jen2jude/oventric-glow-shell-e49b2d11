import { useState } from "react";
import { Repeat2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { repostPost } from "@/lib/posts.functions";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  post: {
    id: string;
    author_name: string;
    text: string;
    media_url?: string | null;
    poster_url?: string | null;
    author_avatar_url?: string | null;
    initials?: string;
  } | null;
  onDone?: () => void;
};

/**
 * Quote-repost composer. Mirrors the X/Twitter pattern: the original post is
 * shown as a read-only quote card and the user may add their own comment
 * before sharing it to their own wall.
 */
export function RepostDialog({ open, onClose, post, onDone }: Props) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const doRepost = useServerFn(repostPost);

  if (!open || !post) return null;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await doRepost({ data: { postId: post.id, comment: comment.trim() || null } });
      toast.success("Reposted to your wall");
      setComment("");
      onDone?.();
      onClose();
    } catch (e) {
      console.error("[RepostDialog] failed", e);
      toast.error("Couldn't repost. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const thumb = post.media_url ?? post.poster_url ?? null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[22px] border border-white/10 bg-[#1B1D1F] p-5 shadow-2xl sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Repost"
      >
        <div className="mb-4 flex items-center gap-2">
          <Repeat2 className="h-5 w-5 text-[#FF3EB5]" />
          <h2 className="text-base font-black text-white">Repost to your wall</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Add a comment (optional)"
          className="w-full resize-none rounded-[10px] border border-white/10 bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/35 focus:border-[#FF3EB5]/60 focus:outline-none"
        />

        <div className="mt-3 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          {thumb && (
            <img loading="lazy" decoding="async"
              src={thumb}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-white">{post.author_name}</p>
            <p className="mt-0.5 line-clamp-3 text-xs text-white/60">{post.text}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-full bg-[#FF3EB5] py-3 text-sm font-black text-[#070A08] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Reposting…" : "Repost"}
        </button>
      </div>
    </div>
  );
}

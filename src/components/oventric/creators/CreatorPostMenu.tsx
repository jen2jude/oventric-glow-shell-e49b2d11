import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bookmark,
  EyeOff,
  Flag,
  Link2,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ReportModal } from "@/components/oventric/ReportModal";
import { togglePostSet, shareUrl } from "@/components/oventric/PostActionsMenu";
import {
  deleteCreatorPost,
  saveCreatorPostToCollection,
  updateCreatorPost,
  type CreatorPostDTO,
} from "@/lib/creators.functions";

type Props = {
  post: CreatorPostDTO;
  isOwner: boolean;
  onHide: (postId: string) => void;
  onDeleted: (postId: string) => void;
  onUpdated: (postId: string, patch: { title: string; caption: string | null; communityLink: string | null }) => void;
};

const rowClass =
  "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50";

export function CreatorPostMenu({ post, isOwner, onHide, onDeleted, onUpdated }: Props) {
  const save = useServerFn(saveCreatorPostToCollection);
  const remove = useServerFn(deleteCreatorPost);
  const update = useServerFn(updateCreatorPost);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [caption, setCaption] = useState(post.caption ?? "");
  const [communityLink, setCommunityLink] = useState(post.communityLink ?? "");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!editing || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editing]);

  const href =
    typeof window === "undefined"
      ? `/feed?tab=creators&post=${post.id}`
      : `${window.location.origin}/feed?tab=creators&post=${post.id}`;

  const handleSave = () => {
    setOpen(false);
    save({
      data: {
        postId: post.id,
        title: post.title,
        imageUrl: post.media[0]?.posterUrl ?? post.media[0]?.url ?? null,
      },
    })
      .then((r) => toast.success(r.alreadySaved ? "Already in your collection" : "Saved to your collection"))
      .catch((e) =>
        toast.error(/unauthor|401|sign/i.test(String((e as Error)?.message)) ? "Sign in to save" : "Couldn't save this post"),
      );
  };

  const handleDelete = () => {
    setOpen(false);
    if (!window.confirm("Delete this showcase post? This can't be undone.")) return;
    remove({ data: { postId: post.id } })
      .then(() => {
        onDeleted(post.id);
        toast.success("Post deleted");
      })
      .catch(() => toast.error("Couldn't delete this post"));
  };

  const submitEdit = async () => {
    if (title.trim().length < 2) {
      toast.error("Add a title of at least 2 characters");
      return;
    }
    setBusy(true);
    try {
      await update({
        data: {
          postId: post.id,
          title: title.trim(),
          caption: caption.trim() || null,
          communityLink: communityLink.trim() || null,
        },
      });
      onUpdated(post.id, {
        title: title.trim(),
        caption: caption.trim() || null,
        communityLink: communityLink.trim() || null,
      });
      setEditing(false);
      toast.success("Changes saved");
    } catch {
      toast.error("Couldn't save your changes");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Post options"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[60] mt-1 w-60 overflow-hidden rounded-[14px] border border-slate-200 bg-white p-1.5 shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)]">
          <div className="mb-1.5 flex h-1 overflow-hidden rounded-full">
            <span className="flex-1 bg-emerald-400" />
            <span className="flex-1 bg-sky-400" />
            <span className="flex-1 bg-violet-400" />
            <span className="flex-1 bg-amber-400" />
            <span className="flex-1 bg-rose-400" />
          </div>

          {isOwner ? (
            <>
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  setOpen(false);
                  setEditing(true);
                }}
              >
                <Pencil className="h-4 w-4 text-violet-500" /> Edit post
              </button>
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  setOpen(false);
                  void shareUrl(href, post.title);
                }}
              >
                <Share2 className="h-4 w-4 text-sky-500" /> Share
              </button>
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  setOpen(false);
                  void navigator.clipboard.writeText(href).then(() => toast.success("Link copied"));
                }}
              >
                <Link2 className="h-4 w-4 text-emerald-500" /> Copy link
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold text-rose-600 transition-colors hover:bg-rose-50"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" /> Delete post
              </button>
            </>
          ) : (
            <>
              <button type="button" className={rowClass} onClick={handleSave}>
                <Bookmark className="h-4 w-4 text-emerald-500" /> Save to collection
              </button>
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  setOpen(false);
                  void shareUrl(href, post.title);
                }}
              >
                <Share2 className="h-4 w-4 text-sky-500" /> Share
              </button>
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  setOpen(false);
                  void navigator.clipboard.writeText(href).then(() => toast.success("Link copied"));
                }}
              >
                <Link2 className="h-4 w-4 text-violet-500" /> Copy link
              </button>
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  setOpen(false);
                  togglePostSet("hidden", post.id, true);
                  onHide(post.id);
                  toast.success("Hidden from your feed");
                }}
              >
                <EyeOff className="h-4 w-4 text-amber-500" /> Hide this post
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold text-rose-600 transition-colors hover:bg-rose-50"
                onClick={() => {
                  setOpen(false);
                  setReporting(true);
                }}
              >
                <Flag className="h-4 w-4" /> Report
              </button>
            </>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[20px] border border-slate-200 bg-white shadow-2xl sm:max-w-lg sm:rounded-[20px]">
            <div className="flex h-1 shrink-0">
              <span className="flex-1 bg-emerald-400" />
              <span className="flex-1 bg-sky-400" />
              <span className="flex-1 bg-violet-400" />
              <span className="flex-1 bg-amber-400" />
              <span className="flex-1 bg-rose-400" />
            </div>
            <div className="flex shrink-0 items-center justify-between px-5 py-4">
              <h3 className="text-[16px] font-black text-slate-900">Edit your showcase</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setEditing(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-violet-400"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Caption</span>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="mt-1.5 w-full resize-none rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-violet-400"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Community link (optional)
                </span>
                <input
                  value={communityLink}
                  onChange={(e) => setCommunityLink(e.target.value)}
                  maxLength={300}
                  placeholder="https://t.me/… or https://chat.whatsapp.com/…"
                  className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-emerald-400"
                />
              </label>
              <p className="text-[12px] text-slate-400">
                Media and any listed asset stay as published. To change those, publish a new showcase.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:pb-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-[10px] border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitEdit}
                className="flex-1 rounded-[10px] bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportModal
        open={reporting}
        onClose={() => setReporting(false)}
        target="showcase post"
        targetId={post.id}
        targetKind="creator_post"
      />
    </div>
  );
}

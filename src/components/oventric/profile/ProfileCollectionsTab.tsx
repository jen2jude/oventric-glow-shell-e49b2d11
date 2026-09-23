import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Globe, Lock, Plus, Trash2, X, Layers, ExternalLink, LoaderCircle } from "lucide-react";
import {
  addCollectionItem,
  deleteCollection,
  deleteCollectionItem,
  listMyCollections,
  listPublicCollections,
  saveCollection,
  type CollectionDTO,
} from "@/lib/collections.functions";
import { listSavedPosts } from "@/lib/posts.functions";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CreatorCard } from "@/components/oventric/creators/CreatorFeed";
import { getCreatorPost, type CreatorPostDTO } from "@/lib/creators.functions";
import { supabase } from "@/integrations/supabase/client";

const ACCENT = "#E5484D";

/**
 * Profile "Collections" tab — public curated boards.
 * Anyone can browse a member's public boards; owners create, fill and
 * manage boards inline (public/private per board).
 */
export function ProfileCollectionsTab({
  idOrSlug,
  name,
  isOwner,
}: {
  idOrSlug: string;
  name: string;
  isOwner: boolean;
}) {
  const loadPublic = useServerFn(listPublicCollections);
  const loadMine = useServerFn(listMyCollections);
  const [boards, setBoards] = useState<CollectionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CollectionDTO | "new" | null>(null);
  const [open, setOpen] = useState<CollectionDTO | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = isOwner ? await loadMine() : await loadPublic({ data: { idOrSlug } });
      setBoards(res);
      setOpen((prev) => (prev ? (res.find((b) => b.id === prev.id) ?? null) : null));
    } catch (e) {
      console.error("[collections] load", e);
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, [idOrSlug, isOwner, loadMine, loadPublic]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 pb-10 sm:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-white md:text-slate-900">Collections</h3>
          <p className="text-[11px] text-slate-400 md:text-slate-500">
            Curated public boards by {name}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-white"
            style={{ background: ACCENT }}
          >
            <Plus className="h-3.5 w-3.5" /> New board
          </button>
        )}
      </div>

      {isOwner && <SavedPostsStrip />}

      {boards.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <Layers className="mx-auto h-6 w-6 text-slate-500" />
          <p className="mt-2 text-sm font-bold text-white md:text-slate-900">No boards yet</p>
          <p className="mt-1 text-[12px] text-slate-400 md:text-slate-500">
            {isOwner
              ? "Create a board to curate products, posts, courses or links around a theme."
              : `${name} hasn't published a curated board yet.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setOpen(b)}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:border-white/25"
            >
              <div className="relative h-28 w-full overflow-hidden bg-white/[0.06]">
                {b.coverUrl ? (
                  <img loading="lazy" decoding="async"
                    src={b.coverUrl}
                    alt={b.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Bookmark className="h-5 w-5 text-slate-500" />
                  </div>
                )}
                {!b.isPublic && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-white">
                    <Lock className="h-2.5 w-2.5" /> Private
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-[12px] font-black text-white md:text-slate-900">
                  {b.title}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-400 md:text-slate-500">
                  {b.itemCount} {b.itemCount === 1 ? "item" : "items"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <BoardSheet
          board={open}
          isOwner={isOwner}
          onClose={() => setOpen(null)}
          onChanged={refresh}
          onEdit={() => {
            setEditing(open);
            setOpen(null);
          }}
        />
      )}

      {editing && (
        <BoardEditor
          board={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0"
        role="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0A0A0B] p-4 sm:max-w-lg sm:rounded-3xl">
        {children}
      </div>
    </div>
  );
}

function BoardSheet({
  board,
  isOwner,
  onClose,
  onChanged,
  onEdit,
}: {
  board: CollectionDTO;
  isOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const addItem = useServerFn(addCollectionItem);
  const removeItem = useServerFn(deleteCollectionItem);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [creatorPostId, setCreatorPostId] = useState<string | null>(null);
  const allCreatorIds = board.items
    .map((it) => creatorIdForItem(it))
    .filter((v): v is string => Boolean(v));

  const creatorIdFor = (item: CollectionDTO["items"][number]) => {
    if (item.refId) return item.refId;
    if (!item.url) return null;
    try {
      const parsed = new URL(item.url, "https://oventric.com");
      return parsed.pathname === "/feed" && parsed.searchParams.get("tab") === "creators"
        ? parsed.searchParams.get("post")
        : null;
    } catch {
      return null;
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-base font-black text-white">{board.title}</h4>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
            {board.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {board.isPublic ? "Public board" : "Private board"} · {board.itemCount} items
          </p>
          {board.description && <p className="mt-2 text-[12px] text-slate-300">{board.description}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isOwner && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onEdit}
            className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white"
          >
            Edit board
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {board.items.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center text-[12px] text-slate-400">
            Nothing saved to this board yet.
          </p>
        )}
        {board.items.map((it) => {
          const savedCreatorPostId = creatorIdFor(it);
          return (
          <div key={it.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-white/[0.06]">
              {it.imageUrl ? (
                <img loading="lazy" decoding="async" src={it.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Bookmark className="h-4 w-4 text-slate-500" />
                </div>
              )}
            </div>
            <button
              type="button"
              className="min-w-0 flex-1"
              onClick={() => {
                if (savedCreatorPostId) {
                  setCreatorPostId(savedCreatorPostId);
                } else if (it.url) {
                  window.location.assign(it.url);
                }
              }}
            >
              <p className="truncate text-left text-[12px] font-bold text-white">{it.title || it.url}</p>
              {it.note && <p className="truncate text-left text-[11px] text-slate-400">{it.note}</p>}
            </button>
            {it.url && (
              <button
                type="button"
                onClick={() => savedCreatorPostId ? setCreatorPostId(savedCreatorPostId) : window.open(it.url ?? "", "_blank", "noopener,noreferrer")}
                className="rounded-full p-1.5 text-slate-400 hover:bg-white/10"
                aria-label="Open"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            {isOwner && (
              <button
                aria-label="Remove"
                onClick={async () => {
                  await removeItem({ data: { id: it.id } });
                  onChanged();
                }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          );
        })}
      </div>

      {isOwner && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-4 w-full rounded-[10px] border border-dashed border-white/20 py-3 text-[12px] font-bold text-slate-300"
        >
          + Add a link manually
        </button>
      )}

      {isOwner && showAdd && (
        <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Add to board</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-[10px] border border-white/10 bg-white/[0.05] px-3 py-3 text-[12px] text-white placeholder:text-slate-500"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (product, post, course or any URL)"
            className="w-full rounded-[10px] border border-white/10 bg-white/[0.05] px-3 py-3 text-[12px] text-white placeholder:text-slate-500"
          />
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Image URL (optional)"
            className="w-full rounded-[10px] border border-white/10 bg-white/[0.05] px-3 py-3 text-[12px] text-white placeholder:text-slate-500"
          />
          <button
            disabled={busy || (!url.trim() && !title.trim())}
            onClick={async () => {
              setBusy(true);
              try {
                await addItem({
                  data: {
                    collectionId: board.id,
                    kind: image.trim() && !url.trim() ? "image" : "link",
                    url: url.trim() || null,
                    title: title.trim() || null,
                    imageUrl: image.trim() || null,
                  },
                });
                setUrl("");
                setTitle("");
                setImage("");
                onChanged();
              } catch (e) {
                console.error("[collections] add item", e);
              } finally {
                setBusy(false);
              }
            }}
            className="w-full rounded-[10px] py-3 text-[12px] font-bold text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {busy ? "Saving…" : "Add item"}
          </button>
        </div>
      )}

      {creatorPostId && (
        <CreatorPostOverlay postId={creatorPostId} onClose={() => setCreatorPostId(null)} />
      )}
    </Sheet>
  );
}

function CreatorPostOverlay({ postId, onClose }: { postId: string; onClose: () => void }) {
  const loadPost = useServerFn(getCreatorPost);
  const [post, setPost] = useState<CreatorPostDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    void Promise.all([loadPost({ data: { postId } }), supabase.auth.getUser()])
      .then(([result, auth]) => {
        if (!alive) return;
        setPost(result);
        setMissing(!result);
        setMeId(auth.data.user?.id ?? null);
      })
      .catch(() => alive && setMissing(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [loadPost, onClose, postId]);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Saved creator post">
      <button type="button" className="absolute inset-0" aria-label="Close saved creator post" onClick={onClose} />
      <div className="relative z-10 flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-48px)]">
        <div className="flex h-1 shrink-0">
          <span className="flex-1 bg-emerald-400" /><span className="flex-1 bg-sky-400" /><span className="flex-1 bg-violet-400" /><span className="flex-1 bg-amber-400" /><span className="flex-1 bg-rose-400" />
        </div>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-600">Saved showcase</p>
            <h3 className="text-sm font-black text-slate-950">Creator post</h3>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="rounded-full text-slate-600 hover:bg-rose-50 hover:text-rose-600">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white pb-[env(safe-area-inset-bottom)]">
          {loading && (
            <div className="grid min-h-64 place-items-center text-center">
              <div><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-violet-600" /><p className="mt-2 text-xs font-bold text-slate-700">Opening post…</p></div>
            </div>
          )}
          {!loading && missing && (
            <div className="grid min-h-64 place-items-center px-6 text-center">
              <div><Bookmark className="mx-auto h-6 w-6 text-rose-500" /><p className="mt-2 text-sm font-black text-slate-950">This creator post is no longer available.</p></div>
            </div>
          )}
          {post && (
            <CreatorCard
              post={post}
              onRecordedView={() => setPost((current) => current ? { ...current, viewCount: current.viewCount + 1 } : current)}
              isOwner={meId === post.author.userId}
              onHide={onClose}
              onDeleted={onClose}
              onUpdated={(_, patch) => setPost((current) => current ? { ...current, ...patch } : current)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BoardEditor({
  board,
  onClose,
  onSaved,
}: {
  board: CollectionDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(saveCollection);
  const remove = useServerFn(deleteCollection);
  const [title, setTitle] = useState(board?.title ?? "");
  const [description, setDescription] = useState(board?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(board?.coverUrl ?? "");
  const [isPublic, setIsPublic] = useState(board?.isPublic ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between">
        <h4 className="text-base font-black text-white">{board ? "Edit board" : "New board"}</h4>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Board title (e.g. Minimalist Workspace)"
          className="w-full rounded-[10px] border border-white/10 bg-white/[0.05] px-3 py-3 text-[13px] text-white placeholder:text-slate-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this board about?"
          rows={3}
          className="w-full resize-none rounded-[10px] border border-white/10 bg-white/[0.05] px-3 py-3 text-[12px] text-white placeholder:text-slate-500"
        />
        <input
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="Cover image URL (optional)"
          className="w-full rounded-[10px] border border-white/10 bg-white/[0.05] px-3 py-3 text-[12px] text-white placeholder:text-slate-500"
        />
        <button
          onClick={() => setIsPublic((v) => !v)}
          className="flex w-full items-center justify-between rounded-[10px] border border-white/10 bg-white/[0.05] px-3 py-3 text-[12px] font-semibold text-white"
        >
          <span className="flex items-center gap-2">
            {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {isPublic ? "Public — visible on your profile" : "Private — only you"}
          </span>
          <span
            className={`h-5 w-9 rounded-full p-0.5 transition ${isPublic ? "" : "bg-white/15"}`}
            style={isPublic ? { background: ACCENT } : undefined}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white transition ${isPublic ? "translate-x-4" : ""}`}
            />
          </span>
        </button>
      </div>

      {error && <p className="mt-2 text-[11px] font-semibold text-red-400">{error}</p>}

      <div className="mt-4 flex gap-2">
        {board && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await remove({ data: { id: board.id } });
                onSaved();
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-full border border-white/15 px-3 py-3 text-[12px] font-bold text-red-400"
          >
            Delete
          </button>
        )}
        <button
          disabled={busy || title.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await save({
                data: {
                  id: board?.id ?? null,
                  title: title.trim(),
                  description: description.trim() || null,
                  coverUrl: coverUrl.trim() || null,
                  isPublic,
                },
              });
              onSaved();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save board");
            } finally {
              setBusy(false);
            }
          }}
          className="flex-1 rounded-full py-3 text-[12px] font-bold text-white disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {busy ? "Saving…" : board ? "Save changes" : "Create board"}
        </button>
      </div>
    </Sheet>
  );
}

/** Owner-only strip of posts bookmarked from the newsfeed. */
function SavedPostsStrip() {
  const load = useServerFn(listSavedPosts);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res: any = await load();
        if (alive) setPosts(res?.posts ?? []);
      } catch (e) {
        console.error("[collections] saved posts", e);
        if (alive) setPosts([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  if (loading || posts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Bookmark className="h-4 w-4" style={{ color: ACCENT }} />
        <h4 className="text-sm font-black text-slate-900">Saved posts</h4>
        <span className="text-[11px] text-slate-500">{posts.length}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {posts.slice(0, 12).map((p) => {
          const cover = p.media?.[0]?.url ?? p.media_url ?? null;
          return (
            <Link
              key={p.id}
              to="/post/$id"
              params={{ id: p.id }}
              className="flex items-center gap-3 rounded-[10px] border border-slate-200 p-2 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-slate-100">
                {cover ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={cover}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold text-slate-900">{p.author_name}</p>
                <p className="line-clamp-2 text-[11px] text-slate-600">{p.text || "Media post"}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

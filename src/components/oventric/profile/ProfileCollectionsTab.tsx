import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Globe, Lock, Plus, Trash2, X, Layers, ExternalLink } from "lucide-react";
import {
  addCollectionItem,
  deleteCollection,
  deleteCollectionItem,
  listMyCollections,
  listPublicCollections,
  saveCollection,
  type CollectionDTO,
} from "@/lib/collections.functions";

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
        {board.items.map((it) => (
          <div
            key={it.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-white/[0.06]">
              {it.imageUrl ? (
                <img loading="lazy" decoding="async" src={it.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Bookmark className="h-4 w-4 text-slate-500" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-white">{it.title || it.url}</p>
              {it.note && <p className="truncate text-[11px] text-slate-400">{it.note}</p>}
            </div>
            {it.url && (
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full p-1.5 text-slate-400 hover:bg-white/10"
                aria-label="Open"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
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
        ))}
      </div>

      {isOwner && (
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
    </Sheet>
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

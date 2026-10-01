import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, FolderHeart, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addCollectionItem,
  deleteCollection,
  deleteCollectionItem,
  listMyCollections,
  saveCollection,
  type CollectionDTO,
} from "@/lib/collections.functions";
import { getMyCollectionPicker, reorderCollectionItems } from "@/lib/creators.functions";

const CATEGORIES = ["Video", "Design", "AI", "Photography", "Writing", "Marketing", "Education", "Development", "Animation", "Music", "Digital Products"];

/** Creator collection manager: create, edit, publish/unpublish, delete, reorder items. */
export function CreatorCollectionsSheet({ open, isApp, onClose }: { open: boolean; isApp: boolean; onClose: () => void }) {
  const fetchMine = useServerFn(listMyCollections);
  const fetchPicker = useServerFn(getMyCollectionPicker);
  const save = useServerFn(saveCollection);
  const removeBoard = useServerFn(deleteCollection);
  const addItem = useServerFn(addCollectionItem);
  const removeItem = useServerFn(deleteCollectionItem);
  const reorder = useServerFn(reorderCollectionItems);

  const { data: boards, isLoading, refetch } = useQuery({ queryKey: ["creator-collections-mine"], queryFn: () => fetchMine(), enabled: open });
  const { data: picker } = useQuery({ queryKey: ["creator-collection-picker"], queryFn: () => fetchPicker(), enabled: open });

  const [editId, setEditId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "", coverUrl: "" });
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditId(null);
      setAdding(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const board: CollectionDTO | undefined = editId && editId !== "new" ? boards?.find((b) => b.id === editId) : undefined;

  const startEdit = (b: CollectionDTO | null) => {
    setEditId(b ? b.id : "new");
    setAdding(false);
    setForm({ title: b?.title ?? "", description: b?.description ?? "", category: b?.category ?? "", coverUrl: b?.coverUrl ?? "" });
  };

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = (isPublic?: boolean) =>
    run(async () => {
      if (form.title.trim().length < 2) throw new Error("Give your collection a title");
      const publish = isPublic ?? board?.isPublic ?? false;
      if (publish && !(board?.itemCount ?? 0)) throw new Error("Add at least one item before publishing");
      const res = await save({
        data: {
          id: board?.id ?? null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          category: form.category || null,
          coverUrl: form.coverUrl || null,
          isPublic: publish,
        },
      });
      if (editId === "new") setEditId(res.id);
    }, isPublic === undefined ? "Collection saved" : isPublic ? "Collection published" : "Collection unpublished");

  const move = (idx: number, dir: -1 | 1) => {
    if (!board) return;
    const ids = board.items.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    void run(() => reorder({ data: { collectionId: board.id, itemIds: ids } }));
  };

  const inBoard = new Set(board?.items.map((i) => i.refId).filter(Boolean));

  const panel = isApp ? "border-white/10 bg-[#0E0E10] text-white" : "border-slate-200 bg-white text-slate-900";
  const muted = isApp ? "text-white/45" : "text-slate-500";
  const row = isApp ? "border-white/10" : "border-slate-100";
  const input = isApp ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30" : "border-slate-200 bg-white text-slate-900";
  const primary = isApp ? "bg-[#E5484D] text-white" : "bg-slate-900 text-white";
  const ghost = isApp ? "border-white/15 text-white/85" : "border-slate-200 text-slate-700";

  return createPortal(
    <div className={`fixed inset-0 z-[110] flex items-end justify-center sm:items-center ${isApp ? "bg-black/70" : "bg-black/50"}`} onClick={onClose}>
      <div
        className={`flex w-full max-w-lg flex-col overflow-hidden border ${panel} ${isApp ? "h-[96dvh] rounded-t-[18px] border-b-0" : "max-h-[88dvh] rounded-t-[18px] sm:rounded-[18px]"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Your collections"
      >
        <div data-sheet-handle className={`flex items-center gap-2 border-b px-4 py-3 ${row}`}>
          {editId && (
            <button onClick={() => (adding ? setAdding(false) : setEditId(null))} aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full opacity-70">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <p className="flex-1 text-[15px] font-bold">{adding ? "Add items" : editId === "new" ? "New collection" : board ? "Edit collection" : "Your collections"}</p>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          {!editId && (
            <>
              <button onClick={() => startEdit(null)} className={`mb-3 flex w-full items-center justify-center gap-2 rounded-[10px] py-3 text-[13px] font-bold ${primary}`}>
                <Plus className="h-4 w-4" /> New collection
              </button>
              {isLoading ? (
                <p className={`p-6 text-center text-[13px] ${muted}`}>Loading…</p>
              ) : !boards?.length ? (
                <div className="p-8 text-center">
                  <FolderHeart className={`mx-auto h-7 w-7 ${muted}`} />
                  <p className="mt-2 text-[13px] font-bold">No collections yet</p>
                  <p className={`mt-1 text-[12px] ${muted}`}>Group your content, resources and products into a kit like "My CapCut Starter Kit".</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {boards.map((b) => (
                    <li key={b.id} className={`flex items-center gap-3 rounded-[10px] border p-2.5 ${row}`}>
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-black/10">
                        {b.coverUrl ? <img src={b.coverUrl} alt="" className="h-full w-full object-cover" /> : <FolderHeart className="m-3.5 h-5 w-5 opacity-40" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold">{b.title}</p>
                        <p className={`text-[11px] ${muted}`}>
                          {b.itemCount} items · {b.isPublic ? "Published" : "Not published"}
                          {b.category ? ` · ${b.category}` : ""}
                        </p>
                      </div>
                      <button onClick={() => startEdit(b)} aria-label="Edit" className={`grid h-8 w-8 place-items-center rounded-full border ${ghost}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => window.confirm(`Delete "${b.title}"?`) && run(() => removeBoard({ data: { id: b.id } }), "Collection deleted")}
                        aria-label="Delete"
                        className={`grid h-8 w-8 place-items-center rounded-full border ${ghost}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {editId && !adding && (
            <div className="space-y-3">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} placeholder="Title, e.g. Learn Canva From Zero" className={`w-full rounded-[10px] border px-3 py-2.5 text-[14px] ${input}`} />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={3} placeholder="What will people get from this collection?" className={`w-full rounded-[10px] border px-3 py-2.5 text-[13px] ${input}`} />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`w-full rounded-[10px] border px-3 py-2.5 text-[13px] ${input}`}>
                <option value="">Category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              {board && board.items.some((i) => i.imageUrl) && (
                <div>
                  <p className={`mb-1.5 text-[11px] font-bold uppercase tracking-wide ${muted}`}>Cover</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {Array.from(new Set(board.items.map((i) => i.imageUrl).filter((x): x is string => !!x))).map((url) => (
                      <button key={url} onClick={() => setForm({ ...form, coverUrl: url })} className={`h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border-2 ${form.coverUrl === url ? "border-[#E5484D]" : "border-transparent"}`}>
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button disabled={busy} onClick={() => saveDetails()} className={`flex-1 rounded-[10px] py-2.5 text-[13px] font-bold ${primary}`}>
                  {editId === "new" ? "Create" : "Save"}
                </button>
                {board && (
                  <button disabled={busy} onClick={() => saveDetails(!board.isPublic)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border py-2.5 text-[13px] font-bold ${ghost}`}>
                    {board.isPublic ? <><EyeOff className="h-4 w-4" /> Unpublish</> : <><Eye className="h-4 w-4" /> Publish</>}
                  </button>
                )}
              </div>
              {board?.isPublic && (
                <Link to="/creators/collections/$id" params={{ id: board.id }} onClick={onClose} className={`block text-center text-[12px] font-bold underline ${muted}`}>
                  View public page
                </Link>
              )}

              {board && (
                <div className="pt-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Items ({board.itemCount})</p>
                    <button onClick={() => setAdding(true)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-bold ${ghost}`}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                  {!board.items.length ? (
                    <p className={`rounded-[10px] border border-dashed p-5 text-center text-[12px] ${row} ${muted}`}>Add content, resources or products.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {board.items.map((it, idx) => (
                        <li key={it.id} className={`flex items-center gap-2 rounded-[10px] border p-2 ${row}`}>
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[6px] bg-black/10">
                            {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-bold">{it.title || "Untitled"}</p>
                            <p className={`text-[10.5px] capitalize ${muted}`}>{it.kind === "link" ? "content" : it.kind}</p>
                          </div>
                          <button disabled={busy || idx === 0} onClick={() => move(idx, -1)} aria-label="Move up" className="grid h-7 w-7 place-items-center opacity-70 disabled:opacity-20"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button disabled={busy || idx === board.items.length - 1} onClick={() => move(idx, 1)} aria-label="Move down" className="grid h-7 w-7 place-items-center opacity-70 disabled:opacity-20"><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button disabled={busy} onClick={() => run(() => removeItem({ data: { id: it.id } }))} aria-label="Remove" className="grid h-7 w-7 place-items-center opacity-70"><X className="h-3.5 w-3.5" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {board && adding && (
            <div className="space-y-4">
              {[
                { label: "Your content & resources", rows: (picker?.posts ?? []).map((p) => ({ id: p.id, title: p.title, img: p.thumb, kind: "post" as const, tag: p.isResource ? "Resource" : "Content" })) },
                { label: "Your shop products", rows: (picker?.products ?? []).map((p) => ({ id: p.id, title: p.name, img: p.coverUrl, kind: "product" as const, tag: "Product" })) },
              ].map((g) => (
                <div key={g.label}>
                  <p className={`mb-1.5 text-[11px] font-bold uppercase tracking-wide ${muted}`}>{g.label}</p>
                  {!g.rows.length ? (
                    <p className={`text-[12px] ${muted}`}>Nothing published yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {g.rows.map((r) => {
                        const added = inBoard.has(r.id);
                        return (
                          <li key={r.id} className={`flex items-center gap-2 rounded-[10px] border p-2 ${row}`}>
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[6px] bg-black/10">{r.img && <img src={r.img} alt="" className="h-full w-full object-cover" />}</div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12.5px] font-bold">{r.title}</p>
                              <p className={`text-[10.5px] ${muted}`}>{r.tag}</p>
                            </div>
                            <button
                              disabled={busy || added}
                              onClick={() => run(() => addItem({ data: { collectionId: board.id, kind: r.kind, refId: r.id, title: r.title, imageUrl: r.img } }), "Added")}
                              className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${added ? `border ${ghost} opacity-50` : primary}`}
                            >
                              {added ? "Added" : "Add"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { listCategories, upsertCategory, deleteCategory } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({
    meta: [{ title: "Categories · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: CategoriesPage,
});

// Oventric is digital-only; physical categories no longer exist.
type Kind = "digital";
type Row = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  enabled: boolean;
  kind: Kind;
  parent_id: string | null;
};

function CategoriesPage() {
  const listFn = useServerFn(listCategories);
  const upFn = useServerFn(upsertCategory);
  const delFn = useServerFn(deleteCategory);
  const [rows, setRows] = useState<Row[] | null>(null);
  const tab: Kind = "digital";
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  const refresh = useCallback(() => {
    listFn().then((r) => setRows(r as Row[]));
  }, [listFn]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => (r.kind ?? "digital") === tab),
    [rows, tab],
  );
  const parents = useMemo(() => filtered.filter((r) => !r.parent_id), [filtered]);
  const childrenByParent = useMemo(() => {
    const m = new Map<string, Row[]>();
    filtered.forEach((r) => {
      if (r.parent_id) {
        const a = m.get(r.parent_id) ?? [];
        a.push(r);
        m.set(r.parent_id, a);
      }
    });
    return m;
  }, [filtered]);

  const save = async () => {
    if (!editing?.slug || !editing?.name) return alert("Slug and name required");
    await upFn({
      data: {
        id: editing.id,
        slug: editing.slug,
        name: editing.name,
        description: editing.description ?? "",
        sort_order: editing.sort_order ?? 0,
        enabled: editing.enabled ?? true,
        kind: (editing.kind ?? tab) as Kind,
        parent_id: editing.parent_id ?? null,
      },
    });
    setEditing(null);
    refresh();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-white text-2xl font-black">Marketplace Categories</h1>
          <p className="text-sm text-slate-400">
            {filtered.length} digital categories
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({ enabled: true, sort_order: parents.length, kind: tab, parent_id: null })
          }
          className="inline-flex items-center gap-1 px-3 py-2 rounded-[10px] bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </header>


      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />
      ) : parents.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No {tab} categories yet.</p>
      ) : (
        <div className="grid gap-3">
          {parents.map((c) => (
            <div key={c.id} className="bg-[#141418] border border-white/10 rounded-xl p-4">
              <CategoryRow
                row={c}
                onEdit={() => setEditing(c)}
                onDelete={async () => {
                  if (confirm("Delete category and all its subcategories?")) {
                    await delFn({ data: { id: c.id } });
                    refresh();
                  }
                }}
              />
              <div className="mt-3 pl-4 border-l border-white/10 grid gap-2">
                {(childrenByParent.get(c.id) ?? []).map((sub) => (
                  <CategoryRow
                    key={sub.id}
                    row={sub}
                    sub
                    onEdit={() => setEditing(sub)}
                    onDelete={async () => {
                      if (confirm("Delete subcategory?")) {
                        await delFn({ data: { id: sub.id } });
                        refresh();
                      }
                    }}
                  />
                ))}
                <button
                  onClick={() =>
                    setEditing({
                      enabled: true,
                      sort_order: childrenByParent.get(c.id)?.length ?? 0,
                      kind: tab,
                      parent_id: c.id,
                    })
                  }
                  className="mt-1 self-start inline-flex items-center gap-1 px-2 py-1 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200"
                >
                  <Plus className="w-3 h-3" /> Add subcategory
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-[#141418] border border-white/10 rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white text-lg font-black mb-4">
              {editing.id
                ? "Edit category"
                : editing.parent_id
                  ? "New subcategory"
                  : "New category"}
            </h2>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <F label="Kind">
                  <select
                    value={editing.kind ?? tab}
                    disabled={!!editing.parent_id}
                    onChange={(e) =>
                      setEditing({ ...editing, kind: e.target.value as Kind, parent_id: null })
                    }
                    className={inp}
                  >
                    <option value="digital">Digital</option>
                    <option value="physical">Physical</option>
                  </select>
                </F>
                <F label="Parent (subcategory)">
                  <select
                    value={editing.parent_id ?? ""}
                    onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || null })}
                    className={inp}
                  >
                    <option value="">— None (top-level) —</option>
                    {(rows ?? [])
                      .filter(
                        (r) =>
                          (r.kind ?? "digital") === (editing.kind ?? tab) &&
                          !r.parent_id &&
                          r.id !== editing.id,
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </F>
              </div>
              <F label="Slug">
                <input
                  value={editing.slug ?? ""}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  className={inp}
                  placeholder="phones"
                />
              </F>
              <F label="Name">
                <input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className={inp}
                  placeholder="Phones"
                />
              </F>
              <F label="Description">
                <input
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className={inp}
                />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Sort order">
                  <input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                    className={inp}
                  />
                </F>
                <F label="Enabled">
                  <select
                    value={editing.enabled ? "y" : "n"}
                    onChange={(e) => setEditing({ ...editing, enabled: e.target.value === "y" })}
                    className={inp}
                  >
                    <option value="y">Yes</option>
                    <option value="n">No</option>
                  </select>
                </F>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-2 rounded-[10px] text-slate-300 hover:bg-white/5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  row,
  sub = false,
  onEdit,
  onDelete,
}: {
  row: Row;
  sub?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className={`font-bold ${sub ? "text-slate-200 text-sm" : "text-white"}`}>
          {row.name} <span className="text-xs text-slate-500 font-mono ml-2">/{row.slug}</span>
        </div>
        <div className="text-xs text-slate-500">
          {row.description || "—"} · sort {row.sort_order} · {row.enabled ? "enabled" : "disabled"}
        </div>
      </div>
      <button
        onClick={onEdit}
        className="px-2 py-1 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200"
      >
        Edit
      </button>
      <button
        onClick={onDelete}
        className="p-2 rounded-[10px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

const inp = "w-full bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Wrench } from "lucide-react";
import {
  adminDeleteToolEntity,
  adminListToolLibrary,
  adminSaveTool,
  adminSaveToolCategory,
  type ToolCategoryDTO,
  type ToolDTO,
} from "@/lib/tools.functions";

export const Route = createFileRoute("/admin/tools")({
  head: () => ({
    meta: [
      { title: "Tools Library · Oventric Admin" },
      { name: "description", content: "Manage tool categories and tools members can showcase." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminToolsPage,
});

const inputCls =
  "w-full rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500";

function AdminToolsPage() {
  const load = useServerFn(adminListToolLibrary);
  const saveCategory = useServerFn(adminSaveToolCategory);
  const saveTool = useServerFn(adminSaveTool);
  const remove = useServerFn(adminDeleteToolEntity);

  const [categories, setCategories] = useState<ToolCategoryDTO[]>([]);
  const [tools, setTools] = useState<ToolDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [catForm, setCatForm] = useState({ name: "", imageUrl: "", sortOrder: 100 });
  const [toolForm, setToolForm] = useState({
    categoryId: "",
    name: "",
    imageUrl: "",
    sortOrder: 100,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await load();
      setCategories(res.categories);
      setTools(res.tools);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the tools library.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const grouped = useMemo(
    () =>
      categories.map((c) => ({ category: c, items: tools.filter((t) => t.categoryId === c.id) })),
    [categories, tools],
  );

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <Wrench className="h-5 w-5 text-emerald-500" />
        <div className="min-w-0">
          <h1 className="text-lg font-black text-slate-900">Tools library</h1>
          <p className="text-sm text-slate-500">
            Categories and tools members pick from in their profile “Tools I use”.
          </p>
        </div>
      </header>

      {error && (
        <p className="rounded-[10px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* New category */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black text-slate-900">Add category</h2>
          <div className="mt-3 space-y-3">
            <input
              className={inputCls}
              placeholder="Category name (e.g. Design)"
              value={catForm.name}
              onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Image URL (optional)"
              value={catForm.imageUrl}
              onChange={(e) => setCatForm((f) => ({ ...f, imageUrl: e.target.value }))}
            />
            <input
              className={inputCls}
              type="number"
              placeholder="Sort order"
              value={catForm.sortOrder}
              onChange={(e) => setCatForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
            <button
              type="button"
              disabled={busy || !catForm.name.trim()}
              onClick={() =>
                run(async () => {
                  await saveCategory({
                    data: {
                      name: catForm.name,
                      imageUrl: catForm.imageUrl || null,
                      sortOrder: catForm.sortOrder,
                    },
                  });
                  setCatForm({ name: "", imageUrl: "", sortOrder: 100 });
                })
              }
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-emerald-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add category
            </button>
          </div>
        </section>

        {/* New tool */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black text-slate-900">Add tool</h2>
          <div className="mt-3 space-y-3">
            <select
              className={inputCls}
              value={toolForm.categoryId}
              onChange={(e) => setToolForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className={inputCls}
              placeholder="Tool name (e.g. Figma)"
              value={toolForm.name}
              onChange={(e) => setToolForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Logo image URL"
              value={toolForm.imageUrl}
              onChange={(e) => setToolForm((f) => ({ ...f, imageUrl: e.target.value }))}
            />
            <input
              className={inputCls}
              type="number"
              placeholder="Sort order"
              value={toolForm.sortOrder}
              onChange={(e) => setToolForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
            <button
              type="button"
              disabled={busy || !toolForm.name.trim() || !toolForm.categoryId}
              onClick={() =>
                run(async () => {
                  await saveTool({
                    data: {
                      categoryId: toolForm.categoryId,
                      name: toolForm.name,
                      imageUrl: toolForm.imageUrl || null,
                      sortOrder: toolForm.sortOrder,
                    },
                  });
                  setToolForm((f) => ({ ...f, name: "", imageUrl: "" }));
                })
              }
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-emerald-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add tool
            </button>
          </div>
        </section>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ category, items }) => (
            <section key={category.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {category.imageUrl && (
                    <img loading="lazy" decoding="async"
                      src={category.imageUrl}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded object-contain"
                    />
                  )}
                  <h3 className="truncate text-sm font-black text-slate-900">{category.name}</h3>
                  <span className="shrink-0 text-xs font-semibold text-slate-400">
                    {items.length} tools
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(`Delete “${category.name}” and its tools?`)) return;
                    void run(() => remove({ data: { kind: "category", id: category.id } }));
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className="relative flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <button
                      type="button"
                      aria-label={`Delete ${t.name}`}
                      disabled={busy}
                      onClick={() => void run(() => remove({ data: { kind: "tool", id: t.id } }))}
                      className="absolute right-1 top-1 rounded-full p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {t.imageUrl ? (
                      <img loading="lazy" decoding="async" src={t.imageUrl} alt="" className="h-8 w-8 object-contain" />
                    ) : (
                      <Wrench className="h-8 w-8 text-slate-400" />
                    )}
                    <span className="line-clamp-1 text-[11px] font-bold text-slate-600">
                      {t.name}
                    </span>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="col-span-full text-sm text-slate-400">No tools in this category.</p>
                )}
              </div>
            </section>
          ))}
          {grouped.length === 0 && (
            <p className="text-sm text-slate-500">No categories yet — add one above.</p>
          )}
        </div>
      )}
    </div>
  );
}

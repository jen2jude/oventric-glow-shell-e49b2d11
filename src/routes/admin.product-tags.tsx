import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Tag, Search, Trash2 } from "lucide-react";
import { adminListProductTags, adminRemoveProductTag } from "@/lib/admin-moderation.functions";

export const Route = createFileRoute("/admin/product-tags")({
  head: () => ({
    meta: [
      { title: "Product Tags · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminProductTagsPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Product tags error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

type Filter = "all" | "invalid" | "unavailable";

function AdminProductTagsPage() {
  const listFn = useServerFn(adminListProductTags);
  const removeFn = useServerFn(adminRemoveProductTag);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [err, setErr] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-product-tags"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });

  const remove = useMutation({
    mutationFn: (v: { id: string; kind: "media_tag" | "attachment"; reason: string }) =>
      removeFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product-tags"] }),
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : "Could not remove the tag"),
  });

  const rows = useMemo(() => {
    return (list.data ?? []).filter((r) => {
      if (filter === "invalid" && r.valid) return false;
      if (filter === "unavailable" && r.available) return false;
      if (!q.trim()) return true;
      const t = q.trim().toLowerCase();
      return (
        (r.productName ?? "").toLowerCase().includes(t) ||
        (r.sellerName ?? "").toLowerCase().includes(t) ||
        (r.postAuthorName ?? "").toLowerCase().includes(t) ||
        (r.postExcerpt ?? "").toLowerCase().includes(t)
      );
    });
  }, [list.data, q, filter]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black flex items-center gap-2">
          <Tag className="w-5 h-5 text-emerald-400" /> Product tags on posts
        </h1>
        <p className="text-sm text-slate-400">
          Every product tagged in a social post, with whether that listing still exists and is
          purchasable. Buying still goes through the normal checkout — removing a tag here only
          removes the tag.
        </p>
      </header>

      {err && (
        <div className="mb-3 rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product, seller, author or post text"
            className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-500"
          />
        </div>
        {(["all", "invalid", "unavailable"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-[10px] text-xs font-bold border ${
              filter === f
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border-white/10 text-slate-300"
            }`}
          >
            {f === "all" ? "All" : f === "invalid" ? "Missing product" : "Not purchasable"}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="p-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#141418] p-8 text-center text-sm text-slate-500">
          No tagged products match this view.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="rounded-xl border border-white/10 bg-[#141418] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white text-sm font-bold truncate">
                    {r.productName ?? "Listing no longer exists"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {r.kind === "media_tag" ? "Photo tag" : "Attached listing"} ·{" "}
                    {r.sellerName ? `Seller: ${r.sellerName} · ` : ""}
                    {r.productStatus ? `Status: ${r.productStatus}` : "No listing record"} ·{" "}
                    <span className={r.available ? "text-emerald-400" : "text-yellow-400"}>
                      {r.available ? "Purchasable" : "Not purchasable"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">
                    Post by {r.postAuthorName ?? "unknown"}
                    {r.postCreatedAt ? ` · ${new Date(r.postCreatedAt).toLocaleDateString()}` : ""}
                    {r.postExcerpt ? ` — "${r.postExcerpt}"` : ""}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const reason = window.prompt("Reason for removing this tag?") ?? "";
                    remove.mutate({ id: r.id, kind: r.kind, reason });
                  }}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-red-500/10 border border-red-500/40 text-xs text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove tag
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

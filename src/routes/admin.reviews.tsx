import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star, Search, Trash2 } from "lucide-react";
import { adminListReviews, adminDeleteReview } from "@/lib/admin-moderation.functions";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({
    meta: [{ title: "Reviews · Admin · Oventric" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminReviewsPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Reviews error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

function AdminReviewsPage() {
  const listFn = useServerFn(adminListReviews);
  const deleteFn = useServerFn(adminDeleteReview);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [rating, setRating] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all");
  const [err, setErr] = useState<string | null>(null);

  const list = useQuery({ queryKey: ["admin-reviews"], queryFn: () => listFn(), staleTime: 15_000 });

  const remove = useMutation({
    mutationFn: (v: { id: string; reason: string }) => deleteFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : "Could not remove the review"),
  });

  const rows = useMemo(() => {
    return (list.data ?? []).filter((r) => {
      if (rating !== "all" && r.rating !== Number(rating)) return false;
      if (!q.trim()) return true;
      const t = q.trim().toLowerCase();
      return (
        (r.productName ?? "").toLowerCase().includes(t) ||
        (r.sellerName ?? "").toLowerCase().includes(t) ||
        r.reviewerName.toLowerCase().includes(t) ||
        (r.comment ?? "").toLowerCase().includes(t)
      );
    });
  }, [list.data, q, rating]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400" /> Reviews
        </h1>
        <p className="text-sm text-slate-400">
          Customer reviews. Only buyers with a settled order can leave one — that rule is enforced by
          the backend and is not changed here. Removing a review is a moderation action and is
          recorded in the audit log.
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
            placeholder="Search product, seller, reviewer or text"
            className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-500"
          />
        </div>
        {(["all", "5", "4", "3", "2", "1"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRating(r)}
            className={`px-3 py-2 rounded-[10px] text-xs font-bold border ${
              rating === r
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-white/5 border-white/10 text-slate-300"
            }`}
          >
            {r === "all" ? "All" : `${r}★`}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="p-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#141418] p-8 text-center text-sm text-slate-500">
          No reviews match this view.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-[#141418] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white text-sm font-bold truncate">
                    {r.productName ?? "Product removed"}{" "}
                    <span className="text-amber-300 font-mono">{r.rating}★</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {r.reviewerName} · {r.sellerName ? `Seller: ${r.sellerName} · ` : ""}
                    {new Date(r.createdAt).toLocaleString()} ·{" "}
                    <span className={r.verifiedPurchase ? "text-emerald-400" : "text-yellow-400"}>
                      {r.verifiedPurchase ? "Verified purchase" : "No settled order found"}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-slate-300 mt-2">{r.comment}</p>}
                </div>
                <button
                  onClick={() => {
                    const reason = window.prompt("Reason for removing this review?") ?? "";
                    if (reason === null) return;
                    remove.mutate({ id: r.id, reason });
                  }}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-red-500/10 border border-red-500/40 text-xs text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

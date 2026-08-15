import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldAlert, CheckCircle2, Undo2, XCircle } from "lucide-react";
import {
  listOrderDisputes,
  resolveOrderDispute,
  type AdminDisputeDTO,
} from "@/lib/fulfilment.functions";

export const Route = createFileRoute("/admin/disputes")({
  head: () => ({
    meta: [
      { title: "Disputes · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDisputesPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Dispute queue error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

function AdminDisputesPage() {
  const listFn = useServerFn(listOrderDisputes);
  const resolveFn = useServerFn(resolveOrderDispute);
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const q = useQuery({ queryKey: ["admin-disputes"], queryFn: () => listFn(), staleTime: 10_000 });

  const act = async (
    d: AdminDisputeDTO,
    outcome: "release_seller" | "refund_buyer" | "dismiss",
  ) => {
    setBusy(d.id);
    try {
      await resolveFn({ data: { disputeId: d.id, outcome, note: notes[d.id] ?? "" } });
      toast.success("Dispute resolved.");
      await qc.invalidateQueries({ queryKey: ["admin-disputes"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const rows = (q.data ?? []).filter((d) => (filter === "open" ? d.status === "open" : true));

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-white font-black text-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" /> Order disputes
          </h1>
          <p className="text-xs text-slate-500">Mediate buyer/seller escrow conflicts.</p>
        </div>
        <div className="flex gap-1 rounded-[10px] border border-white/10 p-1 bg-[#1E1E24]">
          {(["open", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest ${
                filter === f ? "bg-white text-black" : "text-slate-400"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}
      {!q.isLoading && rows.length === 0 && (
        <div className="rounded-[10px] border border-white/10 bg-[#1E1E24] p-6 text-sm text-slate-400">
          No disputes here.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((d) => (
          <div key={d.id} className="rounded-[10px] border border-white/10 bg-[#1E1E24] p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="text-white font-bold text-sm truncate">{d.productName}</div>
                <div className="text-[11px] text-slate-500">
                  {d.buyerName} vs {d.sellerName} · Order {d.orderId.slice(0, 8)} ·{" "}
                  {new Date(d.createdAt).toLocaleString()}
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-slate-300">
                {d.status} · escrow {d.escrowStatus}
              </span>
            </div>
            <div className="text-[11px] uppercase tracking-widest text-red-300 mb-1">
              {d.reason.replace("_", " ")}
            </div>
            <p className="text-xs text-slate-300 whitespace-pre-wrap mb-2">{d.details}</p>
            {d.imageUrls.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {d.imageUrls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    <img
                      src={u}
                      alt="Dispute evidence"
                      className="w-20 h-20 object-cover rounded border border-white/10"
                    />
                  </a>
                ))}
              </div>
            )}
            {d.adminNote && (
              <div className="text-[11px] text-emerald-300 mb-2">Note: {d.adminNote}</div>
            )}

            {d.status === "open" && (
              <>
                <textarea
                  value={notes[d.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                  rows={2}
                  placeholder="Resolution note sent to both parties"
                  className="w-full mb-2 rounded-[10px] bg-[#121214] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-600"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => act(d, "release_seller")}
                    disabled={busy === d.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-bold text-black disabled:opacity-60"
                    style={{ backgroundColor: "#3b82f6" }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Release to seller
                  </button>
                  <button
                    onClick={() => act(d, "refund_buyer")}
                    disabled={busy === d.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-bold text-white disabled:opacity-60"
                    style={{ backgroundColor: "#dc2626" }}
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Refund buyer
                  </button>
                  <button
                    onClick={() => act(d, "dismiss")}
                    disabled={busy === d.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-semibold text-slate-300 bg-[#2A2A31] border border-white/10 disabled:opacity-60"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

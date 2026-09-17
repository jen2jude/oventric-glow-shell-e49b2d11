import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Ban, Clock, ExternalLink, Loader2, Search, ShieldCheck } from "lucide-react";
import {
  adminListSellerVerifications,
  adminDecideSellerVerification,
  type AdminVerificationRow,
} from "@/lib/admin-seller-verification.functions";
import { PROOF_DOC_LABELS } from "@/lib/seller-verification.functions";

export const Route = createFileRoute("/admin/seller-verification")({
  head: () => ({
    meta: [
      { title: "Seller Verification · Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VerificationPage,
});

const FILTERS = ["pending", "under_review", "approved", "rejected", "all"] as const;

function VerificationPage() {
  const listFn = useServerFn(adminListSellerVerifications);
  const decideFn = useServerFn(adminDecideSellerVerification);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [open, setOpen] = useState<AdminVerificationRow | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["admin-seller-verifications"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });

  const rows = useMemo(() => {
    const all = query.data ?? [];
    const term = q.trim().toLowerCase();
    return all.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!term) return true;
      return [r.legalName, r.brandName, r.username, r.displayName, r.contactEmail]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(term));
    });
  }, [query.data, q, filter]);

  const decide = async (decision: "approved" | "rejected" | "under_review") => {
    if (!open) return;
    if (decision === "rejected" && !note.trim()) {
      toast.error("Add a reason before rejecting");
      return;
    }
    setBusy(true);
    try {
      await decideFn({ data: { id: open.id, decision, note: note.trim() } });
      toast.success(`Request marked ${decision.replace("_", " ")}`);
      setOpen(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-seller-verifications"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-black flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-300" /> Seller verification
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review seller-submitted business details and documents. Approving grants the verified
            shop badge; every decision notifies the seller and is written to the audit log.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search seller, brand or email…"
            className="bg-[#141418] border border-white/10 rounded-[10px] pl-9 pr-4 py-2 text-sm text-white w-72"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold uppercase tracking-wider border ${
              filter === f
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                : "bg-[#141418] border-white/10 text-slate-400"
            }`}
          >
            {f.replace("_", " ")}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500 self-center">{rows.length} requests</span>
      </div>

      {query.isError && (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-[10px] p-3">
          {(query.error as Error).message}
        </div>
      )}

      {query.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 bg-[#141418] border border-white/10 rounded-2xl text-slate-500 text-sm">
          No verification requests in this view.
        </div>
      ) : (
        <div className="bg-[#141418] border border-white/10 rounded-xl divide-y divide-white/5">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setOpen(r);
                setNote(r.reviewNote ?? "");
              }}
              className="w-full text-left grid grid-cols-[1fr_1fr_130px_140px] gap-3 px-4 py-3 text-sm items-center hover:bg-white/5"
            >
              <div className="min-w-0">
                <div className="text-white truncate">{r.legalName ?? r.displayName ?? "Unknown"}</div>
                <div className="text-[11px] text-slate-500 truncate">@{r.username ?? "no-handle"}</div>
              </div>
              <div className="min-w-0 text-slate-300 truncate">{r.brandName ?? "—"}</div>
              <div className="text-[11px] capitalize text-slate-400">{r.businessType ?? "—"}</div>
              <div className="text-right text-[11px]">
                <StatusChip status={r.status} />
                <div className="text-slate-500 mt-1">{new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-end" onClick={() => setOpen(null)}>
          <aside
            className="w-full max-w-md h-full overflow-y-auto bg-[#141418] border-l border-white/10 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white text-lg font-black">{open.legalName ?? open.displayName}</h2>
            <p className="text-xs text-slate-500 mb-4">@{open.username ?? "no-handle"}</p>

            <dl className="rounded-xl border border-white/10 bg-black/20 divide-y divide-white/5 text-xs mb-4">
              <Row k="Status" v={open.status.replace("_", " ")} />
              <Row k="Brand" v={open.brandName ?? "—"} />
              <Row k="Contact email" v={open.contactEmail ?? "—"} />
              <Row k="Business type" v={open.businessType ?? "—"} />
              <Row k="Registration no." v={open.registrationNumber ?? "—"} />
              <Row k="Business address" v={open.businessAddress ?? "—"} />
              <Row k="Country" v={open.country ?? "—"} />
              <Row k="Website" v={open.website ?? "—"} />
              <Row k="Proof type" v={PROOF_DOC_LABELS[open.proofDocKind ?? ""] ?? "—"} />
              <Row k="Submitted" v={new Date(open.createdAt).toLocaleString()} />
              {open.note && <Row k="Seller note" v={open.note} />}
            </dl>

            <div className="flex flex-wrap gap-2 mb-4">
              {open.proofDocUrl && (
                <a
                  href={open.proofDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Proof of address
                </a>
              )}
              {open.passportPhotoUrl && (
                <a
                  href={open.passportPhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Passport photo
                </a>
              )}
            </div>

            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              Review note (required to reject)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-1.5 w-full rounded-[10px] bg-black/30 border border-white/10 p-3 text-sm text-white"
            />

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => decide("approved")}
                disabled={busy}
                className="px-3 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <BadgeCheck className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => decide("under_review")}
                disabled={busy}
                className="px-3 py-2 rounded-[10px] bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" /> Under review
              </button>
              <button
                onClick={() => decide("rejected")}
                disabled={busy}
                className="px-3 py-2 rounded-[10px] bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "text-slate-300",
    under_review: "text-amber-300",
    approved: "text-emerald-300",
    rejected: "text-rose-300",
  };
  return <span className={`font-bold ${map[status] ?? "text-slate-400"}`}>{status.replace("_", " ")}</span>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-200 text-right break-words">{v}</span>
    </div>
  );
}

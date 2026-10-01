import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Flag,
  Check,
  EyeOff,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ChevronDown,
  MessageSquareQuote,
} from "lucide-react";
import {
  listPendingReports,
  resolveReport,
  type AdminReport,
  type ReportStatus,
} from "@/lib/admin-reports.functions";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/oventric/Header";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Admin · Report Review · Oventric" },
      { name: "description", content: "Review pending user reports and moderate flagged content." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminReportsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen bg-[#121214] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">Couldn't load reports</h2>
          <p className="text-sm text-slate-400 mt-1">{(error as Error).message}</p>
          <button
            onClick={() => {
              reset();
              router.invalidate();
            }}
            className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-[10px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6 text-slate-300">No reports found.</div>,
});

type Filter = "pending" | "approved" | "hidden" | "all";

const REASON_LABEL: Record<AdminReport["reason"], string> = {
  spam: "Spam",
  harassment: "Harassment",
  ip: "IP violation",
  scam: "Scam",
};

const REASON_DESCRIPTION: Record<AdminReport["reason"], string> = {
  spam: "Unsolicited or repetitive content that clutters the feed.",
  harassment: "Targeted abuse, threats, or hateful behavior toward a user.",
  ip: "Intellectual-property violation — copyrighted or stolen work.",
  scam: "Fraudulent offers, phishing, or attempts to deceive users.",
};

const STATUS_STYLE: Record<ReportStatus, string> = {
  pending: "bg-yellow-500/10 border-yellow-500/40 text-yellow-300",
  approved: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
  hidden: "bg-red-500/10 border-red-500/40 text-red-300",
};

function AdminReportsPage() {
  const listFn = useServerFn(listPendingReports);
  const resolveFn = useServerFn(resolveReport);

  const [filter, setFilter] = useState<Filter>("pending");
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === false) {
      setLoading(false);
      return;
    }
    if (session !== true) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listFn({ data: { status: filter } })
      .then((res) => {
        if (!cancelled) setReports(res.reports);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load reports");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, listFn, session]);

  const signIn = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) setError(error.message);
  };

  const act = async (report: AdminReport, action: "approve" | "hide" | "reset") => {
    setBusyId(report.id);
    setError(null);
    try {
      const res = await resolveFn({ data: { reportId: report.id, action } });
      setReports((prev) => {
        if (!prev) return prev;
        // If filter no longer matches new status, drop the row from list
        if (filter !== "all" && res.report.status !== filter) {
          return prev.filter((r) => r.id !== report.id);
        }
        return prev.map((r) => (r.id === report.id ? res.report : r));
      });
    } catch (e) {
      setError((e as Error).message || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#121214] text-slate-200">
      <Header forceSiteNavbar={!useIsAppShell()} />
      <main className="max-w-4xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-black">Report Review</h1>
            <p className="text-xs text-slate-400">
              Approve keeps the post live. Hide takes it down and marks the report resolved.
            </p>
          </div>
        </div>

        {session === false && (
          <div className="rounded-xl border border-white/10 bg-[#1E1E24] p-6 text-center">
            <p className="text-sm text-slate-300">
              You need to sign in as an admin to review reports.
            </p>
            <button
              onClick={signIn}
              className="mt-3 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-[10px]"
            >
              Sign in
            </button>
          </div>
        )}

        {session && (
          <>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 border-b border-white/10 mb-4">
              {(["pending", "hidden", "approved", "all"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    filter === f
                      ? "text-white border-b-2 border-emerald-400"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : reports && reports.length > 0 ? (
              <ul className="space-y-3">
                {reports.map((r) => {
                  const isOpen = expandedId === r.id;
                  return (
                    <li key={r.id} className="bg-[#1E1E24] border border-white/10 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 shrink-0 rounded-[10px] bg-red-500/10 border border-red-500/40 flex items-center justify-center">
                          <Flag className="w-4 h-4 text-red-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center rounded-[10px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status]}`}
                            >
                              {r.status}
                            </span>
                            <span className="inline-flex items-center rounded-[10px] border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-200">
                              {REASON_LABEL[r.reason]}
                            </span>
                            <span className="text-[11px] text-slate-500">·</span>
                            <span className="text-[11px] text-slate-500 capitalize">
                              {r.target_kind}
                            </span>
                            <span className="text-[11px] text-slate-500">·</span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(r.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-white font-semibold break-all">
                            {r.target_author ? `${r.target_author} · ` : ""}
                            {r.target_id}
                          </div>
                          {r.target_preview && (
                            <div className="mt-2 rounded-[10px] border border-white/10 bg-black/40 p-2.5">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                Reported {r.target_kind === "blog_comment" ? "comment" : "content"}
                              </div>
                              <p
                                className={`mt-0.5 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap ${isOpen ? "" : "line-clamp-3"}`}
                              >
                                {r.target_preview}
                              </p>
                            </div>
                          )}
                          {r.note ? (
                            <div className="mt-2 flex items-start gap-2 rounded-[10px] border border-white/10 bg-black/30 p-2.5">
                              <MessageSquareQuote className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-bold">
                                  Reporter's note
                                </div>
                                <p
                                  className={`mt-0.5 text-xs text-slate-200 leading-relaxed break-words ${isOpen ? "" : "line-clamp-2"}`}
                                >
                                  {r.note}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] italic text-slate-500">
                              No custom note provided by the reporter.
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setExpandedId(isOpen ? null : r.id)}
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Collapse details" : "Expand details"}
                          className="p-1.5 rounded-[10px] hover:bg-white/5 text-slate-400"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>

                      {isOpen && (
                        <dl className="mt-3 ml-11 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-[10px] border border-white/10 bg-black/20 p-3 text-xs">
                          <div>
                            <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                              Reason
                            </dt>
                            <dd className="mt-0.5 text-slate-200 font-semibold">
                              {REASON_LABEL[r.reason]}
                            </dd>
                            <dd className="text-[11px] text-slate-400 mt-0.5">
                              {REASON_DESCRIPTION[r.reason]}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                              Target
                            </dt>
                            <dd className="mt-0.5 text-slate-200 capitalize">{r.target_kind}</dd>
                            <dd className="text-[11px] text-slate-500 font-mono break-all">
                              {r.target_id}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                              Submitted
                            </dt>
                            <dd className="mt-0.5 text-slate-200">
                              {new Date(r.created_at).toLocaleString()}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                              Resolution
                            </dt>
                            <dd className="mt-0.5 text-slate-200">
                              {r.resolved_at ? new Date(r.resolved_at).toLocaleString() : "—"}
                            </dd>
                            {r.resolved_by && (
                              <dd className="text-[11px] text-slate-500 font-mono break-all">
                                by {r.resolved_by}
                              </dd>
                            )}
                          </div>
                        </dl>
                      )}

                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {r.status !== "approved" && (
                          <button
                            onClick={() => act(r, "approve")}
                            disabled={busyId === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-bold"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                        )}
                        {r.status !== "hidden" && (
                          <button
                            onClick={() => act(r, "hide")}
                            disabled={busyId === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-red-500/15 border border-red-500/50 hover:bg-red-500/25 disabled:opacity-40 text-red-200 text-xs font-bold"
                          >
                            <EyeOff className="w-3.5 h-3.5" /> Hide
                          </button>
                        )}
                        {r.status !== "pending" && (
                          <button
                            onClick={() => act(r, "reset")}
                            disabled={busyId === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-white/10 hover:bg-white/5 disabled:opacity-40 text-slate-300 text-xs font-semibold"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset to pending
                          </button>
                        )}
                        {busyId === r.id && (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-xl border border-white/10 bg-[#1E1E24] p-10 text-center">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300">
                  No {filter === "all" ? "" : filter} reports.
                </p>
                <p className="text-xs text-slate-500 mt-1">You're all caught up.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

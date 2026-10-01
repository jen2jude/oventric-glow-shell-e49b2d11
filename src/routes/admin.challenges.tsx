import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EyeOff, Eye, Loader2, Plus, Star, Trash2, Trophy } from "lucide-react";
import {
  adminDeleteChallenge,
  adminListChallenges,
  adminListChallengeSubmissions,
  adminModerateSubmission,
  adminSaveChallenge,
  adminSetChallengeStatus,
  type AdminSubmissionDTO,
  type ChallengeDTO,
  type ChallengeStatus,
} from "@/lib/challenges.functions";

export const Route = createFileRoute("/admin/challenges")({
  head: () => ({
    meta: [
      { title: "Creator Challenges · Oventric Admin" },
      { name: "description", content: "Create, publish, close and moderate Creator Challenges." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminChallengesPage,
});

const CATEGORIES = ["Video", "Design", "AI", "Photography", "Writing", "Marketing", "Education", "Development", "Animation", "Music", "Digital Products"];
const inputCls = "w-full rounded-[10px] border border-slate-700 bg-[#0E0E10] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500";

type Form = {
  id: string | null; title: string; description: string; coverUrl: string; category: string; tools: string;
  rules: string; submissionRequirements: string; startsAt: string; endsAt: string; prizeTitle: string; prizeDetails: string;
};
const toLocal = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const blank = (): Form => ({ id: null, title: "", description: "", coverUrl: "", category: "", tools: "", rules: "", submissionRequirements: "", startsAt: toLocal(new Date().toISOString()), endsAt: toLocal(new Date(Date.now() + 14 * 864e5).toISOString()), prizeTitle: "", prizeDetails: "" });
const fromDTO = (c: ChallengeDTO): Form => ({ id: c.id, title: c.title, description: c.description, coverUrl: c.coverUrl ?? "", category: c.category ?? "", tools: c.requiredTools.join(", "), rules: c.rules, submissionRequirements: c.submissionRequirements, startsAt: toLocal(c.startsAt), endsAt: toLocal(c.endsAt), prizeTitle: c.prizeTitle ?? "", prizeDetails: c.prizeDetails ?? "" });

function AdminChallengesPage() {
  const load = useServerFn(adminListChallenges);
  const save = useServerFn(adminSaveChallenge);
  const setStatus = useServerFn(adminSetChallengeStatus);
  const del = useServerFn(adminDeleteChallenge);
  const listSubs = useServerFn(adminListChallengeSubmissions);
  const moderate = useServerFn(adminModerateSubmission);

  const [items, setItems] = useState<ChallengeDTO[]>([]);
  const [perms, setPerms] = useState({ canManage: false, canModerate: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [subsFor, setSubsFor] = useState<ChallengeDTO | null>(null);
  const [subs, setSubs] = useState<AdminSubmissionDTO[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { const r = await load(); setItems(r.challenges); setPerms(r.perms); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load challenges."); }
    finally { setLoading(false); }
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); } finally { setBusy(false); }
  };

  const submit = () => form && run(async () => {
    await save({ data: {
      id: form.id, title: form.title, description: form.description, coverUrl: form.coverUrl.trim() || null, category: form.category || null,
      requiredTools: form.tools.split(",").map((t) => t.trim()).filter(Boolean), rules: form.rules, submissionRequirements: form.submissionRequirements,
      startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), prizeTitle: form.prizeTitle || null, prizeDetails: form.prizeDetails || null,
    } });
    setForm(null);
  });

  const openSubs = async (c: ChallengeDTO) => { setSubsFor(c); setSubs([]); try { setSubs(await listSubs({ data: { challengeId: c.id } })); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load entries."); } };
  const mod = async (id: string, patch: { status?: "visible" | "hidden"; featured?: boolean }) => {
    setBusy(true);
    try { await moderate({ data: { id, ...patch } }); if (subsFor) setSubs(await listSubs({ data: { challengeId: subsFor.id } })); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed."); } finally { setBusy(false); }
  };

  const statusBtn = (c: ChallengeDTO, s: ChallengeStatus, label: string) => (
    <button disabled={busy} onClick={() => run(() => setStatus({ data: { id: c.id, status: s } }))} className="rounded-[10px] border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/5">{label}</button>
  );
  const f = (k: keyof Form) => ({ value: form?.[k] ?? "", onChange: (e: { target: { value: string } }) => setForm((p) => (p ? { ...p, [k]: e.target.value } : p)) });

  return (
    <div className="space-y-6 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white"><Trophy className="h-6 w-6 text-amber-400" /> Creator Challenges</h1>
          <p className="text-sm text-slate-400">Prizes are information only — no automatic payouts are made from here.</p>
        </div>
        {perms.canManage && <button onClick={() => setForm(blank())} className="inline-flex items-center gap-1.5 rounded-[10px] bg-emerald-500 px-3 py-2 text-sm font-bold text-black"><Plus className="h-4 w-4" /> New challenge</button>}
      </div>
      {error && <div className="rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

      {form && (
        <div className="grid gap-3 rounded-[10px] border border-slate-800 bg-[#141418] p-4 md:grid-cols-2">
          <label className="md:col-span-2 text-xs font-semibold">Title<input className={inputCls} maxLength={120} {...f("title")} /></label>
          <label className="md:col-span-2 text-xs font-semibold">Description<textarea rows={3} className={inputCls} {...f("description")} /></label>
          <label className="text-xs font-semibold">Cover image URL (https)<input className={inputCls} placeholder="https://…" {...f("coverUrl")} /></label>
          <label className="text-xs font-semibold">Category<select className={inputCls} {...f("category")}><option value="">None</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="md:col-span-2 text-xs font-semibold">Required tools (comma separated)<input className={inputCls} placeholder="Canva, CapCut" {...f("tools")} /></label>
          <label className="text-xs font-semibold">Rules<textarea rows={4} className={inputCls} {...f("rules")} /></label>
          <label className="text-xs font-semibold">Submission requirements<textarea rows={4} className={inputCls} {...f("submissionRequirements")} /></label>
          <label className="text-xs font-semibold">Starts<input type="datetime-local" className={inputCls} {...f("startsAt")} /></label>
          <label className="text-xs font-semibold">Ends<input type="datetime-local" className={inputCls} {...f("endsAt")} /></label>
          <label className="text-xs font-semibold">Prize / reward (optional)<input className={inputCls} maxLength={120} {...f("prizeTitle")} /></label>
          <label className="text-xs font-semibold">Prize details (optional)<input className={inputCls} {...f("prizeDetails")} /></label>
          <div className="md:col-span-2 flex gap-2">
            <button disabled={busy || form.title.trim().length < 2} onClick={submit} className="rounded-[10px] bg-emerald-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
            <button onClick={() => setForm(null)} className="rounded-[10px] border border-slate-700 px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : items.length === 0 ? (
        <p className="text-sm text-slate-400">No challenges yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-slate-800 bg-[#141418] p-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-white">{c.title}</div>
                <div className="text-xs text-slate-400">
                  <span className="uppercase">{c.status}</span> · {c.phase} · {new Date(c.startsAt).toLocaleDateString()} – {new Date(c.endsAt).toLocaleDateString()} · {c.submissionCount} entries · {c.participantCount} creators
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.status !== "draft" && <Link to="/creators/challenges/$id" params={{ id: c.id }} className="rounded-[10px] border border-slate-700 px-2.5 py-1 text-xs">View</Link>}
                <button onClick={() => openSubs(c)} className="rounded-[10px] border border-slate-700 px-2.5 py-1 text-xs">Entries</button>
                {perms.canManage && (
                  <>
                    <button onClick={() => setForm(fromDTO(c))} className="rounded-[10px] border border-slate-700 px-2.5 py-1 text-xs">Edit</button>
                    {c.status === "draft" && statusBtn(c, "published", "Publish")}
                    {c.status === "published" && statusBtn(c, "closed", "Close")}
                    {c.status === "closed" && statusBtn(c, "published", "Reopen")}
                    {c.status !== "draft" && statusBtn(c, "draft", "Unpublish")}
                    {c.status === "draft" && <button aria-label="Delete draft" disabled={busy} onClick={() => confirm("Delete this draft challenge?") && run(() => del({ data: { id: c.id } }))} className="rounded-[10px] border border-red-500/40 px-2 py-1 text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {subsFor && (
        <div className="rounded-[10px] border border-slate-800 bg-[#141418] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-white">Entries · {subsFor.title}</h2>
            <button onClick={() => setSubsFor(null)} className="text-xs text-slate-400">Close</button>
          </div>
          {subs.length === 0 ? <p className="text-sm text-slate-400">No entries yet.</p> : (
            <div className="space-y-2">
              {subs.map((s) => (
                <div key={s.id} className={`flex flex-wrap items-center gap-2 rounded-[10px] border border-slate-800 p-2 ${s.status === "hidden" ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1 text-sm"><span className="font-semibold text-white">{s.postTitle}</span> <span className="text-slate-400">by {s.authorName}</span>{s.featured && <span className="ml-2 rounded bg-amber-400/20 px-1.5 text-[10px] font-bold text-amber-300">FEATURED</span>}{s.status === "hidden" && <span className="ml-2 rounded bg-red-500/20 px-1.5 text-[10px] font-bold text-red-300">HIDDEN</span>}</div>
                  <button disabled={busy || s.status === "hidden"} onClick={() => mod(s.id, { featured: !s.featured })} className="inline-flex items-center gap-1 rounded-[10px] border border-slate-700 px-2 py-1 text-xs disabled:opacity-40"><Star className="h-3.5 w-3.5" /> {s.featured ? "Unfeature" : "Feature"}</button>
                  <button disabled={busy} onClick={() => mod(s.id, { status: s.status === "hidden" ? "visible" : "hidden" })} className="inline-flex items-center gap-1 rounded-[10px] border border-slate-700 px-2 py-1 text-xs">{s.status === "hidden" ? <><Eye className="h-3.5 w-3.5" /> Restore</> : <><EyeOff className="h-3.5 w-3.5" /> Hide</>}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

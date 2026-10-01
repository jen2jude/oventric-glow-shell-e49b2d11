import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarClock, Check, Gift, Loader2, Plus, Share2, Star, Trophy, Users, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { Header } from "@/components/oventric/Header";
import { CreatorCard } from "./CreatorFeed";
import { CreatorPublishModal } from "./CreatorPublishModal";
import {
  getMyChallengeEntries,
  submitToChallenge,
  withdrawChallengeSubmission,
  type ChallengeDetailDTO,
  type ChallengeDTO,
} from "@/lib/challenges.functions";

export function deadlineLabel(c: Pick<ChallengeDTO, "phase" | "startsAt" | "endsAt">) {
  if (c.phase === "ended") return `Ended ${new Date(c.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  if (c.phase === "upcoming") return `Opens ${new Date(c.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const ms = new Date(c.endsAt).getTime() - Date.now();
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  return d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h left` : "Ends soon";
}

/** Public challenge page: brief, rules, deadline, entries, participants. */
export function CreatorChallengePage({ detail }: { detail: ChallengeDetailDTO }) {
  const isApp = useIsAppShell();
  const navigate = useNavigate();
  const router = useRouter();
  const { isAuthenticated, openGate } = useAuthGate();
  const [meId, setMeId] = useState<string | null>(null);
  const [enterOpen, setEnterOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const { challenge: c, submissions, participants } = detail;

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null)); }, [isAuthenticated]);

  const t = isApp
    ? { page: "fixed inset-0 overflow-y-auto overscroll-contain bg-[#070A08] text-white [-webkit-overflow-scrolling:touch]", muted: "text-white/55", card: "bg-white/[0.04] border-white/10", cta: "bg-[#E5484D] text-white", ghost: "border-white/15 text-white", chip: "bg-white/[0.06] text-white/80", accent: "text-[#E5484D]" }
    : { page: "min-h-screen bg-white text-slate-900", muted: "text-slate-500", card: "bg-white border-slate-200 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)]", cta: "bg-slate-900 text-white", ghost: "border-slate-200 text-slate-900", chip: "bg-amber-50 text-amber-800", accent: "text-amber-500" };

  const back = () => (window.history.length > 1 ? window.history.back() : navigate({ to: "/creators" }));
  const share = async () => {
    const url = `${window.location.origin}/creators/challenges/${c.id}`;
    try {
      if (navigator.share) await navigator.share({ title: c.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  };
  const enter = () => (isAuthenticated ? setEnterOpen(true) : openGate("generic"));
  const visible = submissions.filter((s) => !hidden.has(s.post.id));
  const statusTag = c.phase === "active" ? "Open" : c.phase === "upcoming" ? "Upcoming" : "Closed";

  return (
    <div className={t.page}>
      {!isApp && <Header />}
      <div className={`mx-auto ${isApp ? "px-4 pb-28 pt-[calc(0.75rem+env(safe-area-inset-top))]" : "max-w-5xl px-4 py-6"}`}>
        <div className="mb-3 flex items-center justify-between">
          <button onClick={back} aria-label="Back" className="-ml-2 rounded-full p-2"><ArrowLeft className="h-5 w-5" /></button>
          <button onClick={share} aria-label="Share challenge" className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12px] font-bold ${t.ghost}`}><Share2 className="h-3.5 w-3.5" /> Share</button>
        </div>

        <div className={`overflow-hidden rounded-[10px] border ${t.card} ${isApp ? "" : "md:grid md:grid-cols-[1.1fr_1fr]"}`}>
          <div className="relative aspect-[16/9] bg-gradient-to-br from-[#E5484D]/30 to-black/40 md:aspect-auto">
            {c.coverUrl ? <img src={c.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Trophy className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-white/60" />}
            <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${c.phase === "active" ? "bg-[#E5484D] text-white" : "bg-black/60 text-white"}`}>{statusTag}</span>
          </div>
          <div className="p-4 md:p-6">
            {c.category && <div className={`text-[11px] font-bold uppercase tracking-wider ${t.accent}`}>{c.category}</div>}
            <h1 className={`mt-1 font-black leading-tight ${isApp ? "text-[22px]" : "text-3xl"}`}>{c.title}</h1>
            {c.description && <p className={`mt-2 whitespace-pre-line text-[14px] ${t.muted}`}>{c.description}</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${t.chip}`}><CalendarClock className="h-3.5 w-3.5" /> {deadlineLabel(c)}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${t.chip}`}><Users className="h-3.5 w-3.5" /> {c.participantCount} creator{c.participantCount === 1 ? "" : "s"}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${t.chip}`}>{c.submissionCount} entr{c.submissionCount === 1 ? "y" : "ies"}</span>
            </div>
            {c.requiredTools.length > 0 && (
              <div className={`mt-3 flex flex-wrap items-center gap-1.5 text-[12px] ${t.muted}`}><Wrench className="h-3.5 w-3.5" /> {c.requiredTools.join(" · ")}</div>
            )}
            {c.prizeTitle && (
              <div className={`mt-4 rounded-[10px] border p-3 ${t.card}`}>
                <div className="flex items-center gap-1.5 text-[13px] font-bold"><Gift className={`h-4 w-4 ${t.accent}`} /> {c.prizeTitle}</div>
                {c.prizeDetails && <p className={`mt-1 text-[12px] ${t.muted}`}>{c.prizeDetails}</p>}
              </div>
            )}
            <div className="mt-4">
              {c.phase === "active" ? (
                <button onClick={enter} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] px-4 py-3 text-[14px] font-bold md:w-auto ${t.cta}`}><Trophy className="h-4 w-4" /> Enter challenge</button>
              ) : (
                <p className={`text-[13px] font-semibold ${t.muted}`}>{c.phase === "upcoming" ? "Entries open when the challenge starts." : "This challenge is closed to new entries."}</p>
              )}
            </div>
          </div>
        </div>

        {(c.rules || c.submissionRequirements) && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {c.rules && <div className={`rounded-[10px] border p-4 ${t.card}`}><h2 className="mb-1.5 text-[14px] font-black">Rules</h2><p className={`whitespace-pre-line text-[13px] ${t.muted}`}>{c.rules}</p></div>}
            {c.submissionRequirements && <div className={`rounded-[10px] border p-4 ${t.card}`}><h2 className="mb-1.5 text-[14px] font-black">How to submit</h2><p className={`whitespace-pre-line text-[13px] ${t.muted}`}>{c.submissionRequirements}</p></div>}
          </div>
        )}

        {participants.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[15px] font-black">Participating creators</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {participants.map((p) => (
                <Link key={p.userId} to="/creators/$handle" params={{ handle: p.slug ? `@${p.slug}` : p.userId }} className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
                  <span className="h-12 w-12 overflow-hidden rounded-full bg-white/10">{p.avatarUrl && <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />}</span>
                  <span className="w-full truncate text-[11px] font-semibold">{p.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 text-[15px] font-black">Submissions</h2>
          {visible.length === 0 ? (
            <p className={`rounded-[10px] border p-6 text-center text-[13px] ${t.card} ${t.muted}`}>No entries yet{c.phase === "active" ? " — be the first." : "."}</p>
          ) : (
            <div className={isApp ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
              {visible.map((s) => (
                <div key={s.id} className="relative">
                  {s.featured && <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-black"><Star className="h-3 w-3" /> Featured</span>}
                  <CreatorCard
                    post={s.post}
                    isOwner={meId === s.post.author.userId}
                    onRecordedView={() => {}}
                    onHide={(id) => setHidden((h) => new Set(h).add(id))}
                    onDeleted={(id) => setHidden((h) => new Set(h).add(id))}
                    onUpdated={() => router.invalidate()}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {enterOpen && <EnterSheet challenge={c} isApp={isApp} onClose={() => setEnterOpen(false)} onChanged={() => router.invalidate()} />}
    </div>
  );
}

function EnterSheet({ challenge, isApp, onClose, onChanged }: { challenge: ChallengeDTO; isApp: boolean; onClose: () => void; onChanged: () => void }) {
  const load = useServerFn(getMyChallengeEntries);
  const submit = useServerFn(submitToChallenge);
  const withdraw = useServerFn(withdrawChallengeSubmission);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyChallengeEntries>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);

  const refresh = useCallback(async () => { try { setData(await load({ data: { challengeId: challenge.id } })); } catch { toast.error("Couldn't load your posts"); } }, [load, challenge.id]);
  useEffect(() => { void refresh(); }, [refresh]);

  const toggle = async (postId: string) => {
    const entry = data?.entries.find((e) => e.postId === postId);
    setBusy(postId);
    try {
      if (entry) { await withdraw({ data: { id: entry.id } }); toast.success("Entry withdrawn"); }
      else { await submit({ data: { challengeId: challenge.id, postId } }); toast.success("Entered! Your post is now in the challenge."); }
      await refresh(); onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(null); }
  };

  const s = isApp
    ? { panel: "bg-[#0E0E10] text-white border-white/10", row: "border-white/10", muted: "text-white/55", cta: "bg-[#E5484D] text-white", ghost: "border-white/15" }
    : { panel: "bg-white text-slate-900 border-slate-200", row: "border-slate-200", muted: "text-slate-500", cta: "bg-slate-900 text-white", ghost: "border-slate-200" };

  return createPortal(
    <>
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`flex max-h-[90dvh] w-full flex-col rounded-t-[18px] border md:max-w-lg md:rounded-[14px] ${s.panel}`}>
        <div className="flex items-center justify-between p-4 pb-2">
          <div><div className="text-[15px] font-black">Enter challenge</div><div className={`text-[12px] ${s.muted}`}>Pick a published post, or create a new one.</div></div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-4">
          <button onClick={() => setComposer(true)} className={`mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] px-3 py-2.5 text-[13px] font-bold ${s.cta}`}><Plus className="h-4 w-4" /> Create new post</button>
          {!data ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : data.posts.length === 0 ? (
            <p className={`py-6 text-center text-[13px] ${s.muted}`}>You haven't published any Creator posts yet.</p>
          ) : data.posts.map((p) => {
            const entry = data.entries.find((e) => e.postId === p.id);
            return (
              <div key={p.id} className={`flex items-center gap-3 border-b py-2.5 ${s.row}`}>
                <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{p.title}</div>{entry?.hidden && <div className="text-[11px] text-amber-500">Hidden by moderators</div>}</div>
                <button disabled={busy === p.id} onClick={() => toggle(p.id)} className={`inline-flex shrink-0 items-center gap-1 rounded-[10px] border px-3 py-1.5 text-[12px] font-bold ${entry ? s.ghost : s.cta}`}>
                  {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : entry ? <><Check className="h-3.5 w-3.5" /> Entered · Withdraw</> : "Enter"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    <CreatorPublishModal open={composer} onClose={() => setComposer(false)} onPublished={() => void refresh()} />
    </>,
    document.body,
  );
}

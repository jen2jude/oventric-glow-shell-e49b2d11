import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Gift, Loader2, Trophy, Users } from "lucide-react";
import { listChallenges } from "@/lib/challenges.functions";
import { deadlineLabel } from "./CreatorChallengePage";

/** Challenges tab: open first, then upcoming, then past. Real data only. */
export function CreatorChallengesList({ isApp }: { isApp: boolean }) {
  const fetch = useServerFn(listChallenges);
  const { data, isLoading } = useQuery({ queryKey: ["creator-challenges"], queryFn: () => fetch(), staleTime: 60_000 });
  const t = isApp
    ? { card: "bg-white/[0.04] border-white/10 text-white", muted: "text-white/55", tag: "bg-[#E5484D] text-white", accent: "text-[#E5484D]" }
    : { card: "bg-white border-slate-200 text-slate-900 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)]", muted: "text-slate-500", tag: "bg-amber-400 text-black", accent: "text-amber-500" };

  if (isLoading) return <Loader2 className={`mx-auto h-5 w-5 animate-spin ${t.muted}`} />;
  if (!data?.length)
    return <div className={`rounded-[10px] border border-dashed px-6 py-10 text-center text-[13.5px] ${t.card} ${t.muted}`}>No challenges right now. New themed briefs will appear here.</div>;

  return (
    <div className={isApp ? "space-y-3" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
      {data.map((c) => (
        <Link key={c.id} to="/creators/challenges/$id" params={{ id: c.id }} className={`block overflow-hidden rounded-[10px] border ${t.card} ${c.phase === "ended" ? "opacity-75" : ""}`}>
          <div className={`relative bg-gradient-to-br from-[#E5484D]/30 to-black/40 ${isApp ? "aspect-[21/9]" : "aspect-[16/9]"}`}>
            {c.coverUrl ? <img src={c.coverUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <Trophy className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 text-white/60" />}
            <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${c.phase === "active" ? t.tag : "bg-black/60 text-white"}`}>
              {c.phase === "active" ? "Open" : c.phase === "upcoming" ? "Upcoming" : "Closed"}
            </span>
          </div>
          <div className="p-3">
            {c.category && <div className={`text-[10px] font-bold uppercase tracking-wider ${t.accent}`}>{c.category}</div>}
            <div className="line-clamp-2 text-[15px] font-black leading-snug">{c.title}</div>
            <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-semibold ${t.muted}`}>
              <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{deadlineLabel(c)}</span>
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.participantCount}</span>
              {c.prizeTitle && <span className="inline-flex items-center gap-1"><Gift className="h-3.5 w-3.5" />{c.prizeTitle}</span>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

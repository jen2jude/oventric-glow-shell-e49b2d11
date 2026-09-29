import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Loader2, Search, ShoppingBag, Star, Trophy, Users, X } from "lucide-react";
import { AppSheet } from "./AppSheet";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { getTopSellers, type TopSellerDTO } from "@/lib/marketplace.functions";

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);

const MEDALS = [
  "from-[#F2C14E] to-[#B8862B] text-[#2A1D00]",
  "from-[#D9DDE3] to-[#8C939C] text-[#15171A]",
  "from-[#E0955A] to-[#9A5A2C] text-[#241206]",
];

export function AppSellerLeaderboardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const load = useServerFn(getTopSellers);
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["app-seller-leaderboard"],
    queryFn: () => load(),
    enabled: open,
    staleTime: 60_000,
  });

  const ranked = useMemo(
    () =>
      [...((data ?? []) as TopSellerDTO[])].sort(
        (a, b) => b.salesCount - a.salesCount || b.followersCount - a.followersCount,
      ),
    [data],
  );
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ranked
      .map((s, i) => ({ s, rank: i + 1 }))
      .filter(({ s }) => !t || s.name.toLowerCase().includes(t) || s.slug?.toLowerCase().includes(t));
  }, [ranked, q]);
  const podium = ranked.slice(0, 3);

  const header = (
    <div className="border-b border-white/[0.06] px-4 pb-3">
      <div className="flex items-center gap-3 py-2">
        <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#E5484D]/15 text-[#FF8A8E]">
          <Trophy className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold">Seller leaderboard</h2>
          <p className="text-[11px] text-white/45">Ranked by live sales, then followers</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="mt-1 flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2">
        <Search className="h-4 w-4 text-white/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sellers"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
        />
      </label>
    </div>
  );

  return (
    <AppSheet open={open} onClose={onClose} tall header={header}>
      <div className="px-4 pb-10 pt-4">
        {isLoading ? (
          <div className="grid place-items-center py-16 text-white/50">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            {!q && podium.length > 0 && (
              <div className="mb-5 grid grid-cols-3 items-end gap-2">
                {[1, 0, 2].map((idx) => {
                  const s = podium[idx];
                  if (!s) return <div key={idx} />;
                  return (
                    <Link
                      key={s.id}
                      to="/shop/$id"
                      params={{ id: s.slug || s.id }}
                      onClick={onClose}
                      className={`flex flex-col items-center rounded-[10px] border border-white/[0.07] bg-[#151619] px-2 pb-3 ${idx === 0 ? "pt-4" : "pt-3"}`}
                    >
                      <div className="relative">
                        <div className={`overflow-hidden rounded-full border-2 border-white/10 ${idx === 0 ? "h-16 w-16" : "h-12 w-12"}`}>
                          <AvatarImage src={s.avatarUrl} alt={s.name} />
                        </div>
                        <span className={`absolute -bottom-1 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-gradient-to-b text-[10px] font-black ${MEDALS[idx]}`}>
                          {idx + 1}
                        </span>
                      </div>
                      <p className="mt-2.5 w-full truncate text-center text-xs font-bold">{s.name}</p>
                      <p className="text-[10px] text-white/45">{compact(s.salesCount)} sales</p>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              {filtered.map(({ s, rank }) => (
                <Link
                  key={s.id}
                  to="/shop/$id"
                  params={{ id: s.slug || s.id }}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3 active:scale-[0.99]"
                >
                  <span className={`w-6 shrink-0 text-center text-xs font-black ${rank <= 3 ? "text-[#F2C14E]" : "text-white/35"}`}>
                    {rank}
                  </span>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.08]">
                    <AvatarImage src={s.avatarUrl} alt={s.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-bold">
                      <span className="truncate">{s.name}</span>
                      {s.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#7DA2FF]" />}
                    </p>
                    <p className="flex items-center gap-2.5 text-[11px] text-white/45">
                      <span className="inline-flex items-center gap-0.5"><ShoppingBag className="h-3 w-3" />{compact(s.salesCount)}</span>
                      <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{compact(s.followersCount)}</span>
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-white/60">
                    <Star className="h-3 w-3 fill-[#F2C14E] text-[#F2C14E]" />
                    {s.rating ? s.rating.toFixed(1) : "New"}
                  </span>
                </Link>
              ))}
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-white/45">No sellers found.</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppSheet>
  );
}

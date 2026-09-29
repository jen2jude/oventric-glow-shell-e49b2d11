import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Loader2, Search, UserRound, Users, X } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import {
  getPeopleLeaderboard,
  type PeopleLeaderboardPerson,
} from "@/lib/follows.functions";
import { AppSheet } from "./AppSheet";

const compact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : String(value);

const MEDALS = [
  "from-[#F2C14E] to-[#B8862B] text-[#2A1D00]",
  "from-[#D9DDE3] to-[#8C939C] text-[#15171A]",
  "from-[#E0955A] to-[#9A5A2C] text-[#241206]",
];

export function AppPeopleLeaderboardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loadPeople = useServerFn(getPeopleLeaderboard);
  const [query, setQuery] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["app-people-leaderboard"],
    queryFn: () => loadPeople(),
    enabled: open,
    staleTime: 60_000,
  });

  const ranked = data as PeopleLeaderboardPerson[];
  const podium = ranked.slice(0, 3);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = term ? ranked : ranked.slice(3);
    return rows
      .map((person) => ({ person, rank: ranked.findIndex((row) => row.userId === person.userId) + 1 }))
      .filter(
        ({ person }) =>
          !term ||
          person.displayName.toLowerCase().includes(term) ||
          person.username?.toLowerCase().includes(term),
      );
  }, [query, ranked]);

  const header = (
    <div className="border-b border-white/[0.06] px-4 pb-3">
      <div className="flex items-center gap-3 py-2">
        <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#2F5FD0]/15 text-[#7DA2FF]">
          <Users className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold">People leaderboard</h2>
          <p className="text-[11px] text-white/45">People with the most followers on Oventric</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="mt-1 flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2">
        <Search className="h-4 w-4 text-white/40" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people"
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
            {!query && podium.length > 0 && (
              <div className="mb-5 grid grid-cols-3 items-end gap-2">
                {[1, 0, 2].map((index) => {
                  const person = podium[index];
                  if (!person) return <div key={index} />;
                  return (
                    <Link
                      key={person.userId}
                      to="/profile/$id"
                      params={{ id: person.slug || person.userId }}
                      onClick={onClose}
                      className={`flex flex-col items-center rounded-[10px] border border-white/[0.07] bg-[#151619] px-2 pb-3 ${index === 0 ? "pt-4" : "pt-3"}`}
                    >
                      <div className="relative">
                        <div className={`overflow-hidden rounded-full border-2 border-white/10 ${index === 0 ? "h-16 w-16" : "h-12 w-12"}`}>
                          <AvatarImage src={person.avatarUrl} alt={person.displayName} />
                        </div>
                        <span className={`absolute -bottom-1 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-gradient-to-b text-[10px] font-black ${MEDALS[index]}`}>
                          {index + 1}
                        </span>
                      </div>
                      <p className="mt-2.5 flex w-full items-center justify-center gap-1 truncate text-center text-xs font-bold">
                        <span className="truncate">{person.displayName}</span>
                        {person.verified && <BadgeCheck className="h-3 w-3 shrink-0 text-[#7DA2FF]" />}
                      </p>
                      <p className="text-[10px] text-white/45">{compact(person.followersCount)} followers</p>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              {filtered.map(({ person, rank }) => (
                <Link
                  key={person.userId}
                  to="/profile/$id"
                  params={{ id: person.slug || person.userId }}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3 active:scale-[0.99]"
                >
                  <span className={`w-6 shrink-0 text-center text-xs font-black ${rank <= 3 ? "text-[#F2C14E]" : "text-white/35"}`}>
                    {rank}
                  </span>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.08]">
                    <AvatarImage src={person.avatarUrl} alt={person.displayName} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-bold">
                      <span className="truncate">{person.displayName}</span>
                      {person.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#7DA2FF]" />}
                    </p>
                    <p className="truncate text-[11px] text-white/45">
                      {person.username ? `@${person.username}` : "Oventric member"}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-white/55">
                    <UserRound className="h-3 w-3" />
                    {compact(person.followersCount)}
                  </span>
                </Link>
              ))}
              {!isLoading && ranked.length === 0 && (
                <p className="py-10 text-center text-sm text-white/45">No people found.</p>
              )}
              {!isLoading && query && filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-white/45">No people match your search.</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppSheet>
  );
}
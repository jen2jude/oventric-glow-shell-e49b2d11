import { Link } from "@tanstack/react-router";
import { Sparkles, Store } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { FollowButton } from "@/components/oventric/FollowButton";
import { Button } from "@/components/ui/button";
import type { DiscoveryPeer } from "@/lib/discovery.functions";

type Props = {
  people: DiscoveryPeer[];
  title?: string;
  appShell?: boolean;
};

export function PeopleSuggestionsRail({
  people,
  title = "People you may know",
  appShell = true,
}: Props) {
  const suggestions = people.slice(0, 10);
  if (suggestions.length === 0) return null;

  return (
    <section
      aria-label={title}
      className={
        appShell
          ? "overflow-hidden border-y border-white/[0.06] bg-[#101112] py-4 md:rounded-[10px] md:border"
          : "overflow-hidden rounded-[10px] border border-slate-200 bg-white py-4 shadow-sm"
      }
    >
      <div className="mb-3 flex items-center gap-2 px-4">
        <Sparkles className={appShell ? "h-4 w-4 text-[#E5484D]" : "h-4 w-4 text-primary"} />
        <h2 className={appShell ? "text-sm font-bold text-white" : "text-sm font-bold text-slate-900"}>
          {title}
        </h2>
        <span className={appShell ? "ml-auto text-[11px] text-white/35" : "ml-auto text-[11px] text-slate-500"}>
          Swipe to explore
        </span>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {suggestions.map((person) => (
          <article
            key={person.id}
            className={
              appShell
                ? "w-[236px] shrink-0 snap-start rounded-[10px] border border-white/[0.07] bg-[#18191B] p-2.5"
                : "w-[236px] shrink-0 snap-start rounded-[10px] border border-slate-200 bg-slate-50 p-2.5"
            }
          >
            <Link
              to="/profile/$id"
              params={{ id: person.slug }}
              className="group grid min-w-0 grid-cols-[54px_minmax(0,1fr)] items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={appShell ? "h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[10px] ring-1 ring-white/10" : "h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[10px] ring-1 ring-slate-200"}>
                <AvatarImage src={person.avatarUrl} alt={person.name} initials={person.initials} />
              </span>
              <span className="min-w-0">
                <span className={appShell ? "block w-full truncate text-[13px] font-bold leading-tight text-white group-active:text-[#E5484D]" : "block w-full truncate text-[13px] font-bold leading-tight text-slate-900 group-hover:text-primary"}>
                  {person.name}
                </span>
                <span className={appShell ? "mt-1 block w-full truncate text-[11px] text-white/40" : "mt-1 block w-full truncate text-[11px] text-slate-500"}>
                  @{person.username || person.slug}
                </span>
              </span>
            </Link>

            <div className={`mt-3 grid gap-2 ${person.hasActiveShop ? "grid-cols-2" : "grid-cols-1"}`}>
              {person.hasActiveShop && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={
                    appShell
                      ? "h-8 border-white/20 bg-white/10 px-2 text-[11px] font-semibold text-white shadow-none hover:bg-white/20 hover:text-white"
                      : "h-8 border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-900 shadow-none hover:bg-slate-50"
                  }
                >
                  <Link to="/shop/$id" params={{ id: person.slug }}>
                    <Store className="h-3.5 w-3.5" /> See shop
                  </Link>
                </Button>
              )}
              <FollowButton
                targetId={person.id}
                compact
                className="h-8 min-w-0 rounded-md px-2 py-0 text-[11px] text-white [&_svg]:h-3.5 [&_svg]:w-3.5"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
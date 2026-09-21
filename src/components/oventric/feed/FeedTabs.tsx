import { useEffect, useRef } from "react";
import { BadgeCheck, LayoutGrid, Sparkles, Store, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export type FeedTab = "foryou" | "following" | "creators" | "shops" | "all";

const TABS = [
  {
    key: "foryou",
    label: "For You",
    icon: Sparkles,
    active: "border-sky-200 bg-sky-50 text-sky-700",
    idle: "border-sky-100 bg-sky-50/55 text-sky-600",
  },
  {
    key: "following",
    label: "Following",
    icon: UsersRound,
    active: "border-violet-200 bg-violet-50 text-violet-700",
    idle: "border-violet-100 bg-violet-50/55 text-violet-600",
  },
  {
    key: "creators",
    label: "Creators",
    icon: BadgeCheck,
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    idle: "border-emerald-100 bg-emerald-50/55 text-emerald-600",
  },
  {
    key: "shops",
    label: "Shops",
    icon: Store,
    active: "border-amber-200 bg-amber-50 text-amber-700",
    idle: "border-amber-100 bg-amber-50/55 text-amber-600",
  },
  {
    key: "all",
    label: "All",
    icon: LayoutGrid,
    active: "border-teal-200 bg-teal-50 text-teal-700",
    idle: "border-teal-100 bg-teal-50/55 text-teal-600",
  },
] satisfies Array<{
  key: FeedTab;
  label: string;
  icon: typeof Sparkles;
  active: string;
  idle: string;
}>;

export function FeedTabs({ tab, onTabChange }: { tab: FeedTab; onTabChange: (tab: FeedTab) => void }) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    railRef.current
      ?.querySelector<HTMLElement>(`[data-feed-tab="${tab}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [tab]);

  return (
    <nav
      ref={railRef}
      aria-label="Newsfeed views"
      className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1 no-scrollbar scroll-smooth md:mx-0 md:px-0"
    >
      {TABS.map(({ key, label, icon: Icon, active, idle }) => {
        const selected = tab === key;
        return (
          <Button
            key={key}
            type="button"
            variant="outline"
            data-feed-tab={key}
            aria-pressed={selected}
            onClick={() => onTabChange(key)}
            className={`h-10 shrink-0 snap-start gap-2 rounded-[10px] px-3.5 text-xs font-bold shadow-none transition-all ${
              selected ? `${active} ring-1 ring-current/10` : `${idle} hover:brightness-95`
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
          </Button>
        );
      })}
    </nav>
  );
}
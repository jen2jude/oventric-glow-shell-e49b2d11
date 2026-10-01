import { useEffect, useRef } from "react";
import { BadgeCheck, Sparkles, Store, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export type FeedTab = "foryou" | "following" | "creators" | "shops";

const TABS = [
  {
    key: "foryou",
    label: "For You",
    icon: Sparkles,
    active: "text-newsfeed-blue border-newsfeed-blue",
    idle: "text-newsfeed-muted border-transparent hover:text-newsfeed-blue",
  },
  {
    key: "following",
    label: "Following",
    icon: UsersRound,
    active: "text-newsfeed-violet border-newsfeed-violet",
    idle: "text-newsfeed-muted border-transparent hover:text-newsfeed-violet",
  },
  {
    key: "shops",
    label: "Shops",
    icon: Store,
    active: "text-newsfeed-gold border-newsfeed-gold",
    idle: "text-newsfeed-muted border-transparent hover:text-newsfeed-gold",
  },
] satisfies Array<{
  key: FeedTab;
  label: string;
  icon: typeof Sparkles;
  active: string;
  idle: string;
}>;

export function FeedTabs({
  tab,
  onTabChange,
  belowManagedHeader = false,
}: {
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  belowManagedHeader?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const activeTab = rail?.querySelector<HTMLElement>(`[data-feed-tab="${tab}"]`);
    if (!rail || !activeTab) return;

    const targetLeft = activeTab.offsetLeft - (rail.clientWidth - activeTab.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [tab]);

  return (
    <nav
      ref={railRef}
      aria-label="Newsfeed views"
      className={`sticky z-30 flex snap-x overflow-x-auto border-b border-newsfeed-line bg-newsfeed-surface/95 px-2 backdrop-blur-md no-scrollbar scroll-smooth ${
        belowManagedHeader
          ? "top-0"
          : "top-[66px] md:top-[72px] lg:top-14"
      }`}
    >
      {TABS.map(({ key, label, icon: Icon, active, idle }) => {
        const selected = tab === key;
        return (
          <Button
            key={key}
            type="button"
            variant="ghost"
            data-feed-tab={key}
            aria-pressed={selected}
            onClick={() => onTabChange(key)}
            className={`h-12 flex-1 shrink-0 snap-start gap-2 rounded-none border-x-0 border-t-0 border-b-2 bg-transparent px-3.5 text-xs font-bold shadow-none transition-colors ${
              selected ? active : idle
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
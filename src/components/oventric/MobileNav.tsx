import { Home, Compass, Newspaper, Plus, ShoppingBag } from "lucide-react";
import { CountBadge } from "@/components/oventric/CountBadge";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { useChatOpen } from "@/hooks/use-chat-open";
import { useChromeHidden } from "@/hooks/use-chrome-hide";


const left = [
  { icon: Home, label: "Home", active: "bg-newsfeed-coral text-primary-foreground", idle: "bg-newsfeed-coral-soft text-newsfeed-coral" },
  { icon: Compass, label: "Explore", active: "bg-newsfeed-blue text-primary-foreground", idle: "bg-newsfeed-blue-soft text-newsfeed-blue" },
];
const right = [
  { icon: ShoppingBag, label: "Market", active: "bg-newsfeed-gold text-newsfeed-ink", idle: "bg-newsfeed-gold-soft text-newsfeed-gold" },
  { icon: Newspaper, label: "Feed", active: "bg-newsfeed-violet text-primary-foreground", idle: "bg-newsfeed-violet-soft text-newsfeed-violet" },
];

export type MobileNavCounts = Partial<
  Record<"Home" | "Feed" | "Explore" | "Market" | "Academy" | "Bounties" | "Wallet", number>
>;

export function MobileNav({
  onCreate,
  active,
  onSelect,
  counts,
}: {
  onCreate: () => void;
  active: string;
  onSelect: (label: string) => void;
  counts?: MobileNavCounts;
}) {
  const chatOpen = useChatOpen();
  const chromeHidden = useChromeHidden();
  const Item = (it: { icon: typeof Home; label: string; active: string; idle: string }) => {

    const isActive = active === it.label;
    const count = counts?.[it.label as keyof MobileNavCounts] ?? 0;
    return (
      <Button
        key={it.label}
        variant="ghost"
        onClick={() => {
          haptic("select");
          onSelect(it.label);
        }}
        className="nav-tap relative h-full min-w-0 flex-1 flex-col gap-0 rounded-full px-1 py-1 hover:bg-transparent"
      >
        <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all duration-200 ${isActive ? `${it.active} -translate-y-0.5 shadow-lg` : it.idle}`}>
          <it.icon
            className={`h-[18px] w-[18px] transition-transform duration-200 ${isActive ? "scale-105" : ""}`}
            strokeWidth={2.5}
          />
          <CountBadge count={count} ariaLabel={`${count} new in ${it.label}`} />
        </span>
        <span className={`max-w-full truncate text-[9px] leading-none tracking-normal ${isActive ? "font-bold text-newsfeed-ink" : "font-semibold text-newsfeed-muted"}`}>{it.label}</span>
      </Button>
    );
  };

  if (chatOpen) return null;

  return (

    <nav
      data-testid="mobile-nav"
      aria-label="Mobile navigation"
      className={`mobile-spectrum-dock md:hidden fixed bottom-[max(env(safe-area-inset-bottom),0.5rem)] left-3 right-3 z-30 mx-auto h-[68px] max-w-[380px] items-center overflow-visible rounded-full border border-newsfeed-line bg-newsfeed-surface/90 px-1.5 shadow-newsfeed-panel backdrop-blur-xl transition-all duration-300 ease-out ${
        chromeHidden ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
    >
      <span aria-hidden="true" className="mobile-spectrum-dock__rail absolute inset-x-7 top-0 h-0.5 rounded-full" />
      {left.map(Item)}
      <Button
        variant="ghost"
        onClick={() => {
          haptic("medium");
          onCreate();
        }}
        className="nav-tap relative -mt-7 mx-0.5 h-12 w-12 shrink-0 rounded-full border-4 border-newsfeed-surface bg-newsfeed-green p-0 text-primary-foreground shadow-lg hover:bg-newsfeed-green"
        aria-label="Create"
      >
        <span className="flex h-full w-full items-center justify-center rounded-full">
          <Plus className="h-6 w-6" strokeWidth={2.8} />
        </span>
      </Button>
      {right.map(Item)}
    </nav>
  );
}

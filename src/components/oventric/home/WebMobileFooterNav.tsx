import { Compass, Home, Newspaper, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

const ITEMS = [
  {
    label: "Home",
    section: "Home",
    Icon: Home,
    active: "bg-newsfeed-coral text-primary-foreground shadow-newsfeed-coral/25",
    idle: "text-newsfeed-coral bg-newsfeed-coral-soft",
  },
  {
    label: "Explore",
    section: "Explore",
    Icon: Compass,
    active: "bg-newsfeed-blue text-primary-foreground shadow-newsfeed-blue/25",
    idle: "text-newsfeed-blue bg-newsfeed-blue-soft",
  },
  {
    label: "Marketplace",
    section: "Marketplace",
    Icon: ShoppingBag,
    active: "bg-newsfeed-gold text-newsfeed-ink shadow-newsfeed-gold/25",
    idle: "text-newsfeed-gold bg-newsfeed-gold-soft",
  },
  {
    label: "Feed",
    section: "Feed",
    Icon: Newspaper,
    active: "bg-newsfeed-violet text-primary-foreground shadow-newsfeed-violet/25",
    idle: "text-newsfeed-violet bg-newsfeed-violet-soft",
  },
] as const;

export function WebMobileFooterNav({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (section: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden"
    >
      <nav
        aria-label="Mobile navigation"
        data-testid="mobile-nav"
        className="mobile-spectrum-dock pointer-events-auto relative mx-auto grid h-[68px] w-full max-w-[380px] grid-cols-4 items-center overflow-hidden rounded-full border border-newsfeed-line bg-newsfeed-surface/90 px-1.5 shadow-newsfeed-panel backdrop-blur-xl"
      >
        <span aria-hidden="true" className="mobile-spectrum-dock__rail absolute inset-x-7 top-0 h-0.5 rounded-full" />
      {ITEMS.map(({ label, section, Icon, active: activeClass, idle }) => {
        const selected = active === section;
        return (
          <Button
            key={section}
            type="button"
            variant="ghost"
            aria-current={selected ? "page" : undefined}
            onClick={() => {
              haptic("select");
              onSelect(section);
            }}
            className="group h-full min-w-0 flex-1 flex-col gap-0 rounded-full px-1 py-1 font-wallet-body hover:bg-transparent"
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all duration-200 ${selected ? `${activeClass} -translate-y-0.5 shadow-lg` : idle}`}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={selected ? 2.6 : 2.1} />
            </span>
            <span className={`max-w-full truncate text-[9px] leading-none tracking-normal ${selected ? "font-bold text-newsfeed-ink" : "font-semibold text-newsfeed-muted"}`}>
              {label}
            </span>
          </Button>
        );
      })}
      </nav>
    </div>
  );
}
import { Clapperboard, Compass, Home, Newspaper, ShoppingBag } from "lucide-react";
import { haptic } from "@/lib/haptics";

const ITEMS = [
  { label: "Home", section: "Home", Icon: Home },
  { label: "Explore", section: "Explore", Icon: Compass },
  { label: "Marketplace", section: "Marketplace", Icon: ShoppingBag },
  { label: "Creators", section: "Creators", Icon: Clapperboard },
  { label: "Feed", section: "Feed", Icon: Newspaper },
] as const;

export function WebMobileFooterNav({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (section: string) => void;
}) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 shadow-[0_-10px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl md:hidden"
      style={{
        height: "calc(3.75rem + max(env(safe-area-inset-bottom), 0.5rem))",
        paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
      }}
    >
      {ITEMS.map(({ label, section, Icon }) => {
        const selected = active === section;
        return (
          <button
            key={section}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => {
              haptic("select");
              onSelect(section);
            }}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition-colors ${
              selected ? "text-crimson" : "text-slate-500"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={selected ? 2.5 : 2} />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
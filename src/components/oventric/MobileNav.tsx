import { Home, Target, Wallet, Plus, ShoppingBag, GraduationCap, Newspaper } from "lucide-react";
import { CountBadge } from "@/components/oventric/CountBadge";
import { haptic } from "@/lib/haptics";
import { useChatOpen } from "@/hooks/use-chat-open";


const left = [
  { icon: Home, label: "Home" },
  { icon: Newspaper, label: "Feed" },
  { icon: ShoppingBag, label: "Market" },
];
const right = [
  { icon: GraduationCap, label: "Academy" },
  { icon: Target, label: "Bounties" },
  { icon: Wallet, label: "Wallet" },
];

export type MobileNavCounts = Partial<
  Record<"Home" | "Feed" | "Market" | "Academy" | "Bounties" | "Wallet", number>
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
  const Item = (it: { icon: typeof Home; label: string }) => {
    const isActive = active === it.label;
    const count = counts?.[it.label as keyof MobileNavCounts] ?? 0;
    return (
      <button
        key={it.label}
        onClick={() => {
          haptic("select");
          onSelect(it.label);
        }}
        className={`nav-tap relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 min-w-0 ${
          isActive ? "text-[#E5484D]" : "text-white"
        }`}
      >
        <span className="relative">
          <it.icon
            className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`}
            strokeWidth={2.5}
          />
          <CountBadge count={count} ariaLabel={`${count} new in ${it.label}`} />
        </span>
        <span className="text-[9px] font-medium">{it.label}</span>
      </button>
    );
  };

  return (
    <nav
      data-testid="mobile-nav"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 max-w-full bg-[#141418] border-t border-white/15 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.45)] rounded-t-2xl flex items-center px-2"
      style={{
        height: "calc(4rem + max(env(safe-area-inset-bottom), 0.5rem))",
        paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
      }}
    >
      {left.map(Item)}
      <button
        onClick={() => {
          haptic("medium");
          onCreate();
        }}
        className="nav-tap relative -mt-8 mx-1 w-12 h-12 rounded-full rgb-static-border shrink-0 flex items-center justify-center p-[2px]"
        aria-label="Create"
      >
        <span className="w-full h-full rounded-full bg-[#1E1E24] flex items-center justify-center">
          <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
        </span>
      </button>
      {right.map(Item)}
    </nav>
  );
}

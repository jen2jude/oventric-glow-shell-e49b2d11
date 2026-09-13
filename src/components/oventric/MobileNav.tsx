import { Home, Target, Wallet, Plus, ShoppingBag, GraduationCap } from "lucide-react";
import { CountBadge } from "@/components/oventric/CountBadge";
import { haptic } from "@/lib/haptics";
import { useChatOpen } from "@/hooks/use-chat-open";
import { useChromeHidden } from "@/hooks/use-chrome-hide";


const left = [
  { icon: Home, label: "Home" },
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
  const chatOpen = useChatOpen();
  const chromeHidden = useChromeHidden();
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
           isActive ? "text-[#FF3EB5]" : "text-white/45"
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

  if (chatOpen) return null;

  return (

    <nav
      data-testid="mobile-nav"
      className={`md:hidden fixed bottom-0 inset-x-0 z-30 max-w-full bg-[#070A08]/95 border-t border-white/10 shadow-[0_-14px_40px_-20px_rgba(0,0,0,0.9)] flex items-center px-2 backdrop-blur-xl transition-all duration-300 ease-out ${
        chromeHidden ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
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
        className="nav-tap relative -mt-8 mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF3EB5] shadow-[0_8px_24px_rgba(255,62,181,0.35)]"
        aria-label="Create"
      >
        <span className="flex h-full w-full items-center justify-center rounded-full">
          <Plus className="h-6 w-6 text-[#070A08]" strokeWidth={2.8} />
        </span>
      </button>
      {right.map(Item)}
    </nav>
  );
}

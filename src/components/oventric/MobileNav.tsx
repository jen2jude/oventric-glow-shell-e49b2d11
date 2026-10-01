import { Clapperboard, Home, Images, MessageCircle, Plus, ShoppingBag, Wallet } from "lucide-react";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { CountBadge } from "@/components/oventric/CountBadge";
import { haptic } from "@/lib/haptics";
import { useChatOpen } from "@/hooks/use-chat-open";
import { useChromeHidden } from "@/hooks/use-chrome-hide";
import { useIsAppShell } from "@/hooks/use-launch-context";


const left = [
  { icon: Home, label: "Home" },
  { icon: ShoppingBag, label: "Market" },
];

export type MobileNavCounts = Partial<
  Record<"Home" | "Chats" | "Feed" | "Explore" | "Market" | "Academy" | "Bounties" | "Wallet", number>
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
  const isAppShell = useIsAppShell();
  const { isAuthenticated, openGate } = useAuthGate();
  // In the app shell, chats live in the top bar — the dock carries the feed
  // instead. The website keeps its chat tab in the footer.
  const right = isAppShell
    ? [
        { icon: Images, label: "Feed" },
        { icon: Clapperboard, label: "Creator's Hub" },
        { icon: Wallet, label: "Wallet" },
      ]
    : [
        { icon: MessageCircle, label: "Chats" },
        { icon: Clapperboard, label: "Creator's Hub" },
        { icon: Wallet, label: "Wallet" },
      ];
  const chatOpen = useChatOpen();
  const chromeHidden = useChromeHidden();
  const { messages } = useUnreadCounts();
  const Item = (it: { icon: typeof Home; label: string }) => {

    const isActive = active === it.label;
    const count =
      it.label === "Chats" ? (messages ?? 0) : (counts?.[it.label as keyof MobileNavCounts] ?? 0);
    return (
      <button
        key={it.label}
        onClick={() => {
          haptic("select");
          onSelect(it.label);
        }}
        className={`nav-tap relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 min-w-0 ${
           isActive ? "text-[#E5484D]" : "text-white/45"
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
        className="nav-tap relative -mt-8 mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E5484D] shadow-[0_8px_24px_rgba(229,72,77,0.45)]"
        aria-label="Create"
      >
        <span className="flex h-full w-full items-center justify-center rounded-full">
          <Plus className="h-6 w-6 text-white" strokeWidth={2.8} />
        </span>
      </button>
      {right.map(Item)}
    </nav>
  );
}

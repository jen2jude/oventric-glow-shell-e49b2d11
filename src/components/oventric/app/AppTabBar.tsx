import { useEffect, useState } from "react";
import {
  Home,
  Newspaper,
  ShoppingBag,
  Plus,
  LayoutGrid,
  GraduationCap,
  Target,
  Wallet as WalletIcon,
  Users,
  MessageSquare,
  User as UserIcon,
  X,
} from "lucide-react";
import { CountBadge } from "@/components/oventric/CountBadge";
import { haptic } from "@/lib/haptics";
import { useChatOpen } from "@/hooks/use-chat-open";

export type AppTabCounts = Partial<
  Record<"Home" | "Feed" | "Market" | "Wallet", number>
>;

const TABS = [
  { icon: Home, label: "Home", section: "Home" },
  { icon: Newspaper, label: "Feed", section: "Feed" },
  { icon: ShoppingBag, label: "Market", section: "Marketplace" },
] as const;

// Academy, Bounties and Circles are not active MVP features and are not listed.
const HUB_ITEMS = [
  { icon: WalletIcon, label: "Wallet", section: "Wallet", hint: "Balances & payouts" },
  { icon: MessageSquare, label: "Messages", section: "Messages", hint: "Direct chats" },
  { icon: UserIcon, label: "Profile", section: "Profile", hint: "Your identity hub" },
] as const;

/**
 * Rebuilt native bottom navigation for the app shell.
 * Four primary tabs + a centre create action, plus a full identity hub sheet
 * that exposes every remaining surface (wallet, messages, profile…).
 */
export function AppTabBar({
  active,
  onSelect,
  onCreate,
  counts,
}: {
  active: string;
  onSelect: (section: string) => void;
  onCreate: () => void;
  counts?: AppTabCounts;
}) {
  const [hubOpen, setHubOpen] = useState(false);
  const chatOpen = useChatOpen();

  useEffect(() => {
    if (!hubOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [hubOpen]);

  const hubCount = counts?.Wallet ?? 0;

  const hubActive = !["Home", "Feed", "Marketplace"].includes(active);

  const Tab = (tab: { icon: typeof Home; label: string; section: string }) => {
    const isActive = active === tab.section;
    const count = counts?.[tab.label as keyof AppTabCounts] ?? 0;
    return (
      <button
        key={tab.section}
        type="button"
        onClick={() => {
          haptic("select");
          onSelect(tab.section);
        }}
        className="nav-tap relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1"
      >
        <span
          className={`relative flex h-8 w-14 items-center justify-center rounded-[10px] transition-colors ${
            isActive ? "bg-white/[0.08]" : "bg-transparent"
          }`}
        >
          <tab.icon
            className={`h-[18px] w-[18px] ${isActive ? "text-white" : "text-white/45"}`}
            strokeWidth={isActive ? 2.4 : 2}
          />
          <CountBadge count={count} ariaLabel={`${count} new in ${tab.label}`} />
        </span>
        <span
          className={`text-[9.5px] font-semibold tracking-tight ${
            isActive ? "text-white" : "text-white/40"
          }`}
        >
          {tab.label}
        </span>
      </button>
    );
  };

  if (chatOpen) return null;

  return (
    <>
      <nav
        data-testid="app-tab-bar"
        className="fixed inset-x-0 bottom-0 z-40 flex max-w-full items-center border-t border-white/[0.06] bg-black/95 px-1 backdrop-blur-none"
        style={{
          height: "calc(3.75rem + max(env(safe-area-inset-bottom), 0.4rem))",
          paddingBottom: "max(env(safe-area-inset-bottom), 0.4rem)",
        }}
      >
        {TABS.map(Tab)}

        <button
          type="button"
          onClick={() => {
            haptic("medium");
            onCreate();
          }}
          aria-label="Create"
          className="nav-tap mx-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.10] bg-white"
        >
          <Plus className="h-5 w-5 text-black" strokeWidth={2.6} />
        </button>

        <button
          type="button"
          onClick={() => {
            haptic("select");
            setHubOpen(true);
          }}
          className="nav-tap relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1"
        >
          <span
            className={`relative flex h-8 w-14 items-center justify-center rounded-[10px] transition-colors ${
              hubActive ? "bg-white/[0.08]" : "bg-transparent"
            }`}
          >
            <LayoutGrid
              className={`h-[18px] w-[18px] ${hubActive ? "text-white" : "text-white/45"}`}
              strokeWidth={hubActive ? 2.4 : 2}
            />
            <CountBadge count={hubCount} ariaLabel={`${hubCount} new updates`} />
          </span>
          <span
            className={`text-[9.5px] font-semibold tracking-tight ${
              hubActive ? "text-white" : "text-white/40"
            }`}
          >
            Hub
          </span>
        </button>
      </nav>

      {hubOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close hub"
            onClick={() => setHubOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div
            className="relative w-full rounded-t-[10px] border-t border-white/[0.06] bg-[#0E0E10] px-4 pt-3"
            style={{ paddingBottom: "calc(1rem + max(env(safe-area-inset-bottom), 0.4rem))" }}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/15" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-white">Your ecosystem</h2>
              <button
                type="button"
                onClick={() => setHubOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.06] bg-white/[0.03]"
              >
                <X className="h-4 w-4 text-white/60" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {HUB_ITEMS.map((item) => {
                const count = counts?.[item.label as keyof AppTabCounts] ?? 0;
                return (
                  <button
                    key={item.section}
                    type="button"
                    onClick={() => {
                      haptic("select");
                      setHubOpen(false);
                      onSelect(item.section);
                    }}
                    className="flex items-start gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3 text-left active:bg-white/[0.06]"
                  >
                    <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.06] bg-black">
                      <item.icon className="h-4 w-4 text-white" strokeWidth={2.2} />
                      <CountBadge count={count} ariaLabel={`${count} new in ${item.label}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-white">
                        {item.label}
                      </span>
                      <span className="block truncate text-[11px] text-white/40">{item.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

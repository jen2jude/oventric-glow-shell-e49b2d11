import { useEffect, useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  KeyRound,
  X,
  Shield,
  Grip,
  Menu,
  Bell,
  UserPlus,
  MessageSquare,
  Users,
  Store,
  ShoppingBag,
  GraduationCap,
  Target,
  Headphones,
  type LucideIcon,
} from "lucide-react";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import { ProfileDropdown } from "@/components/oventric/ProfileDropdown";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { RequestsInboxDrawer } from "@/components/oventric/RequestsInboxDrawer";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { GlobalSearch } from "@/components/oventric/GlobalSearch";
import logoLight from "@/assets/oventric-full-transparent.png";
import logoDark from "@/assets/oventric-logo-dark.png";
import supportHeadset from "@/assets/support-headset.png.asset.json";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { SiteNavbar } from "@/components/oventric/desktop/SiteNavbar";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { listIncomingFollowRequests } from "@/lib/follows.functions";
import { listIncomingCircleRequests } from "@/lib/circles.functions";
import { CountBadge } from "@/components/oventric/CountBadge";
import { HeaderWalletChip } from "@/components/oventric/HeaderWalletChip";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { COUNTRY_META } from "@/lib/currency/africa";

// Academy, Bounties and Circles are paused features and are not navigable.
const HUB_NAV: { label: string; icon: LucideIcon; section?: string; to?: string }[] = [
  { label: "Market", icon: Store, section: "Marketplace" },
  { label: "Shop", icon: ShoppingBag, to: "/sellers" },
  { label: "Help", icon: Headphones, to: "/help-board" },
];

export function Header({
  onMenuClick,
  onOpenMessages,
  safeMobile = false,
  showMobileTopRow = false,
  hubMode = false,
  light = false,
  desktopNav = false,
  browserVisitorHeader = false,
  forceSiteNavbar = false,
  siteNavbarOnSelect,
}: {
  onMenuClick?: () => void;
  onOpenMessages?: () => void;
  safeMobile?: boolean;
  showMobileTopRow?: boolean;
  hubMode?: boolean;
  light?: boolean;
  desktopNav?: boolean;
  browserVisitorHeader?: boolean;
  forceSiteNavbar?: boolean;
  siteNavbarOnSelect?: (section: string) => void;
}) {
  const { fullName } = useOnboarding();
  const { country, baseCurrency } = useOnboarding();
  const isAppShell = useIsAppShell();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [followReqOpen, setFollowReqOpen] = useState(false);
  const unreadCount = useUnreadNotificationsCount();
  const unreadMessages = useUnreadMessagesCount();
  const pendingFollow = usePendingFollowRequestsCount();
  const pendingCircles = usePendingCircleRequestsCount();

  const { isAuthenticated, openGate } = useAuthGate();

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileSearchOpen]);

  // Reopen MegaMenu when the user navigates back to the page where it was opened.
  useEffect(() => {
    const KEY = "oventric:megamenu-return-path";
    const onPop = () => {
      const stored = sessionStorage.getItem(KEY);
      if (stored && stored === window.location.pathname) {
        sessionStorage.removeItem(KEY);
        setMegaOpen(true);
      }
    };
    const onOpenReq = () => setMegaOpen(true);
    window.addEventListener("popstate", onPop);
    window.addEventListener("oventric:open-megamenu", onOpenReq);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("oventric:open-megamenu", onOpenReq);
    };
  }, []);

  useEffect(() => {
    const handler = () => onOpenMessages?.();
    window.addEventListener("oventric:open-messages", handler);
    return () => window.removeEventListener("oventric:open-messages", handler);
  }, [onOpenMessages]);

  const bg = light ? "bg-white" : "bg-[#121214]";
  const edge = light ? "border-slate-200" : "border-white/10";
  // Round icon buttons in the right cluster.
  const chip = light
    ? "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
    : "bg-[#1E1E24] border border-white/10 text-white";
  // Flat (no pill) icon buttons.
  const flat = light ? "text-slate-700 hover:bg-slate-100" : "text-white hover:bg-white/5";

  const logoSrc = light ? logoDark : logoLight;

  const LogoImg = (
    <div className="flex items-center gap-1.5">
      <ResponsiveImage
        src={logoSrc}
        alt="Oventric"
        sizes="160px"
        className="h-8 w-auto object-contain"
        draggable={false}
        loading="eager"
      />
    </div>
  );

  const LogoMark = LogoImg;

  const searchOverlay = mobileSearchOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="sm:hidden fixed inset-0 z-[60] bg-[#0b0b0d]/95 flex flex-col"
    >
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <div className="flex-1 min-w-0">
          <GlobalSearch variant="sheet" autoFocus onClose={() => setMobileSearchOpen(false)} />
        </div>
        <button
          onClick={() => setMobileSearchOpen(false)}
          aria-label="Close search"
          className="p-2 rounded-[10px] text-slate-300 hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  ) : null;

  // Home hub gets a stripped-back header: logo, search, help and menu only.
  // Fixed positioning keeps it pinned for the full Home hub scroll.
  if (hubMode) {
    return (
      <header className={`fixed top-0 left-0 right-0 z-40 w-full ${bg} border-b ${edge}`}>
        <div className="relative h-12 md:h-[4.5rem] flex items-center justify-between px-3 md:px-6">
          {/* Left: search */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Open search"
              className={`p-2 md:p-2.5 rounded-xl transition-colors ${flat}`}
            >
              <Search className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2} />
            </button>
            <button
              onClick={() => setMegaOpen(true)}
              aria-label="Open menu"
              className={`inline-flex p-2 md:p-2.5 rounded-xl transition-colors shrink-0 ${flat}`}
            >
              <Menu className="w-5 h-5 md:hidden" strokeWidth={2} />
              <Grip className="w-6 h-6 hidden md:block" strokeWidth={2} />
            </button>
          </div>

          {/* Center: brand */}
          <Link
            to="/"
            aria-label="Oventric"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center"
          >
            {LogoMark}
          </Link>

          {/* Right: notifications */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setNotifOpen(true)}
              aria-label="Open notifications"
              className={`relative inline-flex p-2 md:p-2.5 rounded-xl transition-colors shrink-0 ${flat}`}
            >
              <Bell className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2} />
              <CountBadge count={unreadCount} ariaLabel={`${unreadCount} unread notifications`} />
            </button>
          </div>
        </div>

        <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />
        <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
        {searchOverlay}
      </header>
    );
  }

  if (forceSiteNavbar) {
    return (
      <SiteNavbar
        onSelect={siteNavbarOnSelect ?? ((section) => {
          if (section === "Home") {
            window.location.href = "/";
            return;
          }
          window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } }));
        })}
        avatarUrl={null}
        name={fullName || ""}
        country={country ?? undefined}
        currency={baseCurrency ?? undefined}
      />
    );
  }

  if (browserVisitorHeader && !desktopNav && !forceSiteNavbar) {
    return (
      <header
        className={`sticky top-0 z-40 w-full bg-white border-b border-slate-200 transition-colors duration-200`}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-11">
          <Link to="/" aria-label="Oventric home" className="shrink-0">
            <ResponsiveImage
              src={logoDark}
              alt="Oventric"
              sizes="160px"
              className="h-6 sm:h-8 w-auto object-contain"
              draggable={false}
              loading="eager"
            />
          </Link>

          <div className="flex-1 max-w-2xl px-2">
            <GlobalSearch variant="inline" light />
          </div>

          <button
            onClick={() => setMegaOpen(true)}
            aria-label="Open menu"
            className="p-2 -mr-1 rounded-[10px] text-slate-900 hover:bg-slate-100"
          >
            <Menu className="w-6 h-6" strokeWidth={2.5} />
          </button>
        </div>
        <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />
      </header>
    );
  }

  return (
    <header className={`sticky top-0 z-40 w-full ${bg} border-b ${edge}`}>
      {/* Mobile top row: logo + search + hamburger (home only) */}
      {showMobileTopRow && (
        <div className="md:hidden grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 h-11 px-3 border-b border-white/5">
          <Link to="/" aria-label="Oventric" className="flex items-center shrink-0">
            {LogoMark}
          </Link>
          <div className="min-w-0" />
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Open search"
              className="p-2 rounded-[10px] hover:bg-white/5 text-white"
            >
              <Search className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setMegaOpen(true)}
              aria-label="Open menu"
              className="p-2 -mr-1 rounded-[10px] hover:bg-white/5 text-white"
            >
              <Menu className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* Main row */}
      <div
        className={`h-11 md:h-[4.5rem] grid ${desktopNav ? "md:grid-cols-[auto_1fr_auto]" : ""} grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 md:gap-3 px-3 md:px-6`}
      >
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className={`hidden md:flex p-2.5 rounded-[10px] transition-colors shrink-0 ${flat}`}
            >
              <Menu className="w-6 h-6" strokeWidth={2.5} />
            </button>
          )}
          {/* Desktop-only logo */}
          <Link to="/" aria-label="Oventric" className="hidden md:flex items-center shrink-0">
            {LogoMark}
          </Link>

          {/* Desktop search sits right beside the logo when nav mode is on */}
          {desktopNav && (
            <div className="hidden md:block flex-1 min-w-[12rem] lg:min-w-[18rem] max-w-[14rem] lg:max-w-xs xl:max-w-sm">
              <GlobalSearch variant="inline" light={light} />
            </div>
          )}

          {/* Wallet chip - mobile only on the left */}
          <div className="md:hidden shrink-0">
            <HeaderWalletChip align="left" compact />
          </div>
        </div>

        {/* Desktop search input */}
        <div
          className={`flex-1 max-w-xl mx-auto min-w-0 hidden ${desktopNav ? "sm:block md:hidden" : "sm:block"}`}
        >
          <GlobalSearch variant="inline" light={light} />
        </div>

        {desktopNav && (
          <nav className="hidden md:flex items-center gap-0.5 xl:gap-1 justify-self-center w-full justify-center shrink-0">
            {HUB_NAV.map((item) => {
              const cls = `flex flex-col items-center gap-0.5 px-2 xl:px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                light
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`;
              return item.to ? (
                <Link key={item.label} to={item.to} className={cls}>
                  <item.icon className="w-[18px] h-[18px] xl:w-5 xl:h-5" strokeWidth={2.2} />
                  <span className="hidden xl:inline">{item.label}</span>
                </Link>
              ) : (
                <button
                  key={item.label}
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("oventric:navigate", { detail: { section: item.section } }),
                    )
                  }
                  className={cls}
                >
                  <item.icon className="w-[18px] h-[18px] xl:w-5 xl:h-5" strokeWidth={2.2} />
                  <span className="hidden xl:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        <div className="flex items-center justify-between md:justify-start gap-1 md:gap-2.5 w-full md:w-auto shrink-0 min-w-0">
          {/* Wallet chip - desktop/tablet position in the right cluster */}
          <div className="hidden md:inline-flex shrink-0">
            <HeaderWalletChip align="right" />
          </div>

          {/* Desktop candy-box menu hidden here, moved inside profile cluster */}

          {/* Circles & Guilds */}
          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("oventric:navigate", { detail: { section: "Circles" } }),
              )
            }
            aria-label="Circles & Guilds"
            className={`relative inline-flex p-2 md:p-2.5 rounded-full ${chip} transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0`}
          >
            <Users className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setNotifOpen(true)}
            aria-label="Open notifications"
            className={`relative p-2 md:p-2.5 rounded-full ${chip} transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0`}
          >
            <Bell className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
            <CountBadge count={unreadCount} ariaLabel={`${unreadCount} unread notifications`} />
          </button>

          {/* Merged Follow + Circle requests */}
          <button
            onClick={() => setFollowReqOpen(true)}
            aria-label={`Requests (${pendingFollow + pendingCircles} pending)`}
            className={`relative inline-flex p-2 md:p-2.5 rounded-full ${chip} transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0`}
          >
            <UserPlus className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
            <CountBadge
              count={pendingFollow + pendingCircles}
              ariaLabel={`${pendingFollow + pendingCircles} pending follow and circle requests`}
            />
          </button>

          {/* Chat */}
          <button
            onClick={onOpenMessages}
            aria-label="Open messages"
            className={`relative p-2 md:p-2.5 rounded-full ${chip} transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0`}
          >
            <MessageSquare className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
            <CountBadge count={unreadMessages} ariaLabel={`${unreadMessages} unread messages`} />
          </button>

          {/* Profile */}
          {isAuthenticated ? (
            <div className="shrink-0 flex items-center gap-2.5 md:gap-3">
              <ProfileDropdown trigger="mega" />

              {/* Desktop candy-box menu (MegaMenu) */}
              <button
                onClick={() => setMegaOpen(true)}
                aria-label="Open menu"
                className={`hidden md:inline-flex p-2.5 rounded-full transition-colors shrink-0 ${chip}`}
              >
                <Grip className="w-6 h-6" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openGate("generic")}
              className="inline-flex items-center justify-center h-9 md:h-10 rounded-full rgb-static-border p-[2px] hover:opacity-90 transition-opacity shrink-0"
              aria-label="Connect account"
            >
              <span
                className={`inline-flex items-center gap-1.5 h-full w-full px-2.5 md:px-3 rounded-full font-bold text-xs sm:text-sm ${light ? "bg-white text-slate-900" : "bg-[#1E1E24] text-white"}`}
              >
                <KeyRound className="w-4 h-4" strokeWidth={2.5} />
                <span className="hidden sm:inline">Connect Account</span>
                <span className="sm:hidden">Connect</span>
              </span>
            </button>
          )}
        </div>
      </div>

      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <RequestsInboxDrawer open={followReqOpen} onClose={() => setFollowReqOpen(false)} />
      <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />

      {mobileSearchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="sm:hidden fixed inset-0 z-[60] bg-[#0b0b0d]/95 flex flex-col"
        >
          <div className="flex items-center gap-2 p-3 border-b border-white/10">
            <div className="flex-1 min-w-0">
              <GlobalSearch variant="sheet" autoFocus onClose={() => setMobileSearchOpen(false)} />
            </div>
            <button
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Close search"
              className="p-2 rounded-[10px] text-slate-300 hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function useUnreadMessagesCount() {
  const { isAuthenticated } = useAuthGate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let userId: string | null = null;
    let channelSub: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      if (!userId) return;
      const { count: c } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);
      if (!cancelled) setCount(c ?? 0);
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId || cancelled) return;
      await load();
      channelSub = supabase
        .channel(`dm-count-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "direct_messages",
            filter: `recipient_id=eq.${userId}`,
          },
          () => {
            void load();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "direct_messages",
            filter: `sender_id=eq.${userId}`,
          },
          () => {
            void load();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelSub) supabase.removeChannel(channelSub);
    };
  }, [isAuthenticated]);

  return count;
}

function usePendingFollowRequestsCount() {
  const { isAuthenticated } = useAuthGate();
  const listFn = useServerFn(listIncomingFollowRequests);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let channelSub: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        if (!cancelled) setCount(0);
        return;
      }
      try {
        const rows = await listFn();
        if (!cancelled) setCount(Array.isArray(rows) ? rows.length : 0);
      } catch {
        if (!cancelled) setCount(0);
      }
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      load();
      channelSub = supabase
        .channel(`follow-req-count-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "follow_requests", filter: `target_id=eq.${uid}` },
          () => load(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelSub) supabase.removeChannel(channelSub);
    };
  }, [isAuthenticated, listFn]);

  return count;
}

function usePendingCircleRequestsCount() {
  const { isAuthenticated } = useAuthGate();
  const listFn = useServerFn(listIncomingCircleRequests);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let channelSub: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        if (!cancelled) setCount(0);
        return;
      }
      try {
        const rows = await listFn();
        if (!cancelled) setCount(Array.isArray(rows) ? rows.length : 0);
      } catch {
        if (!cancelled) setCount(0);
      }
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      load();
      channelSub = supabase
        .channel(`circle-req-count-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "circle_requests", filter: `target_id=eq.${uid}` },
          () => load(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "circle_join_requests" },
          () => load(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelSub) supabase.removeChannel(channelSub);
    };
  }, [isAuthenticated, listFn]);

  return count;
}

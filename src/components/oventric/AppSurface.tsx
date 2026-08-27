import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Sidebar } from "@/components/oventric/Sidebar";
import { MobileNav } from "@/components/oventric/MobileNav";
const Feed = lazy(() => import("@/components/oventric/Feed").then((m) => ({ default: m.Feed })));
const FeedSocialBar = lazy(() =>
  import("@/components/oventric/feed/FeedSocialBar").then((m) => ({ default: m.FeedSocialBar })),
);

const Wallet = lazy(() =>
  import("@/components/oventric/Wallet").then((m) => ({ default: m.Wallet })),
);
const Marketplace = lazy(() =>
  import("@/components/oventric/Marketplace").then((m) => ({ default: m.Marketplace })),
);
const Academy = lazy(() =>
  import("@/components/oventric/Academy").then((m) => ({ default: m.Academy })),
);
const Bounties = lazy(() =>
  import("@/components/oventric/Bounties").then((m) => ({ default: m.Bounties })),
);
import type { ChoiceKey } from "@/components/oventric/CreatePanel";
const CreatePanel = lazy(() =>
  import("@/components/oventric/CreatePanel").then((m) => ({ default: m.CreatePanel })),
);

const Messages = lazy(() =>
  import("@/components/oventric/Messages").then((m) => ({ default: m.Messages })),
);
const MessagesDrawer = lazy(() =>
  import("@/components/oventric/MessagesDrawer").then((m) => ({ default: m.MessagesDrawer })),
);
const CirclesHub = lazy(() =>
  import("@/components/oventric/CirclesHub").then((m) => ({ default: m.CirclesHub })),
);
import { HomeHub } from "@/components/oventric/HomeHub";
import { DesktopHome } from "@/components/oventric/desktop/DesktopHome";
import { DesktopAppSidebar } from "@/components/oventric/desktop/DesktopAppSidebar";
import { SiteFooterAuto } from "@/components/oventric/desktop/SiteFooterAuto";
import { SiteNavbar } from "@/components/oventric/desktop/SiteNavbar";
import { MarketplaceHeader } from "@/components/oventric/desktop/MarketplaceHeader";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";

import { useIsDesktop } from "@/hooks/use-desktop";
import { useIsAppShell, useLaunchContext } from "@/hooks/use-launch-context";
import { AppOnlyScreen } from "@/lib/app-gate";
const GetAppModal = lazy(() =>
  import("@/components/oventric/GetAppModal").then((m) => ({ default: m.GetAppModal })),
);
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useSectionLiveCounter } from "@/lib/useSectionLiveCounter";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { Search } from "lucide-react";

/** Lightweight skeleton shown while a section chunk streams in. */
function SectionFallback() {
  return (
    <div className="flex-1 min-h-[60vh] p-4 space-y-3 animate-pulse">
      <div className="h-28 rounded-[10px] bg-white/5 md:bg-slate-100" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-36 rounded-[10px] bg-white/5 md:bg-slate-100" />
        <div className="h-36 rounded-[10px] bg-white/5 md:bg-slate-100" />
        <div className="h-36 rounded-[10px] bg-white/5 md:bg-slate-100" />
        <div className="h-36 rounded-[10px] bg-white/5 md:bg-slate-100" />
      </div>
    </div>
  );
}

/**
 * Warm the section chunks once the browser is idle so switching tabs feels
 * instant even though the initial bundle only ships the landing view.
 */
function usePrefetchSections() {
  useEffect(() => {
    const warm = () => {
      void import("@/components/oventric/Feed");
      void import("@/components/oventric/Marketplace");
      void import("@/components/oventric/Academy");
      void import("@/components/oventric/Bounties");
      void import("@/components/oventric/Wallet");
      void import("@/components/oventric/CirclesHub");
      void import("@/components/oventric/Messages");
      void import("@/components/oventric/CreatePanel");
    };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) {
      const id = ric(warm, { timeout: 4000 });
      return () => (window as unknown as { cancelIdleCallback?: (h: number) => void })
        .cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(warm, 2000);
    return () => window.clearTimeout(t);
  }, []);
}

/** Canonical URL for each app section so tabs stay shareable. */
const SECTION_PATHS: Record<string, string> = {
  Home: "/",
  Feed: "/feed",
  Marketplace: "/marketplace",
  Academy: "/academy",
  Bounties: "/bounties",
  Wallet: "/wallet",
  Circles: "/circles",
};

export function AppSurface({ initialSection = "Home" }: { initialSection?: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createChoice, setCreateChoice] = useState<ChoiceKey | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [messagesPeer, setMessagesPeer] = useState<string | undefined>(undefined);
  const [active, setActive] = useState<string>(initialSection);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [q, setQ] = useState("");
  const [returnedToHub, setReturnedToHub] = useState(false);
  const [getAppOpen, setGetAppOpen] = useState(false);
  const prevActiveRef = useRef<string | null>(null);

  usePrefetchSections();
  const launchCtx = useLaunchContext();
  const { require, fullName, storeName, country, baseCurrency } = useOnboarding();
  const { isAuthenticated } = useAuthGate();
  const loadProfile = useServerFn(getMyFullProfile);

  useEffect(() => {
    if (!isAuthenticated) {
      setAvatarUrl(null);
      setName("");
      return;
    }
    let cancelled = false;
    loadProfile()
      .then((r) => {
        if (cancelled || !r?.profile) return;
        setAvatarUrl(r.profile.avatarUrl ?? null);
        setName(r.profile.displayName || fullName || storeName || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, fullName, storeName, loadProfile]);

  // Detect when the user leaves the home hub and comes back so promos can
  // take turns appearing on each return.
  useEffect(() => {
    const prev = prevActiveRef.current;
    if (active === "Home" && prev && prev !== "Home") {
      setReturnedToHub(true);
    } else if (active !== "Home") {
      setReturnedToHub(false);
    }
    prevActiveRef.current = active;
  }, [active]);

  // Keep the address bar in sync with the active section so every tab is
  // shareable, bookmarkable and back-button friendly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = SECTION_PATHS[active];
    if (!path || window.location.pathname === path) return;
    window.history.replaceState(
      {},
      "",
      `${path}${window.location.search}${window.location.hash}`,
    );
  }, [active]);

  const renderNavSearch = () => (
    <div className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setActive("Marketplace");
        }}
        className="flex items-center rounded-full border border-slate-200 bg-slate-50 h-10 gap-2 pl-3 pr-1 shadow-sm"
      >
        <Search className="shrink-0 text-slate-400 h-4 w-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Oventric"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          className="inline-flex items-center bg-slate-900 font-bold text-white transition-transform active:scale-95 h-7 rounded-[10px] px-3 text-xs"
        >
          Search
        </button>
      </form>
    </div>
  );

  // Create flow: auth-gate for anonymous visitors, then open the create panel.
  const handleCreate = (choice?: ChoiceKey) => {
    // Publishing (products, bounties, courses, posts) is an app-shell flow.
    if (typeof window !== "undefined" && launchCtx === "browser") {
      setGetAppOpen(true);
      return;
    }
    return require(
      1,
      () => {
        setCreateChoice(choice ?? null);
        setCreateOpen(true);
      },
      "seller",
    );
  };

  // Allow other components (e.g. MegaMenu) to trigger the create panel directly.
  useEffect(() => {
    const handler = (e: Event) => {
      const choice = (e as CustomEvent<{ choice?: ChoiceKey }>).detail?.choice;
      handleCreate(choice);
    };
    window.addEventListener("oventric:open-create", handler);
    return () => window.removeEventListener("oventric:open-create", handler);
  }, [require]);

  // Live counters for each mobile-footer section. Each increments as new rows
  // are inserted on the corresponding table and clears when that section is
  // active.
  const feedCount = useSectionLiveCounter({
    section: "feed",
    table: "posts",
    active: active === "Feed",
    excludeSelf: true,
  });
  const marketCount = useSectionLiveCounter({
    section: "market",
    table: "products",
    active: active === "Marketplace",
    excludeSelf: true,
  });
  const academyCount = useSectionLiveCounter({
    section: "academy",
    table: "courses",
    active: active === "Academy",
    excludeSelf: true,
  });
  const bountiesCount = useSectionLiveCounter({
    section: "bounties",
    table: "bounties",
    active: active === "Bounties",
    excludeSelf: true,
  });
  const walletCount = useSectionLiveCounter({
    section: "wallet",
    table: "wallet_transactions",
    active: active === "Wallet",
    requireAuth: true,
  });

  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<{ section?: string }>).detail;
      if (detail?.section) setActive(detail.section);
    };
    const onOpenDM = (e: Event) => {
      const detail = (e as CustomEvent<{ peerId?: string }>).detail;
      if (detail?.peerId) {
        setMessagesPeer(detail.peerId);
        setMessagesOpen(true);
      }
    };
    window.addEventListener("oventric:navigate", onNav);
    window.addEventListener("oventric:open-dm", onOpenDM);
    return () => {
      window.removeEventListener("oventric:navigate", onNav);
      window.removeEventListener("oventric:open-dm", onOpenDM);
    };
  }, []);

  // Resume the bounty publish flow after a successful wallet top-up.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "bounty") return;
    setActive("Bounties");
    // Give Bounties a tick to mount its listener before opening the editor.
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("oventric:bounty:open"));
    }, 120);
    // Clean the URL so refreshes don't re-trigger the flow.
    params.delete("resume");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
    return () => clearTimeout(t);
  }, []);

  // Deep link ?section=<name>&bounty=<id>&dm=<peerId> (used by notification links).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    const bountyId = params.get("bounty");
    const dmPeer = params.get("dm");
    const allowed = [
      "Home",
      "Feed",
      "Marketplace",
      "Academy",
      "Bounties",
      "Wallet",
      "Circles",
      "Messages",
    ];
    if (section && allowed.includes(section)) setActive(section);
    if (bountyId) {
      setActive("Bounties");
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("oventric:bounty:open-detail", { detail: { id: bountyId } }),
        );
      }, 160);
    }
    if (dmPeer) {
      setMessagesPeer(dmPeer);
      setMessagesOpen(true);
    }
    if (!section && !bountyId && !dmPeer) return;
    params.delete("section");
    params.delete("bounty");
    params.delete("dm");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, []);

  const isDesktop = useIsDesktop();
  const isAppShell = useIsAppShell();
  
  // The marketing site is the home surface for every browser visitor (any
  // width). Native builds and installed PWAs keep the app-style Home Hub.
  // We now extend desktopLanding to Marketplace for browser visitors to use the specialized header.
  const desktopLanding =
    (active === "Home" || active === "Marketplace" || active === "Academy" || active === "Bounties" || active === "Circles" || active === "Feed") &&
    (isDesktop || !isAppShell);
  const isMarketplace = active === "Marketplace";

  const rawView =
    active === "Home" ? (
      desktopLanding ? (
        <DesktopHome onSelect={setActive} onCreate={handleCreate} />
      ) : (
        <HomeHub
          onSelect={setActive}
          onCreate={handleCreate}
          onOpenMessages={() => setMessagesOpen(true)}
          returnedToHub={returnedToHub}
          counts={{
            Feed: feedCount.count,
            Market: marketCount.count,
            Academy: academyCount.count,
            Bounties: bountiesCount.count,
            Wallet: walletCount.count,
          }}
        />
      )
    ) : active === "Wallet" ? (
      launchCtx === "browser" ? (
        <AppOnlyScreen
          title="Your wallet lives in the app"
          description="Balances, top-ups, cashback and payouts are handled inside the Oventric app so your funds stay protected."
          from="wallet"
        />
      ) : (
        <Wallet />
      )
    ) : active === "Marketplace" ? (
      <Marketplace />
    ) : active === "Academy" ? (
      <Academy hubMode={active === "Academy"} />
    ) : active === "Bounties" ? (

      <Bounties />
    ) : active === "Messages" ? (
      launchCtx === "browser" ? (
        <AppOnlyScreen
          title="Chat lives in the app"
          description="Message sellers, negotiate and track orders in real time inside the Oventric app."
          from="messages"
        />
      ) : (
        <Messages variant="page" />
      )
    ) : active === "Circles" ? (
      <CirclesHub />
    ) : desktopLanding ? (
      <>
        <FeedSocialBar onOpenMessages={() => setMessagesOpen(true)} />
        <Feed />
      </>
    ) : (
      <Feed />
    );

  const view = <Suspense fallback={<SectionFallback />}>{rawView}</Suspense>;



  const isMessages = active === "Messages";

  return (
    <div className={`relative h-screen h-[100dvh] overflow-hidden ${!isAppShell ? "bg-white" : "bg-[#0A0A0B]"} text-slate-200`}>
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50  hidden md:block" />

      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-50  hidden md:block" />

      <div className="flex h-full flex-col">
        {/* Managed Header (Desktop Landing/Browser Context only) */}
        {desktopLanding ? (
          active === "Marketplace" || active === "Academy" ? (
            <MarketplaceHeader
              onSelect={setActive}
              avatarUrl={avatarUrl}
              name={name}
              search={renderNavSearch()}
              activeSection={active}
            />
          ) : (
            <SiteNavbar
              onSelect={setActive}
              onCreate={handleCreate}
              avatarUrl={avatarUrl}
              name={name}
              country={country ?? undefined}
              currency={baseCurrency ?? undefined}
              search={renderNavSearch()}
            />
          )
        ) : null}

        <div
          className={`flex flex-1 min-h-0 ${desktopLanding && active === "Marketplace" && !isDesktop ? "pt-0" : ""}`}
        >
          {!isDesktop && !desktopLanding && (
            <Sidebar onCreate={handleCreate} active={active} onSelect={setActive} />
          )}
          {isDesktop && !desktopLanding && <DesktopAppSidebar onSelect={setActive} />}

          <main
            id={desktopLanding ? "desktop-home-scroll" : undefined}
            className={`flex-1 min-w-0 min-h-0 ${isMessages ? "overflow-hidden" : "overflow-y-auto"} ${desktopLanding || isMessages ? "" : "pb-20 md:pb-0"} ${(!isAppShell || (isDesktop && (active === "Marketplace" || active === "Academy" || active === "Bounties" || active === "Circles" || active === "Feed" || active === "Messages"))) ? "bg-white" : ""}`}
          >
            {view}
            {desktopLanding && active !== "Home" && <SiteFooterAuto />}
          </main>
        </div>
        {isAppShell && !desktopLanding && !isMessages && (
          <MobileNav
            onCreate={handleCreate}
            active={active === "Wallet" ? "Wallet" : active === "Marketplace" ? "Market" : active}
            onSelect={(l) => setActive(l === "Market" ? "Marketplace" : l)}
            counts={{
              Feed: feedCount.count,
              Market: marketCount.count,
              Academy: academyCount.count,
              Bounties: bountiesCount.count,
              Wallet: walletCount.count,
            }}
          />
        )}
      </div>

      <Suspense fallback={null}>
        {createOpen && (
          <CreatePanel
            open={createOpen}
            initialChoice={createChoice}
            onClose={() => {
              setCreateOpen(false);
              setCreateChoice(null);
            }}
          />
        )}
        {getAppOpen && (
          <GetAppModal open={getAppOpen} onClose={() => setGetAppOpen(false)} from="create" />
        )}
        {messagesOpen && (
          <MessagesDrawer
            open={messagesOpen}
            onClose={() => {
              setMessagesOpen(false);
              setMessagesPeer(undefined);
            }}
            initialThreadId={messagesPeer}
          />
        )}
      </Suspense>

    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  Compass,
  Home,
  Menu,
  MessageSquare,
  Newspaper,
  Plus,
  ShoppingBag,
  Store,
  User,
  WalletCards,
  X,
} from "lucide-react";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CurrencyPreviewToggle } from "../CurrencyPreviewToggle";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { CountBadge } from "@/components/oventric/CountBadge";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import logo from "@/assets/oventric-logo-dark.png";

import { COUNTRY_META } from "@/lib/currency/africa";

const DESKTOP_NAV_ITEMS = [
  { label: "Home", section: "Home", icon: Home },
  { label: "Explore", section: "Explore", icon: Compass },
  { label: "Newsfeed", section: "Feed", icon: Newspaper },
  { label: "Creators", section: "Creators", icon: Clapperboard },
] as const;

const MOBILE_NAV_ITEMS = [
  ...DESKTOP_NAV_ITEMS,
  { label: "Marketplace", section: "Marketplace", icon: ShoppingBag },
  { label: "Wallet", section: "Wallet", icon: WalletCards },
] as const;

const MOBILE_NAV_TONES = [
  "bg-newsfeed-blue-soft text-newsfeed-blue",
  "bg-newsfeed-violet-soft text-newsfeed-violet",
  "bg-newsfeed-coral-soft text-newsfeed-coral",
  "bg-newsfeed-green-soft text-newsfeed-green",
  "bg-newsfeed-gold-soft text-newsfeed-gold",
] as const;

export type SiteNavbarProps = {
  onSelect: (section: string) => void;
  onCreate?: () => void;
  avatarUrl?: string | null;
  name?: string;
  country?: string;
  currency?: string;
  search?: React.ReactNode;
};

export function SiteNavbar({ onSelect, onCreate, avatarUrl, name, country, currency, search }: SiteNavbarProps) {
  const { baseCurrency } = useOnboarding();

  const { isAuthenticated, openGate } = useAuthGate();
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadNotifications = useUnreadNotificationsCount();

  const openNotifications = () => {
    if (!isAuthenticated) {
      openGate("generic");
      return;
    }
    setNotificationsOpen(true);
  };

  const openMessages = () => {
    if (!isAuthenticated) {
      openGate("generic");
      return;
    }
    // Open the chat drawer in place — same pattern as the shared Header —
    // instead of navigating to /messages (a redirect-only deep link).
    window.dispatchEvent(new CustomEvent("oventric:open-messages"));
  };

  useEffect(() => {
    const el = document.getElementById("desktop-home-scroll");
    const target: HTMLElement | Window = el ?? window;
    const read = () => {
      const y = el ? el.scrollTop : window.scrollY;
      setSolid(y > 12);
    };
    read();
    target.addEventListener("scroll", read, { passive: true });
    return () => target.removeEventListener("scroll", read);
  }, []);

  return (
    <div className="flex flex-col w-full">
      {/* Main Universal Header */}
      <header className={`sticky top-0 z-50 w-full transition-all duration-200 ${solid ? "web-glass shadow-[0_10px_30px_-24px_rgba(15,23,42,0.6)]" : "border-b border-transparent bg-white/70 backdrop-blur-md"}`}>
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:h-20 lg:px-11">
          {/* Logo */}
          <button
            type="button"
            onClick={() => onSelect("Home")}
            className="shrink-0"
            aria-label="Oventric home"
          >
            <img loading="lazy" decoding="async" src={logo} alt="Oventric" className="h-7 sm:h-9 w-auto object-contain" />
          </button>


          {/* Universal Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-bold text-slate-600">
            {DESKTOP_NAV_ITEMS.map(({ label, section, icon: Icon }) => (
              <button
                key={label}
                onClick={() => onSelect(section)}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-slate-900"
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </button>
            ))}
            <Link to="/sellers" className="inline-flex items-center gap-1.5 transition-colors hover:text-slate-900">
              <Store className="h-4 w-4" strokeWidth={2} />
              Shop
            </Link>
            <button
              onClick={() => onSelect("Marketplace")}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-3 text-white transition-colors hover:bg-slate-800"
            >
              <ShoppingBag className="h-4 w-4" strokeWidth={2} />
              Marketplace
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2 lg:gap-4 ml-auto">
            {/* Display currency preview (home ⇄ USD) */}
            <CurrencyPreviewToggle variant="light" className="inline-flex" />

            {/* Create Button (Desktop) */}
            {onCreate && (
              <button
                onClick={onCreate}
                className="web-glow-crimson hidden sm:flex items-center gap-1.5 h-10 px-4 rounded-full bg-crimson text-white text-sm font-bold transition-all hover:brightness-110 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Post</span>
              </button>
            )}

            <button
              type="button"
              onClick={openNotifications}
              aria-label={isAuthenticated ? "Open notifications" : "Sign in to view notifications"}
              className="relative grid min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-crimson/30"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              <CountBadge
                count={unreadNotifications}
                ariaLabel={`${unreadNotifications} unread notifications`}
              />
            </button>

            <button
              type="button"
              onClick={openMessages}
              aria-label={isAuthenticated ? "Open messages" : "Sign in to view messages"}
              className="relative grid min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-crimson/30"
            >
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* User Profile Link */}
            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              <button
                type="button"
                aria-label={isAuthenticated ? "Open menu" : "Connect account"}
                onClick={() => (isAuthenticated ? setMegaOpen(true) : openGate("generic"))}
                className="flex items-center gap-2 cursor-pointer group p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center transition-colors group-hover:border-crimson/40">
                  {isAuthenticated ? (
                    <AvatarImage src={avatarUrl ?? null} alt={name || "You"} loading="eager" />
                  ) : (
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                  )}
                </div>
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="p-1.5 sm:p-2 text-slate-900 lg:hidden"
            >
              {menuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-newsfeed-canvas text-newsfeed-ink lg:hidden">
          <div className="about-spectrum h-1 w-full" aria-hidden />
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-newsfeed-line bg-newsfeed-surface/95 p-4 backdrop-blur-md">
            <img loading="lazy" decoding="async" src={logo} alt="Oventric" className="h-6 w-auto" />
            <button onClick={() => setMenuOpen(false)} aria-label="Close navigation menu" className="grid size-10 place-items-center rounded-[10px] bg-newsfeed-coral-soft text-newsfeed-coral"><X className="w-5 h-5" /></button>
          </div>
          <nav className="space-y-6 p-5">
            <div className="space-y-4">
              <div>
                <p className="font-wallet-display text-xl font-bold">Where do you want to go?</p>
                <p className="mt-1 text-xs font-medium text-newsfeed-muted">Your Oventric spaces, all in one place.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {MOBILE_NAV_ITEMS.map(({ label, section, icon: Icon }, index) => (
                  <button
                    key={label}
                    onClick={() => { onSelect(section); setMenuOpen(false); }}
                    className="flex min-h-24 w-full flex-col items-start justify-between rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-3 text-left shadow-sm"
                  >
                    <span className={`grid size-9 place-items-center rounded-[8px] ${MOBILE_NAV_TONES[index % MOBILE_NAV_TONES.length]}`}><Icon className="h-4.5 w-4.5" strokeWidth={2.2} /></span>
                    <span className="font-wallet-display text-sm font-bold text-newsfeed-ink">{label}</span>
                  </button>
                ))}
              </div>
              <Link
                to="/sellers"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-12 w-full items-center gap-3 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface px-3 text-left font-bold text-newsfeed-ink"
              >
                <span className="grid size-8 place-items-center rounded-[8px] bg-newsfeed-green-soft text-newsfeed-green"><Store className="h-4 w-4" strokeWidth={2} /></span>
                Shop
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openNotifications();
                }}
                className="flex min-h-12 w-full items-center gap-3 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface px-3 text-left font-bold text-newsfeed-ink"
              >
                <span className="grid size-8 place-items-center rounded-[8px] bg-newsfeed-coral-soft text-newsfeed-coral"><Bell className="h-4 w-4" /></span> Notifications
                {unreadNotifications > 0 && (
                  <span className="rounded-full bg-crimson px-2 py-0.5 text-xs text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openMessages();
                }}
                className="flex min-h-12 w-full items-center gap-3 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface px-3 text-left font-bold text-newsfeed-ink"
              >
                <span className="grid size-8 place-items-center rounded-[8px] bg-newsfeed-blue-soft text-newsfeed-blue"><MessageSquare className="h-4 w-4" /></span> Messages
              </button>
            </div>
            {onCreate && (
              <button
                onClick={() => { onCreate(); setMenuOpen(false); }}
                className="w-full rounded-[10px] bg-newsfeed-violet py-4 text-center text-lg font-black text-newsfeed-on-accent shadow-lg"
              >
                Create new post
              </button>
            )}
          </nav>
        </div>
      )}

      <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />
      <NotificationsDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
}

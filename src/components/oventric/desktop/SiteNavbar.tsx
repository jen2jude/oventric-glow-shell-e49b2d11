import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, Plus, X, Search, User, MessageSquare } from "lucide-react";
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
            <img loading="lazy" decoding="async" src={logo} alt="Oventric" className="h-6 sm:h-8 w-auto object-contain" />
          </button>

          {/* Large Search Bar */}
          <div className="flex-1 max-w-2xl hidden md:block px-4">
            {search || (
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search Oventric..."
                  className="w-full h-11 pl-5 pr-12 rounded-full border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-crimson/50 focus:bg-white transition-all"
                />
                <button className="absolute right-0 top-0 h-full aspect-square flex items-center justify-center bg-slate-900 text-white rounded-full transition-transform active:scale-95">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Universal Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-bold text-slate-600">
            {["Home", "Explore", "Newsfeed", "Wallet"].map(item => (
              <button
                key={item}
                onClick={() => onSelect(item === "Newsfeed" ? "Feed" : item)}
                className="hover:text-slate-900 transition-colors"
              >
                {item}
              </button>
            ))}
            <Link to="/sellers" className="hover:text-slate-900 transition-colors">
              Shop
            </Link>
            <button
              onClick={() => onSelect("Marketplace")}
              className="px-4 py-3 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              Marketplace
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3 lg:gap-4 ml-auto">
            {/* Display currency preview (home ⇄ USD) */}
            <CurrencyPreviewToggle variant="light" className="hidden sm:inline-flex" />

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
              className="relative grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-crimson/30"
            >
              <Bell className="h-5 w-5" />
              <CountBadge
                count={unreadNotifications}
                ariaLabel={`${unreadNotifications} unread notifications`}
              />
            </button>

            {/* User Profile Link */}
            <div className="flex items-center gap-4 ml-auto">
              <button
                type="button"
                aria-label={isAuthenticated ? "Open menu" : "Connect account"}
                onClick={() => (isAuthenticated ? setMegaOpen(true) : openGate("generic"))}
                className="flex items-center gap-2 cursor-pointer group p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <div className="h-11 w-11 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center transition-colors group-hover:border-crimson/40">
                  {isAuthenticated ? (
                    <AvatarImage src={avatarUrl ?? null} alt={name || "You"} loading="eager" />
                  ) : (
                    <User className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="p-2 text-slate-900 lg:hidden"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-white lg:hidden overflow-y-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <img loading="lazy" decoding="async" src={logo} alt="Oventric" className="h-6 w-auto" />
            <button onClick={() => setMenuOpen(false)}><X className="w-6 h-6" /></button>
          </div>
          <nav className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Navigation</h3>
              {["Home", "Explore", "Newsfeed", "Marketplace", "Wallet"].map(item => (
                <button
                  key={item}
                  onClick={() => { onSelect(item === "Newsfeed" ? "Feed" : item); setMenuOpen(false); }}
                  className="block w-full text-left text-lg font-black text-slate-900"
                >
                  {item}
                </button>
              ))}
              <Link
                to="/sellers"
                onClick={() => setMenuOpen(false)}
                className="block w-full text-left text-lg font-black text-slate-900"
              >
                Shop
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openNotifications();
                }}
                className="flex min-h-11 w-full items-center gap-3 text-left text-lg font-black text-slate-900"
              >
                <Bell className="h-5 w-5" /> Notifications
                {unreadNotifications > 0 && (
                  <span className="rounded-full bg-crimson px-2 py-0.5 text-xs text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </button>
            </div>
            {onCreate && (
              <button
                onClick={() => { onCreate(); setMenuOpen(false); }}
                className="w-full py-4 rounded-[10px] bg-crimson text-white font-black text-center text-lg"
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

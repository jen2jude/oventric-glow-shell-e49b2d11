import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, User, Smartphone, Truck, RefreshCcw, Menu, X } from "lucide-react";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CurrencyPreviewToggle } from "@/components/oventric/CurrencyPreviewToggle";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { COUNTRY_META } from "@/lib/currency/africa";
import logo from "@/assets/oventric-logo-dark.png";

export type MarketplaceHeaderProps = {
  onSelect: (section: string) => void;
  avatarUrl?: string | null;
  name?: string;
  search?: React.ReactNode;
  activeSection?: string;
};


export function MarketplaceHeader({ onSelect, avatarUrl, name, search, activeSection }: MarketplaceHeaderProps) {
  const { isAuthenticated, openGate } = useAuthGate();
  const { country, baseCurrency } = useOnboarding();

  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);

  const flag = country ? (COUNTRY_META[country]?.flag ?? "") : "";

  return (
    <div className="flex flex-col w-full">
      {/* Top Utility Bar (Black) */}
      <div className="bg-black text-white py-3 px-4 sm:px-6 lg:px-11 hidden md:block">
        <div className="mx-auto max-w-[1440px] flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Truck className="w-3.5 h-3.5" /> Instant digital delivery
            </span>
            <span className="flex items-center gap-1.5">
              <RefreshCcw className="w-3.5 h-3.5" /> Escrow-backed refunds
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/help" className="hover:underline">Help</Link>
            <span className="flex items-center gap-1.5 cursor-pointer">
              <Smartphone className="w-3.5 h-3.5" /> Get the Oventric App
            </span>
          </div>
        </div>
      </div>

      {/* Main Header (White) */}
      <header className="web-glass sticky top-0 z-40">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6 md:px-8 lg:h-20 lg:gap-8 lg:px-12 xl:px-16">
          {/* Logo */}
          <button
            type="button"
            onClick={() => onSelect("Home")}
            className="shrink-0"
            aria-label="Oventric home"
          >
            <img loading="lazy" decoding="async" src={logo} alt="Oventric" className="h-6 sm:h-8 w-auto object-contain" />
          </button>

          <nav className="flex min-w-0 items-center gap-6 ml-4 text-[13px] font-bold hidden lg:flex">
            <button
              onClick={() => onSelect("Marketplace")}
              className={`hover:text-crimson transition-colors pb-1 border-b-2 ${activeSection === "Marketplace" ? "text-crimson border-crimson" : "border-transparent text-slate-900"}`}
            >
              Marketplace
            </button>
            <button
              onClick={() => onSelect("Explore")}
              className={`hover:text-crimson transition-colors pb-1 border-b-2 ${activeSection === "Explore" ? "text-crimson border-crimson" : "border-transparent text-slate-900"}`}
            >
              Explore
            </button>
            <button
              onClick={() => onSelect("Wallet")}
              className={`hover:text-crimson transition-colors pb-1 border-b-2 ${activeSection === "Wallet" ? "text-crimson border-crimson" : "border-transparent text-slate-900"}`}
            >
              Wallet
            </button>
          </nav>

          {/* Large Search Bar */}
          <div className="flex-1 max-w-2xl hidden md:block">
            {search || (
              <div className="relative group">
                <input
                  type="text"
                  placeholder="I'm looking for..."
                  className="w-full h-11 pl-5 pr-12 rounded-full border-2 border-slate-900 bg-white text-sm font-medium focus:outline-none"
                />
                <button className="absolute right-0 top-0 h-full aspect-square flex items-center justify-center bg-slate-900 text-white rounded-full transition-transform active:scale-95">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4 lg:gap-6 ml-auto">
            <CurrencyPreviewToggle variant="light" className="hidden md:flex" />
            {/* User Profile Link */}
            <div className="hidden lg:flex items-center gap-4">
              <button
                type="button"
                aria-label={isAuthenticated ? "Open menu" : "Connect account"}
                onClick={() => (isAuthenticated ? setMegaOpen(true) : openGate("generic"))}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="h-11 w-11 rounded-full overflow-hidden border border-slate-200 ring-2 ring-white ring-offset-2 ring-offset-slate-50 group-hover:ring-emerald-400 transition-all">
                  {isAuthenticated ? (
                    <AvatarImage src={avatarUrl ?? null} alt={name || "You"} loading="eager" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                </div>
              </button>
            </div>

            {/* Mobile Profile Link */}
            <div className="lg:hidden flex items-center gap-3">
              <button
                type="button"
                aria-label={isAuthenticated ? "Open menu" : "Connect account"}
                onClick={() => (isAuthenticated ? setMegaOpen(true) : openGate("generic"))}
                className="h-11 w-11 rounded-full overflow-hidden border border-slate-200 active:scale-95 transition-transform"
              >
                {isAuthenticated ? (
                  <AvatarImage src={avatarUrl ?? null} alt={name || "You"} loading="eager" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                )}
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2 text-slate-900 md:hidden"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>


      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-white md:hidden overflow-y-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <img loading="lazy" decoding="async" src={logo} alt="Oventric" className="h-6 w-auto" />
            <button onClick={() => setMenuOpen(false)}><X className="w-6 h-6" /></button>
          </div>
          <nav className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Main Menu</h3>
              {["Home", "Explore", "Marketplace", "Wallet"].map(item => (
                <button
                  key={item}
                  onClick={() => { onSelect(item); setMenuOpen(false); }}
                  className="block w-full text-left text-lg font-black text-slate-900"
                >
                  {item}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}

      <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />
    </div>
  );
}

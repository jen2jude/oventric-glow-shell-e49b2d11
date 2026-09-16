import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { trackPromoEvent } from "@/lib/promo-analytics";

type Promo = {
  id: string;
  title: string;
  body: string;
  cta: string;
  emoji: string;
  to?: string;
  search?: Record<string, unknown>;
  section?: string;
  warm?: boolean;
};

const PROMOS: Promo[] = [
  {
    id: "cashback",
    title: "Earn 2% cashback",
    body: "Money back into your cashback wallet on every order you place.",
    cta: "Shop now",
    emoji: "💰",
    section: "Marketplace",
  },
  {
    id: "refer",
    title: "Refer & earn",
    body: "Invite builders and earn from their activity on Oventric.",
    cta: "Invite friends",
    emoji: "🎁",
    to: "/affiliate",
    search: { reserve: "1" },
  },
];

const STORAGE_KEY_INDEX = "oventric:promo:index";
const STORAGE_KEY_LAST = "oventric:promo:lastShown";
const COOLDOWN_MS = 120_000;
const RETURN_DELAY_MS = 400;

const FLOATERS = ["✨", "🪙", "💎", "⭐", "🎉"];

function getStoredIndex(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(STORAGE_KEY_INDEX);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(n) ? 0 : n;
}

function setStoredIndex(i: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_INDEX, String(i));
}

function getLastShown(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(STORAGE_KEY_LAST);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(n) ? 0 : n;
}

function setLastShown(t: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_LAST, String(t));
}

/**
 * Rotating promotional splash. Appears only when the user leaves the home hub
 * and comes back, taking turns through the promo queue so each return surfaces
 * a fresh offer.
 */
export function PromoInterstitial({
  onSelect,
  returnedToHub,
}: {
  onSelect: (section: string) => void;
  returnedToHub?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(getStoredIndex());
  }, []);

  useEffect(() => {
    if (!returnedToHub || open) return;
    const lastShown = getLastShown();
    if (Date.now() - lastShown < COOLDOWN_MS) return;
    const t = setTimeout(() => setOpen(true), RETURN_DELAY_MS);
    return () => clearTimeout(t);
  }, [returnedToHub, open]);

  const promo = PROMOS[index % PROMOS.length]!;

  useEffect(() => {
    if (open) void trackPromoEvent("impression", { ...promo, surface: "home_interstitial" });
  }, [open, promo]);

  const close = () => {
    setOpen(false);
    const next = (getStoredIndex() + 1) % PROMOS.length;
    setStoredIndex(next);
    setLastShown(Date.now());
    setIndex(next);
  };

  const handleCta = () => {
    void trackPromoEvent("click", { ...promo, surface: "home_interstitial" });
    if (promo.section) onSelect(promo.section);
    close();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={promo.title}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md animate-fade-in"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm px-2 py-4 text-left animate-scale-in"
      >
        {/* Soft warm glow behind the splash */}
        <div className="pointer-events-none absolute top-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-promo-warm/30 blur-3xl" />


        {/* Floating decorative emojis */}
        {FLOATERS.map((icon, i) => (
          <span
            key={i}
            className={`pointer-events-none absolute text-xl ${i % 2 === 0 ? "animate-promo-float" : "animate-promo-float-slow"}`}
            style={{
              top: `${10 + (i * 18) % 70}%`,
              left: i % 2 === 0 ? "-8%" : "92%",
              animationDelay: `${i * 0.4}s`,
              opacity: 0.75,
            }}
          >
            {icon}
          </span>
        ))}

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute -right-1 -top-2 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        {/* Hero emoji */}
        <div className="relative mx-auto mb-4 flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-promo-gold/30 to-promo-warm/30 blur-2xl" />
          <span className="relative text-7xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            {promo.emoji}
          </span>
        </div>

        <div className="relative text-center">
          <div className="mx-auto mb-2 inline-flex items-center gap-1 rounded-full bg-promo-hot/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-promo-gold">
            <Sparkles className="h-3 w-3" />
            Just for you
          </div>

          <h2 className="bg-gradient-to-r from-promo-hot via-promo-warm to-promo-gold bg-clip-text text-3xl font-black leading-tight text-transparent">
            {promo.title}
          </h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white/75">{promo.body}</p>
        </div>


        <div className="relative mt-6">
          {promo.to ? (
            <Link
              to={promo.to}
              search={promo.search as never}
              onClick={handleCta}
              className="group flex h-12 w-full items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-promo-hot to-promo-warm text-sm font-bold text-white shadow-lg shadow-promo-hot/25 active:scale-95 transition-transform"
            >
              {promo.cta}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleCta}
              className="group flex h-12 w-full items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-promo-hot to-promo-warm text-sm font-bold text-white shadow-lg shadow-promo-hot/25 active:scale-95 transition-transform"
            >
              {promo.cta}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="mt-3 w-full text-center text-xs font-semibold text-white/45 hover:text-white transition-colors"
          >
            Not now
          </button>

        </div>
      </div>
    </div>
  );
}

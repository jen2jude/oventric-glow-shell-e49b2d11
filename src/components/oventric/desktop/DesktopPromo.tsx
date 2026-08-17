import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Download, GraduationCap, ShoppingBag, type LucideIcon } from "lucide-react";
import { trackPromoEvent, usePromoImpression } from "@/lib/promo-analytics";
import { Reveal } from "@/components/oventric/desktop/Reveal";
import promoCashbackArt from "@/assets/promo-cashback.png";
import promoReferArt from "@/assets/promo-refer.png";
import promoAdvertiseArt from "@/assets/promo-advertise.png";

type Banner = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
  glow: string;
  section: string;
};

const BANNERS: Banner[] = [
  {
    id: "assets",
    title: "Download millions of digital assets for free",
    subtitle: "Templates, kits, UI packs and more — free to grab",
    icon: Download,
    tint: "from-blue-500/15 to-blue-500/0",
    glow: "rgba(59,130,246,0.35)",
    section: "Marketplace",
  },
  {
    id: "shopping",
    title: "Save big on all your shopping",
    subtitle: "Up to 10% cashback on every completed order",
    icon: ShoppingBag,
    tint: "from-sky-400/15 to-sky-400/0",
    glow: "rgba(56,189,248,0.35)",
    section: "Marketplace",
  },
  {
    id: "skills",
    title: "Learn high value digital skills",
    subtitle: "Earn while you learn on Oventric Academy",
    icon: GraduationCap,
    tint: "from-indigo-500/15 to-indigo-500/0",
    glow: "rgba(99,102,241,0.35)",
    section: "Academy",
  },
];

export function DesktopPromo({ onSelect }: { onSelect: (section: string) => void }) {
  return (
    <section aria-label="Promotions" className="border-b border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-none px-5 py-12 sm:px-8 sm:py-16">
        <Reveal>
          <DesktopPromoBanners onSelect={onSelect} />
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:mt-10 lg:grid-cols-3">
          <Reveal delay={0}>
            <DesktopPromoCard
              id="cashback"
              title="Earn 2% cashback"
              highlight="on every order"
              body="Money back into your cashback wallet, automatically."
              cta="Shop now"
              onClick={() => onSelect("Marketplace")}
              art={promoCashbackArt}
              gradient="linear-gradient(135deg,#FFD22E 0%,#FFB020 55%,#FF8A3D 100%)"
            />
          </Reveal>
          <Reveal delay={90}>
            <DesktopPromoCard
              id="refer"
              title="Refer & earn"
              highlight="both sides win"
              body="Invite builders and earn from their activity."
              cta="Invite friends"
              to="/affiliate"
              search={{ reserve: "1" }}
              art={promoReferArt}
              gradient="linear-gradient(135deg,#7DE2A8 0%,#2ED3A0 55%,#12B39B 100%)"
            />
          </Reveal>
          <Reveal delay={180}>
            <DesktopPromoCard
              id="advertise"
              title="Advertise here"
              highlight="reach thousands"
              body="Put your product in front of Africa's builders."
              cta="Start a campaign"
              to="/advertise"
              search={{ start: "image" }}
              art={promoAdvertiseArt}
              gradient="linear-gradient(135deg,#7BC5FF 0%,#3D8DFF 55%,#6B5BFF 100%)"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function DesktopPromoBanners({ onSelect }: { onSelect: (section: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  const scrollTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = setInterval(() => {
      if (pausedRef.current) return;
      const el = trackRef.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) + 1) % BANNERS.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={() => {
          const el = trackRef.current;
          if (!el) return;
          setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
        onFocusCapture={() => (pausedRef.current = true)}
        onBlurCapture={() => (pausedRef.current = false)}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {BANNERS.map((b) => (
          <DesktopBannerSlide key={b.id} banner={b} onSelect={onSelect} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1">
        {BANNERS.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Show promotion ${i + 1}`}
            aria-current={i === active ? "true" : undefined}
            className="group inline-flex h-11 w-11 items-center justify-center"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-7 bg-blue-500" : "w-1.5 bg-slate-300 group-hover:bg-slate-400"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function DesktopBannerSlide({
  banner: b,
  onSelect,
}: {
  banner: Banner;
  onSelect: (section: string) => void;
}) {
  const ref = usePromoImpression<HTMLButtonElement>({
    id: `banner-${b.id}`,
    title: b.title,
    surface: "desktop_home_banner",
  });

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        void trackPromoEvent("click", {
          id: `banner-${b.id}`,
          title: b.title,
          surface: "desktop_home_banner",
        });
        onSelect(b.section);
      }}
      className="snap-center shrink-0 w-full text-left focus-visible:outline-none"
    >
      <div
        className={`hp-lift relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-4 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r ${b.tint} bg-white px-5 py-6 sm:flex sm:gap-6 sm:px-10 sm:py-9`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${b.glow}, transparent 70%)` }}
        />
        <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 sm:h-16 sm:w-16">
          <b.icon className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={2.4} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-base font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">
            {b.title}
          </span>
          <span className="mt-1 block text-xs text-slate-500 sm:text-sm">{b.subtitle}</span>
        </span>
        <span className="relative col-span-2 inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white sm:col-auto sm:px-6 sm:py-3 sm:text-sm">
          Explore <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

function DesktopPromoCard({
  id,
  title,
  highlight,
  body,
  cta,
  art,
  gradient,
  onClick,
  to,
  search,
}: {
  id: string;
  title: string;
  highlight: string;
  body: string;
  cta: string;
  art: string;
  gradient: string;
  onClick?: () => void;
  to?: string;
  search?: Record<string, unknown>;
}) {
  const promo = { id, title, surface: "desktop_home_promo_rail" };
  const ref = usePromoImpression<HTMLDivElement>(promo);
  const content = (
    <span
      className="promo-tile-surface relative block h-full min-h-[10.5rem] overflow-hidden rounded-[28px] p-5 pr-28 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.45)] sm:min-h-[12rem] sm:p-6 sm:pr-32"
      style={{ backgroundImage: gradient }}
    >
      <span className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-white/25 blur-2xl" />
      <span className="relative block text-lg font-extrabold leading-tight text-slate-900 sm:text-xl">
        {title}
      </span>
      <span className="relative mt-0.5 block text-[13px] font-bold leading-tight text-slate-900/80 sm:text-sm">
        {highlight}
      </span>
      <span className="relative mt-1.5 block max-w-[10rem] text-xs leading-relaxed text-slate-900/65 sm:max-w-[11rem]">
        {body}
      </span>
      <span className="promo-tile-cta relative mt-3.5 inline-flex min-h-[2.5rem] items-center gap-1 rounded-full bg-slate-950 px-4 py-3 text-xs font-bold text-white sm:mt-4 sm:px-5">
        {cta} <ChevronRight className="h-3.5 w-3.5" />
      </span>
      <img loading="lazy" decoding="async"
        src={art}
        alt=""
        aria-hidden
        width={768}
        height={768}
        className="promo-tile-art pointer-events-none absolute -bottom-3 right-[-10px] h-[100%] w-auto max-w-none object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.2)] sm:h-[110%]"
      />
    </span>
  );
  const cls = "promo-tile block w-full text-left";
  const handleClick = () => {
    void trackPromoEvent("click", promo);
    onClick?.();
  };
  return to ? (
    <Link
      ref={ref as unknown as React.Ref<HTMLAnchorElement>}
      to={to}
      search={search as never}
      className={cls}
      onClick={handleClick}
    >
      {content}
    </Link>
  ) : (
    <button
      ref={ref as unknown as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={handleClick}
      className={cls}
    >
      {content}
    </button>
  );
}

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import headphonesImg from "@/assets/promo-headphones.png";
import digitalImg from "@/assets/promo-digital.png";
import shoppingImg from "@/assets/promo-shopping.png";
import referImg from "@/assets/promo-refer.png";

type Slide = {
  id: string;
  badge: string;
  title: string[];
  description: string;
  cta: string;
  img: string;
  ring: string;
  bg: string;
  script?: string[];
  section: string;
};

const SLIDES: Slide[] = [
  {
    id: "main",
    badge: "More than a marketplace",
    title: ["Discover", "Amazing Things"],
    description: "Products, digital assets, courses, jobs and a community that grows together.",
    cta: "Explore Now",
    img: headphonesImg,
    ring: "shadow-[0_0_60px_18px_rgba(139,92,246,0.55)] border-[#A855F7]/70",
    bg: "linear-gradient(115deg, #14101F 0%, #1B1533 45%, #241A3F 100%)",
    script: ["Better", "Choices", "Bigger", "Opportunities"],
    section: "Marketplace",
  },
  {
    id: "digital",
    badge: "Premium assets",
    title: ["Shop & Download", "Digital Assets"],
    description: "Premium themes, plugins and AI tools from verified creators.",
    cta: "Explore Assets",
    img: digitalImg,
    ring: "shadow-[0_0_60px_18px_rgba(59,130,246,0.45)] border-[#3B82F6]/60",
    bg: "linear-gradient(115deg, #0E1424 0%, #131C36 50%, #16234A 100%)",
    section: "Marketplace",
  },
  {
    id: "shopping",
    badge: "Save big",
    title: ["Save Big On All", "Your Shopping"],
    description: "Buy from real sellers with secure escrow on every order.",
    cta: "Shop Now",
    img: shoppingImg,
    ring: "shadow-[0_0_60px_18px_rgba(229,72,77,0.45)] border-[#E5484D]/60",
    bg: "linear-gradient(115deg, #180C0E 0%, #261014 50%, #33131A 100%)",
    section: "Marketplace",
  },
  {
    id: "refer",
    badge: "Earn rewards",
    title: ["Refer A Friend", "& Earn"],
    description: "Invite builders you trust and earn on every purchase they make.",
    cta: "Invite Friends",
    img: referImg,
    ring: "shadow-[0_0_60px_18px_rgba(16,185,129,0.45)] border-[#10B981]/60",
    bg: "linear-gradient(115deg, #08161112 0%, #0C2119 50%, #0F2E22 100%)",
    section: "Affiliate",
  },
];

export function HubPromoCarousel({ onSelect }: { onSelect: (section: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const t = setInterval(() => {
      const el = trackRef.current;
      if (!el || paused.current) return;
      const next = (Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) + 1) % SLIDES.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) % SLIDES.length);
  };

  return (
    <section aria-label="Offers" className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onPointerDown={() => (paused.current = true)}
        onPointerUp={() => (paused.current = false)}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s) => (
          <div key={s.id} className="w-full shrink-0 snap-center">
            <button
              type="button"
              onClick={() => onSelect(s.section)}
              className="relative w-full overflow-hidden rounded-[14px] text-left aspect-[16/9] md:aspect-[16/7] border border-white/[0.07] active:scale-[0.995] transition-transform"
              style={{ backgroundImage: s.bg }}
            >

              {/* Copy block */}
              <div className="relative z-20 flex h-full max-w-[62%] flex-col justify-center px-5 py-5 md:px-7">
                <span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {s.badge}
                </span>
                <h2 className="mt-2 text-[19px] md:text-[24px] font-bold leading-[1.14] tracking-[-0.01em] text-white">
                  {s.title[0]}
                  <br />
                  {s.title[1]}
                </h2>
                <p className="mt-2 max-w-[19rem] text-[10.5px] md:text-[12px] leading-[1.45] text-white/55">
                  {s.description}
                </p>
                <span className="mt-3.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-semibold text-black md:px-4 md:py-2 md:text-[12px]">
                  {s.cta}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </div>

              {/* Product + ring */}
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[52%]">
                <div className="relative flex h-full items-center justify-center">
                  <span
                    className={`absolute aspect-square h-[76%] rounded-full border-2 ${s.ring} opacity-80`}
                  />
                  <img
                    loading="lazy"
                    decoding="async"
                    src={s.img}
                    alt=""
                    aria-hidden
                    width={1024}
                    height={1024}
                    className="relative z-10 h-[92%] w-auto max-w-[86%] object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
                  />
                  {s.script && (
                    <span className="absolute right-2 bottom-4 z-20 flex flex-col items-end leading-[1.05] font-serif italic text-white/85 text-[11px] md:text-[13px]">
                      {s.script.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5">
                {SLIDES.map((d, i) => (
                  <span
                    key={d.id}
                    className={
                      i === active
                        ? "h-1.5 w-1.5 rounded-full bg-white"
                        : "h-1.5 w-1.5 rounded-full bg-white/25"
                    }
                  />
                ))}
              </div>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

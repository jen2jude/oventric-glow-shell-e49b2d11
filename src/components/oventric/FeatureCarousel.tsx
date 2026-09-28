import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import mockCashback from "@/assets/mock-cashback.jpg";
import mockFeed from "@/assets/mock-feed.jpg";
import mockMarketplace from "@/assets/mock-marketplace.jpg";
import mockWallet from "@/assets/mock-wallet.jpg";
import oventricFull from "@/assets/oventric-full-transparent.png";
import { JourneyOrbit } from "@/components/oventric/onboarding/JourneyOrbit";
import { markCarouselSeen as markCarouselSeenFn } from "@/lib/carousel.functions";

interface Slide {
  id: string;
  image: string;
  title: string;
  description: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    id: "cashback",
    image: mockCashback,
    title: "Cashback",
    description: "Earn up to 50% seller-funded cashback on eligible purchases.",
    accent: "#E5484D",
  },
  {
    id: "feed",
    image: mockFeed,
    title: "Feed",
    description: "Follow creators and see what Africa's builders are shipping.",
    accent: "#E5484D",
  },
  {
    id: "marketplace",
    image: mockMarketplace,
    title: "Marketplace",
    description: "Buy and sell digital products and earn real money.",
    accent: "#E5484D",
  },
  {
    id: "wallet",
    image: mockWallet,
    title: "Sovereign Wallet",
    description: "Earn real cash to your wallet and withdraw it to your bank.",
    accent: "#E5484D",
  },
];

const CONGRATS_MS = 2400;
const ENTER = "feature-carousel-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards";
const IN_FROM_RIGHT = "feature-carousel-in-right 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards";
const IN_FROM_LEFT = "feature-carousel-in-left 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards";

type Phase = "journey" | "slides" | "congrats";

export function FeatureCarousel({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>("journey");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const markSeenServer = useServerFn(markCarouselSeenFn);

  // Congratulation splash, then hand over to the newsfeed.
  useEffect(() => {
    if (phase !== "congrats") return;
    const t = setTimeout(() => onComplete(), CONGRATS_MS);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const handleComplete = useCallback(() => {
    // Fire-and-forget server sync, signed-in users only; localStorage is the
    // source of truth on the device. Guests have no bearer token, so calling
    // the protected fn would throw "Unauthorized".
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        await markSeenServer();
      } catch {
        // ignore — local flag already persisted
      }
    })();
    setPhase("congrats");
  }, [markSeenServer]);

  const goTo = useCallback((next: number, dir?: 1 | -1) => {
    setIndex((cur) => {
      let target = next;
      if (target < 0) target = SLIDES.length - 1;
      if (target >= SLIDES.length) target = 0;
      setDirection(dir ?? (target === cur ? 1 : target > cur ? 1 : -1));
      return target;
    });
  }, []);

  const next = useCallback(() => goTo(index + 1, 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1, -1), [goTo, index]);

  // Keyboard navigation
  useEffect(() => {
    if (phase !== "slides") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") handleComplete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, handleComplete, phase]);

  // Touch swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0]!.clientX);
    setTouchDelta(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setTouchDelta(e.touches[0]!.clientX - touchStart);
  };

  const onTouchEnd = () => {
    if (touchStart === null) return;
    const threshold = 60;
    if (phase === "slides") {
      if (touchDelta > threshold) prev();
      else if (touchDelta < -threshold) next();
    }
    setTouchStart(null);
    setTouchDelta(0);
  };

  const slide = SLIDES[index]!;
  const isLast = index === SLIDES.length - 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9990] flex flex-col items-center justify-center bg-[#0A0A0B] text-white"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      aria-modal="true"
      role="dialog"
      data-onboarding-popup
      aria-label="Welcome to Oventric"
    >
      {phase === "journey" && (
        <div
          className="absolute inset-0 flex flex-col w-full overflow-hidden bg-[#0A0A0B]"
          style={{ animation: ENTER }}
        >
          {/* Ambient crimson glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 90% 55% at 50% 118%, rgba(229,72,77,0.22), transparent 65%), radial-gradient(ellipse 70% 40% at 50% -8%, rgba(229,72,77,0.10), transparent 60%)",
            }}
          />

          {/* Header */}
          <div className="relative flex items-center justify-center px-5 pt-10 pb-2 shrink-0">
            <img
              loading="eager"
              decoding="async"
              src={oventricFull}
              alt="Oventric"
              className="h-8 w-auto select-none drop-shadow-[0_0_18px_rgba(229,72,77,0.35)]"
              draggable={false}
            />
          </div>

          {/* Headline */}
          <div className="relative px-8 pt-4 pb-2 shrink-0 text-center">
            <h1 className="relative text-[22px] leading-snug font-bold tracking-tight text-white">
              Digital Marketplace &amp; Community{" "}
              <span className="text-[#E5484D]">for Creators.</span>
            </h1>
            <p className="mt-2 text-[13px] text-white/50 font-medium tracking-wide">
              Buy. Sell. Earn. Belong.
            </p>
          </div>

          <div className="relative flex-1 min-h-0 flex items-center justify-center px-5">
            <JourneyOrbit />
          </div>

          <div className="relative px-6 pb-10 pt-2 shrink-0">
            <button
              onClick={handleComplete}
              className="w-full h-14 rounded-[10px] bg-[#E5484D] text-white font-bold text-[15px] tracking-wide shadow-[0_12px_32px_-8px_rgba(229,72,77,0.55)] hover:bg-[#d13a3f] active:scale-[0.98] transition-all"
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {phase === "congrats" && (
        <div
          className="flex flex-col items-center text-center px-8 max-w-md"
          style={{ animation: ENTER }}
        >
          <div className="h-20 w-20 rounded-full border-2 border-[#E5484D] bg-[#E5484D]/10 shadow-[0_0_40px_-6px_rgba(229,72,77,0.5)] flex items-center justify-center mb-6">
            <Check className="w-9 h-9 text-[#E5484D]" strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-black mb-3">You're in.</h2>
          <p className="text-base text-white/60">Welcome to Oventric — taking you home.</p>
        </div>
      )}

      {phase === "slides" && (
        <div className="flex flex-col items-center w-full h-full">
          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 pt-5 pb-4 z-10">
            <img
              loading="lazy"
              decoding="async"
              src={oventricFull}
              alt="Oventric"
              className="h-8 w-auto select-none"
              draggable={false}
            />
            <button
              onClick={handleComplete}
              className="flex items-center gap-1 text-sm font-medium text-white/50 hover:text-white transition-colors"
              aria-label="Skip introduction"
            >
              Skip <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

          {/* Slide content */}
          <div className="relative w-full max-w-lg mx-auto px-6 flex-1 flex flex-col items-center justify-center">
            <div
              key={slide.id}
              className="feature-carousel-slide flex flex-col items-center text-center w-full"
              style={{
                animation: direction === 1 ? IN_FROM_RIGHT : IN_FROM_LEFT,
              }}
            >
              <div className="relative w-full aspect-[4/3] mb-7 rounded-[10px] overflow-hidden bg-[#151619] border border-white/[0.08] shadow-[0_24px_60px_-20px_rgba(229,72,77,0.35)]">
                <img
                  loading="lazy"
                  decoding="async"
                  src={slide.image}
                  alt={`${slide.title} preview on desktop and mobile`}
                  width={1024}
                  height={768}
                  className="w-full h-full object-cover select-none"
                  draggable={false}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(10,10,11,0.35), transparent 40%)",
                  }}
                />
              </div>

              <div className="w-12 h-1 rounded-full mb-5 bg-[#E5484D]" />

              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">{slide.title}</h2>
              <p className="text-base sm:text-lg text-white/60 leading-relaxed max-w-sm">
                {slide.description}
              </p>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="w-full max-w-md mx-auto px-6 pb-8 pt-4 z-10">
            <div className="flex items-center justify-center gap-2 mb-6">
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === index ? "w-8 bg-[#E5484D]" : "w-2 bg-white/20 hover:bg-white/35"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={prev}
                className="h-12 w-12 rounded-full bg-[#151619] border border-white/[0.08] flex items-center justify-center text-white hover:bg-[#1d1f23] transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </button>

              <button
                onClick={isLast ? handleComplete : next}
                className="flex-1 h-12 rounded-[10px] bg-[#E5484D] text-white font-bold text-sm shadow-[0_10px_28px_-8px_rgba(229,72,77,0.55)] hover:bg-[#d13a3f] active:scale-[0.98] transition-all"
              >
                {isLast ? "Get started" : "Next"}
              </button>

              <button
                onClick={next}
                className="h-12 w-12 rounded-full bg-[#151619] border border-white/[0.08] flex items-center justify-center text-white hover:bg-[#1d1f23] transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

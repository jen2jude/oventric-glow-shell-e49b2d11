import { useEffect, useRef, useState } from "react";
import { BadgePercent, ShieldCheck } from "lucide-react";

/** Nearest scrollable ancestor, falling back to the window. */
function scrollParent(el: HTMLElement | null): HTMLElement | Window {
  let node = el?.parentElement ?? null;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return window;
}

/**
 * Temu-style full-width trust strip across the top of the marketplace.
 * The strip is sticky on every viewport and smoothly hides on scroll-down,
 * reappearing on scroll-up.
 */
export function MarketplaceBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    // Hide-on-scroll is a desktop-only affordance. On mobile the strip stays
    // pinned to the top of the marketplace scroller at all times.
    if (!isWide) {
      setHidden(false);
      return;
    }

    const target = scrollParent(ref.current);
    const readTop = () => (target === window ? window.scrollY : (target as HTMLElement).scrollTop);
    let last = readTop();
    let raf = 0;

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const top = readTop();
        const delta = top - last;
        if (Math.abs(delta) > 6) {
          setHidden(top > 96 && delta > 0);
          last = top;
        }
      });
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isWide]);

  return (
    <div
      ref={ref}
      className={`w-full bg-slate-950 text-emerald-300 will-change-transform transition-transform duration-300 ease-out sticky top-0 z-30 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="max-w-7xl mx-auto w-full px-2 sm:px-4">
        {/* Single horizontal rail on all viewports. */}
        <div className="flex flex-row items-stretch gap-2 py-3 md:gap-3 lg:gap-6">
          <Item
            Icon={BadgePercent}
            title="Get up to 10% cashback on purchase"
            sub="Credited to your cashback wallet"
          />
          <Divider />
          <Item
            Icon={ShieldCheck}
            title="Buy from real verified vendors"
            sub="Escrow-protected on every order"
          />
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px shrink-0 bg-white/15 self-stretch" />;
}

function Item({
  Icon,
  title,
  sub,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex flex-1 min-w-0 items-center justify-start gap-2 px-0.5 md:gap-2.5 md:px-1 md:min-w-max md:justify-center">
      <Icon className="w-4 h-4 md:w-6 md:h-6 shrink-0 text-emerald-400" />
      <div className="min-w-0">
        <div className="text-[10px] sm:text-[11px] md:text-sm font-extrabold leading-tight text-emerald-300 break-words">
          {title}
        </div>
        <div className="text-[9px] sm:text-[10px] md:text-xs text-emerald-100/70 leading-tight break-words">
          {sub}
        </div>
      </div>
    </div>
  );
}

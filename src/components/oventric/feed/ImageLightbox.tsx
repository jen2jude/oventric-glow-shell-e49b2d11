import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, MousePointerClick, Pause } from "lucide-react";
import { ResponsiveImage } from "@/components/ui/responsive-image";

interface GalleryProps {
  images: string[];
  startIndex?: number;
  alt?: string;
  onClose: () => void;
}

// Backward-compatible props: callers may still pass `src` (single image).
type LegacyProps = { src: string; alt?: string; onClose: () => void };

export function ImageLightbox(props: GalleryProps | LegacyProps) {
  const images = "images" in props ? props.images : [props.src];
  const startIndex = "images" in props ? (props.startIndex ?? 0) : 0;
  const { alt, onClose } = props;

  const [index, setIndex] = useState(startIndex);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const teasedRef = useRef(false);
  const PEEK_KEY = "oventric:lightbox:peek-disabled";
  const [peekDisabled, setPeekDisabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(PEEK_KEY) === "1";
    } catch {
      return false;
    }
  });
  const togglePeek = () => {
    setPeekDisabled((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(PEEK_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const total = images.length;
  const clamp = (i: number) => Math.max(0, Math.min(total - 1, i));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => clamp(i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => clamp(i - 1));
    };
    document.addEventListener("keydown", onKey);
    // Hard lock the background: freeze the page in place and restore on close.
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, total]);

  // Snap the track to the active image only when index changes programmatically
  // (keyboard, buttons, peek). Do NOT snap when index changed from a user swipe,
  // otherwise the effect fights the ongoing scroll and causes jumps.
  const isProgrammaticScroll = useRef(false);
  const skipNextSnap = useRef(false);
  const snapToIndex = (i: number, behavior: ScrollBehavior = "smooth") => {
    const el = trackRef.current;
    if (!el) return;
    const targetLeft = i * el.clientWidth;
    if (Math.abs(el.scrollLeft - targetLeft) < 2) return;
    isProgrammaticScroll.current = true;
    el.scrollTo({ left: targetLeft, behavior });
    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 500);
  };

  // Initial position (no animation) and on resize
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollLeft = index * el.clientWidth;
    const onResize = () => {
      el.scrollLeft = index * el.clientWidth;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipNextSnap.current) {
      skipNextSnap.current = false;
      return;
    }
    snapToIndex(index);
  }, [index]);

  // Idle peek: after 10s viewing an image, slowly reveal the next image halfway, then return.
  // Cancels on user interaction (scroll/touch/wheel/key) or when the index changes.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (peekDisabled) return;
    if (total <= 1) return;
    if (index >= total - 1) return; // no next image to tease

    let returnTimer: number | undefined;
    const peekTimer = window.setTimeout(() => {
      const width = el.clientWidth;
      const base = index * width;
      isProgrammaticScroll.current = true;
      el.scrollTo({ left: base + Math.round(width * 0.5), behavior: "smooth" });
      returnTimer = window.setTimeout(() => {
        isProgrammaticScroll.current = true;
        el.scrollTo({ left: base, behavior: "smooth" });
        window.setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 500);
      }, 1400);
    }, 10000);

    const cancel = () => {
      window.clearTimeout(peekTimer);
      if (returnTimer) window.clearTimeout(returnTimer);
    };
    el.addEventListener("touchstart", cancel, { passive: true });
    el.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("keydown", cancel);

    return () => {
      cancel();
      el.removeEventListener("touchstart", cancel);
      el.removeEventListener("wheel", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [index, total, peekDisabled]);

  // Update index on scroll (swipe) — debounced via rAF, ignore programmatic scrolls.
  // Clamp to ±1 from current index so a fast flick can never skip past the neighbor.
  const rafRef = useRef<number | null>(null);
  const scrollEndTimer = useRef<number | null>(null);
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    if (isProgrammaticScroll.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const w = el.clientWidth;
      const raw = Math.round(el.scrollLeft / w);
      const limited = Math.max(index - 1, Math.min(index + 1, raw));
      if (limited !== raw) {
        // User swiped past the neighbor — clamp scroll back to the allowed neighbor.
        isProgrammaticScroll.current = true;
        el.scrollTo({ left: limited * w, behavior: "smooth" });
        window.setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 300);
      }
      if (limited !== index) {
        skipNextSnap.current = true;
        setIndex(clamp(limited));
      }
    });
    // After scroll settles, snap to the nearest allowed image.
    if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = window.setTimeout(() => {
      if (!el) return;
      const w = el.clientWidth;
      const raw = Math.round(el.scrollLeft / w);
      const limited = Math.max(index - 1, Math.min(index + 1, raw));
      const target = limited * w;
      if (Math.abs(el.scrollLeft - target) > 1) {
        isProgrammaticScroll.current = true;
        el.scrollTo({ left: target, behavior: "smooth" });
        window.setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 400);
      }
    }, 120);
  };

  // Translate vertical wheel to horizontal scroll for smooth desktop navigation
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollBy({ left: e.deltaY, behavior: "smooth" });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute z-20 p-2.5 rounded-full bg-white text-black shadow-lg hover:bg-white/90 border border-black/10"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)", right: "16px" }}
      >
        <X className="w-5 h-5" strokeWidth={2.5} />
      </button>

      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePeek();
          }}
          aria-label={peekDisabled ? "Enable auto peek" : "Disable auto peek"}
          title={peekDisabled ? "Auto peek: off" : "Auto peek: on"}
          className="absolute top-4 right-16 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 flex items-center gap-1 text-xs"
        >
          {peekDisabled ? <Pause className="w-4 h-4" /> : <MousePointerClick className="w-4 h-4" />}
          <span className="hidden sm:inline">{peekDisabled ? "Peek off" : "Peek on"}</span>
        </button>
      )}

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => clamp(i - 1));
            }}
            aria-label="Previous image"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 disabled:opacity-30"
            disabled={index === 0}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => clamp(i + 1));
            }}
            aria-label="Next image"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 disabled:opacity-30"
            disabled={index === total - 1}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/70 border border-white/20 text-white text-xs">
            {index + 1} / {total}
          </div>
        </>
      )}

      <div
        ref={trackRef}
        onScroll={onScroll}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory scroll-smooth overscroll-x-contain"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
        }}
      >
        {images.map((src, i) => (
          <div
            key={src + i}
            className="w-full h-full shrink-0 snap-center flex items-center justify-center p-4"
          >
            <ResponsiveImage
              src={src}
              alt={alt ?? `Image ${i + 1}`}
              className="max-h-full max-w-full object-contain rounded-[10px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

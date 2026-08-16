import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades + lifts its children into view on scroll.
 * Purely presentational: renders a plain element with the `hp-reveal` class.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    // Immediate check: anything already within (or above) the viewport shows now.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 1.1) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.01 },
    );
    io.observe(el);
    // Safety net: never leave content permanently invisible.
    const t = window.setTimeout(() => setShown(true), 1200);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, [shown]);


  return (
    <Tag
      ref={ref as never}
      className={`hp-reveal ${shown ? "is-in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

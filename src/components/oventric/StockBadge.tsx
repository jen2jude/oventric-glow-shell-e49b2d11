/**
 * Small "Out of stock" chip rendered beside a product price. `light` is for
 * white/website surfaces; the default tone matches the dark app shell.
 */
export function OutOfStockTag({
  light = false,
  className = "",
}: {
  light?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`shrink-0 rounded-[6px] border px-1.5 py-[2px] text-[9px] font-bold uppercase leading-none tracking-wide ${
        light
          ? "border-slate-200 bg-slate-100 text-slate-500"
          : "border-white/10 bg-white/[0.05] text-white/45"
      } ${className}`}
    >
      Out of stock
    </span>
  );
}

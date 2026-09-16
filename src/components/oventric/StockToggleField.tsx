import { PackageCheck, PackageX } from "lucide-react";

interface Props {
  inStock: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  appearance?: "dark" | "light";
}

/**
 * Availability switch shared by the digital publish forms and the
 * listing editor. Out-of-stock listings stay visible but cannot be bought.
 */
export function StockToggleField({ inStock, onChange, disabled, appearance = "dark" }: Props) {
  const light = appearance === "light";
  return (
    <div className={`rounded-[10px] border p-3 ${light ? "border-border bg-muted" : "border-white/10 bg-[#121214]"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={`flex items-center gap-2 text-sm font-bold ${light ? "text-foreground" : "text-white"}`}>
            {inStock ? (
              <PackageCheck className={`h-4 w-4 ${light ? "text-primary" : "text-emerald-400"}`} />
            ) : (
              <PackageX className={`h-4 w-4 ${light ? "text-destructive" : "text-[#E5484D]"}`} />
            )}
            Availability
          </div>
          <p className={`mt-0.5 text-[11px] ${light ? "text-muted-foreground" : "text-slate-400"}`}>
            {inStock
              ? "In stock — buyers can order this listing."
              : "Out of stock — the listing stays visible but buying is disabled."}
          </p>
        </div>
        <div className={`flex shrink-0 items-center gap-1 rounded-[10px] border p-1 ${light ? "border-border bg-background" : "border-white/10 bg-black/40"}`}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(true)}
            className={`rounded-[8px] px-3 py-1.5 text-[11px] font-bold transition-colors ${
              inStock ? (light ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-black") : (light ? "text-muted-foreground hover:text-foreground" : "text-slate-400 hover:text-white")
            }`}
          >
            In stock
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(false)}
            className={`rounded-[8px] px-3 py-1.5 text-[11px] font-bold transition-colors ${
              !inStock ? (light ? "bg-destructive text-destructive-foreground" : "bg-[#E5484D] text-white") : (light ? "text-muted-foreground hover:text-foreground" : "text-slate-400 hover:text-white")
            }`}
          >
            Out of stock
          </button>
        </div>
      </div>
    </div>
  );
}

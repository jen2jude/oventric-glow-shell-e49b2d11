import { PackageCheck, PackageX } from "lucide-react";

interface Props {
  inStock: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

/**
 * Availability switch shared by the digital + physical publish forms and the
 * listing editor. Out-of-stock listings stay visible but cannot be bought.
 */
export function StockToggleField({ inStock, onChange, disabled }: Props) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-[#121214] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            {inStock ? (
              <PackageCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <PackageX className="h-4 w-4 text-[#E5484D]" />
            )}
            Availability
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {inStock
              ? "In stock — buyers can order this listing."
              : "Out of stock — the listing stays visible but buying is disabled."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-[10px] border border-white/10 bg-black/40 p-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(true)}
            className={`rounded-[8px] px-3 py-1.5 text-[11px] font-bold transition-colors ${
              inStock ? "bg-emerald-500 text-black" : "text-slate-400 hover:text-white"
            }`}
          >
            In stock
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(false)}
            className={`rounded-[8px] px-3 py-1.5 text-[11px] font-bold transition-colors ${
              !inStock ? "bg-[#E5484D] text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Out of stock
          </button>
        </div>
      </div>
    </div>
  );
}

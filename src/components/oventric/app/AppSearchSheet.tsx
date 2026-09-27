import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import type { ProductDTO } from "@/lib/marketplace.functions";
import { safeFormatDisplayPrice } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { haptic } from "@/lib/haptics";
import { AppSheet } from "./AppSheet";

/**
 * Search-first bottom sheet for the app shell: a big search pill with live
 * results over the product catalogue. Tapping a result opens the product
 * quick-view sheet stacked on top.
 */
export function AppSearchSheet({
  open,
  onClose,
  products,
  currency,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  products: ProductDTO[];
  currency: Currency;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products.slice(0, 12);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.vendor.toLowerCase().includes(term) ||
          (p.category ?? "").toLowerCase().includes(term),
      )
      .slice(0, 30);
  }, [q, products]);

  const priceOf = (p: ProductDTO) =>
    safeFormatDisplayPrice(
      {
        price_usd: p.priceUSD,
        original_currency: p.originalCurrency,
        original_amount: p.originalAmount,
        fx_snapshot: p.fxSnapshot,
      },
      currency,
    );

  return (
    <AppSheet open={open} onClose={onClose} tall>
      <div className="flex h-full flex-col px-4 pb-6 pt-1">
        {/* Search pill */}
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] py-2.5 pl-4 pr-1.5">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, shops, categories"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="nav-tap flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08]"
          >
            <X className="h-4 w-4 text-white/80" />
          </button>
        </div>

        {/* Results */}
        <div className="mt-4 grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto pb-4">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                haptic("select");
                onPick(p.id);
              }}
              className="nav-tap overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-white/[0.04]">
                {p.coverUrl ? (
                  <img src={p.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-white/25">
                    No cover
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-1 text-[12px] font-semibold">{p.name}</p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-white/35">{p.vendor}</p>
                <p className="mt-1 text-[12px] font-bold text-[#E5484D]">{priceOf(p)}</p>
              </div>
            </button>
          ))}
          {results.length === 0 && (
            <p className="col-span-2 py-10 text-center text-[13px] text-white/40">
              Nothing matches “{q}” yet.
            </p>
          )}
        </div>
      </div>
    </AppSheet>
  );
}

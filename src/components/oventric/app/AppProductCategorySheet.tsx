import { PackageOpen, X } from "lucide-react";

import type { ProductDTO } from "@/lib/marketplace.functions";
import { AppProductCard } from "./AppProductCard";
import { AppSheet } from "./AppSheet";

export function AppProductCategorySheet({
  open,
  onClose,
  title,
  products,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  products: ProductDTO[];
  currency: string;
}) {
  const header = (
    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 pb-3 pt-2">
      <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#E5484D]/15 text-[#FF8A8E]">
        <PackageOpen className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-base font-bold">{title}</h2>
        <p className="text-[11px] text-white/45">
          {products.length} product{products.length === 1 ? "" : "s"}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <AppSheet open={open} onClose={onClose} tall header={header}>
      <div className="grid grid-cols-2 gap-3 px-4 pb-10 pt-4">
        {products.map((product) => (
          <AppProductCard key={product.id} product={product} currency={currency} />
        ))}
        {products.length === 0 && (
          <div className="col-span-2 grid place-items-center gap-2 py-16 text-center text-white/45">
            <PackageOpen className="h-8 w-8 text-white/25" />
            <p className="text-sm font-semibold">No products in this category yet.</p>
          </div>
        )}
      </div>
    </AppSheet>
  );
}
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, LayoutGrid, Sparkles, Store } from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";
import type { DiscoveryProduct } from "@/lib/discovery.functions";

const SECTION_TINTS = [
  "border-sky-100 bg-sky-50/60 text-sky-700",
  "border-violet-100 bg-violet-50/60 text-violet-700",
  "border-emerald-100 bg-emerald-50/60 text-emerald-700",
  "border-amber-100 bg-amber-50/60 text-amber-700",
  "border-rose-100 bg-rose-50/60 text-rose-700",
  "border-teal-100 bg-teal-50/60 text-teal-700",
];

function priceLabel(product: DiscoveryProduct, viewer: Currency): string {
  if (product.priceUsd <= 0) return "Free";
  return computeDisplayPrice(
    {
      price_usd: product.priceUsd,
      original_currency: product.originalCurrency,
      original_amount: product.originalAmount,
      fx_snapshot: product.fxSnapshot,
    },
    viewer,
  ).formatted;
}

function ProductGridCard({ product }: { product: DiscoveryProduct }) {
  const { baseCurrency } = useOnboarding();
  const free = product.priceUsd <= 0;
  return (
    <Link
      to="/product/$id"
      params={{ id: product.id }}
      className="overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm transition-transform active:scale-[0.98]"
    >
      <div className="relative h-28 w-full overflow-hidden bg-slate-100">
        {product.coverUrl ? (
          <img loading="lazy" decoding="async" src={product.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${product.hue}`} />
        )}
        {free ? (
          <>
            <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
              FREE
            </span>
            <span className="absolute right-2 top-2 max-w-[calc(100%-60px)] truncate rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              {product.category}
            </span>
          </>
        ) : (
          <span className="absolute left-2 top-2 max-w-[calc(100%-16px)] truncate rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            {product.category}
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-slate-950">{product.title}</p>
        <p className="mt-1 truncate text-[10.5px] text-slate-500">{product.vendor}</p>
        <p className={`mt-1 text-[12px] font-black ${free ? "text-emerald-600" : "text-[#E5484D]"}`}>
          {priceLabel(product, baseCurrency)}
        </p>
      </div>
    </Link>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  tint,
  products,
}: {
  title: string;
  subtitle: string;
  icon: typeof Store;
  tint: string;
  products: DiscoveryProduct[];
}) {
  if (products.length === 0) return null;
  return (
    <section aria-label={title} className="rounded-[10px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border ${tint}`}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          <h2 className="truncate text-sm font-black text-slate-950">{title}</h2>
          <p className="truncate text-[11px] text-slate-500">{subtitle}</p>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductGridCard key={`${title}-${product.id}`} product={product} />
        ))}
      </div>
    </section>
  );
}

/**
 * Marketplace sections rendered under "Shop the feed" inside the Shops tab.
 * Free products get their own category; the rest group by product category.
 */
export function ShopSections({ products }: { products: DiscoveryProduct[] }) {
  const { free, newest, categories } = useMemo(() => {
    const freeItems = products.filter((p) => p.priceUsd <= 0).slice(0, 8);
    const paid = products.filter((p) => p.priceUsd > 0);
    const byCategory = new Map<string, DiscoveryProduct[]>();
    paid.forEach((p) => {
      const key = p.category || "Other";
      const list = byCategory.get(key) ?? [];
      list.push(p);
      byCategory.set(key, list);
    });
    return {
      free: freeItems,
      newest: paid.slice(0, 8),
      categories: Array.from(byCategory.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 6)
        .map(([name, items]) => [name, items.slice(0, 8)] as const),
    };
  }, [products]);

  if (products.length === 0) return null;

  return (
    <div className="space-y-4">
      <Section
        title="Free downloads"
        subtitle="Grab these at no cost"
        icon={Gift}
        tint={SECTION_TINTS[2]}
        products={free}
      />
      <Section
        title="Popular right now"
        subtitle="Top digital products on Oventric"
        icon={Sparkles}
        tint={SECTION_TINTS[0]}
        products={newest}
      />
      {categories.map(([name, items], index) => (
        <Section
          key={name}
          title={name}
          subtitle="Browse this category"
          icon={index % 2 === 0 ? Store : LayoutGrid}
          tint={SECTION_TINTS[(index + 3) % SECTION_TINTS.length]}
          products={items}
        />
      ))}
    </div>
  );
}

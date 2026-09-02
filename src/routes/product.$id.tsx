import { GetAppButton } from "@/lib/app-gate";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { CreatorChip, EcosystemLinks } from "@/components/oventric/ecosystem/CreatorChip";

import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Heart,
  Share2,
  Check,
  Star,
  ShoppingBag,
  ShoppingCart,
  Flame,
  Sparkles,
  Loader2,
  Phone,
  MessageCircle,
  MapPin,
  X,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { SiteFooterAuto } from "@/components/oventric/desktop/SiteFooterAuto";
import { Header } from "@/components/oventric/Header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarketplaceHeader } from "@/components/oventric/desktop/MarketplaceHeader";
import { MobileNav } from "@/components/oventric/MobileNav";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import {
  getProduct,
  logProductContact,
  getProductContact,
  type ProductDTO,
} from "@/lib/marketplace.functions";
import { getProductRating, rateProduct } from "@/lib/product-reviews.functions";
import { supabase } from "@/integrations/supabase/client";
import { computeDisplayPrice, formatMoney, usdRate } from "@/lib/fx-display";
import { getServicePackages, type ServicePackage } from "@/lib/services.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { ProfileMessageModal } from "@/components/oventric/messaging/ProfileMessageModal";
import { ProductComments } from "@/components/oventric/ProductComments";
import { EditListingModal } from "@/components/oventric/EditListingModal";


function ProductRating({
  productId,
  initialAverage,
  initialCount,
  isAppShell,
}: {
  productId: string;
  initialAverage: number;
  initialCount: number;
  isAppShell: boolean;
}) {
  const { require } = useOnboarding();
  const fetchRating = useServerFn(getProductRating);
  const submitRating = useServerFn(rateProduct);
  const [average, setAverage] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [mine, setMine] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      try {
        const r = await fetchRating({ data: { productId, userId: uid } });
        if (!cancelled) {
          setAverage(r.average);
          setCount(r.count);
          setMine(r.myRating);
        }
      } catch {
        /* keep server-rendered values */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, fetchRating]);

  const rate = (stars: number) => {
    require(1, () => {
      setSaving(true);
      submitRating({ data: { productId, rating: stars } })
        .then((r) => {
          setAverage(r.average);
          setCount(r.count);
          setMine(r.myRating);
          toast.success("Thanks for rating!");
        })
        .catch((e: Error) => toast.error(e.message || "Could not save your rating"))
        .finally(() => setSaving(false));
    }, "buyer");
  };

  const shown = hover ?? mine ?? Math.round(average);

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1 text-sm text-amber-400">
        <Star className="w-4 h-4 fill-current" />
        <span className={`font-semibold ${isAppShell ? "text-amber-400" : "text-slate-900"}`}>{average.toFixed(1)}</span>
        <span className="text-red-500 font-semibold">
          ({count} {count === 1 ? "review" : "reviews"})
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            disabled={saving}
            aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(s)}
            onClick={() => rate(s)}
            className="p-0.5 disabled:opacity-50"
          >
            <Star
              className={`w-5 h-5 transition-transform hover:scale-110 ${s <= shown ? "text-amber-400 fill-current" : isAppShell ? "text-slate-600" : "text-slate-300"}`}
            />
          </button>
        ))}
        <span className={`ml-2 text-[11px] ${isAppShell ? "text-slate-400" : "text-slate-500"}`}>
          {mine ? `You rated ${mine}★ — tap to change` : "Tap to rate this product"}
        </span>
      </div>
    </div>
  );
}

function productDisplay(p: ProductDTO, viewer: Currency) {
  return computeDisplayPrice(
    {
      price_usd: p.priceUSD,
      original_currency: p.originalCurrency,
      original_amount: p.originalAmount,
      fx_snapshot: p.fxSnapshot,
    },
    viewer,
  );
}

export const Route = createFileRoute("/product/$id")({
  // Loader + head run on the server so shared links carry a real preview card.
  ssr: "data-only",
  validateSearch: (s: { qty?: unknown }): { qty?: number } => ({
    qty: Math.max(1, Math.min(20, Number(s?.qty ?? 1) || 1)),
  }),
  loader: async ({ params }) => {
    try {
      const p = await getProduct({ data: { id: params.id } });
      return {
        title: p.name as string,
        slug: (p.slug as string | null) ?? null,
        priceUSD: Number(p.priceUSD ?? 0),
        description:
          ((p.description as string) || "").slice(0, 155) ||
          "Buy digital assets from Oventric's marketplace.",
        image: (() => {
          const path =
            (p.coverPath as string | null) ?? (p.imagePaths as string[] | undefined)?.[0] ?? null;
          return path ? `https://oventric.com/api/public/img/product-covers/${path}` : null;
        })(),
      };
    } catch {
      return null;
    }
  },
  head: ({ params, loaderData }) => {
    // Canonical always points at the readable slug path, never the raw id.
    const url = `https://oventric.com/product/${loaderData?.slug ?? params.id}`;
    const title = loaderData?.title
      ? `${loaderData.title} · Oventric Marketplace`
      : "Product · Oventric Marketplace";
    const description =
      loaderData?.description ?? "Buy digital assets from Oventric's marketplace.";
    const image = loaderData?.image;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: loaderData?.title
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: loaderData.title,
                description,
                url,
                ...(image ? { image } : {}),
                offers: {
                  "@type": "Offer",
                  url,
                  price: String(loaderData.priceUSD ?? 0),
                  priceCurrency: "USD",
                  availability: "https://schema.org/InStock",
                },
              }),
            },
          ]
        : [],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const isAppShell = useIsAppShell();
  const { id } = Route.useParams();
  const routeSlug = Route.useLoaderData()?.slug ?? null;
  const navigate = useNavigate();

  // Keep the visible address clean: swap a raw id in the bar for the product slug.
  useEffect(() => {
    if (!routeSlug || routeSlug === id || typeof window === "undefined") return;
    const next = `/product/${routeSlug}${window.location.search}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [routeSlug, id]);
  const { baseCurrency, require } = useOnboarding();
  const load = useServerFn(getProduct);
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [contactOpen, setContactOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const loadPackages = useServerFn(getServicePackages);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  // Owner-only edit affordance.
  const [meId, setMeId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setMeId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);


  // Landing on a product from a scrolled list must start at the top —
  // otherwise the page looks frozen and pull-to-refresh can't arm.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    const raf = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(raf);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setProduct(null);
    setActiveImage(0);
    load({ data: { id } })
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  useEffect(() => {
    if (product?.kind !== "service") {
      setPackages([]);
      return;
    }
    let cancelled = false;
    loadPackages({ data: { productId: product.id } })
      .then((rows) => {
        if (cancelled) return;
        setPackages(rows);
        setSelectedPkg(rows[0]?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [product?.kind, product?.id, loadPackages]);

  const outOfStock = product?.inStock === false;

  const startCheckout = () => {
    if (product?.inStock === false) return;
    require(
      2,
      () =>
        navigate({
          to: "/checkout/$id",
          params: { id: product?.id ?? id },
          search: { qty, pkg: selectedPkg || undefined },
        }),
      "buyer",
    );
  };

  const openContact = () => {
    if (product?.inStock === false) return;
    require(1, () => setContactOpen(true), "buyer");
  };

  const openSellerChat = () => {
    require(1, () => setChatOpen(true), "buyer");
  };

  return (
    <div
      style={{ touchAction: "pan-y", overscrollBehaviorY: "auto" }}
      className={`min-h-screen ${isAppShell ? "bg-[#0A0A0B] text-slate-300" : "oventric-web bg-[#F7F8FA] text-slate-700"}`}
    >
      {!isAppShell && <Header onOpenMessages={() => {}} forceSiteNavbar={!isAppShell} />}
      <main className={`w-full ${isAppShell ? "max-w-6xl px-0 py-0 gap-0" : "max-w-[1440px] px-4 py-6 sm:px-6 lg:px-11"} mx-auto pb-32`}>
        {!isAppShell && (
          <nav className="mb-6 flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500">
            <Link to="/" className="hover:text-crimson">
              Home
            </Link>
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={() => {
                navigate({ to: "/" });
                setTimeout(
                  () =>
                    window.dispatchEvent(
                      new CustomEvent("oventric:navigate", { detail: { section: "Marketplace" } }),
                    ),
                  100,
                );
              }}
              className="hover:text-crimson"
            >
              Marketplace
            </button>
            {product?.category && (
              <>
                <span className="text-slate-300">/</span>
                <span className="capitalize text-slate-500">{product.category}</span>
              </>
            )}
            {product?.name && (
              <>
                <span className="text-slate-300">/</span>
                <span className="max-w-[280px] truncate font-bold text-slate-900">{product.name}</span>
              </>
            )}
          </nav>
        )}



        {error && (
          <div className={`${isAppShell ? "bg-[#16161A] border-red-500/20" : "bg-white border-red-200 shadow-sm"} md:shadow-sm md:bg-white border rounded-[10px] p-8 text-center`}>
            <div className="text-red-300 font-bold mb-1">Couldn't load product</div>
            <div className="text-sm text-slate-400 md:text-slate-500 mb-4">{error}</div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-semibold text-sm rounded-[10px]"
            >
              Browse marketplace
            </Link>
          </div>
        )}

        {!product && !error && (
          <div className="flex items-center gap-2 text-slate-400 md:text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading product…
          </div>
        )}

        {product && (
          <div className={`grid grid-cols-1 items-start ${isAppShell ? "lg:grid-cols-2 gap-0" : "md:grid-cols-[1.1fr_0.9fr] gap-10"}`}>
            <div className={`flex flex-col ${isAppShell ? "gap-0" : "gap-8"}`}>
              <div className={isAppShell ? "px-0 pt-0" : ""}>
                {(() => {
                  const gallery =
                    product.kind === "physical" && product.imageUrls.length > 0
                      ? product.imageUrls
                      : product.coverUrl
                        ? [product.coverUrl]
                        : [];
                  const cur = gallery[activeImage] ?? gallery[0];
                  return (
                    <>
                        <div className={`relative ${isAppShell ? "w-full aspect-[4/3] rounded-b-[10px] bg-[#141416] border-b border-white/[0.06]" : "web-card aspect-[4/3] overflow-hidden md:bg-slate-100"} overflow-hidden flex items-center justify-center`}>
                          {cur ? (
                            <ResponsiveImage
                              sizes="(min-width: 1024px) 640px, 100vw"
                              src={cur}
                              alt={product.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="eager"
                              fetchPriority="high"
                              decoding="async"
                            />
                          ) : (
                            <ShoppingCart className="w-12 h-12 text-white/20" />
                          )}
                          {isAppShell && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  navigate({ to: "/" });
                                  setTimeout(
                                    () =>
                                      window.dispatchEvent(
                                        new CustomEvent("oventric:navigate", { detail: { section: "Marketplace" } }),
                                      ),
                                    100,
                                  );
                                }}
                                className="absolute top-3 left-3 z-10 grid place-items-center h-9 w-9 rounded-full bg-black/50 backdrop-blur-xl-md border border-white/10 text-white"
                              >
                                <ArrowLeft className="w-[18px] h-[18px]" />
                              </button>
                              <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toast.success("Saved to your wishlist")}
                                  aria-label="Save product"
                                  className="grid place-items-center h-9 w-9 rounded-full bg-black/50 backdrop-blur-xl-md border border-white/10 text-white"
                                >
                                  <Heart className="w-[18px] h-[18px]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(window.location.href);
                                    toast.success("Link copied");
                                  }}
                                  aria-label="Share product"
                                  className="grid place-items-center h-9 w-9 rounded-full bg-black/50 backdrop-blur-xl-md border border-white/10 text-white"
                                >
                                  <Share2 className="w-[18px] h-[18px]" />
                                </button>
                              </div>
                              {gallery.length > 1 && (
                                <span className="absolute bottom-3 left-3 z-10 rounded-full bg-black/60 backdrop-blur-xl px-2 py-0.5 text-[11px] font-semibold text-white/90">
                                  {activeImage + 1}/{gallery.length}
                                </span>
                              )}
                            </>
                          )}
                          {product.promoted && !isAppShell && (
                            <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-black/60 text-emerald-300 border border-emerald-400/50 rounded px-2 py-0.5">
                              <Flame className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Promoted
                            </span>
                          )}
                        </div>
                      {gallery.length > 1 && (
                        <div className={`${isAppShell ? "mt-3 px-3" : "mt-3"} flex gap-2 overflow-x-auto scrollbar-none`}>
                          {gallery.map((url, i) => (
                            <button
                              key={url}
                              onClick={() => setActiveImage(i)}
                              className={`shrink-0 w-16 h-16 rounded-[10px] overflow-hidden border-2 ${i === activeImage ? (isAppShell ? "border-[#E5484D]" : "border-crimson") : isAppShell ? "border-white/10" : "border-slate-200"}`}
                            >
                              <img
                                src={url}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>


              {!isAppShell && (
                <div className="lg:block hidden">
                  <ProductComments productId={product.id} />
                </div>
              )}
            </div>

            <div className={isAppShell ? "px-4 pt-5 pb-28" : "md:sticky md:top-24 rounded-[10px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]"}>
              <div className={`text-xs font-bold uppercase tracking-widest ${isAppShell ? "text-[#E5484D]" : "text-crimson"} mb-2`}>

                {product.category}
                {product.subcategory ? ` · ${product.subcategory}` : ""}
              </div>
              <h1 className={`min-w-0 text-2xl md:text-3xl font-black ${isAppShell ? "text-white" : "text-slate-900"} md:text-slate-900 mb-2 truncate`}>
                {product.name}
              </h1>
              {outOfStock && (
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#E5484D]/12 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#E5484D]">
                  Out of stock
                </div>
              )}
              <div className="mb-3 space-y-2">
                <CreatorChip
                  idOrSlug={product.sellerSlug ?? product.sellerId}
                  name={product.vendor}
                  caption="Seller"
                  dark={isAppShell}
                />
                <EcosystemLinks
                  idOrSlug={product.sellerSlug ?? product.sellerId}
                  exclude={["marketplace"]}
                  dark={isAppShell}
                />
              </div>

              {product.kind === "physical" && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-300 md:text-slate-600 mb-4">
                  {product.location && (
                    <span className={`inline-flex items-center gap-1 ${isAppShell ? "bg-[#16161A] border-white/5 text-slate-400" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-0.5`}>
                      <MapPin className="w-3 h-3" /> {product.location}
                    </span>
                  )}
                  {product.condition && (
                    <span className={`${isAppShell ? "bg-[#16161A] border-white/5 text-slate-400" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-0.5`}>
                      {product.condition}
                    </span>
                  )}
                  {product.brand && (
                    <span className={`${isAppShell ? "bg-[#16161A] border-white/5 text-slate-400" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-0.5`}>
                      {product.brand}
                    </span>
                  )}
                  {product.negotiable && (
                    <span className={`${isAppShell ? "bg-[#16161A] border-white/5 text-slate-400" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-0.5`}>
                      Negotiable: {product.negotiable}
                    </span>
                  )}
                  {product.delivery && (
                    <span className={`${isAppShell ? "bg-[#16161A] border-white/5 text-slate-400" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-0.5`}>
                      Delivery: {product.delivery}
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <ProductRating
                  productId={product.id}
                  initialAverage={product.rating}
                  initialCount={product.reviews}
                  isAppShell={isAppShell}
                />
              </div>

              <div className="mb-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="about" className={`${isAppShell ? "border-white/5" : "border-slate-200"}`}>
                    <AccordionTrigger className={`${isAppShell ? "text-white" : "text-slate-900"} font-bold py-3 hover:no-underline`}>
                      About Item
                    </AccordionTrigger>
                    <AccordionContent className={`${isAppShell ? "text-slate-400" : "text-slate-600"} text-sm leading-relaxed`}>
                      {(() => {
                        const raw = (product.description || "").split("\n").map((l) => l.trim()).filter(Boolean);
                        const bullets = raw.filter((l) => /^([-•*✓·])\s+/.test(l)).map((l) => l.replace(/^([-•*✓·])\s+/, ""));
                        const body = raw.filter((l) => !/^([-•*✓·])\s+/.test(l)).join("\n");
                        return (
                          <>
                            <p className="whitespace-pre-wrap mb-3">
                              {body || (bullets.length === 0 ? "No description provided." : "")}
                            </p>
                            {bullets.length > 0 && (
                              <ul className="space-y-2">
                                {bullets.map((b) => (
                                  <li key={b} className="flex items-start gap-2">
                                    <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isAppShell ? "text-slate-500" : "text-emerald-600"}`} />
                                    <span>{b}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        );
                      })()}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="basic" className={`${isAppShell ? "border-white/5" : "border-slate-200"}`}>
                    <AccordionTrigger className={`${isAppShell ? "text-white" : "text-slate-900"} font-bold py-3 hover:no-underline`}>
                      Basic Info
                    </AccordionTrigger>
                    <AccordionContent className={`${isAppShell ? "text-slate-400" : "text-slate-600"} text-sm leading-relaxed`}>
                      {product.basicInfo || "No additional information provided."}
                      {product.kind === "physical" && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          {product.location && <div><span className="opacity-60">Location:</span> {product.location}</div>}
                          {product.condition && <div><span className="opacity-60">Condition:</span> {product.condition}</div>}
                          {product.brand && <div><span className="opacity-60">Brand:</span> {product.brand}</div>}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="description" className={`${isAppShell ? "border-white/5" : "border-slate-200"}`}>
                    <AccordionTrigger className={`${isAppShell ? "text-white" : "text-slate-900"} font-bold py-3 hover:no-underline`}>
                      Description
                    </AccordionTrigger>
                    <AccordionContent className={`${isAppShell ? "text-slate-400" : "text-slate-600"} text-sm leading-relaxed whitespace-pre-wrap`}>
                      {product.description || "No description provided."}
                    </AccordionContent>
                  </AccordionItem>

                  {product.kind !== "physical" && (
                    <AccordionItem value="activation" className={`${isAppShell ? "border-white/5" : "border-slate-200"}`}>
                      <AccordionTrigger className={`${isAppShell ? "text-white" : "text-slate-900"} font-bold py-3 hover:no-underline`}>
                        Activation Guide
                      </AccordionTrigger>
                      <AccordionContent className={`${isAppShell ? "text-slate-400" : "text-slate-600"} text-sm leading-relaxed whitespace-pre-wrap`}>
                        {product.activationGuide || "No activation guide provided."}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </div>

              <div className={`${isAppShell ? "bg-transparent border-transparent p-0 mb-5" : "web-card p-5 mb-4"}`}>

                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    {(() => {
                      const dp = productDisplay(product, baseCurrency);
                      return (
                        <>
                          <div className={`${isAppShell ? "text-white" : "text-crimson"} md:text-crimson font-black text-3xl`}>
                            {dp.formatted}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {product.kind === "digital" && packages.length === 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 md:text-slate-500 uppercase tracking-wide">
                        Qty
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={qty}
                        onChange={(e) =>
                          setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                        }
                        className={`w-16 ${isAppShell ? "bg-[#121214] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"} md:bg-slate-50 border md:border-slate-200 rounded-[10px] px-2 py-1.5 text-sm text-center`}
                      />
                    </div>
                  )}
                </div>
                {packages.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <div className={`text-xs uppercase tracking-wide ${isAppShell ? "text-slate-400" : "text-slate-500"}`}>
                      Choose a package
                    </div>
                    {packages.map((pk) => {
                      const active = pk.id === selectedPkg;
                      return (
                        <button
                          key={pk.id}
                          type="button"
                          onClick={() => setSelectedPkg(pk.id)}
                          className={`w-full rounded-[10px] border p-3 text-left transition-colors ${
                            active
                              ? "border-emerald-500 bg-emerald-500/10"
                              : isAppShell
                                ? "border-white/10 bg-[#121214] hover:bg-[#17171B]"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className={`text-sm font-black ${isAppShell ? "text-white" : "text-slate-900"}`}>
                                {pk.name}
                              </div>
                              {pk.summary && (
                                <p className={`mt-0.5 text-[11px] ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                                  {pk.summary}
                                </p>
                              )}
                              {pk.features.length > 0 && (
                                <ul className={`mt-1.5 space-y-0.5 text-[11px] ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                                  {pk.features.map((f) => (
                                    <li key={f}>• {f}</li>
                                  ))}
                                </ul>
                              )}
                              <div className={`mt-1.5 flex flex-wrap gap-x-3 text-[11px] ${isAppShell ? "text-slate-500" : "text-slate-500"}`}>
                                {pk.deliveryDays != null && <span>{pk.deliveryDays}-day delivery</span>}
                                {pk.revisions != null && <span>{pk.revisions} revisions</span>}
                              </div>
                            </div>
                            <span className={`shrink-0 font-black ${isAppShell ? "text-white" : "text-slate-900"}`}>
                              {pk.priceUsd === 0
                                ? "Free"
                                : formatMoney(
                                    pk.originalCurrency === baseCurrency
                                      ? pk.originalAmount
                                      : pk.priceUsd * usdRate(baseCurrency),
                                    baseCurrency,
                                  )}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {product.kind === "digital" && packages.length === 0 && (
                  <div className={`flex items-center justify-between text-xs ${isAppShell ? "text-slate-500" : "text-slate-400"} md:text-slate-500 mb-4`}>
                    <span>Line total</span>
                    <span className={`${isAppShell ? "text-white" : "text-slate-900"} md:text-slate-900 font-mono`}>
                      {productDisplay(product, baseCurrency).value === 0
                        ? "Free"
                        : formatMoney(productDisplay(product, baseCurrency).value * qty, baseCurrency)}
                    </span>
                  </div>
                )}
                {product.kind === "service" ? (
                  isAppShell ? (
                    <div className="fixed bottom-[92px] pb-safe left-0 right-0 z-20 px-4 py-3 bg-[#0A0A0B]/80 backdrop-blur-xl-xl border-t border-white/[0.06]">
                      <button
                        onClick={openSellerChat}
                        className="w-full inline-flex items-center justify-center gap-2 py-3.5 text-[14px] rounded-[10px] bg-[#E5484D] hover:bg-[#d13a3f] text-white font-black transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" /> Contact for this service
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={openSellerChat}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 text-sm rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-black transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" /> Contact for this service
                    </button>
                  )
                ) : isAppShell ? (
                  <div className="fixed bottom-[92px] pb-safe left-0 right-0 z-20 px-4 py-3 bg-[#0A0A0B]/80 backdrop-blur-xl-xl border-t border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/shop/$id"
                        params={{ id: product.sellerSlug ?? product.sellerId }}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-[13px] bg-white/[0.04] border border-white/10 text-white rounded-[10px] font-bold transition-colors"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Shop</span>
                      </Link>
                      
                      {product.kind !== "physical" && (
                        <button
                          onClick={openSellerChat}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-[13px] bg-[#1C1C1F] border border-white/[0.06] text-white rounded-[10px] font-bold transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat</span>
                        </button>
                      )}
                      
                      <button
                        onClick={product.kind === "physical" ? openContact : startCheckout}
                        disabled={outOfStock}
                        className={`flex-[1.5] inline-flex items-center justify-center gap-2 py-3 text-[13px] rounded-[10px] font-black transition-colors ${outOfStock ? "bg-white/[0.06] text-white/40 cursor-not-allowed" : "bg-[#E5484D] hover:bg-[#d13a3f] text-white"}`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>{outOfStock ? "Out of Stock" : "Buy Now"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {outOfStock ? (
                      <button
                        disabled
                        className="w-full inline-flex items-center justify-center gap-2 py-3 text-sm rounded-[10px] font-black bg-slate-200 text-slate-500 cursor-not-allowed"
                      >
                        <ShoppingCart className="w-4 h-4" /> Out of Stock
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={product.kind === "physical" ? openContact : startCheckout}
                          className="w-full inline-flex items-center justify-center gap-2 py-3 text-sm rounded-[10px] font-black bg-crimson hover:bg-crimson/90 text-white transition-colors"
                        >
                          <ShoppingCart className="w-4 h-4" /> Buy Now
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={openSellerChat}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-[13px] rounded-[10px] font-bold border border-slate-200 bg-white text-slate-700 hover:border-crimson hover:text-crimson transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" /> Chat
                          </button>
                          <Link
                            to="/shop/$id"
                            params={{ id: product.sellerSlug ?? product.sellerId }}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-[13px] rounded-[10px] font-bold border border-slate-200 bg-white text-slate-700 hover:border-crimson hover:text-crimson transition-colors"
                          >
                            <ShoppingBag className="w-4 h-4" /> Shop
                          </Link>
                        </div>
                        <p className="text-center text-[11.5px] text-slate-500">
                          Escrow-protected checkout with chat and delivery tracking.
                        </p>
                      </>
                    )}
                  </div>
                )}

              </div>

              {!isAppShell && (
                <div className="web-card mt-5 flex items-center gap-3 p-3.5">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-crimson/10 grid place-items-center text-[13px] font-black text-crimson">
                    {product.vendor?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold text-slate-900">{product.vendor}</div>
                    <div className="text-[11.5px] text-slate-500">Seller on Oventric</div>
                  </div>
                  <Link
                    to="/shop/$id"
                    params={{ id: product.sellerSlug ?? product.sellerId }}
                    className="shrink-0 rounded-[10px] border border-crimson/25 bg-crimson/5 px-3.5 py-2 text-[12.5px] font-bold text-crimson"
                  >
                    View Shop
                  </Link>
                </div>
              )}

              {meId && meId === product.sellerId && (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="mt-4 w-full rounded-[10px] border border-[#E5484D]/30 bg-[#E5484D]/10 px-4 py-3 text-[13px] font-bold text-[#E5484D]"
                >
                  Edit this listing
                </button>
              )}



              <div className={`${isAppShell ? "mt-4" : ""} text-[11px] text-slate-500 md:text-slate-500 inline-flex items-center gap-1`}>
                <Sparkles className={`w-3 h-3 ${isAppShell ? "text-[#E5484D]" : "text-emerald-400"}`} />
                {product.kind === "service"
                  ? "Service listing — message the provider to agree scope, timeline and price."
                  : product.kind === "physical"
                    ? "Deal directly with the seller — Oventric does not mediate."
                    : "Instant download after payment · Buyer protection covered"}
              </div>


            </div>
            
            {/* Review and Comment Section (Mobile/App fallback) */}
            <div className={`lg:col-span-2 ${!isAppShell ? "lg:hidden" : "px-4"}`}>
              <ProductComments productId={product.id} />
            </div>
          </div>
        )}
      </main>
      {!isAppShell && <SiteFooterAuto />}
      {product && editOpen && meId === product.sellerId && (
        <EditListingModal
          product={product}
          onClose={() => setEditOpen(false)}
          onResubmitted={() => {
            setEditOpen(false);
            load({ data: { id } })
              .then((p) => setProduct(p))
              .catch(() => {});
          }}
        />
      )}

      {product && product.kind !== "physical" && (
        <ProfileMessageModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          recipient={{
            userId: product.sellerId,
            displayName: product.vendor,
            slug: product.sellerSlug,
          }}
          pinnedProduct={{
            id: product.id,
            name: product.name,
            coverUrl: product.coverUrl,
            priceLabel: productDisplay(product, baseCurrency).formatted,
          }}
          initialDraft={
            product.kind === "service"
              ? `Hi ${product.vendor}! I'd like to talk about your service "${product.name}"${
                  packages.length > 0 && selectedPkg
                    ? ` (${packages.find((p) => p.id === selectedPkg)?.name ?? ""} package)`
                    : ` (from ${productDisplay(product, baseCurrency).formatted})`
                } on Oventric. Here's what I need:\n\n${typeof window !== "undefined" ? window.location.origin : "https://oventric.com"}/product/${product.slug ?? product.id}`
              : `Hi ${product.vendor}! I'm interested in "${product.name}" (${productDisplay(product, baseCurrency).formatted}) on Oventric. Is it available and can you deliver right away?\n\n${typeof window !== "undefined" ? window.location.origin : "https://oventric.com"}/product/${product.slug ?? product.id}`
          }
        />
      )}
      {contactOpen && product && product.kind === "physical" && (
        <ContactSellerModal product={product} onClose={() => setContactOpen(false)} isAppShell={isAppShell} />
      )}
      {isAppShell && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <MobileNav
            onCreate={() => {}}
            active="Market"
            onSelect={(section) => {
              navigate({ to: "/" });
              setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent("oventric:navigate", { detail: { section } }),
                );
              }, 30);
            }}
          />
        </div>
      )}
    </div>
  );
}

function ContactSellerModal({
  product,
  onClose,
  isAppShell,
}: {
  product: ProductDTO;
  onClose: () => void;
  isAppShell: boolean;
}) {
  const { baseCurrency } = useOnboarding();
  const logContact = useServerFn(logProductContact);
  const fetchContact = useServerFn(getProductContact);
  const [contact, setContact] = useState<{
    sellerPhone: string | null;
    whatsappNumber: string | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchContact({ data: { productId: product.id } })
      .then((c) => {
        if (!cancelled)
          setContact({ sellerPhone: c.sellerPhone, whatsappNumber: c.whatsappNumber });
      })
      .catch(() => {
        if (!cancelled)
          setContact({ sellerPhone: product.sellerPhone, whatsappNumber: product.whatsappNumber });
      });
    return () => {
      cancelled = true;
    };
  }, [product.id, fetchContact, product.sellerPhone, product.whatsappNumber]);
  const handleContact = (method: "call" | "whatsapp") => {
    void logContact({ data: { productId: product.id, method, note: note?.trim() || null } }).catch(
      () => {},
    );
  };
  const phone = (contact?.sellerPhone ?? product.sellerPhone ?? "").replace(/\D/g, "");
  const wa = (
    contact?.whatsappNumber ??
    contact?.sellerPhone ??
    product.whatsappNumber ??
    product.sellerPhone ??
    ""
  ).replace(/\D/g, "");
  const dp = productDisplay(product, baseCurrency);
  // Always quote in the viewer's own home currency — never the seller's.
  const priceLine = dp.formatted;
  // Use the public share endpoint so link previews (WhatsApp, iMessage, etc.)
  // scrape product-specific OG tags including the product cover image.
  const productUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/p/${product.id}`
      : `https://oventric.com/api/public/p/${product.id}`;
  const [note, setNote] = useState("");
  const baseMsg = `Hi! I saw your product "${product.name}" (${priceLine}${product.location ? ` — ${product.location}` : ""}) on Oventric. I would like to purchase it.`;
  const message = `${baseMsg}${note.trim() ? `\n\n${note.trim()}` : ""}\n\n${productUrl}`;
  const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
  const canCall = phone.length >= 6;
  const cover = (product.kind === "physical" && product.imageUrls[0]) || product.coverUrl;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`slide-up relative w-full max-w-md ${isAppShell ? "bg-[#1E1E24] border-white/10" : "bg-white border-slate-200 shadow-sm"} md:shadow-sm md:bg-white border rounded-t-2xl sm:rounded-[10px] p-6 shadow-2xl max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className={`text-lg font-bold ${isAppShell ? "text-white" : "text-slate-900"} md:text-slate-900`}>Contact the seller</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 md:hover:bg-slate-100 text-slate-400 md:text-slate-500 hover:text-white md:hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live preview card — mirrors what the seller will see */}
        <div className={`mb-4 rounded-[10px] border ${isAppShell ? "border-white/10 bg-[#121214]" : "border-slate-200 bg-slate-50"} md:border-slate-200 md:bg-slate-50 overflow-hidden`}>
          <div className="flex gap-3 p-3">
            <div className="shrink-0 w-20 h-20 rounded-[10px] overflow-hidden bg-white/5 md:bg-slate-100 flex items-center justify-center">
              {cover ? (
                <img
                  src={cover}
                  alt={product.name}
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShoppingCart className="w-6 h-6 text-white/30" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 truncate">
                {product.category}
                {product.subcategory ? ` · ${product.subcategory}` : ""}
              </div>
              <div className="text-sm font-bold text-white md:text-slate-900 truncate">
                {product.name}
              </div>
              <div className="text-xs text-slate-400 md:text-slate-500 truncate">
                by {product.vendor}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className={`${isAppShell ? "text-emerald-300" : "text-emerald-600"} font-black text-sm`}>{dp.formatted}</div>
                {product.location && (
                  <span className="text-[10px] text-slate-400 md:text-slate-500 inline-flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" /> {product.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`border-t ${isAppShell ? "border-white/10 bg-[#0f1012]" : "border-slate-200 bg-slate-100"} md:border-slate-200 md:bg-slate-100 px-3 py-2`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 md:text-slate-500">
                WhatsApp message preview
              </div>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message);
                    toast.success("WhatsApp message copied");
                  } catch {
                    toast.error("Could not copy message");
                  }
                }}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold ${isAppShell ? "text-emerald-300 hover:text-emerald-200" : "text-emerald-600 hover:text-emerald-700"}`}
              >
                <Copy className="w-3 h-3" /> Copy message
              </button>
            </div>
            <pre className={`text-xs ${isAppShell ? "text-slate-200" : "text-slate-700"} md:text-slate-700 whitespace-pre-wrap font-sans leading-relaxed break-words`}>
              {message}
            </pre>
          </div>
        </div>

        <label className="block text-[11px] uppercase tracking-widest text-slate-400 md:text-slate-500 mb-1">
          Add a note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 240))}
          rows={2}
          placeholder="e.g. Is this still available? Can I pick up today?"
          className={`w-full mb-4 ${isAppShell ? "bg-[#121214] border-white/10 text-white placeholder:text-slate-600" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"} md:bg-slate-50 border md:border-slate-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50`}
        />

        <p className="text-xs text-slate-400 md:text-slate-500 leading-relaxed mb-4">
          You will deal with the seller directly. Take precaution — Oventric does not monitor or
          mediate physical-goods transactions.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <a
            href={canCall ? `tel:+${phone}` : undefined}
            aria-disabled={!canCall}
            onClick={() => canCall && handleContact("call")}
            className={`inline-flex items-center justify-center gap-2 py-3 rounded-[10px] font-semibold text-sm ${canCall ? isAppShell ? "bg-white/10 text-white hover:bg-white/15" : "bg-slate-100 text-slate-900 hover:bg-slate-200 shadow-sm" : isAppShell ? "bg-white/5 text-slate-500 pointer-events-none" : "bg-slate-50 text-slate-300 pointer-events-none"} md:bg-slate-100 md:text-slate-900 md:hover:bg-slate-200`}
          >
            <Phone className="w-4 h-4" /> Call Seller
          </a>
          <a
            href={wa ? waUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => wa && handleContact("whatsapp")}
            className={`inline-flex items-center justify-center gap-2 py-3 rounded-[10px] font-semibold text-sm ${wa ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-white/5 text-slate-500 pointer-events-none"}`}
          >
            <MessageCircle className="w-4 h-4" /> Chat Seller
          </a>
        </div>
      </div>
    </div>
  );
}

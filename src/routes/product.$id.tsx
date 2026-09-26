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
  getRelatedProducts,
  type ProductDTO,
} from "@/lib/marketplace.functions";
import { getProductRating, rateProduct, replyToReview } from "@/lib/product-reviews.functions";
import { supabase } from "@/integrations/supabase/client";
import { computeDisplayPrice, formatMoney, usdRate } from "@/lib/fx-display";
import { getServicePackages, type ServicePackage } from "@/lib/services.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { ProfileMessageModal } from "@/components/oventric/messaging/ProfileMessageModal";
import { ProductComments } from "@/components/oventric/ProductComments";
import { EditListingModal } from "@/components/oventric/EditListingModal";
import { rememberRecentProduct } from "@/lib/recent-products";


function ProductRating({
  productId,
  initialAverage,
  initialCount,
  isAppShell,
  sellerId,
}: {
  productId: string;
  initialAverage: number;
  initialCount: number;
  isAppShell: boolean;
  sellerId: string;
}) {
  const { require } = useOnboarding();
  const fetchRating = useServerFn(getProductRating);
  const submitRating = useServerFn(rateProduct);
  const sendReply = useServerFn(replyToReview);
  const [average, setAverage] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [mine, setMine] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const isSeller = !!viewerId && viewerId === sellerId;
  const [reviews, setReviews] = useState<
    { id: string; rating: number; comment: string | null; createdAt: string; sellerReply?: string | null; sellerReplyAt?: string | null; user: { fullName: string | null; avatarUrl: string | null } }[]
  >([]);

  const submitReply = (reviewId: string) => {
    const text = replyText.trim();
    if (!text) return;
    setReplySaving(true);
    sendReply({ data: { reviewId, productId, reply: text } })
      .then((r) => {
        setReviews(r.reviews ?? []);
        setReplyOpen(null);
        setReplyText("");
        toast.success("Reply posted");
      })
      .catch((e: Error) => toast.error(e.message || "Could not post your reply"))
      .finally(() => setReplySaving(false));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!cancelled) setViewerId(uid);
      try {
        const r = await fetchRating({ data: { productId, userId: uid } });
        if (!cancelled) {
          setAverage(r.average);
          setCount(r.count);
          setMine(r.myRating);
          setReviews(r.reviews ?? []);
        }
      } catch {
        /* keep server-rendered values */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, fetchRating]);

  // A seller arriving from a review notification lands straight on the reviews.
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#reviews") return;
    if (reviews.length === 0) return;
    const el = document.getElementById("reviews");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [reviews.length]);

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
    <div id="reviews" className="mb-5 scroll-mt-24">
      <div className="flex items-center gap-1 text-sm text-newsfeed-gold">
        <Star className="w-4 h-4 fill-current" />
        <span className={`font-semibold ${isAppShell ? "text-amber-400" : "text-slate-900"}`}>{average.toFixed(1)}</span>
        <span className="font-semibold text-newsfeed-ink">
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
              className={`w-5 h-5 transition-transform hover:scale-110 ${s <= shown ? "fill-current text-newsfeed-gold" : "text-newsfeed-line"}`}
            />
          </button>
        ))}
        <span className={`ml-2 text-[11px] ${isAppShell ? "text-slate-400" : "text-slate-500"}`}>
          {mine ? `You rated ${mine}★ — tap to change` : "Tap to rate this product"}
        </span>
      </div>

      {reviews.filter((r) => (r.comment ?? "").trim()).length > 0 && (
        <div className="mt-4 space-y-3">
          {reviews
            .filter((r) => (r.comment ?? "").trim())
            .slice(0, 8)
            .map((r) => (
              <div
                key={r.id}
                className={`rounded-[10px] border p-3 ${isAppShell ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex items-center gap-2">
                  {r.user.avatarUrl ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={r.user.avatarUrl}
                      alt={r.user.fullName ?? "Buyer"}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${isAppShell ? "bg-white/10 text-slate-300" : "bg-slate-200 text-slate-600"}`}>
                      {(r.user.fullName ?? "U").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className={`text-xs font-semibold ${isAppShell ? "text-slate-200" : "text-slate-800"}`}>
                    {r.user.fullName ?? "Buyer"}
                  </span>
                  <span className="text-xs font-semibold text-amber-400">{r.rating}★</span>
                  <span className={`ml-auto text-[11px] ${isAppShell ? "text-slate-500" : "text-slate-400"}`}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className={`mt-2 text-sm leading-relaxed ${isAppShell ? "text-slate-300" : "text-slate-600"}`}>
                  {r.comment}
                </p>

                {r.sellerReply ? (
                  <div className={`mt-3 rounded-[10px] border-l-2 border-crimson pl-3 py-2 ${isAppShell ? "bg-white/[0.04]" : "bg-white"}`}>
                    <div className={`text-[11px] font-bold ${isAppShell ? "text-slate-200" : "text-slate-700"}`}>
                      Seller response
                      {r.sellerReplyAt && (
                        <span className={`ml-2 font-normal ${isAppShell ? "text-slate-500" : "text-slate-400"}`}>
                          {new Date(r.sellerReplyAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-sm leading-relaxed ${isAppShell ? "text-slate-300" : "text-slate-600"}`}>
                      {r.sellerReply}
                    </p>
                  </div>
                ) : null}

                {isSeller && (
                  replyOpen === r.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={3}
                        placeholder="Write your response to this buyer…"
                        className={`w-full rounded-[10px] border p-2 text-sm outline-none ${isAppShell ? "border-white/10 bg-black/30 text-slate-200" : "border-slate-200 bg-white text-slate-800"}`}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={replySaving || !replyText.trim()}
                          onClick={() => submitReply(r.id)}
                          className="rounded-[10px] bg-crimson px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {replySaving ? "Posting…" : "Post reply"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReplyOpen(null); setReplyText(""); }}
                          className={`text-xs font-semibold ${isAppShell ? "text-slate-400" : "text-slate-500"}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setReplyOpen(r.id); setReplyText(r.sellerReply ?? ""); }}
                      className="mt-2 text-xs font-bold text-crimson"
                    >
                      {r.sellerReply ? "Edit response" : "Reply"}
                    </button>
                  )
                )}
              </div>
            ))}
        </div>
      )}
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
  const loadRelated = useServerFn(getRelatedProducts);
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductDTO[]>([]);
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
        if (!cancelled) {
          setProduct(p);
          if (p.status === "active" && p.inStock && (p.kind === "digital" || p.kind === "service")) {
            rememberRecentProduct(p.id);
          }
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  useEffect(() => {
    if (!product) {
      setRelatedProducts([]);
      return;
    }
    let cancelled = false;
    loadRelated({
      data: { productId: product.id, category: product.category, kind: product.kind },
    })
      .then((items) => {
        if (!cancelled) setRelatedProducts(items);
      })
      .catch(() => {
        if (!cancelled) setRelatedProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.category, product?.kind, loadRelated]);

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
  /** Free listings are downloaded, not bought. */
  const isFree = Boolean(product) && Number(product?.priceUSD ?? 0) <= 0;

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
      className="web-product oventric-web min-h-screen bg-newsfeed-canvas text-newsfeed-ink"
    >
      {!isAppShell && <Header onOpenMessages={() => {}} forceSiteNavbar={!isAppShell} />}
      <main className="mx-auto w-full max-w-[1440px] px-3 pb-32 pt-3 sm:px-6 sm:pt-6 lg:px-11 lg:pt-8">
        {!isAppShell && (
          <div className="mb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                  return;
                }
                navigate({ to: "/marketplace" });
              }}
              className="group inline-flex items-center gap-2 rounded-full border border-newsfeed-line bg-white py-2 pl-2.5 pr-4 text-[13px] font-semibold text-newsfeed-ink shadow-sm transition hover:border-newsfeed-coral/40 hover:shadow"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-newsfeed-coral-soft text-newsfeed-coral transition group-hover:-translate-x-0.5">
                <ArrowLeft className="h-3.5 w-3.5" />
              </span>
              Back
            </button>

            <span className="hidden h-6 w-px bg-newsfeed-line sm:block" />

            <nav className="hidden min-w-0 items-center gap-2 text-[12.5px] font-medium text-slate-500 sm:flex">
              <Link to="/" className="transition hover:text-newsfeed-coral">
                Home
              </Link>
              <span className="text-slate-300">/</span>
              <Link to="/marketplace" className="transition hover:text-newsfeed-coral">
                Marketplace
              </Link>
              {product?.category && (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="inline-flex items-center rounded-full bg-newsfeed-gold-soft px-2.5 py-0.5 text-[11.5px] font-bold capitalize text-newsfeed-ink">
                    {product.category}
                  </span>
                </>
              )}
            </nav>
          </div>
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
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-12">
            <div className="flex flex-col gap-6 lg:col-span-7">
              <div>
                {(() => {
                  const gallery = Array.from(
                    new Set(
                      [product.coverUrl, ...(product.imageUrls ?? [])].filter(
                        (u): u is string => Boolean(u),
                      ),
                    ),
                  );
                  const cur = gallery[activeImage] ?? gallery[0];
                  return (
                    <>
                        <div className="product-gallery relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-coral-soft">
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
                            <ShoppingCart className="h-12 w-12 text-newsfeed-coral/30" />
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
                                 className="absolute left-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-newsfeed-line bg-newsfeed-surface/90 text-newsfeed-ink shadow-sm backdrop-blur-xl-md"
                              >
                                <ArrowLeft className="w-[18px] h-[18px]" />
                              </button>
                              <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toast.success("Saved to your wishlist")}
                                  aria-label="Save product"
                                   className="grid h-9 w-9 place-items-center rounded-full border border-newsfeed-line bg-newsfeed-surface/90 text-newsfeed-ink shadow-sm backdrop-blur-xl-md"
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
                                   className="grid h-9 w-9 place-items-center rounded-full border border-newsfeed-line bg-newsfeed-surface/90 text-newsfeed-ink shadow-sm backdrop-blur-xl-md"
                                >
                                  <Share2 className="w-[18px] h-[18px]" />
                                </button>
                              </div>
                              {gallery.length > 1 && (
                                 <span className="absolute bottom-3 left-3 z-10 rounded-full bg-newsfeed-ink/80 px-2 py-0.5 text-[11px] font-semibold text-newsfeed-on-accent backdrop-blur-xl">
                                  {activeImage + 1}/{gallery.length}
                                </span>
                              )}
                            </>
                          )}
                          {product.promoted && !isAppShell && (
                            <span className="absolute left-3 top-3 rounded-full border border-newsfeed-gold/30 bg-newsfeed-gold-soft px-2.5 py-1 text-[10px] font-bold uppercase text-newsfeed-ink">
                              <Flame className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Featured
                            </span>
                          )}
                        </div>
                      {gallery.length > 1 && (
                        <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-none">
                          {gallery.map((url, i) => (
                            <button
                              key={url}
                              onClick={() => setActiveImage(i)}
                              className={`h-16 w-16 shrink-0 overflow-hidden rounded-[10px] border-2 bg-newsfeed-surface ${i === activeImage ? "border-newsfeed-coral" : "border-newsfeed-line"}`}
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

            <div className="product-summary lg:col-span-5">
              <div className={`${isAppShell ? "pb-28" : ""} lg:sticky lg:top-24`}>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-newsfeed-coral-soft px-3 py-1.5 text-[10px] font-extrabold uppercase text-newsfeed-coral">
                <span className="h-1.5 w-1.5 rounded-full bg-newsfeed-coral" />

                {product.category}
                {product.subcategory ? ` · ${product.subcategory}` : ""}
              </div>
              <h1 className="mb-3 min-w-0 text-3xl font-extrabold leading-tight text-newsfeed-ink sm:text-4xl lg:text-5xl">
                {product.name}
              </h1>
              {outOfStock ? (
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#E5484D]/12 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#E5484D]">
                  Out of stock
                </div>
              ) : typeof product.stockQuantity === "number" ? (
                <div
                  className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
                    product.stockQuantity === 0
                      ? "bg-[#E5484D]/12 text-[#E5484D]"
                      : product.stockQuantity <= 5
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-emerald-500/12 text-emerald-600"
                  }`}
                >
                  {product.stockQuantity === 0
                    ? "Sold out"
                    : `${product.stockQuantity} in stock`}
                </div>
              ) : null}
              <div className="mb-4 space-y-2 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-3">
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

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <ProductRating
                  productId={product.id}
                  initialAverage={product.rating}
                  initialCount={product.reviews}
                  isAppShell={isAppShell}
                  sellerId={product.sellerId}
                />
              </div>

              <div className="mb-5 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface px-4">
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

                  <AccordionItem value="activation" className={`${isAppShell ? "border-white/5" : "border-slate-200"}`}>
                    <AccordionTrigger className={`${isAppShell ? "text-white" : "text-slate-900"} font-bold py-3 hover:no-underline`}>
                      Activation Guide
                    </AccordionTrigger>
                    <AccordionContent className={`${isAppShell ? "text-slate-400" : "text-slate-600"} text-sm leading-relaxed whitespace-pre-wrap`}>
                      {product.activationGuide || "No activation guide provided."}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              <div className="product-purchase mb-5 overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-surface shadow-newsfeed-panel">
                <div className="grid h-1.5 grid-cols-3" aria-hidden="true">
                  <span className="bg-newsfeed-coral" />
                  <span className="bg-newsfeed-gold" />
                  <span className="bg-newsfeed-blue" />
                </div>
                <div className="p-5 sm:p-6">

                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    {(() => {
                      const dp = productDisplay(product, baseCurrency);
                      return (
                        <>
                          <div className="text-3xl font-extrabold text-newsfeed-ink sm:text-4xl">
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
                        className="w-16 rounded-[10px] border border-newsfeed-line bg-newsfeed-blue-soft px-2 py-1.5 text-center text-sm font-bold text-newsfeed-ink"
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
                    <div className="fixed bottom-[92px] left-0 right-0 z-20 border-t border-newsfeed-line bg-newsfeed-surface/95 px-4 py-3 pb-safe backdrop-blur-xl-xl">
                      <button
                        onClick={openSellerChat}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-newsfeed-coral py-3.5 text-[14px] font-black text-newsfeed-on-accent transition-colors hover:bg-newsfeed-coral/90"
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
                  <div className="fixed bottom-[92px] left-0 right-0 z-20 border-t border-newsfeed-line bg-newsfeed-surface/95 px-4 py-3 pb-safe backdrop-blur-xl-xl">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/shop/$id"
                        params={{ id: product.sellerSlug ?? product.sellerId }}
                         className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface py-3 text-[13px] font-bold text-newsfeed-ink transition-colors"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Shop</span>
                      </Link>
                      
                      <button
                        onClick={openSellerChat}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-newsfeed-blue/25 bg-newsfeed-blue-soft py-3 text-[13px] font-bold text-newsfeed-ink transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Chat</span>
                      </button>

                      <button
                        onClick={startCheckout}
                        disabled={outOfStock}
                        className={`inline-flex flex-[1.5] items-center justify-center gap-2 rounded-[10px] py-3 text-[13px] font-black transition-colors ${outOfStock ? "cursor-not-allowed bg-newsfeed-line text-newsfeed-muted" : "bg-newsfeed-coral text-newsfeed-on-accent hover:bg-newsfeed-coral/90"}`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>{outOfStock ? "Out of Stock" : isFree ? "Download" : "Buy Now"}</span>
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
                          onClick={startCheckout}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-newsfeed-coral py-3 text-sm font-black text-newsfeed-on-accent transition-colors hover:bg-newsfeed-coral/90"
                        >
                          <ShoppingCart className="w-4 h-4" /> {isFree ? "Download" : "Buy Now"}
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

              </div>

              {!isAppShell && (
                <div className="mt-5 flex items-center gap-3 rounded-[10px] border border-newsfeed-gold/25 bg-newsfeed-gold-soft p-3.5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-newsfeed-surface text-[13px] font-black text-newsfeed-coral">
                    {product.vendor?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold text-newsfeed-ink">{product.vendor}</div>
                    <div className="text-[11.5px] text-newsfeed-ink">Seller on Oventric</div>
                  </div>
                  <Link
                    to="/shop/$id"
                    params={{ id: product.sellerSlug ?? product.sellerId }}
                    className="shrink-0 rounded-[10px] border border-newsfeed-coral/25 bg-newsfeed-surface px-3.5 py-2 text-[12.5px] font-bold text-newsfeed-coral"
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
                  : "Instant download after payment · Buyer protection covered"}
              </div>


            </div>
            </div>

            {/* Review and Comment Section (Mobile/App fallback) */}
            <div className={`lg:col-span-2 ${!isAppShell ? "lg:hidden" : "px-4"}`}>
              <ProductComments productId={product.id} />
            </div>

            {relatedProducts.length > 0 && (
              <section className={`lg:col-span-12 ${isAppShell ? "px-1" : ""}`} aria-labelledby="related-products-title">
                <div className="mb-4 flex items-end justify-between gap-4 border-t border-newsfeed-line pt-7 sm:pt-9">
                  <div>
                    <div className="mb-2 flex h-1.5 w-24 overflow-hidden rounded-full" aria-hidden="true">
                      <span className="flex-1 bg-newsfeed-coral" />
                      <span className="flex-1 bg-newsfeed-gold" />
                      <span className="flex-1 bg-newsfeed-blue" />
                      <span className="flex-1 bg-newsfeed-violet" />
                    </div>
                    <h2 id="related-products-title" className="text-xl font-extrabold text-newsfeed-ink sm:text-2xl">
                      You might also like
                    </h2>
                    <p className="mt-1 text-sm font-medium text-newsfeed-muted">
                      More from {product.category}
                    </p>
                  </div>
                  <Link
                    to="/marketplace"
                    className="shrink-0 text-sm font-bold text-newsfeed-coral hover:underline"
                  >
                    Browse all
                  </Link>
                </div>

                <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 lg:gap-4">
                  {relatedProducts.slice(0, 4).map((related) => {
                    const display = productDisplay(related, baseCurrency);
                    return (
                      <Link
                        key={related.id}
                        to="/product/$id"
                        params={{ id: related.slug ?? related.id }}
                        search={{ qty: 1 }}
                        className="group w-[72vw] max-w-[270px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-surface shadow-sm transition-transform hover:-translate-y-0.5 sm:w-auto sm:max-w-none"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-newsfeed-blue-soft">
                          {related.coverUrl ? (
                            <ResponsiveImage
                              src={related.coverUrl}
                              alt={related.name}
                              sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 72vw"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="grid h-full place-items-center">
                              <ShoppingBag className="h-8 w-8 text-newsfeed-blue/35" />
                            </div>
                          )}
                          {related.promoted && (
                            <span className="absolute left-2.5 top-2.5 rounded-full bg-newsfeed-gold-soft px-2 py-1 text-[10px] font-extrabold text-newsfeed-ink">
                              Featured
                            </span>
                          )}
                        </div>
                        <div className="p-3.5">
                          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold text-newsfeed-muted">
                            <span className="truncate">{related.vendor}</span>
                            {related.reviews > 0 && (
                              <span className="flex shrink-0 items-center gap-1 text-newsfeed-ink">
                                <Star className="h-3.5 w-3.5 fill-newsfeed-gold text-newsfeed-gold" />
                                {related.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          <h3 className="line-clamp-2 min-h-10 text-sm font-extrabold leading-5 text-newsfeed-ink">
                            {related.name}
                          </h3>
                          <div className="mt-3 text-base font-extrabold text-newsfeed-coral">
                            {display.value === 0 ? "Free" : display.formatted}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
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

      {product && (
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


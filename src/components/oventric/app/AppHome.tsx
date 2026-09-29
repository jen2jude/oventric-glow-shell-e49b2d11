import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Compass,
  Package,
  Search,
  Sparkles,
  Store,
  Wallet,
  Eye,
  EyeOff,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { listProducts, type ProductDTO } from "@/lib/marketplace.functions";
import { getWalletBalances } from "@/lib/wallet.functions";
import { usdEquivalent, visibleMoney, visibleProductPrice } from "@/lib/money-visibility";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { ProductQuickView } from "./ProductQuickView";
import { AppSearchSheet } from "./AppSearchSheet";
import { AppAddFundsSheet } from "@/components/oventric/app/AppAddFundsSheet";
import { PayoutModal } from "@/components/oventric/wallet/PayoutModal";
import { OutOfStockTag } from "@/components/oventric/StockBadge";

/**
 * Native app Home — a dark, compact dashboard that replaces the web marketing
 * homepage when Oventric runs as an installed app. Wallet-first, dense product
 * rails, no hero banners or footers.
 */
export function AppHome({
  onSelect,
  onCreate,
}: {
  onSelect: (section: string) => void;
  onCreate: () => void;
}) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const { homeCurrency, balancesHidden, toggleBalancesHidden } = useOnboarding();
  const { isAuthenticated } = useAuthGate();
  const currency = (homeCurrency ?? "USD") as Currency;

  const priceOf = (p: ProductDTO) =>
    visibleProductPrice(
      {
        price_usd: p.priceUSD,
        original_currency: p.originalCurrency,
        original_amount: p.originalAmount,
        fx_snapshot: p.fxSnapshot,
      },
      currency,
      balancesHidden,
    );

  const fetchProducts = useServerFn(listProducts);
  const fetchBalances = useServerFn(getWalletBalances);

  const { data: products } = useQuery({
    queryKey: ["app-home-products"],
    queryFn: () => fetchProducts(),
    staleTime: 60_000,
  });

  const { data: balances } = useQuery({
    queryKey: ["app-home-wallet"],
    queryFn: () => fetchBalances(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const fresh = useMemo(() => (products ?? []).slice(0, 10), [products]);
  const forYou = useMemo(() => (products ?? []).slice(10, 22), [products]);

  const available = balances ? (balances.balances[currency] ?? 0) : null;
  const inEscrow = balances ? (balances.escrow[currency] ?? 0) : null;

  const { data: userId } = useQuery({
    queryKey: ["app-home-uid", isAuthenticated],
    queryFn: async () => (await supabase.auth.getSession()).data.session?.user?.id ?? null,
    enabled: isAuthenticated,
  });
  // Greeting adapts to who the person is: guest, buyer, or seller.
  const isSeller = !!userId && (products ?? []).some((p) => p.sellerId === userId);
  const mode: "guest" | "buyer" | "seller" = !isAuthenticated
    ? "guest"
    : isSeller
      ? "seller"
      : "buyer";
  const categories = useMemo(
    () => Array.from(new Set((products ?? []).map((p) => String(p.category)))).slice(0, 8),
    [products],
  );

  // In the app shell a product tap slides up the quick-view sheet instead of
  // leaving the home screen; the full page is one tap deeper from the sheet.
  const openProduct = (p: ProductDTO) => {
    haptic("select");
    setQuickViewId(p.id);
  };

  // Own profile & shop are keyed by the auth user id (the routes resolve
  // id-or-slug), so resolve the session user right before navigating.
  const openOwn = async (dest: "profile" | "shop") => {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user?.id;
    if (!id) return;
    navigate({
      to: dest === "profile" ? "/profile/$id" : "/shop/$id",
      params: { id },
    });
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-4 text-white">
      {/* Search pill — opens the search sheet */}
      <button
        type="button"
        onClick={() => {
          haptic("select");
          setSearchOpen(true);
        }}
        className="nav-tap mt-4 flex w-full items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-left"
      >
        <Search className="h-4 w-4 shrink-0 text-white/40" />
        <span className="text-[13px] text-white/35">Search products, shops, categories</span>
      </button>

      {mode === "seller" ? (
        /* Sellers: wallet-forward card — money in is the point for them */
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#17171B] to-[#0C0C0E] p-4">
          <div
            className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(229,72,77,0.35), transparent 70%)" }}
          />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">Wallet balance</p>
              <button type="button" onClick={toggleBalancesHidden} aria-label={balancesHidden ? "Show amounts" : "Hide amounts"} className="grid size-7 place-items-center rounded-full text-white/60 hover:bg-white/10">
                {balancesHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[24px] font-extrabold leading-none tracking-tight">
                  {available === null ? "—" : visibleMoney(available, currency, balancesHidden)}
                </p>
                {available !== null && usdEquivalent(available, currency, balancesHidden) && <p className="mt-1 truncate text-[11px] text-white/45">{usdEquivalent(available, currency, balancesHidden)}</p>}
              </div>
              {inEscrow !== null && inEscrow > 0 && (
                <div className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-right">
                  <p className="text-[9px] font-medium uppercase tracking-widest text-white/40">In escrow</p>
                  <p className="mt-0.5 text-[12px] font-bold text-white/85">{visibleMoney(inEscrow, currency, balancesHidden)}</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => { haptic("select"); setFundOpen(true); }}
                className="nav-tap flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#E5484D] py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(229,72,77,0.6)]"
              >
                <ArrowDownToLine className="h-4 w-4" /> Top up
              </button>
              <button
                type="button"
                onClick={() => { haptic("select"); setPayoutOpen(true); }}
                className="nav-tap flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] py-2.5 text-[13px] font-bold text-white"
              >
                <ArrowUpFromLine className="h-4 w-4" /> Withdraw
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Buyers & visitors: discovery-first, no "earn" language */
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#17171B] to-[#0C0C0E] p-5">
          <div
            className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(229,72,77,0.22), transparent 70%)" }}
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-extrabold leading-tight tracking-tight">
                  {mode === "guest" ? "Welcome to Oventric" : "Find something great today"}
                </p>
                <p className="mt-1 text-[12px] text-white/50">
                  Templates, presets, courses and more from creators you'll love.
                </p>
              </div>
              {mode === "buyer" && available !== null && (
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <div className="flex items-center rounded-full border border-white/10 bg-white/[0.06]">
                    <button type="button" onClick={() => onSelect("Wallet")} className="nav-tap px-2.5 py-1.5 text-[11px] font-bold text-white/80" aria-label="Open wallet">{visibleMoney(available, currency, balancesHidden)}</button>
                    <button type="button" onClick={toggleBalancesHidden} className="pr-2 text-white/60" aria-label={balancesHidden ? "Show amounts" : "Hide amounts"}>{balancesHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>
                  </div>
                  {usdEquivalent(available, currency, balancesHidden) && <span className="text-[10px] text-white/45">{usdEquivalent(available, currency, balancesHidden)}</span>}
                </div>
              )}
            </div>
            {categories.length > 0 && (
              <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      haptic("select");
                      onSelect("Marketplace");
                    }}
                    className="nav-tap shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold capitalize text-white/75"
                  >
                    {c.replace(/[-_]/g, " ")}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                haptic("select");
                onSelect("Marketplace");
              }}
              className="nav-tap mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#E5484D] py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(229,72,77,0.6)]"
            >
              <Compass className="h-4 w-4" /> Start browsing
            </button>
          </div>
        </div>
      )}

      {/* Quick actions — everything the bottom dock doesn't already cover */}
      {mode !== "guest" && (
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[
            { icon: Package, label: "Purchases", run: () => onSelect("Purchases") },
            { icon: Wallet, label: "Wallet", run: () => onSelect("Wallet") },
            mode === "seller"
              ? { icon: Store, label: "My shop", run: () => openOwn("shop") }
              : { icon: Store, label: "Market", run: () => onSelect("Marketplace") },
            { icon: Compass, label: "Explore", run: () => onSelect("Explore") },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                haptic("select");
                a.run();
              }}
              className="nav-tap flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] py-3"
            >
              <a.icon className="h-[18px] w-[18px] text-[#E5484D]" strokeWidth={2.2} />
              <span className="text-[10px] font-semibold text-white/70">{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Fresh drops rail */}
      {fresh.length > 0 && (
        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[14px] font-bold tracking-tight">
              <Sparkles className="h-4 w-4 text-[#E5484D]" /> Fresh drops
            </h2>
            <button
              type="button"
              onClick={() => onSelect("Marketplace")}
              className="text-[11px] font-semibold text-white/40"
            >
              See all
            </button>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {fresh.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openProduct(p)}
                className="nav-tap w-[136px] shrink-0 snap-start text-left"
              >
                <div className="aspect-square w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04]">
                  {p.coverUrl ? (
                    <img src={p.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/25">
                      No cover
                    </div>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-1 text-[12px] font-semibold">{p.name}</p>
                <p className={`flex items-center gap-1.5 text-[11px] font-bold ${p.inStock === false ? "text-white/35" : "text-[#E5484D]"}`}>
                  <span className="truncate">{priceOf(p)}</span>
                  {p.inStock === false && <OutOfStockTag />}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* For you dense grid */}
      {forYou.length > 0 && (
        <div className="mt-7">
          <h2 className="mb-3 text-[14px] font-bold tracking-tight">For you</h2>
          <div className="grid grid-cols-2 gap-3">
            {forYou.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openProduct(p)}
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
                  <p className={`mt-1 flex items-center gap-1.5 text-[12px] font-bold ${p.inStock === false ? "text-white/35" : "text-[#E5484D]"}`}>
                    <span className="truncate">{priceOf(p)}</span>
                    {p.inStock === false && <OutOfStockTag />}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <AppSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products ?? []}
        currency={currency}
        onPick={(id) => {
          setSearchOpen(false);
          setQuickViewId(id);
        }}
      />
      <ProductQuickView
        productId={quickViewId}
        currency={currency}
        onClose={() => setQuickViewId(null)}
      />
      {fundOpen && <AppAddFundsSheet onClose={() => setFundOpen(false)} />}
      {payoutOpen && <PayoutModal onClose={() => setPayoutOpen(false)} />}
    </div>
  );
}

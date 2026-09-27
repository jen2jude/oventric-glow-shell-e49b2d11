import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Compass,
  MessageCircle,
  Package,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { listProducts, type ProductDTO } from "@/lib/marketplace.functions";
import { getWalletBalances } from "@/lib/wallet.functions";
import { safeFormatDisplayPrice, formatMoney } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { NotificationsDrawer } from "@/components/oventric/NotificationsDrawer";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";

/**
 * Native app Home — a dark, compact dashboard that replaces the web marketing
 * homepage when Oventric runs as an installed app. Wallet-first, dense product
 * rails, no hero banners or footers.
 */
export function AppHome({
  name,
  avatarUrl,
  onSelect,
  onCreate,
  onOpenMessages,
}: {
  name: string;
  avatarUrl: string | null;
  onSelect: (section: string) => void;
  onCreate: () => void;
  onOpenMessages: () => void;
}) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const { baseCurrency } = useOnboarding();
  const { isAuthenticated } = useAuthGate();
  const { messages: unreadChats, total: unreadNotifs } = useUnreadCounts();
  const currency = (baseCurrency ?? "USD") as Currency;

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

  const firstName = name.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const openProduct = (p: ProductDTO) => {
    haptic("select");
    navigate({ to: "/product/$id", params: { id: p.id } });
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
      {/* Top bar: identity + alerts */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            haptic("select");
            onSelect("Profile");
          }}
          className="nav-tap flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06]"
          aria-label="Your profile"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-white/70">
              {firstName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-white/40">{greeting},</p>
          <p className="truncate text-[15px] font-bold tracking-tight">{firstName}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic("select");
            onOpenMessages();
          }}
          className="nav-tap relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]"
          aria-label="Chats"
        >
          <MessageCircle className="h-[18px] w-[18px] text-white/80" />
          {(unreadChats ?? 0) > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E5484D] px-1 text-[9px] font-bold text-white">
              {unreadChats}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            haptic("select");
            setNotifOpen(true);
          }}
          className="nav-tap relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px] text-white/80" />
          {(unreadNotifs ?? 0) > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E5484D] px-1 text-[9px] font-bold text-white">
              {unreadNotifs}
            </span>
          )}
        </button>
      </div>

      {/* Wallet card with crimson glow */}
      <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#17171B] to-[#0C0C0E] p-5">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(229,72,77,0.35), transparent 70%)" }}
        />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
            Wallet balance
          </p>
          <p className="mt-1 text-[28px] font-extrabold tracking-tight">
            {available === null ? "—" : formatMoney(available, currency)}
          </p>
          {inEscrow !== null && inEscrow > 0 && (
            <p className="mt-0.5 text-[11px] font-medium text-white/45">
              {formatMoney(inEscrow, currency)} in escrow
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                haptic("select");
                onSelect("Wallet");
              }}
              className="nav-tap flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#E5484D] py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(229,72,77,0.6)]"
            >
              <ArrowDownToLine className="h-4 w-4" /> Top up
            </button>
            <button
              type="button"
              onClick={() => {
                haptic("select");
                onSelect("Wallet");
              }}
              className="nav-tap flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] py-2.5 text-[13px] font-bold text-white"
            >
              <ArrowUpFromLine className="h-4 w-4" /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Quick actions — everything the bottom dock doesn't already cover */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {[
          { icon: Package, label: "Orders", run: () => navigate({ to: "/escrow" }) },
          { icon: Images, label: "Showcase", run: () => onSelect("Feed") },
          { icon: Plus, label: "Sell", run: onCreate },
          { icon: Store, label: "My shop", run: () => onSelect("Profile") },
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
                <p className="text-[11px] font-bold text-[#E5484D]">
                  {priceOf(p)}
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
                  <p className="mt-1 text-[12px] font-bold text-[#E5484D]">
                    {priceOf(p)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Star,
  ShoppingBag,
  MessageCircle,
  Users,
  Package,
  Megaphone,
  PlayCircle,
  Cake,
  X,
  Send,
  Circle,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineUsers as useSharedOnlineUsers } from "@/hooks/use-presence";
import {
  getDiscoveryFeed,
  type DiscoveryAd,
  type DiscoveryPeer,
  type DiscoveryProduct,
} from "@/lib/discovery.functions";
import {
  getBirthdaysToday,
  getProfilesLite,
  sendBirthdayWish,
  type BirthdayPerson,
  type OnlinePerson,
} from "@/lib/rail.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";
import { AdSlot } from "@/components/oventric/ads/AdSlot";

export function navigateSection(
  section: "Feed" | "Marketplace" | "Messages" | "Wallet",
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } }));
}

/**
 * Format a listing exactly like the marketplace does: convert from the seller's
 * published currency via the locked FX snapshot into the viewer's currency.
 */
function useMoney() {
  const { baseCurrency } = useOnboarding();
  const viewer = (baseCurrency ?? "USD") as Currency;
  return (row: {
    priceUsd: number;
    originalCurrency?: string;
    originalAmount?: number;
    fxSnapshot?: unknown;
  }) =>
    computeDisplayPrice(
      {
        price_usd: row.priceUsd,
        original_currency: row.originalCurrency ?? "USD",
        original_amount: row.originalAmount ?? row.priceUsd,
        fx_snapshot: row.fxSnapshot ?? null,
      },
      viewer,
    ).formatted;
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-4 px-2">
      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-2">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed max-w-[220px]">
        {hint}
      </p>
    </div>
  );
}

function SponsoredCard({ ad }: { ad: DiscoveryAd }) {
  const hasMedia = !!ad.coverUrl && ad.tier !== "text";
  return (
    <a
      href={ad.ctaUrl || "#"}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="relative block bg-white shadow-sm border border-fuchsia-500/30 rounded-2xl overflow-hidden hover:border-fuchsia-400/60 transition-colors"
    >
      {hasMedia && (
        <div className="relative h-28 w-full overflow-hidden bg-slate-100">
          <ResponsiveImage
            src={ad.coverUrl as string}
            alt={ad.advertiser}
            sizes="(min-width: 1024px) 320px, 50vw"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {ad.tier === "video" && (
            <PlayCircle className="absolute inset-0 m-auto w-10 h-10 text-slate-700 drop-shadow" />
          )}
        </div>
      )}
      <div className="p-4 text-center">
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-fuchsia-600 border border-fuchsia-400/40 bg-fuchsia-50 rounded px-1.5 py-0.5">
          <Megaphone className="w-3 h-3" /> Sponsored
        </span>
        <div className="mt-2 text-sm font-bold text-slate-900 leading-snug line-clamp-2">
          {ad.title}
        </div>
        {ad.body && (
          <p className="mt-1 text-[11px] text-slate-600 leading-relaxed line-clamp-2">
            {ad.body}
          </p>
        )}
        <div className="mt-3">
          <span className="inline-flex items-center justify-center px-4 py-1.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-bold text-xs rounded-[10px]">
            {ad.ctaLabel}
          </span>
        </div>
        <div className="mt-2 text-[10px] text-slate-500 truncate">
          by {ad.advertiser}
        </div>
      </div>
    </a>
  );
}

/* ---------------- Birthday widget ---------------- */

function BirthdayCard({ people, onOpen }: { people: BirthdayPerson[]; onOpen: () => void }) {
  const first = people[0];
  const extra = people.length - 1;
  const label =
    people.length === 1
      ? `${first.name} has a birthday today`
      : `${first.name} and ${extra} other${extra === 1 ? "" : "s"} have a birthday today`;
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white shadow-sm border border-slate-200 rounded-2xl p-4 hover:border-pink-400/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Cake className="w-4 h-4 text-pink-400" /> Birthdays
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300">Today</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {people.slice(0, 4).map((p) => (
            <span
              key={p.userId}
              className="w-9 h-9 rounded-full ring-2 ring-white overflow-hidden inline-block"
            >
              <AvatarImage src={p.avatarUrl} alt={p.name} />
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 text-xs text-slate-700 leading-snug">
          {label}
        </div>
      </div>
      <div className="mt-3 text-[11px] font-bold text-pink-300">Send wishes →</div>
    </button>
  );
}

function BirthdayModal({
  people,
  onClose,
  onSendWish,
}: {
  people: BirthdayPerson[];
  onClose: () => void;
  onSendWish: (recipientId: string, name: string, body: string) => Promise<void>;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="modal-light fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-sm border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Cake className="w-4 h-4 text-pink-400" />
            <h4 className="text-sm font-bold text-slate-900">Birthdays today</h4>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-200">
          {people.map((p) => (
            <BirthdayRow
              key={p.userId}
              person={p}
              onSend={(body) => onSendWish(p.userId, p.name, body)}
            />
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

function BirthdayRow({
  person,
  onSend,
}: {
  person: BirthdayPerson;
  onSend: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState(`Happy birthday, ${person.name.split(" ")[0]}! 🎉`);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await onSend(body);
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="p-3">
      <div className="flex items-center gap-3">
        <Link
          to="/profile/$id"
          params={{ id: person.slug }}
          className="w-10 h-10 rounded-full overflow-hidden shrink-0 block"
        >
          <AvatarImage src={person.avatarUrl} alt={person.name} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/profile/$id"
            params={{ id: person.slug }}
            className="block truncate text-sm font-semibold text-slate-900 hover:text-pink-300"
          >
            {person.name}
          </Link>
          <div className="text-[10px] text-slate-500">
            Turning another year today
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={sent}
          placeholder="Write a wish…"
          className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-[10px] px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-pink-400/50"
        />
        <button
          onClick={submit}
          disabled={busy || sent}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-pink-500 hover:bg-pink-400 disabled:bg-slate-100 disabled:text-slate-400 text-black text-xs font-bold"
        >
          {sent ? (
            "Sent"
          ) : busy ? (
            "…"
          ) : (
            <>
              <Send className="w-3 h-3" /> Send
            </>
          )}
        </button>
      </div>
    </li>
  );
}

/* ---------------- Product row ---------------- */

function ProductRow({
  p,
  priceFmt,
}: {
  p: DiscoveryProduct;
  priceFmt: (row: DiscoveryProduct) => string;
}) {
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      aria-label={`Open ${p.title}`}
      className="flex items-center gap-3 min-w-0 text-left rounded-[10px] -mx-1 px-1 py-1 hover:bg-slate-50 transition-colors"
    >
      <div className="w-11 h-11 shrink-0 rounded-[10px] overflow-hidden bg-slate-100 flex items-center justify-center">
        {p.coverUrl ? (
          <ResponsiveImage
            sizes="88px"
            src={p.coverUrl}
            alt={p.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <ShoppingBag className="w-4 h-4 text-slate-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-slate-900">{p.title}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-700">
            {p.category}
          </span>
          <span className="text-[10px] text-slate-500 truncate">
            {p.vendor || "Trending"}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-black text-slate-900">
          {priceFmt(p)}
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Online users presence ---------------- */

/**
 * Shared app-wide presence: anyone active in the last 5 minutes counts as
 * online, so a brief disconnect doesn't flip people to offline instantly.
 */
function useOnlineUserIds(myId: string | null) {
  const online = useSharedOnlineUsers();
  return useMemo(() => [...online].filter((id) => id !== myId), [online, myId]);
}

/* ---------------- Panel ---------------- */

export function DiscoveryPanel({ asPage = false }: { asPage?: boolean } = {}) {
  const price = useMoney();
  const { require } = useOnboarding();
  const { session } = useAuthGate();
  const myId = session?.user?.id ?? null;

  const queryClient = useQueryClient();
  const fetchFeed = useServerFn(getDiscoveryFeed);
  const fetchBirthdays = useServerFn(getBirthdaysToday);
  const fetchProfilesLite = useServerFn(getProfilesLite);
  const sendWish = useServerFn(sendBirthdayWish);

  const { data, isLoading } = useQuery({
    queryKey: ["discovery-feed"],
    queryFn: () => fetchFeed(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const onFocus = () => queryClient.invalidateQueries({ queryKey: ["discovery-feed"] });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient]);

  const { data: birthdays = [] } = useQuery({
    queryKey: ["birthdays-today", myId],
    queryFn: () => fetchBirthdays(),
    enabled: !!myId,
    staleTime: 60 * 60 * 1000,
  });

  const ads = data?.ads ?? [];
  const primaryAd = ads[0];
  const secondaryAd = ads[1];

  const topPeers5 = (data?.topPeersAny ?? []).slice(0, 5);
  const productsAll = data?.products ?? [];

  // Shuffle trending marketplace items every 20s.
  const [shuffleKey, setShuffleKey] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setShuffleKey((k) => k + 1), 20000);
    return () => window.clearInterval(id);
  }, []);
  const trending = useMemo(() => {
    const arr = [...productsAll];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsAll, shuffleKey]);

  // Online users
  const onlineIds = useOnlineUserIds(myId);
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ["online-users-lite", onlineIds.join(",")],
    queryFn: () => fetchProfilesLite({ data: { userIds: onlineIds } }),
    enabled: onlineIds.length > 0,
    staleTime: 30_000,
  }) as { data: OnlinePerson[] };

  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [chatPeerId, setChatPeerId] = useState<string | null>(null);

  const openChat = (peerId: string, name: string) => {
    require(1, () => {
      setChatPeerId(peerId);
      toast(`Opening chat with ${name}…`);
    }, "buyer");
  };

  const handleWish = useCallback(
    async (recipientId: string, name: string, body: string) => {
      try {
        await sendWish({ data: { recipientId, body } });
        toast.success(`Birthday wish sent to ${name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to send");
        throw e;
      }
    },
    [sendWish],
  );

  return (
    <aside
      className={
        asPage
          ? "flex w-full min-w-0 flex-col gap-4 pb-6 [&>section]:transition-shadow md:[&>section]:hover:shadow-md"
          : "hidden lg:flex lg:basis-[38%] lg:shrink-0 lg:grow-0 min-w-0 flex-col gap-4 self-start sticky top-20 max-h-[calc(100vh-100px)] overflow-y-auto pr-2 scrollbar-none pb-6 [scrollbar-gutter:stable] [&>section]:transition-shadow md:[&>section]:hover:shadow-md"
      }
    >
      {/* 1. Primary sponsored slot — blank when there is no active campaign */}
      <AdSlot placement="feed" variant="rail" index={0} />

      {/* 2. Birthdays (only when there are matches among people you follow) */}
      {myId && birthdays.length > 0 && (
        <BirthdayCard people={birthdays} onOpen={() => setBirthdayModalOpen(true)} />
      )}

      {/* 3. Top Peers in Your Circle — top 5 across any star tier */}
      <section
        className="bg-white shadow-sm border border-slate-200 rounded-2xl p-4"
        aria-busy={isLoading}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <h3 className="min-w-0 truncate text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <span className="shrink-0">👑</span>{" "}
            <span className="truncate">Top Peers in Your Circle</span>
          </h3>
          <button
            onClick={() => navigateSection("Feed")}
            className="shrink-0 rounded-[10px] px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            See all
          </button>
        </div>

        {isLoading && topPeers5.length === 0 ? (
          <ul className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-2.5 py-1.5">
                <div className="w-9 h-9 shrink-0 rounded-full bg-slate-200 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonBar className="h-3 w-3/5" />
                  <SkeletonBar className="h-2 w-1/4" />
                </div>
                <SkeletonBar className="h-6 w-16 rounded-[10px]" />
              </li>
            ))}
          </ul>
        ) : topPeers5.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No rated peers yet"
            hint="Peers appear here as they earn their first star."
          />
        ) : (
          <ul className="space-y-1">
            {topPeers5.map((p: DiscoveryPeer) => (
              <li
                key={p.id}
                className="flex items-center gap-2.5 min-w-0 -mx-1.5 px-1.5 py-1.5 rounded-[10px] transition-colors hover:bg-slate-50"
              >
                <Link
                  to="/profile/$id"
                  params={{ id: p.slug }}
                  className="w-9 h-9 shrink-0 rounded-full overflow-hidden block"
                  aria-label={`View ${p.name}`}
                >
                  <AvatarImage src={p.avatarUrl} alt={p.name} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/profile/$id"
                    params={{ id: p.slug }}
                    className="block truncate text-xs font-semibold text-slate-900 hover:text-emerald-600"
                  >
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span>{p.stars.toFixed(1)}</span>
                  </div>
                </div>
                <button
                  onClick={() => openChat(p.id, p.name)}
                  aria-label={`Chat with ${p.name}`}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-[10px] border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold"
                >
                  <MessageCircle className="w-3 h-3" /> Chat
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Secondary sponsored slot — blank when there is no active campaign */}
      <AdSlot placement="feed" variant="rail" index={1} />

      {/* 5. Trending Marketplace items */}
      <section
        className="bg-white shadow-sm border border-slate-200 rounded-2xl p-4"
        aria-busy={isLoading}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <h3 className="min-w-0 truncate text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <span className="shrink-0">🛍️</span>{" "}
            <span className="truncate">Trending Marketplace items</span>
          </h3>
          <button
            onClick={() => navigateSection("Marketplace")}
            className="shrink-0 rounded-[10px] px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            Browse
          </button>
        </div>
        {isLoading ? (
          <ul className="space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-1.5">
                <div className="w-11 h-11 shrink-0 rounded-[10px] bg-slate-200 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonBar className="h-3 w-3/4" />
                  <SkeletonBar className="h-2 w-1/3" />
                </div>
                <SkeletonBar className="h-4 w-10" />
              </li>
            ))}
          </ul>
        ) : trending.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Marketplace is quiet"
            hint="No trending items right now. Be the first to publish."
          />
        ) : (
          <ul className="space-y-1">
            {trending.map((p) => (
              <li
                key={p.id}
                className="-mx-1.5 px-1.5 py-1.5 rounded-[10px] transition-colors hover:bg-slate-50"
              >
                <ProductRow p={p} priceFmt={price} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 6. Online users — click to open a quick chat popover */}
      <section className="bg-white shadow-sm border border-slate-200 rounded-2xl p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
          <h3 className="min-w-0 truncate text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Circle className="w-2.5 h-2.5 shrink-0 fill-emerald-500 text-emerald-500" />{" "}
            <span className="truncate">Online now</span>
          </h3>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            {onlineUsers.length} online
          </span>
        </div>
        {!myId ? (
          <EmptyState
            icon={Users}
            title="Sign in to see who's online"
            hint="Members you can chat with show up here in real time."
          />
        ) : onlineUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nobody else online"
            hint="When members come online, they'll appear here for a quick chat."
          />
        ) : (
          <ul className="space-y-1">
            {onlineUsers.slice(0, 10).map((u) => (
              <li
                key={u.userId}
                className="flex items-center gap-2.5 min-w-0 -mx-1.5 px-1.5 py-1.5 rounded-[10px] transition-colors hover:bg-slate-50"
              >
                <button
                  onClick={() => openChat(u.userId, u.name)}
                  className="relative w-9 h-9 shrink-0 rounded-full overflow-hidden block"
                  aria-label={`Chat with ${u.name}`}
                >
                  <AvatarImage src={u.avatarUrl} alt={u.name} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white" />
                </button>
                <button
                  onClick={() => openChat(u.userId, u.name)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-xs font-semibold text-slate-900 hover:text-emerald-600">
                    {u.name}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span>{u.stars.toFixed(1)}</span>
                  </div>
                </button>
                <button
                  onClick={() => openChat(u.userId, u.name)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-[10px] border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold"
                >
                  <MessageCircle className="w-3 h-3" /> Chat
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {birthdayModalOpen && (
        <BirthdayModal
          people={birthdays}
          onClose={() => setBirthdayModalOpen(false)}
          onSendWish={handleWish}
        />
      )}

      <MessagesDrawer
        open={!!chatPeerId}
        onClose={() => setChatPeerId(null)}
        initialThreadId={chatPeerId ?? undefined}
      />
    </aside>
  );
}

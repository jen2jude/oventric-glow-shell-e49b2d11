import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Flame, PenSquare, Store, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { formatMoney } from "@/lib/fx-display";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { getProfileSocialCounts } from "@/lib/profiles.functions";
import { getWalletBalances } from "@/lib/wallet.functions";
import { getTopSellers } from "@/lib/marketplace.functions";
import { listCreatorFeed } from "@/lib/creators.functions";
import { AvatarImage } from "@/components/oventric/AvatarImage";

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-slate-200 bg-white p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-slate-500">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-[#E5484D]" /> : null}
          <span className="truncate">{title}</span>
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Signed-in snapshot: who you are, what you have, and where you go next. */
function MeCard({ onCreatePost }: { onCreatePost?: () => void }) {
  const { baseCurrency } = useOnboarding();
  const currency = (baseCurrency ?? "USD") as Currency;
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setUid(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUid(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = useServerFn(getMyFullProfile);
  const fetchCounts = useServerFn(getProfileSocialCounts);
  const fetchWallet = useServerFn(getWalletBalances);

  const profileQ = useQuery({
    queryKey: ["feed-sidebar-me", uid],
    queryFn: () => fetchProfile(),
    enabled: !!uid,
    staleTime: 60_000,
  });
  const profile = profileQ.data?.profile ?? null;

  const countsQ = useQuery({
    queryKey: ["feed-sidebar-counts", uid],
    queryFn: () => fetchCounts({ data: { idOrSlug: uid! } }),
    enabled: !!uid,
    staleTime: 60_000,
  });

  const walletQ = useQuery({
    queryKey: ["feed-sidebar-wallet", uid],
    queryFn: () => fetchWallet(),
    enabled: !!uid,
    staleTime: 60_000,
  });

  if (!uid || !profile) return null;

  const balance = walletQ.data?.balances?.[currency] ?? 0;

  return (
    <section className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
      <div className="h-14 bg-gradient-to-r from-[#E5484D] to-[#f08a4b]" />
      <div className="-mt-7 px-4 pb-4">
        <Link to="/profile/$id" params={{ id: profile.slug }}>
          <AvatarImage
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="h-14 w-14 rounded-full border-4 border-white object-cover"
          />
        </Link>
        <div className="mt-2 min-w-0">
          <Link
            to="/profile/$id"
            params={{ id: profile.slug }}
            className="block truncate font-wallet-display text-[16px] font-bold text-slate-900 hover:underline"
          >
            {profile.displayName}
          </Link>
          {profile.username ? (
            <p className="truncate text-[12px] text-slate-500">@{profile.username}</p>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1 rounded-[10px] bg-slate-50 py-2 text-center">
          <div>
            <p className="text-[14px] font-bold text-slate-900">{countsQ.data?.followers ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Followers</p>
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-900">{countsQ.data?.following ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Following</p>
          </div>
          <div>
            <p className="truncate text-[14px] font-bold text-slate-900">
              {formatMoney(balance, currency)}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Wallet</p>
          </div>
        </div>

        {onCreatePost ? (
          <button
            type="button"
            onClick={onCreatePost}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] py-2 text-[13px] font-semibold text-white hover:brightness-95"
          >
            <PenSquare className="h-4 w-4" /> Create post
          </button>
        ) : null}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link
            to="/dashboard"
            className="flex items-center justify-center gap-1.5 rounded-[10px] border border-slate-200 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Store className="h-3.5 w-3.5" /> My shop
          </Link>
          <Link
            to="/wallet"
            className="flex items-center justify-center gap-1.5 rounded-[10px] border border-slate-200 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <WalletIcon className="h-3.5 w-3.5" /> Wallet
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Live leaderboard slice — same sales-first ranking as the home rail. */
function TrendingToday() {
  const fetchSellers = useServerFn(getTopSellers);
  const q = useQuery({
    queryKey: ["feed-sidebar-top-sellers"],
    queryFn: () => fetchSellers(),
    staleTime: 5 * 60_000,
  });
  const sellers = (q.data ?? []).slice(0, 4);
  if (typeof window !== "undefined") console.log("[dbg topsellers]", q.status, q.data?.length, (q.error as Error | null)?.message);
  if (q.isLoading) {
    return (
      <Card title="Trending today" icon={Flame}>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </Card>
    );
  }
  if (sellers.length === 0) return null;
  return (
    <Card
      title="Trending today"
      icon={Flame}
      action={
        <Link to="/sellers" className="text-[12px] font-semibold text-[#E5484D] hover:underline">
          See all
        </Link>
      }
    >
      <ul className="space-y-2.5">
        {sellers.map((s, i) => (
          <li key={s.id}>
            <Link
              to="/profile/$id"
              params={{ id: s.slug }}
              className="flex items-center gap-2.5 rounded-[10px] p-1 hover:bg-slate-50"
            >
              <span className="w-4 shrink-0 text-center text-[12px] font-bold text-slate-400">
                {i + 1}
              </span>
              <AvatarImage
                src={s.avatarUrl}
                alt={s.name}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate text-[13px] font-semibold text-slate-900">{s.name}</span>
                  {s.verified ? (
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#E5484D]" />
                  ) : null}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {s.salesCount} sold · {s.productsCount} items
                </span>
              </span>
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Creators who have actually published showcase work, most recent first. */
function SuggestedCreators() {
  const fetchFeed = useServerFn(listCreatorFeed);
  const q = useQuery({
    queryKey: ["feed-sidebar-creators"],
    queryFn: () => fetchFeed(),
    staleTime: 5 * 60_000,
  });

  const seen = new Set<string>();
  const creators = (q.data ?? [])
    .map((p) => p.author)
    .filter((a) => {
      if (!a?.userId || !a.slug || !a.name?.trim() || seen.has(a.userId)) return false;
      seen.add(a.userId);
      return true;
    })
    .slice(0, 4);

  if (creators.length === 0) return null;

  return (
    <Card title="Fresh creators" icon={PenSquare}>
      <ul className="space-y-2.5">
        {creators.map((c) => (
          <li key={c.userId}>
            <Link
              to="/profile/$id"
              params={{ id: c.slug! }}
              className="flex items-center gap-2.5 rounded-[10px] p-1 hover:bg-slate-50"
            >
              <AvatarImage
                src={c.avatarUrl}
                alt={c.name}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">
                {c.name}
              </span>
              <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                View
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Desktop-only feed sidebar stack: you, what's hot, who to follow. */
export function FeedSidebarModules({ onCreatePost }: { onCreatePost?: () => void }) {
  return (
    <div className="space-y-4">
      <MeCard onCreatePost={onCreatePost} />
      <TrendingToday />
      <SuggestedCreators />
    </div>
  );
}

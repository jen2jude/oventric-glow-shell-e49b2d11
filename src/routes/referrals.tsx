import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Copy, Gift, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { getMyReferralOverview } from "@/lib/referrals.functions";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Invite friends — Referral rewards | Oventric" },
      {
        name: "description",
        content:
          "Share your Oventric invite link. When someone you invite makes their first purchase, you earn Oventric credit you can spend on the marketplace.",
      },
      { property: "og:title", content: "Invite friends — Referral rewards | Oventric" },
      {
        property: "og:description",
        content:
          "Share your Oventric invite link and earn Oventric credit when someone you invite makes their first purchase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/referrals" }],
  }),
  component: ReferralsRoute,
});

function ReferralsRoute() {
  const load = useServerFn(getMyReferralOverview);
  // Public route: only ask the server for the invite link once a session exists,
  // otherwise the authenticated server fn rejects the call with no bearer token.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["referral-overview"],
    queryFn: () => load(),
    enabled: signedIn === true,
  });
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://oventric.com");

  useEffect(() => {
    setOrigin(window.location.origin);
    let alive = true;
    supabase.auth.getSession().then(({ data: s }) => {
      if (alive) setSignedIn(Boolean(s.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const link = data?.code ? `${origin}/?ref=${data.code}` : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Invite friends</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Share your invite link. When someone who joins through it makes their first purchase, you
          earn Oventric credit you can spend on the marketplace.
        </p>

        {isLoading && (
          <div className="mt-8 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your invite link…
          </div>
        )}

        {isError && (
          <p className="mt-8 text-sm text-slate-400">
            Sign in to see your invite link and rewards.
          </p>
        )}

        {data && (
          <>
            <div className="mt-6 rounded-[10px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Your invite link
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  className="min-w-0 flex-1 rounded-[10px] border border-white/10 bg-[#121214] px-3 py-2.5 text-xs text-slate-200 outline-none"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[#E5484D] px-4 py-2.5 text-xs font-bold text-white"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Code: <span className="font-semibold text-slate-300">{data.code}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="Invited" value={String(data.totalInvited)} />
              <Stat label="Qualified" value={String(data.qualified)} />
              <Stat label="Credit earned" value={`$${data.earnedUSD.toFixed(2)}`} />
            </div>

            <div className="mt-4 rounded-[10px] border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-400">
              <div className="mb-1 flex items-center gap-2 font-semibold text-slate-200">
                <Gift className="h-4 w-4 text-[#E5484D]" /> How the reward works
              </div>
              {data.active ? (
                <p>
                  You earn ${data.rewardUSD.toFixed(2)} in Oventric credit once someone you invited
                  completes their first purchase
                  {data.minPurchaseUSD > 0
                    ? ` of at least $${data.minPurchaseUSD.toFixed(2)}`
                    : ""}
                  . Signing up alone does not earn a reward. Referral credit is spendable on
                  Oventric, not withdrawable to a bank.
                </p>
              ) : (
                <p>Referral rewards are paused right now, but your invite link still works.</p>
              )}
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Users className="h-3.5 w-3.5" /> People you invited
              </div>
              {data.referrals.length === 0 ? (
                <p className="rounded-[10px] border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                  No one has joined with your link yet.
                </p>
              ) : (
                <ul className="divide-y divide-white/5 overflow-hidden rounded-[10px] border border-white/10">
                  {data.referrals.map((r, i) => (
                    <li
                      key={`${r.name}-${i}`}
                      className="flex items-center justify-between gap-3 bg-white/[0.02] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">
                          {r.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Joined {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {r.status === "qualified" ? (
                        <span className="shrink-0 rounded-[10px] bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                          +${r.rewardUSD.toFixed(2)}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-[10px] bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                          No purchase yet
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

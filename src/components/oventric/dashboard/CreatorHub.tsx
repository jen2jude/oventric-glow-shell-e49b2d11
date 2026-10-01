import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Eye, Heart, MessageCircle, Bookmark, Share2, Clock, Globe2, Sparkles, ShoppingBag, Film, TrendingUp, Loader2, ChevronRight } from "lucide-react";
import { getCreatorHub } from "@/lib/dashboard/creator.functions";
import { computeDisplayPrice, formatMoney } from "@/lib/fx-display";
import { visibleMoney } from "@/lib/money-visibility";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { CreatorCoachDrawer } from "@/components/oventric/app/CreatorCoach";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const n = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v));
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

export function CreatorHub() {
  const fetchHub = useServerFn(getCreatorHub);
  const isAppShell = useIsAppShell();
  const [coachOpen, setCoachOpen] = useState(false);
  const { baseCurrency, balancesHidden } = useOnboarding();
  const currency = (baseCurrency ?? "USD") as Currency;
  const { data, isLoading, error } = useQuery({
    queryKey: ["creator-hub"],
    queryFn: () => fetchHub({ data: { tzOffset: new Date().getTimezoneOffset() } }),
  });

  if (isLoading) return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <p className="py-10 text-center text-sm text-muted-foreground">Couldn't load your Creator's Dashboard. Please try again.</p>;

  const money = (usd: number) => visibleMoney(computeDisplayPrice({ original_currency: "USD", original_amount: usd }, currency).value, currency, balancesHidden);
  const usd = (v: number) => currency === "USD" ? null : balancesHidden ? "••••" : `≈ ${formatMoney(v, "USD")}`;
  const maxGrowth = Math.max(1, ...data.followerGrowth.map((g) => g.count));
  const maxHour = Math.max(1, ...data.bestHours.map((h) => h.count));
  const maxDay = Math.max(1, ...data.bestDays.map((d) => d.count));
  const topHour = [...data.bestHours].sort((a, b) => b.count - a.count)[0];
  const topDay = [...data.bestDays].sort((a, b) => b.count - a.count)[0];
  const hasTiming = data.bestHours.some((h) => h.count > 0);

  return (
    <div className="space-y-5 pb-24">
      {isAppShell && (
        <button
          type="button"
          onClick={() => setCoachOpen(true)}
          className="flex w-full items-center gap-3 rounded-[14px] border border-violet-500/30 bg-gradient-to-r from-violet-500/15 to-[#E5484D]/15 p-4 text-left active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-[#E5484D]">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Creator Coach</span>
            <span className="block truncate text-[11px] text-muted-foreground">Your AI coach — it knows these numbers. Ask what to post, when, and how to grow.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}
      {isAppShell && <CreatorCoachDrawer open={coachOpen} onClose={() => setCoachOpen(false)} />}
      <div className="rounded-[14px] bg-gradient-to-br from-violet-500 to-[#E5484D] p-4 text-white">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90"><Sparkles className="h-4 w-4" /> Creator's Dashboard</div>
        <div className="mt-2 flex items-end gap-6">
          <div><div className="text-3xl font-bold">{n(data.followers)}</div><div className="text-xs opacity-85">Followers</div></div>
          <div><div className="text-xl font-bold">+{n(data.newFollowers7d)}</div><div className="text-xs opacity-85">This week</div></div>
          <div><div className="text-xl font-bold">{data.engagementRate}%</div><div className="text-xs opacity-85">Engagement</div></div>
        </div>
      </div>

      <Card title="Follower growth" hint="New followers per week, last 8 weeks" icon={TrendingUp}>
        <div className="flex h-28 items-end gap-2">
          {data.followerGrowth.map((g) => (
            <div key={g.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{g.count || ""}</span>
              <div className="w-full rounded-t-[6px] bg-gradient-to-t from-violet-500 to-[#E5484D]" style={{ height: `${Math.max(4, (g.count / maxGrowth) * 80)}px` }} />
              <span className="text-[9px] text-muted-foreground">{g.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Mini icon={Eye} label="Views" value={n(data.totals.views)} />
        <Mini icon={Heart} label="Likes" value={n(data.totals.likes)} />
        <Mini icon={MessageCircle} label="Comments" value={n(data.totals.comments)} />
        <Mini icon={Bookmark} label="Saves" value={n(data.totals.saves)} />
        <Mini icon={Share2} label="Shares" value={n(data.totals.shares)} />
        <Mini icon={Film} label="Posts" value={n(data.totals.posts)} />
        <Mini icon={Globe2} label="Beyond followers" value={`${data.reach.nonFollowerShare}%`} />
        <Mini icon={Globe2} label="Profile visits" value={n(data.reach.profileVisits)} />
        <Mini icon={Globe2} label="Visits from posts" value={n(data.reach.profileVisitsFromPosts)} />
        <Mini icon={Users} label="Showcase viewers" value={n(data.reach.uniqueShowcaseViewers)} />
      </div>

      <Card title="Best posts" hint="Ranked by views and interactions" icon={Film}>
        {data.posts.length === 0 ? <Empty text="Post something to start seeing performance." /> : (
          <ul className="divide-y divide-border">
            {data.posts.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-sm font-bold text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span className="font-semibold uppercase">{p.kind === "showcase" ? "Showcase" : "Post"}</span>
                    <span>{n(p.views)} views</span>
                    {p.kind === "post" && <><span>{p.likes} likes</span><span>{p.comments} comments</span><span>{p.saves} saves</span><span>{p.shares} shares</span></>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Best time to post" hint="When your audience reacts most (your local time)" icon={Clock}>
        {!hasTiming ? <Empty text="Not enough reactions yet to spot a pattern." /> : (
          <>
            <p className="mb-3 text-sm">Your audience is most active on <b>{DAYS[topDay.day]}s</b> around <b>{hourLabel(topHour.hour)}</b>.</p>
            <div className="flex h-16 items-end gap-[2px]">
              {data.bestHours.map((h) => (
                <div key={h.hour} title={`${hourLabel(h.hour)}: ${h.count}`} className="flex-1 rounded-t-[3px] bg-violet-500/80" style={{ height: `${Math.max(3, (h.count / maxHour) * 60)}px` }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-muted-foreground"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {data.bestDays.map((d) => (
                <div key={d.day} className="text-center">
                  <div className="mx-auto h-8 w-full rounded-[6px] bg-[#E5484D]" style={{ opacity: 0.15 + (d.count / maxDay) * 0.85 }} />
                  <div className="mt-1 text-[10px] text-muted-foreground">{DAYS[d.day]}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card title="Top fans" hint="People who interact with you most" icon={Heart}>
          {data.topFans.length === 0 ? <Empty text="No fans yet — keep posting." /> : (
            <ul className="space-y-2">
              {data.topFans.map((f) => (
                <li key={f.userId} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-[#E5484D] text-xs font-bold text-white">{f.name.slice(0, 1).toUpperCase()}</span>
                  <span className="flex-1 truncate text-sm">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{f.interactions} interaction{f.interactions === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Where your followers are" icon={Globe2}>
          {data.followerCountries.length === 0 ? <Empty text="No followers yet." /> : (
            <ul className="space-y-2">
              {data.followerCountries.map((c) => (
                <li key={c.country} className="text-sm">
                  <div className="flex justify-between"><span>{c.country}</span><span className="text-muted-foreground">{c.count}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${(c.count / Math.max(1, data.followers)) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Creators tab (showcase)" hint="Your showcase items in the newsfeed Creators tab" icon={Sparkles}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Showcase items" value={n(data.showcase.items)} />
          <Stat label="Showcase views" value={n(data.showcase.views)} />
          <Stat label="Unique viewers" value={n(data.showcase.uniqueViewers)} />
          <Stat label="Sales from showcase" value={String(data.showcase.linkedSales)} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Free downloads" value={n(data.showcase.freeDownloads)} />
          <Stat label="Paid downloads" value={n(data.showcase.paidDownloads)} />
          <Stat label="Video plays (tapped)" value={n(data.showcase.plays)} />
          <Stat label="Total watch time" value={dur(data.showcase.watchSeconds)} />
          <Stat label="Avg. watch per play" value={dur(data.showcase.avgWatchSeconds)} />
          <Stat label="Link clicks" value={n(data.showcase.linkClicks)} />
          <Stat label="Full-video clicks" value={n(data.showcase.fullVideoClicks)} />
          <Stat label="Likes" value={n(data.showcase.likes)} />
          <Stat label="Comments" value={n(data.showcase.comments)} />
          <Stat label="Showcase engagement" value={`${data.showcase.engagementRate}%`} />
        </div>
        <div className="mt-3 text-sm">Revenue from showcase: <b>{money(data.showcase.linkedRevenueUSD)}</b> <span className="text-xs text-muted-foreground">{usd(data.showcase.linkedRevenueUSD)}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">Watch time only counts when someone taps to play — silent autoplay in the feed is ignored.</p>
        {data.showcase.topLinks.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Most-clicked links</div>
            <ul className="divide-y divide-border">
              {data.showcase.topLinks.map((l) => (
                <li key={l.target} className="flex justify-between gap-3 py-2 text-sm"><span className="truncate">{l.target.replace(/^https?:\/\//, "")}</span><span className="shrink-0 text-muted-foreground">{l.clicks}</span></li>
              ))}
            </ul>
          </div>
        )}
        {data.showcase.perItem.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Per showcase</div>
            <ul className="divide-y divide-border">
              {data.showcase.perItem.map((it) => (
                <li key={it.id} className="py-2 text-sm">
                  <div className="truncate font-medium">{it.title}</div>
                  <div className="text-xs text-muted-foreground">{n(it.views)} views · {n(it.plays)} plays · {dur(it.watchSeconds)} watched · {it.freeDownloads} free / {it.paidDownloads} paid downloads · {it.clicks} clicks · {it.likes} likes · {it.comments} comments</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Sales from your showcase" hint="Orders for products linked to your Creators tab posts, after you posted" icon={ShoppingBag}>
        <div className="flex items-end gap-6">
          <div><div className="text-2xl font-bold">{money(data.postSales.revenueUSD)}</div><div className="text-xs text-muted-foreground">{usd(data.postSales.revenueUSD) ?? "Revenue"}</div></div>
          <div><div className="text-2xl font-bold">{data.postSales.sales}</div><div className="text-xs text-muted-foreground">Sales</div></div>
        </div>
        {data.postSales.topProducts.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {data.postSales.topProducts.map((p) => (
              <li key={p.name} className="flex justify-between py-2 text-sm"><span className="truncate">{p.name}</span><span className="text-right text-muted-foreground">{p.sales} · {money(p.revenueUSD)}{usd(p.revenueUSD) && <small className="block">{usd(p.revenueUSD)}</small>}</span></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({ title, hint, icon: Icon, children }: { title: string; hint?: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-violet-500" /><h3 className="text-sm font-semibold">{title}</h3></div>
      {hint && <p className="-mt-2 mb-3 text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}
function Mini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3">
      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span><Icon className="h-3.5 w-3.5 text-violet-500" /></div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[8px] bg-muted/50 p-2.5"><div className="text-lg font-bold">{value}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>;
}
function Empty({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{text}</p>;
}

function dur(sec: number) {
  if (!sec) return "0s";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

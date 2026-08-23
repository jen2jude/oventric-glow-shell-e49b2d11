import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, Sparkles, Trophy, GraduationCap, Users, ShoppingBag, PlayCircle, Search, Star } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { navigateSection } from "@/components/oventric/DiscoveryPanel";
import { useFeedDiscovery } from "@/components/oventric/feed/useFeedDiscovery";
import { useStoryRail } from "@/components/oventric/feed/useStories";
import { StoryViewerModal } from "@/components/oventric/feed/StoryViewerModal";
import type { FeedPost } from "@/lib/posts.functions";
import { ExploreHeader, type ExploreTab } from "./ExploreHeader";
import { PeopleExploreList } from "./PeopleExploreList";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";


function fmtUsd(usd: number, viewer: Currency): string {
  return computeDisplayPrice(
    { price_usd: usd, original_currency: "USD", original_amount: usd, fx_snapshot: null },
    viewer,
  ).formatted;
}



function Section({
  icon: Icon,
  title,
  action,
  onAction,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 px-0.5">
        <Icon className="h-[18px] w-[18px] text-[#E5484D]" strokeWidth={2} />
        <h3 className="text-[15px] font-bold text-white">{title}</h3>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="ml-auto text-[12px] font-semibold text-[#E5484D] active:opacity-70"
          >
            {action} →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth">

      {children}
    </div>
  );
}

/**
 * "Discover" tab — a sectioned explore surface (trending posts, creators to
 * follow, hot bounties, popular courses, shop picks) instead of a plain feed.
 */
export function FeedDiscoverExplore({
  posts,
  renderPost,
}: {
  posts: FeedPost[];
  renderPost: (p: FeedPost) => React.ReactNode;
}) {
  const { peers, products, bounties, courses, circles, loading } = useFeedDiscovery(true);
  const { baseCurrency } = useOnboarding();
  const { groups: storyGroups, refresh: refreshStories } = useStoryRail(true);
  const [reelAt, setReelAt] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ExploreTab | "Discovery">("Discovery");
  const [searchQuery, setSearchQuery] = useState("");

  const trending = [...posts]
    .sort(
      (a, b) =>
        b.likes_count + b.comments_count * 2 - (a.likes_count + a.comments_count * 2),
    )
    .slice(0, 6);

  if (activeTab !== "Discovery") {
    return (
      <div className="-mx-4 flex flex-col min-h-screen bg-[#0A0A0B] overflow-y-auto">
        <ExploreHeader activeTab={activeTab} onTabChange={setActiveTab} />
        
        {/* Sub-Search in Explore */}
        <div className="px-4 py-3 bg-[#0A0A0B]">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#E5484D] transition-colors" />
            <input 
              type="text"
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 text-sm rounded-xl bg-[#141416] border border-white/[0.06] text-white placeholder:text-white/30 focus:outline-none focus:border-[#E5484D]/50 transition-all"
            />
          </div>
        </div>

        <div className="flex-1">
          {activeTab === "People" && (
            <PeopleExploreList users={peers.filter(p => 
              !searchQuery || 
              p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              p.slug.toLowerCase().includes(searchQuery.toLowerCase())
            )} />
          )}
          {activeTab === "Posts" && (
            <div className="space-y-4 p-4">
               {trending.filter(p => 
                 !searchQuery || 
                 p.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                 p.author_name.toLowerCase().includes(searchQuery.toLowerCase())
               ).map((p) => renderPost(p))}
            </div>
          )}
          {activeTab === "Products" && (
            <div className="grid grid-cols-2 gap-3 p-4">
              {products.filter(p => 
                !searchQuery || 
                p.title.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((p) => (
                <Link
                  key={p.id}
                  to="/product/$id"
                  params={{ id: p.id }}
                  className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#141416] active:scale-[0.98]"
                >
                  {p.coverUrl ? (
                    <img loading="lazy" decoding="async" src={p.coverUrl} alt="" className="h-28 w-full object-cover" />
                  ) : (
                    <div className={`h-28 w-full bg-gradient-to-br ${p.hue}`} />
                  )}
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-[12.5px] font-medium text-white">{p.title}</p>
                    <p className="mt-1 text-[12.5px] font-bold text-[#E5484D]">
                      {fmtUsd(p.priceUsd, baseCurrency)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {(activeTab as any) === "Topics" && (
            <div className="grid grid-cols-1 gap-3 p-4">
              {circles.filter(c => 
                !searchQuery || 
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigateSection("Circles")}
                  className="flex items-center gap-3 w-full rounded-2xl border border-white/[0.06] bg-[#141416] p-4 text-left active:scale-[0.98]"
                >
                  <span className="text-3xl">{c.emoji}</span>
                  <div>
                    <p className="text-[15px] font-bold text-white">{c.name}</p>
                    <p className="text-[12px] text-white/40">{c.memberCount} members</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {storyGroups.length > 0 && (

        <Section icon={PlayCircle} title="Reels">
          <Rail>
            {storyGroups.map((g, i) => (
              <button
                key={g.userId}
                type="button"
                onClick={() => setReelAt(i)}
                className="relative h-[210px] w-[132px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.06] bg-[#141416] text-left active:scale-[0.98]"
              >
                {g.items[0]?.mediaType === "video" ? (
                  g.items[0]?.posterUrl ? (
                    <img loading="lazy"
                      src={g.items[0].posterUrl}
                      alt=""
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={g.items[0].mediaUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  )
                ) : (
                  <img loading="lazy"
                    src={g.items[0]?.mediaUrl}
                    alt=""
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                )}

                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5">
                  <span className="flex items-center gap-1.5">
                    <span className="h-6 w-6 overflow-hidden rounded-full ring-1 ring-[#E5484D]">
                      <AvatarImage src={g.avatarUrl} alt={g.displayName} />
                    </span>
                    <span className="truncate text-[11.5px] font-semibold text-white">
                      {g.displayName.split(" ")[0]}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </Rail>
        </Section>
      )}

      {reelAt !== null && (
        <StoryViewerModal
          groups={storyGroups}
          startIndex={reelAt}
          onClose={() => {
            setReelAt(null);
            void refreshStories();
          }}
        />
      )}

      {peers.length > 0 && (

        <Section icon={Sparkles} title="Top Creators">
          <Rail>
            {peers.slice(0, 12).map((p) => (
              <Link
                key={p.id}
                to="/profile/$id"
                params={{ id: p.slug }}
                className="flex flex-col items-center gap-2 shrink-0 group snap-start"
              >
                <div className="relative">
                  <div className="w-[72px] h-[72px] rounded-full p-[2px] bg-gradient-to-tr from-[#E5484D] to-purple-600 transition-transform duration-300 group-active:scale-90 shadow-[0_0_15px_rgba(229,72,77,0.15)]">
                    <div className="w-full h-full rounded-full border-[3px] border-[#0A0A0B] overflow-hidden bg-[#1A1A1F]">
                      <AvatarImage src={p.avatarUrl} alt={p.name} initials={p.initials} />
                    </div>
                  </div>
                  {p.stars >= 4.5 && (
                    <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-blue-500 border-2 border-[#0A0A0B] flex items-center justify-center shadow-lg">
                      <Star className="w-2.5 h-2.5 fill-white text-white" />
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-bold text-white/70 truncate w-[72px] text-center group-hover:text-white transition-colors">
                  {p.name.split(" ")[0]}
                </span>

              </Link>
            ))}
          </Rail>
        </Section>
      )}

      {trending.length > 0 && (
        <Section icon={Flame} title="Trending posts">
          <div className="space-y-3">{trending.map((p) => renderPost(p))}</div>
        </Section>
      )}

      {bounties.length > 0 && (
        <Section
          icon={Trophy}
          title="Hot bounties"
          action="All bounties"
          onAction={() => navigateSection("Bounties")}
        >
          <Rail>
            {bounties.slice(0, 10).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => navigateSection("Bounties")}
                className="w-[200px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#141416] text-left active:scale-[0.98]"
              >
                {b.coverUrl ? (
                  <img loading="lazy" decoding="async" src={b.coverUrl} alt="" className="h-24 w-full object-cover" />
                ) : (
                  <div className="h-24 w-full bg-gradient-to-br from-[#E5484D]/30 to-[#7C6CF6]/25" />
                )}

                <div className="p-3">
                  <p className="line-clamp-2 text-[13px] font-semibold text-white">{b.title}</p>
                  <p className="mt-1 text-[12px] font-bold text-[#E5484D]">
                    {fmtUsd(b.amountUsd, baseCurrency)}
                  </p>
                </div>
              </button>
            ))}
          </Rail>
        </Section>
      )}

      {products.length > 0 && (
        <Section
          icon={ShoppingBag}
          title="What's Moving 🔥"
          action="Marketplace"
          onAction={() => navigateSection("Marketplace")}
        >
          <Rail>
            {products.slice(0, 12).map((p) => (
              <Link
                key={p.id}
                to="/product/$id"
                params={{ id: p.id }}
                className="w-[152px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#141416] active:scale-[0.98]"

              >
                {p.coverUrl ? (
                  <img loading="lazy" decoding="async" src={p.coverUrl} alt="" className="h-28 w-full object-cover" />
                ) : (
                  <div className={`h-28 w-full bg-gradient-to-br ${p.hue}`} />
                )}
                <div className="p-2.5">
                  <p className="line-clamp-2 text-[12.5px] font-medium text-white">{p.title}</p>
                  <p className="mt-1 text-[12.5px] font-bold text-[#E5484D]">
                    {fmtUsd(p.priceUsd, baseCurrency)}
                  </p>
                </div>
              </Link>
            ))}
          </Rail>
        </Section>
      )}

      {courses.length > 0 && (
        <Section
          icon={GraduationCap}
          title="Academy Trending"
          action="Academy"
          onAction={() => navigateSection("Academy")}
        >
          <Rail>
            {courses.slice(0, 10).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigateSection("Academy")}
                className="w-[200px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#141416] text-left active:scale-[0.98]"

              >
                {c.coverUrl ? (
                  <img loading="lazy" decoding="async" src={c.coverUrl} alt="" className="h-24 w-full object-cover" />
                ) : (
                  <div className="h-24 w-full bg-gradient-to-br from-[#7C6CF6]/35 to-[#30A46C]/25" />
                )}
                <div className="p-3">
                  <p className="line-clamp-2 text-[13px] font-semibold text-white">{c.title}</p>
                  <p className="mt-1 text-[11.5px] text-white/45">
                    {c.isFree ? "Free" : fmtUsd(c.priceUsd, baseCurrency)}
                    {c.instructor ? ` · ${c.instructor}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </Rail>
        </Section>
      )}

      {circles.length > 0 && (
        <Section
          icon={Users}
          title="Communities to join"
          action="Circles"
          onAction={() => navigateSection("Circles")}
        >
          <Rail>
            {circles.slice(0, 10).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigateSection("Circles")}
                className="w-[150px] shrink-0 snap-start rounded-2xl border border-white/[0.06] bg-[#141416] p-3 text-left active:scale-[0.98]"
              >
                <span className="text-2xl">{c.emoji}</span>
                <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold text-white">{c.name}</p>
                <p className="text-[11px] text-white/40">{c.memberCount} members</p>
              </button>
            ))}
          </Rail>
        </Section>
      )}

      {!loading && peers.length === 0 && trending.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#141416] p-8 text-center">
          <p className="text-sm font-semibold text-white">Nothing to discover yet</p>
          <p className="mt-1 text-xs text-white/45">
            As the network grows, new creators, bounties and products will show up here.
          </p>
        </div>
      )}
    </div>
  );
}

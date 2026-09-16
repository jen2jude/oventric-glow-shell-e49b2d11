import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Loader2, Coins, Store, User, Star, Users, MessageSquare } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { navigateSection } from "@/components/oventric/DiscoveryPanel";
import { searchGlobal, type SearchResults } from "@/lib/search.functions";
import { 
  PersonCard, 
  SearchProductCard, 
  ShopCard, 
  ServiceCard, 
  CourseCard 
} from "@/components/oventric/search/ResultCards";

export type FeedCategory = "all" | "posts" | "media" | "bounties" | "assets" | "people";

export const FEED_CATEGORIES: Array<{ id: FeedCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "media", label: "Photos & video" },
  { id: "bounties", label: "Bounties" },
  { id: "assets", label: "Assets" },
  { id: "people", label: "People" },
];

/** Categories that resolve against the global index rather than feed posts. */
export const GLOBAL_CATEGORIES: FeedCategory[] = ["bounties", "assets", "people"];

const EMPTY: SearchResults = { 
  peers: [], 
  bounties: [], 
  products: [], 
  circles: [], 
  posts: [], 
  shops: [], 
  services: [], 
  courses: [] 
};

export function FeedSearchBar({
  q,
  onQueryChange,
  category,
  onCategoryChange,
  resultCount,
  appShell = false,
}: {
  q: string;
  onQueryChange: (v: string) => void;
  category: FeedCategory;
  onCategoryChange: (c: FeedCategory) => void;
  resultCount?: number | null;
  /** Native app shell: chrome-less, hairline-bordered treatment. */
  appShell?: boolean;
}) {
  return (
    <div className={appShell ? "px-0 pt-1 pb-0" : "space-y-3"}>
      <div className="relative group">
        <Search
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] transition-colors group-focus-within:text-[#E5484D] ${appShell ? "text-white/30" : "text-slate-400"}`}
        />
        <input
          type="search"
          role="searchbox"
          aria-label="Search the feed, bounties and assets"
          value={q}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onQueryChange("");
          }}
          placeholder="Search Oventric..."
          className={`w-full h-[52px] pl-11 pr-9 text-[15px] focus:outline-none transition-all ${
            appShell
              ? "rounded-[10px] bg-[#141416] border border-white/5 text-white placeholder:text-white/20 focus:border-[#E5484D]/40"
              : "rounded-[10px] bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#E5484D] focus:ring-2 focus:ring-[#E5484D]/20"
          }`}
        />

        {q && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[10px] text-slate-500 hover:text-slate-200 md:hover:text-slate-900 hover:bg-white/5 md:hover:bg-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!appShell && (
        <div
          role="tablist"
          aria-label="Feed filters"
          className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1"
        >
          {FEED_CATEGORIES.filter((c) => c.id !== "bounties").map((c) => {
            const active = c.id === category;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onCategoryChange(c.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#E5484D]/10 text-[#E5484D]"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}


      {typeof resultCount === "number" && (
        <p className="mt-2 text-[11px] text-slate-500 md:text-slate-500">
          {resultCount} {resultCount === 1 ? "match" : "matches"}
          {q ? ` for “${q}”` : ""}
        </p>
      )}
    </div>
  );
}

import { PeopleExploreList } from "./PeopleExploreList";
import { ExploreHeader, type ExploreTab } from "./ExploreHeader";

/** Cross-entity results (bounties, marketplace assets, people). */
export function FeedGlobalResults({ q, category }: { q: string; category: FeedCategory }) {
  const search = useServerFn(searchGlobal);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeExploreTab, setActiveExploreTab] = useState<ExploreTab>("All");
  const scrollContainerRef = useRef<HTMLDivElement>(null);


  const term = q.trim();
  const enabled = term.length >= 2;

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    search({ data: { q: term } })
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch((e) => {
        console.error("[FeedSearch] global search failed", e);
        if (!cancelled) setResults(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term, enabled, search]);

  useEffect(() => {
    if (enabled && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeExploreTab, enabled]);


  if (!enabled) {
    return null;
  }

  if (loading && results.peers.length === 0 && results.bounties.length === 0 && results.products.length === 0 && results.circles.length === 0 && results.posts.length === 0) {
    return (
      <div className="bg-[#0A0A0B] p-10 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#E5484D]" />
        <p className="text-sm text-white/40 font-medium">Searching Oventric...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] relative z-[100]">
      <div className="fixed inset-x-0 top-0 z-[101]">
        <ExploreHeader 
          activeTab={activeExploreTab} 
          onTabChange={setActiveExploreTab} 
        />
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 pt-[110px] pb-32 overflow-y-auto scroll-smooth"
      >


        {activeExploreTab === "All" && (
           <div className="flex flex-col gap-8 p-4">
              {results.peers.length > 0 && (
                <section>
                   <h3 className="mb-3 text-[12px] font-black uppercase tracking-widest text-white/30">People</h3>
                   <div className="flex flex-col gap-1">
                      {results.peers.slice(0, 3).map(p => <PersonCard key={p.id} peer={p} />)}
                   </div>
                </section>
              )}
              {results.products.length > 0 && (
                <section>
                   <h3 className="mb-3 text-[12px] font-black uppercase tracking-widest text-white/30">Marketplace</h3>
                   <div className="grid grid-cols-2 gap-3">
                      {results.products.slice(0, 2).map(p => <SearchProductCard key={p.id} product={p} />)}
                   </div>
                </section>
              )}
           </div>
        )}

        {activeExploreTab === "People" && (
          results.peers.length > 0 ? (
            <div className="flex flex-col">
               {results.peers.map(p => <PersonCard key={p.id} peer={p} />)}
            </div>
          ) : (
            <EmptyState message="No people found" />
          )
        )}

        {activeExploreTab === "Posts" && (
          results.posts.length > 0 ? (
            <div className="space-y-4 p-4">
              {results.posts.map((p) => (
                <Link
                  key={p.id}
                  to="/post/$id"
                  params={{ id: p.id }}
                  className="block rounded-[10px] border border-white/[0.06] bg-[#141416] p-4 active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-[#1A1A1F]">
                      <AvatarImage src={p.authorAvatarUrl} alt={p.authorName} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-white leading-none">{p.authorName}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-[14px] text-white/80 line-clamp-3 leading-relaxed">
                    {p.text}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState message="No posts found" />
          )
        )}

        {activeExploreTab === "Products" && (
           results.products.length > 0 ? (
             <div className="grid grid-cols-2 gap-3 p-4">
                {results.products.map(p => <SearchProductCard key={p.id} product={p} />)}
             </div>
           ) : <EmptyState message="No products found" />
        )}

        {activeExploreTab === "Shops" && (
          results.shops.length > 0 ? (
            <div className="flex flex-col gap-3 p-4">
                {results.shops.map(s => <ShopCard key={s.id} shop={s} />)}
            </div>
          ) : <EmptyState message="No shops found" />
        )}

        {activeExploreTab === "Services" && (
          results.services.length > 0 ? (
            <div className="flex flex-col gap-3 p-4">
                {results.services.map(s => <ServiceCard key={s.id} service={s} />)}
            </div>
          ) : <EmptyState message="No services found" />
        )}

        {activeExploreTab === "Courses" && (
          results.courses.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 p-4">
                {results.courses.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
          ) : <EmptyState message="No courses found" />
        )}

        {activeExploreTab === "Jobs" && (
            <EmptyState message="No jobs found yet. We're opening the Oventric Career hub soon." />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 text-center">
      <p className="text-sm font-medium text-white/30">{message}</p>
    </div>
  );
}


function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.06] md:border-slate-100 last:border-b-0">
      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
        {icon} {title}
      </div>
      <div className="pb-1">{children}</div>
    </div>
  );
}

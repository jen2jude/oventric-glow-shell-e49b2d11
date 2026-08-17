import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  Users,
  MessageCircle,
  Search,
  Lock,
  Smartphone,
  ArrowRight,
  Sparkles,
  Compass,
  Handshake,
} from "lucide-react";
import { getPublicCircleDirectory, type PublicCircle } from "@/lib/circles-public.functions";

const SHELL = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-11";
const PAGE_SIZE = 9;

type SortKey = "members" | "active" | "new";

const STEPS = [
  {
    icon: Compass,
    title: "Find your crew",
    text: "Circles are guilds built around a craft — SaaS, AI, design systems, infra. Browse them all here.",
  },
  {
    icon: Handshake,
    title: "Apply with a pledge",
    text: "Each circle sets its own code of conduct. Members answer it before they are let in.",
  },
  {
    icon: Sparkles,
    title: "Build and split the bag",
    text: "Inside, members post updates, share resources and take on bounties together.",
  },
];

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

function CircleCard({ c, onGated }: { c: PublicCircle; onGated: () => void }) {
  return (
    <article className="group overflow-hidden rounded-[12px] border border-slate-200 bg-white transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.4)]">
      <div
        className="relative h-24 w-full"
        style={{ background: `linear-gradient(120deg, ${c.bannerHue}, #0A0A0B)` }}
      >
        {c.coverUrl && (
          <img
            src={c.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-80"
          />
        )}
        <span className="absolute left-4 -bottom-6 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[12px] border-4 border-white bg-slate-900 text-xl">
          {c.avatarUrl ? (
            <img src={c.avatarUrl} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span>{c.emoji}</span>
          )}
        </span>
      </div>
      <div className="px-4 pb-4 pt-8">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-crimson">
          {c.category}
        </p>
        <h3 className="mt-1 truncate text-[16px] font-black text-slate-900">{c.name}</h3>
        <p className="mt-1.5 line-clamp-2 min-h-[36px] text-sm leading-relaxed text-slate-600">
          {c.description || "A builder guild on Oventric."}
        </p>
        <div className="mt-4 flex items-center gap-4 text-xs font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {fmt(c.memberCount)} {c.memberCount === 1 ? "member" : "members"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" /> {fmt(c.postCount)} {c.postCount === 1 ? "post" : "posts"}
          </span>
        </div>
        <button
          type="button"
          onClick={onGated}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-slate-900 text-sm font-black text-white transition-colors hover:bg-slate-800"
        >
          <Lock className="h-3.5 w-3.5" /> Join in the app
        </button>
      </div>
    </article>
  );
}

/**
 * Read-only web storefront for Circles & Guilds. Browser visitors can
 * discover every public circle; joining or posting hands off to the app.
 */
export function WebCircles({ onGated }: { onGated: () => void }) {
  const loadFn = useServerFn(getPublicCircleDirectory);
  const q = useQuery({ queryKey: ["public-circle-directory"], queryFn: () => loadFn() });
  const circles = useMemo(() => q.data ?? [], [q.data]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("members");
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(circles.map((c) => c.category).filter(Boolean)))],
    [circles],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return circles.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (
        term &&
        !c.name.toLowerCase().includes(term) &&
        !(c.description ?? "").toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [circles, category, query]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    if (sort === "active") return out.sort((a, b) => b.postCount - a.postCount);
    if (sort === "new")
      return out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return out.sort((a, b) => b.memberCount - a.memberCount);
  }, [filtered, sort]);

  useEffect(() => {
    setPage(1);
  }, [query, category, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageItems = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const totalMembers = circles.reduce((s, c) => s + c.memberCount, 0);
  const totalPosts = circles.reduce((s, c) => s + c.postCount, 0);
  const spotlight = [...circles].sort((a, b) => b.memberCount - a.memberCount)[0];

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Editorial hero */}
      <section className="relative overflow-hidden bg-[#0A0A0B] text-white">
        <div className="pointer-events-none absolute -left-32 -top-40 h-[460px] w-[460px] rounded-full bg-crimson/25 blur-[130px]" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-[380px] w-[380px] rounded-full bg-sky-500/10 blur-[130px]" />
        <div
          className={`${SHELL} relative grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:py-20`}
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
              <ShieldCheck className="h-3.5 w-3.5 text-crimson" /> Vetted guilds
            </span>
            <h1 className="mt-5 max-w-2xl text-[38px] font-black leading-[1.05] tracking-tight lg:text-[54px]">
              Circles &amp; Guilds — find your crew, build together.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
              Every public circle on Oventric, with its craft, its size and how active it is. Reading
              is open on the web; joining and posting happen in the app.
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-7 flex max-w-xl items-center gap-2 rounded-[10px] border border-white/15 bg-white/10 px-3 py-2 backdrop-blur"
            >
              <Search className="h-4 w-4 shrink-0 text-white/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search circles by name or focus"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/40"
              />
              <span className="hidden rounded-[8px] bg-white px-3 py-1.5 text-xs font-black text-slate-900 sm:inline-block">
                {sorted.length} circles
              </span>
            </form>

            <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { icon: ShieldCheck, label: "Public circles", value: fmt(circles.length) },
                { icon: Users, label: "Members inside", value: fmt(totalMembers) },
                { icon: MessageCircle, label: "Guild posts", value: fmt(totalPosts) },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <s.icon className="h-5 w-5 text-crimson" />
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
                      {s.label}
                    </dt>
                    <dd className="text-xl font-black">{s.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <aside className="w-full self-center rounded-[14px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur lg:justify-self-end">
            <div className="inline-flex items-center gap-2 rounded-full bg-crimson/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-crimson">
              <Lock className="h-3 w-3" /> Browse only on web
            </div>
            <h2 className="mt-4 text-xl font-black leading-snug">
              Membership lives inside the app
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Code-of-conduct pledges, guild chat, shared resources and circle bounties all run in
              the Oventric app so members stay accountable.
            </p>
            {spotlight && (
              <div className="mt-5 rounded-[10px] border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                  Largest circle
                </p>
                <p className="mt-1.5 line-clamp-2 text-sm font-bold">
                  {spotlight.emoji} {spotlight.name}
                </p>
                <p className="mt-2 text-2xl font-black text-crimson">
                  {fmt(spotlight.memberCount)} {spotlight.memberCount === 1 ? "member" : "members"}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={onGated}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-crimson text-sm font-black text-white transition-colors hover:bg-crimson/90"
            >
              <Smartphone className="h-4 w-4" /> Get the app to join a circle
            </button>
          </aside>
        </div>
      </section>

      {/* How circles work */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className={`${SHELL} grid gap-6 py-10 md:grid-cols-3`}>
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-crimson/10 text-crimson">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Step {i + 1}
                </p>
                <h3 className="text-[15px] font-black text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Directory */}
      <section className={`${SHELL} grid gap-10 py-12 lg:grid-cols-[220px_minmax(0,1fr)]`}>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Craft</p>
          <div className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:items-start">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-[10px] px-3 py-2 text-left text-sm font-semibold transition-colors lg:w-full ${
                  category === c
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c === "all" ? "All circles" : c}
              </button>
            ))}
          </div>

          <p className="mt-8 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Sort
          </p>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="mt-3 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="members">Most members</option>
            <option value="active">Most active</option>
            <option value="new">Newest</option>
          </select>

          <div className="mt-8 rounded-[10px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">Want to forge your own?</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Creating a circle, setting its code of conduct and approving members happen in the app.
            </p>
            <button
              type="button"
              onClick={onGated}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-crimson hover:underline"
            >
              Open in app <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              Public circles
              <span className="ml-2 text-sm font-bold text-slate-400">{sorted.length}</span>
            </h2>
          </div>

          {q.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-[12px] border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : q.isError ? (
            <div className="rounded-[12px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              Circles could not be loaded right now.
            </div>
          ) : pageItems.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-slate-300 bg-slate-50 p-14 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-4 text-lg font-black text-slate-900">No circles match</h3>
              <p className="mt-1 text-sm text-slate-600">
                Try another craft or clear your search.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {pageItems.map((c) => (
                  <CircleCard key={c.id} c={c} onGated={onGated} />
                ))}
              </div>

              {pageCount > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i + 1)}
                      className={`h-9 min-w-9 rounded-[10px] px-3 text-sm font-black transition-colors ${
                        current === i + 1
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChevronRight, GraduationCap, PlayCircle, Star } from "lucide-react";
import { listCourses, listMyEnrollments, type CourseDTO } from "@/lib/academy.functions";
import type { ProfileListing } from "@/lib/profiles/mockProfiles";

const ACCENT = "#E5484D";

type Filter = "enrolled" | "selling" | "finished" | "active";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function Cover({ url, className }: { url?: string | null; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-[#1C1C21] md:bg-slate-100 ${className ?? ""}`}>
      {url ? (
        <img loading="lazy" decoding="async" src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <GraduationCap className="h-6 w-6 text-white/25 md:text-slate-400" />
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141417] px-3 py-4 text-center md:web-card">
      <div className="text-xl font-black text-white md:text-slate-900">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-slate-400 md:text-slate-500">{label}</div>
    </div>
  );
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mt-7 flex items-center justify-between gap-3">
      <h3 className="text-base font-black text-white md:text-slate-900">{title}</h3>
      {action}
    </div>
  );
}

export interface CourseTileData {
  id: string;
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  priceUsd: number;
  rating?: number;
  done?: boolean;
}

function CourseRow({
  c,
  price,
}: {
  c: CourseTileData;
  price: (usd: number) => string;
}) {
  return (
    <Link
      to="/"
      search={{ section: "Academy", course: c.id } as never}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141417] p-3 transition-colors hover:bg-[#1A1A1F] md:web-card md:hover:bg-transparent"
    >
      <Cover url={c.coverUrl} className="h-16 w-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-white md:text-slate-900">{c.title}</div>
        <div className="mt-0.5 truncate text-xs text-slate-400 md:text-slate-500">
          {c.subtitle || "Oventric Academy"}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="text-sm font-black text-white md:text-slate-900">
            {c.priceUsd > 0 ? price(c.priceUsd) : "Free"}
          </span>
          {c.done ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-slate-400">
              <PlayCircle className="h-3.5 w-3.5" /> Continue
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CourseCard({ c, price }: { c: CourseTileData; price: (usd: number) => string }) {
  return (
    <Link
      to="/"
      search={{ section: "Academy", course: c.id } as never}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#141417] transition-transform hover:-translate-y-0.5 md:web-card"
    >
      <Cover url={c.coverUrl} className="aspect-[4/3] w-full rounded-none" />
      <div className="p-2">
        <div className="line-clamp-2 text-[11px] font-bold leading-snug text-white md:text-slate-900">
          {c.title}
        </div>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="text-[11px] font-black" style={{ color: ACCENT }}>
            {c.priceUsd > 0 ? price(c.priceUsd) : "Free"}
          </span>
          {(c.rating ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
              <Star className="h-3 w-3 fill-amber-400" strokeWidth={0} /> {(c.rating ?? 0).toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Courses tab for the identity hub — mirrors the Shop tab: stats, a filter
 * toggle (Enrolled / Selling / Finished / Active), the matching list, and a
 * link out to the creator's full course page.
 */
export function ProfileCoursesTab({
  items,
  total,
  isOwner,
  price,
  slug,
}: {
  items: ProfileListing[];
  total: number;
  isOwner: boolean;
  price: (usd: number) => string;
  slug: string;
}) {
  const loadAll = useServerFn(listCourses);
  const loadEnrollments = useServerFn(listMyEnrollments);

  const [all, setAll] = useState<CourseDTO[]>([]);
  const [enrollments, setEnrollments] = useState<{ courseId: string; completedAt: string | null }[]>(
    [],
  );
  const [filter, setFilter] = useState<Filter>(isOwner ? "selling" : "selling");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [a, e] = await Promise.all([
        loadAll().catch(() => [] as CourseDTO[]),
        loadEnrollments().catch(() => [] as { courseId: string; completedAt: string | null }[]),
      ]);
      if (cancelled) return;
      setAll(a as CourseDTO[]);
      setEnrollments(e as { courseId: string; completedAt: string | null }[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll, loadEnrollments]);

  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);

  const toTile = (c: CourseDTO, done?: boolean): CourseTileData => ({
    id: c.id,
    title: c.title,
    subtitle: c.instructorName || c.category,
    coverUrl: c.coverUrl,
    priceUsd: c.isFree ? 0 : c.priceUSD,
    ...(done === undefined ? {} : { done }),
  });

  const enrolledTiles = useMemo(
    () =>
      enrollments
        .map((e) => {
          const c = byId.get(e.courseId);
          return c ? toTile(c, !!e.completedAt) : null;
        })
        .filter((t): t is CourseTileData => !!t),
    [enrollments, byId],
  );
  const finishedTiles = enrolledTiles.filter((t) => t.done);
  const activeTiles = enrolledTiles.filter((t) => !t.done);

  const sellingTiles: CourseTileData[] = items.map((l) => ({
    id: l.id,
    title: l.title,
    subtitle: l.blurb?.trim() || l.category,
    coverUrl: l.coverUrl ?? null,
    priceUsd: l.priceUsd,
    ...(l.rating === undefined ? {} : { rating: l.rating }),
  }));

  const sellingIds = new Set(sellingTiles.map((t) => t.id));
  const enrolledIds = new Set(enrolledTiles.map((t) => t.id));
  const recommendations = all
    .filter((c) => !sellingIds.has(c.id) && !enrolledIds.has(c.id))
    .slice(0, 12)
    .map((c) => toTile(c));

  const tabs: [Filter, string, number][] = [
    ["enrolled", "Enrolled", enrolledTiles.length],
    ["selling", isOwner ? "I'm selling" : "Selling", sellingTiles.length],
    ["finished", "Finished", finishedTiles.length],
    ["active", "Active", activeTiles.length],
  ];

  const current =
    filter === "enrolled"
      ? enrolledTiles
      : filter === "selling"
        ? sellingTiles
        : filter === "finished"
          ? finishedTiles
          : activeTiles;

  const viewCourses = (
    <Link
      to="/"
      search={{ section: "Academy" } as never}
      className="inline-flex items-center gap-1 text-sm font-bold"
      style={{ color: ACCENT }}
    >
      View Courses <ChevronRight className="h-4 w-4" strokeWidth={3} />
    </Link>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white md:text-slate-900">
          {isOwner ? "My Courses" : "Courses"}
        </h2>
        {viewCourses}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <StatCard value={compact(total)} label="Published" />
        <StatCard value={compact(enrolledTiles.length)} label="Enrolled" />
        <StatCard value={compact(finishedTiles.length)} label="Completed" />
      </div>

      {/* Toggle */}
      <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(([key, label, count]) => {
          const on = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-full px-3.5 py-3 text-xs font-bold transition-colors ${
                on
                  ? "text-white"
                  : "border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white md:web-card md:text-slate-500"
              }`}
              {...(on ? { style: { backgroundColor: ACCENT } } : {})}
            >
              {label} {count > 0 && <span className="opacity-80">· {count}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-3">
        {current.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#141417] p-6 text-center text-sm text-slate-400 md:web-card md:text-slate-500">
            Nothing here yet.
          </div>
        ) : (
          current.map((c) => <CourseRow key={`${filter}-${c.id}`} c={c} price={price} />)
        )}
      </div>

      {recommendations.length > 0 && (
        <>
          <SectionHead title="All courses on Oventric" action={viewCourses} />
          <div className="mt-3 grid grid-cols-3 gap-3">
            {recommendations.map((c) => (
              <CourseCard key={c.id} c={c} price={price} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

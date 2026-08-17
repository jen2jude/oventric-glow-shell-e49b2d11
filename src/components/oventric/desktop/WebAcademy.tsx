import { useEffect, useMemo, useState } from "react";
import {
  Search,
  GraduationCap,
  Users,
  PlayCircle,
  Clock,
  Award,
  ChevronRight,
  BookOpen,
  Sparkles,
} from "lucide-react";
import type { CourseDTO } from "@/lib/academy.functions";
import { computeDisplayPrice } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";

type LevelKey = "all" | "beginner" | "intermediate" | "advanced";
type PriceKey = "all" | "free" | "paid";
type SortKey = "popular" | "newest" | "price_asc" | "price_desc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most enrolled" },
  { key: "newest", label: "Newest first" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
];

const LEVELS: { key: LevelKey; label: string }[] = [
  { key: "all", label: "All levels" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const PAGE_SIZE = 12;
const SHELL = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-11";

export interface WebAcademyProps {
  courses: CourseDTO[] | null;
  enrolled: any[];
  currency: Currency;
  categories: readonly { key: string; label: string }[];
  canPublish: boolean;
  onOpenCourse: (id: string) => void;
  onPublish: () => void;
}

/**
 * Dedicated web (URL) Academy: an editorial, catalogue-style learning
 * storefront with a persistent filter rail, dense course grid and pagination.
 * Deliberately different from the dark app-shell Academy experience.
 */
export function WebAcademy({
  courses,
  enrolled,
  currency,
  categories,
  canPublish,
  onOpenCourse,
  onPublish,
}: WebAcademyProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [level, setLevel] = useState<LevelKey>("all");
  const [priceFilter, setPriceFilter] = useState<PriceKey>("all");
  const [sort, setSort] = useState<SortKey>("popular");
  const [page, setPage] = useState(1);

  const list = courses ?? [];

  const priceOf = useMemo(
    () => (c: CourseDTO) =>
      computeDisplayPrice(
        {
          price_usd: c.priceUSD,
          original_currency: c.originalCurrency,
          original_amount: c.originalAmount,
          fx_snapshot: c.fxSnapshot,
        },
        currency,
      ),
    [currency],
  );

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: list.length };
    for (const c of list) counts[c.category] = (counts[c.category] ?? 0) + 1;
    return counts;
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (level !== "all" && String(c.level).toLowerCase() !== level) return false;
      if (priceFilter === "free" && !c.isFree) return false;
      if (priceFilter === "paid" && c.isFree) return false;
      if (
        q &&
        !(
          c.title.toLowerCase().includes(q) ||
          (c.instructorName ?? "").toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  }, [list, query, category, level, priceFilter]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    switch (sort) {
      case "newest":
        return out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      case "price_asc":
        return out.sort((a, b) => priceOf(a).value - priceOf(b).value);
      case "price_desc":
        return out.sort((a, b) => priceOf(b).value - priceOf(a).value);
      default:
        return out.sort(
          (a, b) => (b.enrolledCount ?? 0) - (a.enrolledCount ?? 0) || (b.promoted ? 1 : 0) - (a.promoted ? 1 : 0),
        );
    }
  }, [filtered, sort, priceOf]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageItems = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, category, level, priceFilter, sort]);

  const spotlight = useMemo(() => {
    const promoted = list.filter((c) => c.promoted);
    const pool = promoted.length ? promoted : [...list].sort((a, b) => (b.enrolledCount ?? 0) - (a.enrolledCount ?? 0));
    return pool.slice(0, 3);
  }, [list]);

  const totalLearners = useMemo(
    () => list.reduce((sum, c) => sum + (c.enrolledCount ?? 0), 0),
    [list],
  );
  const instructors = useMemo(
    () => new Set(list.map((c) => c.instructorName).filter(Boolean)).size,
    [list],
  );

  const continueList = useMemo(() => {
    return enrolled
      .map((e) => ({ e, course: list.find((c) => c.id === e.courseId) }))
      .filter((x) => x.course)
      .slice(0, 4);
  }, [enrolled, list]);

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Editorial hero band */}
      <section className="relative overflow-hidden bg-[#0B1220] text-white">
        <div className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-crimson/25 blur-[120px]" />
        <div className="pointer-events-none absolute -left-24 bottom--20 h-[360px] w-[360px] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className={`${SHELL} relative grid gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:py-20`}>
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
              <Sparkles className="h-3.5 w-3.5" /> Oventric Academy
            </span>
            <h1 className="mt-5 max-w-2xl text-[38px] font-black leading-[1.05] tracking-tight lg:text-[54px]">
              Learn the skills people are actually paying for.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
              Video-first courses from working African creators and operators. Self-paced, priced in
              your own currency, with a certificate when you finish.
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-7 flex max-w-xl items-center gap-2 rounded-[10px] border border-white/15 bg-white/10 px-3 py-2 backdrop-blur"
            >
              <Search className="h-4 w-4 shrink-0 text-white/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses, topics or instructors"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/40"
              />
              <span className="hidden rounded-[8px] bg-white px-3 py-1.5 text-xs font-black text-slate-900 sm:inline-block">
                {sorted.length} results
              </span>
            </form>

            <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { icon: BookOpen, label: "Courses", value: list.length },
                { icon: Users, label: "Enrolments", value: totalLearners },
                { icon: Award, label: "Instructors", value: instructors },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <s.icon className="h-5 w-5 text-crimson" />
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
                      {s.label}
                    </dt>
                    <dd className="text-xl font-black">{s.value.toLocaleString()}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* Spotlight stack */}
          {spotlight.length > 0 && (
            <div className="space-y-3 lg:justify-self-end lg:self-center w-full">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/50">
                In the spotlight
              </p>
              {spotlight.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenCourse(c.id)}
                  className="group flex w-full items-center gap-4 rounded-[10px] border border-white/10 bg-white/[0.06] p-3 text-left transition-colors hover:border-crimson/50 hover:bg-white/10"
                >
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-[8px] bg-white/10">
                    {c.coverUrl ? (
                      <img
                        src={c.coverUrl}
                        alt={c.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <GraduationCap className="absolute inset-0 m-auto h-6 w-6 text-white/40" />
                    )}
                    <span className="absolute left-1 top-1 rounded-[6px] bg-black/60 px-1.5 text-[10px] font-black">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13.5px] font-bold leading-snug">{c.title}</p>
                    <p className="mt-1 truncate text-[12px] text-white/50">
                      {c.instructorName || "Oventric instructor"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-black text-crimson">
                    {c.isFree ? "Free" : priceOf(c).formatted}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Continue learning */}
      {continueList.length > 0 && (
        <section className="border-b border-slate-200 bg-slate-50">
          <div className={`${SHELL} py-6`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black text-slate-900">Continue learning</h2>
              <span className="text-[12px] font-semibold text-slate-500">
                {enrolled.length} enrolled
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {continueList.map(({ e, course }) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpenCourse(course!.id)}
                  className="group flex items-center gap-3 rounded-[10px] border border-slate-200 bg-white p-3 text-left transition-shadow hover:shadow-[0_16px_40px_-24px_rgba(15,23,42,0.45)]"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-slate-100">
                    {course!.coverUrl ? (
                      <img
                        src={course!.coverUrl}
                        alt={course!.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <GraduationCap className="m-3 h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-slate-900">{course!.title}</p>
                    <p className="mt-0.5 text-[11.5px] font-semibold text-emerald-600">
                      {e.completedAt ? "Completed" : "In progress"}
                    </p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 group-hover:text-crimson" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Catalogue */}
      <section className={`${SHELL} grid gap-8 py-10 lg:grid-cols-[236px_minmax(0,1fr)]`}>
        {/* Filter rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-7">
            <FilterGroup title="Category">
              {categories.map((c) => (
                <FilterRow
                  key={c.key}
                  active={category === c.key}
                  onClick={() => setCategory(c.key)}
                  label={c.label.replace(/^[^\w]+\s*/, "")}
                  count={catCounts[c.key] ?? 0}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Level">
              {LEVELS.map((l) => (
                <FilterRow
                  key={l.key}
                  active={level === l.key}
                  onClick={() => setLevel(l.key)}
                  label={l.label}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Price">
              {(
                [
                  { key: "all", label: "Any price" },
                  { key: "free", label: "Free" },
                  { key: "paid", label: "Paid" },
                ] as { key: PriceKey; label: string }[]
              ).map((p) => (
                <FilterRow
                  key={p.key}
                  active={priceFilter === p.key}
                  onClick={() => setPriceFilter(p.key)}
                  label={p.label}
                />
              ))}
            </FilterGroup>

            {canPublish && (
              <button
                type="button"
                onClick={onPublish}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-crimson px-4 py-2.5 text-[12.5px] font-black uppercase tracking-[0.1em] text-white transition-transform hover:brightness-110 active:scale-[0.98]"
              >
                <GraduationCap className="h-4 w-4" /> Publish a course
              </button>
            )}
          </div>
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-[20px] font-black tracking-tight text-slate-900">
                {category === "all"
                  ? "All courses"
                  : categories.find((c) => c.key === category)?.label.replace(/^[^\w]+\s*/, "")}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-slate-500">
                {sorted.length} course{sorted.length === 1 ? "" : "s"} available
              </p>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-600">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-900 outline-none focus:border-crimson"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Mobile / tablet filter chips */}
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                  category === c.key
                    ? "border-crimson bg-crimson text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {courses === null ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[280px] animate-pulse rounded-[10px] bg-slate-100" />
              ))}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-slate-300 py-20 text-center">
              <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-[14px] font-bold text-slate-900">No courses match your filters</p>
              <p className="mt-1 text-[12.5px] text-slate-500">Try a different category or clear your search.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((c) => (
                <WebCourseCard
                  key={c.id}
                  course={c}
                  price={c.isFree ? "Free" : priceOf(c).formatted}
                  onOpen={() => onOpenCourse(c.id)}
                />
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={current === 1}
                className="rounded-[10px] border border-slate-200 px-3 py-2 text-[12.5px] font-bold text-slate-600 disabled:opacity-40"
              >
                Prev
              </button>
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i + 1)}
                  className={`h-9 min-w-9 rounded-[10px] px-3 text-[12.5px] font-black transition-colors ${
                    current === i + 1
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={current === pageCount}
                className="rounded-[10px] border border-slate-200 px-3 py-2 text-[12.5px] font-bold text-slate-600 disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </div>
      </section>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-[13px] transition-colors ${
        active ? "bg-crimson/10 font-black text-crimson" : "font-medium text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span className="truncate">{label}</span>
      {typeof count === "number" && (
        <span className="ml-2 shrink-0 text-[11.5px] text-slate-400">{count}</span>
      )}
    </button>
  );
}

function WebCourseCard({
  course,
  price,
  onOpen,
}: {
  course: CourseDTO;
  price: string;
  onOpen: () => void;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-32px_rgba(15,23,42,0.5)]">
      <button type="button" onClick={onOpen} className="relative block aspect-video w-full bg-slate-100">
        {course.coverUrl ? (
          <img
            src={course.coverUrl}
            alt={course.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <GraduationCap className="absolute inset-0 m-auto h-10 w-10 text-slate-300" />
        )}
        <span className="absolute left-3 top-3 rounded-[6px] bg-white/95 px-2 py-1 text-[10.5px] font-black uppercase tracking-[0.1em] text-slate-700">
          {String(course.level ?? "beginner")}
        </span>
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <PlayCircle className="h-11 w-11 text-white drop-shadow-lg" />
        </span>
      </button>

      <div className="flex flex-1 flex-col p-4">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="line-clamp-2 text-[15px] font-black leading-snug text-slate-900 group-hover:text-crimson">
            {course.title}
          </h3>
        </button>
        <p className="mt-1 truncate text-[12.5px] text-slate-500">
          {course.instructorName || "Oventric instructor"}
        </p>

        <div className="mt-3 flex items-center gap-4 text-[12px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {course.moduleCount ?? 0} lessons
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {(course.enrolledCount ?? 0).toLocaleString()}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[17px] font-black text-slate-900">{price}</span>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 rounded-[10px] bg-slate-900 px-3.5 py-2 text-[12px] font-black text-white transition-colors group-hover:bg-crimson"
          >
            View course <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

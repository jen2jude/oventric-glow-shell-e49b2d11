import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useDominantColor } from "@/hooks/use-dominant-color";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  CheckCircle2,
  Circle,
  Loader2,
  Clock,
  Users,
  GraduationCap,
  Sparkles,
  Award,
  Lock,
  Edit3,
  Video,
  RotateCcw,
  ScrollText,
  ShoppingBag,
  Search,
  Settings2,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  listCourses,
  getCourse,
  enrollFree,
  getMyEnrollment,
  listMyEnrollments,
  markModuleComplete,
  unmarkModuleComplete,
  type CourseDTO,
  type CourseWithModulesDTO,
  type ModuleDTO,
  type EnrollmentDTO,
} from "@/lib/academy.functions";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { CourseEditorModal } from "./CourseEditorModal";
import { CoursePublishWizard } from "./CoursePublishWizard";
import { CourseCheckoutModal } from "./CourseCheckoutModal";
import { useIsAppShell } from "@/hooks/use-launch-context";

import { computeDisplayPrice } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { AdSlot } from "@/components/oventric/ads/AdSlot";
import { AcademyRecommendations } from "@/components/oventric/AcademyRecommendations";

function courseDisplayPrice(
  c: { priceUSD: number; originalCurrency: Currency; originalAmount: number; fxSnapshot: any },
  viewer: Currency,
) {
  return computeDisplayPrice(
    {
      price_usd: c.priceUSD,
      original_currency: c.originalCurrency,
      original_amount: c.originalAmount,
      fx_snapshot: c.fxSnapshot,
    },
    viewer,
  );
}

const CATEGORIES = [
  { key: "all", label: "✨ All Courses" },
  { key: "frontend", label: "💻 Frontend" },
  { key: "uiux", label: "🎨 UI/UX" },
  { key: "ai", label: "🤖 AI" },
  { key: "backend", label: "🗄️ Backend" },
  { key: "security", label: "🛡️ Security" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

function embedUrl(m: ModuleDTO): string {
  const raw = m.videoUrl.trim();
  if (m.videoProvider === "vimeo" || /vimeo\.com/i.test(raw)) {
    const match = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : raw;
  }
  const yt =
    raw.match(/[?&]v=([\w-]+)/)?.[1] ||
    raw.match(/youtu\.be\/([\w-]+)/)?.[1] ||
    raw.match(/youtube\.com\/embed\/([\w-]+)/)?.[1];
  return yt ? `https://www.youtube.com/embed/${yt}` : raw;
}

export const Academy = ({ hubMode = false }: { hubMode?: boolean }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { baseCurrency } = useOnboarding();
  const isAppShell = useIsAppShell();
  const fetchList = useServerFn(listCourses);
  const [view, setView] = useState<"catalog" | "course">("catalog");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [courses, setCourses] = useState<CourseDTO[] | null>(null);
  const [enrolled, setEnrolled] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [useWizard, setUseWizard] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMyEnrollments = useServerFn(listMyEnrollments);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUserId(s?.user?.id ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchMyEnrollments().then(setEnrolled).catch(() => setEnrolled([]));
    } else {
      setEnrolled([]);
    }
  }, [userId, fetchMyEnrollments, refreshKey]);

  useEffect(() => {
    fetchList()
      .then(setCourses)
      .catch((e) => {
        toast.error(e.message);
        setCourses([]);
      });
  }, [fetchList, refreshKey]);

  // Global catalogue: every learner sees every course. Prices are always
  // rendered in the viewer's own home currency via the FX model.
  const filtered = useMemo(() => {
    if (!courses) return [];
    return courses.filter((c) => {
      const matchesCategory = category === "all" || c.category === category;
      const matchesSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.instructorName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [courses, category, searchQuery]);

  const hideHeader = hubMode && isAppShell && searchQuery === "" && category === "all";

  const autoScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    if (scrollLeft + clientWidth >= scrollWidth - 10) {
      scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      scrollRef.current.scrollBy({ left: clientWidth, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (!isAppShell && (searchQuery !== "" || category !== "all")) return;
    const interval = setInterval(autoScroll, 5000);
    return () => clearInterval(interval);
  }, [autoScroll, isAppShell, searchQuery, category]);

  useEffect(() => {
    if (!scrollRef.current) return;
    // ... rest of effect if needed
  }, [isAppShell, searchQuery, category]);

  if (view === "course" && selectedId) {
    return (
      <CourseDetail
        courseId={selectedId}
        userId={userId}
        isAppShell={isAppShell}
        onBack={() => setView("catalog")}
        onEdit={(id) => {
          setEditingId(id);
          setEditorOpen(true);
        }}
      />
    );
  }

  return (
    <div className={`w-full ${!isAppShell ? "bg-white min-h-screen" : "bg-black min-h-screen"}`}>
      <AcademyHero isAppShell={isAppShell} />

      {isAppShell && (
        <div className="bg-[#0A0A0B] px-4 pt-1 pb-3 sticky top-0 z-40 border-b border-white/5">
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-black text-lg">Browse courses</h2>
              {userId && (
                <button
                  onClick={() => {
                    setEditingId(undefined);
                    setUseWizard(true);
                    setEditorOpen(true);
                  }}
                  className="inline-flex items-center gap-2 text-[10px] text-white bg-[#E5484D] hover:bg-[#E5484D]/90 rounded-[8px] px-3 py-1.5 font-black uppercase tracking-widest shadow-[0_4px_10px_rgba(229,72,77,0.3)] transition-all active:scale-95"
                >
                  <GraduationCap className="w-3.5 h-3.5" /> Publish
                </button>
              )}
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A1A1C] border border-white/5 rounded-[10px] py-3 pl-9 pr-4 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors whitespace-nowrap ${
                      active
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-[#1A1A1C] border-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto w-full">
        {!isAppShell && (
          <div className="sticky top-0 z-30 px-4 py-3 border-b bg-white border-slate-200">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-slate-900 font-black text-lg">Browse courses</h2>
              {userId && (
                <button
                  onClick={() => {
                    setEditingId(undefined);
                    setUseWizard(true);
                    setEditorOpen(true);
                  }}
                  className="ml-auto inline-flex items-center gap-2 text-sm text-white bg-[#E5484D] hover:bg-[#E5484D]/90 rounded-[10px] px-4 py-2 font-black uppercase tracking-widest shadow-[0_4px_10px_rgba(229,72,77,0.3)] transition-all"
                >
                  <GraduationCap className="w-4 h-4" /> Publish a Course
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`shrink-0 px-4 py-3 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                      active
                        ? "bg-crimson border-crimson text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={`px-4 py-6 ${isAppShell ? "space-y-8" : "space-y-8"}`}>
          {enrolled.length > 0 && category === 'all' && searchQuery === "" && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold text-lg ${!isAppShell ? "text-slate-900" : "text-white"}`}>My Enrolled Courses</h3>
              </div>
              <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
                {enrolled.map(enrollment => {
                  const course = courses?.find(c => c.id === enrollment.courseId);
                  if (!course) return null;
                  
                  const isFinished = enrollment.completedAt != null;

                  if (isAppShell) {
                    return (
                      <button 
                        key={enrollment.id} 
                        onClick={() => { setSelectedId(course.id); setView("course"); }}
                        className="flex flex-col items-center gap-2 shrink-0 w-28 group"
                      >
                        <div className="relative w-24 h-24">
                          <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle cx="48" cy="48" r="45" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-white/10" />
                            <circle 
                              cx="48" cy="48" r="45" 
                              stroke="currentColor" 
                              strokeWidth="3" 
                              fill="transparent" 
                              className={isFinished ? "text-emerald-500" : "text-[#E5484D]"} 
                              strokeDasharray={282.7} 
                              strokeDashoffset={282.7 * (1 - (isFinished ? 1 : 0.05))} 
                              strokeLinecap="round" 
                            />
                          </svg>
                          <div className="absolute inset-[5px] rounded-full overflow-hidden border border-white/5 bg-[#0A0A0B]">
                            {course.coverUrl ? (
                              <img loading="lazy" decoding="async" 
                                src={course.coverUrl} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                alt={course.title}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <GraduationCap className="w-8 h-8 text-white/10" />
                              </div>
                            )}
                          </div>
                          {isFinished && (
                            <div className="absolute top-0 right-0 bg-emerald-500 rounded-full p-0.5 shadow-lg">
                              <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-white/70 font-bold text-center line-clamp-2 leading-tight w-full group-hover:text-white transition-colors">
                          {course.title}
                        </span>

                      </button>
                    );
                  }

                  return (
                    <div key={enrollment.id} className={`shrink-0 w-64 overflow-hidden flex flex-col ${!isAppShell ? "web-card" : "rounded-xl border shadow-lg bg-[#1A1A1C] border-white/5"}`}>
                      <div className="relative aspect-[21/9] bg-[#121214]">
                        {course.coverUrl ? (
                          <img loading="lazy" decoding="async" 
                            src={course.coverUrl} 
                            className="w-full h-full object-cover"
                            alt={course.title}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-white/10" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40" />
                        <div className="absolute inset-0 p-3 flex flex-col justify-end">
                          <h4 className="font-bold text-xs text-white line-clamp-1">{course.title}</h4>
                        </div>
                      </div>

                      <div className="p-4 flex flex-col items-center">
                        <div className="w-full flex items-center justify-between mb-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">{isFinished ? "Finished" : "Progress"}</span>
                            <span className={`text-sm font-bold ${!isAppShell ? "text-slate-900" : "text-white"}`}>{isFinished ? "100%" : "In Progress"}</span>
                          </div>
                          <div className="relative w-10 h-10 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                              <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="transparent" className={!isAppShell ? "text-slate-100" : "text-white/5"} />
                              <circle 
                                cx="20" cy="20" r="18" 
                                stroke="currentColor" 
                                strokeWidth="3" 
                                fill="transparent" 
                                className={isFinished ? "text-emerald-500" : "text-[#E5484D]"} 
                                strokeDasharray={113} 
                                strokeDashoffset={113 * (1 - (isFinished ? 1 : 0.05))} 
                                strokeLinecap="round" 
                              />
                            </svg>
                            <span className={`absolute text-[8px] font-bold ${!isAppShell ? "text-slate-900" : "text-white"}`}>{isFinished ? "100" : "5"}%</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => { setSelectedId(course.id); setView("course"); }}
                          className={`w-full py-3 rounded-[10px] text-xs font-black uppercase tracking-widest transition-all ${isFinished ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-[#E5484D] text-white hover:bg-[#E5484D]/90 shadow-[0_4px_10px_rgba(229,72,77,0.2)]"}`}
                        >
                          {isFinished ? "Finished" : "Resume Learning"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <AdSlot placement="academy" variant="banner" />
          
          {courses === null && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="web-card-flat overflow-hidden animate-pulse"
                >
                  <div className="aspect-video bg-slate-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {courses !== null && filtered.length === 0 && (
            <div className="text-center py-16 border border-dashed border-slate-300 rounded-xl">
              <GraduationCap className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <div className="text-slate-900 font-bold">No courses yet</div>
              <p className="text-sm text-slate-500 mt-1">Please check back later.</p>
            </div>
          )}

          {searchQuery === "" && category === 'all' && (
            <section className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="min-w-0">
                  {!isAppShell && <div className="web-eyebrow mb-2">Featured</div>}
                  <h3 className={`font-bold text-lg ${!isAppShell ? "text-slate-900 web-accent-underline inline-block" : "text-white"}`}>Trending</h3>
                </div>
                <button className="text-xs font-bold text-crimson shrink-0">View All</button>
              </div>
              <div className="overflow-hidden relative w-full">
                <div ref={scrollRef} className={`flex w-full overflow-x-auto scrollbar-none snap-x snap-mandatory gap-4 pb-2 ${!isAppShell ? "lg:grid lg:grid-cols-2 lg:overflow-visible" : ""}`}>
                  {(courses?.slice(0, 4) ?? []).map((course, idx) => {
                    const gradients = [
                      "bg-gradient-to-br from-[#8B5CF6] via-[#A78BFA] to-[#C4B5FD]",
                      "bg-gradient-to-br from-[#F87171] via-[#FB7185] to-[#FCA5A5]",
                      "bg-gradient-to-br from-[#3B82F6] via-[#60A5FA] to-[#93C5FD]",
                      "bg-gradient-to-br from-[#F59E0B] via-[#FBBF24] to-[#FCD34D]",
                    ];
                    return (
                      <AcademyTrendingCard 
                        key={course.id} 
                        course={course} 
                        onClick={() => { setSelectedId(course.id); setView("course"); }}
                      />
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0">
                {!isAppShell && <div className="web-eyebrow mb-2">Catalog</div>}
                <h3 className={`font-bold text-lg ${!isAppShell ? "text-slate-900 web-accent-underline inline-block" : "text-white"}`}>
                  {searchQuery ? `Search Results (${filtered.length})` : "New"}
                </h3>
              </div>
              {!searchQuery && <button className="text-crimson text-xs font-bold shrink-0">View All</button>}
            </div>
            <div className={`grid ${isAppShell ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"} gap-4`}>
              {filtered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  currency={baseCurrency}
                  isAppShell={isAppShell}
                  onOpen={() => {
                    setSelectedId(course.id);
                    setView("course");
                  }}
                />
              ))}
            </div>
          </section>

          {!searchQuery && category === 'all' && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="min-w-0">
                  {!isAppShell && <div className="web-eyebrow mb-2">No cost</div>}
                  <h3 className={`font-bold text-lg ${!isAppShell ? "text-slate-900 web-accent-underline inline-block" : "text-white"}`}>Free Courses</h3>
                </div>
                <button className="text-crimson text-xs font-bold shrink-0">View All</button>
              </div>
              <div className={`grid ${isAppShell ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"} gap-4`}>
                {courses?.filter(c => c.isFree).slice(0, isAppShell ? 4 : 8).map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    currency={baseCurrency}
                    isAppShell={isAppShell}
                    onOpen={() => {
                      setSelectedId(course.id);
                      setView("course");
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {!searchQuery && (
            <AcademyRecommendations
              onOpenCourse={(id) => {
                setSelectedId(id);
                setView("course");
              }}
            />
          )}
        </div>
      </div>

// Removed redundant footer menu to restore GlobalMobileNav functionality.

      {editingId ? (
        <CourseEditorModal
          open={editorOpen}
          courseId={editingId}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      ) : (
        <CoursePublishWizard
          open={editorOpen && useWizard}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function AcademyTrendingCard({ course, onClick }: { course: CourseDTO; onClick: () => void }) {
  const dominantColor = useDominantColor(course.coverUrl);
  const isAppShell = useIsAppShell();
  
  return (
    <div
      className={`shrink-0 snap-start ${isAppShell ? "w-full" : "w-full md:w-[calc(50%-8px)]"} aspect-[16/9] relative rounded-3xl overflow-hidden`}
      style={{ 
        backgroundColor: dominantColor,
        background: `linear-gradient(135deg, ${dominantColor}, rgba(0,0,0,0.8))`
      }}
    >
      <div className="absolute inset-0 flex">
        <div className="flex-1 p-5 md:p-8 flex flex-col justify-center text-white z-10">
          <h4 className="text-xl md:text-2xl lg:text-3xl font-black mb-2 leading-tight line-clamp-3">
            {course.title.length > 50 ? course.title.slice(0, 50) + "..." : course.title}
          </h4>
          <p className="text-xs md:text-sm text-white/80 mb-4 line-clamp-2">
            {course.instructorName || "Learn from industry experts"}
          </p>
          <button
            onClick={onClick}
            className="self-start bg-[#E5484D] hover:bg-[#F35E62] text-white px-5 md:px-6 py-3 md:py-2.5 rounded-full text-xs md:text-sm font-bold active:scale-95 transition-transform shadow-lg"
          >
            Start Now
          </button>
        </div>
        <div className="flex-1 relative min-w-0">
          {course.coverUrl ? (
            <img loading="lazy" decoding="async"
              src={course.coverUrl}
              className="absolute right-0 bottom-0 h-full w-full object-contain object-right"
              alt={course.title}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <GraduationCap className="w-16 h-16 md:w-20 md:h-20 text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent" />
        </div>
      </div>
      <div className="absolute top-3 right-3 md:top-4 md:right-4 bg-white/25 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
        Top Rated
      </div>
    </div>
  );
}

function CourseCard({
  course,
  currency,
  isAppShell,
  onOpen,
}: {
  course: CourseDTO;
  currency: Currency;
  isAppShell: boolean;
  onOpen: () => void;
}) {
  if (isAppShell) {
    return (
      <div className="bg-[#141416] rounded-xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
        <button onClick={onOpen} className="block w-full text-left relative aspect-video bg-[#0A0A0B]">
          {course.coverUrl ? (
            <ResponsiveImage
              src={course.coverUrl}
              alt={course.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-white/10" />
            </div>
          )}
          <div className="absolute top-2 left-2 flex gap-1 items-center">
            <div className="bg-[#E5484D] text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
              {course.category}
            </div>
            {new Date(course.createdAt).getTime() > Date.now() - 1000 * 60 * 60 * 24 * 7 && (
              <div className="bg-emerald-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                New
              </div>
            )}
          </div>
        </button>
        <div className="p-3 flex-1 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-white text-[13px] line-clamp-2 leading-tight mb-2">
              {course.title}
            </h4>
          </div>
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
              <Clock className="w-3 h-3 text-slate-500" /> 6-9 Hours
            </div>
            <div className="text-[11px] text-emerald-400 font-black uppercase">
              {course.isFree ? "Free" : courseDisplayPrice(course, currency).formatted}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="web-card overflow-hidden">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-video bg-gradient-to-br from-emerald-600/40 to-indigo-700/40 overflow-hidden">
          {course.coverUrl ? (
            <ResponsiveImage
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              src={course.coverUrl}
              alt={course.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <GraduationCap className="w-16 h-16 text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/20" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-black border border-white/20 flex items-center justify-center">
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </span>
          </span>
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white border border-white/20 rounded px-2 py-1">
              {course.category}
            </span>
            {course.promoted && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-crimson text-white rounded px-2 py-1">
                <Sparkles className="w-3 h-3 inline mr-1" /> Featured
              </span>
            )}
          </div>
          <div className="absolute top-3 right-3">
            {course.isFree ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-crimson text-white rounded px-2 py-1">
                Free
              </span>
            ) : (
              <span className="text-[11px] font-bold bg-black/60 text-white border border-white/20 rounded px-2 py-1">
                {courseDisplayPrice(course, currency).formatted}
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="p-5 min-w-0">
        <h3 className="text-slate-900 font-black text-lg leading-snug truncate">
          {course.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {course.ownerSlug ? (
            <Link
              to="/profile/$id"
              params={{ id: course.ownerSlug }}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-crimson hover:underline"
            >
              By {course.ownerName || course.instructorName || "Creator"}
            </Link>
          ) : (
            course.instructorName && <span>By {course.instructorName}</span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> {course.level}
          </span>
        </div>
        {course.description && (
          <p className="mt-3 text-sm leading-relaxed line-clamp-2 text-slate-600">
            {course.description}
          </p>
        )}

        <button
          onClick={onOpen}
          className="mt-4 w-full py-2.5 rounded-[10px] bg-crimson hover:bg-crimson/90 text-white font-bold text-sm inline-flex items-center justify-center gap-2"
        >
          {course.isFree ? "Start learning" : "View course"} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

const CourseDetail = ({
  courseId,
  userId,
  isAppShell,
  onBack,
  onEdit,
}: {
  courseId: string;
  userId: string | null;
  isAppShell: boolean;
  onBack: () => void;
  onEdit: (id: string) => void;
}) => {
  const fetchCourse = useServerFn(getCourse);
  const fetchEnroll = useServerFn(getMyEnrollment);
  const enroll = useServerFn(enrollFree);
  const complete = useServerFn(markModuleComplete);
  const uncomplete = useServerFn(unmarkModuleComplete);
  const { baseCurrency } = useOnboarding();

  const [course, setCourse] = useState<CourseWithModulesDTO | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentDTO | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchCourse({ data: { id: courseId } })
      .then(async (c) => {
        setCourse(c);
        if (userId) {
          try {
            console.log("[CourseDetail] Fetching enrollment for course:", courseId);
            const e = await fetchEnroll({ data: { courseId } });
            console.log("[CourseDetail] Enrollment result:", e);
            if (e && typeof e === 'object' && 'id' in e) {
              setEnrollment(e as EnrollmentDTO);
              // Resume: last completed + 1 or 0
              if (c.modules && Array.isArray(c.modules) && c.modules.length > 0) {
                const completedModules = Array.isArray(e.completedModules) ? e.completedModules : [];
                const lastDone = c.modules.findIndex((m) => !completedModules.includes(m.id));
                setActiveIdx(lastDone === -1 ? c.modules.length - 1 : lastDone);
              }
            } else {
              setEnrollment(null);
            }
          } catch (err) {
            console.error("[CourseDetail] Enrollment fetch failed:", err);
            // Non-fatal, just means they might not be enrolled or progress couldn't load
            setEnrollment(null);
          }
        }
      })
      .catch((e) => {
        console.error("[CourseDetail] Fatal load error:", e);
        toast.error("Unable to load course content. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [courseId, userId, fetchCourse, fetchEnroll]);

  const isOwner = useMemo(() => userId && course?.ownerId === userId, [userId, course]);
  const activeModule: ModuleDTO | undefined = useMemo(() => course?.modules[activeIdx], [course, activeIdx]);
  const canWatch = useMemo(() => enrollment || activeModule?.isPreview || isOwner, [enrollment, activeModule, isOwner]);
  const isDone = useMemo(() => activeModule && enrollment?.completedModules.includes(activeModule.id), [activeModule, enrollment]);
  const completedCount = useMemo(() => enrollment?.completedModules.length ?? 0, [enrollment]);
  const totalModules = useMemo(() => course?.modules.length ?? 0, [course]);
  const progressPct = useMemo(() => totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0, [totalModules, completedCount]);
  const isComplete = useMemo(() => enrollment?.completedAt != null, [enrollment]);

  if (loading || !course) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
      </div>
    );
  }

  const doEnroll = async () => {
    if (!userId) {
      window.dispatchEvent(
        new CustomEvent("oventric:auth-required", { detail: { tier: 2, kind: "seller" } }),
      );
      return;
    }
    if (!course.isFree) {
      setCheckoutOpen(true);
      return;
    }
    setBusy(true);
    try {
      const e = await enroll({ data: { courseId } });
      setEnrollment(e);
      toast.success("You're enrolled! Start learning below.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const refetchEnrollment = async () => {
    try {
      const e = await fetchEnroll({ data: { courseId } });
      setEnrollment(e);
    } catch {
      /* not enrolled */
    }
  };

  const toggleComplete = async () => {
    if (!activeModule || !enrollment) return;
    setBusy(true);
    try {
      if (isDone) {
        await uncomplete({ data: { courseId, moduleId: activeModule.id } });
        setEnrollment({
          ...enrollment,
          completedModules: enrollment.completedModules.filter((id) => id !== activeModule.id),
          completedAt: null,
        });
      } else {
        const res = await complete({ data: { courseId, moduleId: activeModule.id } });
        setEnrollment({
          ...enrollment,
          completedModules: [...enrollment.completedModules, activeModule.id],
          completedAt: res.completedAt,
        });
        if (res.completedAt) toast.success("🎉 Course complete!");
        // Auto-advance
        if (activeIdx < totalModules - 1) setActiveIdx(activeIdx + 1);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`max-w-6xl mx-auto w-full px-4 py-4 ${!isAppShell ? "bg-white min-h-screen" : "md:bg-white md:min-h-screen"}`}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={onBack}
          className={`inline-flex items-center gap-2 text-sm rounded-[10px] px-3 py-1.5 border ${!isAppShell ? "text-slate-600 bg-white border-slate-200 hover:text-slate-900" : "text-slate-300 hover:text-white bg-[#1E1E24] border-white/10 md:text-slate-600 md:hover:text-slate-900 md:bg-white md:border-slate-200"}`}
        >
          <ArrowLeft className="w-4 h-4" /> Catalog
        </button>
        {isOwner && (
          <button
            onClick={() => onEdit(course.id)}
            className="ml-auto inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-[10px] px-3 py-1.5"
          >
            <Edit3 className="w-4 h-4" /> Edit course
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          <div className={`border rounded-xl overflow-hidden ${!isAppShell ? "bg-white border-slate-200 shadow-sm" : "bg-[#1E1E24] border-white/10 md:bg-white md:border-slate-200 md:shadow-sm"}`}>
            <div className="aspect-video bg-black relative">
              {activeModule && canWatch ? (
                <iframe
                  key={activeModule.id}
                  src={embedUrl(activeModule)}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={activeModule.title}
                />
              ) : activeModule ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <Lock className="w-10 h-10 mb-2" />
                  <div className="text-sm">Enroll to unlock this module</div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                  <div className="text-sm">No modules yet</div>
                </div>
              )}
            </div>
            <div className="p-5">
              <h1 className={`${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"} font-black text-2xl leading-tight`}>
                {course.title}
              </h1>
              <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                {course.ownerSlug ? (
                  <Link
                    to="/profile/$id"
                    params={{ id: course.ownerSlug }}
                    className="font-semibold text-emerald-500 hover:underline"
                  >
                    By {course.ownerName || course.instructorName || "Creator"}
                  </Link>
                ) : (
                  course.instructorName && <span>By {course.instructorName}</span>
                )}
                <span>{course.category}</span>
                <span>{course.level}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {totalModules} modules
                </span>
              </div>
              {course.description && (
                <p className={`mt-4 text-sm leading-relaxed whitespace-pre-wrap ${!isAppShell ? "text-slate-600" : "text-slate-300 md:text-slate-600"}`}>
                  {course.description}
                </p>
              )}

              {activeModule && (
                <div className={`mt-6 p-4 rounded-[10px] border ${!isAppShell ? "bg-slate-50 border-slate-200" : "bg-[#121214] border-white/10 md:bg-slate-50 md:border-slate-200"}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${!isAppShell ? "text-emerald-600" : "text-emerald-300 md:text-emerald-600"}`}>
                    Module {activeIdx + 1} of {totalModules}
                  </div>
                  <div className={`${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"} font-bold`}>{activeModule.title}</div>
                  {activeModule.description && (
                    <p className={`text-sm mt-2 ${!isAppShell ? "text-slate-600" : "text-slate-400 md:text-slate-600"}`}>
                      {activeModule.description}
                    </p>
                  )}
                  {enrollment && (
                    <button
                      onClick={toggleComplete}
                      disabled={busy}
                      className={`mt-3 inline-flex items-center gap-2 px-4 py-3 rounded-[10px] text-sm font-bold ${
                        isDone
                          ? "bg-emerald-500/10 border border-emerald-500/40 text-emerald-300"
                          : "bg-emerald-500 hover:bg-emerald-400 text-black"
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      {isDone ? "Completed — mark undone" : "Mark as complete"}
                    </button>
                  )}
                </div>
              )}

              {isComplete && (
                <div className="mt-4 p-4 rounded-[10px] bg-emerald-500/10 border border-emerald-500/40 flex items-start gap-3">
                  <Award className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-emerald-200 font-bold">Course complete! 🎉</div>
                    <div className="text-xs text-emerald-300/80 mt-1">
                      Digital certificate generation is coming soon. Your progress is saved.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {!enrollment && !isOwner && (
            <button
              onClick={doEnroll}
              disabled={busy}
              className="w-full py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {course.isFree
                ? "Enroll for free"
                : `Enroll · ${courseDisplayPrice(course, baseCurrency).formatted}`}
            </button>
          )}

          {enrollment && (
            <div className={`p-4 rounded-[10px] border ${!isAppShell ? "bg-white border-slate-200 shadow-sm" : "bg-[#1E1E24] border-white/10 md:bg-white md:border-slate-200 md:shadow-sm"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${!isAppShell ? "text-slate-500" : "text-slate-400 md:text-slate-500"}`}>
                  Your Progress
                </span>
                <span className={`text-xs font-bold ${!isAppShell ? "text-emerald-600" : "text-emerald-300 md:text-emerald-600"}`}>
                  {progressPct}%
                </span>
              </div>
              <div className={`w-full h-1.5 rounded-full overflow-hidden ${!isAppShell ? "bg-slate-200" : "bg-white/5 md:bg-slate-200"}`}>
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {completedCount} of {totalModules} modules complete
              </div>
            </div>
          )}

          <div className={`border rounded-xl overflow-hidden ${!isAppShell ? "bg-white border-slate-200 shadow-sm" : "bg-[#1E1E24] border-white/10 md:bg-white md:border-slate-200 md:shadow-sm"}`}>
            <div className={`px-4 py-3 border-b text-xs font-bold uppercase tracking-wider ${!isAppShell ? "border-slate-200 text-slate-500" : "border-white/10 md:border-slate-200 text-slate-400 md:text-slate-500"}`}>
              Curriculum
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {course.modules.map((m, i) => {
                const done = enrollment?.completedModules.includes(m.id);
                const locked = !enrollment && !m.isPreview && !isOwner;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveIdx(i)}
                    className={`w-full text-left px-4 py-3 border-b flex items-start gap-3 transition-colors ${
                      i === activeIdx
                        ? !isAppShell
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-emerald-500/10 md:bg-emerald-50"
                        : !isAppShell
                          ? "hover:bg-slate-50 border-slate-100"
                          : "hover:bg-white/5 border-white/5 md:hover:bg-slate-50 md:border-slate-100"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : locked ? (
                      <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"}`}>
                        {m.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {m.durationMin > 0 ? `${m.durationMin} min · ` : ""}
                        {m.videoProvider}
                        {m.isPreview && !enrollment && " · preview"}
                      </div>
                    </div>
                  </button>
                );
              })}
              {course.modules.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">No modules yet</div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <CourseCheckoutModal
        open={checkoutOpen}
        course={
          course
            ? {
                id: course.id,
                title: course.title,
                instructorName: course.instructorName,
                priceUSD: course.priceUSD,
                coverUrl: course.coverUrl,
                originalCurrency: course.originalCurrency,
                originalAmount: course.originalAmount,
                fxSnapshot: course.fxSnapshot,
              }
            : null
        }
        onClose={() => setCheckoutOpen(false)}
        onEnrolled={() => {
          setCheckoutOpen(false);
          refetchEnrollment();
        }}
      />
    </div>
  );
}

function AcademyHero({ isAppShell }: { isAppShell: boolean }) {
  if (isAppShell) {
    return (
      <div className="bg-black px-4 pt-2 pb-6 space-y-6">
        {/* Banner Card */}
        <div className="relative overflow-hidden rounded-2xl aspect-[21/9] md:aspect-[21/7] bg-[#1A1A1C] border border-white/5 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent z-10" />
          <img loading="lazy" decoding="async" 
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80" 
            className="absolute inset-0 w-full h-full object-cover opacity-60" 
            alt="Digital Skills"
          />
          <div className="absolute inset-0 p-6 flex flex-col justify-center z-20">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-pink-500/20 text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-3 w-fit">
              <Sparkles className="w-3 h-3" /> Digital Academy
            </div>
            <h1 className="text-2xl font-black text-white leading-tight">
              Unlock Your <br />
              <span className="text-pink-500">Digital Future.</span>
            </h1>
            <p className="text-xs text-white/70 mt-2 font-medium">Learn industry-leading skills today.</p>
          </div>
        </div>

        {/* Info Row */}
        <div className="flex items-center justify-between gap-2 px-1">
          <HeroStat isAppShell={isAppShell} value="100%" label="Online & self-paced" />
          <div className="h-8 w-px bg-white/10" />
          <HeroStat isAppShell={isAppShell} value="Free" label="Courses available" />
          <div className="h-8 w-px bg-white/10" />
          <HeroStat isAppShell={isAppShell} value="Certificate" label="On completion" />
        </div>

        {/* Scrollable Rail */}
        <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4">
          <SlimValueCard
            Icon={Video}
            title="Video-First Delivery"
            img="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80"
          />
          <SlimValueCard
            Icon={RotateCcw}
            title="Auto-Resume Anytime"
            img="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=300&q=80"
          />
          <SlimValueCard
            Icon={ScrollText}
            title="Verified Certificate"
            img="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=300&q=80"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border-b bg-white border-slate-200">
      <div className="max-w-6xl mx-auto w-full px-4 pt-6 pb-10">
        <div className="grid gap-8 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide mb-4 border bg-emerald-50 border-emerald-200 text-emerald-700 uppercase">
              <Sparkles className="w-3.5 h-3.5" /> OVENTRIC ACADEMY
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight tracking-tight text-slate-900">
              Unlock Your <br />
              <span className="text-emerald-600">Digital Future.</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed max-w-xl text-slate-500 font-medium">
              Learn industry-leading skills today from working practitioners. Earn certificates on completion.
            </p>
            <div className="mt-6 flex items-center justify-between gap-2 border-t pt-6 border-slate-100 max-w-sm">
              <HeroStat isAppShell={isAppShell} value="100%" label="Online & self-paced" />
              <div className="h-8 w-px bg-slate-200" />
              <HeroStat isAppShell={isAppShell} value="Free" label="Courses available" />
              <div className="h-8 w-px bg-slate-200" />
              <HeroStat isAppShell={isAppShell} value="Certificate" label="On completion" />
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-1">
            <SlimValueCard
              Icon={Video}
              title="Video-First Delivery"
              img="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80"
            />
            <SlimValueCard
              Icon={RotateCcw}
              title="Auto-Resume Anytime"
              img="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=300&q=80"
            />
            <SlimValueCard
              Icon={ScrollText}
              title="Verified Certificate"
              img="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=300&q=80"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SlimValueCard({ Icon, title, img }: { Icon: any; title: string; img: string }) {
  return (
    <div className="shrink-0 w-40 md:w-full h-24 relative rounded-xl overflow-hidden border border-white/5 md:border-slate-200 shadow-lg group">
      <img loading="lazy" decoding="async" src={img} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={title} />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
      <div className="absolute inset-0 p-3 flex flex-col justify-between">
        <Icon className="w-4 h-4 text-pink-500" />
        <div className="text-[11px] font-bold text-white leading-tight">
          {title}
        </div>
      </div>
    </div>
  );
}


function HeroStat({ isAppShell, value, label }: { isAppShell: boolean; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center md:items-start">
      <div className={`text-lg md:text-xl font-black ${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"}`}>{value}</div>
      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{label}</div>
    </div>
  );
}

function ValueCard({
  isAppShell,
  Icon,
  title,
  body,
}: {
  isAppShell: boolean;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className={`p-5 rounded-xl border transition-all ${!isAppShell ? "bg-white border-slate-200 shadow-sm hover:shadow-md" : "bg-[#141416] border-white/5 md:bg-white md:border-slate-200 md:shadow-sm md:hover:shadow-md"} flex gap-4`}>
      <div className={`w-12 h-12 shrink-0 rounded-[10px] border flex items-center justify-center ${!isAppShell ? "bg-[#E5484D]/5 border-[#E5484D]/10" : "bg-[#E5484D]/10 border-[#E5484D]/20 md:bg-[#E5484D]/5 md:border-[#E5484D]/10"}`}>
        <Icon className={`w-5 h-5 ${!isAppShell ? "text-[#E5484D]" : "text-[#E5484D] md:text-[#E5484D]"}`} />
      </div>
      <div className="min-w-0">
        <h3 className={`font-black uppercase tracking-tight text-sm mb-1 ${!isAppShell ? "text-slate-900" : "text-white md:text-slate-900"}`}>{title}</h3>
        <p className={`text-xs leading-relaxed ${!isAppShell ? "text-slate-600" : "text-slate-400 md:text-slate-600"}`}>{body}</p>
      </div>
    </div>
  );
}

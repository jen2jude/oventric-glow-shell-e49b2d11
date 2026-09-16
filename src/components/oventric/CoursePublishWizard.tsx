import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Loader2,
  Plus,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Video,
  FileText,
  FileType2,
  GripVertical,
  Award,
  Rocket,
  Save,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveCourseWizard,
  getCourseCoverUploadUrl,
  getCourseMediaUploadUrl,
  type CourseCategory,
  type CourseLevel,
  type LessonType,
  type WizardSectionInput,
  type WizardQuizInput,
} from "@/lib/academy.functions";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { currencySymbol, usdRate } from "@/lib/fx-display";
import { supabase } from "@/integrations/supabase/client";
import { useIsAppShell } from "@/hooks/use-launch-context";

const CATEGORIES: { key: CourseCategory; label: string }[] = [
  { key: "frontend", label: "Frontend Dev" },
  { key: "uiux", label: "UI/UX Design" },
  { key: "ai", label: "AI Prompting" },
  { key: "backend", label: "Backend & DB" },
  { key: "security", label: "Cybersecurity" },
];
const LEVELS: { key: CourseLevel; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];
const CERT_TEMPLATES = [
  { key: "classic", label: "Classic" },
  { key: "modern", label: "Modern" },
  { key: "neon", label: "Neon" },
];

type Step = 0 | 1 | 2 | 3 | 4;
const STEPS = ["Basics", "Curriculum", "Quizzes", "Settings", "Review"] as const;

interface Section extends WizardSectionInput {
  id: string;
}
interface Quiz extends WizardQuizInput {
  id: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function CoursePublishWizard({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const save = useServerFn(saveCourseWizard);
  const getUpload = useServerFn(getCourseCoverUploadUrl);
  const snapshotFx = useServerFn(snapshotFxRates);
  const { homeCurrency } = useOnboarding();
  const isAppShell = useIsAppShell();

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState<null | "draft" | "publish">(null);
  const [confetti, setConfetti] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Step 1 — Basics
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [longDesc, setLongDesc] = useState("");
  const [category, setCategory] = useState<CourseCategory>("frontend");
  const [level, setLevel] = useState<CourseLevel>("beginner");

  // Step 2 — Curriculum
  const [sections, setSections] = useState<Section[]>([
    { id: uid(), title: "Module 1: Introduction", lessons: [] },
  ]);

  // Step 3 — Quizzes
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  // Step 4 — Settings
  const [isFree, setIsFree] = useState(true);
  const [priceLocal, setPriceLocal] = useState(0);
  const [requireLinear, setRequireLinear] = useState(false);
  const [issueCertificate, setIssueCertificate] = useState(false);
  const [certificateTemplate, setCertificateTemplate] = useState<string>("classic");

  useEffect(() => {
    if (!open) {
      setStep(0);
      setConfetti(false);
    }
  }, [open]);

  const totalLessons = useMemo(
    () => sections.reduce((n, s) => n + s.lessons.length, 0),
    [sections],
  );

  const canGoNext = () => {
    if (step === 0) return title.trim().length >= 3;
    if (step === 1) return totalLessons > 0;
    return true;
  };

  const handleCoverUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Cover must be under 5MB");
    setUploading(true);
    try {
      const { path, token } = await getUpload({ data: { filename: file.name } });
      const { error } = await supabase.storage
        .from("course-covers")
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("course-covers")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      setCoverPath(path);
      setCoverPreview(signed?.signedUrl ?? null);
      toast.success("Cover uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = async (publish: boolean) => {
    let priceUSD = 0;
    let originalAmount = priceLocal;
    let fxSnapshot: Awaited<ReturnType<typeof snapshotFx>> | null = null;
    if (!isFree) {
      fxSnapshot = await snapshotFx();
      const rate = fxSnapshot.rates[homeCurrency] ?? usdRate(homeCurrency);
      priceUSD =
        homeCurrency === "USD" ? priceLocal : Number((priceLocal / (rate || 1)).toFixed(2));
      originalAmount = priceLocal;
    }
    return {
      title,
      subtitle,
      description: subtitle, // short description mirrors subtitle
      longDescription: longDesc,
      category,
      level,
      coverPath,
      sections: sections.map((s) => ({
        title: s.title,
        lessons: s.lessons,
      })),
      quizzes: quizzes.map((q) => ({
        title: q.title,
        passingGrade: q.passingGrade,
        questions: q.questions,
      })),
      isFree,
      priceUSD,
      originalCurrency: homeCurrency,
      originalAmount,
      fxSnapshot,
      requireLinear,
      issueCertificate,
      certificateTemplate: issueCertificate ? certificateTemplate : null,
      isPublished: publish,
    };
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) return toast.error("Title required");
    if (publish && totalLessons === 0) return toast.error("Add at least one lesson to publish");
    if (!isFree && !(priceLocal > 0)) return toast.error("Set a price or mark the course as free");
    setSaving(publish ? "publish" : "draft");
    try {
      const payload = await buildPayload(publish);
      const res = await save({ data: payload });
      toast.success(publish ? "Course published" : "Draft saved");
      if (publish) {
        setConfetti(true);
        setTimeout(() => {
          onSaved?.(res.id);
          onClose();
        }, 1400);
      } else {
        onSaved?.(res.id);
        onClose();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  if (!open) return null;

  const body = (
    <div
      className={`modal-light fixed inset-0 z-[70] flex ${
        isAppShell ? "items-end" : "items-center justify-center p-2 sm:p-6"
      }`}
    >
      <div className="absolute inset-0 bg-create-overlay" onClick={isAppShell ? undefined : onClose} />
      <div
        className={`relative flex w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-xl ${
          isAppShell
            ? "max-h-[92dvh] rounded-t-[10px]"
            : "max-w-5xl max-h-[95vh] rounded-[10px]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-white shrink-0 backdrop-blur-md">
          <div className="flex-1" />
          <div className="text-center">
            <h2 className="text-lg font-black text-slate-900">Publish a Course</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </p>
          </div>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="grid min-h-11 min-w-11 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close course publisher"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`border-b border-slate-200 shrink-0 ${isAppShell ? "px-4 py-3" : "px-4 sm:px-5 py-3"}`}>
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const upcoming = i > step;
              const isLast = i === STEPS.length - 1;

              return (
                <div key={s} className="flex-1 flex items-center">
                  <button
                    onClick={() => i <= step && setStep(i as Step)}
                    disabled={upcoming}
                    className={`relative flex flex-col items-center justify-center gap-1.5 w-full transition-all duration-300 ${
                      upcoming ? "cursor-default opacity-50" : "cursor-pointer"
                    }`}
                  >
                    <div
                      className={`relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full grid place-items-center text-xs font-bold transition-all duration-300 ${
                        active
                          ? "bg-[#E5484D] text-white shadow-[0_0_15px_rgba(229,72,77,0.4)] scale-110"
                          : done
                            ? "bg-[#E5484D] text-white"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className={active ? "text-slate-900" : "text-slate-500"}>{i + 1}</span>
                      )}
                    </div>
                    {!isAppShell && (
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-tighter transition-colors duration-300 ${
                          active ? "text-[#E5484D]" : done ? "text-slate-700" : "text-slate-500"
                        }`}
                      >
                        {s}
                      </span>
                    )}
                  </button>

                  {!isLast && (
                    <div className="flex-1 h-[2px] mx-1 sm:mx-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-[#E5484D] transition-[width] duration-500 ease-out"
                        style={{ width: done ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${isAppShell ? "p-5 pb-24" : "p-4 sm:p-6"}`}>
          {step === 0 && (
            <BasicsStep
              isAppShell={isAppShell}
              title={title}
              setTitle={setTitle}
              subtitle={subtitle}
              setSubtitle={setSubtitle}
              longDesc={longDesc}
              setLongDesc={setLongDesc}
              category={category}
              setCategory={setCategory}
              level={level}
              setLevel={setLevel}
              coverPreview={coverPreview}
              coverPath={coverPath}
              uploading={uploading}
              onCoverUpload={handleCoverUpload}
            />
          )}
          {step === 1 && <CurriculumStep isAppShell={isAppShell} sections={sections} setSections={setSections} />}
          {step === 2 && <QuizzesStep isAppShell={isAppShell} quizzes={quizzes} setQuizzes={setQuizzes} />}
          {step === 3 && (
            <SettingsStep
              isAppShell={isAppShell}
              isFree={isFree}
              setIsFree={setIsFree}
              priceLocal={priceLocal}
              setPriceLocal={setPriceLocal}
              homeCurrency={homeCurrency}
              requireLinear={requireLinear}
              setRequireLinear={setRequireLinear}
              issueCertificate={issueCertificate}
              setIssueCertificate={setIssueCertificate}
              certificateTemplate={certificateTemplate}
              setCertificateTemplate={setCertificateTemplate}
            />
          )}
          {step === 4 && (
            <ReviewStep
              isAppShell={isAppShell}
              title={title}
              subtitle={subtitle}
              sections={sections}
              quizzes={quizzes}
              isFree={isFree}
              priceLocal={priceLocal}
              homeCurrency={homeCurrency}
              requireLinear={requireLinear}
              issueCertificate={issueCertificate}
              certificateTemplate={certificateTemplate}
              totalLessons={totalLessons}
            />
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between gap-2 border-t border-slate-200 shrink-0 ${
            isAppShell
              ? "fixed bottom-0 left-0 right-0 z-20 rounded-t-[10px] border-t border-slate-200 bg-white p-4 backdrop-blur-xl"
              : "bg-white p-4 backdrop-blur-sm"
          }`}
        >
          <button
            onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}
            disabled={step === 0 || saving !== null}
            className={`inline-flex items-center gap-1 rounded-[10px] text-sm text-slate-700 disabled:opacity-40 transition-all ${
              isAppShell
                ? "px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 font-bold"
                : "px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200"
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-center gap-3">
            {step === 4 ? (
              <>
                {!isAppShell && (
                  <button
                    onClick={() => handleSave(false)}
                    disabled={saving !== null}
                    className="inline-flex items-center gap-2 rounded-[10px] bg-white hover:bg-slate-50 border border-slate-200 text-sm text-slate-700 px-4 py-2.5 transition-all disabled:opacity-40"
                  >
                    {saving === "draft" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save as Draft
                  </button>
                )}
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving !== null || totalLessons === 0 || !title.trim()}
                  className={`inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] hover:bg-[#E5484D]/90 text-white text-sm font-black shadow-[0_4px_15px_rgba(229,72,77,0.3)] transition-all disabled:opacity-40 ${
                    isAppShell ? "px-6 py-3.5" : "px-5 py-2.5"
                  }`}
                >
                  {saving === "publish" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  Publish Course
                </button>
              </>
            ) : (
              <button
                onClick={() => canGoNext() && setStep((s) => Math.min(4, s + 1) as Step)}
                disabled={!canGoNext()}
                className={`inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] hover:bg-[#E5484D]/90 text-white text-sm font-black shadow-[0_4px_15px_rgba(229,72,77,0.3)] transition-all disabled:opacity-40 ${
                  isAppShell ? "px-6 py-3.5" : "px-5 py-2.5"
                }`}
              >
                Save & Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {confetti && <ConfettiOverlay />}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

/* -------------------- STEPS -------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase text-slate-600 mb-1.5">
      {children}
    </div>
  );
}
const inputCls =
  "w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-600 outline-hidden transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500/30";

function BasicsStep(props: {
  isAppShell: boolean;
  title: string;
  setTitle: (v: string) => void;
  subtitle: string;
  setSubtitle: (v: string) => void;
  longDesc: string;
  setLongDesc: (v: string) => void;
  category: CourseCategory;
  setCategory: (v: CourseCategory) => void;
  level: CourseLevel;
  setLevel: (v: CourseLevel) => void;
  coverPreview: string | null;
  coverPath: string | null;
  uploading: boolean;
  onCoverUpload: (file: File) => void;
}) {
  const {
    isAppShell,
    title,
    setTitle,
    subtitle,
    setSubtitle,
    longDesc,
    setLongDesc,
    category,
    setCategory,
    level,
    setLevel,
    coverPreview,
    coverPath,
    uploading,
    onCoverUpload,
  } = props;
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Label>Course Title *</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Mastering React Server Components"
          className={inputCls}
        />
      </div>
      <div>
        <Label>Subtitle / Short Description</Label>
        <textarea
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          rows={2}
          placeholder="One-line hook shown on the catalog card"
          className={`${inputCls} resize-none`}
        />
      </div>
      <div>
        <Label>Long Description</Label>
        <textarea
          value={longDesc}
          onChange={(e) => setLongDesc(e.target.value)}
          rows={6}
          placeholder="Deep dive: what learners will build, prerequisites, outcomes…"
          className={`${inputCls} resize-none`}
        />
        <p className="text-[11px] text-slate-500 mt-1">Markdown supported when rendered.</p>
      </div>
      <div>
        <Label>Course Thumbnail (up to 5MB)</Label>
        {isAppShell ? (
          <label className="cursor-pointer block relative w-full aspect-[16/9] rounded-[10px] bg-slate-50 border border-dashed border-slate-200 overflow-hidden group transition-all hover:border-[#E5484D]/30">
            {coverPreview ? (
              <img loading="lazy" decoding="async" src={coverPreview} alt="cover" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                <div className="w-16 h-16 rounded-full bg-white border border-slate-200 grid place-items-center transition-colors group-hover:bg-[#E5484D]/10 group-hover:text-[#E5484D]">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <span className="block text-sm font-bold text-slate-900 mb-1">{uploading ? "Uploading…" : "Upload Course Thumbnail"}</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">Recommended: 16:9 ratio</span>
                </div>
              </div>
            )}
            {coverPreview && (
              <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-slate-950/75 text-slate-900 text-[11px] font-black uppercase tracking-widest backdrop-blur-md border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? "Uploading…" : "Change Cover"}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && onCoverUpload(e.target.files[0])}
            />
          </label>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-40 h-24 rounded-xl bg-slate-100 border border-slate-200 grid place-items-center overflow-hidden">
              {coverPreview ? (
                <img loading="lazy" decoding="async" src={coverPreview} alt="cover" className="w-full h-full object-cover" />
              ) : (
                <FileType2 className="w-8 h-8 text-slate-600" />
              )}
            </div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-[10px] bg-white hover:bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 transition-all">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading…" : coverPath ? "Replace Thumbnail" : "Upload Thumbnail"}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && onCoverUpload(e.target.files[0])}
              />
            </label>
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <Label>Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CourseCategory)}
            className={inputCls}
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Difficulty Level</Label>
          <div className="flex gap-2 p-1 rounded-[12px] bg-slate-100 border border-slate-200">
            {LEVELS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLevel(l.key)}
                className={`flex-1 px-3 py-2.5 rounded-[10px] text-xs font-bold uppercase tracking-tight transition-all ${
                  level === l.key 
                    ? "bg-[#E5484D] text-white shadow-[0_4px_10px_rgba(229,72,77,0.25)]" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CurriculumStep({
  isAppShell,
  sections,
  setSections,
}: {
  isAppShell: boolean;
  sections: Section[];
  setSections: (s: Section[]) => void;
}) {
  const addSection = () => {
    setSections([...sections, { id: uid(), title: `Module ${sections.length + 1}`, lessons: [] }]);
  };
  const updateSection = (id: string, patch: Partial<Section>) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeSection = (id: string) => {
    if (!confirm("Delete this section and its lessons?")) return;
    setSections(sections.filter((s) => s.id !== id));
  };
  const addLesson = (sectionId: string) => {
    updateSection(sectionId, {
      lessons: [
        ...(sections.find((s) => s.id === sectionId)?.lessons ?? []),
        {
          title: "New Lesson",
          type: "video",
          isPreview: false,
          durationMin: 0,
          content: { url: "" },
        },
      ],
    });
  };
  const updateLesson = (
    sectionId: string,
    idx: number,
    patch: Partial<Section["lessons"][number]>,
  ) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const next = section.lessons.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    updateSection(sectionId, { lessons: next });
  };
  const removeLesson = (sectionId: string, idx: number) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, { lessons: section.lessons.filter((_, i) => i !== idx) });
  };

  return (
    <div className={`space-y-4 max-w-3xl ${isAppShell ? "pb-4" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Organise your course into sections. Each section can hold video, text, or PDF lessons.
        </p>
        <button
          onClick={addSection}
          className={`inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] hover:bg-[#E5484D]/90 text-white font-black shrink-0 transition-all ${
            isAppShell ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs"
          }`}
        >
          <Plus className="w-4 h-4" /> Add Section
        </button>
      </div>

      {sections.length === 0 && (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-[10px] bg-slate-50 text-slate-500 text-sm">
          No sections yet. Add your first module to get started.
        </div>
      )}

      {sections.map((section, sIdx) => (
        <div
          key={section.id}
          className="rounded-[10px] bg-slate-100 border border-slate-200 p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white border border-slate-200 rounded-lg cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-slate-500" />
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">M{sIdx + 1}</span>
            <input
              value={section.title}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
              className="flex-1 bg-transparent border-b border-slate-200 focus:border-red-500 outline-hidden text-slate-900 font-bold text-sm px-1 py-1.5 transition-all"
            />
            <button
              onClick={() => removeSection(section.id)}
              className="p-2 rounded-lg hover:bg-red-500/100/10 text-red-500/60 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {section.lessons.map((lesson, lIdx) => (
              <LessonRow
                key={lIdx}
                lesson={lesson}
                onChange={(patch) => updateLesson(section.id, lIdx, patch)}
                onRemove={() => removeLesson(section.id, lIdx)}
              />
            ))}
            <button
              onClick={() => addLesson(section.id)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] bg-white hover:bg-slate-50 border border-dashed border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider transition-all"
            >
              <Plus className="w-4 h-4" /> Add Lesson
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LessonRow({
  lesson,
  onChange,
  onRemove,
}: {
  lesson: Section["lessons"][number];
  onChange: (patch: Partial<Section["lessons"][number]>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = lesson.type === "text" ? FileText : lesson.type === "pdf" ? FileType2 : Video;
  return (
    <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-200">
      <div className="flex items-center gap-3 p-3">
        <div className="p-2 rounded-lg bg-red-50">
          <Icon className="w-4 h-4 text-[#E5484D] shrink-0" />
        </div>
        <input
          value={lesson.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="flex-1 bg-transparent outline-hidden text-slate-900 text-sm font-bold px-1"
          placeholder="Lesson title"
        />
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[10px] font-black uppercase tracking-widest text-[#E5484D] hover:text-[#E5484D]/80 px-3 py-1.5 rounded-lg hover:bg-[#E5484D]/5 transition-all"
        >
          {open ? "Close" : "Edit"}
        </button>
        <button onClick={onRemove} className="p-2 rounded-lg hover:bg-red-500/100/10 text-red-500/60 hover:text-red-500 transition-all">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="p-4 pt-2 space-y-4 border-t border-slate-200 bg-slate-50">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Lesson Type</Label>
              <select
                value={lesson.type}
                onChange={(e) => {
                  const t = e.target.value as LessonType;
                  onChange({
                    type: t,
                    content:
                      t === "video" ? { url: "" } : t === "text" ? { html: "" } : { url: "" },
                  });
                }}
                className={inputCls}
              >
                <option value="video">Video</option>
                <option value="text">Text / HTML</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div>
              <Label>Duration (min)</Label>
              <input
                type="number"
                min={0}
                value={lesson.durationMin ?? 0}
                onChange={(e) => onChange({ durationMin: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <label className="flex items-end gap-3 pb-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={Boolean(lesson.isPreview)}
                onChange={(e) => onChange({ isPreview: e.target.checked })}
                className="w-5 h-5 rounded-[6px] border-slate-200 bg-white checked:bg-[#E5484D] accent-[#E5484D] transition-all"
              />
              <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Free preview lesson</span>
            </label>
          </div>
          {lesson.type === "video" && <VideoLessonEditor lesson={lesson} onChange={onChange} />}
          {lesson.type === "text" && (
            <div>
              <Label>Lesson Body (rich text)</Label>
              <RichTextEditor
                appearance="dark"
                value={String(lesson.content?.html ?? "")}
                onChange={(html) => onChange({ content: { ...lesson.content, html } })}
                placeholder="Write full lesson notes. Insert images and screenshots inline."
              />
            </div>
          )}
          {lesson.type === "pdf" && (
            <div>
              <Label>PDF URL</Label>
              <input
                value={String(lesson.content?.url ?? "")}
                onChange={(e) => onChange({ content: { ...lesson.content, url: e.target.value } })}
                placeholder="https://…/lesson.pdf"
                className={inputCls}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VideoLessonEditor({
  lesson,
  onChange,
}: {
  lesson: Section["lessons"][number];
  onChange: (patch: Partial<Section["lessons"][number]>) => void;
}) {
  const getUpload = useServerFn(getCourseMediaUploadUrl);
  const [uploading, setUploading] = useState(false);
  const videoPath =
    typeof lesson.content?.video_path === "string" ? (lesson.content.video_path as string) : "";
  const url = String(lesson.content?.url ?? "");
  const body = String(lesson.content?.body ?? "");

  const upload = async (file: File) => {
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) return toast.error("Video must be ≤ 500 MB");
    setUploading(true);
    try {
      const { path, signedUrl } = await getUpload({ data: { filename: file.name, kind: "video" } });
      const res = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "video/mp4" },
      });
      if (!res.ok) throw new Error("Upload failed");
      onChange({ content: { ...lesson.content, video_path: path } });
      toast.success("Video uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Video URL (YouTube or Vimeo)</Label>
        <input
          value={url}
          onChange={(e) => onChange({ content: { ...lesson.content, url: e.target.value } })}
          placeholder="https://youtu.be/… or https://vimeo.com/…"
          className={inputCls}
        />
      </div>
      <div>
        <Label>Or upload a video file (≤ 500 MB)</Label>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 px-4 py-3 rounded-[10px] bg-white hover:bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading…" : videoPath ? "Replace Video" : "Choose Video"}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
          </label>
          {videoPath && (
            <button
              type="button"
              onClick={() => onChange({ content: { ...lesson.content, video_path: null } })}
              className="text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-all"
            >
              Remove Upload
            </button>
          )}
        </div>
      </div>
      <div>
        <Label>Module Body (rich text)</Label>
        <RichTextEditor
          appearance="dark"
          value={body}
          onChange={(html) => onChange({ content: { ...lesson.content, body: html } })}
          placeholder="Add full written notes, screenshots, or images to accompany the video."
        />
      </div>
    </div>
  );
}

function QuizzesStep({
  isAppShell,
  quizzes,
  setQuizzes,
}: {
  isAppShell: boolean;
  quizzes: Quiz[];
  setQuizzes: (q: Quiz[]) => void;
}) {
  const addQuiz = () => {
    setQuizzes([
      ...quizzes,
      { id: uid(), title: `Quiz ${quizzes.length + 1}`, passingGrade: 80, questions: [] },
    ]);
  };
  const updateQuiz = (id: string, patch: Partial<Quiz>) => {
    setQuizzes(quizzes.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };
  const removeQuiz = (id: string) => setQuizzes(quizzes.filter((q) => q.id !== id));
  const addQuestion = (quizId: string) => {
    const q = quizzes.find((x) => x.id === quizId);
    if (!q) return;
    updateQuiz(quizId, {
      questions: [
        ...q.questions,
        {
          text: "New question",
          type: "multiple",
          options: [
            { text: "Option A", correct: true },
            { text: "Option B", correct: false },
          ],
        },
      ],
    });
  };
  const updateQuestion = (
    quizId: string,
    idx: number,
    patch: Partial<Quiz["questions"][number]>,
  ) => {
    const q = quizzes.find((x) => x.id === quizId);
    if (!q) return;
    updateQuiz(quizId, {
      questions: q.questions.map((qq, i) => (i === idx ? { ...qq, ...patch } : qq)),
    });
  };
  const removeQuestion = (quizId: string, idx: number) => {
    const q = quizzes.find((x) => x.id === quizId);
    if (!q) return;
    updateQuiz(quizId, { questions: q.questions.filter((_, i) => i !== idx) });
  };

  return (
    <div className={`space-y-4 max-w-3xl ${isAppShell ? "pb-4" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Quizzes are optional. Add one to the end of the course to gate certificates.
        </p>
        <button
          onClick={addQuiz}
          className={`inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] hover:bg-[#E5484D]/90 text-white font-black shrink-0 transition-all ${
            isAppShell ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs"
          }`}
        >
          <Plus className="w-4 h-4" /> Add Quiz
        </button>
      </div>

      {quizzes.length === 0 && (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-[10px] bg-slate-50 text-slate-500 text-sm">
          No quizzes added. You can skip this step or add one to test learners.
        </div>
      )}

      {quizzes.map((quiz) => (
        <div key={quiz.id} className="rounded-[10px] bg-slate-100 border border-slate-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <input
              value={quiz.title}
              onChange={(e) => updateQuiz(quiz.id, { title: e.target.value })}
              className="flex-1 bg-transparent border-b border-slate-200 focus:border-red-500 outline-hidden text-slate-900 font-bold text-sm px-1 py-1.5 transition-all"
            />
            <button
              onClick={() => removeQuiz(quiz.id)}
              className="p-2 rounded-lg hover:bg-red-500/100/10 text-red-500/60 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div>
            <Label>Passing Grade: {quiz.passingGrade}%</Label>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={quiz.passingGrade}
              onChange={(e) => updateQuiz(quiz.id, { passingGrade: Number(e.target.value) })}
              className="w-full accent-[#E5484D] cursor-pointer"
            />
          </div>
          <div className="space-y-3">
            {quiz.questions.map((q, qIdx) => (
              <QuestionCard
                key={qIdx}
                question={q}
                onChange={(patch) => updateQuestion(quiz.id, qIdx, patch)}
                onRemove={() => removeQuestion(quiz.id, qIdx)}
              />
            ))}
            <button
              onClick={() => addQuestion(quiz.id)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] bg-white hover:bg-slate-50 border border-dashed border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider transition-all"
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuestionCard({
  question,
  onChange,
  onRemove,
}: {
  question: Quiz["questions"][number];
  onChange: (patch: Partial<Quiz["questions"][number]>) => void;
  onRemove: () => void;
}) {
  const setOptions = (opts: { text: string; correct: boolean }[]) => onChange({ options: opts });
  const setCorrect = (idx: number) => {
    setOptions(question.options.map((o, i) => ({ ...o, correct: i === idx })));
  };
  const setType = (t: "multiple" | "boolean") => {
    if (t === "boolean") {
      onChange({
        type: t,
        options: [
          { text: "True", correct: true },
          { text: "False", correct: false },
        ],
      });
    } else {
      onChange({
        type: t,
        options: [
          { text: "Option A", correct: true },
          { text: "Option B", correct: false },
        ],
      });
    }
  };
  return (
    <div className="rounded-[12px] bg-white border border-slate-200 p-4 space-y-4 shadow-sm">
      <div className="flex items-center gap-3">
        <input
          value={question.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className="flex-1 bg-transparent border-b border-slate-200 focus:border-red-500 outline-hidden text-slate-900 font-bold text-sm px-1 py-1.5 transition-all"
          placeholder="Question text"
        />
        <select
          value={question.type}
          onChange={(e) => setType(e.target.value as "multiple" | "boolean")}
          className={inputCls + " max-w-[150px] !py-2.5 !px-3"}
        >
          <option value="multiple">Multiple Choice</option>
          <option value="boolean">True / False</option>
        </select>
        <button onClick={onRemove} className="p-2 rounded-lg hover:bg-red-500/100/10 text-red-500/60 hover:text-red-500 transition-all">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        {question.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              checked={o.correct}
              onChange={() => setCorrect(i)}
              className="w-4 h-4 accent-[#E5484D] cursor-pointer"
            />
            <input
              value={o.text}
              onChange={(e) =>
                setOptions(
                  question.options.map((op, idx) =>
                    idx === i ? { ...op, text: e.target.value } : op,
                  ),
                )
              }
              className="flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-hidden transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
            />
            {question.type === "multiple" && question.options.length > 2 && (
              <button
                onClick={() => setOptions(question.options.filter((_, idx) => idx !== i))}
                className="p-1 rounded hover:bg-red-500/100/10 text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {question.type === "multiple" && (
          <button
            onClick={() =>
              setOptions([
                ...question.options,
                {
                  text: `Option ${String.fromCharCode(65 + question.options.length)}`,
                  correct: false,
                },
              ])
            }
            className="text-[10px] font-black uppercase tracking-widest text-[#E5484D] hover:text-[#E5484D]/80 px-2 py-1 transition-all"
          >
            + Add Option
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsStep(props: {
  isAppShell: boolean;
  isFree: boolean;
  setIsFree: (v: boolean) => void;
  priceLocal: number;
  setPriceLocal: (v: number) => void;
  homeCurrency: Currency;
  requireLinear: boolean;
  setRequireLinear: (v: boolean) => void;
  issueCertificate: boolean;
  setIssueCertificate: (v: boolean) => void;
  certificateTemplate: string;
  setCertificateTemplate: (v: string) => void;
}) {
  const {
    isAppShell,
    isFree,
    setIsFree,
    priceLocal,
    setPriceLocal,
    homeCurrency,
    requireLinear,
    setRequireLinear,
    issueCertificate,
    setIssueCertificate,
    certificateTemplate,
    setCertificateTemplate,
  } = props;
  return (
    <div className={`space-y-6 max-w-3xl ${isAppShell ? "pb-4" : ""}`}>
      <section className="rounded-[10px] bg-slate-100 border border-slate-200 p-5 space-y-4 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Access Control</div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsFree(true)}
            className={`flex-1 rounded-[12px] border font-black uppercase tracking-tight transition-all ${
              isAppShell ? "px-5 py-3.5 text-base" : "px-4 py-3 text-sm"
            } ${isFree 
              ? "bg-[#E5484D]/10 border-[#E5484D]/50 text-[#E5484D] shadow-[0_4px_12px_rgba(229,72,77,0.15)]" 
              : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
          >
            Free
          </button>
          <button
            onClick={() => setIsFree(false)}
            className={`flex-1 rounded-[12px] border font-black uppercase tracking-tight transition-all ${
              isAppShell ? "px-5 py-3.5 text-base" : "px-4 py-3 text-sm"
            } ${!isFree 
              ? "bg-[#E5484D]/10 border-[#E5484D]/50 text-[#E5484D] shadow-[0_4px_12px_rgba(229,72,77,0.15)]" 
              : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
          >
            Paid
          </button>
        </div>
        {!isFree && (
          <div>
            <Label>
              Price ({currencySymbol(homeCurrency)} {homeCurrency}) · locked at publish
            </Label>
            <input
              type="number"
              min={0}
              step={1}
              value={priceLocal}
              onChange={(e) => setPriceLocal(Number(e.target.value))}
              className={`${inputCls} ${isAppShell ? "py-3 text-base" : ""}`}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Buyers in other currencies see the equivalent locked at publish time.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-[10px] bg-slate-100 border border-slate-200 p-5 space-y-4 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Completion Rules</div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={requireLinear}
            onChange={(e) => setRequireLinear(e.target.checked)}
            className="h-5 w-5 rounded-[6px] border-slate-200 bg-white accent-red-600"
          />
          <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
            Require linear progression{" "}
            <span className="text-slate-500 font-normal">
              (learners must finish lesson 1 before seeing lesson 2)
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-[10px] bg-slate-100 border border-slate-200 p-5 space-y-4 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <Award className="w-4 h-4 text-[#E5484D]" /> Certificate
        </div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={issueCertificate}
            onChange={(e) => setIssueCertificate(e.target.checked)}
            className="h-5 w-5 rounded-[6px] border-slate-200 bg-white accent-red-600"
          />
          <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Issue certificate on completion</span>
        </label>
        {issueCertificate && (
          <div>
            <Label>Certificate template</Label>
            <select
              value={certificateTemplate}
              onChange={(e) => setCertificateTemplate(e.target.value)}
              className={inputCls}
            >
              {CERT_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewStep(props: {
  isAppShell: boolean;
  title: string;
  subtitle: string;
  sections: Section[];
  quizzes: Quiz[];
  isFree: boolean;
  priceLocal: number;
  homeCurrency: Currency;
  requireLinear: boolean;
  issueCertificate: boolean;
  certificateTemplate: string;
  totalLessons: number;
}) {
  const {
    isAppShell,
    title,
    subtitle,
    sections,
    quizzes,
    isFree,
    priceLocal,
    homeCurrency,
    requireLinear,
    issueCertificate,
    certificateTemplate,
    totalLessons,
  } = props;
  const missing: string[] = [];
  if (!title.trim()) missing.push("Course title");
  if (totalLessons === 0) missing.push("At least one lesson");
  return (
    <div className="space-y-4 max-w-3xl">
      {missing.length > 0 && (
        <div className="p-3 rounded-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-800 text-sm">
          Fix before publishing: {missing.join(", ")}.
        </div>
      )}
      <div className="rounded-[10px] bg-slate-100 border border-slate-200 p-6 shadow-sm">
        <div className="text-2xl font-black text-slate-900">{title || "Untitled Course"}</div>
        {subtitle && <div className="text-sm text-slate-600 mt-2 leading-relaxed">{subtitle}</div>}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <Stat label="Sections" value={sections.length} />
          <Stat label="Lessons" value={totalLessons} />
          <Stat label="Quizzes" value={quizzes.length} />
          <Stat
            label="Price"
            value={isFree ? "Free" : `${currencySymbol(homeCurrency)}${priceLocal}`}
          />
        </div>
        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Configuration</div>
          <div className="text-xs text-slate-700 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${requireLinear ? "bg-[#E5484D]" : "bg-slate-600"}`} />
            Linear progression: <span className="text-slate-900 font-bold">{requireLinear ? "Active" : "Disabled"}</span>
          </div>
          <div className="text-xs text-slate-700 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${issueCertificate ? "bg-[#E5484D]" : "bg-slate-600"}`} />
            Certificate: <span className="text-slate-900 font-bold">{issueCertificate ? `Active (${certificateTemplate})` : "Disabled"}</span>
          </div>
        </div>
      </div>
      <div className="rounded-[10px] bg-slate-100 border border-slate-200 p-6 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between">
          Curriculum Preview
          <span className="text-slate-600 font-normal">{totalLessons} total lessons</span>
        </div>
        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={s.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="text-[#E5484D] opacity-60">M{i + 1}</span>
                {s.title || "Untitled Section"}
              </div>
              <ul className="mt-3 space-y-2 ml-2 border-l border-slate-200 pl-4">
                {s.lessons.map((l, j) => (
                  <li key={j} className="text-xs text-slate-600 flex items-center gap-2 group">
                    <span className="text-slate-700 font-bold w-6">
                      {i + 1}.{j + 1}
                    </span>{" "}
                    <span className="group-hover:text-slate-900 transition-colors flex-1">{l.title || "Untitled Lesson"}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded text-slate-500">{l.type}</span>{" "}
                    {l.isPreview && <span className="text-[#E5484D] text-[10px] font-black uppercase tracking-widest border border-[#E5484D]/20 px-2 py-0.5 rounded bg-[#E5484D]/5">Preview</span>}
                  </li>
                ))}
                {s.lessons.length === 0 && (
                  <li className="text-xs text-slate-600 italic">No lessons in this section.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 py-4 px-2 shadow-sm">
      <div className="text-xl font-black text-slate-900">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-1">{label}</div>
    </div>
  );
}

function ConfettiOverlay() {
  const pieces = Array.from({ length: 60 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 0.8 + Math.random() * 0.9;
        const hue = Math.floor(Math.random() * 360);
        return (
          <span
            key={i}
            className="absolute top-0 w-1.5 h-3 rounded-sm"
            style={{
              left: `${left}%`,
              background: `hsl(${hue}, 90%, 60%)`,
              animation: `confetti-fall ${duration}s ${delay}s ease-in forwards`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}

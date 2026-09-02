import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, Plus, Trash2, Upload, GripVertical, Video, Film, ImageIcon } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { getCourseMediaUploadUrl } from "@/lib/academy.functions";
import { toast } from "sonner";
import {
  createCourse,
  updateCourse,
  deleteCourse,
  upsertModule,
  deleteModule,
  getCourse,
  getCourseCoverUploadUrl,
  type CourseCategory,
  type CourseLevel,
  type CourseWithModulesDTO,
  type ModuleDTO,
  type VideoProvider,
} from "@/lib/academy.functions";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { currencySymbol, usdRate } from "@/lib/fx-display";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveImage } from "@/components/ui/responsive-image";

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

function detectProvider(url: string): VideoProvider {
  return /vimeo\.com/i.test(url) ? "vimeo" : "youtube";
}

export function CourseEditorModal({
  open,
  onClose,
  courseId,
  isAdmin = false,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  courseId?: string;
  isAdmin?: boolean;
  onSaved?: (courseId: string) => void;
}) {
  const create = useServerFn(createCourse);
  const update = useServerFn(updateCourse);
  const remove = useServerFn(deleteCourse);
  const saveModule = useServerFn(upsertModule);
  const removeModule = useServerFn(deleteModule);
  const fetchCourse = useServerFn(getCourse);
  const getUpload = useServerFn(getCourseCoverUploadUrl);

  const { homeCurrency } = useOnboarding();
  const snapshotFx = useServerFn(snapshotFxRates);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(courseId ?? null);
  const [modules, setModules] = useState<ModuleDTO[]>([]);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "frontend" as CourseCategory,
    level: "beginner" as CourseLevel,
    instructorName: "",
    isFree: true,
    priceLocal: 0,
    priceCurrency: homeCurrency,
    isPublished: true,
    promoted: false,
  });

  const [modForm, setModForm] = useState({
    id: "",
    title: "",
    description: "",
    body: "",
    videoUrl: "",
    videoPath: null as string | null,
    videoFileUrl: null as string | null,
    durationMin: 0,
    isPreview: false,
  });
  const [modVideoUploading, setModVideoUploading] = useState(false);
  const getModUpload = useServerFn(getCourseMediaUploadUrl);

  useEffect(() => {
    if (!open) return;
    if (!courseId) {
      setSavedId(null);
      setModules([]);
      setCoverPath(null);
      setCoverUrl(null);
      setForm({
        title: "",
        description: "",
        category: "frontend",
        level: "beginner",
        instructorName: "",
        isFree: true,
        priceLocal: 0,
        priceCurrency: homeCurrency,
        isPublished: true,
        promoted: false,
      });
      return;
    }
    setLoading(true);
    fetchCourse({ data: { id: courseId } })
      .then((c: CourseWithModulesDTO) => {
        setSavedId(c.id);
        setModules(c.modules);
        setCoverPath(c.coverPath);
        setCoverUrl(c.coverUrl);
        // If the course was published in a currency, keep editing in that
        // currency so the seller sees the exact amount they set. Otherwise
        // fall back to their current base currency (legacy USD rows).
        const editCur = c.originalCurrency ?? homeCurrency;
        const editAmount = c.originalAmount > 0 ? c.originalAmount : c.priceUSD * usdRate(editCur);
        setForm({
          title: c.title,
          description: c.description,
          category: c.category,
          level: c.level,
          instructorName: c.instructorName,
          isFree: c.isFree,
          priceLocal: c.isFree ? 0 : Number(editAmount.toFixed(2)),
          priceCurrency: editCur,
          isPublished: c.isPublished,
          promoted: c.promoted,
        });
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, courseId, fetchCourse, homeCurrency]);

  if (!open) return null;

  const handleCoverUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover must be under 5MB");
      return;
    }
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
      setCoverUrl(signed?.signedUrl ?? null);
      toast.success("Cover uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const saveCourse = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    if (!form.isFree && !(form.priceLocal > 0)) return toast.error("Set a price or mark as free");
    setSaving(true);
    try {
      let priceUSD = 0;
      let originalCurrency = form.priceCurrency;
      let originalAmount = form.priceLocal;
      let fxSnapshot: Awaited<ReturnType<typeof snapshotFx>> | null = null;
      if (!form.isFree) {
        fxSnapshot = await snapshotFx();
        const rate = fxSnapshot.rates[form.priceCurrency] ?? usdRate(form.priceCurrency);
        priceUSD =
          form.priceCurrency === "USD"
            ? form.priceLocal
            : Number((form.priceLocal / (rate || 1)).toFixed(2));
      } else {
        originalCurrency = "USD";
        originalAmount = 0;
      }
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        level: form.level,
        instructorName: form.instructorName,
        isFree: form.isFree,
        priceUSD,
        isPublished: form.isPublished,
        promoted: form.promoted,
        originalCurrency,
        originalAmount,
        fxSnapshot,
        coverPath,
      };
      if (savedId) {
        await update({ data: { id: savedId, ...payload } });
        toast.success("Course updated");
      } else {
        const res = await create({ data: payload });
        setSavedId(res.id);
        toast.success("Course created — now add modules");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    await saveCourse();
    if (savedId && onSaved) onSaved(savedId);
    else onClose();
  };

  const emptyModForm = {
    id: "",
    title: "",
    description: "",
    body: "",
    videoUrl: "",
    videoPath: null as string | null,
    videoFileUrl: null as string | null,
    durationMin: 0,
    isPreview: false,
  };

  const addOrUpdateModule = async () => {
    if (!savedId) return toast.error("Save the course details first");
    if (!modForm.title.trim()) return toast.error("Module title required");
    const hasAny = modForm.videoUrl.trim() || modForm.videoPath || modForm.body.trim();
    if (!hasAny) return toast.error("Add a video link, upload a video, or write module notes");
    try {
      const provider = detectProvider(modForm.videoUrl);
      const pos = modForm.id
        ? (modules.find((m) => m.id === modForm.id)?.position ?? 0)
        : modules.length;
      const saved = await saveModule({
        data: {
          id: modForm.id || undefined,
          courseId: savedId,
          position: pos,
          title: modForm.title,
          description: modForm.description,
          body: modForm.body,
          videoUrl: modForm.videoUrl,
          videoProvider: provider,
          videoPath: modForm.videoPath,
          durationMin: modForm.durationMin,
          isPreview: modForm.isPreview,
        },
      });
      setModules((prev) => {
        const others = prev.filter((m) => m.id !== saved.id);
        return [...others, saved].sort((a, b) => a.position - b.position);
      });
      setModForm(emptyModForm);
      toast.success(modForm.id ? "Module updated" : "Module added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const editModule = (m: ModuleDTO) => {
    setModForm({
      id: m.id,
      title: m.title,
      description: m.description,
      body: m.body ?? "",
      videoUrl: m.videoUrl,
      videoPath: m.videoPath ?? null,
      videoFileUrl: m.videoFileUrl ?? null,
      durationMin: m.durationMin,
      isPreview: m.isPreview,
    });
  };

  const uploadModuleVideo = async (file: File) => {
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) return toast.error("Video must be ≤ 500 MB");
    setModVideoUploading(true);
    try {
      const { path, signedUrl } = await getModUpload({
        data: { filename: file.name, kind: "video" },
      });
      const res = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "video/mp4" },
      });
      if (!res.ok) throw new Error("Upload failed");
      setModForm((f) => ({ ...f, videoPath: path, videoFileUrl: URL.createObjectURL(file) }));
      toast.success("Video uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setModVideoUploading(false);
    }
  };

  const removeMod = async (id: string) => {
    if (!confirm("Delete this module?")) return;
    try {
      await removeModule({ data: { id } });
      setModules((prev) => prev.filter((m) => m.id !== id));
      toast.success("Module removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const removeCourseHandler = async () => {
    if (!savedId || !confirm("Delete this course and all modules? This cannot be undone.")) return;
    try {
      await remove({ data: { id: savedId } });
      toast.success("Course deleted");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="modal-light fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#0A0A0B] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0 bg-[#0A0A0B]/80 backdrop-blur-md">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              {savedId ? "Edit Course" : "Publish a Course"}
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              {savedId
                ? "Update details and manage modules"
                : "Step 1: save details, then add video modules"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-[#E5484D] animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Loading course details...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-8">
            {/* DETAILS */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#E5484D]">
                Course Details
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Title *">
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="input"
                    placeholder="e.g. React Server Components"
                  />
                </Field>
                <Field label="Instructor name">
                  <input
                    value={form.instructorName}
                    onChange={(e) => setForm({ ...form, instructorName: e.target.value })}
                    className="input"
                    placeholder="Displayed as author"
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as CourseCategory })
                    }
                    className="input"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Level">
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value as CourseLevel })}
                    className="input"
                  >
                    {LEVELS.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="input resize-none"
                  placeholder="What learners will build and master..."
                />
              </Field>

              <Field label="Cover image (optional, up to 5MB)">
                <div className="flex items-center gap-4">
                  <div className="w-40 h-24 rounded-xl bg-[#141416] border border-white/5 grid place-items-center overflow-hidden">
                    {coverUrl ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={coverUrl}
                        alt="cover"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-700" />
                    )}
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-[10px] bg-white/5 border border-white/5 hover:bg-white/10 text-sm font-bold text-white transition-all">
                    <Upload className="w-4 h-4" />
                    {uploading ? "Uploading..." : coverPath ? "Replace Thumbnail" : "Upload Thumbnail"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
                    />
                  </label>
                </div>
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-4 rounded-xl bg-[#141416] border border-white/5 cursor-pointer group hover:bg-white/5 transition-all">
                  <input
                    type="checkbox"
                    checked={form.isFree}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        isFree: e.target.checked,
                        priceLocal: e.target.checked ? 0 : form.priceLocal,
                      })
                    }
                    className="w-5 h-5 rounded-[6px] border-white/10 bg-[#0A0A0B] checked:bg-[#E5484D] accent-[#E5484D] transition-all"
                  />
                  <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">This is a free course</span>
                </label>
                <Field
                  label={`Price (${currencySymbol(form.priceCurrency)} ${form.priceCurrency})`}
                >
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={form.isFree}
                    value={form.priceLocal}
                    onChange={(e) => setForm({ ...form, priceLocal: Number(e.target.value) })}
                    className="input disabled:opacity-40"
                  />
                </Field>
              </div>
              {!form.isFree && (
                <p className="text-[11px] text-slate-500 -mt-2">
                  Price is set in your base currency ({form.priceCurrency}). Learners on other
                  currencies see the equivalent using the FX rate locked at publish time — the
                  amount they pay never fluctuates after that.
                </p>
              )}

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-3 p-4 rounded-xl bg-[#141416] border border-white/5 cursor-pointer group hover:bg-white/5 transition-all">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                    className="w-5 h-5 rounded-[6px] border-white/10 bg-[#0A0A0B] checked:bg-[#E5484D] accent-[#E5484D] transition-all"
                  />
                  <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">Visible in catalog</span>
                </label>
                {isAdmin && (
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-[#E5484D]/5 border border-[#E5484D]/20 cursor-pointer group hover:bg-[#E5484D]/10 transition-all">
                    <input
                      type="checkbox"
                      checked={form.promoted}
                      onChange={(e) => setForm({ ...form, promoted: e.target.checked })}
                      className="w-5 h-5 rounded-[6px] border-[#E5484D]/30 bg-[#0A0A0B] checked:bg-[#E5484D] accent-[#E5484D] transition-all"
                    />
                    <span className="text-sm font-black uppercase tracking-widest text-[#E5484D]">Promote (Admin)</span>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={saveCourse}
                  disabled={saving}
                  className="px-6 py-3.5 rounded-[10px] bg-[#E5484D] hover:bg-[#E5484D]/90 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest inline-flex items-center gap-2 shadow-[0_4px_15px_rgba(229,72,77,0.3)] transition-all"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {savedId ? "Save Changes" : "Create Course"}
                </button>
                {savedId && (
                  <button
                    onClick={removeCourseHandler}
                    className="px-5 py-3.5 rounded-[10px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold uppercase tracking-tight transition-all"
                  >
                    Delete course
                  </button>
                )}
              </div>
            </section>

            {/* MODULES */}
            {savedId && (
              <section className="space-y-4 border-t border-white/5 pt-8">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#E5484D]">
                  Modules ({modules.length})
                </h3>

                <div className="space-y-3">
                  {modules.map((m, i) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-4 rounded-xl bg-[#141416] border border-white/5 shadow-sm transition-all hover:border-white/10"
                    >
                      <GripVertical className="w-4 h-4 text-slate-600" />
                      <span className="text-[10px] font-black text-[#E5484D] opacity-60 w-6 uppercase">M{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{m.title}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <Video className="w-3 h-3" /> {m.videoProvider} · {m.durationMin || "?"}{" "}
                          min {m.isPreview && "· preview"}
                        </div>
                      </div>
                      <button
                        onClick={() => editModule(m)}
                        className="text-[10px] font-black uppercase tracking-widest text-[#E5484D] hover:bg-[#E5484D]/5 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeMod(m.id)}
                        className="text-xs text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {modules.length === 0 && (
                    <div className="text-xs text-slate-500 text-center py-4 border border-dashed border-white/10 rounded-[10px]">
                      No modules yet. Add your first video below.
                    </div>
                  )}
                </div>

                <div className="p-6 rounded-2xl bg-[#141416] border border-white/5 space-y-6 shadow-md">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#E5484D] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
                    {modForm.id ? "Editing Module" : "Add New Module"}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Module title *">
                      <input
                        value={modForm.title}
                        onChange={(e) => setModForm({ ...modForm, title: e.target.value })}
                        className="input"
                        placeholder="Module 1 — Foundations"
                      />
                    </Field>
                    <Field label="Video URL (YouTube or Vimeo) *">
                      <input
                        value={modForm.videoUrl}
                        onChange={(e) => setModForm({ ...modForm, videoUrl: e.target.value })}
                        className="input"
                        placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                      />
                    </Field>
                    <Field label="Duration (minutes)">
                      <input
                        type="number"
                        min="0"
                        value={modForm.durationMin}
                        onChange={(e) =>
                          setModForm({ ...modForm, durationMin: Number(e.target.value) })
                        }
                        className="input"
                      />
                    </Field>
                    <label className="flex items-center gap-3 p-4 rounded-xl bg-[#0A0A0B] border border-white/5 cursor-pointer group hover:bg-white/5 transition-all">
                      <input
                        type="checkbox"
                        checked={modForm.isPreview}
                        onChange={(e) => setModForm({ ...modForm, isPreview: e.target.checked })}
                        className="w-5 h-5 rounded-[6px] border-white/10 bg-[#0A0A0B] checked:bg-[#E5484D] accent-[#E5484D] transition-all"
                      />
                      <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                        Free preview lesson
                      </span>
                    </label>
                  </div>
                  <Field label="Short description">
                    <textarea
                      rows={2}
                      value={modForm.description}
                      onChange={(e) => setModForm({ ...modForm, description: e.target.value })}
                      className="input resize-none"
                      placeholder="What this module covers"
                    />
                  </Field>
                  <Field label="Upload module video (optional, ≤ 500 MB)">
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-2 px-5 py-3 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-bold text-white cursor-pointer transition-all">
                        <Film className="w-4 h-4" />
                        {modVideoUploading
                          ? "Uploading…"
                          : modForm.videoPath
                            ? "Replace Video"
                            : "Choose Video"}
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadModuleVideo(f);
                          }}
                        />
                      </label>
                      {modForm.videoPath && (
                        <button
                          type="button"
                          onClick={() =>
                            setModForm({ ...modForm, videoPath: null, videoFileUrl: null })
                          }
                          className="text-xs text-red-300 hover:text-red-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {modForm.videoFileUrl && (
                      <video
                        src={modForm.videoFileUrl}
                        controls
                        className="mt-2 w-full max-h-48 rounded-[10px] border border-white/10 bg-black"
                      />
                    )}
                  </Field>
                  <Field label="Module body (rich text)">
                    <RichTextEditor
                      value={modForm.body}
                      onChange={(html) => setModForm({ ...modForm, body: html })}
                      placeholder="Write full lesson notes. Insert images or screenshots inline."
                    />
                  </Field>
                  <div className="flex gap-2">
                    <button
                      onClick={addOrUpdateModule}
                      className="px-5 py-3.5 rounded-[10px] bg-[#E5484D] hover:bg-[#E5484D]/90 text-white font-black text-sm uppercase tracking-widest inline-flex items-center gap-2 shadow-[0_4px_12px_rgba(229,72,77,0.2)] transition-all"
                    >
                      <Plus className="w-4 h-4" /> {modForm.id ? "Update Module" : "Add Module"}
                    </button>
                    {modForm.id && (
                      <button
                        onClick={() => setModForm(emptyModForm)}
                        className="px-5 py-3.5 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 text-sm font-bold transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        <div className="p-4 border-t border-white/10 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3.5 rounded-[10px] text-slate-400 hover:text-white text-sm font-bold transition-all"
          >
            Close
          </button>
          {savedId && (
            <button
              onClick={finish}
              className="px-6 py-3.5 rounded-[10px] bg-[#E5484D] hover:bg-[#E5484D]/90 text-white font-black text-sm uppercase tracking-widest shadow-[0_4px_12px_rgba(229,72,77,0.2)] transition-all"
            >
              Done
            </button>
          )}
        </div>
      </div>

      <style>{`.input{width:100%;padding:0.875rem 1rem;background:#141416;border:1px solid rgba(255,255,255,0.05);border-radius:0.625rem;color:white;font-size:0.875rem;outline:none;transition:all 0.2s}.input:focus{border-color:rgba(229,72,77,0.5);background:#1A1A1F}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
        {label}
      </span>
      {children}
    </label>
  );
}

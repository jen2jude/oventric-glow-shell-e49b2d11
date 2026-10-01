import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Loader2,
  Edit3,
  Trash2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminListCourses,
  updateCourse,
  deleteCourse,
  type CourseDTO,
} from "@/lib/academy.functions";
import { CourseEditorModal } from "@/components/oventric/CourseEditorModal";
import { ResponsiveImage } from "@/components/ui/responsive-image";

export const Route = createFileRoute("/admin/courses")({
  head: () => ({ meta: [{ title: "Courses · Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminCourses,
  errorComponent: AdminCoursesError as never,
});

function AdminCoursesError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="p-8 flex items-start gap-3 text-slate-300">
      <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
      <div>
        <div className="text-white font-bold">Failed to load courses</div>
        <div className="text-sm text-slate-400">{error.message}</div>
        <button
          onClick={() => {
            reset();
            router.invalidate();
          }}
          className="mt-3 px-3 py-1.5 rounded bg-emerald-500 text-black text-sm font-bold"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function AdminCourses() {
  const list = useServerFn(adminListCourses);
  const update = useServerFn(updateCourse);
  const remove = useServerFn(deleteCourse);
  const [rows, setRows] = useState<CourseDTO[] | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [refresh, setRefresh] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    list()
      .then(setRows)
      .catch((e) => toast.error(e.message));
  }, [list, refresh]);

  const filtered = (rows ?? []).filter((r) =>
    !q
      ? true
      : `${r.title} ${r.instructorName} ${r.category}`.toLowerCase().includes(q.toLowerCase()),
  );

  const togglePublish = async (c: CourseDTO) => {
    try {
      await update({ data: { id: c.id, isPublished: !c.isPublished } });
      setRefresh((k) => k + 1);
      toast.success(c.isPublished ? "Unpublished" : "Published");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const togglePromote = async (c: CourseDTO) => {
    try {
      await update({ data: { id: c.id, promoted: !c.promoted } });
      setRefresh((k) => k + 1);
      toast.success(c.promoted ? "Removed from featured" : "Featured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this course and all its modules?")) return;
    try {
      await remove({ data: { id } });
      setRefresh((k) => k + 1);
      toast.success("Course deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-emerald-400" /> Academy Courses
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Publish, edit, and manage every course across the platform.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/"
            className="px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-sm"
          >
            View catalog
          </Link>
          <button
            onClick={() => {
              setEditingId(undefined);
              setEditorOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm"
          >
            <Plus className="w-4 h-4" /> New course
          </button>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title, instructor, or category"
        className="w-full mb-4 px-3 py-2 bg-[#1E1E24] border border-white/10 rounded-[10px] text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/50"
      />

      {rows === null && (
        <div className="text-center py-10">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
        </div>
      )}

      {rows !== null && filtered.length === 0 && (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-xl">
          <GraduationCap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <div className="text-white font-bold">No courses yet</div>
          <p className="text-sm text-slate-500 mt-1">Publish the first Academy course.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="p-4 bg-[#1E1E24] border border-white/10 rounded-xl flex items-center gap-4"
          >
            <div className="w-16 h-10 rounded bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
              {c.coverUrl ? (
                <ResponsiveImage
                  sizes="(min-width: 640px) 240px, 50vw"
                  src={c.coverUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <GraduationCap className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm truncate">{c.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="uppercase">{c.category}</span>
                <span>· {c.level}</span>
                {c.instructorName && <span>· {c.instructorName}</span>}
                <span>· {c.isFree ? "Free" : `$${c.priceUSD}`}</span>
                <span className={c.isPublished ? "text-emerald-400" : "text-amber-400"}>
                  · {c.isPublished ? "Published" : "Draft"}
                </span>
                {c.promoted && <span className="text-emerald-300">· Featured</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => togglePublish(c)}
                title={c.isPublished ? "Unpublish" : "Publish"}
                className="p-2 rounded hover:bg-white/5 text-slate-400 hover:text-white"
              >
                {c.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => togglePromote(c)}
                title={c.promoted ? "Unfeature" : "Feature"}
                className={`p-2 rounded hover:bg-white/5 ${c.promoted ? "text-emerald-300" : "text-slate-400 hover:text-white"}`}
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditingId(c.id);
                  setEditorOpen(true);
                }}
                title="Edit"
                className="p-2 rounded hover:bg-white/5 text-slate-400 hover:text-white"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => del(c.id)}
                title="Delete"
                className="p-2 rounded hover:bg-red-500/10 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <CourseEditorModal
        open={editorOpen}
        courseId={editingId}
        isAdmin
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          setRefresh((k) => k + 1);
        }}
      />
    </div>
  );
}

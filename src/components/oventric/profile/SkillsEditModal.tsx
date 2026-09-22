import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, Search, X } from "lucide-react";
import { updateMyProfile } from "@/lib/profiles.functions";
import { skillHue } from "@/lib/profiles/skill-visual";
import { MAX_TOOLS, toolIconUrl } from "@/lib/profiles/tools";
import type { ToolCategoryDTO, ToolDTO } from "@/lib/tools.functions";
import { visualForCategory } from "@/components/oventric/marketplace-discovery/utils";
import { cn } from "@/lib/utils";

const ACCENT = "#E5484D";
const MAX_SKILLS = 12;

export interface SkillRow {
  name: string;
  level: number;
}

/**
 * Owner editor for the Skills tab. Light, category-accented UI that matches the
 * rest of the profile skills surface.
 */
export function SkillsEditModal({
  open,
  onClose,
  initialSkills,
  initialTools,
  onSaved,
  library,
}: {
  open: boolean;
  onClose: () => void;
  initialSkills: SkillRow[];
  initialTools: string[];
  onSaved: (skills: SkillRow[], tools: string[]) => void;
  library: { categories: ToolCategoryDTO[]; tools: ToolDTO[] };
}) {
  const save = useServerFn(updateMyProfile);
  const [rows, setRows] = useState<SkillRow[]>(initialSkills);
  const [tools, setTools] = useState<string[]>(initialTools);
  const [draft, setDraft] = useState("");
  const [toolQuery, setToolQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(initialSkills);
    setTools(initialTools);
    setDraft("");
    setToolQuery("");
    setActiveCat("all");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const filteredTools = useMemo(() => {
    const q = toolQuery.trim().toLowerCase();
    return library.tools.filter(
      (t) =>
        (activeCat === "all" || t.categorySlug === activeCat) &&
        (!q || t.name.toLowerCase().includes(q) || t.slug.includes(q)),
    );
  }, [library.tools, toolQuery, activeCat]);

  if (!open) return null;

  const addSkill = () => {
    const name = draft.trim().replace(/\s+/g, " ").slice(0, 32);
    if (!name) return;
    if (rows.length >= MAX_SKILLS) {
      setError(`Up to ${MAX_SKILLS} skills.`);
      return;
    }
    if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    setRows((r) => [...r, { name, level: 80 }]);
    setDraft("");
    setError(null);
  };

  const toggleTool = (id: string) => {
    setTools((t) => {
      if (t.includes(id)) return t.filter((x) => x !== id);
      if (t.length >= MAX_TOOLS) return t;
      return [...t, id];
    });
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const skills = rows.map((r) => r.name);
      const skillLevels = Object.fromEntries(rows.map((r) => [r.name, r.level]));
      await save({ data: { skills, skillLevels, tools } });
      onSaved(rows, tools);
      onClose();
    } catch (e) {
      console.error(e);
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-black text-slate-900">Skills &amp; tools</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Skills */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Skills</h3>
              <span className="text-[11px] font-semibold text-slate-500">
                {rows.length}/{MAX_SKILLS}
              </span>
            </div>

            <div className="mt-3 space-y-4">
              {rows.map((row, i) => {
                const hue = skillHue(row.name);
                return (
                  <div key={row.name}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-bold text-slate-800">
                        {row.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            "bg-gradient-to-r bg-clip-text text-xs font-bold text-transparent",
                            hue,
                          )}
                        >
                          {row.level}%
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${row.name}`}
                          onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                          className="rounded-full p-1 text-slate-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={row.level}
                      onChange={(e) =>
                        setRows((r) =>
                          r.map((x, idx) =>
                            idx === i ? { ...x, level: Number(e.target.value) } : x,
                          ),
                        )
                      }
                      className={cn(
                        "mt-1.5 w-full appearance-none rounded-full bg-slate-100 accent-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow",
                        "h-2 bg-gradient-to-r",
                        hue,
                      )}
                      aria-label={`${row.name} proficiency`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add a skill (e.g. UI/UX Design)"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#E5484D] focus:ring-1 focus:ring-[#E5484D]/20"
              />
              <button
                type="button"
                onClick={addSkill}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-[#E5484D] to-[#FF7A7E] px-3 py-2.5 text-sm font-bold text-white shadow-sm"
              >
                <Plus className="h-4 w-4" strokeWidth={3} /> Add
              </button>
            </div>
          </section>

          {/* Tools */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Tools I use</h3>
              <span className="text-[11px] font-semibold text-slate-500">
                {tools.length}/{MAX_TOOLS}
              </span>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={toolQuery}
                onChange={(e) => setToolQuery(e.target.value)}
                placeholder="Search tools"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#E5484D] focus:ring-1 focus:ring-[#E5484D]/20"
              />
            </div>

            {/* Category filter */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[{ slug: "all", name: "All", imageUrl: null } as Pick<ToolCategoryDTO, "slug" | "name" | "imageUrl">, ...library.categories].map(
                (c) => {
                  const on = activeCat === c.slug;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => setActiveCat(c.slug)}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                        on
                          ? "border-[#E5484D] bg-[#E5484D]/10 text-slate-900"
                          : "border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50",
                      )}
                    >
                      {c.imageUrl && (
                        <img loading="lazy" decoding="async" src={c.imageUrl} alt="" className="h-4 w-4 rounded" />
                      )}
                      {c.name}
                    </button>
                  );
                },
              )}
            </div>

            <div className="mt-4">
              {filteredTools.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No tools match that search.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {filteredTools.map((t) => {
                    const on = tools.includes(t.slug);
                    const { Icon, hue } = visualForCategory(t.categorySlug ?? "", t.name);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTool(t.slug)}
                        aria-pressed={on}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-colors",
                          on
                            ? "border-[#E5484D] bg-[#E5484D]/10"
                            : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
                        )}
                      >
                        {on && (
                          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#E5484D] text-white">
                            <Check className="h-2.5 w-2.5" strokeWidth={4} />
                          </span>
                        )}
                        <div
                          className={cn(
                            "grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                            hue,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="line-clamp-1 text-[10px] font-semibold text-slate-600">
                          {t.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="space-y-2 border-t border-slate-200 px-5 py-4">
          {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="w-full rounded-xl bg-gradient-to-r from-[#E5484D] to-[#FF7A7E] py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}

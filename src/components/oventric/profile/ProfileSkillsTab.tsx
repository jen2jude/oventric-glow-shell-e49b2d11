import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Pencil, Sparkles, Wrench } from "lucide-react";
import { SkillsEditModal, type SkillRow } from "./SkillsEditModal";
import { getTool, toolIconUrl } from "@/lib/profiles/tools";
import { skillHue } from "@/lib/profiles/skill-visual";
import { listToolLibrary, type ToolCategoryDTO, type ToolDTO } from "@/lib/tools.functions";
import { visualForCategory } from "@/components/oventric/marketplace-discovery/utils";
import { cn } from "@/lib/utils";

const ACCENT = "#E5484D";

/**
 * Profile "Skills" tab — clean, light cards with category-style gradient
 * accents so each skill and tool gets its own readable color.
 */
export function ProfileSkillsTab({
  name,
  isOwner,
  skills,
  skillLevels,
  tools,
  workLinks = [],
}: {
  name: string;
  isOwner: boolean;
  skills: string[];
  skillLevels: Record<string, number>;
  tools: string[];
  workLinks?: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [localSkills, setLocalSkills] = useState<string[]>(skills);
  const [localLevels, setLocalLevels] = useState<Record<string, number>>(skillLevels);
  const [localTools, setLocalTools] = useState<string[]>(tools);
  const [library, setLibrary] = useState<{ categories: ToolCategoryDTO[]; tools: ToolDTO[] }>({
    categories: [],
    tools: [],
  });
  const loadLibrary = useServerFn(listToolLibrary);

  useEffect(() => {
    let alive = true;
    loadLibrary()
      .then((res) => alive && setLibrary(res))
      .catch((e) => console.error("[skills] tool library", e));
    return () => {
      alive = false;
    };
  }, [loadLibrary]);

  const toolBySlug = useMemo(
    () => new Map(library.tools.map((t) => [t.slug, t])),
    [library.tools],
  );

  const rows: SkillRow[] = useMemo(
    () => localSkills.map((s) => ({ name: s, level: localLevels[s] ?? 75 })),
    [localSkills, localLevels],
  );

  const empty = rows.length === 0 && localTools.length === 0;

  return (
    <div className="space-y-5 pb-10">
      {/* Skills */}
      <section className="rounded-[10px] border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#E5484D] to-[#FF7A7E] text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="truncate text-sm font-black text-slate-900">Skills</h2>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {isOwner
              ? "Add the skills you want to be hired for — each one shows a proficiency bar."
              : `${name} hasn't added skills yet.`}
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {rows.map((row) => {
              const hue = skillHue(row.name);
              return (
                <div key={row.name}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-bold text-slate-800">
                      {row.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 bg-gradient-to-r bg-clip-text text-xs font-black text-transparent",
                        hue,
                      )}
                    >
                      {row.level}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-700 bg-gradient-to-r",
                        hue,
                      )}
                      style={{ width: `${row.level}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {workLinks.length > 0 && (
        <section className="rounded-[10px] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#2F7FE0] to-[#4FA3F5] text-white">
              <ExternalLink className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-black text-slate-900">Work &amp; portfolio</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {workLinks.map((l) => {
              const display = l.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
              return (
                <a
                  key={l}
                  href={l.startsWith("http") ? l : `https://${l}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-900"
                >
                  {display}
                  <ExternalLink className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-slate-600" />
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Tools */}
      <section className="rounded-[10px] border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#7A34D4] to-[#9B5CF0] text-white">
            <Wrench className="h-4 w-4" />
          </div>
          <h2 className="truncate text-sm font-black text-slate-900">Tools I use</h2>
        </div>

        {localTools.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {isOwner
              ? "Pick the tools you work in from the Oventric tools library."
              : "No tools listed yet."}
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {localTools.map((id) => {
              const t = toolBySlug.get(id);
              const label = t?.name ?? getTool(id).label;
              const { Icon, hue } = visualForCategory(t?.categorySlug ?? "", t?.name ?? label);
              return (
                <div
                  key={id}
                  className="flex flex-col items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 p-4 text-center transition hover:border-slate-300 hover:bg-white"
                >
                  <div
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br text-white shadow-sm",
                      hue,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="line-clamp-1 text-[11px] font-bold text-slate-700">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {empty && isOwner && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-[10px] bg-gradient-to-r from-[#E5484D] to-[#FF7A7E] py-3 text-sm font-black text-white shadow-sm hover:shadow"
        >
          Add skills &amp; tools
        </button>
      )}

      {isOwner && (
        <SkillsEditModal
          open={editing}
          onClose={() => setEditing(false)}
          initialSkills={rows}
          initialTools={localTools}
          library={library}
          onSaved={(nextRows, nextTools) => {
            setLocalSkills(nextRows.map((r) => r.name));
            setLocalLevels(Object.fromEntries(nextRows.map((r) => [r.name, r.level])));
            setLocalTools(nextTools);
          }}
        />
      )}
    </div>
  );
}

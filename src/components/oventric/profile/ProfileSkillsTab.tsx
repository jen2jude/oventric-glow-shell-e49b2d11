import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Sparkles, Wrench } from "lucide-react";
import { SkillsEditModal, type SkillRow } from "./SkillsEditModal";
import { getTool, toolIconUrl } from "@/lib/profiles/tools";
import { listToolLibrary, type ToolCategoryDTO, type ToolDTO } from "@/lib/tools.functions";

const ACCENT = "#E5484D";

/**
 * Profile "Skills" tab — proficiency bars plus a branded "Tools I Use" grid.
 * Owners can edit both inline; visitors get a read-only view.
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
    <div className="space-y-6 pb-10">
      {/* Skills */}
      <section className="rounded-3xl border border-white/8 bg-[#111114] p-5 md:border-slate-200 md:bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
            <h2 className="truncate text-sm font-black text-white md:text-slate-900">Skills</h2>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white md:border-slate-300 md:text-slate-700"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400 md:text-slate-500">
            {isOwner
              ? "Add the skills you want to be hired for — each one shows a proficiency bar."
              : `${name} hasn't added skills yet.`}
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {rows.map((row) => (
              <div key={row.name}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-bold text-white md:text-slate-800">
                    {row.name}
                  </span>
                  <span className="shrink-0 text-xs font-black" style={{ color: ACCENT }}>
                    {row.level}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/8 md:bg-slate-200">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${row.level}%`,
                      background: `linear-gradient(90deg, ${ACCENT}, #FF7A7E)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {workLinks.length > 0 && (
        <section className="rounded-3xl border border-white/8 bg-[#111114] p-5 md:border-slate-200 md:bg-white">
          <h2 className="text-sm font-black text-white md:text-slate-900">Work &amp; portfolio</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {workLinks.map((l) => (
              <a
                key={l}
                href={l.startsWith("http") ? l : `https://${l}`}
                target="_blank"
                rel="noreferrer noopener"
                className="max-w-full truncate rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white md:border-slate-300 md:text-slate-700"
              >
                {l.replace(/^https?:\/\//, "")}
              </a>
            ))}
          </div>
        </section>
      )}


      {/* Tools */}
      <section className="rounded-3xl border border-white/8 bg-[#111114] p-5 md:border-slate-200 md:bg-white">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
          <h2 className="truncate text-sm font-black text-white md:text-slate-900">Tools I use</h2>
        </div>

        {localTools.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400 md:text-slate-500">
            {isOwner
              ? "Pick the tools you work in from the Oventric tools library."
              : "No tools listed yet."}
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {localTools.map((id) => {
              const t = toolBySlug.get(id);
              const label = t?.name ?? getTool(id).label;
              return (
                <div
                  key={id}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/8 bg-[#17171C] p-4 md:border-slate-200 md:bg-slate-50"
                >
                  <img loading="lazy" decoding="async"
                    src={t?.imageUrl ?? toolIconUrl(id)}
                    alt={label}
                    className="h-8 w-8 object-contain"
                  />
                  <span className="line-clamp-1 text-[11px] font-bold text-slate-300 md:text-slate-600">
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
          className="w-full rounded-2xl py-3 text-sm font-black text-white"
          style={{ background: ACCENT }}
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

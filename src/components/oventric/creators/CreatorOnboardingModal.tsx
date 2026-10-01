import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Search, Sparkles, X } from "lucide-react";
import { listToolLibrary, type ToolDTO } from "@/lib/tools.functions";
import { saveCreatorOnboarding, CREATOR_FIELDS } from "@/lib/creators.functions";
import { toolIconUrl } from "@/lib/profiles/tools";
import { Button } from "@/components/ui/button";
import { useIsAppShell } from "@/hooks/use-launch-context";

const TINTS = [
  "border-sky-200 bg-sky-50 text-sky-700",
  "border-violet-200 bg-violet-50 text-violet-700",
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-amber-200 bg-amber-50 text-amber-700",
  "border-rose-200 bg-rose-50 text-rose-700",
  "border-teal-200 bg-teal-50 text-teal-700",
];

/**
 * Short "become a creator" questionnaire: field(s), tools, work links.
 * Answers are written onto the profile (skills / tools / creator profile).
 */
export function CreatorOnboardingModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const save = useServerFn(saveCreatorOnboarding);
  const loadLibrary = useServerFn(listToolLibrary);
  const isApp = useIsAppShell();
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<string[]>([]);
  const [otherField, setOtherField] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [toolQuery, setToolQuery] = useState("");
  const [customTool, setCustomTool] = useState("");
  const [links, setLinks] = useState<string[]>(["", "", ""]);
  const [library, setLibrary] = useState<ToolDTO[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);
    loadLibrary()
      .then((res) => setLibrary(res.tools))
      .catch(() => setLibrary([]));
  }, [open, loadLibrary]);

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
    if (!q) return library;
    return library.filter((t) => t.name.toLowerCase().includes(q) || t.slug.includes(q));
  }, [library, toolQuery]);

  if (!open) return null;

  const allFields = [...CREATOR_FIELDS];
  const chosenFields = [...fields, ...(otherField.trim() ? [otherField.trim().slice(0, 40)] : [])];

  const toggle = (list: string[], set: (v: string[]) => void, value: string, max: number) => {
    if (list.includes(value)) set(list.filter((v) => v !== value));
    else if (list.length < max) set([...list, value]);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await save({
        data: {
          fields: chosenFields,
          tools,
          workLinks: links.map((l) => l.trim()).filter(Boolean),
        },
      });
      onDone();
    } catch (e) {
      console.error(e);
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canNext = step === 0 ? true : step === 1 ? chosenFields.length > 0 : true;

  return (
    <div className={`fixed inset-0 z-[120] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-6 ${isApp ? "app-creator-sheet" : ""}`}>
      <div className="app-creator-sheet-panel flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          {step > 0 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} aria-label="Back" className="text-slate-500">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Sparkles className="h-5 w-5 text-emerald-600" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">Creator setup</p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{ width: `${((step + 1) / 4) * 100}%` }}
              />
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {step === 0 && (
            <div className="text-center">
              <p className="text-lg font-black text-slate-900">Are you a creator?</p>
              <p className="mt-2 text-sm text-slate-500">
                Showcase your talent on Oventric — your work, your tools, your links.
              </p>
              <div className="mt-6 grid gap-2.5">
                <Button className="h-12 rounded-[10px] bg-emerald-600 text-base font-black text-white hover:bg-emerald-700" onClick={() => setStep(1)}>
                  Yes, I create
                </Button>
                <Button variant="ghost" className="h-11 rounded-[10px] text-slate-500" onClick={onClose}>
                  Not yet
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-base font-black text-slate-900">What do you do?</p>
              <p className="mt-1 text-xs text-slate-500">Pick everything that fits.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {allFields.map((f, i) => {
                  const on = fields.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggle(fields, setFields, f, 8)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                        on ? "border-emerald-500 bg-emerald-500 text-white" : TINTS[i % TINTS.length]
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
              <input
                value={otherField}
                onChange={(e) => setOtherField(e.target.value)}
                placeholder="Something else? Type it here"
                className="mt-4 w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-base font-black text-slate-900">Which tools do you use?</p>
              <p className="mt-1 text-xs text-slate-500">Up to 12 — they appear on your profile.</p>
              <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-slate-200 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={toolQuery}
                  onChange={(e) => setToolQuery(e.target.value)}
                  placeholder="Search Canva, Figma, Photoshop…"
                  className="w-full text-sm text-slate-900 outline-none"
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {filteredTools.map((t) => {
                  const on = tools.includes(t.slug);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(tools, setTools, t.slug, 12)}
                      className={`relative flex flex-col items-center gap-1.5 rounded-[10px] border p-3 ${
                        on ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      {on && (
                        <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <img
                        loading="lazy"
                        src={t.imageUrl ?? toolIconUrl(t.slug)}
                        alt=""
                        className="h-7 w-7 object-contain"
                      />
                      <span className="line-clamp-1 text-[10.5px] font-bold text-slate-600">{t.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={customTool}
                  onChange={(e) => setCustomTool(e.target.value)}
                  placeholder="Add your own (e.g. Grok)"
                  className="flex-1 rounded-[10px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                />
                <Button
                  variant="outline"
                  className="rounded-[10px]"
                  onClick={() => {
                    const slug = customTool.trim().toLowerCase().replace(/[^a-z0-9.-]/g, "");
                    if (slug) toggle(tools, setTools, slug, 12);
                    setCustomTool("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-base font-black text-slate-900">Where can people see your work?</p>
              <p className="mt-1 text-xs text-slate-500">Optional — portfolio, Behance, YouTube, a past job.</p>
              <div className="mt-4 space-y-2.5">
                {links.map((l, i) => (
                  <input
                    key={i}
                    value={l}
                    onChange={(e) => setLinks((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    placeholder={`Link ${i + 1}`}
                    className="w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                  />
                ))}
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm font-bold text-[#E5484D]">{error}</p>}
        </div>

        {step > 0 && (
          <div className="border-t border-slate-100 p-4">
            {step < 3 ? (
              <Button
                disabled={!canNext}
                onClick={() => setStep((s) => s + 1)}
                className="h-12 w-full rounded-[10px] bg-emerald-600 text-base font-black text-white hover:bg-emerald-700"
              >
                Continue
              </Button>
            ) : (
              <Button
                disabled={saving}
                onClick={submit}
                className="h-12 w-full rounded-[10px] bg-emerald-600 text-base font-black text-white hover:bg-emerald-700"
              >
                {saving ? "Saving…" : "Finish & Start Creating"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { Clock, Flame, LayoutGrid } from "lucide-react";
import { haptic } from "@/lib/haptics";

const RECENT_KEY = "oventric:search-recent";

export function rememberSearch(term: string) {
  const t = term.trim();
  if (t.length < 2 || typeof window === "undefined") return;
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const DEFAULT_KEYWORDS = ["Editing", "Jobs", "Templates", "Logo", "Ebook", "Presets", "Courses"];
const DEFAULT_CATEGORIES = ["AI tools", "Themes", "Plugins", "Graphics", "Software", "Music", "Ebooks"];

const uniq = (arr: string[]) => {
  const seen = new Set<string>();
  return arr.filter((x) => {
    const k = x.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * App-only idle search panel: Popular searches + Browse categories pills.
 * Shown when a search bar is focused and empty.
 */
export function AppSearchSuggestions({
  names = [],
  vendors = [],
  categories = [],
  onPick,
}: {
  names?: string[];
  vendors?: string[];
  categories?: string[];
  onPick: (term: string) => void;
}) {
  const recent = useMemo(readRecent, []);

  const popular = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of names) {
      for (const w of n.split(/[^A-Za-z0-9]+/)) {
        if (w.length < 4) continue;
        const k = w[0].toUpperCase() + w.slice(1).toLowerCase();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    const words = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);
    return uniq([...vendors.slice(0, 5), ...words, ...DEFAULT_KEYWORDS]).slice(0, 14);
  }, [names, vendors]);

  const cats = useMemo(() => uniq([...categories, ...DEFAULT_CATEGORIES]).slice(0, 14), [categories]);

  const pick = (t: string) => {
    haptic("select");
    onPick(t);
  };

  const Pill = ({ t }: { t: string }) => (
    <button
      type="button"
      onClick={() => pick(t)}
      className="nav-tap rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-white/80 active:bg-white/[0.1]"
    >
      {t}
    </button>
  );

  return (
    <div className="space-y-5 py-3">
      {recent.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/45">
            <Clock className="h-3.5 w-3.5" /> Recent
          </h3>
          <div className="flex flex-wrap gap-2">
            {recent.map((t) => (
              <Pill key={t} t={t} />
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/45">
          <Flame className="h-3.5 w-3.5 text-[#E5484D]" /> Popular searches
        </h3>
        <div className="flex flex-wrap gap-2">
          {popular.map((t) => (
            <Pill key={t} t={t} />
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/45">
          <LayoutGrid className="h-3.5 w-3.5 text-[#3B82F6]" /> Browse categories
        </h3>
        <div className="flex flex-wrap gap-2">
          {cats.map((t) => (
            <Pill key={t} t={t} />
          ))}
        </div>
      </section>
    </div>
  );
}

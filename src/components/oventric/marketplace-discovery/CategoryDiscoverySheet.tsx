import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Layers,
} from "lucide-react";
import type { CategoryNode } from "@/lib/marketplace.functions";
import { visualForCategory } from "./utils";

interface Props {
  open: boolean;
  onClose: () => void;
  categories: CategoryNode[];
  counts: Record<string, number>;
  onSelectCategory: (cat: CategoryNode) => void;
}

export function CategoryDiscoverySheet({ open, onClose, categories, counts, onSelectCategory }: Props) {
  const [parent, setParent] = useState<CategoryNode | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setParent(null);
      setQuery("");
      setSearching(false);
    }
  }, [open]);

  if (!open) return null;

  const countFor = (c: CategoryNode): number =>
    (counts[c.slug] ?? 0) + c.children.reduce((n, k) => n + (counts[k.slug] ?? 0), 0);

  const roots = categories.filter((c) => c.kind === "digital");
  const level = parent ? parent.children : roots;
  const list = query.trim()
    ? level.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : level;

  const back = () => (parent ? setParent(null) : onClose());

  return (
    <div className="fixed inset-0 z-[120] bg-[#0A0A0B]">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div
          className="shrink-0 px-4 pb-3"
          style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <button type="button" onClick={back} className="grid h-11 w-11 place-items-center rounded-full">
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <h2 className="truncate text-center text-[17px] font-bold text-white">
              {parent ? parent.name : "Categories"}
            </h2>
            <button
              type="button"
              onClick={() => setSearching((s) => !s)}
              className="grid h-11 w-11 place-items-center rounded-full"
            >
              {searching ? <X className="h-5 w-5 text-white" /> : <Search className="h-5 w-5 text-white" />}
            </button>
          </div>

          {searching && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories"
              className="mt-3 w-full rounded-[10px] bg-[#141416] px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/35"
            />
          )}

        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10">
          <div className="space-y-2.5">
            {list.map((cat) => {
              const { Icon, hue } = visualForCategory(cat.slug, cat.name);
              const n = countFor(cat);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => (cat.children.length > 0 ? setParent(cat) : (onSelectCategory(cat), onClose()))}
                  className="flex w-full items-center gap-3.5 rounded-[10px] bg-[#131316] p-3 text-left active:scale-[0.995]"
                >
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br ${hue}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-white">{cat.name}</span>
                    <span className="block text-[12px] text-white/40">
                      {n.toLocaleString()} {n === 1 ? "product" : "products"}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-white/30" />
                </button>
              );
            })}
            {list.length === 0 && (
              <p className="py-24 text-center text-[13px] text-white/40">No categories here yet.</p>
            )}
          </div>

          {parent && (
            <button
              type="button"
              onClick={() => {
                onSelectCategory(parent);
                onClose();
              }}
              className="mt-4 w-full rounded-[10px] bg-[#E5484D] py-3.5 text-[13.5px] font-bold text-white"
            >
              View all in {parent.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

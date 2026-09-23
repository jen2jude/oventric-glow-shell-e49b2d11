import {
  Laptop,
  Shirt,
  Home,
  Layers,
  Briefcase,
} from "lucide-react";

const CATEGORIES = [
  { name: "Tech", icon: Laptop, tint: "#3B82F6" },
  { name: "Fashion", icon: Shirt, tint: "#A855F7" },
  { name: "Home & Living", icon: Home, tint: "#22C55E" },
  { name: "Digital Assets", icon: Layers, tint: "#F59E0B" },
  { name: "Jobs", icon: Briefcase, tint: "#F4643C" },
];

export function ExploreCategories({
  onSelect,
  variant = "dark",
}: {
  onSelect: (cat: string) => void;
  variant?: "dark" | "bright";
}) {
  const bright = variant === "bright";

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.name}
          type="button"
          onClick={() => onSelect(cat.name)}
          style={
            bright
              ? {
                  backgroundColor: `color-mix(in oklab, ${cat.tint} 7%, white)`,
                  borderColor: `color-mix(in oklab, ${cat.tint} 22%, white)`,
                }
              : undefined
          }
          className={
            bright
              ? "group relative shrink-0 w-[78px] rounded-[10px] border px-1.5 pt-3.5 pb-2.5 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              : "group relative shrink-0 w-[72px] rounded-[12px] bg-[#121215] border border-white/[0.06] px-1.5 pt-3.5 pb-2.5 flex flex-col items-center gap-1.5 active:scale-95 transition-transform overflow-hidden"
          }
        >
          {!bright && (
            <span
              className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 h-12 w-12 rounded-full blur-xl opacity-25"
              style={{ backgroundColor: cat.tint }}
            />
          )}
          <span
            className={
              bright
                ? "relative flex h-9 w-9 items-center justify-center rounded-full"
                : "relative"
            }
            style={
              bright
                ? { backgroundColor: `color-mix(in oklab, ${cat.tint} 14%, white)` }
                : undefined
            }
          >
            <cat.icon
              className="h-[22px] w-[22px]"
              style={{ color: cat.tint }}
              strokeWidth={1.8}
            />
          </span>
          <span
            className={
              bright
                ? "relative text-[10.5px] font-bold leading-tight text-newsfeed-ink text-center"
                : "relative text-[10.5px] font-bold leading-tight text-white text-center"
            }
          >
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
}

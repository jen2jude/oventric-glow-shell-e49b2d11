import {
  Laptop,
  Shirt,
  Home,
  Layers,
  Briefcase,
} from "lucide-react";

export function ExploreCategories({ onSelect }: { onSelect: (cat: string) => void }) {
  const categories = [
    { name: "Tech", icon: Laptop, tint: "text-[#3B82F6]", glow: "bg-[#3B82F6]" },
    { name: "Fashion", icon: Shirt, tint: "text-[#A855F7]", glow: "bg-[#A855F7]" },
    { name: "Home & Living", icon: Home, tint: "text-[#22C55E]", glow: "bg-[#22C55E]" },
    { name: "Digital Assets", icon: Layers, tint: "text-[#F59E0B]", glow: "bg-[#F59E0B]" },
    { name: "Jobs", icon: Briefcase, tint: "text-[#2DD4BF]", glow: "bg-[#2DD4BF]" },
  ];

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((cat) => (
        <button
          key={cat.name}
          type="button"
          onClick={() => onSelect(cat.name)}
          className="group relative shrink-0 w-[72px] rounded-[12px] bg-[#121215] border border-white/[0.06] px-1.5 pt-3.5 pb-2.5 flex flex-col items-center gap-1.5 active:scale-95 transition-transform overflow-hidden"
        >
          <span
            className={`pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 h-12 w-12 rounded-full blur-xl opacity-25 ${cat.glow}`}
          />
          <cat.icon className={`relative h-[22px] w-[22px] ${cat.tint}`} strokeWidth={1.8} />
          <span className="relative text-[10.5px] font-bold leading-tight text-white text-center">
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
}

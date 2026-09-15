import {
  Home,
  Compass,
  Target,
  Wallet,
  Plus,
  ChevronLeft,
  MessageSquare,
  Users,
  ShoppingBag,
  GraduationCap,
  Newspaper,
} from "lucide-react";
import { useState } from "react";

const items = [
  { icon: Home, label: "Home" },
  { icon: Compass, label: "Explore" },
  { icon: Newspaper, label: "Feed" },
  { icon: MessageSquare, label: "Messages" },
  { icon: ShoppingBag, label: "Marketplace" },
  { icon: Wallet, label: "Wallet" },
] as Array<{ icon: typeof Home; label: string }>;

export function Sidebar({
  onCreate,
  active,
  onSelect,
}: {
  onCreate: () => void;
  active: string;
  onSelect: (label: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 bg-[#1E1E24] border-r border-white/10 transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
        <button
          onClick={onCreate}
          className={`relative group mb-4 mt-2 mx-auto flex items-center justify-center rounded-full  ${
            collapsed ? "w-12 h-12" : "w-16 h-16"
          }`}
          aria-label="Create"
        >
          <span className="absolute inset-[2px] rounded-full bg-[#1E1E24] flex items-center justify-center">
            <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
          </span>
        </button>

        {items.map((it) => {
          const isActive = active === it.label;
          return (
            <button
              key={it.label}
              onClick={() => onSelect(it.label)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <it.icon className="w-6 h-6 shrink-0" strokeWidth={2.5} />
              {!collapsed && <span className="text-sm font-medium truncate">{it.label}</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-label="Toggle sidebar"
        className="m-3 p-2 rounded-[10px] text-slate-500 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
      >
        <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </aside>
  );
}

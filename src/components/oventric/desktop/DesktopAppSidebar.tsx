import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Compass,
  Target,
  Wallet as WalletIcon,
  Store,
  ChevronLeft,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import { getProfileByIdOrSlug } from "@/lib/profiles.functions";

type DashItem = { label: string; section: string; icon: typeof Target };

const DASH_ITEMS: DashItem[] = [
  { label: "Home", section: "Home", icon: LayoutDashboard },
  { label: "Explore", section: "Explore", icon: Compass },
  { label: "Marketplace", section: "Marketplace", icon: Store },
  { label: "Wallet", section: "Wallet", icon: WalletIcon },
];

const LEGAL = [
  { label: "About", to: "/about" },
  { label: "Help", to: "/help" },
  { label: "FAQ", to: "/faq" },
  { label: "Blog", to: "/blog" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
];

function Row({
  children,
  onClick,
  title,
  collapsed,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex w-full items-center gap-3 rounded-xl py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 ${
        collapsed ? "justify-center px-0" : "px-3"
      }`}
    >
      {children}
    </button>
  );
}


export function DesktopAppSidebar({ onSelect }: { onSelect: (section: string) => void }) {
  const profileFn = useServerFn(getProfileByIdOrSlug);

  const [me, setMe] = useState<{ name: string; slug: string; avatarUrl: string | null } | null>(
    null,
  );
  const [megaOpen, setMegaOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("oventric:desktop-sidebar:collapsed");
    // Always default to collapsed on desktop; remember the user's explicit choice.
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("oventric:desktop-sidebar:collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || !alive) return;
      try {
        const res = await profileFn({ data: { idOrSlug: uid } });
        if (alive && res.profile) {
          setMe({
            name: res.profile.displayName,
            slug: res.profile.slug,
            avatarUrl: res.profile.avatarUrl,
          });
        }
      } catch (e) {
        console.error("[DesktopAppSidebar] profile load failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profileFn]);

  return (
    <aside
      className={`hidden md:flex shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white py-4 transition-[width] duration-300 ${
        collapsed ? "w-[76px] px-2" : "w-[280px] px-3"
      }`}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="mb-2 flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>

      {/* Identity */}
      <button
        type="button"
        aria-label={me?.name ? `Open menu for ${me.name}` : "Open menu"}
        title={me?.name || "Your profile"}
        onClick={() => setMegaOpen(true)}
        className={`flex w-full items-center gap-3 rounded-xl py-3 transition-colors hover:bg-slate-100 ${
          collapsed ? "justify-center px-0" : "px-3"
        }`}
      >
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full">
          <AvatarImage src={me?.avatarUrl ?? null} alt={me?.name || "You"} loading="eager" />
        </span>
        {!collapsed && (
          <span className="truncate text-sm font-bold text-slate-900">
            {me?.name || "Your profile"}
          </span>
        )}
      </button>

      <div className="my-3 h-px bg-slate-200" />

      {/* Main sections */}
      {!collapsed && (
        <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Explore
        </p>
      )}
      <nav className="flex flex-col">
        {DASH_ITEMS.map((it) => (
          <Row
            key={it.section}
            onClick={() => onSelect(it.section)}
            title={it.label}
            collapsed={collapsed}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <it.icon className="h-4 w-4" strokeWidth={2.5} />
            </span>
            {!collapsed && <span className="truncate">{it.label}</span>}
          </Row>
        ))}
        {me?.slug && (
          <Link
            to="/profile/$id"
            params={{ id: me.slug }}
            title="Profile"
            className={`flex w-full items-center gap-3 rounded-xl py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 ${
              collapsed ? "justify-center px-0" : "px-3"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <User className="h-4 w-4" strokeWidth={2.5} />
            </span>
            {!collapsed && <span className="truncate">Profile</span>}
          </Link>
        )}
      </nav>


      {!collapsed && (
        <>
          <div className="my-3 h-px bg-slate-200" />
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pb-4">
            {LEGAL.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-900"
              >
                {l.label}
              </Link>
            ))}
            <span className="w-full pt-1 text-[11px] text-slate-400">
              © {new Date().getFullYear()} Oventric
            </span>
          </div>
        </>
      )}

      <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />
    </aside>
  );
}

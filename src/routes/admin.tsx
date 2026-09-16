import { createFileRoute, Outlet, Link, useRouter, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  LayoutGrid,
  LayoutDashboard,

  Users,
  ShoppingBag,
  Package,

  Megaphone,
  Tags,
  ToggleLeft,
  ScrollText,
  Settings,
  LogOut,
  AlertCircle,
  Loader2,
  Radio,
  Target,
  Wallet,
  GraduationCap,
  Banknote,
  ShieldAlert,
  BookOpen,
  UserCog,
  LifeBuoy,
  Wrench,
} from "lucide-react";

import { canAccessSection, type ManagementRole } from "@/lib/admin-roles";

import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin, adminGetPendingProductsCount } from "@/lib/admin.functions";
import { adminGetPendingPayoutCount } from "@/lib/payouts.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console · Oventric" },
      { name: "description", content: "Internal admin CRM." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
  errorComponent: AdminError,
  notFoundComponent: () => <div className="p-6 text-slate-300">Not found.</div>,
});

function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="admin-light min-h-screen bg-[#0b0b0d] text-slate-200 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Admin error</h2>
        <p className="text-sm text-slate-400 mt-1">{error.message}</p>
        <button
          onClick={() => {
            reset();
            router.invalidate();
          }}
          className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-[10px]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  group: string;
};

/**
 * Active MVP admin navigation. Non-MVP consoles (bounties, academy/courses,
 * circles, blog, campaigns/ad inquiries, affiliate waitlist, creator tools,
 * MiniPay manual payments) still exist as routes for future work but are
 * deliberately not listed and are locked to super admins via SECTION_ACCESS.
 */
const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, group: "Dashboard" },

  { to: "/admin/users", label: "Users", icon: Users, group: "Core" },
  { to: "/admin/sellers", label: "Sellers", icon: ShoppingBag, group: "Core" },
  { to: "/admin/products", label: "Products", icon: Package, group: "Core" },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList, group: "Core" },
  { to: "/admin/categories", label: "Categories", icon: Tags, group: "Core" },
  {
    to: "/admin/marketplace-controls",
    label: "Marketplace Curation",
    icon: LayoutGrid,
    group: "Core",
  },

  { to: "/admin/system-wallets", label: "Wallet / Ledger", icon: Wallet, group: "Money" },
  { to: "/admin/payouts", label: "Payouts", icon: Banknote, group: "Money" },
  { to: "/admin/disputes", label: "Refunds / Disputes", icon: ShieldAlert, group: "Money" },
  { to: "/admin/cashback-wallet", label: "Cashback", icon: Gift, group: "Money" },

  { to: "/admin/reports", label: "Reports", icon: ShieldCheck, group: "Community" },
  { to: "/admin/communications", label: "Communications", icon: Radio, group: "Community" },
  { to: "/admin/support", label: "Support Desk", icon: LifeBuoy, group: "Community" },

  { to: "/admin/audit", label: "Audit Log", icon: ScrollText, group: "System" },
  { to: "/admin/management-users", label: "Management Users", icon: UserCog, group: "System" },
  { to: "/admin/features", label: "Features", icon: ToggleLeft, group: "System" },
  { to: "/admin/settings", label: "Settings", icon: Settings, group: "System" },
];

function AdminLayout() {
  const check = useServerFn(checkIsAdmin);
  const getPendingPayouts = useServerFn(adminGetPendingPayoutCount);
  const getPendingProducts = useServerFn(adminGetPendingProductsCount);
  const router = useRouter();
  const location = useLocation();
  const [state, setState] = useState<"loading" | "unauth" | "forbidden" | "ok">("loading");
  const [roles, setRoles] = useState<ManagementRole[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const [pendingProducts, setPendingProducts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setState("unauth");
        return;
      }
      try {
        const res = await check();
        if (cancelled) return;
        setRoles((res.roles ?? []) as ManagementRole[]);
        setState(res.isAdmin ? "ok" : "forbidden");
      } catch {
        if (!cancelled) setState("forbidden");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [check]);

  useEffect(() => {
    if (state !== "ok") return;
    let cancelled = false;
    const load = async () => {
      try {
        const [payouts, products] = await Promise.all([getPendingPayouts(), getPendingProducts()]);
        if (cancelled) return;
        setPendingPayouts(payouts.count);
        setPendingProducts(products.count);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [state, getPendingPayouts, getPendingProducts]);

  const visibleNav = useMemo(() => NAV.filter((n) => canAccessSection(n.to, roles)), [roles]);
  const currentAllowed = canAccessSection(location.pathname, roles);

  if (state === "loading") {
    return (
      <div className="admin-light min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (state === "unauth" || state === "forbidden") {
    return (
      <div className="admin-light min-h-screen bg-[#0b0b0d] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#141418] border border-white/10 rounded-2xl p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-xl font-black text-white">Admin Console</h1>
          <p className="text-sm text-slate-400 mt-2">
            {state === "unauth"
              ? "Sign in with an administrator account to continue."
              : "Your account does not have administrator access."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {state === "unauth" ? (
              <AdminSignInForm onSignedIn={() => router.invalidate()} />
            ) : (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.invalidate();
                }}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold rounded-[10px]"
              >
                Sign out
              </button>
            )}
            <Link to="/" className="text-xs text-slate-500 hover:text-slate-300 mt-2">
              Back to site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-light min-h-screen bg-[#0b0b0d] text-slate-200 flex">
      <aside className="w-60 shrink-0 bg-[#141418] border-r border-white/10 flex flex-col">
        <div className="px-4 py-5 border-b border-white/10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <div className="text-white text-sm font-black leading-tight">Admin CRM</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              {roles.length > 0 ? roles.join(" • ") : "Oventric"}
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          {visibleNav.map((n) => {
            const badgeCount =
              n.to === "/admin/payouts"
                ? pendingPayouts
                : n.to === "/admin/products"
                  ? pendingProducts
                  : 0;
            const alert = badgeCount > 0;
            const badgeLabel =
              n.to === "/admin/payouts"
                ? `${badgeCount} pending payouts`
                : n.to === "/admin/products"
                  ? `${badgeCount} listings awaiting approval`
                  : `${badgeCount} pending`;
            return (
              <Link
                key={n.to}
                to={n.to as unknown as "/admin"}
                activeOptions={{ exact: n.exact }}
                activeProps={{
                  className: alert
                    ? "bg-red-500/15 text-red-200 border-red-500/50"
                    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
                }}
                inactiveProps={{
                  className: alert
                    ? "text-red-300 bg-red-500/10 hover:bg-red-500/20 border-red-500/40 animate-pulse"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border-transparent",
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] border text-sm font-medium transition-colors"
              >
                <n.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{n.label}</span>
                {alert && (
                  <span
                    aria-label={badgeLabel}
                    className="min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] font-black bg-red-500 text-white flex items-center justify-center"
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.invalidate();
          }}
          className="m-2 flex items-center gap-2 px-3 py-2 rounded-[10px] text-slate-400 hover:text-white hover:bg-white/5 text-sm"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        {currentAllowed ? (
          <Outlet />
        ) : (
          <div className="p-10 flex items-center justify-center min-h-full">
            <div className="max-w-md text-center bg-[#141418] border border-white/10 rounded-2xl p-8">
              <ShieldCheck className="w-8 h-8 text-amber-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-white">Restricted section</h2>
              <p className="text-sm text-slate-400 mt-2">
                Your role ({roles.join(", ") || "—"}) does not include access to this page. Ask a
                Super Admin to grant it.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function AdminSignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      onSignedIn();
    } catch (e: any) {
      setErr(e?.message ?? "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-left">
      <input
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Admin email"
        className="px-3 py-2.5 bg-[#0b0b0d] border border-white/10 rounded-[10px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
      />
      <div className="relative">
        <input
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-3 py-2.5 pr-16 bg-[#0b0b0d] border border-white/10 rounded-[10px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-1"
        >
          {showPw ? "Hide" : "Show"}
        </button>
      </div>
      {err && <div className="text-xs text-red-400">{err}</div>}
      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-[10px]"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={async () => {
          if (!email) {
            setErr("Enter your email first to receive a reset link.");
            return;
          }
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: `${window.location.origin}/reset-password`,
          });
          setErr(error ? error.message : "Password reset link sent.");
        }}
        className="text-[11px] text-slate-500 hover:text-slate-300 text-center"
      >
        Forgot password?
      </button>
    </form>
  );
}

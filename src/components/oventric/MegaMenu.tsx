import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  X,
  Sun,
  Moon,
  MessageCircle,
  Users,
  ShoppingBag,
  Wallet as WalletIcon,
  ChevronDown,
  Settings,
  HelpCircle,
  Info,
  FileText,
  Lock,
  Bug,
  ListChecks,
  Trash2,
  Gift,
  LogOut,
  User,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { CurrencyPreviewToggle } from "./CurrencyPreviewToggle";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { toast } from "sonner";

const INVITE_AMOUNTS: Record<string, { amount: number; symbol: string; label: string }> = {
  NGN: { amount: 1000, symbol: "₦", label: "₦1,000" },
  GHS: { amount: 20, symbol: "₵", label: "₵20" },
  USD: { amount: 2, symbol: "$", label: "$2" },
};

import { DeleteAccountModal } from "@/components/oventric/DeleteAccountModal";
import { ConnectionsDialog } from "@/components/oventric/profile/ConnectionsDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

function shouldUseLowGpuMenu() {
  if (typeof document === "undefined" || typeof navigator === "undefined") return false;
  try {
    const override = window.localStorage.getItem("oventric:gpu-mode");
    if (override === "low") return true;
    if (override === "high") return false;
  } catch {
    /* ignore */
  }
  const root = document.documentElement;
  if (root.classList.contains("low-gpu")) return true;
  const ua = navigator.userAgent || "";
  if (/Infinix|X6813|Note\s*11i|TECNO|itel/i.test(ua)) return true;
  const isAndroid = /Android/i.test(ua);
  if (!isAndroid) return false;
  const memory = "deviceMemory" in navigator ? Number(navigator.deviceMemory) : 0;
  const cores = Number(navigator.hardwareConcurrency || 0);
  // Android Chrome sometimes hides the renderer/model on exactly the devices
  // that tear pixels. If it is not clearly a high-end Android, render the
  // hamburger menu through the safer premium variant.
  return !(memory >= 8 && cores >= 8);
}

export function MegaMenu({ open, onClose }: Props) {
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [dangerExpanded, setDangerExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lowGpu, setLowGpu] = useState(shouldUseLowGpuMenu);
  const { isAuthenticated, openGate } = useAuthGate();
  const { fullName, storeName, baseCurrency } = useOnboarding();
  const { theme, toggle } = useTheme();
  const isAppShell = useIsAppShell();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userSlug, setUserSlug] = useState<string>("me");
  const [userId, setUserId] = useState<string | null>(null);
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const sync = () => setLowGpu(shouldUseLowGpuMenu());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-gpu-tier"] });
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      setUserId(uid ?? null);
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("slug, avatar_path")
        .eq("user_id", uid)
        .maybeSingle();
      if (prof?.slug) setUserSlug(prof.slug);
      if (prof?.avatar_path) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(prof.avatar_path, 3600);
        if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !isAppShell) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isAppShell]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  const connectionsNode = connectionsOpen ? (
    <ConnectionsDialog
      open={connectionsOpen}
      onOpenChange={setConnectionsOpen}
      userId={userId ?? ""}
      name={fullName || storeName || "Your connections"}
      viewerId={userId}
      initialTab="followers"
    />
  ) : null;

  if (!open) return connectionsNode;

  const invite = INVITE_AMOUNTS[baseCurrency] ?? INVITE_AMOUNTS.USD;
  const displayName = fullName || storeName || "Guest";

  const markReturn = () => {
    try {
      sessionStorage.setItem("oventric:megamenu-return-path", window.location.pathname);
    } catch {
      /* ignore */
    }
  };

  const go = (path: string, section?: string) => {
    markReturn();
    onClose();
    if (section) {
      navigate({ to: "/" });
      setTimeout(
        () => window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } })),
        30,
      );
    } else {
      navigate({ to: path as string });
    }
  };

  const goFollowers = () => {
    if (!userId) {
      onClose();
      openGate("generic");
      return;
    }
    onClose();
    setConnectionsOpen(true);
  };

  const openMessages = () => {
    onClose();
    window.dispatchEvent(new CustomEvent("oventric:open-messages"));
  };

  const grid = [
    { icon: MessageCircle, label: "Messages", onClick: openMessages },
    { icon: Users, label: "Followers", onClick: goFollowers },
    { icon: ShoppingBag, label: "Marketplace", onClick: () => go("/", "Marketplace") },
    { icon: WalletIcon, label: "Wallet", onClick: () => go("/wallet") },
  ];

  const inviteLink =
    typeof window !== "undefined" ? `${window.location.origin}/?ref=${userSlug}` : "";

  const doInvite = async () => {
    if (!isAuthenticated) {
      openGate("generic");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join me on Oventric",
          text: `Earn ${invite.label} when you join Oventric.`,
          url: inviteLink,
        });
      } else {
        await navigator.clipboard.writeText(inviteLink);
        toast.success("Invite link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    onClose();
    navigate({ to: "/" });
  };

  const userInitial = (displayName[0] ?? "?").toUpperCase();

  const webContent = (
    <div
      className="fixed inset-0 z-[2147483000] bg-foreground/10 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        data-testid="mega-menu"
        data-variant="web"
        className="web-account-menu absolute inset-x-3 bottom-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[10px] border border-border bg-background text-foreground shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-[76px] sm:w-[390px] sm:max-h-[calc(100dvh-92px)] lg:right-11 lg:top-[88px]"
      >
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background px-5 py-5">
          <button
            type="button"
            onClick={() => {
              if (userSlug && userSlug !== "me") {
                onClose();
                navigate({ to: "/profile/$id", params: { id: userSlug } });
              }
            }}
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px] border border-border bg-muted"
            aria-label="Open my profile"
          >
            <AvatarImage src={avatarUrl} alt={displayName} initials={userInitial} />
            <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (userSlug && userSlug !== "me") {
                onClose();
                navigate({ to: "/profile/$id", params: { id: userSlug } });
              }
            }}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block truncate font-wallet-display text-base font-bold text-foreground">
              {isAuthenticated ? displayName : "Guest"}
            </span>
            <span className="block truncate text-xs font-medium text-muted-foreground">
              {isAuthenticated ? "View your profile" : "Sign in to unlock"}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between rounded-[10px] border border-border bg-muted/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Display currency</p>
              <p className="mt-1 font-wallet-display text-sm font-bold text-foreground">{baseCurrency}</p>
            </div>
            <CurrencyPreviewToggle variant="light" />
          </div>
        </div>

        <nav className="px-2 pb-2" aria-label="Account shortcuts">
          <WebMenuItem icon={User} label="Profile details" onClick={() => go(`/profile/${userSlug}`)} />
          {grid.map((item) => (
            <WebMenuItem key={item.label} icon={item.icon} label={item.label} onClick={item.onClick} />
          ))}
        </nav>

        <div className="mx-5 border-t border-border py-4">
          <div className="flex items-center justify-between px-1 pb-4">
            <span className="text-sm font-semibold text-foreground">Dark mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={theme === "dark"}
              onClick={toggle}
              className={`relative h-6 w-11 rounded-full transition-colors ${theme === "dark" ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${theme === "dark" ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>
          <button
            type="button"
            onClick={doInvite}
            className="flex w-full items-center gap-3 rounded-[10px] bg-primary/5 px-3 py-3 text-left text-primary transition-colors hover:bg-primary/10"
          >
            <Gift className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Invite friends</span>
              <span className="block truncate text-xs font-medium text-muted-foreground">Earn {invite.label} for every user you invite</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </div>

        <div className="border-y border-border bg-muted/50 px-5 py-3">
          <button
            type="button"
            onClick={() => setSettingsExpanded((value) => !value)}
            className="flex w-full items-center justify-between py-1 text-left"
            aria-expanded={settingsExpanded}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-foreground"><Settings className="h-4 w-4 text-muted-foreground" /> Settings &amp; privacy</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${settingsExpanded ? "rotate-180" : ""}`} />
          </button>
          {settingsExpanded && (
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-3">
              <WebUtilityLink label="Profile & KYC" onClick={() => { onClose(); window.dispatchEvent(new Event("oventric:open-profile-settings")); }} />
              <WebUtilityLink label="Help" onClick={() => go("/help")} />
              <WebUtilityLink label="About" onClick={() => go("/about")} />
              <WebUtilityLink label="Terms" onClick={() => go("/terms")} />
              <WebUtilityLink label="Privacy" onClick={() => go("/privacy")} />
              <WebUtilityLink label="Report problem" onClick={() => go("/report-problem")} />
              <WebUtilityLink label="FAQ" onClick={() => go("/faq")} />
            </div>
          )}
        </div>

        {isAuthenticated && (
          <div className="space-y-2 p-5">
            <button
              type="button"
              onClick={signOut}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-bold text-primary-foreground transition-[filter,transform] hover:brightness-95 active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
            <button
              type="button"
              onClick={() => setDangerExpanded((value) => !value)}
              className="w-full py-2 text-center text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
              aria-expanded={dangerExpanded}
            >
              Danger zone: delete account
            </button>
            {dangerExpanded && (
              <div className="rounded-[10px] border border-destructive/20 bg-destructive/5 p-3 text-xs leading-relaxed text-muted-foreground">
                <p>Deleting your account starts a 30-day soft-deletion window. Sign in during that period to reactivate. After 30 days, all data is permanently removed.</p>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="mt-3 h-9 w-full rounded-[10px] border border-destructive/30 font-bold text-destructive hover:bg-destructive/10"
                >
                  Delete my account
                </button>
              </div>
            )}
          </div>
        )}

        <DeleteAccountModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            onClose();
            navigate({ to: "/" });
          }}
        />
      </div>
    </div>
  );

  const safeContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      data-testid="mega-menu"
      data-variant="safe"
      className="megamenu-render-safe megamenu-lowgpu fixed inset-0 z-[2147483000] overflow-y-auto overscroll-contain bg-[#0b0b0d] text-slate-100"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
      }}
    >
      <div className="megamenu-lowgpu-header">
        <span>Menu</span>
        <button onClick={onClose} aria-label="Close menu" className="megamenu-lowgpu-close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="megamenu-lowgpu-body">
        <div className="megamenu-lowgpu-card megamenu-lowgpu-profile">
          <button
            onClick={() => {
              if (userSlug && userSlug !== "me") {
                onClose();
                navigate({ to: "/profile/$id", params: { id: userSlug } });
              }
            }}
            className="megamenu-lowgpu-avatar"
            aria-label="Open my profile"
          >
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={displayName} initials={userInitial} />
            ) : (
              userInitial
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">
              {isAuthenticated ? displayName : "Guest"}
            </p>
            <p className="truncate text-xs font-semibold text-slate-400">
              {isAuthenticated ? "View your profile" : "Sign in to unlock"}
            </p>
            {isAuthenticated ? <CurrencyPreviewToggle className="mt-2" /> : null}
          </div>
          <button
            onClick={isAppShell ? undefined : toggle}
            disabled={isAppShell}
            aria-label={isAppShell ? "Light mode not available in app yet" : "Toggle color theme"}
            title={isAppShell ? "Light mode is not available in the app yet" : undefined}
            className={`megamenu-lowgpu-icon-button ${isAppShell ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {theme === "dark" || isAppShell ? (
              <Sun className={`w-5 h-5 ${isAppShell ? "text-slate-500" : "text-amber-300"}`} />
            ) : (
              <Moon className="w-5 h-5 text-slate-300" />
            )}
          </button>
        </div>

        <button onClick={doInvite} className="megamenu-lowgpu-invite">
          <span className="megamenu-lowgpu-icon">
            <Gift className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-bold text-white">Invite friends</span>
            <span className="block truncate text-xs font-semibold text-emerald-200">
              Earn {invite.label} for every user you invite
            </span>
          </span>
        </button>

        <div className="megamenu-lowgpu-grid">
          {grid.map((g) => (
            <button key={g.label} onClick={g.onClick} className="megamenu-lowgpu-tile">
              <span className="megamenu-lowgpu-icon">
                <g.icon className="w-5 h-5 text-white" strokeWidth={2.5} />
              </span>
              <span className="truncate text-sm font-bold text-white">{g.label}</span>
            </button>
          ))}
        </div>

        <div className="megamenu-lowgpu-card overflow-hidden">
          <button
            onClick={() => setSettingsExpanded((v) => !v)}
            className="megamenu-lowgpu-row"
            aria-expanded={settingsExpanded}
          >
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="flex-1 text-sm font-bold text-white">Settings &amp; Privacy</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          {settingsExpanded && (
            <div className="megamenu-lowgpu-sublist">
              <SubItem
                icon={Settings}
                label="Settings (Profile & KYC)"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new Event("oventric:open-profile-settings"));
                }}
              />
              <SubItem icon={HelpCircle} label="Help" onClick={() => go("/help")} />
              <SubItem icon={Info} label="About Oventric" onClick={() => go("/about")} />
              <SubItem icon={FileText} label="Terms of Use" onClick={() => go("/terms")} />
              <SubItem icon={Lock} label="Privacy Policy" onClick={() => go("/privacy")} />
              <SubItem icon={Bug} label="Report a problem" onClick={() => go("/report-problem")} />
              <SubItem icon={ListChecks} label="FAQ" onClick={() => go("/faq")} />
            </div>
          )}
        </div>

        {isAuthenticated && (
          <div className="megamenu-lowgpu-card megamenu-lowgpu-danger overflow-hidden">
            <button
              onClick={() => setDangerExpanded((v) => !v)}
              className="megamenu-lowgpu-row"
              aria-expanded={dangerExpanded}
            >
              <Trash2 className="w-5 h-5 text-red-300" />
              <span className="flex-1 text-sm font-bold text-red-100">Danger zone</span>
              <ChevronDown className="w-4 h-4 text-red-200" />
            </button>
            {dangerExpanded && (
              <div className="space-y-3 border-t border-red-500/20 p-4 text-xs leading-relaxed text-red-100">
                <p>
                  Deleting your account starts a 30-day soft-deletion window. Sign in during that
                  period to reactivate. After 30 days, all data is permanently removed.
                </p>
                <button
                  onClick={() => {
                    setDeleteOpen(true);
                  }}
                  className="h-10 w-full rounded-[10px] border border-red-500/60 bg-[#2a1111] text-xs font-bold text-red-100"
                >
                  Delete my account
                </button>
              </div>
            )}
          </div>
        )}

        {isAuthenticated && (
          <button onClick={signOut} className="megamenu-lowgpu-signout">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        )}
      </div>
      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          onClose();
          navigate({ to: "/" });
        }}
      />
    </div>
  );

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="megamenu-render-safe fixed inset-0 z-[2147483000] bg-[#0b0b0d] text-slate-200 overflow-y-auto overscroll-contain"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-[#0b0b0d] border-b border-white/10">
          <span className="text-sm font-bold text-white">Menu</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-2 rounded-[10px] hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-16">
          {/* User header + theme toggle */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#141418] border border-white/10">
            <button
              onClick={() => {
                if (userSlug && userSlug !== "me") {
                  onClose();
                  navigate({ to: "/profile/$id", params: { id: userSlug } });
                }
              }}
              className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-[#1E1E24] border border-white/10 grid place-items-center text-sm font-bold text-emerald-300"
              aria-label="Open my profile"
            >
              <AvatarImage
                src={avatarUrl}
                alt={displayName}
                initials={(displayName[0] ?? "?").toUpperCase()}
              />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {isAuthenticated ? displayName : "Guest"}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {isAuthenticated ? "View your profile" : "Sign in to unlock"}
              </p>
            </div>
            <button
              onClick={isAppShell ? undefined : toggle}
              disabled={isAppShell}
              aria-label={isAppShell ? "Light mode not available in app yet" : "Toggle color theme"}
              title={isAppShell ? "Light mode is not available in the app yet" : undefined}
              className={`shrink-0 w-11 h-11 grid place-items-center rounded-full border ${isAppShell ? "bg-[#1E1E24] border-white/10 opacity-50 cursor-not-allowed" : "bg-[#1E1E24] border-white/10 hover:border-emerald-400/50"}`}
            >
              {theme === "dark" || isAppShell ? (
                <Sun className={`w-5 h-5 ${isAppShell ? "text-slate-500" : "text-amber-300"}`} />
              ) : (
                <Moon className="w-5 h-5 text-slate-300" />
              )}
            </button>
          </div>

          {/* Invite friends */}
          <button
            onClick={doInvite}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30 hover:border-emerald-400/60 transition-colors text-left"
          >
            <span className="w-11 h-11 grid place-items-center rounded-full bg-emerald-500/20 text-emerald-300 shrink-0">
              <Gift className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-white">Invite friends</span>
              <span className="block text-xs text-emerald-200/80">
                Earn {invite.label} for every user you invite
              </span>
            </span>
          </button>

          {/* 2-col grid */}
          <div className="grid grid-cols-2 gap-2">
            {grid.map((g) => (
              <button
                key={g.label}
                onClick={g.onClick}
                className="flex items-center gap-3 p-3 rounded-2xl bg-[#141418] border border-white/10 hover:border-emerald-400/40 transition-colors text-left"
              >
                <span className="w-9 h-9 grid place-items-center rounded-full bg-[#1E1E24] text-white shrink-0">
                  <g.icon className="w-5 h-5" strokeWidth={2.5} />
                </span>
                <span className="text-sm font-semibold text-white truncate">{g.label}</span>
              </button>
            ))}
          </div>

          {/* Settings & Privacy */}
          <div className="rounded-2xl bg-[#141418] border border-white/10 overflow-hidden">
            <button
              onClick={() => setSettingsExpanded((v) => !v)}
              className="w-full flex items-center gap-3 p-4 text-left"
              aria-expanded={settingsExpanded}
            >
              <Settings className="w-5 h-5 text-slate-400" />
              <span className="flex-1 text-sm font-bold text-white">Settings &amp; Privacy</span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${settingsExpanded ? "rotate-180" : ""}`}
              />
            </button>
            {settingsExpanded && (
              <div className="border-t border-white/10 divide-y divide-white/5">
                <SubItem
                  icon={Settings}
                label="Settings (Profile & KYC)"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new Event("oventric:open-profile-settings"));
                  }}
                />
                <SubItem icon={HelpCircle} label="Help" onClick={() => go("/help")} />
                <SubItem icon={Info} label="About Oventric" onClick={() => go("/about")} />
                <SubItem icon={FileText} label="Terms of Use" onClick={() => go("/terms")} />
                <SubItem icon={Lock} label="Privacy Policy" onClick={() => go("/privacy")} />
                <SubItem
                  icon={Bug}
                  label="Report a problem"
                  onClick={() => go("/report-problem")}
                />
                <SubItem icon={ListChecks} label="FAQ" onClick={() => go("/faq")} />
              </div>
            )}
          </div>

          {/* Danger zone */}
          {isAuthenticated && (
            <div className="rounded-2xl bg-[#1a1010] border border-red-500/30 overflow-hidden">
              <button
                onClick={() => setDangerExpanded((v) => !v)}
                className="w-full flex items-center gap-3 p-4 text-left"
                aria-expanded={dangerExpanded}
              >
                <Trash2 className="w-5 h-5 text-red-400" />
                <span className="flex-1 text-sm font-bold text-red-200">Danger zone</span>
                <ChevronDown
                  className={`w-4 h-4 text-red-300 transition-transform ${dangerExpanded ? "rotate-180" : ""}`}
                />
              </button>
              {dangerExpanded && (
                <div className="border-t border-red-500/20 p-4 text-xs text-red-200/90 space-y-3">
                  <p>
                    Deleting your account starts a 30-day soft-deletion window. Sign in during that
                    period to reactivate (face liveness required). After 30 days, all data is
                    permanently removed.
                  </p>
                  <button
                    onClick={() => {
                      setDeleteOpen(true);
                    }}
                    className="w-full h-10 rounded-full bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold hover:bg-red-500/30"
                  >
                    Delete my account
                  </button>
                </div>
              )}
            </div>
          )}

          {isAuthenticated && (
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-[#141418] border border-white/10 text-slate-300 text-sm font-semibold hover:border-red-400/40 hover:text-red-200"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          )}
        </div>
      </div>
      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          onClose();
          navigate({ to: "/" });
        }}
      />
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(!isAppShell ? webContent : lowGpu ? safeContent : content, document.body);
}

function WebMenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-muted"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-primary/8 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function WebUtilityLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[8px] px-2 py-2 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
    >
      {label}
    </button>
  );
}

function SubItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
    >
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="text-sm text-slate-200">{label}</span>
    </button>
  );
}

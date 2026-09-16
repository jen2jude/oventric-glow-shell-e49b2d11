import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Star,
  ShieldCheck,
  LogOut,
  Settings,
  UserCircle2,
  X,
  Upload,
  Eye,
  EyeOff,
  LayoutDashboard,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  getProfileByIdOrSlug,
  updateMyProfile,
  getMyFullProfile,
  deleteMyAccount,
  getLiveReputation,
  type MyFullProfile,
} from "@/lib/profiles.functions";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useKycGate } from "@/lib/kyc-gate/KycGate";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { currencySymbol } from "@/lib/fx-display";
import { currencyDecimals } from "@/lib/currency/africa";
import { AFRICA_COUNTRIES, COUNTRY_META } from "@/lib/currency/africa";

const CURRENCY_SYMBOL = new Proxy({} as Record<Currency, string>, {
  get: (_t, key: string) => currencySymbol(key),
});

function slugify(v: string): string {
  return (
    v
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "architect"
  );
}

function fmtBalance(n: number, c: Currency): string {
  const dp = currencyDecimals(c);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);
}

interface ProfileState {
  displayName: string;
  bio: string;
  avatarDataUrl: string | null;
}

const PROFILE_KEY = "oventric.profile";

function loadProfile(fallbackName: string): ProfileState {
  if (typeof window === "undefined")
    return { displayName: fallbackName, bio: "", avatarDataUrl: null };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (raw) return { displayName: fallbackName, bio: "", avatarDataUrl: null, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { displayName: fallbackName, bio: "", avatarDataUrl: null };
}

export function ProfileDropdown({ trigger = "dropdown" }: { trigger?: "dropdown" | "mega" }) {
  const [open, setOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userId, setUserId] = useState<string>("me");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef(false);
  const triggerId = "profile-dropdown-trigger";
  const menuId = "profile-dropdown-menu";
  const navigate = useNavigate();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639.98px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const {
    tier,
    balances,
    balancesHidden,
    toggleBalancesHidden,
    fullName,
    storeName,
    baseCurrency,
    homeCurrency,
  } = useOnboarding();

  const [profile, setProfile] = useState<ProfileState>(() =>
    loadProfile(fullName || storeName || ""),
  );

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const id = data.session?.user?.id;
      if (id) setUserId(id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Sync default display name once fullName arrives from onboarding
    setProfile((p) => (p.displayName ? p : { ...p, displayName: fullName || storeName || "" }));
  }, [fullName, storeName]);

  // Load the real profile row (name, bio, avatar signed URL) once we know
  // this session's user id.
  const fetchRealProfile = useServerFn(getProfileByIdOrSlug);
  const fetchReputation = useServerFn(getLiveReputation);
  const fetchFx = useServerFn(snapshotFxRates);
  const [liveStars, setLiveStars] = useState<number | null>(null);
  const [verificationTier, setVerificationTier] = useState<string | null>(null);
  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!userId || userId === "me") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchRealProfile({ data: { idOrSlug: userId } });
        if (cancelled || !res.profile) return;
        setProfile((p) => ({
          displayName: res.profile!.displayName || p.displayName,
          bio: res.profile!.bio ?? p.bio,
          avatarDataUrl: res.profile!.avatarUrl ?? p.avatarDataUrl,
        }));
        setVerificationTier(res.profile!.verificationTier ?? null);
      } catch (e) {
        console.error("[ProfileDropdown] real profile load failed", e);
      }
      try {
        const rep = await fetchReputation({ data: { idOrSlug: userId } });
        if (!cancelled && rep.reputation) setLiveStars(rep.reputation.stars);
      } catch (e) {
        console.error("[ProfileDropdown] reputation load failed", e);
      }
      try {
        const fx = await fetchFx();
        if (!cancelled) setFxRates(fx.rates as Record<string, number>);
      } catch (e) {
        console.error("[ProfileDropdown] fx load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, fetchRealProfile, fetchReputation, fetchFx]);

  const getMenuItems = (): HTMLElement[] => {
    if (!menuRef.current) return [];
    return Array.from(
      menuRef.current.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ),
    );
  };

  const closeMenu = (returnFocus = true) => {
    returnFocusRef.current = returnFocus;
    setOpen(false);
  };

  // Return focus to trigger after close
  useEffect(() => {
    if (open) return;
    if (returnFocusRef.current) {
      triggerRef.current?.focus();
      returnFocusRef.current = false;
    }
  }, [open]);

  // Focus first menu item on open
  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => {
      const items = getMenuItems();
      items[0]?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu(true);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Trap Tab focus inside the panel while open. Return-to-trigger is handled
  // by the effect above, so we opt out of the hook's own restore.
  useFocusTrap(menuRef, open, { restoreFocus: false });

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = getMenuItems();
    if (items.length === 0) return;
    const currentIdx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[(currentIdx + 1 + items.length) % items.length];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[(currentIdx - 1 + items.length) % items.length];
      prev?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
    // Tab is intentionally not handled here — focus is trapped inside the
    // panel by useFocusTrap so keyboard users can't accidentally leave the
    // open menu without dismissing it (Esc / outside click).
  };

  const persistProfile = (next: ProfileState) => {
    setProfile(next);
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const initials =
    profile.displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "OV";

  const handle = "@" + slugify(profile.displayName);

  // Tier label derived from persisted verification_tier ("TIER_0/1/2/5"),
  // falling back to the onboarding-derived numeric tier while the profile loads.
  const tierNumeric = (() => {
    if (verificationTier) {
      const m = /TIER_(\d)/.exec(verificationTier);
      if (m) return Number(m[1]);
    }
    return tier;
  })();
  const tierLabel =
    tierNumeric === 0
      ? "Tier 0 · Guest"
      : tierNumeric >= 5
        ? "Tier 5 · Fully verified"
        : tierNumeric >= 2
          ? "Tier 2 · Commerce ready"
          : "Tier 1 · Email verified";
  const reputation = (liveStars ?? 0).toFixed(1);

  const onSignOut = async () => {
    closeMenu(false);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out", {
        description: "Session tokens cleared. Returning to the auth gateway.",
      });
      navigate({ to: "/" });
    } catch (err) {
      toast.error("Sign-out failed", {
        description: err instanceof Error ? err.message : "Could not clear session. Try again.",
      });
    }
  };

  const openSettings = () => {
    closeMenu(false);
    setSettingsOpen(true);
  };

  const avatarBtn = (
    <button
      type="button"
      ref={triggerRef}
      id={triggerId}
      aria-label={trigger === "mega" ? "Open menu" : "Open profile menu"}
      aria-haspopup={trigger === "mega" ? undefined : "menu"}
      aria-expanded={trigger === "mega" ? undefined : open}
      aria-controls={trigger === "mega" ? undefined : open ? menuId : undefined}
      onClick={() => (trigger === "mega" ? setMegaOpen(true) : setOpen((v) => !v))}
      className="rgb-static-border relative w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121214] overflow-hidden"
    >
      <span className="absolute inset-0 flex items-center justify-center bg-neutral-800">
        {profile.avatarDataUrl ? (
          <ResponsiveImage
            sizes="48px"
            src={profile.avatarDataUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <User className="w-6 h-6 text-white/85" strokeWidth={1.75} aria-hidden />
        )}
      </span>
    </button>
  );

  const identityBanner = (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-neutral-800 text-white/85 flex items-center justify-center shrink-0 overflow-hidden">
        {profile.avatarDataUrl ? (
          <ResponsiveImage
            sizes="48px"
            src={profile.avatarDataUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <User className="w-6 h-6" strokeWidth={1.75} aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-white font-black text-sm truncate">{profile.displayName}</div>
        <div className="text-[11px] text-slate-500 font-mono truncate">{handle}</div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              tierNumeric > 0
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-slate-500/15 border-slate-500/40 text-slate-300"
            }`}
          >
            <ShieldCheck className="w-3 h-3" /> {tierLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
            <Star className="w-3 h-3 fill-amber-300" /> {reputation}
          </span>
        </div>
      </div>
    </div>
  );

  const walletSnapshot = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Wallet Snapshot
        </span>
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={toggleBalancesHidden}
          className="text-slate-500 hover:text-slate-300 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus:text-slate-200"
          aria-label={balancesHidden ? "Show balances" : "Hide balances"}
        >
          {balancesHidden ? (
            <EyeOff className="w-3 h-3" aria-hidden />
          ) : (
            <Eye className="w-3 h-3" aria-hidden />
          )}
          {balancesHidden ? "Hidden" : "Visible"}
        </button>
      </div>
      {(() => {
        // Wallet money is held in the home currency; the USD price preview
        // must never change which balance we read or how we label it.
        const baseBal = balances[homeCurrency] ?? 0;
        // Convert base currency amount to USD using live snapshot when available.
        // USD-base rates mean 1 USD = X <currency>, so USD = amount / rate.
        let usdEquivalent = 0;
        if (homeCurrency === "USD") usdEquivalent = baseBal;
        else if (fxRates) {
          const rate = Number(fxRates[homeCurrency]) || 0;
          usdEquivalent = rate > 0 ? baseBal / rate : 0;
        }
        const showUsdTile = homeCurrency !== "USD";
        return (
          <div
            className={`grid gap-2 ${showUsdTile ? "grid-cols-2" : "grid-cols-1"}`}
            aria-label="Wallet balance"
          >
            <div
              className="rounded-[10px] px-2 py-3 text-center bg-emerald-500/15 border border-emerald-400/60 shadow-sm"
              title={`${homeCurrency} is your locked base currency (from your country)`}
            >
              <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">
                {homeCurrency} · Base
              </div>
              <div
                className={`text-xs font-black tabular-nums mt-0.5 ${balancesHidden ? "text-slate-600" : "text-emerald-100"}`}
              >
                {balancesHidden
                  ? "••••••"
                  : `${CURRENCY_SYMBOL[homeCurrency]}${fmtBalance(baseBal, homeCurrency)}`}
              </div>
            </div>
            {showUsdTile && (
              <div
                className="rounded-[10px] px-2 py-3 text-center bg-[#121214] border border-white/5"
                title="USD equivalent — display only, not withdrawable"
              >
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  USD · Equivalent
                </div>
                <div
                  className={`text-xs font-black tabular-nums mt-0.5 ${balancesHidden ? "text-slate-600" : "text-slate-200"}`}
                >
                  {balancesHidden ? "••••••" : `≈ $${fmtBalance(usdEquivalent, "USD")}`}
                </div>
                <div className="text-[8px] text-slate-500 mt-0.5">Not withdrawable</div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );

  const navMatrix = (
    <div className="space-y-1" role="none">
      <Link
        to="/profile/$id"
        params={{ id: userId }}
        role="menuitem"
        tabIndex={-1}
        onClick={() => closeMenu(false)}
        className="flex items-center gap-3 px-2 py-3 rounded-[10px] text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus:bg-white/5 focus:text-white"
      >
        <UserCircle2 className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden />
        <div className="min-w-0">
          <div className="font-semibold truncate">View My Workspace</div>
          <div className="text-[10px] text-slate-500 truncate">
            Your /profile aggregator tab view
          </div>
        </div>
      </Link>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={openSettings}
        className="w-full flex items-center gap-3 px-2 py-3 rounded-[10px] text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus:bg-white/5 focus:text-white"
      >
        <Settings className="w-4 h-4 text-sky-300 shrink-0" aria-hidden />
        <div className="min-w-0">
          <div className="font-semibold truncate">Profile Settings & KYC Edit</div>
          <div className="text-[10px] text-slate-500 truncate">
            Name, bio, avatar, verification docs
          </div>
        </div>
      </button>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={() => {
          closeMenu(false);
          navigate({ to: "/dashboard" });
        }}
        className="w-full flex items-center gap-3 px-2 py-3 rounded-[10px] text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus:bg-white/5 focus:text-white"
      >
        <LayoutDashboard className="w-4 h-4 text-sky-300 shrink-0" aria-hidden />
        <div className="min-w-0">
          <div className="font-semibold truncate">My Dashboard</div>
          <div className="text-[10px] text-slate-500 truncate">
            Digital downloads · contacted sellers
          </div>
        </div>
      </button>
    </div>
  );

  const signOutRow = (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onSignOut}
      className="w-full flex items-center gap-3 px-2 py-3 rounded-[10px] text-sm font-bold text-red-300 bg-red-500/5 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
    >
      <LogOut className="w-4 h-4 shrink-0" aria-hidden />
      Exit Platform / Sign Out
    </button>
  );

  const panelBody = (
    <div className="space-y-4">
      <div className="pb-4 border-b border-white/5">{identityBanner}</div>
      <div className="pb-4 border-b border-white/5">{walletSnapshot}</div>
      <div className="pb-4 border-b border-white/5">{navMatrix}</div>
      <div>{signOutRow}</div>
    </div>
  );

  const mobilePanel =
    open && isMobile && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              aria-hidden
              onClick={() => closeMenu(true)}
              className="fixed inset-0 bg-black/60 z-[90]"
            />
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              tabIndex={-1}
              aria-labelledby={triggerId}
              aria-orientation="vertical"
              aria-modal="true"
              onKeyDown={onMenuKeyDown}
              className="fixed bottom-0 left-0 right-0 w-full rounded-t-2xl border-t border-x border-white/5 bg-[#1E1E24] p-6 pb-8 z-[100] max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200 focus:outline-none"
            >
              <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-4" aria-hidden />
              {panelBody}
            </div>
          </>,
          document.body,
        )
      : null;

  const desktopPanel =
    open && !isMobile ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        tabIndex={-1}
        aria-labelledby={triggerId}
        aria-orientation="vertical"
        onKeyDown={onMenuKeyDown}
        className="absolute top-14 right-0 w-72 rounded-xl border border-white/5 bg-[#1E1E24] p-4 z-[100] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 focus:outline-none"
      >
        {panelBody}
      </div>
    ) : null;

  return (
    <div ref={wrapperRef} className="relative">
      {avatarBtn}
      {desktopPanel}
      {mobilePanel}

      <ProfileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        userId={userId}
        onSave={persistProfile}
      />

      {trigger === "mega" && (
        <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />
      )}
    </div>
  );
}

// ============================================================================
// Settings modal
// ============================================================================

function ProfileSettingsModal({
  open,
  onClose,
  profile,
  userId,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  profile: ProfileState;
  userId: string;
  onSave: (next: ProfileState) => void;
}) {
  const persistProfileRemote = useServerFn(updateMyProfile);
  const loadFullProfile = useServerFn(getMyFullProfile);
  const { ensureKyc, kycCompleted } = useKycGate();

  const [full, setFull] = useState<MyFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState(profile.bio);
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [countryOther, setCountryOther] = useState(false);
  const [address, setAddress] = useState("");
  const [addressPublic, setAddressPublic] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [dobPublic, setDobPublic] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(profile.avatarDataUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwShow, setPwShow] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<{
    email_digest: boolean;
    dm_pings: boolean;
    bounty_invites: boolean;
  }>({
    email_digest: true,
    dm_pings: true,
    bounty_invites: true,
  });
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const deleteAccountRemote = useServerFn(deleteMyAccount);
  const navigateTop = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(dialogRef, open, { initialFocus: closeBtnRef });

  // Load the live profile every time the modal opens so KYC + editable
  // fields reflect the current database state.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadFullProfile({})
      .then((res) => {
        if (cancelled) return;
        const p = res.profile;
        setFull(p);
        if (p) {
          setDisplayName(p.displayName ?? "");
          setUsername(p.username ?? "");
          setBio(p.bio ?? "");
          setPhone(p.phone ?? "");
          setCountry(p.country ?? "");
          setAddress(p.address ?? "");
          setAddressPublic(!!p.addressPublic);
          setDateOfBirth(p.dateOfBirth ?? "");
          setDobPublic(!!p.dobPublic);
          setAvatar(p.avatarUrl ?? profile.avatarDataUrl);
          setNotifPrefs(p.notificationPreferences);
        }
      })
      .catch((e) => {
        console.error("[ProfileSettingsModal] load failed", e);
        if (!cancelled) setLoadError("Couldn't load your profile. Please retry.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    setErrors({});
    return () => {
      cancelled = true;
    };
  }, [open, loadFullProfile, profile.avatarDataUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const onAvatarPick = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file", { description: "Pick a PNG, JPG, or WebP image." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large", { description: "Keep avatars under 2 MB." });
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = "Display name is required.";
    else if (displayName.trim().length > 40) e.displayName = "Keep under 40 characters.";
    if (bio.length > 280) e.bio = "Bio must be under 280 characters.";
    const u = username.trim();
    if (u) {
      if (u.length < 3) e.username = "At least 3 characters.";
      else if (u.length > 24) e.username = "Under 24 characters.";
      else if (!/^[a-zA-Z0-9_]+$/.test(u)) e.username = "Letters, numbers, and underscore only.";
    }
    const p = phone.trim();
    if (p && !/^[+\d][\d\s-]{5,23}$/.test(p)) e.phone = "Enter a valid phone number.";
    if (country.trim().length > 60) e.country = "Under 60 characters.";
    if (address.trim().length > 200) e.address = "Under 200 characters.";
    return e;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Fix the highlighted fields");
      return;
    }
    setSaving(true);
    try {
      let avatarPath: string | null | undefined = undefined;
      if (avatarFile && userId && userId !== "me") {
        const ext = (avatarFile.name.split(".").pop() || "png").toLowerCase();
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (upErr) throw upErr;
        avatarPath = path;
      }
      await persistProfileRemote({
        data: {
          displayName: displayName.trim(),
          bio: bio.trim() || null,
          username: username.trim() || null,
          phone: phone.trim() || null,
          country: country.trim() || null,
          address: address.trim() || null,
          addressPublic,
          dateOfBirth: dateOfBirth.trim() || null,
          dobPublic,
          ...(avatarPath !== undefined ? { avatarPath } : {}),
        },
      });
      onSave({ displayName: displayName.trim(), bio: bio.trim(), avatarDataUrl: avatar });
      try {
        window.dispatchEvent(new CustomEvent("oventric:profile-updated", { detail: { userId } }));
      } catch {
        /* noop */
      }
      toast.success("Profile updated", { description: "Your workspace identity is synced." });
      setAvatarFile(null);

      onClose();
    } catch (err) {
      console.error("[ProfileSettingsModal] save failed", err);
      const message = err instanceof Error ? err.message : "Please try again.";
      if (/username/i.test(message)) setErrors((p) => ({ ...p, username: message }));
      toast.error("Could not save profile", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async () => {
    if (pwNext.length < 8) {
      toast.error("Password too short", { description: "Use at least 8 characters." });
      return;
    }
    if (pwNext !== pwConfirm) {
      toast.error("Passwords don't match");
      return;
    }
    setPwSaving(true);
    try {
      // Verify current password only if the user provided one (magic-link
      // users may not have a password set yet). Supabase permits updateUser
      // on any authenticated session regardless.
      if (pwCurrent.trim()) {
        if (!full?.email) throw new Error("No email on file. Contact support.");
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: full.email,
          password: pwCurrent,
        });
        if (signErr) throw new Error("Current password is incorrect.");
      }
      const { error: updErr } = await supabase.auth.updateUser({ password: pwNext });
      if (updErr) throw updErr;
      toast.success("Password saved", {
        description: "You can now sign in with email + password.",
      });
      setPwCurrent("");
      setPwNext("");
      setPwConfirm("");
      setPwOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast.error("Could not update password", { description: message });
    } finally {
      setPwSaving(false);
    }
  };

  const toggleNotifPref = async (key: "email_digest" | "dm_pings" | "bounty_invites") => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    setNotifSaving(key);
    try {
      await persistProfileRemote({ data: { notificationPreferences: next } });
      toast.success("Preference saved");
    } catch (err) {
      setNotifPrefs(notifPrefs);
      const message = err instanceof Error ? err.message : "Please try again.";
      toast.error("Could not save preference", { description: message });
    } finally {
      setNotifSaving(null);
    }
  };

  const onDeleteAccount = async () => {
    if (!full?.email) {
      toast.error("No email on file", { description: "Contact support to delete this account." });
      return;
    }
    if (deleteConfirmEmail.trim().toLowerCase() !== full.email.toLowerCase()) {
      toast.error("Email doesn't match", {
        description: "Type your account email exactly to confirm.",
      });
      return;
    }
    setDeleting(true);
    try {
      await deleteAccountRemote({ data: { confirmEmail: deleteConfirmEmail.trim() } });
      await supabase.auth.signOut();
      toast.success("Account scheduled for deletion", {
        description: "You have 30 days to contact support to restore it.",
      });
      onClose();
      navigateTop({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast.error("Could not delete account", { description: message });
    } finally {
      setDeleting(false);
    }
  };

  const tierLabel = (t?: string) => {
    switch (t) {
      case "TIER_5":
        return { label: "Tier 5 · Fully verified", tone: "emerald" as const };
      case "TIER_2":
        return { label: "Tier 2 · Commerce ready", tone: "sky" as const };
      case "TIER_1":
        return { label: "Tier 1 · Email verified", tone: "amber" as const };
      default:
        return { label: "Tier 0 · Guest", tone: "slate" as const };
    }
  };
  const tier = tierLabel(full?.verificationTier);
  const tierClasses: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    sky: "bg-sky-50 border-sky-200 text-sky-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    slate: "bg-slate-100 border-slate-200 text-slate-600",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="web-identity-kyc fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-foreground/20 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8"
      onClick={saving ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-2xl focus:outline-none sm:max-h-[calc(100vh-4rem)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-border px-5 py-5 sm:px-8 sm:py-7">
          <div>
            <div
              className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${tierClasses[tier.tone]}`}
            >
              <ShieldCheck className="w-3 h-3" aria-hidden /> {tier.label}
            </div>
            <h2 id={titleId} className="font-wallet-display text-xl font-bold text-foreground sm:text-2xl">
              Identity &amp; KYC
            </h2>
            <p id={descId} className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Manage your public profile, verification, privacy and account security.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close profile settings"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          noValidate
          className="identity-form min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8"
        >
          {loading && (
            <div
              className="text-center py-8 text-xs text-slate-500"
              role="status"
              aria-live="polite"
            >
              Loading your identity…
            </div>
          )}
          {loadError && !loading && (
            <div className="rounded-[10px] border border-red-500/40 bg-red-500/10 p-3 text-[11px] text-red-300">
              {loadError}
            </div>
          )}
          {!loading && (
            <>
              {/* Avatar */}
              <section className="identity-section space-y-4">
                <div className="identity-section-title">Profile information</div>
                <div className="flex items-center gap-4 sm:gap-6">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-muted bg-muted sm:h-24 sm:w-24">
                  {avatar ? (
                    <ResponsiveImage
                      sizes="96px"
                      src={avatar}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <User className="h-9 w-9 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                  )}
                </div>
                <label className="flex-1 cursor-pointer">
                  <div className="rounded-[10px] border border-dashed border-border bg-muted/60 px-4 py-3 text-center transition-colors hover:border-primary/50 hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
                    <Upload className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
                    <div className="text-xs font-semibold text-foreground">Upload a new photo</div>
                    <div className="text-[10px] text-muted-foreground">PNG, JPG or WebP · max 2 MB</div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Upload avatar image"
                    className="sr-only"
                    onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)}
                  />
                </label>
                </div>

              {/* Display name */}
              <div>
                <label
                  htmlFor={`${titleId}-name`}
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                >
                  Display Name
                </label>
                <input
                  id={`${titleId}-name`}
                  className={`w-full bg-[#121214] border rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1E] ${
                    errors.displayName
                      ? "border-red-500/60"
                      : "border-white/10 focus:border-emerald-500/60"
                  }`}
                  value={displayName}
                  maxLength={40}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setErrors((p) => ({ ...p, displayName: "" }));
                  }}
                  aria-invalid={!!errors.displayName}
                  aria-describedby={errors.displayName ? `${titleId}-name-err` : undefined}
                />
                {errors.displayName && (
                  <p
                    id={`${titleId}-name-err`}
                    className="text-[11px] font-semibold text-red-400 mt-1"
                  >
                    {errors.displayName}
                  </p>
                )}
              </div>

              {/* Username */}
              <div>
                <label
                  htmlFor={`${titleId}-username`}
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                >
                  Username{" "}
                  <span className="text-slate-500 font-normal normal-case">
                    · your public handle
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    @
                  </span>
                  <input
                    id={`${titleId}-username`}
                    className={`w-full bg-[#121214] border rounded-[10px] pl-7 pr-3 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1E] ${
                      errors.username
                        ? "border-red-500/60"
                        : "border-white/10 focus:border-emerald-500/60"
                    }`}
                    value={username}
                    maxLength={24}
                    placeholder="jane_doe"
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setErrors((p) => ({ ...p, username: "" }));
                    }}
                    aria-invalid={!!errors.username}
                    aria-describedby={
                      errors.username ? `${titleId}-username-err` : `${titleId}-username-help`
                    }
                  />
                </div>
                {errors.username ? (
                  <p
                    id={`${titleId}-username-err`}
                    className="text-[11px] font-semibold text-red-400 mt-1"
                  >
                    {errors.username}
                  </p>
                ) : (
                  <p id={`${titleId}-username-help`} className="text-[10px] text-slate-500 mt-1">
                    Public URL:{" "}
                    <span className="text-slate-400">
                      /profile/{username.trim() || full?.slug || "your-handle"}
                    </span>
                  </p>
                )}
              </div>

              {/* Bio */}
              <div>
                <label
                  htmlFor={`${titleId}-bio`}
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                >
                  Bio
                </label>
                <textarea
                  id={`${titleId}-bio`}
                  rows={3}
                  className={`w-full bg-[#121214] border rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1E] ${
                    errors.bio ? "border-red-500/60" : "border-white/10 focus:border-emerald-500/60"
                  }`}
                  value={bio}
                  maxLength={280}
                  onChange={(e) => {
                    setBio(e.target.value);
                    setErrors((p) => ({ ...p, bio: "" }));
                  }}
                  placeholder="Payments infra, distributed systems, RLS zealot…"
                  aria-invalid={!!errors.bio}
                  aria-describedby={errors.bio ? `${titleId}-bio-err` : undefined}
                />
                <div className="flex justify-between mt-1">
                  {errors.bio ? (
                    <p id={`${titleId}-bio-err`} className="text-[11px] font-semibold text-red-400">
                      {errors.bio}
                    </p>
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      Displayed on your public workspace.
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 tabular-nums" aria-live="polite">
                    {bio.length}/280
                  </span>
                </div>
              </div>
              </section>

              {/* Contact grid */}
              <section className="identity-section space-y-4">
                <div className="identity-section-title">Contact &amp; region</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor={`${titleId}-phone`}
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                  >
                    Phone
                  </label>
                  <input
                    id={`${titleId}-phone`}
                    inputMode="tel"
                    autoComplete="tel"
                    className={`w-full bg-[#121214] border rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                      errors.phone
                        ? "border-red-500/60"
                        : "border-white/10 focus:border-emerald-500/60"
                    }`}
                    value={phone}
                    placeholder="+234 801 234 5678"
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setErrors((p) => ({ ...p, phone: "" }));
                    }}
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone && (
                    <p className="text-[11px] font-semibold text-red-400 mt-1">{errors.phone}</p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor={`${titleId}-country`}
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                  >
                    Country{" "}
                    {country.trim() && (
                      <span className="text-slate-500 font-normal normal-case">· locked</span>
                    )}
                  </label>
                  {(() => {
                    const locked = !!country.trim();
                    const known =
                      !!COUNTRY_META[country.toUpperCase()] && country.toUpperCase() !== "OTHER";
                    const selectValue = locked
                      ? known
                        ? country.toUpperCase()
                        : "OTHER"
                      : countryOther
                        ? "OTHER"
                        : "";
                    return (
                      <>
                        <select
                          id={`${titleId}-country`}
                          disabled={locked}
                          value={selectValue}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "OTHER") {
                              setCountryOther(true);
                              setCountry("");
                            } else {
                              setCountryOther(false);
                              setCountry(v);
                            }
                            setErrors((p) => ({ ...p, country: "" }));
                          }}
                          className={`w-full bg-[#121214] border rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                            errors.country
                              ? "border-red-500/60"
                              : "border-white/10 focus:border-emerald-500/60"
                          } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <option value="" disabled>
                            Select a country
                          </option>
                          {AFRICA_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.name} · {c.currency}
                            </option>
                          ))}
                          <option value="OTHER">🌍 Other (type your country)</option>
                        </select>
                        {!locked && countryOther && (
                          <input
                            className="mt-2 w-full bg-[#121214] border border-white/10 focus:border-emerald-500/60 rounded-[10px] px-3 py-3 text-sm text-white"
                            placeholder="Type your country"
                            maxLength={60}
                            autoFocus
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                          />
                        )}
                        {locked && !known && (
                          <div className="mt-1 text-xs text-slate-300">{country}</div>
                        )}
                        {locked && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Contact admin to change your country.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor={`${titleId}-address`}
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    Address{" "}
                    <span className="text-slate-500 font-normal normal-case">
                      · optional, for payouts
                    </span>
                  </label>
                  <VisibilityToggle
                    on={addressPublic}
                    label="address"
                    onToggle={() => setAddressPublic((v) => !v)}
                  />
                </div>
                <input
                  id={`${titleId}-address`}
                  autoComplete="street-address"
                  className={`w-full bg-[#121214] border rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                    errors.address
                      ? "border-red-500/60"
                      : "border-white/10 focus:border-emerald-500/60"
                  }`}
                  value={address}
                  maxLength={200}
                  placeholder="Street, City"
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setErrors((p) => ({ ...p, address: "" }));
                  }}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {addressPublic
                    ? "Visible on your public profile."
                    : "Private — only you can see this."}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor={`${titleId}-dob`}
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    Date of birth
                  </label>
                  <VisibilityToggle
                    on={dobPublic}
                    label="date of birth"
                    onToggle={() => setDobPublic((v) => !v)}
                  />
                </div>
                <input
                  id={`${titleId}-dob`}
                  type="date"
                  autoComplete="bday"
                  className="w-full bg-[#121214] border border-white/10 focus:border-emerald-500/60 rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {dobPublic
                    ? "Visible on your public profile."
                    : "Private — only you can see this."}
                </p>
              </div>
              </section>

              {/* Notification preferences */}
              <section className="identity-section space-y-4">
                <div className="identity-section-title">Notification preferences</div>
              <div className="rounded-[10px] border border-border bg-muted/50 p-4 space-y-2">
                <div className="text-xs font-bold text-white uppercase tracking-widest">
                  Notifications
                </div>
                <div className="text-[11px] text-slate-400 -mt-1">
                  Choose which alerts we send. Changes save instantly.
                </div>
                {[
                  {
                    key: "email_digest" as const,
                    label: "Weekly email digest",
                    desc: "Summary of your account activity and sales.",
                  },
                  {
                    key: "dm_pings" as const,
                    label: "Direct message pings",
                    desc: "Notify me when someone messages me.",
                  },
                ].map((item) => {
                  const on = notifPrefs[item.key];
                  const busy = notifSaving === item.key;
                  return (
                    <div key={item.key} className="flex items-center justify-between gap-3 py-1.5">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">{item.label}</div>
                        <div className="text-[11px] text-slate-400 truncate">{item.desc}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={item.label}
                        disabled={busy || loading}
                        onClick={() => toggleNotifPref(item.key)}
                        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${on ? "bg-emerald-500" : "bg-slate-700"} disabled:opacity-60`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
              </section>

              {/* Account & security */}

              <section className="identity-section space-y-4">
                <div className="identity-section-title">Account security</div>
              <div className="rounded-[10px] border border-border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-white">Account email</div>
                    <div className="text-[11px] text-slate-400 break-all">{full?.email ?? "—"}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                    Verified
                  </span>
                </div>
                <div className="border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white">Password</div>
                      <div className="text-[11px] text-slate-500">
                        Change the password used to sign in.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPwOpen((v) => !v)}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-[10px] border border-white/10 bg-[#1E1E24] text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                      aria-expanded={pwOpen}
                    >
                      {pwOpen ? "Cancel" : "Change"}
                    </button>
                  </div>
                  {pwOpen && (
                    <div className="mt-3 space-y-2">
                      <div className="relative">
                        <input
                          type={pwShow ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Current password (leave blank if none)"
                          value={pwCurrent}
                          onChange={(e) => setPwCurrent(e.target.value)}
                          className="w-full bg-[#0F0F12] border border-white/10 rounded-[10px] px-3 py-3 pr-10 text-sm text-white focus:outline-none focus:border-emerald-500/60"
                        />
                        <button
                          type="button"
                          onClick={() => setPwShow((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                          aria-label={pwShow ? "Hide password" : "Show password"}
                        >
                          {pwShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <input
                        type={pwShow ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="New password (min 8 chars)"
                        value={pwNext}
                        onChange={(e) => setPwNext(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/60"
                      />
                      <input
                        type={pwShow ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Confirm new password"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/60"
                      />
                      <button
                        type="button"
                        onClick={onChangePassword}
                        disabled={pwSaving || !pwNext || !pwConfirm}
                        className="w-full text-xs font-black py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-60"
                      >
                        {pwSaving ? "Updating…" : "Update password"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              </section>

              {/* Live KYC status */}
              <section className="identity-section space-y-4">
                <div className="identity-section-title">Identity verification</div>
              <div className="rounded-[10px] border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={`w-4 h-4 ${kycCompleted || full?.kycCompletedAt ? "text-emerald-400" : "text-amber-400"}`}
                      aria-hidden
                    />
                    <span className="text-xs font-bold text-white">Verification status</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${tierClasses[tier.tone]}`}
                  >
                    {tier.label.split("·")[0].trim()}
                  </span>
                </div>
                <ul className="text-[11px] text-slate-400 space-y-1 mb-3">

                  <li className="flex items-center justify-between">
                    <span>Government ID</span>
                    <span
                      className={
                        full?.kycIdUploaded ? "text-emerald-300 font-semibold" : "text-slate-500"
                      }
                    >
                      {full?.kycIdUploaded ? "Uploaded" : "Missing"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Completed</span>
                    <span
                      className={
                        full?.kycCompletedAt ? "text-emerald-300 font-semibold" : "text-slate-500"
                      }
                    >
                      {full?.kycCompletedAt
                        ? new Date(full.kycCompletedAt).toLocaleDateString()
                        : "Not yet"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Joined</span>
                    <span className="text-slate-300 tabular-nums">
                      {full?.joined ? new Date(full.joined).toLocaleDateString() : "—"}
                    </span>
                  </li>
                </ul>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Withdrawals are secured with your 4-digit withdrawal PIN. You'll create it on
                  your first payout and enter it every time you withdraw.
                </p>

              </div>
              </section>

              {/* Danger zone */}
              <div className="rounded-[10px] border border-red-500/30 bg-red-500/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-red-300 uppercase tracking-widest">
                      Danger zone
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Soft-delete this account. Restorable for 30 days via support.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDangerOpen((v) => !v)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-[10px] border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                    aria-expanded={dangerOpen}
                  >
                    {dangerOpen ? "Cancel" : "Delete account"}
                  </button>
                </div>
                {dangerOpen && (
                  <div className="mt-3 space-y-2">
                    <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-0.5">
                      <li>Your sign-in access is revoked immediately.</li>
                      <li>
                        Profile is anonymized; public content stays attributed to{" "}
                        <em>[deleted user]</em>.
                      </li>
                      <li>Auth row is soft-deleted and purged after 30 days.</li>
                    </ul>
                    <label className="block text-[11px] font-semibold text-slate-400">
                      Type <span className="text-red-300">{full?.email ?? "your email"}</span> to
                      confirm
                    </label>
                    <input
                      type="email"
                      autoComplete="off"
                      value={deleteConfirmEmail}
                      onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                      placeholder={full?.email ?? ""}
                      className="w-full bg-[#0F0F12] border border-red-500/30 rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus:border-red-500/70"
                    />
                    <button
                      type="button"
                      onClick={onDeleteAccount}
                      disabled={deleting || !deleteConfirmEmail}
                      className="w-full text-xs font-black py-3 rounded-[10px] bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
                    >
                      {deleting ? "Deleting…" : "Permanently delete my account"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </form>

        <footer className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-w-24 rounded-[10px] border border-border bg-background px-4 py-3 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit as unknown as () => void}
            disabled={saving || loading}
            className="min-w-32 rounded-[10px] bg-primary px-5 py-3 text-xs font-black text-primary-foreground transition-[filter,transform] hover:brightness-95 active:scale-[0.99] disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Eye toggle controlling whether a sensitive field is public or private. */
function VisibilityToggle({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? `Make ${label} private` : `Make ${label} visible to others`}
      title={on ? `Visible to others — click to hide` : `Private — click to show publicly`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        on
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {on ? (
        <Eye className="w-3.5 h-3.5" aria-hidden />
      ) : (
        <EyeOff className="w-3.5 h-3.5" aria-hidden />
      )}
      {on ? "Public" : "Private"}
    </button>
  );
}

// ============================================================================
// Global launcher — lets any surface (e.g. MegaMenu "Settings (Profile & KYC)")
// open the profile + KYC editor by dispatching:
//   window.dispatchEvent(new Event("oventric:open-profile-settings"))
// ============================================================================

export const OPEN_PROFILE_SETTINGS_EVENT = "oventric:open-profile-settings";

export function ProfileSettingsLauncher() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("me");
  const [profile, setProfile] = useState<ProfileState>(() => loadProfile(""));

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_PROFILE_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_PROFILE_SETTINGS_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const id = data.session?.user?.id;
      if (id) setUserId(id);
    });
    setProfile(loadProfile(""));
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  return (
    <ProfileSettingsModal
      open={open}
      onClose={() => setOpen(false)}
      profile={profile}
      userId={userId}
      onSave={(next) => {
        setProfile(next);
        try {
          window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }}
    />
  );
}

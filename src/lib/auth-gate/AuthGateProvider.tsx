import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import {
  Mail,
  ShieldCheck,
  ArrowRight,
  Loader2,
  RotateCw,
  ArrowLeft,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { seedNewUser as seedNewUserFn } from "@/lib/onboarding.functions";
import {
  sendLoginOtpByIdentifier as sendLoginOtpByIdentifierFn,
  signInWithIdentifierPassword as signInWithIdentifierPasswordFn,
} from "@/lib/auth-lookup.functions";

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export type AuthGateContextKey =
  | "generic"
  | "buyer"
  | "seller"
  | "solver"
  | "issuer"
  | "funding"
  | "withdraw"
  | "interaction";

const COPY: Record<AuthGateContextKey, { title: string; subtitle: string }> = {
  generic: {
    title: "Connect your account",
    subtitle: "Sign in with a one-time login link sent to your email.",
  },
  buyer: {
    title: "Secure your access",
    subtitle:
      "Verify your profile in 10 seconds to purchase this digital asset and download files.",
  },
  seller: {
    title: "Claim your storefront",
    subtitle: "Authenticate your email to set up your creator profile and list files for sale.",
  },
  solver: {
    title: "Unlock freelance workspaces",
    subtitle:
      "Verify your profile to place a bid on this bounty and secure your escrow payout rules.",
  },
  issuer: {
    title: "Find elite talent",
    subtitle:
      "Sign up instantly to fund your escrow vault and publish your project on the global board.",
  },
  funding: {
    title: "Initialize banking ledger",
    subtitle: "Verify your account securely to process card, bank, or MoMo ingestion deposits.",
  },
  withdraw: {
    title: "Secure currency clearance",
    subtitle:
      "Verify your identity profile to authorize capital withdrawals to your localized banking networks.",
  },
  interaction: {
    title: "Join the conversation",
    subtitle:
      "Input your email to drop a technical review, provide code feedback, or upvote your peers.",
  },
};

interface AuthGateContextValue {
  isAuthenticated: boolean;
  session: Session | null;
  checked: boolean;
  ensureUserAuthenticated: (
    actionCallback: () => void | Promise<void>,
    contextType?: AuthGateContextKey,
  ) => void;
  openGate: (contextType?: AuthGateContextKey) => void;
  closeGate: () => void;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used inside <AuthGateProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [ctxKey, setCtxKey] = useState<AuthGateContextKey>("generic");
  const [splash, setSplash] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const pendingRef = useRef<null | (() => void | Promise<void>)>(null);
  const splashCbRef = useRef<null | (() => void | Promise<void>)>(null);

  // Detect magic-link failures returned by Supabase in the URL hash
  // (e.g. #error=access_denied&error_code=otp_expired&error_description=...).
  // Open the gate with a prominent retry banner instead of silently swallowing it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || !hash.includes("error")) return;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const errCode = params.get("error_code") || params.get("error");
    const errDesc = params.get("error_description");
    if (!errCode && !errDesc) return;
    let message = "Your sign-in link is invalid or has expired. Send a new link to continue.";
    const code = (errCode || "").toLowerCase();
    if (code.includes("otp_expired") || code.includes("expired")) {
      message = "This sign-in link has expired. Send a new link to continue.";
    } else if (code.includes("access_denied") || code.includes("used")) {
      message =
        "This sign-in link has already been used or was denied. Send a new link to continue.";
    } else if (errDesc) {
      message = decodeURIComponent(errDesc.replace(/\+/g, " "));
    }
    setLinkError(message);
    setCtxKey("generic");
    setGateOpen(true);
    // Strip the error from the URL so a refresh doesn't re-trigger it.
    try {
      const clean = window.location.pathname + window.location.search;
      window.history.replaceState({}, "", clean);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "INITIAL_SESSION"
      )
        return;
      setSession(next);
      setChecked(true);
      if (event === "SIGNED_IN" && next) {
        // Fire the subtle success splash, then run the pending action once
        // the animation has finished.
        const cb = pendingRef.current;
        pendingRef.current = null;
        splashCbRef.current = cb;
        setSplash(true);
        setGateOpen(false);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Anonymous (guest) sessions do NOT count as signed in — otherwise the
  // sign-in / sign-up gate is skipped and users land straight in profile setup.
  const isAnonSession = !!(session?.user as { is_anonymous?: boolean } | undefined)?.is_anonymous;
  const isAuthenticated = !!session && !isAnonSession;

  const ensureUserAuthenticated = useCallback(
    (actionCallback: () => void | Promise<void>, contextType: AuthGateContextKey = "generic") => {
      if (isAuthenticated) {
        void actionCallback();
        return;
      }
      pendingRef.current = actionCallback;
      setCtxKey(contextType);
      setGateOpen(true);
    },
    [isAuthenticated],
  );

  const openGate = useCallback((contextType: AuthGateContextKey = "generic") => {
    setCtxKey(contextType);
    setGateOpen(true);
  }, []);

  const closeGate = useCallback(() => {
    pendingRef.current = null;
    setGateOpen(false);
    setLinkError(null);
  }, []);

  const value = useMemo<AuthGateContextValue>(
    () => ({ isAuthenticated, session, checked, ensureUserAuthenticated, openGate, closeGate }),
    [isAuthenticated, session, checked, ensureUserAuthenticated, openGate, closeGate],
  );

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      {gateOpen && (
        <AuthGateModal
          contextKey={ctxKey}
          onClose={closeGate}
          linkError={linkError}
          onClearLinkError={() => setLinkError(null)}
        />
      )}
      {splash && (
        <NeonSuccessSplash
          onDone={() => {
            const cb = splashCbRef.current;
            splashCbRef.current = null;
            setSplash(false);
            if (cb) void cb();
          }}
        />
      )}
    </AuthGateContext.Provider>
  );
}

function NeonSuccessSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "leave">("enter");
  const doneRef = useRef(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("hold"), 350);
    const t2 = window.setTimeout(() => setPhase("leave"), 1200);
    const t3 = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, 1650);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [onDone]);

  if (typeof document === "undefined") return null;

  const panelState =
    phase === "enter"
      ? "opacity-0 translate-y-4 scale-95"
      : phase === "leave"
        ? "opacity-0 -translate-y-2 scale-95"
        : "opacity-100 translate-y-0 scale-100";

  return createPortal(
    <div
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[300] pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label="Successfully signed in"
    >
      <div
        className={`flex flex-col items-center gap-3 px-7 py-6 rounded-2xl bg-background border border-border shadow-2xl transition-all duration-500 ease-out ${panelState}`}
      >
        <div className="w-20 h-20 rounded-full p-[3px] bg-gradient-to-r from-red-500 via-green-500 to-blue-500">
          <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
            <ShieldCheck className="w-9 h-9 text-emerald-500" aria-hidden />
          </div>
        </div>
        <div className="text-center">
          <div className="text-foreground font-semibold tracking-tight text-lg">Verified.</div>
          <div className="text-muted-foreground font-medium tracking-tight text-base">
            Welcome to Oventric
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Modal — the shared OTP flow, portalled at z-[200]
// ---------------------------------------------------------------------------

const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter a valid email")
  .max(254, "Email is too long")
  .email("Enter a valid email");

const usernameSchema = z
  .string()
  .trim()
  .min(2, "Username must be at least 2 characters")
  .max(24, "Username must be under 24 characters")
  .regex(/^[a-zA-Z0-9_.-]+$/u, "Letters, numbers, . _ - only");

const RESEND_SECONDS = 60;

type Stage = "email" | "otp";
type Mode = "new" | "returning";

function AuthGateModal({
  contextKey,
  onClose,
  linkError,
  onClearLinkError,
}: {
  contextKey: AuthGateContextKey;
  onClose: () => void;
  linkError: string | null;
  onClearLinkError: () => void;
}) {
  const [mode, setMode] = useState<Mode>("new");
  const [stage, setStage] = useState<Stage>("email");
  const [returningMethod, setReturningMethod] = useState<"password" | "otp">("password");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState(""); // returning user: email or username
  const [emailError, setEmailError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const sendLoginOtpByIdentifier = useServerFn(sendLoginOtpByIdentifierFn);
  const signInWithIdentifierPassword = useServerFn(signInWithIdentifierPasswordFn);

  const humanizeError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes("token has expired") || m.includes("expired"))
      return "That login link expired. Tap Resend to get a fresh one.";
    if (m.includes("invalid") && m.includes("token"))
      return "That login link isn't valid. Try the code from the email or tap Resend.";
    if (m.includes("rate limit") || m.includes("too many"))
      return "Too many attempts. Wait a moment before trying again.";
    if (m.includes("network") || m.includes("fetch"))
      return "Network hiccup. Check your connection and retry.";
    return msg;
  };

  const copy = COPY[contextKey] ?? COPY.generic;

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendIn]);

  // Lock body scroll while gate is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sendCode = useCallback(async () => {
    setEmailError(null);
    setUsernameError(null);
    setFlash(null);
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setEmailError(parsedEmail.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    if (username.trim()) {
      const parsedUser = usernameSchema.safeParse(username);
      if (!parsedUser.success) {
        setUsernameError(parsedUser.error.issues[0]?.message ?? "Invalid username");
        return;
      }
    }
    setSending(true);
    try {
      // Include emailRedirectTo so the activation link verifies the account automatically.
      const { error } = await supabase.auth.signInWithOtp({
        email: parsedEmail.data,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
          data: username.trim() ? { username: username.trim() } : undefined,
        },
      });

      if (error) throw error;
      setStage("otp");
      setResendIn(RESEND_SECONDS);
      setFlash(`Activation link sent to ${parsedEmail.data}`);
    } catch (err) {
      setEmailError(humanizeError(err instanceof Error ? err.message : "Could not send code"));
    } finally {
      setSending(false);
    }
  }, [email, username]);

  const sendReturningCode = useCallback(async () => {
    setIdentifierError(null);
    setFlash(null);
    const raw = identifier.trim();
    if (raw.length < 2) {
      setIdentifierError("Enter your email or username");
      return;
    }
    setSending(true);
    try {
      // Server-side dispatch: never exposes the resolved email to the client.
      // If the identifier is a bare email, we still route through the server
      // fn so the response shape (masked email only) is uniform.
      if (raw.includes("@")) {
        const parsed = emailSchema.safeParse(raw);
        if (!parsed.success) {
          setIdentifierError(parsed.error.issues[0]?.message ?? "Invalid email");
          setSending(false);
          return;
        }
      }
      const res = await sendLoginOtpByIdentifier({
        data: { identifier: raw, redirectTo: window.location.origin },
      });
      if (!res.sent) {
        throw new Error("No account found. Try signing up as a new user.");
      }
      // Keep raw email out of client state — we rely on `identifier` at verify time.
      setEmail("");
      setStage("otp");
      setResendIn(RESEND_SECONDS);
      setFlash(res.maskedEmail ? `Login link sent to ${res.maskedEmail}` : "Login link sent");
    } catch (err) {
      setIdentifierError(humanizeError(err instanceof Error ? err.message : "Could not send code"));
    } finally {
      setSending(false);
    }
  }, [identifier, sendLoginOtpByIdentifier]);

  const signInWithPassword = useCallback(async () => {
    setIdentifierError(null);
    setPasswordError(null);
    setFlash(null);
    const raw = identifier.trim();
    if (raw.length < 2) {
      setIdentifierError("Enter your email or username");
      return;
    }
    if (password.length < 6) {
      setPasswordError("Enter your password");
      return;
    }
    setSending(true);
    try {
      // Server-side sign-in returns session tokens; raw email never crosses back.
      const res = await signInWithIdentifierPassword({
        data: { identifier: raw, password },
      });
      if (!res.ok || !res.session) {
        setPasswordError("Wrong email or password.");
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: res.session.access_token,
        refresh_token: res.session.refresh_token,
      });
      if (setErr) {
        setPasswordError(humanizeError(setErr.message));
        return;
      }
      // SIGNED_IN listener in provider closes modal + fires splash + pending action.
    } catch (err) {
      setIdentifierError(humanizeError(err instanceof Error ? err.message : "Could not sign in"));
    } finally {
      setSending(false);
    }
  }, [identifier, password, signInWithIdentifierPassword]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-wallet-copy/45 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[440px]">
        <div className="overflow-hidden rounded-[10px] border border-wallet-line bg-wallet-panel shadow-2xl">
          {stage === "email" && (
            <div className="flex border-b border-wallet-line" role="tablist" aria-label="Account access">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "returning"}
                onClick={() => {
                  setMode("returning");
                  setEmailError(null);
                  setUsernameError(null);
                }}
                className={`flex-1 border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${mode === "returning" ? "border-wallet-crimson text-wallet-copy" : "border-transparent text-wallet-copy-muted hover:text-wallet-copy"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "new"}
                onClick={() => {
                  setMode("new");
                  setIdentifierError(null);
                }}
                className={`flex-1 border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${mode === "new" ? "border-wallet-crimson text-wallet-copy" : "border-transparent text-wallet-copy-muted hover:text-wallet-copy"}`}
              >
                Create account
              </button>
            </div>
          )}
          <div className="relative bg-wallet-panel p-6 sm:p-10">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-[10px] p-2 text-wallet-copy-muted transition-colors hover:bg-wallet-muted hover:text-wallet-copy disabled:opacity-40"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <header className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-[10px] border border-wallet-line bg-wallet-muted">
                {stage === "email" ? (
                  <Mail className="h-5 w-5 text-primary" aria-hidden />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
                )}
              </div>
              <h1 className="font-wallet-display text-3xl font-semibold text-wallet-copy">
                {stage === "otp"
                  ? "Verify your email"
                  : mode === "new"
                    ? "Let's get started"
                    : "Welcome back"}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-wallet-copy-muted">
                {stage === "otp"
                  ? `Click the activation link sent to ${email || "your email"}. It will verify you automatically.`
                  : mode === "new"
                    ? copy.subtitle
                    : "Sign in with your email or username — we'll send a one-time login link."}
              </p>
            </header>

            {linkError && stage === "email" && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-destructive/30 bg-destructive/5 p-3"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold leading-snug text-destructive">
                    Sign-in link failed
                  </p>
                  <p className="text-[11px] text-red-200/80 mt-0.5 leading-relaxed">{linkError}</p>
                  <button
                    type="button"
                    onClick={onClearLinkError}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300 hover:text-emerald-200"
                  >
                    <RotateCw className="w-3 h-3" /> Dismiss & try again
                  </button>
                </div>
              </div>
            )}

            {stage === "email" ? (
              <div className="relative overflow-hidden">
                <div
                  className="flex w-[200%] transition-transform duration-300 ease-out"
                  style={{ transform: mode === "new" ? "translateX(0)" : "translateX(-50%)" }}
                >
                  {/* --- New user form --- */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (mode === "new") void sendCode();
                    }}
                    noValidate
                    className="w-1/2 shrink-0 space-y-4 pr-1"
                    aria-hidden={mode !== "new"}
                  >
                    <div>
                      <label
                        htmlFor="gate-email"
                        className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-wallet-copy-muted"
                      >
                        Email address
                      </label>
                      <input
                        id="gate-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailError(null);
                        }}
                        placeholder="you@builder.io"
                        aria-invalid={!!emailError}
                        tabIndex={mode === "new" ? 0 : -1}
                        className={`min-h-12 w-full rounded-[10px] border bg-wallet-muted px-4 py-3 text-sm text-wallet-copy outline-hidden placeholder:text-wallet-copy-faint focus:bg-wallet-panel focus:ring-2 focus:ring-wallet-crimson/15 ${
                          emailError
                            ? "border-red-500/70"
                            : "border-wallet-line focus:border-wallet-crimson"
                        }`}
                      />
                      {emailError && (
                        <p className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                          {emailError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="gate-username"
                        className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-wallet-copy-muted"
                      >
                        Username{" "}
                        <span className="font-normal normal-case text-wallet-copy-faint">(optional)</span>
                      </label>
                      <input
                        id="gate-username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          setUsernameError(null);
                        }}
                        placeholder="sovereign_architect"
                        aria-invalid={!!usernameError}
                        tabIndex={mode === "new" ? 0 : -1}
                        className={`min-h-12 w-full rounded-[10px] border bg-wallet-muted px-4 py-3 text-sm text-wallet-copy outline-hidden placeholder:text-wallet-copy-faint focus:bg-wallet-panel focus:ring-2 focus:ring-wallet-crimson/15 ${
                          usernameError
                            ? "border-red-500/70"
                            : "border-wallet-line focus:border-wallet-crimson"
                        }`}
                      />
                      {usernameError && (
                        <p className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                          {usernameError}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={sending}
                      tabIndex={mode === "new" ? 0 : -1}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-wallet-crimson text-sm font-bold text-wallet-on-crimson shadow-sm transition-colors hover:bg-wallet-crimson-strong disabled:opacity-60"
                    >
                      {sending && mode === "new" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                        </>
                      ) : (
                        <>
                          Send login link <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-wallet-copy-muted">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("returning")}
                        className="font-bold text-wallet-crimson hover:text-wallet-crimson-strong"
                      >
                        Click here to sign in
                      </button>
                    </p>
                  </form>

                  {/* --- Returning user form --- */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (mode !== "returning") return;
                      if (returningMethod === "password") void signInWithPassword();
                      else void sendReturningCode();
                    }}
                    noValidate
                    className="w-1/2 shrink-0 space-y-4 pl-1"
                    aria-hidden={mode !== "returning"}
                  >
                    <div
                      role="tablist"
                      aria-label="Sign-in method"
                      className="flex items-center gap-1 rounded-[10px] border border-wallet-line bg-wallet-muted p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={returningMethod === "password"}
                        onClick={() => {
                          setReturningMethod("password");
                          setPasswordError(null);
                        }}
                        tabIndex={mode === "returning" ? 0 : -1}
                        className={`flex-1 h-8 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors ${
                          returningMethod === "password"
                            ? "bg-wallet-panel text-wallet-copy shadow-xs"
                            : "text-wallet-copy-muted hover:text-wallet-copy"
                        }`}
                      >
                        Password
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={returningMethod === "otp"}
                        onClick={() => setReturningMethod("otp")}
                        tabIndex={mode === "returning" ? 0 : -1}
                        className={`flex-1 h-8 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors ${
                          returningMethod === "otp"
                            ? "bg-wallet-panel text-wallet-copy shadow-xs"
                            : "text-wallet-copy-muted hover:text-wallet-copy"
                        }`}
                      >
                        Email code
                      </button>
                    </div>

                    <div>
                      <label
                        htmlFor="gate-identifier"
                        className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-wallet-copy-muted"
                      >
                        Email or username
                      </label>
                      <input
                        id="gate-identifier"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          setIdentifierError(null);
                        }}
                        placeholder="you@builder.io or sovereign_architect"
                        aria-invalid={!!identifierError}
                        tabIndex={mode === "returning" ? 0 : -1}
                        className={`min-h-12 w-full rounded-[10px] border bg-wallet-muted px-4 py-3 text-sm text-wallet-copy outline-hidden placeholder:text-wallet-copy-faint focus:bg-wallet-panel focus:ring-2 focus:ring-wallet-crimson/15 ${
                          identifierError
                            ? "border-red-500/70"
                            : "border-wallet-line focus:border-wallet-crimson"
                        }`}
                      />
                      {identifierError && (
                        <p className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                          {identifierError}
                        </p>
                      )}
                    </div>

                    {returningMethod === "password" && (
                      <div>
                        <label
                          htmlFor="gate-password"
                          className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-wallet-copy-muted"
                        >
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id="gate-password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              setPasswordError(null);
                            }}
                            placeholder="••••••••"
                            aria-invalid={!!passwordError}
                            tabIndex={mode === "returning" ? 0 : -1}
                            className={`min-h-12 w-full rounded-[10px] border bg-muted py-3 pl-4 pr-11 text-sm text-foreground outline-hidden placeholder:text-wallet-copy-faint focus:bg-wallet-panel focus:ring-2 focus:ring-wallet-crimson/15 ${
                              passwordError
                                ? "border-red-500/70"
                                : "border-wallet-line focus:border-wallet-crimson"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={mode === "returning" ? 0 : -1}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            aria-pressed={showPassword}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-wallet-copy-muted hover:text-wallet-copy"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {passwordError && (
                          <p className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                            {passwordError}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={sending}
                      tabIndex={mode === "returning" ? 0 : -1}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-wallet-crimson text-sm font-bold text-wallet-on-crimson shadow-sm transition-colors hover:bg-wallet-crimson-strong disabled:opacity-60"
                    >
                      {sending && mode === "returning" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />{" "}
                          {returningMethod === "password" ? "Signing in…" : "Sending…"}
                        </>
                      ) : returningMethod === "password" ? (
                        <>
                          Sign in <ArrowRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Send login link <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-wallet-copy-muted">
                      New to Oventric?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("new")}
                        className="font-bold text-wallet-crimson hover:text-wallet-crimson-strong"
                      >
                        Create an account
                      </button>
                    </p>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[10px] border border-wallet-crimson/20 bg-wallet-crimson/5 px-4 py-4 text-center">
                  <Mail className="mx-auto mb-2 h-5 w-5 text-wallet-crimson" aria-hidden />
                  <p className="text-sm font-semibold text-wallet-copy">
                    Click the activation link in your email.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-wallet-copy-muted">
                    The link automatically verifies your email and signs you in to Oventric.
                  </p>
                </div>

                <div className="flex items-center justify-between text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setStage("email");
                      setFlash(null);
                    }}
                    className="inline-flex min-h-11 items-center gap-1 px-1 text-wallet-copy-muted hover:text-wallet-copy disabled:opacity-40"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (resendIn === 0)
                        void (mode === "returning" ? sendReturningCode() : sendCode());
                    }}
                    disabled={resendIn > 0 || sending}
                    className="inline-flex min-h-11 items-center gap-1 px-1 font-semibold text-wallet-crimson hover:text-wallet-crimson-strong disabled:text-wallet-copy-muted"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${sending ? "animate-spin" : ""}`} />
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend link"}
                  </button>
                </div>
              </div>
            )}

            {flash && stage === "otp" && (
              <p className="mt-4 text-center text-[11px] text-wallet-crimson">{flash}</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

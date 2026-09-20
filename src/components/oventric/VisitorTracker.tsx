import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "oventric:visitor-id";
const SESSION_KEY = "oventric:visit-session";

function id() {
  try {
    return crypto.randomUUID();
  } catch {
    return `v${Date.now()}${Math.random().toString(16).slice(2)}`;
  }
}

function visitorId(): string {
  try {
    let v = window.localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = id();
      window.localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

function sessionId(): string {
  try {
    let s = window.sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = id();
      window.sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return "anon";
  }
}

/**
 * Records one page view per route change. Ids live in the browser's own
 * storage; everything geographic is resolved server-side from the request.
 * Admin screens are never counted.
 */
export function VisitorTracker() {
  const location = useLocation();
  const path = location.pathname;
  const last = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (path.startsWith("/admin") || path.startsWith("/api")) return;
    if (last.current === path) return;
    last.current = path;

    let cancelled = false;
    const send = async () => {
      let userId: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        userId = data.session?.user?.id ?? null;
      } catch {
        userId = null;
      }
      if (cancelled) return;
      try {
        await fetch("/api/public/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            visitorId: visitorId(),
            sessionId: sessionId(),
            userId,
            path,
            referrer: document.referrer || null,
            language: navigator.language || null,
            screenW: window.screen?.width ?? window.innerWidth,
          }),
        });
      } catch {
        /* analytics must never break the UI */
      }
    };

    const t = window.setTimeout(send, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [path]);

  return null;
}

export default VisitorTracker;

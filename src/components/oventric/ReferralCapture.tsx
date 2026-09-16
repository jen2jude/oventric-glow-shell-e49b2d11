import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { attachReferral } from "@/lib/referrals.functions";

const KEY = "oventric_ref_code";

/**
 * Captures ?ref=CODE from the URL and, once the visitor is signed in, asks the
 * server to record the referral relationship. Attribution only — no reward is
 * created here; rewards are issued by settlement after a first paid purchase.
 */
export function ReferralCapture() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("ref");
      if (code) localStorage.setItem(KEY, code.trim().toUpperCase().slice(0, 32));
    } catch {
      /* ignore */
    }

    let done = false;
    const tryAttach = async () => {
      if (done) return;
      let code: string | null = null;
      try {
        code = localStorage.getItem(KEY);
      } catch {
        return;
      }
      if (!code) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      done = true;
      try {
        await attachReferral({ data: { code } });
      } catch {
        /* best-effort */
      }
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    };

    void tryAttach();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void tryAttach();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}

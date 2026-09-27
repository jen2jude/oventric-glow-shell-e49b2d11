import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "oventric:viewer-key";

function viewerKey(): string {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = crypto.randomUUID();
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return "anon";
  }
}

/** Records a shop visit or product view for the seller's Creator Hub stats. Deduped server-side (30 min). */
export function useSellerView(
  kind: "shop_visit" | "product_view",
  sellerId: string | null | undefined,
  productId?: string | null,
) {
  useEffect(() => {
    if (!sellerId) return;
    void supabase
      .rpc("log_seller_view", {
        _seller_id: sellerId,
        _product_id: (productId ?? null) as string,
        _kind: kind,
        _viewer_key: viewerKey(),
      })
      .then(() => undefined, () => undefined);
  }, [kind, sellerId, productId]);
}

// Remember when the viewer last tapped inside a post (feed article or showcase sheet)
let lastPostTap = 0;
let lastPostProfilePath: string | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      const t = e.target as Element | null;
      if (!t?.closest?.("article, [data-post-origin]")) return;
      lastPostTap = Date.now();
      const a = t.closest("a[href]") as HTMLAnchorElement | null;
      try {
        lastPostProfilePath = a ? new URL(a.href, location.href).pathname : null;
      } catch {
        lastPostProfilePath = null;
      }
    },
    true,
  );
}

/** Records a profile visit; flagged "from a post" when the visitor arrived by tapping inside a post. */
export function useProfileVisit(profileUserId: string | null | undefined) {
  useEffect(() => {
    if (!profileUserId) return;
    // Exact when the tap was on a link: it must lead to this very page.
    // Button-driven navigation (no link) falls back to a short 1.5s window.
    const age = Date.now() - lastPostTap;
    const fromPost = lastPostProfilePath
      ? age < 10000 && lastPostProfilePath === location.pathname
      : age < 1500;
    lastPostTap = 0;
    lastPostProfilePath = null;
    void supabase
      .rpc("log_seller_view", {
        _seller_id: profileUserId,
        _product_id: null as unknown as string,
        _kind: fromPost ? "profile_visit_post" : "profile_visit",
        _viewer_key: viewerKey(),
      })
      .then(() => undefined, () => undefined);
  }, [profileUserId]);
}

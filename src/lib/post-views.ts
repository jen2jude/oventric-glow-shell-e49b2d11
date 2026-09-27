import { supabase } from "@/integrations/supabase/client";

/** One view per post per browser session, counted once half the post is on screen. */
const viewedPostIds = new Set<string>();

export function trackPostView(postId: string) {
  return (el: HTMLElement | null) => {
    if (!el || viewedPostIds.has(postId) || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !viewedPostIds.has(postId)) {
            viewedPostIds.add(postId);
            io.disconnect();
            void (supabase as any).rpc("increment_post_view", { _post_id: postId });
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
  };
}

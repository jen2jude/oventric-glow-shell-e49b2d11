import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CreatorPostSheet } from "@/components/oventric/app/CreatorPostSheet";
import { getCreatorPost, type CreatorPostDTO } from "@/lib/creators.functions";

/**
 * Global handler for `?creatorPost=<id>` links (e.g. "New creator content"
 * notifications). Works on any page, app or website: switches to the Creator
 * Hub and opens the exact post in the slide-up player with sound.
 */
export function CreatorPostDeepLink() {
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const load = useServerFn(getCreatorPost);
  const [post, setPost] = useState<CreatorPostDTO | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("creatorPost");
    if (!id) return;
    url.searchParams.delete("creatorPost");
    window.history.replaceState(window.history.state, "", url.toString());
    window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section: "Creators" } }));
    void load({ data: { postId: id } })
      .then((p) => p && setPost(p))
      .catch(() => {});
  }, [search, load]);

  return <CreatorPostSheet post={post} onClose={() => setPost(null)} />;
}

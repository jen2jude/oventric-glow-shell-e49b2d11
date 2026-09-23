import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProfileEcosystem, type ProfileEcosystem } from "@/lib/ecosystem.functions";
import { listMyCollections } from "@/lib/collections.functions";
import { buildProfileSections, type VisibleSection } from "./sections";

/**
 * Loads a person's ecosystem summary and derives the adaptive section list.
 * Shared by the profile hub, seller shop panels and cross-entity link rows.
 * Owners also see their private boards (e.g. "Saved") in the collections count.
 */
export function useProfileEcosystem(idOrSlug: string | null | undefined, isOwner = false) {
  const load = useServerFn(getProfileEcosystem);
  const loadMine = useServerFn(listMyCollections);
  const [data, setData] = useState<ProfileEcosystem | null>(null);
  const [ownBoards, setOwnBoards] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!idOrSlug) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    load({ data: { idOrSlug } })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idOrSlug, load]);

  useEffect(() => {
    if (!isOwner) {
      setOwnBoards(null);
      return;
    }
    let cancelled = false;
    loadMine()
      .then((res) => {
        if (!cancelled) setOwnBoards(res.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOwner, loadMine, idOrSlug]);

  const counts = { ...(data?.counts ?? {}) } as Record<string, number>;
  if (isOwner && ownBoards !== null) counts.collections = ownBoards;
  const sections: VisibleSection[] = buildProfileSections(counts as never, { isOwner });

  return { ecosystem: data, sections, loading };
}

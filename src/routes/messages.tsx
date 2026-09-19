import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy/notification deep link target. The messaging hub lives inside the
 * single-page shell at `/?section=Messages`, so `/messages` (and
 * `/messages?dm=<peerId>`) just forwards there instead of 404-ing.
 */
export const Route = createFileRoute("/messages")({
  beforeLoad: ({ search }) => {
    const dm = (search as { dm?: string } | undefined)?.dm;
    throw redirect({
      to: "/",
      search: dm ? { section: "Messages", dm } : { section: "Messages" },
      replace: true,
    });
  },
});

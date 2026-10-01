import { createFileRoute } from "@tanstack/react-router";
import { AppSurface } from "@/components/oventric/AppSurface";

const TITLE = "Creators You Follow | Oventric";
const DESC = "The latest work from the Oventric creators you follow.";

export const Route = createFileRoute("/creators_/following")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <AppSurface initialSection="Creators" />,
});

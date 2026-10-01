import { createFileRoute } from "@tanstack/react-router";
import { AppSurface } from "@/components/oventric/AppSurface";

const TITLE = "Discover Creators, Content & Resources | Oventric";
const DESC = "Find Oventric creators by category, tool, content and free resources.";

export const Route = createFileRoute("/creators_/discover")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/creators/discover" }],
  }),
  component: () => <AppSurface initialSection="Creators" />,
});

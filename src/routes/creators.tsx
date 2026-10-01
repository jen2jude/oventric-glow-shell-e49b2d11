import { createFileRoute } from "@tanstack/react-router";
import { AppSurface } from "@/components/oventric/AppSurface";

const TITLE = "Creators — Create. Share. Teach. Sell. Grow. | Oventric";
const DESC =
  "Discover creators, learn new skills, find useful resources and explore digital work from the Oventric creator community.";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/creators" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/creators" }],
  }),
  component: CreatorsRoute,
});

function CreatorsRoute() {
  return <AppSurface initialSection="Creators" />;
}

import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

import { AppSurface } from "@/components/oventric/AppSurface";

const exploreSearchSchema = z.object({
  search: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/explore")({
  validateSearch: zodValidator(exploreSearchSchema),
  head: () => ({
    meta: [
      { title: "Explore — Discover creators and digital products | Oventric" },
      {
        name: "description",
        content:
          "Explore trending creators, shops and digital products on Oventric. Find what to follow, buy and learn from across Africa's creator economy.",
      },
      { property: "og:title", content: "Explore — Discover creators and digital products | Oventric" },
      {
        property: "og:description",
        content:
          "Explore trending creators, shops and digital products on Oventric. Find what to follow, buy and learn from.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/explore" },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/explore" }],
  }),
  component: ExploreRoute,
});

function ExploreRoute() {
  return <AppSurface initialSection="Explore" />;
}

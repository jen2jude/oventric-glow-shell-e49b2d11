import { createFileRoute } from "@tanstack/react-router";

import { AppSurface } from "@/components/oventric/AppSurface";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Feed — What African creators are building | Oventric" },
      { name: "description", content: "Follow posts, product drops and updates from creators, sellers and buyers across the Oventric community." },
      { property: "og:title", content: "Feed — What African creators are building | Oventric" },
      { property: "og:description", content: "Follow posts, product drops and updates from creators, sellers and buyers across the Oventric community." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/feed" },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/feed" }],
  }),
  component: FeedRoute,
});

function FeedRoute() {
  return <AppSurface initialSection="Feed" />;
}

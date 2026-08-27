import { createFileRoute } from "@tanstack/react-router";

import { AppSurface } from "@/components/oventric/AppSurface";

export const Route = createFileRoute("/circles")({
  head: () => ({
    meta: [
      { title: "Circles — Communities for African builders | Oventric" },
      { name: "description", content: "Join niche circles where creators, sellers and buyers share work, ask questions and trade opportunities." },
      { property: "og:title", content: "Circles — Communities for African builders | Oventric" },
      { property: "og:description", content: "Join niche circles where creators, sellers and buyers share work, ask questions and trade opportunities." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/circles" },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/circles" }],
  }),
  component: CirclesRoute,
});

function CirclesRoute() {
  return <AppSurface initialSection="Circles" />;
}

import { createFileRoute } from "@tanstack/react-router";

import { AppSurface } from "@/components/oventric/AppSurface";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oventric — Sell, learn and get paid across Africa" },
      {
        name: "description",
        content:
          "Marketplace, academy, bounties and a multi-currency wallet in one platform. Escrow-protected payments in your own currency.",
      },
      { property: "og:title", content: "Oventric — Sell, learn and get paid across Africa" },
      {
        property: "og:description",
        content:
          "Marketplace, academy, bounties and a multi-currency wallet in one platform. Escrow-protected payments in your own currency.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/" },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/" }],
  }),
  component: Index,
});

function Index() {
  return <AppSurface initialSection="Home" />;
}

import { createFileRoute } from "@tanstack/react-router";

import { AppSurface } from "@/components/oventric/AppSurface";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — Buy digital products from African creators | Oventric" },
      { name: "description", content: "Browse digital products, templates, tools and services from verified African sellers. Escrow-protected checkout in your own currency." },
      { property: "og:title", content: "Marketplace — Buy digital products from African creators | Oventric" },
      { property: "og:description", content: "Browse digital products, templates, tools and services from verified African sellers. Escrow-protected checkout in your own currency." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/marketplace" },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/marketplace" }],
  }),
  component: MarketplaceRoute,
});

function MarketplaceRoute() {
  return <AppSurface initialSection="Marketplace" />;
}

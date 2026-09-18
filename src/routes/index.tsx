import { createFileRoute } from "@tanstack/react-router";

import { AppSurface } from "@/components/oventric/AppSurface";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oventric — Africa's digital marketplace for creators" },
      {
        name: "description",
        content:
          "Buy and sell digital products with escrow-protected payments, cashback and a multi-currency wallet — all priced in your own currency.",
      },
      { property: "og:title", content: "Oventric — Africa's digital marketplace for creators" },
      {
        property: "og:description",
        content:
          "Buy and sell digital products with escrow-protected payments, cashback and a multi-currency wallet — all priced in your own currency.",
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

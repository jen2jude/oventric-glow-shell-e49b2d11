import { createFileRoute } from "@tanstack/react-router";

import { AppSurface } from "@/components/oventric/AppSurface";

export const Route = createFileRoute("/bounties")({
  head: () => ({
    meta: [
      { title: "Bounties — Paid tasks and gigs for African talent | Oventric" },
      { name: "description", content: "Find open bounties and paid tasks posted by founders and teams. Funds are held in escrow and released on delivery." },
      { property: "og:title", content: "Bounties — Paid tasks and gigs for African talent | Oventric" },
      { property: "og:description", content: "Find open bounties and paid tasks posted by founders and teams. Funds are held in escrow and released on delivery." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/bounties" },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/bounties" }],
  }),
  component: BountiesRoute,
});

function BountiesRoute() {
  return <AppSurface initialSection="Bounties" />;
}

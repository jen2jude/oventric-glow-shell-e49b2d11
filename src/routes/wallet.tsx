import { createFileRoute } from "@tanstack/react-router";

import { AppSurface } from "@/components/oventric/AppSurface";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Multi-currency balance, cashback and payouts | Oventric" },
      { name: "description", content: "Manage your Oventric balance, cashback and payouts in your own currency, with escrow protection on every order." },
      { property: "og:title", content: "Wallet — Multi-currency balance, cashback and payouts | Oventric" },
      { property: "og:description", content: "Manage your Oventric balance, cashback and payouts in your own currency, with escrow protection on every order." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/wallet" },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/wallet" }],
  }),
  component: WalletRoute,
});

function WalletRoute() {
  return <AppSurface initialSection="Wallet" />;
}

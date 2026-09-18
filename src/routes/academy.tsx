import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppSurface } from "@/components/oventric/AppSurface";

export const Route = createFileRoute("/academy")({
  // Paused legacy feature — not part of the MVP. The page is retained for
  // future reactivation but is unreachable: every visit redirects home.
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Academy — Courses from African creators | Oventric" },
      { name: "description", content: "Learn from practical courses published by African builders, designers and marketers. Pay in your local currency with escrow protection." },
      { property: "og:title", content: "Academy — Courses from African creators | Oventric" },
      { property: "og:description", content: "Learn from practical courses published by African builders, designers and marketers. Pay in your local currency with escrow protection." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/academy" },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/academy" }],
  }),
  component: AcademyRoute,
});

function AcademyRoute() {
  return <AppSurface initialSection="Academy" />;
}

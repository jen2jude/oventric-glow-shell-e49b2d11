import { createFileRoute } from "@tanstack/react-router";
import { CreatorStudioPage } from "@/components/oventric/creators/CreatorStudioPage";

export const Route = createFileRoute("/creators_/studio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Creator Studio | Oventric" },
      { name: "description", content: "Manage your Oventric creator content, resources, collections, challenges and profile." },
      { property: "og:title", content: "Creator Studio | Oventric" },
      { property: "og:description", content: "The private management center for Oventric creators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreatorStudioPage,
});

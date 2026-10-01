import { createFileRoute, notFound } from "@tanstack/react-router";
import { getChallenge } from "@/lib/challenges.functions";
import { CreatorChallengePage } from "@/components/oventric/creators/CreatorChallengePage";
import { CreatorProfileMissing } from "@/components/oventric/creators/CreatorProfilePage";

export const Route = createFileRoute("/creators_/challenges/$id")({
  loader: async ({ params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
    const detail = await getChallenge({ data: { id: params.id } });
    if (!detail) throw notFound();
    return { detail };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Challenge unavailable | Oventric" }, { name: "robots", content: "noindex" }] };
    const c = loaderData.detail.challenge;
    const title = `${c.title} — Creator Challenge | Oventric`;
    const desc = (c.description || `Join the ${c.title} challenge on Oventric's Creator's Hub.`).slice(0, 160);
    const img = c.coverUrl?.startsWith("https://") ? c.coverUrl : null;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
    };
  },
  component: ChallengeRoute,
  notFoundComponent: CreatorProfileMissing,
  errorComponent: CreatorProfileMissing,
});

function ChallengeRoute() {
  const { detail } = Route.useLoaderData();
  return <CreatorChallengePage detail={detail} />;
}

import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getPublicCreatorProfile } from "@/lib/creators.functions";
import { CreatorProfilePage, CreatorProfileMissing } from "@/components/oventric/creators/CreatorProfilePage";

export const Route = createFileRoute("/creators_/$handle")({
  beforeLoad: ({ params }) => {
    // Canonical form is /creators/@username.
    if (!params.handle.startsWith("@")) {
      throw redirect({ to: "/creators/$handle", params: { handle: `@${params.handle}` }, replace: true });
    }
  },
  loader: async ({ params }) => {
    const profile = await getPublicCreatorProfile({ data: { handle: params.handle } });
    if (!profile) throw notFound();
    return { profile };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Creator not found | Oventric" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.profile;
    const title = `${p.name} (${params.handle}) — Creator on Oventric`;
    const desc = (p.bio || `${p.category ?? "Creator"} sharing content, tutorials and resources on Oventric.`).slice(0, 160);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: p.avatarUrl ? "summary" : "summary" },
        ...(p.avatarUrl?.startsWith("https://")
          ? [
              { property: "og:image", content: p.avatarUrl },
              { name: "twitter:image", content: p.avatarUrl },
            ]
          : []),
      ],
    };
  },
  component: CreatorProfileRoute,
  notFoundComponent: CreatorProfileMissing,
  errorComponent: CreatorProfileMissing,
});

function CreatorProfileRoute() {
  const { profile } = Route.useLoaderData();
  return <CreatorProfilePage profile={profile} />;
}

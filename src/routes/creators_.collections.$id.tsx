import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicCollection } from "@/lib/creators.functions";
import { CreatorCollectionPage } from "@/components/oventric/creators/CreatorCollectionPage";
import { CreatorProfileMissing } from "@/components/oventric/creators/CreatorProfilePage";

export const Route = createFileRoute("/creators_/collections/$id")({
  loader: async ({ params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
    const collection = await getPublicCollection({ data: { id: params.id } });
    if (!collection) throw notFound();
    return { collection };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Collection unavailable | Oventric" }, { name: "robots", content: "noindex" }] };
    const c = loaderData.collection;
    const title = `${c.title} — a collection by ${c.creator.name} | Oventric`;
    const desc = (c.description || `${c.items.length} hand-picked items from ${c.creator.name} on Oventric.`).slice(0, 160);
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
  component: CollectionRoute,
  notFoundComponent: CreatorProfileMissing,
  errorComponent: CreatorProfileMissing,
});

function CollectionRoute() {
  const { collection } = Route.useLoaderData();
  return <CreatorCollectionPage collection={collection} />;
}

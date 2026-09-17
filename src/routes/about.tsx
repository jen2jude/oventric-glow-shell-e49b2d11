import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Globe2, ShieldCheck, Sparkles, Store, Users } from "lucide-react";
import { PublicInfoLayout } from "@/components/oventric/PublicInfoLayout";
import { Button } from "@/components/ui/button";
import aboutImage from "@/assets/public-pages/about-editorial.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Oventric — Our story and mission" },
      {
        name: "description",
        content:
          "Oventric is a multi-vendor tech platform for builders: social feed, marketplace, academy, bounties, and a sovereign wallet.",
      },
      { property: "og:title", content: "About Oventric" },
      {
        property: "og:description",
        content: "One platform for builders — social, marketplace, academy, bounties, wallet.",
      },
      { property: "og:url", content: "https://oventric.com/about" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  const pillars = [
    { icon: Store, title: "A marketplace for digital work", body: "Discover and sell useful digital products through seller-led storefronts." },
    { icon: Users, title: "Built around real people", body: "Profiles, follows, conversations and a newsfeed keep commerce connected to identity." },
    { icon: ShieldCheck, title: "Protected by design", body: "Escrow, verified purchase reviews and clear order records make transactions easier to trust." },
  ];

  return (
    <PublicInfoLayout eyebrow="Our story" title="A better home for digital builders." description="Oventric brings digital commerce, professional identity and community into one dependable place." icon={Sparkles} image={aboutImage} imageAlt="Digital creator tools arranged in a bright Oventric studio">
      <section>
        <p className="text-lg leading-8 text-muted-foreground">
          Independent builders should not need disconnected tools to be discovered, earn from their work and build trusted relationships. Oventric creates one clear path from identity to storefront to purchase.
        </p>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="grid gap-4 py-6 sm:grid-cols-[2.75rem_minmax(0,1fr)]">
              <span className="grid size-11 place-items-center rounded-md bg-accent text-accent-foreground"><pillar.icon className="size-5" /></span>
              <div><h2 className="font-public-display text-lg font-bold">{pillar.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{pillar.body}</p></div>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-12 border-l-2 border-primary pl-5 sm:pl-7">
        <div className="flex items-center gap-2 text-primary"><Globe2 className="size-5" /><h2 className="font-public-display text-xl font-bold text-foreground">Why we exist</h2></div>
        <p className="mt-3 leading-7 text-muted-foreground">We believe digital sales should be protected, payouts should be transparent and discovery should reward what people make—not who they know.</p>
      </section>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild><Link to="/marketplace">Explore the marketplace <ArrowRight /></Link></Button>
        <Button asChild variant="outline"><Link to="/help">Visit help center</Link></Button>
      </div>
    </PublicInfoLayout>
  );
}

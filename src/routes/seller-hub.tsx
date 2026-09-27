import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { SellerDashboard } from "@/components/oventric/dashboard/SellerDashboard";
import { Header } from "@/components/oventric/Header";
import { useIsAppShell } from "@/hooks/use-launch-context";

export const Route = createFileRoute("/seller-hub")({
  head: () => ({
    meta: [
      { title: "Seller Hub — Oventric" },
      { name: "description", content: "Your revenue, shop visits, engagement and growth on Oventric." },
      { property: "og:title", content: "Seller Hub — Oventric" },
      { property: "og:description", content: "Your revenue, shop visits, engagement and growth on Oventric." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SellerHubPage,
});

function SellerHubPage() {
  const isApp = useIsAppShell();
  const navigate = useNavigate();
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else navigate({ to: "/" });
  };

  const title = (
    <div className="flex items-center gap-2">
      <TrendingUp className="size-4 text-newsfeed-violet" />
      <h1 className="text-base font-semibold">Seller Hub</h1>
    </div>
  );

  if (isApp) {
    return (
      <div className="min-h-screen pb-28">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur bg-background/80">
          <button type="button" aria-label="Back" onClick={back} className="rounded-full p-2 -ml-2">
            <ArrowLeft className="size-5" />
          </button>
          {title}
        </header>
        <main className="px-4 pt-2">
          <SellerDashboard />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <button type="button" aria-label="Back" onClick={back} className="rounded-full p-2 -ml-2">
            <ArrowLeft className="size-5" />
          </button>
          {title}
        </div>
        <SellerDashboard />
      </main>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PurchaseAssistantPanel } from "@/components/oventric/PurchaseAssistantPanel";

export const Route = createFileRoute("/purchase-assistant")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Purchase assistant — Oventric" },
      {
        name: "description",
        content:
          "Get a plain-language summary of your latest Oventric purchases, order IDs, sellers and how to download, open or confirm each one.",
      },
      { property: "og:title", content: "Purchase assistant — Oventric" },
      {
        property: "og:description",
        content:
          "Your latest Oventric orders explained, with the next step for every purchase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PurchaseAssistantPage,
});

function PurchaseAssistantPage() {
  return (
    <div className="min-h-screen bg-[#121214] md:bg-slate-50">
      <main className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10">
        <Link
          to="/dashboard"
          search={{ tab: "digital" }}
          className="mb-5 inline-flex items-center gap-2 rounded-[10px] border border-white/10 md:border-slate-200 bg-[#1E1E24] md:bg-white px-3 py-2 text-sm text-slate-300 md:text-slate-600 md:shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> My purchases
        </Link>
        <h1 className="mb-4 text-xl font-bold text-white md:text-slate-900">Purchase assistant</h1>
        <PurchaseAssistantPanel />
      </main>
    </div>
  );
}

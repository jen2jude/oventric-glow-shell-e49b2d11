import { createFileRoute } from "@tanstack/react-router";
import { PublicChrome } from "@/components/oventric/PublicChrome";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund & Dispute Policy — Oventric" },
      {
        name: "description",
        content:
          "How refunds, order disputes, and escrow releases work on Oventric for digital products, services, courses and bounties.",
      },
      { property: "og:title", content: "Oventric Refund & Dispute Policy" },
      {
        property: "og:description",
        content:
          "How refunds, order disputes, and escrow releases work on Oventric for digital products, services, courses and bounties.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://oventric.com/refunds" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/refunds" }],
  }),
  component: RefundsPage,
});

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-white md:text-slate-900">{children}</h2>;
}

function RefundsPage() {
  return (
    <PublicChrome>
      <div className="max-w-3xl mx-auto px-4 py-10 text-slate-200 md:text-slate-800">
        <h1 className="text-3xl md:text-4xl font-black text-white md:text-slate-900">
          Refund &amp; Dispute Policy
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          Applies to every purchase made on Oventric — marketplace items, services, Academy courses
          and bounty escrow.
        </p>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-300 md:text-slate-600">
          <H2>How buyer protection works</H2>
          <p>
            Payments for marketplace orders are held by Oventric until the order is marked complete.
            If something goes wrong before completion, you can open a dispute from the order page
            and our team reviews the chat, the delivery and the listing before deciding.
          </p>

          <H2>Digital products</H2>
          <p>
            Digital items (files, licences, accounts, templates) are refundable when the item was
            never delivered, the delivered file is corrupt or unusable, or the item is materially
            different from the listing. Because digital goods cannot be returned, refunds are not
            issued for change of mind after a working item has been delivered.
          </p>

          <H2>Services and bounties</H2>
          <p>
            Service and bounty funds sit in escrow. If the provider does not start or does not
            deliver within the agreed window, you can cancel and the escrowed amount returns to your
            wallet in full. Once work is accepted, the release is final.
          </p>

          <H2>Courses</H2>
          <p>
            Academy enrolments can be refunded within 7 days of purchase if you have completed less
            than 20% of the course. After that, the enrolment is non-refundable.
          </p>

          <H2>How to request a refund</H2>
          <p>
            Open the order, message the seller first, and if it is not resolved within 24 hours use
            &ldquo;Report a problem&rdquo; on that order to escalate to Oventric support. Approved
            refunds are credited to your Oventric wallet in your home currency within 1–3 business
            days; wallet funds can then be withdrawn using your saved payout method.
          </p>

          <H2>Currency and fees</H2>
          <p>
            Refunds are returned in the currency you were charged in, converted at the rate captured
            at checkout. Payment-processor charges already incurred on a completed payment may not
            be recoverable on partial refunds.
          </p>

          <H2>Cashback and coupons on refunded orders</H2>
          <p>
            Cashback earned on an order is reversed when that order is refunded. If a coupon was
            used on the order, no cashback was earned in the first place — coupons and cashback are
            never combined.
          </p>

          <H2>Chargebacks</H2>
          <p>
            Please raise a dispute with us before contacting your bank. Accounts with fraudulent
            chargebacks may be suspended and outstanding balances withheld.
          </p>

          <p className="pt-4 text-xs text-slate-500">
            Questions? Use the Help centre or report the specific order and our team will respond.
          </p>
        </section>
      </div>
    </PublicChrome>
  );
}

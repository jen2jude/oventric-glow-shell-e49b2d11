import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoLayout } from "@/components/oventric/PublicInfoLayout";
import { Scale } from "lucide-react";
import legalImage from "@/assets/public-pages/legal-editorial.jpg";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Oventric" },
      { name: "description", content: "The terms that govern your use of Oventric." },
      { property: "og:title", content: "Oventric Terms of Use" },
      { property: "og:description", content: "The terms that govern your use of Oventric." },
      { property: "og:url", content: "https://oventric.com/terms" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicInfoLayout eyebrow="Legal & trust" title="Terms of Use" description="The straightforward rules that protect buyers, sellers and the wider Oventric community." icon={Scale} image={legalImage} imageAlt="Balanced scales, secure documents and a protective shield">
        <p className="mb-9 border-b border-border pb-6 text-sm text-muted-foreground">Last updated: September 17, 2026</p>
        <section className="legal-copy space-y-8 text-sm leading-7 text-muted-foreground">
          <div><h2>1. Acceptance</h2>
          <p>
            By creating an account or using Oventric, you agree to these Terms and our Privacy
            Policy.
          </p></div>
          <div><h2>2. Your account</h2>
          <p>
            You are responsible for the security of your login credentials and for all activity
            under your account. Provide accurate information during onboarding and KYC.
          </p></div>
          <div><h2>3. Content</h2>
          <p>
            You retain ownership of what you post. By posting, you grant Oventric a non-exclusive,
            worldwide license to host, display, and distribute your content on the platform. Do not
            post content you do not have the right to share.
          </p></div>
          <div><h2>4. Marketplace</h2>
          <p>
            Digital sales run through 80/20 escrow — sellers receive their share after the buyer
            confirms delivery. Oventric lists digital products only.
          </p></div>
          <div><h2>5. Wallet and payouts</h2>
          <p>
            Payouts in NGN/GHS are processed via Paystack Transfers. USD payouts are processed
            manually. Fees are shown before confirming any transfer.
          </p></div>
          <div><h2>6. Prohibited conduct</h2>
          <p>
            No fraud, harassment, IP infringement, illegal content, or attempts to interfere with
            the platform's operation.
          </p></div>
          <div><h2>7. Termination</h2>
          <p>
            You may delete your account at any time — a 30-day soft-deletion window applies before
            permanent removal. We may suspend or terminate accounts that violate these Terms.
          </p></div>
          <div><h2>8. Disclaimers</h2>
          <p>
            Oventric is provided "as is" without warranties. To the extent permitted by law, we are
            not liable for indirect or consequential damages.
          </p></div>
          <div><h2>9. Changes</h2><p>We may update these Terms; material changes will be announced in Oventric.</p></div>
        </section>
    </PublicInfoLayout>
  );
}

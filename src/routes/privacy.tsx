import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoLayout } from "@/components/oventric/PublicInfoLayout";
import { LockKeyhole } from "lucide-react";
import legalImage from "@/assets/public-pages/legal-editorial.jpg";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Oventric" },
      { name: "description", content: "How Oventric collects, uses, and protects your data." },
      { property: "og:title", content: "Oventric Privacy Policy" },
      {
        property: "og:description",
        content: "How Oventric collects, uses, and protects your data.",
      },
      { property: "og:url", content: "https://oventric.com/privacy" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicInfoLayout eyebrow="Legal & trust" title="Privacy, explained clearly." description="How Oventric collects, uses and protects the information needed to run your account and transactions." icon={LockKeyhole} image={legalImage} imageAlt="Lock, shield and balanced legal documents">
        <p className="mb-9 border-b border-border pb-6 text-sm leading-6 text-muted-foreground">This page is maintained by the Oventric team to answer common privacy questions.</p>
        <section className="legal-copy space-y-8 text-sm leading-7 text-muted-foreground">
          <div><h2>Information we collect</h2>
          <p>
            Account information (name, email, phone, country), profile content you upload (avatar,
            cover, posts, listings), transaction records (wallet activity, orders, payouts), and KYC
            materials when you complete verification.
          </p></div>
          <div><h2>How we use it</h2>
          <p>
            To operate the platform, process payments and payouts, verify identity, prevent fraud,
            and improve the product. We do not sell your personal data.
          </p></div>
          <div><h2>Sharing</h2>
          <p>
            We share limited information with vetted processors that help us run Oventric (payments,
            hosting, email delivery). Public content (posts, listings, profile) is visible to other
            users as expected.
          </p></div>
          <div><h2>Retention</h2>
          <p>
            We retain data while your account is active. Deleting your account starts a 30-day
            window during which the account is inactive and recoverable. After 30 days, associated
            personal data is permanently removed except where retention is required by law.
          </p></div>
          <div><h2>Your rights</h2>
          <p>
            You can access, correct, or export your data from your dashboard. Contact us to make a
            request that isn't self-serve.
          </p></div>
          <div><h2>Security</h2>
          <p>
            Passwords are hashed by our auth provider. Sensitive endpoints are protected by
            row-level security and per-user authentication.
          </p></div>
          <div><h2>Cookies</h2>
          <p>
            We use cookies for authentication and session continuity. Analytics cookies are minimal
            and used to improve the product.
          </p></div>
        </section>
    </PublicInfoLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { PublicChrome } from "@/components/oventric/PublicChrome";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Oventric" },
      { name: "description", content: "The terms that govern your use of Oventric." },
      { property: "og:title", content: "Oventric Terms of Use" },
      { property: "og:description", content: "The terms that govern your use of Oventric." },
      { property: "og:url", content: "https://oventric.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicChrome>
      <div className="max-w-3xl mx-auto px-4 py-10 text-slate-200 md:text-slate-800">
        <h1 className="text-3xl md:text-4xl font-black text-white md:text-slate-900">
          Terms of Use
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="mt-8 space-y-4 text-sm text-slate-300 leading-relaxed md:text-slate-600">
          <h2 className="text-lg font-bold text-white md:text-slate-900">1. Acceptance</h2>
          <p>
            By creating an account or using Oventric, you agree to these Terms and our Privacy
            Policy.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">2. Your account</h2>
          <p>
            You are responsible for the security of your login credentials and for all activity
            under your account. Provide accurate information during onboarding and KYC.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">3. Content</h2>
          <p>
            You retain ownership of what you post. By posting, you grant Oventric a non-exclusive,
            worldwide license to host, display, and distribute your content on the platform. Do not
            post content you do not have the right to share.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">4. Marketplace</h2>
          <p>
            Digital sales run through 80/20 escrow — sellers receive their share after the buyer
            confirms delivery. Oventric lists digital products only.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">5. Wallet and payouts</h2>
          <p>
            Payouts in NGN/GHS are processed via Paystack Transfers. USD payouts are processed
            manually. Fees are shown before confirming any transfer.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">6. Prohibited conduct</h2>
          <p>
            No fraud, harassment, IP infringement, illegal content, or attempts to interfere with
            the platform's operation.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">7. Termination</h2>
          <p>
            You may delete your account at any time — a 30-day soft-deletion window applies before
            permanent removal. We may suspend or terminate accounts that violate these Terms.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">8. Disclaimers</h2>
          <p>
            Oventric is provided "as is" without warranties. To the extent permitted by law, we are
            not liable for indirect or consequential damages.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">9. Changes</h2>
          <p>We may update these Terms; material changes will be announced in-app.</p>
        </section>
      </div>
    </PublicChrome>
  );
}

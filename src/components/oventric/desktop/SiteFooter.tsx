import { Link } from "@tanstack/react-router";
import logo from "@/assets/oventric-logo-dark.png";

export type SiteFooterProps = {
  onSelect: (section: string) => void;
  currency: string;
  flag?: string;
};

export function SiteFooter({ onSelect, currency, flag }: SiteFooterProps) {
  const year = 2026;
  return (
    <footer className="border-t border-slate-200 bg-[#F7F8FA]">
      <div className="mx-auto grid w-full max-w-none grid-cols-2 gap-8 px-5 py-12 sm:px-8 md:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:gap-10 lg:py-14">
        <div>
          <span className="inline-flex items-center">
            <img loading="lazy" decoding="async" src={logo} alt="Oventric" className="h-6 w-auto object-contain" />
          </span>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            One platform for African builders — buy and sell, learn and earn, post bounties, and
            move money in your own currency.
          </p>
          <span className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            {flag && <span aria-hidden>{flag}</span>}
            {currency}
          </span>
        </div>

        <FooterCol title="Product">
          <FooterAction label="Marketplace" onClick={() => onSelect("Marketplace")} />
          <FooterAction label="Academy" onClick={() => onSelect("Academy")} />
          <FooterAction label="Bounties" onClick={() => onSelect("Bounties")} />
          <FooterAction label="Circles" onClick={() => onSelect("Circles")} />
          <FooterAction label="Wallet" onClick={() => onSelect("Wallet")} />
        </FooterCol>

        <FooterCol title="Company">
          <FooterLink to="/about" label="About" />
          <FooterLink to="/blog" label="Blog" />
          <FooterLink to="/advertise" label="Advertise" />
          <FooterLink to="/affiliate" label="Affiliate" />
        </FooterCol>

        <FooterCol title="Support">
          <FooterLink to="/help" label="Help centre" />
          <FooterLink to="/faq" label="FAQ" />
          <FooterLink to="/report-problem" label="Report a problem" />
        </FooterCol>

        <FooterCol title="Legal">
          <FooterLink to="/terms" label="Terms" />
          <FooterLink to="/privacy" label="Privacy" />
        </FooterCol>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex w-full max-w-none flex-col items-center justify-between gap-2 px-5 py-5 text-center sm:flex-row sm:px-8 sm:text-left text-xs text-slate-500">
          <span>&copy; {year} Oventric. All rights reserved.</span>
          <span>Built for Africa&apos;s builders.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">{title}</h3>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link to={to} className="text-sm text-slate-400 transition-colors hover:text-slate-900">
        {label}
      </Link>
    </li>
  );
}

function FooterAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="text-sm text-slate-400 transition-colors hover:text-slate-900"
      >
        {label}
      </button>
    </li>
  );
}

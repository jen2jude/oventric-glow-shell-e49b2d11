import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Youtube } from "lucide-react";
import logo from "@/assets/oventric-logo-dark.png";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.53V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export type SiteFooterProps = {
  onSelect: (section: string) => void;
  currency: string;
  flag?: string;
};

export function SiteFooter({ onSelect: _onSelect, currency, flag }: SiteFooterProps) {
  const year = 2026;
  return (
    <footer className="border-t border-slate-200 bg-[#F7F8FA]">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-8 px-4 py-12 sm:px-6 lg:px-11 md:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:gap-10 lg:py-14">
        <div>
          <span className="inline-flex items-center">
            <img loading="lazy" decoding="async" src={logo} alt="Oventric" className="h-6 w-auto object-contain" />
          </span>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            One platform for African builders — buy and sell digital products and services,
            and move money in your own currency.
          </p>
          <span className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            {flag && <span aria-hidden>{flag}</span>}
            {currency}
          </span>

          <div className="mt-4 flex items-center gap-2">
            <SocialLink href="https://www.facebook.com/oventric" label="Facebook" icon={<Facebook className="h-4 w-4" />} />
            <SocialLink href="https://www.instagram.com/oventrictech" label="Instagram" icon={<Instagram className="h-4 w-4" />} />
            <SocialLink href="https://tiktok.com/@oventric" label="TikTok" icon={<TikTokIcon className="h-4 w-4" />} />
            <SocialLink href="https://youtube.com/@oventric?si=W4Gir4DZB1cA21En" label="YouTube" icon={<Youtube className="h-4 w-4" />} />
          </div>
        </div>

        <FooterCol title="Product">
          <FooterLink to="/marketplace" label="Marketplace" />
          <FooterLink to="/wallet" label="Wallet" />
        </FooterCol>


        <FooterCol title="Company">
          <FooterLink to="/about" label="About" />
          
        </FooterCol>

        <FooterCol title="Support">
          <FooterLink to="/help" label="Help centre" />
          <FooterLink to="/faq" label="FAQ" />
          <FooterLink to="/report-problem" label="Report a problem" />
        </FooterCol>

        <FooterCol title="Legal">
          <FooterLink to="/terms" label="Terms" />
          <FooterLink to="/privacy" label="Privacy" />
          <FooterLink to="/refunds" label="Refunds" />
        </FooterCol>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:flex-row sm:px-6 lg:px-11 sm:text-left text-xs text-slate-500">
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

function SocialLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
    >
      {icon}
    </a>
  );
}

import type { LucideIcon } from "lucide-react";
import {
  BadgeHelp,
  BookOpenText,
  Bug,
  FileText,
  HelpCircle,
  Info,
  LockKeyhole,
  MessageCircleQuestion,
} from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation: Array<{ to: "/about" | "/help" | "/faq" | "/privacy" | "/terms" | "/report-problem"; label: string; icon: LucideIcon }> = [
  { to: "/about", label: "About Oventric", icon: Info },
  { to: "/help", label: "Help center", icon: HelpCircle },
  { to: "/faq", label: "FAQs", icon: MessageCircleQuestion },
  { to: "/privacy", label: "Privacy", icon: LockKeyhole },
  { to: "/terms", label: "Terms", icon: FileText },
  { to: "/report-problem", label: "Report a problem", icon: Bug },
];

export function PublicInfoLayout({
  eyebrow,
  title,
  description,
  icon: Icon,
  image,
  imageAlt,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  image: string;
  imageAlt: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <PublicChrome lightDesktop>
      <div className="web-public-pages min-h-full bg-background text-foreground">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-public-shell lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="border-b border-border bg-secondary p-4 lg:border-b-0 lg:border-r lg:p-6">
              <div className="hidden lg:block">
                <div className="mb-7 flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
                    <BookOpenText className="size-4" />
                  </span>
                  <div>
                    <p className="font-public-display text-sm font-bold">Oventric Guide</p>
                    <p className="text-xs text-muted-foreground">Information & support</p>
                  </div>
                </div>
              </div>

              <nav aria-label="Information pages" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
                {navigation.map((item) => {
                  const active = pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors lg:w-full",
                        active
                          ? "border border-border bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        item.to === "/report-problem" && !active && "text-primary",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-8 hidden border-t border-border pt-6 lg:block">
                <BadgeHelp className="size-5 text-primary" />
                <h2 className="mt-3 font-public-display text-sm font-bold">Need more help?</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Tell us what happened and our support team will review it.
                </p>
                <Button asChild size="sm" className="mt-4 w-full">
                  <Link to="/report-problem">Contact support</Link>
                </Button>
              </div>
            </aside>

            <main className="min-w-0">
              <header className="grid border-b border-border lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.82fr)]">
                <div className="flex min-w-0 flex-col justify-center px-5 py-9 sm:px-9 sm:py-12 lg:px-12 lg:py-16">
                  <div className="flex items-center gap-2 text-primary">
                    <Icon className="size-4" />
                    <p className="text-xs font-bold uppercase tracking-normal">{eyebrow}</p>
                  </div>
                  <h1 className="mt-4 max-w-2xl font-public-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                    {title}
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    {description}
                  </p>
                </div>
                <div className="relative min-h-56 overflow-hidden border-t border-border bg-muted lg:min-h-full lg:border-l lg:border-t-0">
                  <img
                    src={image}
                    alt={imageAlt}
                    width={1408}
                    height={912}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              </header>

              <div className="mx-auto max-w-3xl px-5 py-9 sm:px-9 sm:py-12 lg:px-12 lg:py-14">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </PublicChrome>
  );
}

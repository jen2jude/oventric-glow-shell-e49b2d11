import { Link } from "@tanstack/react-router";
import { Rss, Store, BookOpen } from "lucide-react";

const ACTIONS = [
  { to: "/", search: { section: "Feed" }, label: "Posts", icon: Rss, hint: "Jump to your feed" },
  {
    to: "/dashboard",
    search: { tab: "creator" },
    label: "Seller Hub",
    icon: Store,
    hint: "Manage your business",
  },
  {
    to: "/",
    search: { section: "Marketplace" },
    label: "Assets",
    icon: Store,
    hint: "Marketplace & listings",
  },
  {
    to: "/blog",
    search: undefined,
    label: "Blog",
    icon: BookOpen,
    hint: "Read & publish articles",
  },
] as const;


export function QuickActions() {
  return (
    <div
      className="grid grid-cols-2 gap-3 rounded-[10px] border border-border bg-card p-3 shadow-sm sm:grid-cols-4"
      aria-label="Quick actions"
    >
      {ACTIONS.map((a) => (
        <Link
          key={a.label}
          to={a.to}
          search={a.search as never}
          className="group flex flex-col items-start gap-3 rounded-[10px] border border-border bg-muted p-4 transition hover:border-primary/30 hover:bg-card"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground transition group-hover:text-primary">
            <a.icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-foreground">
              {a.label}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {a.hint}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";

// Blog admin is outside the MVP scope: direct URLs bounce back to the console.
export const Route = createFileRoute("/admin/blog")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  component: () => null,
});

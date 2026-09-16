import { createFileRoute, redirect } from "@tanstack/react-router";

// Blog is not part of the live MVP. The route stays registered but sends
// visitors home; underlying blog data and admin tooling are untouched.
export const Route = createFileRoute("/blog/$slug")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});

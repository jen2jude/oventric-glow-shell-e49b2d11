import { getRouter } from "@/router";

/**
 * Navigate to an in-app path without a full page reload, so the app shell
 * (and its boot splash) stays mounted. External URLs open in a new tab.
 */
export function navigateInApp(url: string | null | undefined) {
  if (!url) return;
  if (/^https?:\/\//i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    void getRouter().navigate({ href: url });
  } catch {
    window.location.assign(url);
  }
}

import type { ReactNode } from "react";

/**
 * Oventric is web-only: every feature is available directly in the browser.
 * These helpers used to gate transactional surfaces behind a native/installed
 * app. They are now pass-throughs kept for compatibility with existing call
 * sites.
 */
export function useAppOnly(): boolean {
  return false;
}

export function AppOnlyGate({
  children,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  from?: string;
}) {
  return <>{children}</>;
}

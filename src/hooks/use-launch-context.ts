import { useEffect, useState } from "react";

/**
 * Oventric is a pure web application: there is no native shell and no
 * installable app build. The launch context is kept as a tiny compatibility
 * shim so existing components keep compiling, but it always resolves to
 * "browser".
 */
export type LaunchContext = "browser";

export function useLaunchContext(): LaunchContext | null {
  const [ctx, setCtx] = useState<LaunchContext | null>(null);
  useEffect(() => setCtx("browser"), []);
  return ctx;
}

/** Always false — the web app has no app-shell mode. */
export function useIsAppShell(): boolean {
  return false;
}

import { useEffect, useRef } from "react";
import { pushBackLayer } from "@/lib/app-resume";
import { useIsAppShell } from "@/hooks/use-launch-context";

/** While `open`, the phone's back button calls `onClose` instead of leaving the app. */
export function useBackClose(open: boolean, onClose: () => void) {
  const isApp = useIsAppShell();
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!open || !isApp) return;
    return pushBackLayer(() => ref.current());
  }, [open, isApp]);
}

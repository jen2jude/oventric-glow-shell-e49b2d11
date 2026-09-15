/**
 * Tiny haptics helper. Uses the browser Vibration API where supported and
 * silently no-ops elsewhere (iOS Safari) so callers never need feature checks.
 */

type HapticKind = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "select";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 24,
  select: 6,
  success: [10, 40, 16],
  warning: [16, 60, 16],
  error: [24, 50, 24, 50, 24],
};

let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export function haptic(kind: HapticKind = "light") {
  if (!enabled) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* ignore */
  }
}

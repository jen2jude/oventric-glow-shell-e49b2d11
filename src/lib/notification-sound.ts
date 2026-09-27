/**
 * Lightweight notification sounds generated with the Web Audio API.
 * No asset downloads, works offline, and respects a user mute preference
 * stored in localStorage ("oventric:sound-muted").
 */

const MUTE_KEY = "oventric:sound-muted";

export type SoundKind = "notification" | "message" | "success" | "coach";

let ctx: AudioContext | null = null;
let unlocked = false;
let lastPlayedAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("oventric:sound-muted", { detail: { muted } }));
}

/**
 * Browsers block audio until the user interacts with the page.
 * Call once on first pointer/key event to prime the audio context.
 */
export function unlockNotificationSound() {
  if (unlocked) return;
  const audio = getCtx();
  if (!audio) return;
  unlocked = true;
  void audio.resume().catch(() => {});
}

const TONES: Record<SoundKind, { freqs: number[]; step: number; gain: number; type: OscillatorType }> = {
  notification: { freqs: [880, 1244.5], step: 0.11, gain: 0.09, type: "sine" },
  message: { freqs: [1046.5, 1396.9, 1567.98], step: 0.075, gain: 0.075, type: "sine" },
  success: { freqs: [659.25, 880, 1318.5], step: 0.09, gain: 0.08, type: "triangle" },
  coach: { freqs: [783.99, 1174.66], step: 0.14, gain: 0.035, type: "sine" },
};

/** Play a short chime. Silently no-ops when muted or audio is unavailable. */
export function playNotificationSound(kind: SoundKind = "notification") {
  if (typeof window === "undefined" || isSoundMuted()) return;
  // throttle bursts (e.g. batched realtime inserts)
  const now = Date.now();
  if (now - lastPlayedAt < 600) return;
  lastPlayedAt = now;

  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().catch(() => {});

  const { freqs, step, gain, type } = TONES[kind];
  const start = audio.currentTime + 0.01;

  freqs.forEach((freq, i) => {
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    const t0 = start + i * step;
    const t1 = t0 + step * 1.6;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    vol.gain.setValueAtTime(0.0001, t0);
    vol.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    vol.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(vol).connect(audio.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  });
}

/**
 * App resume + phone back-button support for the installed app.
 *
 * - Remembers the last screen (path + query) so that when the phone kills the
 *   app in the background, reopening lands back on that screen instead of Home.
 * - Gives open layers (chat, sheets, sections) a history entry so the phone's
 *   back button closes the top layer instead of exiting the app.
 */
const KEY = "oventric:last-screen";
/** Only resume if the app was closed within this window. */
const RESUME_WINDOW_MS = 30 * 60 * 1000;

type Saved = { href: string; t: number };

export function saveLastScreen() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    const qs = url.searchParams.toString();
    const href = `${url.pathname}${qs ? `?${qs}` : ""}`;
    localStorage.setItem(KEY, JSON.stringify({ href, t: Date.now() } satisfies Saved));
  } catch {
    /* storage unavailable */
  }
}

export function readRecentScreen(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    if (!s?.href || Date.now() - s.t > RESUME_WINDOW_MS) return null;
    return s.href;
  } catch {
    return null;
  }
}

/** True when this launch is a quick reopen (used to skip the boot splash). */
export function isQuickResume(): boolean {
  return readRecentScreen() !== null;
}

// ---------------------------------------------------------------------------
// Back-button layer stack
// ---------------------------------------------------------------------------
type Layer = { id: number; close: () => void };
const layers: Layer[] = [];
let nextId = 1;
let ignorePops = 0;
let listening = false;

function onPop() {
  if (ignorePops > 0) {
    ignorePops--;
    return;
  }
  const top = layers.pop();
  top?.close();
}

/** Register an open layer; returns an unregister fn (call when it closes itself). */
export function pushBackLayer(close: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (!listening) {
    window.addEventListener("popstate", onPop);
    listening = true;
  }
  const id = nextId++;
  layers.push({ id, close });
  window.history.pushState({ ...(window.history.state ?? {}), __ovLayer: id }, "");
  return () => {
    const i = layers.findIndex((l) => l.id === id);
    if (i === -1) return; // already closed by the back button
    layers.splice(i, 1);
    // Remove our history entry without triggering another layer's close.
    if (window.history.state?.__ovLayer === id) {
      ignorePops++;
      window.history.back();
    }
  };
}

import { parseYouTubeId } from "./youtube";

export type EmbedProvider = "youtube" | "vimeo" | "facebook" | "telegram" | "other";

export interface VideoEmbed {
  provider: EmbedProvider;
  url: string;
  /** Embeddable iframe src, when the provider supports one. */
  embedUrl: string | null;
}

/** Detects a long-form video link and returns an embeddable source when possible. */
export function parseVideoEmbed(input: string): VideoEmbed | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  const yt = parseYouTubeId(raw);
  if (yt) {
    // Silent autoplay, hidden controls, seamless loop — behaves like a native preview clip.
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      controls: "0",
      rel: "0",
      playsinline: "1",
      loop: "1",
      playlist: yt,
      modestbranding: "1",
      disablekb: "1",
      fs: "0",
    });
    return {
      provider: "youtube",
      url: raw,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?${params.toString()}`,
    };
  }

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((p) => /^\d+$/.test(p));
    // background=1 gives a chromeless, muted, looping autoplay player.
    return {
      provider: "vimeo",
      url: url.toString(),
      embedUrl: id ? `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1&controls=0` : null,
    };
  }

  if (host === "facebook.com" || host === "fb.watch" || host === "m.facebook.com") {
    return {
      provider: "facebook",
      url: url.toString(),
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.toString())}&show_text=false&autoplay=true&mute=1`,
    };
  }

  if (host === "t.me" || host === "telegram.me") {
    const path = url.pathname.replace(/^\/+/, "").replace(/^s\//, "");
    return {
      provider: "telegram",
      url: url.toString(),
      embedUrl: path ? `https://t.me/${path}?embed=1` : null,
    };
  }

  return { provider: "other", url: url.toString(), embedUrl: null };
}

/** True for a plausible Telegram / WhatsApp community link. */
export function isCommunityLink(input: string): boolean {
  const raw = (input ?? "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return (
      host === "t.me" ||
      host === "telegram.me" ||
      host === "chat.whatsapp.com" ||
      host === "wa.me" ||
      host === "whatsapp.com" ||
      host.endsWith(".whatsapp.com")
    );
  } catch {
    return false;
  }
}

import { createFileRoute } from "@tanstack/react-router";

/**
 * Anonymous page-view collector.
 *
 * The browser only supplies non-sensitive presentation data (path, referrer,
 * screen width, language) plus the ids it keeps in its own storage. Country,
 * city and region come from the edge request headers, never from the client,
 * and the row is written with the service-role client so no public role can
 * read or forge analytics data.
 */

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

function parseUa(ua: string) {
  const u = ua.toLowerCase();
  const tablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(u);
  const mobile = /mobi|iphone|ipod|android|blackberry|windows phone/.test(u);
  const device = tablet ? "Tablet" : mobile ? "Mobile" : "Desktop";

  let browser = "Other";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/opr\/|opera/.test(u)) browser = "Opera";
  else if (/samsungbrowser/.test(u)) browser = "Samsung Internet";
  else if (/chrome\/|crios/.test(u)) browser = "Chrome";
  else if (/firefox|fxios/.test(u)) browser = "Firefox";
  else if (/safari/.test(u)) browser = "Safari";

  let os = "Other";
  if (/windows/.test(u)) os = "Windows";
  else if (/iphone|ipad|ipod/.test(u)) os = "iOS";
  else if (/mac os x/.test(u)) os = "macOS";
  else if (/android/.test(u)) os = "Android";
  else if (/linux/.test(u)) os = "Linux";

  return { device, browser, os };
}

const BOT = /bot|crawler|spider|crawling|preview|headless|lighthouse|pingdom|monitor/i;

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ua = request.headers.get("user-agent") ?? "";
          if (BOT.test(ua)) return new Response("ok");

          const body = (await request.json()) as Record<string, unknown>;
          const visitorId = str(body.visitorId, 64);
          const sessionId = str(body.sessionId, 64);
          const path = str(body.path, 300);
          if (!visitorId || !sessionId || !path) {
            return new Response("bad request", { status: 400 });
          }

          const referrer = str(body.referrer, 400);
          let referrerHost: string | null = null;
          if (referrer) {
            try {
              referrerHost = new URL(referrer).hostname.replace(/^www\./, "");
            } catch {
              referrerHost = null;
            }
          }

          const h = request.headers;
          const country = h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country");
          const city = h.get("cf-ipcity") ?? h.get("x-vercel-ip-city");
          const region = h.get("cf-region") ?? h.get("x-vercel-ip-country-region");
          const { device, browser, os } = parseUa(ua);

          const screenRaw = Number(body.screenW);
          const screenW =
            Number.isFinite(screenRaw) && screenRaw > 0 && screenRaw < 20000
              ? Math.round(screenRaw)
              : null;

          const surface = body.surface === "app" ? "app" : "web";

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("visitor_events").insert({
            visitor_id: visitorId,
            surface,
            session_id: sessionId,
            user_id: str(body.userId, 64),
            path,
            referrer,
            referrer_host: referrerHost,
            country: country && country !== "XX" ? country.toUpperCase().slice(0, 2) : null,
            city: city ? decodeURIComponent(city).slice(0, 120) : null,
            region: region ? decodeURIComponent(region).slice(0, 120) : null,
            device,
            browser,
            os,
            language: str(body.language, 20),
            screen_w: screenW,
            user_agent: ua.slice(0, 400),
          });

          return new Response("ok");
        } catch {
          // Analytics must never break a page view.
          return new Response("ok");
        }
      },
    },
  },
});

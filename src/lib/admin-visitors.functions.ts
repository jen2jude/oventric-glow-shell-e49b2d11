import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Traffic analytics for the admin console. Reads are admin-gated server-side;
 * the browser never receives raw visitor rows, only aggregates plus a short
 * list of recently active signed-in people.
 */

const RANGES = [1, 7, 30, 90] as const;
type Range = (typeof RANGES)[number];

export interface VisitorDay {
  date: string;
  visitors: number;
  views: number;
  signedIn: number;
}
export interface Slice {
  label: string;
  count: number;
}
export interface ActivePerson {
  userId: string;
  name: string;
  username: string | null;
  views: number;
  lastSeen: string;
  country: string | null;
}
export interface VisitorAnalytics {
  rangeDays: number;
  totals: {
    visitors: number;
    views: number;
    sessions: number;
    signedInVisitors: number;
    guestVisitors: number;
    viewsPerVisitor: number;
    today: number;
  };
  daily: VisitorDay[];
  countries: Slice[];
  cities: Slice[];
  devices: Slice[];
  browsers: Slice[];
  operatingSystems: Slice[];
  surfaces: Slice[];
  pages: Slice[];
  people: ActivePerson[];
}

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string) {
  try {
    return COUNTRY_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

function top(map: Map<string, Set<string>>, limit: number): Slice[] {
  return Array.from(map.entries())
    .map(([label, set]) => ({ label, count: set.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export const getVisitorAnalytics = createServerFn({ method: "GET" })
  .inputValidator((i: { rangeDays: Range }) => i)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<VisitorAnalytics> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: isAdmin, error: roleErr } = await sb.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const rangeDays: number = RANGES.includes(data.rangeDays) ? data.rangeDays : 7;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (rangeDays - 1));
    since.setUTCHours(0, 0, 0, 0);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("visitor_events")
      .select(
        "occurred_at, visitor_id, session_id, user_id, path, country, city, device, browser, os, surface",
      )
      .gte("occurred_at", since.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(50000);
    if (error) throw new Error(error.message);

    type Row = {
      occurred_at: string;
      visitor_id: string;
      session_id: string;
      user_id: string | null;
      path: string;
      country: string | null;
      city: string | null;
      device: string | null;
      browser: string | null;
      os: string | null;
      surface: string | null;
    };
    const all = (rows ?? []) as Row[];

    const dayBuckets = new Map<string, { visitors: Set<string>; views: number; signedIn: Set<string> }>();
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      dayBuckets.set(d.toISOString().slice(0, 10), {
        visitors: new Set(),
        views: 0,
        signedIn: new Set(),
      });
    }

    const visitors = new Set<string>();
    const sessions = new Set<string>();
    const signedIn = new Set<string>();
    const guests = new Set<string>();
    const countries = new Map<string, Set<string>>();
    const cities = new Map<string, Set<string>>();
    const devices = new Map<string, Set<string>>();
    const browsers = new Map<string, Set<string>>();
    const oses = new Map<string, Set<string>>();
    const surfaces = new Map<string, Set<string>>();
    const pages = new Map<string, Set<string>>();
    const perUser = new Map<string, { views: number; lastSeen: string; country: string | null }>();

    const push = (m: Map<string, Set<string>>, key: string | null, visitor: string) => {
      const k = (key ?? "Unknown").trim() || "Unknown";
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(visitor);
    };

    for (const r of all) {
      visitors.add(r.visitor_id);
      sessions.add(r.session_id);
      if (r.user_id) signedIn.add(r.visitor_id);
      else guests.add(r.visitor_id);

      const day = r.occurred_at.slice(0, 10);
      const b = dayBuckets.get(day);
      if (b) {
        b.views += 1;
        b.visitors.add(r.visitor_id);
        if (r.user_id) b.signedIn.add(r.user_id);
      }

      push(countries, r.country ? countryName(r.country) : null, r.visitor_id);
      push(cities, r.city, r.visitor_id);
      push(devices, r.device, r.visitor_id);
      push(browsers, r.browser, r.visitor_id);
      push(oses, r.os, r.visitor_id);
      push(surfaces, r.surface === "app" ? "App (installed)" : "Website", r.visitor_id);
      push(pages, r.path, r.visitor_id);

      if (r.user_id) {
        const prev = perUser.get(r.user_id);
        if (!prev) {
          perUser.set(r.user_id, { views: 1, lastSeen: r.occurred_at, country: r.country });
        } else {
          prev.views += 1;
          if (r.occurred_at > prev.lastSeen) prev.lastSeen = r.occurred_at;
          if (!prev.country) prev.country = r.country;
        }
      }
    }

    const peopleIds = Array.from(perUser.entries())
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 50);

    let people: ActivePerson[] = [];
    if (peopleIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name, username, shop_name")
        .in(
          "user_id",
          peopleIds.map(([uid]) => uid),
        );
      const byId = new Map(
        ((profs ?? []) as Array<Record<string, string | null>>).map((p) => [p.user_id as string, p]),
      );
      people = peopleIds.map(([uid, v]) => {
        const p = byId.get(uid);
        return {
          userId: uid,
          name:
            (p?.shop_name as string) ||
            (p?.display_name as string) ||
            (p?.username as string) ||
            `${uid.slice(0, 8)}…`,
          username: (p?.username as string) ?? null,
          views: v.views,
          lastSeen: v.lastSeen,
          country: v.country ? countryName(v.country) : null,
        };
      });
    }

    const todayKey = new Date().toISOString().slice(0, 10);

    const daily: VisitorDay[] = Array.from(dayBuckets.entries()).map(([date, b]) => ({
      date,
      visitors: b.visitors.size,
      views: b.views,
      signedIn: b.signedIn.size,
    }));

    return {
      rangeDays,
      totals: {
        visitors: visitors.size,
        views: all.length,
        sessions: sessions.size,
        signedInVisitors: signedIn.size,
        guestVisitors: Array.from(guests).filter((v) => !signedIn.has(v)).length,
        viewsPerVisitor: visitors.size ? Number((all.length / visitors.size).toFixed(1)) : 0,
        today: daily.find((d) => d.date === todayKey)?.visitors ?? 0,
      },
      daily,
      countries: top(countries, 12),
      cities: top(cities, 12),
      devices: top(devices, 6),
      browsers: top(browsers, 8),
      operatingSystems: top(oses, 8),
      surfaces: top(surfaces, 4),
      pages: top(pages, 12),
      people,
    };
  });

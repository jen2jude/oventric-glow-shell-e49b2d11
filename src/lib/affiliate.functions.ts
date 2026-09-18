import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertLegacyFeatureDisabled } from "@/lib/mvp-features";

export interface AffiliateReservationDTO {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  country: string | null;
  note: string | null;
  createdAt: string;
}

export const getMyAffiliateReservation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AffiliateReservationDTO | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("affiliate_reservations")
      .select("id, user_id, email, display_name, country, note, created_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id as string,
      userId: data.user_id as string,
      email: data.email as string,
      displayName: (data.display_name as string) ?? null,
      country: (data.country as string) ?? null,
      note: (data.note as string) ?? null,
      createdAt: data.created_at as string,
    };
  });

export const reserveAffiliateSpot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { note?: string }) => ({
    note: typeof i?.note === "string" ? i.note.trim().slice(0, 500) : "",
  }))
  .handler(async ({ data, context }): Promise<AffiliateReservationDTO> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("affiliate");
    const { supabase, userId, claims } = context;
    const email =
      (claims?.email as string | undefined) ||
      (claims?.user_metadata as { email?: string } | undefined)?.email ||
      "";
    if (!email) throw new Error("Email required on your account.");

    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name, username, country")
      .eq("user_id", userId)
      .maybeSingle();

    const displayName =
      (prof?.display_name as string) || (prof?.username as string) || null;
    const country = (prof?.country as string) || null;

    const { data: row, error } = await supabase
      .from("affiliate_reservations")
      .upsert(
        {
          user_id: userId,
          email,
          display_name: displayName,
          country,
          note: data.note || null,
        },
        { onConflict: "user_id" },
      )
      .select("id, user_id, email, display_name, country, note, created_at")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id as string,
      userId: row.user_id as string,
      email: row.email as string,
      displayName: (row.display_name as string) ?? null,
      country: (row.country as string) ?? null,
      note: (row.note as string) ?? null,
      createdAt: row.created_at as string,
    };
  });

export const listAffiliateReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AffiliateReservationDTO[]> => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: rErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (rErr) throw new Error(rErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { data, error } = await supabase
      .from("affiliate_reservations")
      .select("id, user_id, email, display_name, country, note, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      email: r.email as string,
      displayName: (r.display_name as string) ?? null,
      country: (r.country as string) ?? null,
      note: (r.note as string) ?? null,
      createdAt: r.created_at as string,
    }));
  });

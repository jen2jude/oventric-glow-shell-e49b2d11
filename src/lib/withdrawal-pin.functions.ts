/**
 * Withdrawal PIN — 4-digit secret that gates payout requests.
 *
 * The PIN is never stored in plain text: we derive a PBKDF2-SHA256 hash with a
 * per-user random salt and only ever compare hashes server-side. The table is
 * service-role only, so the browser can never read the hash.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derive(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

function cleanPin(v: unknown): string {
  const pin = String(v ?? "").replace(/\D/g, "");
  if (pin.length !== 4) throw new Error("PIN must be exactly 4 digits");
  return pin;
}

export interface WithdrawalPinStatus {
  hasPin: boolean;
  lockedUntil: string | null;
}

export const getWithdrawalPinStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WithdrawalPinStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as never as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
        };
      };
    })
      .from("withdrawal_pins")
      .select("user_id, locked_until")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      hasPin: !!data,
      lockedUntil: (data?.locked_until as string | null) ?? null,
    };
  });

export const setWithdrawalPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pin: string; confirm: string }) => {
    const pin = cleanPin(input?.pin);
    const confirm = cleanPin(input?.confirm);
    if (pin !== confirm) throw new Error("PINs do not match");
    if (/^(\d)\1{3}$/.test(pin)) throw new Error("Choose a less predictable PIN");
    return { pin };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { data: existing } = await sb
      .from("withdrawal_pins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) throw new Error("A withdrawal PIN already exists for this account");

    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    const pin_hash = await derive(data.pin, salt);
    const { error } = await sb.from("withdrawal_pins").insert({
      user_id: context.userId,
      pin_hash,
      salt,
      // Creating the PIN proves possession, so the payout about to be submitted
      // is covered by the same 10-minute server-side verification window.
      pin_verified_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyWithdrawalPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pin: string }) => ({ pin: cleanPin(input?.pin) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { data: row } = await sb
      .from("withdrawal_pins")
      .select("pin_hash, salt, failed_attempts, locked_until")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("No withdrawal PIN set");

    const lockedUntil = row.locked_until ? new Date(row.locked_until as string) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      throw new Error("Too many attempts. Try again later.");
    }

    const hash = await derive(data.pin, row.salt as string);
    if (hash !== row.pin_hash) {
      const attempts = Number(row.failed_attempts ?? 0) + 1;
      await sb
        .from("withdrawal_pins")
        .update({
          failed_attempts: attempts,
          locked_until: attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
        })
        .eq("user_id", context.userId);
      throw new Error(attempts >= 5 ? "Too many attempts. Locked for 15 minutes." : "Incorrect PIN");
    }

    await sb
      .from("withdrawal_pins")
      .update({ failed_attempts: 0, locked_until: null, pin_verified_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PurchaseSummaryDTO {
  summary: string;
  orderCount: number;
  createdAt: string;
}

/** Latest saved AI summary for the signed-in buyer (null when none yet). */
export const getMyPurchaseSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PurchaseSummaryDTO | null> => {
    const { data, error } = await context.supabase
      .from("purchase_assistant_summaries")
      .select("summary, order_count, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      summary: data.summary as string,
      orderCount: Number(data.order_count ?? 0),
      createdAt: data.created_at as string,
    };
  });

/**
 * Builds a plain-language rundown of the buyer's most recent orders with the
 * exact next action for each (download, open link, wait for the seller, or
 * confirm receipt). Order facts come from the database; the model only writes
 * the wording.
 */
export const generateMyPurchaseSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PurchaseSummaryDTO> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI assistant is not configured yet.");

    const { data, error } = await context.supabase
      .from("orders")
      .select(
        "id, product_name_snapshot, quantity, display_currency, display_total, status, paid_at, created_at, escrow_status, buyer_confirmed_at, products:product_id (name, vendor, file_path, external_url, requires_manual_delivery)",
      )
      .eq("buyer_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) {
      throw new Error("You have no purchases yet — buy something first and I'll summarise it here.");
    }

    const facts = rows.map((r) => {
      const p = (r.products ?? {}) as Record<string, unknown>;
      const manual = Boolean(p.requires_manual_delivery);
      const hasFile = !!(p.file_path as string);
      const externalUrl = !!(p.external_url as string);
      const status = (r.status as string) ?? "pending";
      const escrow = (r.escrow_status as string) ?? "released";
      let action = "Open this order's page for details.";
      if (status === "paid" && manual && !r.buyer_confirmed_at) {
        action =
          "Seller delivers this in your Oventric chat; tap 'Confirm received' on the order once you have it.";
      } else if (status === "paid" && hasFile) {
        action = "Re-download any time with the Download button on this order.";
      } else if (status === "paid" && externalUrl) {
        action = "Open the seller's delivery link from this order.";
      } else if (status === "paid") {
        action =
          "Delivered — open this order's page or your chat with the seller to get the files again.";
      } else if (status === "pending") {
        action = "Payment is still processing.";
      } else if (status === "refunded") {
        action = "This order was refunded.";
      }
      return {
        orderId: (r.id as string).slice(0, 8),
        product: (p.name as string) ?? (r.product_name_snapshot as string) ?? "Digital product",
        seller: (p.vendor as string) || "the seller",
        amount: `${r.display_currency ?? "USD"} ${Number(r.display_total ?? 0).toLocaleString()}`,
        date: String(r.paid_at ?? r.created_at ?? "").slice(0, 10),
        status,
        escrow,
        action,
      };
    });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low" },
        instructions:
          "You are Oventric's purchase assistant. Using ONLY the order facts given, write a short friendly rundown for the buyer. Start with one sentence of overview, then one bullet per order in the form: product name — seller, amount, date, order ID, then the exact next step (download, open link, wait for seller delivery in chat, or confirm receipt). Never invent orders, prices, links or dates. Plain text, no markdown headings, max 180 words.",
        input: JSON.stringify(facts),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 402) throw new Error("AI credits are exhausted. Please try again later.");
      if (res.status === 429) throw new Error("The assistant is busy right now — try again shortly.");
      throw new Error(`Assistant unavailable (${res.status}): ${body.slice(0, 200)}`);
    }

    // Stream the SSE response and accumulate the answer text.
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Assistant returned no response.");
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          } else if (evt.type === "response.completed" && !text && evt.response?.output_text) {
            text = evt.response.output_text;
          }
        } catch {
          /* ignore keep-alive / partial frames */
        }
      }
    }

    const summary = text.trim();
    if (!summary) throw new Error("The assistant couldn't produce a summary. Please try again.");

    const { data: saved, error: saveErr } = await context.supabase
      .from("purchase_assistant_summaries")
      .insert({ user_id: context.userId, summary, order_count: facts.length })
      .select("summary, order_count, created_at")
      .single();
    if (saveErr) throw new Error(saveErr.message);

    return {
      summary: saved.summary as string,
      orderCount: Number(saved.order_count ?? facts.length),
      createdAt: saved.created_at as string,
    };
  });

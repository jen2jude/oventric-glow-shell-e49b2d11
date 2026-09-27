import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { buildCreatorHubData } from "@/lib/dashboard/creator.functions";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id";

const MODEL = "openai/gpt-6-astra";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (token.split(".").length !== 3) return null;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub as string };
}

function messageText(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

async function buildCoachContext(userId: string): Promise<string> {
  const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
  const [profileRes, walletRes, hub] = await Promise.all([
    sb.from("profiles").select("display_name, username, country").eq("user_id", userId).maybeSingle(),
    sb.from("wallets").select("currency").eq("user_id", userId).maybeSingle(),
    buildCreatorHubData(userId, 0),
  ]);
  const profile = profileRes.data;
  const homeCurrency = walletRes.data?.currency ?? "USD";

  // Compact seller snapshot
  const { data: orders } = await sb
    .from("orders")
    .select("total_usd, status")
    .eq("seller_id", userId)
    .in("status", ["paid", "delivered", "completed", "released"])
    .limit(20000);
  const sales = orders?.length ?? 0;
  const revenueUSD = Number((orders ?? []).reduce((a, o) => a + Number(o.total_usd || 0), 0).toFixed(2));

  const stats = {
    creator: {
      name: profile?.display_name || profile?.username || "Creator",
      country: profile?.country ?? null,
      homeCurrency: profile?.base_currency ?? "USD",
    },
    audience: {
      followers: hub.followers,
      newFollowersLast7Days: hub.newFollowers7d,
      followerGrowthLast8Weeks: hub.followerGrowth,
      followerCountries: hub.followerCountries,
      topFans: hub.topFans.map((f) => ({ name: f.name, interactions: f.interactions })),
    },
    content: {
      totals: hub.totals,
      engagementRatePercent: hub.engagementRate,
      reach: hub.reach,
      bestHoursUTC: hub.bestHours.filter((h) => h.count > 0).sort((a, b) => b.count - a.count).slice(0, 5),
      bestDays: hub.bestDays.map((d, i) => ({ day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i], count: d.count })).filter((d) => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 3),
      topPosts: hub.posts.slice(0, 10),
    },
    showcase: hub.showcase,
    salesFromPosts: hub.postSales,
    seller: { totalSales: sales, totalRevenueUSD: revenueUSD },
  };

  return `You are the Oventric Creator Coach — a sharp, encouraging growth coach for digital creators on the Oventric marketplace. You coach ONE creator: ${stats.creator.name}.

Your job:
- Answer questions about their performance using the REAL stats below. Always cite their actual numbers.
- Compare periods when asked (e.g. this week vs the 8-week trend).
- Explain WHY content performs (format, timing, topic) based on the data.
- Suggest what to post next, when to post it (use bestHoursUTC/bestDays, converted to their local time when known), and content ideas for their niche.
- Help with pricing using their sales history (salesFromPosts, seller totals). All money is in USD; their home currency is ${stats.creator.homeCurrency}.
- Draft captions, product descriptions and post copy in their voice when asked.
- Give weekly-summary style readouts when asked "how did I do".

Rules:
- Never invent numbers. If a stat is missing or zero, say so honestly and suggest how to grow it.
- Keep answers compact and skimmable: short paragraphs, bold key numbers, bullet lists. This renders in a small mobile chat panel.
- Be warm and direct, like a coach who knows their account inside out.
- Watch time only counts user-tapped plays (autoplay is ignored); downloads split free vs paid; "showcase" means their items in the Creators tab of the feed.

REAL STATS (live from their account):
${JSON.stringify(stats)}`;
}

export const Route = createFileRoute("/api/creator-coach")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        let messages: UIMessage[];
        try {
          const body = (await request.json()) as { messages?: UIMessage[] };
          if (!Array.isArray(body.messages)) throw new Error("bad body");
          messages = body.messages;
        } catch {
          return new Response("Invalid request", { status: 400 });
        }
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const userText = messageText(lastUser);
        if (!userText) return new Response("Empty message", { status: 400 });

        // Persist the user message (one conversation per creator).
        const { error: saveError } = await auth.supabase
          .from("creator_coach_messages")
          .insert({ user_id: auth.userId, role: "user", content: userText });
        if (saveError) console.error("[creator-coach] failed to save user message:", saveError.message);

        const system = await buildCoachContext(auth.userId);
        const modelMessages = await convertToModelMessages(messages.slice(-30));

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: GATEWAY_URL,
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const result = streamText({
          model: provider.responses(MODEL),
          system,
          messages: modelMessages,
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return withLovableAiGatewayRunIdHeader(
          result.toUIMessageStreamResponse({
            originalMessages: messages,
            sendReasoning: true,
            onFinish: async ({ responseMessage }) => {
              const text = messageText(responseMessage);
              if (!text) return;
              const { error } = await auth.supabase
                .from("creator_coach_messages")
                .insert({ user_id: auth.userId, role: "assistant", content: text });
              if (error) console.error("[creator-coach] failed to save assistant message:", error.message);
            },
          }),
          runIdFetch,
        );
      },
    },
  },
});

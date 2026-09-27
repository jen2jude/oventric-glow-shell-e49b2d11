import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CoachHistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const getCreatorCoachHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoachHistoryMessage[]> => {
    const { data, error } = await context.supabase
      .from("creator_coach_messages")
      .select("id, role, content")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as CoachHistoryMessage[];
  });

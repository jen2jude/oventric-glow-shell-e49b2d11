import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Loader2, MessageCircle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listEscrowInbox, type EscrowInboxItem } from "@/lib/escrow-inbox.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { haptic } from "@/lib/haptics";
import { visibleMoney, usdEquivalent } from "@/lib/money-visibility";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { AppOrderSheet } from "./AppOrderSheet";

/**
 * App-shell Purchases screen: a compact native inbox of every order the
 * signed-in user is a party to, split into Buying / Selling. Tapping a row
 * opens the full escrow detail page (confirm delivery, disputes, chat).
 */

type Tab = "buying" | "selling";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  held: { label: "In escrow", cls: "bg-amber-400/10 text-amber-300 border-amber-400/20" },
  released: { label: "Completed", cls: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20" },
  refunded: { label: "Refunded", cls: "bg-white/[0.06] text-white/50 border-white/10" },
};

function statusOf(o: EscrowInboxItem) {
  if (o.disputeStatus && o.disputeStatus !== "none" && o.disputeStatus !== "resolved")
    return { label: "Disputed", cls: "bg-[#E5484D]/10 text-[#E5484D] border-[#E5484D]/25" };
  return STATUS_STYLE[o.escrowStatus] ?? STATUS_STYLE.held;
}

export function AppPurchases() {
  const { balancesHidden } = useOnboarding();
  const navigate = useNavigate();
  const { openGate } = useAuthGate();
  const fetchInbox = useServerFn(listEscrowInbox);
  const [tab, setTab] = useState<Tab>("buying");
  const [selected, setSelected] = useState<EscrowInboxItem | null>(null);

  const { data: session } = useQuery({
    queryKey: ["app-purchases-session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    staleTime: 60_000,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["escrow-inbox"],
    queryFn: () => fetchInbox(),
    enabled: !!session,
    staleTime: 15_000,
  });

  const rows = useMemo(
    () => (orders ?? []).filter((o) => (tab === "buying" ? o.role === "buyer" : o.role === "seller")),
    [orders, tab],
  );

  if (!session) {
    return (
      <div className="min-h-full bg-[#070A08] text-white px-5 pt-16 pb-28">
        <div className="mt-10 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-white/25" />
          <p className="mt-3 text-[13.5px] font-semibold text-white/70">Sign in to see your orders</p>
          <p className="mt-1 text-[11.5px] text-white/35">
            Track deliveries, confirm receipt and follow escrow on everything you buy or sell.
          </p>
          <button
            onClick={() => openGate("funding")}
            className="mt-5 rounded-full bg-[#E5484D] px-6 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(229,72,77,0.35)]"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#070A08] text-white px-4 pt-6 pb-28">

      {/* Buying / Selling toggle */}
      <div className="mt-4 flex rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
        {(["buying", "selling"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              haptic("select");
              setTab(t);
            }}
            className={`flex-1 rounded-full py-2 text-[12.5px] font-semibold capitalize transition-all ${
              tab === t
                ? "bg-[#E5484D] text-white shadow-[0_6px_18px_rgba(229,72,77,0.35)]"
                : "text-white/45"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-white/25" />
          <p className="mt-3 text-[13px] font-semibold text-white/60">
            {tab === "buying" ? "No purchases yet" : "No sales yet"}
          </p>
          <p className="mt-1 text-[11.5px] text-white/35">
            {tab === "buying"
              ? "Everything you buy appears here while it's in escrow."
              : "Orders from your shop appear here the moment they’re paid."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {rows.map((o) => {
            const st = statusOf(o);
            const unread = !!o.lastMessage?.unread;
            return (
              <button
                key={o.orderId}
                onClick={() => {
                  haptic("select");
                  setSelected(o);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5 text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-semibold text-white/90">{o.productName}</p>
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#E5484D]" />}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-white/35">
                    {tab === "buying" ? `Seller · ${o.counterpartyName}` : `Buyer · ${o.counterpartyName}`}
                    {o.quantity > 1 ? ` · ×${o.quantity}` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${st.cls}`}>
                      {st.label}
                    </span>
                    {o.lastMessage && (
                      <span className="flex items-center gap-1 truncate text-[10px] text-white/30">
                        <MessageCircle className="h-3 w-3 shrink-0" />
                        <span className="truncate">{o.lastMessage.body}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-[13.5px] font-bold text-[#E5484D]">
                    {visibleMoney(o.displayTotal, o.displayCurrency, balancesHidden)}
                  </p>
                  <span className="text-[10px] text-white/40">{usdEquivalent(o.displayTotal, o.displayCurrency, balancesHidden)}</span>
                  <ChevronRight className="h-4 w-4 text-white/20" />
                </div>
              </button>
            );
          })}
        </div>
      )}
      <AppOrderSheet order={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

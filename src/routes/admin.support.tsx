import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Send, Star } from "lucide-react";
import {
  adminListSupportTickets,
  adminSetTicketStatus,
  adminListSupportFeedback,
  adminListSupportChatUsers,
  adminListSupportChat,
  adminReplySupportChat,
} from "@/lib/support-admin.functions";

export const Route = createFileRoute("/admin/support")({
  head: () => ({
    meta: [
      { title: "Support desk — Oventric admin" },
      {
        name: "description",
        content:
          "Review disputes, feedback and live chat conversations from the Oventric help board.",
      },
      { property: "og:title", content: "Oventric support desk" },
      { property: "og:description", content: "Admin queue for disputes, feedback and live chat." },
    ],
  }),
  component: AdminSupportPage,
});

type Ticket = {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  details: string;
  status: string;
  created_at: string;
};
type Feedback = {
  id: string;
  rating: number;
  message: string;
  topic: string | null;
  created_at: string;
};
type ChatUser = { user_id: string; name: string; last: string; sender: string; created_at: string };
type Msg = { id: string; sender: string; body: string; created_at: string };

function AdminSupportPage() {
  const listTickets = useServerFn(adminListSupportTickets);
  const setStatus = useServerFn(adminSetTicketStatus);
  const listFeedback = useServerFn(adminListSupportFeedback);
  const listChatUsers = useServerFn(adminListSupportChatUsers);
  const listChat = useServerFn(adminListSupportChat);
  const reply = useServerFn(adminReplySupportChat);

  const [tab, setTab] = useState<"disputes" | "feedback" | "chat">("disputes");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (tab === "disputes") setTickets((await listTickets()) as Ticket[]);
        if (tab === "feedback") setFeedback((await listFeedback()) as Feedback[]);
        if (tab === "chat") setUsers((await listChatUsers()) as ChatUser[]);
      } catch {
        /* forbidden or offline */
      }
    })();
  }, [tab, listTickets, listFeedback, listChatUsers]);

  const openThread = async (userId: string) => {
    setActiveUser(userId);
    try {
      setMessages((await listChat({ data: { userId } })) as Msg[]);
      window.dispatchEvent(new Event("oventric:admin-activity-changed"));
    } catch {
      setMessages([]);
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !activeUser) return;
    setText("");
    await reply({ data: { userId: activeUser, body } });
    setMessages((await listChat({ data: { userId: activeUser } })) as Msg[]);
  };

  const advance = async (t: Ticket) => {
    const next =
      t.status === "open" ? "in_review" : t.status === "in_review" ? "resolved" : "closed";
    await setStatus({
      data: { id: t.id, status: next as "open" | "in_review" | "resolved" | "closed" },
    });
    setTickets((await listTickets()) as Ticket[]);
    window.dispatchEvent(new Event("oventric:admin-activity-changed"));
  };

  return (
    <div className="p-4 md:p-6 text-slate-200">
      <h1 className="text-2xl font-black text-white">Support desk</h1>
      <div className="mt-4 flex gap-2">
        {(["disputes", "feedback", "chat"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${tab === t ? "bg-emerald-500 text-black" : "bg-[#1E1E24] text-slate-300 border border-white/10"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "disputes" && (
        <div className="mt-4 grid gap-3">
          {tickets.length === 0 && <p className="text-sm text-slate-400">No cases yet.</p>}
          {tickets.map((t) => (
            <div key={t.id} className="p-4 rounded-2xl bg-[#141418] border border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-emerald-300">
                  {t.category.replace("_", " ")}
                </span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
                  {t.status}
                </span>
              </div>
              <p className="mt-1 font-bold text-white">{t.subject}</p>
              <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{t.details}</p>
              <button
                onClick={() => void advance(t)}
                className="mt-3 px-3 py-1.5 rounded-full bg-[#1E1E24] border border-white/10 text-xs font-semibold text-white"
              >
                Move to next status
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "feedback" && (
        <div className="mt-4 grid gap-3">
          {feedback.length === 0 && <p className="text-sm text-slate-400">No feedback yet.</p>}
          {feedback.map((f) => (
            <div key={f.id} className="p-4 rounded-2xl bg-[#141418] border border-white/10">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-4 h-4 ${n <= f.rating ? "text-amber-300 fill-amber-300" : "text-slate-600"}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{f.message}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "chat" && (
        <div className="mt-4 grid md:grid-cols-[260px_1fr] gap-4">
          <div className="grid gap-2 content-start">
            {users.length === 0 && <p className="text-sm text-slate-400">No conversations yet.</p>}
            {users.map((u) => (
              <button
                key={u.user_id}
                onClick={() => void openThread(u.user_id)}
                className={`p-3 rounded-xl text-left border ${activeUser === u.user_id ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-[#141418]"}`}
              >
                <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                <p className="text-xs text-slate-400 truncate">{u.last}</p>
              </button>
            ))}
          </div>
          <div className="rounded-2xl bg-[#141418] border border-white/10 flex flex-col min-h-[420px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!activeUser && <p className="text-sm text-slate-400">Pick a conversation.</p>}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={m.sender === "admin" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${m.sender === "admin" ? "bg-emerald-500 text-black font-medium" : "bg-[#1E1E24] text-slate-100 border border-white/10"}`}
                  >
                    {m.body}
                  </div>
                </div>
              ))}
            </div>
            {activeUser && (
              <div className="p-3 border-t border-white/10 flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send();
                  }}
                  placeholder="Reply to user…"
                  className="flex-1 rounded-xl bg-[#1E1E24] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={() => void send()}
                  className="w-11 h-11 grid place-items-center rounded-full bg-emerald-500 text-black"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

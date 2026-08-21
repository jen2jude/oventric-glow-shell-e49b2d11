import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Megaphone,
  Send,
  Trash2,
  Radio,
  Users,
  Mail,
  Bell,
  MessageSquare,
  Loader2,
  Plus,
  CheckCircle2,
} from "lucide-react";
import {
  listAnnouncements,
  upsertAnnouncement,
  deleteAnnouncement,
  broadcastAnnouncement,
  sendDirectMessage,
  listRecentNotifications,
  type AnnouncementRow,
  getCommsMediaUploadUrl,
  getCommsMediaSignedUrl,
} from "@/lib/communications.functions";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

function stripHtml(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined")
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

export const Route = createFileRoute("/admin/communications")({
  head: () => ({
    meta: [
      { title: "Communication Center · Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CommsPage,
});

type Tab = "announcements" | "direct" | "activity";

interface NotifRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  from_user_id: string | null;
  read_at: string | null;
  created_at: string;
}

const CHANNELS = [
  { key: "in_app", label: "In-app", icon: Bell },
  { key: "email", label: "Email", icon: Mail },
  { key: "push", label: "Push", icon: Radio },
];

function CommsPage() {
  const [tab, setTab] = useState<Tab>("announcements");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-emerald-300" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Communication Center</h1>
          <p className="text-sm text-slate-400">
            Broadcast announcements, send targeted messages, and monitor delivery.
          </p>
        </div>
      </header>

      <div className="flex gap-1 mb-6 border-b border-white/10">
        {[
          { id: "announcements", label: "Announcements", icon: Megaphone },
          { id: "direct", label: "Direct Message", icon: MessageSquare },
          { id: "activity", label: "Recent Activity", icon: Radio },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2 transition ${
                active
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "announcements" && <AnnouncementsTab />}
      {tab === "direct" && <DirectMessageTab />}
      {tab === "activity" && <ActivityTab />}
    </div>
  );
}

/* ---------------- Announcements ---------------- */

function AnnouncementsTab() {
  const list = useServerFn(listAnnouncements);
  const upsert = useServerFn(upsertAnnouncement);
  const del = useServerFn(deleteAnnouncement);
  const broadcast = useServerFn(broadcastAnnouncement);
  const uploadFn = useServerFn(getCommsMediaUploadUrl);
  const signFn = useServerFn(getCommsMediaSignedUrl);

  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    id: "",
    title: "",
    body: "",
    audience: "everyone" as "everyone" | "authenticated",
    channels: ["in_app"] as string[],
    active: true,
  });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setRows(await list());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () =>
    setForm({
      id: "",
      title: "",
      body: "",
      audience: "everyone",
      channels: ["in_app"],
      active: true,
    });

  const submit = async () => {
    if (!form.title.trim() || !stripHtml(form.body)) {
      toast.error("Title and body are required");
      return;
    }
    setBusy(true);
    try {
      await upsert({
        data: {
          id: form.id || undefined,
          title: form.title.trim(),
          body: form.body,
          audience: form.audience,
          channels: form.channels,
          active: form.active,
        },
      });
      toast.success(form.id ? "Announcement updated" : "Announcement created");
      resetForm();
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doBroadcast = async (id: string) => {
    if (!confirm("Broadcast this announcement to every user's inbox?")) return;
    try {
      const { delivered } = await broadcast({ data: { id } });
      toast.success(`Delivered to ${delivered} users`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doDelete = async (id: string) => {
    if (!confirm("Delete announcement?")) return;
    try {
      await del({ data: { id } });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleChannel = (key: string) =>
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(key)
        ? f.channels.filter((c) => c !== key)
        : [...f.channels, key],
    }));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="bg-[#141418] border border-white/10 rounded-2xl p-5">
        <h2 className="text-white font-black mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-300" />
          {form.id ? "Edit announcement" : "New announcement"}
        </h2>
        <div className="space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title"
            className="w-full bg-black/30 border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/60 outline-none"
          />
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">
              Message body — rich text · images · links
            </div>
            <RichTextEditor
              value={form.body}
              onChange={(html) => setForm({ ...form, body: html })}
              placeholder="Craft a rich announcement. Add headings, images, and clickable links."
              minHeight={240}
              bucket="post-media"
              uploadFn={uploadFn}
              signFn={signFn}
            />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">Audience</div>
            <div className="flex gap-2">
              {(["everyone", "authenticated"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setForm({ ...form, audience: a })}
                  className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold border ${
                    form.audience === a
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <Users className="w-3 h-3 inline mr-1" />
                  {a === "everyone" ? "Everyone (public)" : "Signed-in users"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">Channels</div>
            <div className="flex gap-2 flex-wrap">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                const on = form.channels.includes(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleChannel(c.key)}
                    className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold border flex items-center gap-1.5 ${
                      on
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              In-app and push deliver instantly on broadcast — push reaches only members who
              enabled device notifications. Email is queued (requires sender domain).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-emerald-500"
            />
            Active (visible to audience)
          </label>
          <div className="flex gap-2 pt-1">
            <button
              disabled={busy}
              onClick={submit}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-[10px] flex items-center gap-2"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {form.id ? "Save changes" : "Create announcement"}
            </button>
            {form.id && (
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold rounded-[10px]"
              >
                Cancel edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-[#141418] border border-white/10 rounded-2xl p-5">
        <h2 className="text-white font-black mb-4">Existing ({rows.length})</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">No announcements yet.</div>
        ) : (
          <ul className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {rows.map((r) => (
              <li
                key={r.id}
                className="border border-white/10 rounded-xl p-3 bg-black/20 hover:border-white/20 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-sm truncate">{r.title}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                          r.active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/5 text-slate-500"
                        }`}
                      >
                        {r.active ? "Active" : "Draft"}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                        {r.audience}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {stripHtml(r.body).slice(0, 220)}
                    </p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {r.channels.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() =>
                        setForm({
                          id: r.id,
                          title: r.title,
                          body: r.body,
                          audience: r.audience,
                          channels: r.channels,
                          active: r.active,
                        })
                      }
                      className="text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => doBroadcast(r.id)}
                      className="text-[11px] px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" /> Send
                    </button>
                    <button
                      onClick={() => doDelete(r.id)}
                      className="text-[11px] px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Direct Message ---------------- */

function DirectMessageTab() {
  const send = useServerFn(sendDirectMessage);
  const uploadFn = useServerFn(getCommsMediaUploadUrl);
  const signFn = useServerFn(getCommsMediaSignedUrl);
  const [recipients, setRecipients] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [kind, setKind] = useState<"direct_message" | "system" | "alert">("direct_message");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = recipients
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parsed.length) return toast.error("Add at least one recipient");
    if (!title.trim() || !stripHtml(body)) return toast.error("Title and body are required");
    setBusy(true);
    try {
      const { delivered } = await send({
        data: {
          recipients: parsed,
          title: title.trim(),
          body: body,
          link: link.trim() || undefined,
          kind,
        },
      });
      toast.success(`Delivered to ${delivered} user${delivered === 1 ? "" : "s"}`);
      setRecipients("");
      setTitle("");
      setBody("");
      setLink("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl bg-[#141418] border border-white/10 rounded-2xl p-5">
      <h2 className="text-white font-black mb-4 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-emerald-300" />
        Send a direct message
      </h2>
      <div className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
            Recipients
          </label>
          <textarea
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="user_id, @username, comma or newline separated"
            rows={2}
            className="w-full bg-black/30 border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/60 outline-none font-mono"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Paste user IDs directly, or usernames prefixed with @.
          </p>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Kind</label>
          <div className="flex gap-2">
            {(["direct_message", "system", "alert"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold border ${
                  kind === k
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {k.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full bg-black/30 border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/60 outline-none"
        />
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">
            Message — rich text · images · links
          </div>
          <RichTextEditor
            value={body}
            onChange={setBody}
            placeholder="Write a rich personal message. Add headings, images, and clickable links."
            minHeight={220}
            bucket="post-media"
            uploadFn={uploadFn}
            signFn={signFn}
          />
        </div>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Optional link (e.g. /product/abc)"
          className="w-full bg-black/30 border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/60 outline-none"
        />
        <button
          disabled={busy}
          onClick={submit}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-[10px] flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send message
        </button>
      </div>
    </div>
  );
}

/* ---------------- Activity ---------------- */

function ActivityTab() {
  const list = useServerFn(listRecentNotifications);
  const [rows, setRows] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setRows((await list()) as NotifRow[]);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [list]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );

  if (!rows.length)
    return <div className="text-sm text-slate-500 text-center py-12">No notifications yet.</div>;

  return (
    <div className="bg-[#141418] border border-white/10 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-black/30 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="text-left px-4 py-2.5">When</th>
            <th className="text-left px-4 py-2.5">Kind</th>
            <th className="text-left px-4 py-2.5">Title</th>
            <th className="text-left px-4 py-2.5">Recipient</th>
            <th className="text-left px-4 py-2.5">Read</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n.id} className="border-t border-white/5">
              <td className="px-4 py-2 text-slate-400 text-xs">
                {new Date(n.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 uppercase font-bold">
                  {n.kind}
                </span>
              </td>
              <td className="px-4 py-2 text-white">{n.title}</td>
              <td className="px-4 py-2 text-slate-400 font-mono text-xs truncate max-w-[180px]">
                {n.user_id.slice(0, 8)}…
              </td>
              <td className="px-4 py-2">
                {n.read_at ? (
                  <span className="text-emerald-400 text-xs">✓</span>
                ) : (
                  <span className="text-slate-500 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Bell, Check, ExternalLink, Loader2 } from "lucide-react";
import {
  myNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/communications.functions";

interface NotifRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationsPanel() {
  const fetchFn = useServerFn(myNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const navigate = useNavigate();

  const [items, setItems] = useState<NotifRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = (await fetchFn()) as NotifRow[];
      setItems(rows);
    } catch (e) {
      setError((e as Error).message || "Couldn't load notifications");
    }
  }, [fetchFn]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = items?.filter((n) => !n.read_at).length ?? 0;

  const handleMarkRead = async (id: string) => {
    setItems((prev) =>
      prev
        ? prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
        : prev,
    );
    try {
      await markOne({ data: { id } });
    } catch {
      /* ignore */
    }
  };

  const handleMarkAll = async () => {
    setItems((prev) =>
      prev ? prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) : prev,
    );
    try {
      await markAll({});
    } catch {
      /* ignore */
    }
  };

  const handleOpen = async (n: NotifRow) => {
    if (!n.read_at) await handleMarkRead(n.id);
    if (n.link) {
      if (/^https?:\/\//i.test(n.link)) window.open(n.link, "_blank", "noopener,noreferrer");
      else navigate({ to: n.link });
    }
  };

  return (
    <div className="rounded-[10px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Bell className="w-4 h-4" /> Notifications
          {unreadCount > 0 && (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </h3>
        <button
          onClick={() => void handleMarkAll()}
          disabled={!items || unreadCount === 0}
          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-2 text-xs text-red-400 py-8" role="alert">
          <AlertTriangle className="w-5 h-5" />
          {error}
          <button onClick={() => void load()} className="text-primary underline underline-offset-2">
            Try again
          </button>
        </div>
      ) : items === null ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          You're all caught up — no notifications yet.
        </div>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border p-3 ${
                n.read_at
                  ? "border-border bg-muted/50"
                  : "border-primary/25 bg-primary/[0.04]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-[11px] text-slate-400 md:text-slate-500 mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
                    {timeAgo(n.created_at)} ago
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!n.read_at && (
                    <button
                      onClick={() => void handleMarkRead(n.id)}
                      aria-label="Mark as read"
                      title="Mark as read"
                      className="p-1.5 rounded-[10px] text-slate-400 hover:text-white hover:bg-white/10"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {n.link && (
                    <button
                      onClick={() => void handleOpen(n)}
                      aria-label="Open"
                      title="Open"
                      className="p-1.5 rounded-[10px] text-slate-400 hover:text-white hover:bg-white/10"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

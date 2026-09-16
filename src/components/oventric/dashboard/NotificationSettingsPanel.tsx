import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Loader2, Smartphone, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import {
  MVP_NOTIFICATION_TOPICS,
  TOPIC_META,
  defaultTopicPrefs,
  type NotificationTopic,
  type TopicPrefs,
} from "@/lib/notifications/topics";
import { getMyNotificationPrefs, setNotificationPref } from "@/lib/notification-prefs.functions";

function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-blue-600" : "bg-white/15 md:bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "left-[1.375rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/**
 * Per-topic alert controls: for each notification family the member can
 * decide whether it pops inside the app and whether it hits their phone's
 * notification bar.
 */
export function NotificationSettingsPanel() {
  const fetchPrefs = useServerFn(getMyNotificationPrefs);
  const savePref = useServerFn(setNotificationPref);

  const [prefs, setPrefs] = useState<TopicPrefs | null>(null);
  const [saving, setSaving] = useState<NotificationTopic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPrefs((await fetchPrefs()) as TopicPrefs);
    } catch (e) {
      setError((e as Error).message || "Couldn't load notification settings");
      setPrefs(defaultTopicPrefs());
    }
  }, [fetchPrefs]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (
    topic: NotificationTopic,
    patch: Partial<{ inApp: boolean; push: boolean }>,
  ) => {
    if (!prefs) return;
    const next = { ...prefs[topic], ...patch };
    const prev = prefs;
    setPrefs({ ...prefs, [topic]: next });
    setSaving(topic);
    try {
      await savePref({ data: { topic, inApp: next.inApp, push: next.push } });
      try {
        window.dispatchEvent(new CustomEvent("oventric:notif-prefs-changed"));
      } catch {
        /* ignore */
      }
    } catch {
      setPrefs(prev);
      toast.error("Couldn't save that setting");
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-bold text-white md:text-slate-900">Notification topics</h3>
      </div>
      <p className="mt-1 text-xs text-slate-400 md:text-slate-500">
        Choose what alerts you in the app and what reaches your phone.
      </p>

      {error ? <p className="mt-3 text-xs text-amber-500">{error}</p> : null}

      <div className="mt-3 hidden md:flex items-center justify-end gap-6 pr-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <span className="flex items-center gap-1">
          <MonitorSmartphone className="h-3 w-3" /> In-app
        </span>
        <span className="flex items-center gap-1">
          <Smartphone className="h-3 w-3" /> Push
        </span>
      </div>

      {!prefs ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-white/10 md:divide-slate-200">
          {MVP_NOTIFICATION_TOPICS.map((topic) => {
            const meta = TOPIC_META[topic];
            const p = prefs[topic];
            return (
              <li key={topic} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white md:text-slate-900">
                    {meta.label}
                  </div>
                  <div className="text-[11px] leading-snug text-slate-400 md:text-slate-500">
                    {meta.description}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="md:hidden text-[9px] font-bold uppercase text-slate-500">
                      App
                    </span>
                    <Toggle
                      on={p.inApp}
                      label={`${meta.label} in-app alerts`}
                      disabled={saving === topic}
                      onChange={(v) => void update(topic, { inApp: v })}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="md:hidden text-[9px] font-bold uppercase text-slate-500">
                      Push
                    </span>
                    <Toggle
                      on={p.push}
                      label={`${meta.label} push alerts`}
                      disabled={saving === topic}
                      onChange={(v) => void update(topic, { push: v })}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

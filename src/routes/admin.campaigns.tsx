import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Plus,
  Trash2,
  Play,
  Pause,
  StopCircle,
  Image as ImageIcon,
  Video as VideoIcon,
  Mail,
  X,
  Upload,
  ArrowUpDown,
  Type,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listCampaignsAdmin,
  upsertCampaignAdmin,
  deleteCampaignAdmin,
  setCampaignStatus,
  getCampaignAdmin,
  listCreatives,
  createCreativeUploadUrl,
  attachCreative,
  deleteCreative,
  getCampaignMetrics,
  listCampaignLeads,
  listTargetCities,
  type CampaignRow,
  type Creative,
  type CampaignTier,
  type CampaignStatus,
} from "@/lib/campaigns.functions";

export const Route = createFileRoute("/admin/campaigns")({
  head: () => ({
    meta: [{ title: "Campaigns · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: CampaignsPage,
});

const TIER_LABEL: Record<CampaignTier, string> = { text: "Text", image: "Image", video: "Video" };
const TIER_COLOR: Record<CampaignTier, string> = {
  text: "bg-slate-500/15 text-slate-200 border-slate-500/40",
  image: "bg-sky-500/15 text-sky-200 border-sky-500/40",
  video: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40",
};
const STATUS_COLOR: Record<CampaignStatus, string> = {
  draft: "bg-white/5 text-slate-300 border-white/10",
  active: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  paused: "bg-amber-500/15 text-amber-200 border-amber-500/40",
  ended: "bg-red-500/10 text-red-300 border-red-500/30",
};
const PLACEMENTS = ["feed", "marketplace", "academy", "bounties"] as const;

const BLANK: Partial<CampaignRow> = {
  title: "",
  advertiser: "",
  advertiser_email: "",
  advertiser_whatsapp: "",
  description: "",
  header: "",
  body: "",
  tier: "text",
  status: "draft",
  placements: ["feed"],
  cta_type: "url",
  cta_url: "",
  cta_label: "Learn more",
  cta_whatsapp: "",
  cta_lead_email: "",
  countries: [],
  cities: [],
  daily_budget_usd: 0,
  total_budget_usd: 0,
  priority: 0,
  start_at: null,
  end_at: null,
};

function CampaignsPage() {
  const listFn = useServerFn(listCampaignsAdmin);
  const delFn = useServerFn(deleteCampaignAdmin);
  const statusFn = useServerFn(setCampaignStatus);
  const [rows, setRows] = useState<CampaignRow[] | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [filter, setFilter] = useState<"all" | CampaignStatus>("all");

  const refresh = useCallback(() => {
    listFn().then((r) => setRows(r));
  }, [listFn]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => (filter === "all" ? true : r.status === filter)),
    [rows, filter],
  );

  const totals = useMemo(() => {
    const active = (rows ?? []).filter((r) => r.status === "active").length;
    const spent = (rows ?? []).reduce((a, r) => a + Number(r.spent_usd || 0), 0);
    const budget = (rows ?? []).reduce((a, r) => a + Number(r.total_budget_usd || 0), 0);
    return { active, spent, budget };
  }, [rows]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-black">Campaigns</h1>
          <p className="text-sm text-slate-400">Meta-Ads style ad manager · admin only</p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400"
        >
          <Plus className="w-4 h-4" /> New campaign
        </button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total campaigns" value={rows?.length ?? "—"} />
        <Stat label="Active" value={totals.active} />
        <Stat label="Budget (USD)" value={`$${totals.budget.toFixed(2)}`} />
        <Stat label="Spent (USD)" value={`$${totals.spent.toFixed(2)}`} />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {(["all", "draft", "active", "paused", "ended"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-2.5 py-1 rounded-[10px] text-xs font-bold border uppercase tracking-wider ${
              filter === s
                ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No campaigns match.</p>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0e0e12] text-[10px] uppercase text-slate-500 font-bold tracking-wider">
              <tr>
                <th className="text-left px-3 py-2.5">Campaign</th>
                <th className="text-left px-3 py-2.5">Tier</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-left px-3 py-2.5">Placements</th>
                <th className="text-right px-3 py-2.5">Budget / Spent</th>
                <th className="text-left px-3 py-2.5">Schedule</th>
                <th className="text-right px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#141418]">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-white/5">
                  <td className="px-3 py-3">
                    <button
                      onClick={() => setEditing(c.id)}
                      className="text-white font-bold text-left hover:text-emerald-300"
                    >
                      {c.title || "(untitled)"}
                    </button>
                    <div className="text-[11px] text-slate-500 mt-0.5">{c.advertiser || "—"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] uppercase font-bold ${TIER_COLOR[c.tier]}`}
                    >
                      {c.tier === "text" ? (
                        <Type className="w-3 h-3" />
                      ) : c.tier === "image" ? (
                        <ImageIcon className="w-3 h-3" />
                      ) : (
                        <VideoIcon className="w-3 h-3" />
                      )}
                      {TIER_LABEL[c.tier]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded border text-[10px] uppercase font-bold ${STATUS_COLOR[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-300 text-xs">
                    {(c.placements ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="text-white font-bold">
                      ${Number(c.total_budget_usd || 0).toFixed(2)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      ${Number(c.spent_usd || 0).toFixed(2)} spent · $
                      {Number(c.daily_budget_usd || 0).toFixed(2)}/day
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">
                    {c.start_at ? new Date(c.start_at).toLocaleDateString() : "—"}
                    <span className="text-slate-600"> → </span>
                    {c.end_at ? new Date(c.end_at).toLocaleDateString() : "∞"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {c.status !== "active" && c.status !== "ended" && (
                        <IconBtn
                          label="Activate"
                          onClick={async () => {
                            try {
                              await statusFn({ data: { id: c.id, action: "activate" } });
                              refresh();
                            } catch (e) {
                              alert((e as Error).message);
                            }
                          }}
                          className="text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/30"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </IconBtn>
                      )}
                      {c.status === "active" && (
                        <IconBtn
                          label="Pause"
                          onClick={async () => {
                            await statusFn({ data: { id: c.id, action: "pause" } });
                            refresh();
                          }}
                          className="text-amber-300 hover:bg-amber-500/10 border-amber-500/30"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </IconBtn>
                      )}
                      {c.status !== "ended" && (
                        <IconBtn
                          label="End"
                          onClick={async () => {
                            if (confirm("End campaign? Remaining escrow will be refunded.")) {
                              await statusFn({ data: { id: c.id, action: "end" } });
                              refresh();
                            }
                          }}
                          className="text-red-300 hover:bg-red-500/10 border-red-500/30"
                        >
                          <StopCircle className="w-3.5 h-3.5" />
                        </IconBtn>
                      )}
                      <IconBtn
                        label="Delete"
                        onClick={async () => {
                          if (confirm("Delete campaign permanently?")) {
                            await delFn({ data: { id: c.id } });
                            refresh();
                          }
                        }}
                        className="text-red-300 hover:bg-red-500/10 border-red-500/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CampaignDrawer
          id={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => refresh()}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[#141418] border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
      <div className="text-white text-lg font-black mt-1">{value}</div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-[10px] bg-white/5 border ${className}`}
    >
      {children}
    </button>
  );
}

/* --------------- Drawer --------------- */

function CampaignDrawer({
  id,
  onClose,
  onSaved,
}: {
  id: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const getFn = useServerFn(getCampaignAdmin);
  const upFn = useServerFn(upsertCampaignAdmin);
  const citiesFn = useServerFn(listTargetCities);
  const [tab, setTab] = useState<"details" | "creatives" | "analytics" | "leads">("details");
  const [form, setForm] = useState<Partial<CampaignRow>>({ ...BLANK });
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [cities, setCities] = useState<Array<{ id: string; country_code: string; city: string }>>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    citiesFn().then(setCities);
    if (!id) return;
    setLoading(true);
    getFn({ data: { id } })
      .then((r) => {
        setForm(r.campaign);
        setCreatives(r.creatives);
      })
      .finally(() => setLoading(false));
  }, [id, getFn, citiesFn]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await upFn({ data: { ...form, id: id ?? undefined } });
      onSaved();
      if (!id) {
        // reopen for uploads etc
        const fresh = await getFn({ data: { id: res.id } });
        setForm(fresh.campaign);
        setCreatives(fresh.creatives);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { k: "details", label: "Details" },
    { k: "creatives", label: "Creatives" },
    { k: "analytics", label: "Analytics" },
    { k: "leads", label: "Leads" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0e0e12] border-l border-white/10 h-full overflow-hidden flex flex-col"
      >
        <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-white font-black text-lg">
              {id ? form.title || "Campaign" : "New campaign"}
            </div>
            <div className="text-xs text-slate-500">{id ? `ID · ${id.slice(0, 8)}` : "Draft"}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[10px] hover:bg-white/5 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </header>

        <nav className="px-5 pt-3 flex gap-1 border-b border-white/10">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              disabled={!id && t.k !== "details"}
              className={`px-3 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wider ${
                tab === t.k
                  ? "bg-white/5 text-emerald-300 border-b-2 border-emerald-400"
                  : "text-slate-500 hover:text-white disabled:opacity-40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />
          ) : tab === "details" ? (
            <DetailsForm form={form} setForm={setForm} cities={cities} />
          ) : tab === "creatives" ? (
            <CreativesTab
              campaignId={id!}
              tier={form.tier as CampaignTier}
              creatives={creatives}
              onChange={setCreatives}
            />
          ) : tab === "analytics" ? (
            <AnalyticsTab campaignId={id!} />
          ) : (
            <LeadsTab campaignId={id!} />
          )}
        </div>

        {tab === "details" && (
          <footer className="px-5 py-3 border-t border-white/10 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-[10px] text-slate-300 hover:bg-white/5 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50"
            >
              {saving ? "Saving…" : id ? "Save changes" : "Create campaign"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

/* --------------- Details form --------------- */

function DetailsForm({
  form,
  setForm,
  cities,
}: {
  form: Partial<CampaignRow>;
  setForm: (v: Partial<CampaignRow>) => void;
  cities: Array<{ id: string; country_code: string; city: string }>;
}) {
  const toggleArr = (key: "placements" | "countries" | "cities", value: string) => {
    const current = (form[key] as string[]) ?? [];
    setForm({
      ...form,
      [key]: current.includes(value) ? current.filter((x) => x !== value) : [...current, value],
    });
  };

  const filteredCities = cities.filter((c) =>
    !form.countries?.length ? true : form.countries!.includes(c.country_code),
  );

  return (
    <div className="space-y-5">
      <Section title="Campaign">
        <Row>
          <Field label="Title">
            <input
              value={form.title ?? ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Advertiser">
            <input
              value={form.advertiser ?? ""}
              onChange={(e) => setForm({ ...form, advertiser: e.target.value })}
              className={inputCls}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Advertiser email">
            <input
              type="email"
              value={form.advertiser_email ?? ""}
              onChange={(e) => setForm({ ...form, advertiser_email: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Advertiser WhatsApp">
            <input
              placeholder="+2348012345678"
              value={form.advertiser_whatsapp ?? ""}
              onChange={(e) => setForm({ ...form, advertiser_whatsapp: e.target.value })}
              className={inputCls}
            />
          </Field>
        </Row>
        <Field label="Internal description">
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Creative tier">
        <div className="grid grid-cols-3 gap-2">
          {(["text", "image", "video"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setForm({ ...form, tier: t })}
              className={`p-3 rounded-[10px] border text-left ${form.tier === t ? "bg-emerald-500/10 border-emerald-500/40" : "bg-[#141418] border-white/10 hover:border-white/20"}`}
            >
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                {t === "text" ? (
                  <Type className="w-4 h-4" />
                ) : t === "image" ? (
                  <ImageIcon className="w-4 h-4" />
                ) : (
                  <VideoIcon className="w-4 h-4" />
                )}
                {TIER_LABEL[t]}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {t === "text"
                  ? "Header + body only"
                  : t === "image"
                    ? "1:1 carousel"
                    : "≤ 5 min · 100 MB"}
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Copy">
        <Field label="Header (max 60 chars)">
          <input
            maxLength={60}
            value={form.header ?? ""}
            onChange={(e) => setForm({ ...form, header: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Body">
          <textarea
            value={form.body ?? ""}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={3}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Call to action">
        <div className="grid grid-cols-3 gap-2 mb-2">
          {(["url", "whatsapp", "lead_form"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setForm({ ...form, cta_type: c })}
              className={`p-2.5 rounded-[10px] border text-xs font-bold flex items-center gap-1.5 justify-center ${form.cta_type === c ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200" : "bg-[#141418] border-white/10 text-slate-300"}`}
            >
              {c === "url" ? (
                <ExternalLink className="w-3.5 h-3.5" />
              ) : c === "whatsapp" ? (
                <MessageCircle className="w-3.5 h-3.5" />
              ) : (
                <Mail className="w-3.5 h-3.5" />
              )}
              {c === "url" ? "Website" : c === "whatsapp" ? "WhatsApp" : "Lead form"}
            </button>
          ))}
        </div>
        <Row>
          <Field label="Button label">
            <input
              value={form.cta_label ?? ""}
              onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
              className={inputCls}
            />
          </Field>
          {form.cta_type === "url" && (
            <Field label="Destination URL">
              <input
                type="url"
                value={form.cta_url ?? ""}
                onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                className={inputCls}
              />
            </Field>
          )}
          {form.cta_type === "whatsapp" && (
            <Field label="WhatsApp number">
              <input
                placeholder="+2348012345678"
                value={form.cta_whatsapp ?? ""}
                onChange={(e) => setForm({ ...form, cta_whatsapp: e.target.value })}
                className={inputCls}
              />
            </Field>
          )}
          {form.cta_type === "lead_form" && (
            <Field label="Lead delivery email">
              <input
                type="email"
                value={form.cta_lead_email ?? ""}
                onChange={(e) => setForm({ ...form, cta_lead_email: e.target.value })}
                className={inputCls}
              />
            </Field>
          )}
        </Row>
      </Section>

      <Section title="Placements">
        <div className="flex flex-wrap gap-2">
          {PLACEMENTS.map((p) => {
            const on = (form.placements ?? []).includes(p);
            return (
              <button
                key={p}
                onClick={() => toggleArr("placements", p)}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-bold border uppercase tracking-wider ${on ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "bg-white/5 border-white/10 text-slate-400"}`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Targeting">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
          Countries
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { code: "NG", label: "Nigeria" },
            { code: "GH", label: "Ghana" },
          ].map((c) => {
            const on = (form.countries ?? []).includes(c.code);
            return (
              <button
                key={c.code}
                onClick={() => toggleArr("countries", c.code)}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-bold border ${on ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "bg-white/5 border-white/10 text-slate-400"}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
          Cities · leave empty for all
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
          {filteredCities.map((c) => {
            const on = (form.cities ?? []).includes(c.city);
            return (
              <button
                key={c.id}
                onClick={() => toggleArr("cities", c.city)}
                className={`px-2 py-1 rounded-[10px] text-[11px] border ${on ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "bg-white/5 border-white/10 text-slate-400"}`}
              >
                {c.city}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Budget & schedule">
        <Row>
          <Field label="Daily budget (USD)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.daily_budget_usd ?? 0}
              onChange={(e) => setForm({ ...form, daily_budget_usd: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Total budget (USD)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.total_budget_usd ?? 0}
              onChange={(e) => setForm({ ...form, total_budget_usd: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Start">
            <input
              type="datetime-local"
              value={form.start_at ? form.start_at.slice(0, 16) : ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  start_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className={inputCls}
            />
          </Field>
          <Field label="End">
            <input
              type="datetime-local"
              value={form.end_at ? form.end_at.slice(0, 16) : ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  end_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className={inputCls}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Priority (higher wins)">
            <input
              type="number"
              value={form.priority ?? 0}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status ?? "draft"}
              onChange={(e) => setForm({ ...form, status: e.target.value as CampaignStatus })}
              className={inputCls}
            >
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
            </select>
          </Field>
        </Row>
        <p className="text-[11px] text-slate-500 mt-2">
          To activate a campaign, save first, then use the Activate button in the list — this locks
          the advertiser wallet escrow.
        </p>
      </Section>
    </div>
  );
}

/* --------------- Creatives tab --------------- */

function CreativesTab({
  campaignId,
  tier,
  creatives,
  onChange,
}: {
  campaignId: string;
  tier: CampaignTier;
  creatives: Creative[];
  onChange: (v: Creative[]) => void;
}) {
  const listFn = useServerFn(listCreatives);
  const signFn = useServerFn(createCreativeUploadUrl);
  const attachFn = useServerFn(attachCreative);
  const delFn = useServerFn(deleteCreative);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await listFn({ data: { campaign_id: campaignId } });
    onChange(rows);
  }, [listFn, campaignId, onChange]);

  if (tier === "text") {
    return (
      <p className="text-sm text-slate-400">
        Text-tier campaigns have no media creatives. Switch tier under Details to attach images or
        video.
      </p>
    );
  }

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const kind = tier === "video" ? "video" : "image";
      if (kind === "video" && file.size > 100 * 1024 * 1024) throw new Error("Video exceeds 100MB");
      if (kind === "image" && file.size > 8 * 1024 * 1024) throw new Error("Image exceeds 8MB");
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const { path, token } = await signFn({
        data: { campaign_id: campaignId, kind, extension: ext },
      });
      const { error: upErr } = await supabase.storage
        .from("ad-media")
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      let duration: number | undefined;
      if (kind === "video") {
        duration = await new Promise<number>((resolve) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.src = URL.createObjectURL(file);
          v.onloadedmetadata = () => {
            resolve(v.duration || 0);
            URL.revokeObjectURL(v.src);
          };
          v.onerror = () => resolve(0);
        });
        if (duration > 300) throw new Error("Video exceeds 5 minutes");
      }
      await attachFn({
        data: {
          campaign_id: campaignId,
          kind,
          path,
          mime: file.type,
          bytes: file.size,
          duration_s: duration,
          sort_order: creatives.length,
        },
      });
      await refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 border-dashed cursor-pointer hover:bg-white/10 text-sm text-slate-300 w-fit">
        <Upload className="w-4 h-4" />
        {uploading
          ? "Uploading…"
          : tier === "video"
            ? "Upload video (≤ 5 min · 100 MB)"
            : "Upload image (1:1, ≤ 8 MB)"}
        <input
          type="file"
          accept={
            tier === "video"
              ? "video/mp4,video/webm,video/quicktime"
              : "image/jpeg,image/png,image/webp"
          }
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.currentTarget.value = "";
          }}
          disabled={uploading}
        />
      </label>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {creatives.map((c) => (
          <div
            key={c.id}
            className="relative bg-[#141418] border border-white/10 rounded-[10px] overflow-hidden group"
          >
            {c.kind === "image" ? (
              <img loading="lazy" decoding="async" src={c.url} alt="" className="w-full aspect-square object-cover" />
            ) : (
              <video src={c.url} className="w-full aspect-square object-cover" muted playsInline />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[10px] text-slate-300 flex items-center justify-between">
              <span>{c.kind === "video" ? `${Math.round(c.duration_s ?? 0)}s` : "image"}</span>
              <button
                onClick={async () => {
                  if (confirm("Delete creative?")) {
                    await delFn({ data: { id: c.id } });
                    await refresh();
                  }
                }}
                className="text-red-300 hover:text-red-200"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {creatives.length === 0 && (
          <p className="text-xs text-slate-500 col-span-full">No creatives yet.</p>
        )}
      </div>
    </div>
  );
}

/* --------------- Analytics tab --------------- */

function AnalyticsTab({ campaignId }: { campaignId: string }) {
  const metricsFn = useServerFn(getCampaignMetrics);
  const [data, setData] = useState<{
    totals: { spent: number; impressions: number; clicks: number; leads: number };
    series: Array<{
      day: string;
      spent_usd: number;
      impressions: number;
      clicks: number;
      leads: number;
    }>;
  } | null>(null);

  useEffect(() => {
    metricsFn({ data: { id: campaignId, days: 14 } }).then(setData);
  }, [metricsFn, campaignId]);
  if (!data) return <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />;

  const max = Math.max(1, ...data.series.map((r) => r.impressions));
  const ctr =
    data.totals.impressions > 0 ? (data.totals.clicks / data.totals.impressions) * 100 : 0;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <Stat label="Impressions" value={data.totals.impressions.toLocaleString()} />
        <Stat label="Clicks" value={data.totals.clicks.toLocaleString()} />
        <Stat label="Leads" value={data.totals.leads.toLocaleString()} />
        <Stat label="Spend (USD)" value={`$${data.totals.spent.toFixed(2)}`} />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
        Impressions · last {data.series.length} days · CTR {ctr.toFixed(2)}%
      </div>
      <div className="flex items-end gap-1 h-32 bg-[#0e0e12] border border-white/10 rounded-[10px] p-2">
        {data.series.length === 0 && (
          <span className="text-xs text-slate-500 m-auto">No activity yet.</span>
        )}
        {data.series.map((r) => (
          <div key={r.day} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div
              className="w-full rounded-t bg-emerald-500/50"
              style={{ height: `${(r.impressions / max) * 100}%` }}
            />
            <div className="text-[9px] text-slate-600">{r.day.slice(5)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------- Leads tab --------------- */

function LeadsTab({ campaignId }: { campaignId: string }) {
  const leadsFn = useServerFn(listCampaignLeads);
  const [rows, setRows] = useState<Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    message: string | null;
    created_at: string;
  }> | null>(null);
  useEffect(() => {
    leadsFn({ data: { id: campaignId, limit: 200 } }).then(setRows);
  }, [leadsFn, campaignId]);
  if (!rows) return <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />;
  if (rows.length === 0)
    return (
      <p className="text-sm text-slate-500">
        No leads yet — daily digests will be sent to the advertiser's email once leads arrive.
      </p>
    );
  return (
    <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-[#141418]">
      {rows.map((r) => (
        <div key={r.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-white text-sm font-bold">{r.name || r.email || "Anonymous"}</div>
            <div className="text-[10px] text-slate-500">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {r.email} · {r.phone || "—"}
          </div>
          {r.message && <div className="text-xs text-slate-300 mt-1">{r.message}</div>}
        </div>
      ))}
    </div>
  );
}

/* --------------- shared --------------- */

const inputCls =
  "w-full bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400/40";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <ArrowUpDown className="w-3 h-3 text-emerald-400/70" />
        <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-black">
          {title}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

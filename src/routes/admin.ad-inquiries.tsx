import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Mail,
  Phone,
  Globe,
  ChevronRight,
  Video as VideoIcon,
  Image as ImageIcon,
} from "lucide-react";
import { listAdInquiries, updateAdInquiry } from "@/lib/ad-inquiries.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/ad-inquiries")({
  head: () => ({
    meta: [{ title: "Ad Inquiries · Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdInquiriesPage,
});

type Inquiry = Awaited<ReturnType<typeof listAdInquiries>>["inquiries"][number];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 border-blue-500/40 text-blue-300",
  contacted: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  awaiting_funds: "bg-purple-500/15 border-purple-500/40 text-purple-300",
  active: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  rejected: "bg-red-500/15 border-red-500/40 text-red-300",
  archived: "bg-slate-500/15 border-slate-500/40 text-slate-300",
};

function AdInquiriesPage() {
  const list = useServerFn(listAdInquiries);
  const update = useServerFn(updateAdInquiry);
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [signed, setSigned] = useState<{ images: string[]; video: string | null }>({
    images: [],
    video: null,
  });
  const [adminNotes, setAdminNotes] = useState("");

  const load = async () => {
    try {
      const res = await list();
      setItems(res.inquiries as Inquiry[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) {
      setSigned({ images: [], video: null });
      setAdminNotes("");
      return;
    }
    setAdminNotes(selected.admin_notes ?? "");
    (async () => {
      const images: string[] = [];
      for (const p of selected.image_paths ?? []) {
        const { data } = await supabase.storage.from("ad-media").createSignedUrl(p, 3600);
        if (data?.signedUrl) images.push(data.signedUrl);
      }
      let video: string | null = null;
      if (selected.video_path) {
        const { data } = await supabase.storage
          .from("ad-media")
          .createSignedUrl(selected.video_path, 3600);
        video = data?.signedUrl ?? null;
      }
      setSigned({ images, video });
    })();
  }, [selected]);

  const changeStatus = async (status: Inquiry["status"]) => {
    if (!selected) return;
    try {
      await update({ data: { id: selected.id, status, admin_notes: adminNotes } });
      toast.success("Updated");
      await load();
      setSelected((s) => (s ? { ...s, status, admin_notes: adminNotes } : s));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Ad Inquiries</h1>
          <p className="text-sm text-slate-400 mt-1">
            Submissions from the Advertise landing page.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">No inquiries yet.</div>
      ) : (
        <div className="rounded-2xl bg-[#141418] border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Advertiser</th>
                <th className="text-left px-4 py-3">Tier</th>
                <th className="text-left px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((it) => (
                <tr
                  key={it.id}
                  className="hover:bg-white/5 cursor-pointer"
                  onClick={() => setSelected(it)}
                >
                  <td className="px-4 py-3">
                    <div className="text-white font-bold">{it.contact_name}</div>
                    <div className="text-xs text-slate-500">{it.contact_email}</div>
                  </td>
                  <td className="px-4 py-3 uppercase text-xs font-bold text-emerald-300">
                    {it.tier}
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">
                    ${Number(it.total_budget_usd ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${STATUS_COLORS[it.status] ?? ""}`}
                    >
                      {it.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(it.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl h-full overflow-y-auto bg-[#141418] border-l border-white/10 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-white">{selected.header}</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {selected.company || "—"} ·{" "}
                  <span className="uppercase text-emerald-300">{selected.tier}</span> tier
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase ${STATUS_COLORS[selected.status] ?? ""}`}
              >
                {selected.status.replace("_", " ")}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-5">
              <Row icon={<Mail className="w-4 h-4" />} label={selected.contact_email} />
              {selected.contact_phone && (
                <Row icon={<Phone className="w-4 h-4" />} label={selected.contact_phone} />
              )}
              {selected.website && (
                <Row icon={<Globe className="w-4 h-4" />} label={selected.website} />
              )}
            </div>

            <Section title="Creative">
              <p className="text-xs text-slate-400">
                <strong className="text-slate-200">Description:</strong>{" "}
                {selected.description || "—"}
              </p>
              {selected.body && (
                <p className="text-xs text-slate-400 mt-2">
                  <strong className="text-slate-200">Body:</strong> {selected.body}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-2">
                <strong className="text-slate-200">CTA:</strong> {selected.cta_type} →{" "}
                {selected.cta_url || selected.cta_whatsapp || "—"}
              </p>

              {signed.images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {signed.images.map((u) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square rounded-[10px] overflow-hidden bg-black"
                    >
                      <img loading="lazy" decoding="async" src={u} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {signed.video && (
                <video src={signed.video} controls className="mt-3 w-full rounded-[10px] bg-black" />
              )}
              {selected.video_url && (
                <a
                  href={selected.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-300 font-bold"
                >
                  <VideoIcon className="w-3.5 h-3.5" /> {selected.video_url}
                </a>
              )}
              {!signed.images.length && !signed.video && !selected.video_url && (
                <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> No media uploaded
                </div>
              )}
            </Section>

            <Section title="Targeting">
              <p className="text-xs text-slate-400">
                <strong className="text-slate-200">Countries:</strong>{" "}
                {(selected.countries ?? []).join(", ") || "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <strong className="text-slate-200">Cities:</strong>{" "}
                {(selected.cities ?? []).join(", ") || "All"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <strong className="text-slate-200">Demographics:</strong>{" "}
                {JSON.stringify(selected.demographics)}
              </p>
            </Section>

            <Section title="Budget">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Duration" value={`${selected.duration_days ?? 0}d`} />
                <Stat
                  label="Daily"
                  value={`$${Number(selected.daily_budget_usd ?? 0).toFixed(2)}`}
                />
                <Stat
                  label="Total"
                  value={`$${Number(selected.total_budget_usd ?? 0).toFixed(2)}`}
                />
              </div>
            </Section>

            {selected.notes && (
              <Section title="Advertiser notes">
                <p className="text-xs text-slate-300">{selected.notes}</p>
              </Section>
            )}

            <Section title="Admin notes">
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full min-h-[80px] p-3 rounded-[10px] bg-[#0f0f12] border border-white/10 text-xs text-slate-200"
                placeholder="Internal notes…"
              />
            </Section>

            <div className="mt-5 flex flex-wrap gap-2">
              {(["contacted", "awaiting_funds", "active", "rejected", "archived"] as const).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase border ${STATUS_COLORS[s]} hover:brightness-125`}
                  >
                    Mark {s.replace("_", " ")}
                  </button>
                ),
              )}
            </div>

            <button
              onClick={() => setSelected(null)}
              className="mt-4 w-full h-10 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-300">
      <span className="text-slate-500">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 p-4 rounded-xl bg-[#0f0f12] border border-white/10">
      <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-black mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-[10px] bg-white/5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-black text-white mt-0.5">{value}</div>
    </div>
  );
}

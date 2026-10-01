import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, BarChart3, Camera, Download, Eye, FileText, FolderHeart, LayoutDashboard, Loader2, Pencil, Play, Settings,
  Trash2, Trophy, UserRound, Users, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { formatMoney, usdRate } from "@/lib/fx-display";
import { Header } from "@/components/oventric/Header";
import { getCreatorStudio, saveCreatorStudioProfile, type CreatorStudioDTO, type StudioPostDTO } from "@/lib/creator-studio.functions";
import { deleteCreatorPost } from "@/lib/creators.functions";
import { getCreatorAnalytics, type AnalyticsRange } from "@/lib/creator-analytics.functions";
import { updateMyProfile } from "@/lib/profiles.functions";
import { CreatorPublishModal } from "./CreatorPublishModal";
import { CreatorCollectionsSheet } from "./CreatorCollectionsSheet";

type Tab = "overview" | "content" | "resources" | "collections" | "challenges" | "analytics" | "profile" | "settings";
const TABS: { key: Tab; label: string; icon: typeof Eye }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "content", label: "Content", icon: FileText },
  { key: "resources", label: "Resources", icon: Download },
  { key: "collections", label: "Collections", icon: FolderHeart },
  { key: "challenges", label: "Challenges", icon: Trophy },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "profile", label: "Profile", icon: UserRound },
  { key: "settings", label: "Settings", icon: Settings },
];
const CATEGORIES = ["Video", "Design", "AI", "Photography", "Writing", "Marketing", "Education", "Development", "Animation", "Music", "Digital Products"];
const TOOLS = ["Canva", "CapCut", "Figma", "Photoshop", "Premiere Pro", "ChatGPT", "Veo"];

/** Private Creator Studio. Separate from the Seller Dashboard; reads only the creator's own data. */
export function CreatorStudioPage() {
  const isApp = useIsAppShell();
  const navigate = useNavigate();
  const { isAuthenticated, checked, openGate } = useAuthGate() as ReturnType<typeof useAuthGate> & { checked?: boolean };
  const [tab, setTab] = useState<Tab>("overview");
  const load = useServerFn(getCreatorStudio);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["creator-studio"], queryFn: () => load(), enabled: isAuthenticated, staleTime: 30_000 });

  const t = isApp
    ? { page: "fixed inset-0 overflow-y-auto overscroll-contain bg-[#070A08] text-white [-webkit-overflow-scrolling:touch]", card: "bg-white/[0.04] border-white/10", muted: "text-white/55", cta: "bg-[#E5484D] text-white", ghost: "border-white/15 text-white", chipOn: "bg-white text-black", chipOff: "border border-white/10 text-white/75", input: "bg-white/[0.05] border-white/10 text-white placeholder:text-white/35", accent: "text-[#E5484D]" }
    : { page: "min-h-screen bg-slate-50 text-slate-900", card: "bg-white border-slate-200", muted: "text-slate-500", cta: "bg-slate-900 text-white", ghost: "border-slate-200 text-slate-900", chipOn: "bg-slate-900 text-white", chipOff: "border border-slate-200 text-slate-600", input: "bg-white border-slate-200 text-slate-900", accent: "text-violet-600" };

  const back = () => (window.history.length > 1 ? window.history.back() : navigate({ to: "/creators" }));

  return (
    <div className={t.page}>
      {!isApp && <Header />}
      <div className={`mx-auto ${isApp ? "px-4 pb-28 pt-[calc(0.75rem+env(safe-area-inset-top))]" : "max-w-6xl px-4 py-6"}`}>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={back} aria-label="Back" className="-ml-2 rounded-full p-2"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${t.accent}`}>Private</div>
            <h1 className={`font-black leading-none ${isApp ? "text-[22px]" : "text-3xl"}`}>Creator Studio</h1>
          </div>
        </div>

        {!isAuthenticated ? (
          <div className={`rounded-[10px] border p-8 text-center ${t.card}`}>
            <p className={t.muted}>{checked === false ? "Loading…" : "Sign in to open your Creator Studio."}</p>
            <button onClick={() => openGate("generic")} className={`mt-3 rounded-[10px] px-4 py-2 text-sm font-bold ${t.cta}`}>Sign in</button>
          </div>
        ) : isLoading ? (
          <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin" />
        ) : error || !data ? (
          <div className={`rounded-[10px] border p-6 text-center ${t.card}`}>Couldn't load your studio. <button className="font-bold underline" onClick={() => refetch()}>Try again</button></div>
        ) : (
          <div className={isApp ? "" : "md:grid md:grid-cols-[200px_1fr] md:gap-6"}>
            {/* Phone: swipeable chips. Desktop: side menu. */}
            <nav className={isApp ? "-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" : "mb-4 flex gap-2 overflow-x-auto md:mb-0 md:flex-col md:overflow-visible"}>
              {TABS.map((x) => (
                <button key={x.key} onClick={() => setTab(x.key)} className={`inline-flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-semibold ${tab === x.key ? t.chipOn : t.chipOff}`}>
                  <x.icon className="h-4 w-4" /> {x.label}
                </button>
              ))}
            </nav>
            <div className="min-w-0">
              <StudioBody tab={tab} data={data} t={t} isApp={isApp} setTab={setTab} reload={() => refetch()} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

}

type Theme = { card: string; muted: string; cta: string; ghost: string; chipOn: string; chipOff: string; input: string; accent: string };

function useMoney() {
  const { homeCurrency } = useOnboarding();
  const cur = (homeCurrency ?? "USD") as Currency;
  return (usd: number) => formatMoney(usd * usdRate(cur), cur);
}

function StudioBody({ tab, data, t, isApp, setTab, reload }: { tab: Tab; data: CreatorStudioDTO; t: Theme; isApp: boolean; setTab: (x: Tab) => void; reload: () => void }) {
  const money = useMoney();
  const [editId, setEditId] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const [collections, setCollections] = useState(false);
  const del = useServerFn(deleteCreatorPost);
  const s = data.stats;

  const remove = async (p: StudioPostDTO) => {
    if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    try { await del({ data: { postId: p.id } }); toast.success("Deleted"); reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't delete"); }
  };
  const edit = (id: string) => { setEditId(id); setComposer(true); };

  const stat = (label: string, value: string, Icon: typeof Eye) => (
    <div className={`rounded-[10px] border p-3 ${t.card}`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${t.muted}`}><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 text-[20px] font-black">{value}</div>
    </div>
  );
  const Title = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
    <div className="mb-2 mt-5 flex items-center justify-between first:mt-0"><h2 className="text-[15px] font-black">{children}</h2>{action}</div>
  );
  const empty = (msg: string) => <p className={`rounded-[10px] border border-dashed p-6 text-center text-[13px] ${t.card} ${t.muted}`}>{msg}</p>;

  const PostRow = ({ p }: { p: StudioPostDTO }) => (
    <div className={`flex items-center gap-3 rounded-[10px] border p-2.5 ${t.card}`}>
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-black/20">
        {p.thumbUrl && <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />}
        {p.isVideo && <Play className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold">{p.title}</div>
        <div className={`text-[11.5px] ${t.muted}`}>
          {p.status === "draft" ? "Draft" : p.visibility === "unlisted" ? "Unlisted" : "Published"} · {p.views.toLocaleString()} views · {new Date(p.createdAt).toLocaleDateString()}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {p.status === "published" && <a href={`/creators?creatorPost=${p.id}`} aria-label="View" className={`rounded-[8px] border p-2 ${t.ghost}`}><Eye className="h-4 w-4" /></a>}
        <button onClick={() => edit(p.id)} aria-label="Edit" className={`rounded-[8px] border p-2 ${t.ghost}`}><Pencil className="h-4 w-4" /></button>
        <button onClick={() => remove(p)} aria-label="Delete" className="rounded-[8px] border border-red-500/30 p-2 text-red-500"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );

  const published = data.posts.filter((p) => p.status === "published");
  const drafts = data.posts.filter((p) => p.status === "draft");
  const [contentFilter, setContentFilter] = useState<"published" | "drafts">("published");

  let body: React.ReactNode = null;
  if (tab === "overview") {
    body = (
      <>
        <div className={`grid gap-2 ${isApp ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-5"}`}>
          {stat("Content views", s.views.toLocaleString(), Eye)}
          {stat("Followers", s.followers.toLocaleString(), Users)}
          {stat("Downloads", s.downloads.toLocaleString(), Download)}
          {stat("Resource sales", s.sales.toLocaleString(), Wallet)}
          <div className={isApp ? "col-span-2" : ""}>{stat("Resource earnings", money(s.earningsUsd), Wallet)}</div>
        </div>
        <p className={`mt-2 text-[11px] ${t.muted}`}>Earnings are your share of paid resource orders. Withdrawals stay in your Wallet.</p>
        <Title action={<button onClick={() => setTab("content")} className={`text-[12px] font-bold ${t.accent}`}>All</button>}>Recent content</Title>
        {published.length ? <div className="space-y-2">{published.slice(0, 3).map((p) => <PostRow key={p.id} p={p} />)}</div> : empty("You haven't published anything yet.")}
        <Title action={<button onClick={() => setTab("resources")} className={`text-[12px] font-bold ${t.accent}`}>All</button>}>Recent resources</Title>
        {data.resources.length ? <ResourceList items={data.resources.slice(0, 3)} t={t} money={money} isApp={isApp} /> : empty("No resources yet. Attach a file when you publish.")}
        <Title>Active challenges</Title>
        <ChallengeList data={data} t={t} empty={empty} />
      </>
    );
  } else if (tab === "content") {
    const list = contentFilter === "published" ? published : drafts;
    body = (
      <>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["published", "drafts"] as const).map((k) => (
            <button key={k} onClick={() => setContentFilter(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${contentFilter === k ? t.chipOn : t.chipOff}`}>
              {k === "published" ? `Published (${published.length})` : `Drafts (${drafts.length})`}
            </button>
          ))}
          <button onClick={() => { setEditId(null); setComposer(true); }} className={`ml-auto rounded-[10px] px-3 py-1.5 text-[12px] font-bold ${t.cta}`}>New post</button>
        </div>
        {list.length ? <div className="space-y-2">{list.map((p) => <PostRow key={p.id} p={p} />)}</div> : empty(contentFilter === "drafts" ? "No drafts." : "Nothing published yet.")}
        <p className={`mt-3 text-[11px] ${t.muted}`}>Archiving isn't available for Creator posts yet — use Unlisted visibility to hide a post from feeds.</p>
      </>
    );
  } else if (tab === "resources") {
    body = data.resources.length ? <ResourceList items={data.resources} t={t} money={money} isApp={isApp} /> : empty("No resources yet. Attach a file when you publish a post.");
  } else if (tab === "collections") {
    body = (
      <div className={`rounded-[10px] border p-5 ${t.card}`}>
        <p className={`text-[13px] ${t.muted}`}>Group your content, resources and shop products into collections people can browse.</p>
        <button onClick={() => setCollections(true)} className={`mt-3 rounded-[10px] px-4 py-2 text-[13px] font-bold ${t.cta}`}>Manage collections</button>
      </div>
    );
  } else if (tab === "challenges") {
    body = (
      <>
        <ChallengeList data={data} t={t} empty={empty} />
        <Link to="/creators" className={`mt-3 inline-block text-[12px] font-bold ${t.accent}`}>Browse all challenges in Creator's Hub</Link>
      </>
    );
  } else if (tab === "analytics") {
    body = <AnalyticsPanel t={t} isApp={isApp} />;
  } else if (tab === "profile") {
    body = <ProfileEditor data={data} t={t} reload={reload} />;
  } else {
    body = (
      <div className="space-y-2">
        {[
          { to: "/dashboard" as const, label: "Seller Dashboard", note: "Products, orders and payouts — unchanged." },
          { to: "/wallet" as const, label: "Wallet", note: "Balances and withdrawals." },
        ].map((l) => (
          <Link key={l.to} to={l.to} className={`block rounded-[10px] border p-4 ${t.card}`}><div className="font-bold">{l.label}</div><div className={`text-[12px] ${t.muted}`}>{l.note}</div></Link>
        ))}
        <div className={`rounded-[10px] border p-4 ${t.card}`}>
          <div className="font-bold">Account & security</div>
          <div className={`text-[12px] ${t.muted}`}>Password, email, notifications and privacy live in your existing account settings (tap your photo → Settings).</div>
        </div>
        {data.profile.slug && <Link to="/creators/$handle" params={{ handle: `@${data.profile.slug}` }} className={`block rounded-[10px] border p-4 ${t.card}`}><div className="font-bold">View public creator profile</div><div className={`text-[12px] ${t.muted}`}>/creators/@{data.profile.slug}</div></Link>}
      </div>
    );
  }

  return (
    <>
      {body}
      <CreatorPublishModal open={composer} editPostId={editId} onClose={() => { setComposer(false); setEditId(null); }} onPublished={reload} />
      <CreatorCollectionsSheet open={collections} isApp={isApp} onClose={() => setCollections(false)} />
    </>
  );
}

function ResourceList({ items, t, money, isApp }: { items: CreatorStudioDTO["resources"]; t: Theme; money: (u: number) => string; isApp: boolean }) {
  if (isApp) {
    return (
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.productId} className={`rounded-[10px] border p-3 ${t.card}`}>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[13.5px] font-bold">{r.title}</div><div className={`text-[11.5px] ${t.muted}`}>{r.type ?? "File"} · {r.isFree ? "Free" : money(r.priceUsd)} · {r.status}</div></div></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div><div className="text-[15px] font-black">{r.downloads}</div><div className={t.muted}>Downloads</div></div>
              <div><div className="text-[15px] font-black">{r.sales}</div><div className={t.muted}>Sales</div></div>
              <div><div className="text-[15px] font-black">{money(r.revenueUsd)}</div><div className={t.muted}>Revenue</div></div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`overflow-x-auto rounded-[10px] border ${t.card}`}>
      <table className="w-full text-left text-[13px]">
        <thead className={t.muted}><tr>{["Resource", "Type", "Free/Paid", "Downloads", "Sales", "Revenue", "Status"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.productId} className="border-t border-slate-100">
              <td className="max-w-[240px] truncate px-3 py-2 font-semibold">{r.title}</td>
              <td className="px-3 py-2">{r.type ?? "File"}</td>
              <td className="px-3 py-2">{r.isFree ? "Free" : money(r.priceUsd)}</td>
              <td className="px-3 py-2">{r.downloads}</td>
              <td className="px-3 py-2">{r.sales}</td>
              <td className="px-3 py-2">{money(r.revenueUsd)}</td>
              <td className="px-3 py-2">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChallengeList({ data, t, empty }: { data: CreatorStudioDTO; t: Theme; empty: (m: string) => React.ReactNode }) {
  if (!data.challenges.length) return <>{empty("No challenges are open right now.")}</>;
  return (
    <div className="space-y-2">
      {data.challenges.map((c) => (
        <Link key={c.id} to="/creators/challenges/$id" params={{ id: c.id }} className={`flex items-center justify-between rounded-[10px] border p-3 ${t.card}`}>
          <div className="min-w-0"><div className="truncate text-[13.5px] font-bold">{c.title}</div><div className={`text-[11.5px] ${t.muted}`}>Ends {new Date(c.endsAt).toLocaleDateString()}</div></div>
          <span className={`shrink-0 text-[11.5px] font-bold ${c.entered ? t.accent : t.muted}`}>{c.entered ? `${c.entered} entered` : "Enter"}</span>
        </Link>
      ))}
    </div>
  );
}

function ProfileEditor({ data, t, reload }: { data: CreatorStudioDTO; t: Theme; reload: () => void }) {
  const qc = useQueryClient();
  const saveProfile = useServerFn(updateMyProfile);
  const saveCreator = useServerFn(saveCreatorStudioProfile);
  const p = data.profile;
  const [bio, setBio] = useState(p.bio);
  const [category, setCategory] = useState(p.category);
  const [tools, setTools] = useState<string[]>(p.tools);
  const [featuredPost, setFeaturedPost] = useState(p.featuredPostId ?? "");
  const [featuredRes, setFeaturedRes] = useState(p.featuredResourceId ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const published = useMemo(() => data.posts.filter((x) => x.status === "published"), [data.posts]);
  const resourcePosts = useMemo(() => data.resources.filter((r) => published.some((x) => x.id === r.postId)), [data.resources, published]);
  const allTools = Array.from(new Set([...TOOLS, ...tools]));

  const upload = async (kind: "avatar" | "cover", file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return toast.error("Choose an image under 8MB.");
    setBusy(kind);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sign in again");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "jpg";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(kind === "avatar" ? "avatars" : "profile-covers").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      await saveProfile({ data: kind === "avatar" ? { avatarPath: path } : { coverPath: path } });
      window.dispatchEvent(new CustomEvent("oventric:profile-updated", { detail: { userId: u.user.id } }));
      toast.success(kind === "avatar" ? "Photo updated" : "Cover updated");
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(null); }
  };

  const save = async () => {
    setBusy("save");
    try {
      await saveProfile({ data: { bio: bio.trim() || null, tools } });
      await saveCreator({ data: { category, featuredPostId: featuredPost || null, featuredResourceId: featuredRes || null } });
      await qc.invalidateQueries({ queryKey: ["creator-hub-creators"] });
      toast.success("Creator profile saved");
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save"); } finally { setBusy(null); }
  };

  const label = `mb-1 block text-[12px] font-bold`;
  const field = `w-full rounded-[10px] border px-3 py-2.5 text-[14px] outline-none ${t.input}`;

  return (
    <div className="space-y-4">
      <div className={`overflow-hidden rounded-[10px] border ${t.card}`}>
        <button onClick={() => coverRef.current?.click()} className="relative block aspect-[3/1] w-full bg-black/20">
          {p.coverUrl && <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />}
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">{busy === "cover" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />} Cover</span>
        </button>
        <div className="flex items-center gap-3 p-3">
          <button onClick={() => avatarRef.current?.click()} className="relative -mt-10 h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-black/40 bg-black/30" aria-label="Change photo">
            {p.avatarUrl && <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />}
            <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/55 py-0.5 text-white">{busy === "avatar" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}</span>
          </button>
          <div className="min-w-0"><div className="truncate font-black">{p.name}</div>{p.slug && <div className={`text-[12px] ${t.muted}`}>@{p.slug}</div>}</div>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => upload("avatar", e.target.files?.[0])} />
        <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => upload("cover", e.target.files?.[0])} />
      </div>

      <div><label className={label}>Bio</label><textarea rows={3} maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} className={field} /></div>
      <div><label className={label}>Creator category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}><option value="">Choose…</option>{Array.from(new Set([...CATEGORIES, ...(category ? [category] : [])])).map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div><label className={label}>Tools</label>
        <div className="flex flex-wrap gap-2">
          {allTools.map((x) => {
            const on = tools.includes(x);
            return <button key={x} type="button" onClick={() => setTools(on ? tools.filter((y) => y !== x) : [...tools, x].slice(0, 12))} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${on ? t.chipOn : t.chipOff}`}>{x}</button>;
          })}
        </div>
      </div>
      <div><label className={label}>Featured content</label>
        <select value={featuredPost} onChange={(e) => setFeaturedPost(e.target.value)} className={field}><option value="">None</option>{published.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
      </div>
      <div><label className={label}>Featured resource</label>
        <select value={featuredRes} onChange={(e) => setFeaturedRes(e.target.value)} className={field}><option value="">None</option>{resourcePosts.map((r) => <option key={r.postId} value={r.postId}>{r.title}</option>)}</select>
      </div>
      <button disabled={busy === "save"} onClick={save} className={`w-full rounded-[10px] px-4 py-3 text-[14px] font-bold md:w-auto ${t.cta}`}>{busy === "save" ? "Saving…" : "Save profile"}</button>
    </div>
  );
}

const RANGES: { v: AnalyticsRange; label: string }[] = [
  { v: 7, label: "7 days" },
  { v: 30, label: "30 days" },
  { v: 90, label: "90 days" },
  { v: 0, label: "All time" },
];

function AnalyticsPanel({ t, isApp }: { t: Theme; isApp: boolean }) {
  const [range, setRange] = useState<AnalyticsRange>(30);
  const load = useServerFn(getCreatorAnalytics);
  const { data: a, isLoading, error } = useQuery({ queryKey: ["creator-analytics", range], queryFn: () => load({ data: { range } }), staleTime: 30_000 });
  const n = (x: number) => x.toLocaleString();
  const tile = (label: string, value: string, note?: string) => (
    <div className={`rounded-[10px] border p-3 ${t.card}`}>
      <div className={`text-[11px] font-semibold ${t.muted}`}>{label}</div>
      <div className="mt-1 text-[20px] font-black">{value}</div>
      {note && <div className={`text-[10px] ${t.muted}`}>{note}</div>}
    </div>
  );
  const grid = `grid gap-2 ${isApp ? "grid-cols-2" : "grid-cols-3"}`;
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 mt-5 text-[13px] font-black uppercase tracking-wide">{children}</h3>;
  const bar = isApp ? "bg-[#E5484D]" : "bg-violet-500";
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {RANGES.map((r) => (
          <button key={r.v} onClick={() => setRange(r.v)} className={`shrink-0 rounded-[10px] px-3 py-1.5 text-[12px] font-bold ${range === r.v ? t.chipOn : t.chipOff}`}>{r.label}</button>
        ))}
      </div>
      {isLoading ? <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin" /> : error || !a ? (
        <p className={`mt-6 text-center text-[13px] ${t.muted}`}>Couldn't load analytics.</p>
      ) : (
        <>
          <H>Content</H>
          <div className={grid}>
            {tile("Views", n(a.content.views))}
            {tile("Likes", n(a.content.likes))}
            {tile("Comments", n(a.content.comments))}
            {tile("Shares", n(a.content.shares), a.sharesTrackedSince ? undefined : "Counting from today")}
            {tile("Saves", n(a.content.saves))}
            {tile("Followers gained", n(a.content.followersGained))}
          </div>
          <H>Resources</H>
          {a.resources.count === 0 ? <p className={`text-[12px] ${t.muted}`}>No published resources yet.</p> : (
            <div className={grid}>
              {tile("Resource views", n(a.resources.views))}
              {tile("Downloads", n(a.resources.downloads))}
              {tile("Product views", n(a.resources.productViews))}
              {tile("Purchases", n(a.resources.purchases))}
              {tile("Conversion", a.resources.conversionRate == null ? "—" : `${a.resources.conversionRate}%`, a.resources.conversionRate == null ? "Needs 20+ product views" : "Purchases ÷ product views")}
            </div>
          )}
          <H>Profile</H>
          <div className={grid}>
            {tile("Profile views", n(a.profile.profileViews))}
            {tile("Total followers", n(a.profile.followersTotal))}
          </div>
          {a.profile.followerSeries.length > 0 && (() => {
            const max = Math.max(1, ...a.profile.followerSeries.map((d) => d.gained));
            return (
              <div className={`mt-2 rounded-[10px] border p-3 ${t.card}`}>
                <div className={`mb-2 text-[11px] font-semibold ${t.muted}`}>New followers per day</div>
                <div className="flex h-20 items-end gap-[2px]">
                  {a.profile.followerSeries.map((d) => (
                    <div key={d.date} title={`${d.date}: +${d.gained} (total ${d.total})`} className={`flex-1 rounded-sm ${d.gained ? bar : "bg-current opacity-10"}`} style={{ height: `${Math.max(4, (d.gained / max) * 100)}%` }} />
                  ))}
                </div>
              </div>
            );
          })()}
          <H>Performance</H>
          <div className={grid}>
            {tile("Top content", a.performance.topContent?.title ?? "—", a.performance.topContent ? `${n(a.performance.topContent.views)} views` : "No activity yet")}
            {tile("Top resource", a.performance.topResource?.title ?? "—", a.performance.topResource ? `${n(a.performance.topResource.downloads)} downloads` : "No activity yet")}
            {tile("Top category", a.performance.topCategory?.name ?? "—", a.performance.topCategory ? `${n(a.performance.topCategory.views)} views` : "Set categories on posts")}
            {tile("Top tool", a.performance.topTool?.name ?? "—", a.performance.topTool ? `${n(a.performance.topTool.views)} views` : "Add tools to posts")}
          </div>
          {a.posts.some((p) => p.views + p.likes + p.comments > 0) && (
            <>
              <H>Posts in this period</H>
              <div className={`divide-y rounded-[10px] border ${t.card} ${isApp ? "divide-white/10" : "divide-slate-100"}`}>
                {a.posts.map((p) => (
                  <div key={p.id} className="px-3 py-2">
                    <div className="truncate text-[13px] font-semibold">{p.title}</div>
                    <div className={`text-[11px] ${t.muted}`}>{n(p.views)} views · {n(p.likes)} likes · {n(p.comments)} comments · {n(p.shares)} shares · {n(p.saves)} saves</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className={`mt-3 text-[11px] ${t.muted}`}>Counts of real activity on your published posts. Your own likes, comments and saves aren't counted. Viewers stay anonymous.</p>
        </>
      )}
    </div>
  );
}

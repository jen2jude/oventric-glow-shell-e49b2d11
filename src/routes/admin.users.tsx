import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  ShieldPlus,
  ShieldMinus,
  Ban,
  X,
  Save,
  KeyRound,
  Flag,
  Trash2,
  AlertTriangle,
  Mail,
  User as UserIcon,
  Wallet as WalletIcon,
  ShoppingBag,
  Package,
  Target,
  MessageSquare,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  listAdminUsers,
  setUserRole,
  getUserDetail,
  updateUserProfileAdmin,
  sendUserPasswordReset,
  setUserFlag,
  setUserBan,
  deleteUserAdmin,
  deleteUsersBulkAdmin,
  adminResetWallet,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  validateSearch: (s: Record<string, unknown>) => ({
    user: typeof s.user === "string" ? s.user : undefined,
  }),
  head: () => ({
    meta: [{ title: "Users · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: UsersPage,
});

type Row = Record<string, unknown> & {
  roles?: string[];
  flagged?: boolean;
  banned_at?: string | null;
  kyc_completed_at?: string | null;
  verification_tier?: string;
};

type FilterTab = "all" | "admins" | "verified" | "unverified" | "flagged" | "banned";

function UsersPage() {
  const search = Route.useSearch();
  const listFn = useServerFn(listAdminUsers);
  const roleFn = useServerFn(setUserRole);
  const bulkDeleteFn = useServerFn(deleteUsersBulkAdmin);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const refresh = useCallback(() => {
    setLoadErr(null);
    listFn()
      .then((r) => {
        setRows(r as Row[]);
        setSelected(new Set());
      })
      .catch((e) => {
        console.error("[admin.users] list failed", e);
        setLoadErr(e instanceof Error ? e.message : "Failed to load users");
        setRows([]);
      });
  }, [listFn]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (search.user) setOpenUserId(search.user);
  }, [search.user]);

  const toggle = async (userId: string, role: "admin", grant: boolean) => {
    setBusy(userId);
    try {
      await roleFn({ data: { userId, role, grant } });
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(() => {
    const r = rows ?? [];
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      all: r.length,
      new24h: r.filter((x) => {
        const t = Date.parse(String(x.created_at ?? ""));
        return Number.isFinite(t) && t >= dayAgo;
      }).length,
      admins: r.filter((x) => (x.roles ?? []).includes("admin")).length,
      verified: r.filter((x) => x.kyc_completed_at).length,
      unverified: r.filter((x) => !x.kyc_completed_at).length,
      flagged: r.filter((x) => x.flagged).length,
      banned: r.filter((x) => x.banned_at).length,
    };
  }, [rows]);

  const filtered = (rows ?? []).filter((r) => {
    // tab filter
    if (tab === "admins" && !(r.roles ?? []).includes("admin")) return false;
    if (tab === "verified" && !r.kyc_completed_at) return false;
    if (tab === "unverified" && r.kyc_completed_at) return false;
    if (tab === "flagged" && !r.flagged) return false;
    if (tab === "banned" && !r.banned_at) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(r.username ?? "")
        .toLowerCase()
        .includes(s) ||
      String(r.display_name ?? "")
        .toLowerCase()
        .includes(s) ||
      String(r.country ?? "")
        .toLowerCase()
        .includes(s) ||
      String(r.user_id ?? "")
        .toLowerCase()
        .includes(s)
    );
  });

  useEffect(() => {
    setPage(1);
  }, [tab, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const allChecked =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r.user_id as string));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) pageRows.forEach((r) => next.delete(r.user_id as string));
    else pageRows.forEach((r) => next.add(r.user_id as string));
    setSelected(next);
  };
  const toggleOne = (uid: string) => {
    const next = new Set(selected);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setSelected(next);
  };

  const doBulkDelete = async () => {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Permanently delete ${selected.size} user${selected.size === 1 ? "" : "s"}? This cannot be undone.`,
      )
    )
      return;
    if (!window.confirm("Really delete? All their data will cascade-delete.")) return;
    setBulkBusy(true);
    try {
      const res = await bulkDeleteFn({ data: { userIds: Array.from(selected) } });
      alert(`Deleted ${res.deleted} of ${selected.size}.`);
      refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  };

  const tabs: Array<{ id: FilterTab; label: string; n: number }> = [
    { id: "all", label: "All", n: counts.all },
    { id: "admins", label: "Admins", n: counts.admins },
    { id: "verified", label: "KYC verified", n: counts.verified },
    { id: "unverified", label: "Unverified", n: counts.unverified },
    { id: "flagged", label: "Flagged", n: counts.flagged },
    { id: "banned", label: "Banned", n: counts.banned },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-black">Users</h1>
          <p className="text-sm text-slate-400">
            {rows?.length ?? 0} accounts
            {counts.new24h > 0 && (
              <span className="text-red-300 font-bold"> · {counts.new24h} new in 24h</span>
            )}{" "}
            · click a row to manage
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={doBulkDelete}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-xs font-bold text-red-200 disabled:opacity-50"
            >
              {bulkBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete {selected.size} selected
            </button>
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, country, id…"
            className="bg-[#141418] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white w-64"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold border transition-colors ${
              tab === t.id
                ? "bg-emerald-500 text-black border-emerald-500"
                : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-200"
            }`}
          >
            {t.label} <span className="opacity-70">({t.n})</span>
          </button>
        ))}
      </div>

      {loadErr && (
        <div className="mb-4 p-3 rounded-[10px] border border-red-500/40 bg-red-500/10 text-sm text-red-300">
          Could not load users: {loadErr}
        </div>
      )}
      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />
      ) : (
        <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left px-3 py-2 w-8">
                  <button onClick={toggleAll} className="text-slate-300 hover:text-white">
                    {allChecked ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">Country</th>
                <th className="text-left px-3 py-2">Tier</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Roles</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pageRows.map((u) => {
                const isAdmin = (u.roles ?? []).includes("admin");
                const uid = u.user_id as string;
                const flagged = Boolean(u.flagged);
                const banned = Boolean(u.banned_at);
                const checked = selected.has(uid);
                const createdAt = Date.parse(String(u.created_at ?? ""));
                const isNew =
                  Number.isFinite(createdAt) && Date.now() - createdAt < 24 * 60 * 60 * 1000;
                return (
                  <tr
                    key={uid}
                    onClick={() => setOpenUserId(uid)}
                    className={`hover:bg-white/[0.03] cursor-pointer ${checked ? "bg-emerald-500/[0.04]" : ""} ${isNew ? "bg-red-500/[0.06] shadow-[inset_3px_0_0_0_#ef4444]" : ""}`}
                  >
                    <td
                      className="px-3 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOne(uid);
                      }}
                    >
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-300" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-white font-semibold flex items-center gap-1.5">
                        {(u.display_name as string) ?? (u.username as string) ?? uid.slice(0, 8)}
                        {isNew && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/50 text-red-300 font-black uppercase tracking-wider animate-pulse">
                            New
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        @{(u.username as string) ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{(u.country as string) ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {String(u.verification_tier ?? "TIER_0").replace("TIER_", "L")}
                    </td>
                    <td className="px-3 py-2">
                      {banned ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-300 font-bold uppercase">
                          Banned
                        </span>
                      ) : flagged ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold uppercase">
                          Flagged
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Active</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {(u.roles ?? []).length === 0 ? (
                          <span className="text-xs text-slate-500">user</span>
                        ) : (
                          (u.roles ?? []).map((r) => (
                            <span
                              key={r}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold uppercase"
                            >
                              {r}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggle(uid, "admin", !isAdmin)}
                        disabled={busy === uid}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-[10px] text-xs font-bold ${isAdmin ? "bg-red-500/15 border border-red-500/40 text-red-200 hover:bg-red-500/25" : "bg-emerald-500 text-black hover:bg-emerald-400"}`}
                      >
                        {isAdmin ? (
                          <>
                            <ShieldMinus className="w-3 h-3" /> Revoke admin
                          </>
                        ) : (
                          <>
                            <ShieldPlus className="w-3 h-3" /> Make admin
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-xs text-slate-500">
                    <Ban className="w-4 h-4 mx-auto mb-1 opacity-50" /> No matching users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-white/10 bg-white/[0.02] text-xs text-slate-400">
              <div>
                Showing{" "}
                <span className="text-white font-semibold">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}
                </span>{" "}
                of <span className="text-white font-semibold">{filtered.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                >
                  ← Prev
                </button>
                <span className="text-slate-300 font-semibold">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {openUserId && (
        <UserDetailModal
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

/* -------- User Detail Modal -------- */

interface WalletTxn {
  id: string;
  tx_hash: string;
  type: string;
  amount: number;
  currency: string;
  inflow: boolean;
  status: string;
  occurred_at: string;
}
interface ProductRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  price_usd: number;
  created_at: string;
  cover_path?: string | null;
}
interface OrderRow {
  id: string;
  product_id: string;
  total_usd: number;
  status: string;
  created_at: string;
  paid_at?: string | null;
  seller_id: string;
}
interface BountyRow {
  id: string;
  title: string;
  price_usd: number;
  status: string;
  created_at: string;
  accepted_applicant_id?: string | null;
}
interface BountyAppRow {
  id: string;
  bounty_id: string;
  status: string;
  created_at: string;
  bounties?: BountyRow | null;
}
interface ContactRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  last_at: string;
}

interface DetailData {
  profile: Record<string, unknown>;
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  auth_created_at: string | null;
  roles: string[];
  wallets: Array<{
    currency: string;
    available_balance: number;
    escrow_balance: number;
    accumulated_cashback?: number;
    bounty_balance?: number;
  }>;
  counts: {
    posts: number;
    products: number;
    orders: number;
    followers: number;
    bountiesPosted: number;
    bountiesWon: number;
    bountyApplications: number;
    contactedSellers: number;
  };
  productsListed: ProductRow[];
  downloads: OrderRow[];
  bountiesPosted: BountyRow[];
  bountyApplications: BountyAppRow[];
  contactedSellers: ContactRow[];
  walletTransactions: WalletTxn[];
}

type DetailTab = "overview" | "wallet" | "downloads" | "listings" | "bounties" | "contacts";

function UserDetailModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detailFn = useServerFn(getUserDetail);
  const updateFn = useServerFn(updateUserProfileAdmin);
  const resetFn = useServerFn(sendUserPasswordReset);
  const flagFn = useServerFn(setUserFlag);
  const banFn = useServerFn(setUserBan);
  const deleteFn = useServerFn(deleteUserAdmin);

  const [d, setD] = useState<DetailData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [form, setForm] = useState<{
    display_name: string;
    username: string;
    country: string;
    bio: string;
    phone: string;
    verification_tier: string;
  }>({
    display_name: "",
    username: "",
    country: "",
    bio: "",
    phone: "",
    verification_tier: "TIER_0",
  });

  const load = useCallback(async () => {
    try {
      const res = await detailFn({ data: { userId } });
      setD(res as DetailData);
      const p = res.profile as Record<string, unknown>;
      setForm({
        display_name: (p.display_name as string) ?? "",
        username: (p.username as string) ?? "",
        country: (p.country as string) ?? "",
        bio: (p.bio as string) ?? "",
        phone: (p.phone as string) ?? "",
        verification_tier: (p.verification_tier as string) ?? "TIER_0",
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [detailFn, userId]);
  useEffect(() => {
    load();
  }, [load]);

  const doSave = async () => {
    setSaving("save");
    setErr(null);
    try {
      await updateFn({ data: { userId, ...form } });
      await load();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(null);
    }
  };
  const doReset = async () => {
    setSaving("reset");
    setErr(null);
    try {
      const r = await resetFn({ data: { userId } });
      alert(`Password reset email sent to ${r.email}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(null);
    }
  };
  const doFlag = async () => {
    const flagged = !d?.profile.flagged;
    let reason: string | undefined;
    if (flagged) {
      const r = window.prompt("Flag reason (visible to admins):");
      if (r === null) return;
      reason = r;
    }
    setSaving("flag");
    setErr(null);
    try {
      await flagFn({ data: { userId, flagged, reason } });
      await load();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(null);
    }
  };
  const doBan = async () => {
    const banned = !d?.profile.banned_at;
    if (banned && !window.confirm("Ban this user? They will be signed out and unable to sign in."))
      return;
    setSaving("ban");
    setErr(null);
    try {
      await banFn({ data: { userId, banned } });
      await load();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(null);
    }
  };
  const doDelete = async () => {
    if (!window.confirm("Permanently delete this user and all their data? This cannot be undone."))
      return;
    if (!window.confirm("Really delete?")) return;
    setSaving("delete");
    setErr(null);
    try {
      await deleteFn({ data: { userId } });
      onChanged();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setSaving(null);
    }
  };

  const detailTabs: Array<{ id: DetailTab; label: string; icon: typeof UserIcon; n?: number }> = d
    ? [
        { id: "overview", label: "Overview", icon: UserIcon },
        { id: "wallet", label: "Wallet", icon: WalletIcon, n: d.walletTransactions.length },
        { id: "downloads", label: "Downloads / Orders", icon: ShoppingBag, n: d.counts.orders },
        { id: "listings", label: "Listings", icon: Package, n: d.counts.products },
        {
          id: "bounties",
          label: "Bounties",
          icon: Target,
          n: d.counts.bountiesPosted + d.counts.bountyApplications,
        },
        { id: "contacts", label: "Contacted", icon: MessageSquare, n: d.counts.contactedSellers },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#141418] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-[#141418] border-b border-white/10 px-5 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-emerald-300" />
            <h2 className="text-white font-bold">User details</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </header>

        {!d ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {err && (
              <div className="p-3 rounded-[10px] border border-red-500/40 bg-red-500/10 text-sm text-red-300">
                {err}
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white text-lg font-black">
                  {form.display_name || form.username || userId.slice(0, 8)}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  @{form.username || "—"} · {userId}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {d.email ?? "no email"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
                {d.roles.map((r) => (
                  <span
                    key={r}
                    className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold uppercase text-[10px]"
                  >
                    {r}
                  </span>
                ))}
                {Boolean(d.profile.banned_at) && (
                  <span className="px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-300 font-bold uppercase text-[10px]">
                    Banned
                  </span>
                )}
                {Boolean(d.profile.flagged) && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold uppercase text-[10px]">
                    Flagged
                  </span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
              {detailTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold ${
                    tab === t.id
                      ? "bg-emerald-500 text-black"
                      : "bg-white/5 hover:bg-white/10 text-slate-200"
                  }`}
                >
                  <t.icon className="w-3 h-3" />
                  {t.label}
                  {typeof t.n === "number" && <span className="opacity-70">({t.n})</span>}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="space-y-4">
                {/* Counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      ["posts", d.counts.posts],
                      ["products", d.counts.products],
                      ["orders", d.counts.orders],
                      ["followers", d.counts.followers],
                      ["bounties posted", d.counts.bountiesPosted],
                      ["bounties won", d.counts.bountiesWon],
                      ["applications", d.counts.bountyApplications],
                      ["contacted", d.counts.contactedSellers],
                    ] as Array<[string, number]>
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      className="bg-white/5 border border-white/10 rounded-[10px] p-2 text-center"
                    >
                      <div className="text-[10px] uppercase text-slate-500 tracking-wider">{k}</div>
                      <div className="text-white font-bold text-lg">{v}</div>
                    </div>
                  ))}
                </div>

                {/* Auth timestamps */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div>
                    Signed up:{" "}
                    {d.auth_created_at ? new Date(d.auth_created_at).toLocaleString() : "—"}
                  </div>
                  <div>
                    Last sign-in:{" "}
                    {d.last_sign_in_at ? new Date(d.last_sign_in_at).toLocaleString() : "—"}
                  </div>
                  <div>
                    Email confirmed:{" "}
                    {d.email_confirmed_at
                      ? new Date(d.email_confirmed_at).toLocaleString()
                      : "not confirmed"}
                  </div>
                  <div>
                    KYC:{" "}
                    {d.profile.kyc_completed_at
                      ? new Date(d.profile.kyc_completed_at as string).toLocaleString()
                      : "—"}
                  </div>
                </div>

                {/* Edit form */}
                <div className="bg-white/[0.02] border border-white/10 rounded-[10px] p-4 space-y-3">
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider">
                    Edit profile
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Display name"
                      value={form.display_name}
                      onChange={(v) => setForm({ ...form, display_name: v })}
                    />
                    <Field
                      label="Username"
                      value={form.username}
                      onChange={(v) => setForm({ ...form, username: v })}
                    />
                    <Field
                      label="Country"
                      value={form.country}
                      onChange={(v) => setForm({ ...form, country: v })}
                    />
                    <Field
                      label="Phone"
                      value={form.phone}
                      onChange={(v) => setForm({ ...form, phone: v })}
                    />
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase text-slate-500 tracking-wider">
                        Bio
                      </label>
                      <textarea
                        value={form.bio}
                        onChange={(e) => setForm({ ...form, bio: e.target.value })}
                        rows={2}
                        className="w-full bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 tracking-wider">
                        Verification tier
                      </label>
                      <select
                        value={form.verification_tier}
                        onChange={(e) => setForm({ ...form, verification_tier: e.target.value })}
                        className="w-full bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white mt-1"
                      >
                        {["TIER_0", "TIER_1", "TIER_2", "TIER_3"].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={doSave}
                    disabled={saving === "save"}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50"
                  >
                    {saving === "save" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save changes
                  </button>
                </div>

                {/* Danger zone */}
                <div className="bg-red-500/[0.03] border border-red-500/20 rounded-[10px] p-4 space-y-2">
                  <div className="text-[10px] uppercase text-red-300 tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Moderation
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ModBtn
                      onClick={doReset}
                      busy={saving === "reset"}
                      icon={KeyRound}
                      label="Send password reset"
                    />
                    <ModBtn
                      onClick={doFlag}
                      busy={saving === "flag"}
                      icon={Flag}
                      label={d.profile.flagged ? "Remove flag" : "Flag user"}
                      tone={d.profile.flagged ? "neutral" : "amber"}
                    />
                    <ModBtn
                      onClick={doBan}
                      busy={saving === "ban"}
                      icon={Ban}
                      label={d.profile.banned_at ? "Unban" : "Ban user"}
                      tone={d.profile.banned_at ? "neutral" : "red"}
                    />
                    <ModBtn
                      onClick={doDelete}
                      busy={saving === "delete"}
                      icon={Trash2}
                      label="Delete permanently"
                      tone="red"
                    />
                  </div>
                  {Boolean(d.profile.flag_reason) && (
                    <div className="text-[11px] text-amber-200/80 mt-1">
                      Flag note: {d.profile.flag_reason as string}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "wallet" && <WalletTab d={d} userId={userId} onChanged={load} />}

            {tab === "downloads" &&
              (d.downloads.length === 0 ? (
                <Empty label="No purchases / downloads." />
              ) : (
                <ul className="divide-y divide-white/10 bg-white/[0.02] border border-white/10 rounded-[10px]">
                  {d.downloads.map((o) => (
                    <li key={o.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="text-slate-200 text-sm font-mono">
                          {o.product_id.slice(0, 8)}…
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(o.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold text-sm">
                          ${Number(o.total_usd).toFixed(2)}
                        </div>
                        <div
                          className={`text-[10px] uppercase font-bold ${o.status === "paid" ? "text-emerald-300" : "text-slate-400"}`}
                        >
                          {o.status}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ))}

            {tab === "listings" &&
              (d.productsListed.length === 0 ? (
                <Empty label="No products listed." />
              ) : (
                <ul className="divide-y divide-white/10 bg-white/[0.02] border border-white/10 rounded-[10px]">
                  {d.productsListed.map((p) => (
                    <li key={p.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="text-slate-200 text-sm font-semibold">{p.name}</div>
                        <div className="text-[11px] text-slate-500 uppercase">
                          {p.kind} · {p.status}
                        </div>
                      </div>
                      <div className="text-white font-bold text-sm">
                        ${Number(p.price_usd).toFixed(2)}
                      </div>
                    </li>
                  ))}
                </ul>
              ))}

            {tab === "bounties" && (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">
                    Bounties posted
                  </div>
                  {d.bountiesPosted.length === 0 ? (
                    <Empty label="None posted." />
                  ) : (
                    <ul className="divide-y divide-white/10 bg-white/[0.02] border border-white/10 rounded-[10px]">
                      {d.bountiesPosted.map((b) => (
                        <li key={b.id} className="p-3 flex items-center justify-between">
                          <div>
                            <div className="text-slate-200 text-sm font-semibold">{b.title}</div>
                            <div className="text-[11px] text-slate-500 uppercase">
                              {b.status} · {new Date(b.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-white font-bold text-sm">
                            ${Number(b.price_usd).toFixed(2)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">
                    Applications (in progress / solved)
                  </div>
                  {d.bountyApplications.length === 0 ? (
                    <Empty label="No applications." />
                  ) : (
                    <ul className="divide-y divide-white/10 bg-white/[0.02] border border-white/10 rounded-[10px]">
                      {d.bountyApplications.map((a) => {
                        const b = a.bounties;
                        const won = b && b.accepted_applicant_id === userId;
                        return (
                          <li key={a.id} className="p-3 flex items-center justify-between">
                            <div>
                              <div className="text-slate-200 text-sm font-semibold">
                                {b?.title ?? a.bounty_id.slice(0, 8)}
                              </div>
                              <div className="text-[11px] text-slate-500 uppercase">
                                app: {a.status}
                                {b ? ` · bounty: ${b.status}` : ""}
                                {won ? " · won" : ""}
                              </div>
                            </div>
                            {b && (
                              <div className="text-white font-bold text-sm">
                                ${Number(b.price_usd).toFixed(2)}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {tab === "contacts" &&
              (d.contactedSellers.length === 0 ? (
                <Empty label="Has not messaged anyone." />
              ) : (
                <ul className="divide-y divide-white/10 bg-white/[0.02] border border-white/10 rounded-[10px]">
                  {d.contactedSellers.map((c) => (
                    <li key={c.user_id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="text-slate-200 text-sm font-semibold">
                          {c.display_name || c.username || c.user_id.slice(0, 8)}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          @{c.username ?? "—"}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {c.last_at ? new Date(c.last_at).toLocaleDateString() : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase text-slate-500 tracking-wider">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white mt-1"
      />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-xs text-slate-500 py-6 text-center border border-white/10 rounded-[10px] bg-white/[0.02]">
      {label}
    </div>
  );
}

function ModBtn({
  onClick,
  busy,
  icon: Icon,
  label,
  tone = "neutral",
}: {
  onClick: () => void;
  busy: boolean;
  icon: typeof KeyRound;
  label: string;
  tone?: "neutral" | "amber" | "red";
}) {
  const cls =
    tone === "red"
      ? "bg-red-500/15 border-red-500/40 text-red-200 hover:bg-red-500/25"
      : tone === "amber"
        ? "bg-amber-500/15 border-amber-500/40 text-amber-200 hover:bg-amber-500/25"
        : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-xs font-bold disabled:opacity-50 ${cls}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

type ResetTarget = "available" | "escrow" | "cashback" | "bounty" | "all";

function WalletTab({
  d,
  userId,
  onChanged,
}: {
  d: DetailData;
  userId: string;
  onChanged: () => void | Promise<void>;
}) {
  const resetFn = useServerFn(adminResetWallet);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = async (currency: "USD" | "NGN" | "GHS", which: ResetTarget) => {
    const label = which === "all" ? "ALL balances" : which;
    if (!window.confirm(`Reset ${label} in ${currency} to 0? This cannot be undone.`)) return;
    const key = `${currency}:${which}`;
    setBusy(key);
    setErr(null);
    try {
      await resetFn({ data: { userId, currency, which } });
      await onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const currencies: Array<"USD" | "NGN" | "GHS"> = ["USD", "NGN", "GHS"];
  const rowFor = (c: "USD" | "NGN" | "GHS") =>
    d.wallets.find((w) => w.currency === c) ?? {
      currency: c,
      available_balance: 0,
      escrow_balance: 0,
      accumulated_cashback: 0,
      bounty_balance: 0,
    };

  return (
    <div className="space-y-3">
      {err && (
        <div className="p-2 rounded border border-red-500/40 bg-red-500/10 text-xs text-red-300">
          {err}
        </div>
      )}
      <CreditWalletCard userId={userId} onChanged={onChanged} />
      <div className="text-[10px] uppercase text-slate-500 tracking-wider">
        Wallet balances · admin can reset any component
      </div>
      <div className="grid grid-cols-1 gap-3">

        {currencies.map((c) => {
          const w = rowFor(c);
          const cells: Array<{ key: ResetTarget; label: string; value: number }> = [
            { key: "available", label: "Main", value: Number(w.available_balance) },
            { key: "escrow", label: "Escrow", value: Number(w.escrow_balance) },
            ...(c === "USD"
              ? [
                  {
                    key: "cashback" as ResetTarget,
                    label: "Cashback",
                    value: Number(w.accumulated_cashback ?? 0),
                  },
                  {
                    key: "bounty" as ResetTarget,
                    label: "Bounty",
                    value: Number(w.bounty_balance ?? 0),
                  },
                ]
              : []),
          ];
          return (
            <div key={c} className="bg-white/[0.02] border border-white/10 rounded-[10px] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white font-bold text-sm">{c}</div>
                <button
                  onClick={() => reset(c, "all")}
                  disabled={busy === `${c}:all`}
                  className="text-[10px] uppercase font-bold px-2 py-1 rounded border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {busy === `${c}:all` ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Reset all ({c})
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {cells.map((cell) => (
                  <div key={cell.key} className="bg-black/30 border border-white/10 rounded p-2">
                    <div className="text-[10px] uppercase text-slate-500 tracking-wider">
                      {cell.label}
                    </div>
                    <div className="text-white font-bold text-sm tabular-nums">
                      {cell.value.toFixed(2)}
                    </div>
                    <button
                      onClick={() => reset(c, cell.key)}
                      disabled={busy === `${c}:${cell.key}` || cell.value === 0}
                      className="mt-1 w-full text-[10px] uppercase font-bold px-1.5 py-1 rounded bg-white/5 border border-white/10 text-slate-200 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-200 disabled:opacity-40 inline-flex items-center justify-center gap-1"
                    >
                      {busy === `${c}:${cell.key}` ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Reset"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] uppercase text-slate-500 tracking-wider mt-3">
        Recent transactions
      </div>
      {d.walletTransactions.length === 0 ? (
        <Empty label="No transactions." />
      ) : (
        <div className="bg-white/[0.02] border border-white/10 rounded-[10px] overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-[10px] uppercase text-slate-400">
              <tr>
                <th className="text-left px-2 py-1.5">When</th>
                <th className="text-left px-2 py-1.5">Type</th>
                <th className="text-left px-2 py-1.5">Ref</th>
                <th className="text-right px-2 py-1.5">Amount</th>
                <th className="text-left px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {d.walletTransactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-2 py-1.5 text-slate-400">
                    {new Date(t.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-slate-200">{t.type}</td>
                  <td className="px-2 py-1.5 text-slate-500 font-mono">{t.tx_hash}</td>
                  <td
                    className={`px-2 py-1.5 text-right font-bold ${t.inflow ? "text-emerald-300" : "text-red-300"}`}
                  >
                    {t.inflow ? "+" : "−"}
                    {Number(t.amount).toFixed(2)} {t.currency}
                  </td>
                  <td className="px-2 py-1.5 text-slate-400">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

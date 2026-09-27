import { useEffect, useState } from "react";
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Comment = { id: string; user_id: string; body: string; created_at: string; name: string; avatar: string | null };

/** Like + comment controls for a Creators-tab showcase. `dark` for the app sheet, light for the web feed. */
export function ShowcaseEngagement({ postId, authorId, dark = false }: { postId: string; authorId?: string | null; dark?: boolean }) {
  const [me, setMe] = useState<string | null>(null);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadComments() {
    const { data } = await supabase
      .from("creator_post_comments")
      .select("id, user_id, body, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(200);
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const names = new Map<string, string>();
    const avatars = new Map<string, string | null>();
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", ids);
      for (const p of ps ?? []) {
        names.set(p.user_id, p.display_name || p.username || "Member");
        avatars.set(p.user_id, p.avatar_url ?? null);
      }
    }
    setComments(rows.map((r) => ({ ...r, name: names.get(r.user_id) ?? "Member", avatar: avatars.get(r.user_id) ?? null })));
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      const { count } = await supabase.from("creator_post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", postId);
      let mine = false;
      if (uid) {
        const { data } = await supabase.from("creator_post_likes").select("post_id").eq("post_id", postId).eq("user_id", uid).maybeSingle();
        mine = !!data;
      }
      if (!alive) return;
      setMe(uid); setLikes(count ?? 0); setLiked(mine);
    })();
    void loadComments();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function toggleLike() {
    if (!me) return toast("Sign in to like showcases");
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1));
    const res = next
      ? await supabase.from("creator_post_likes").insert({ post_id: postId, user_id: me })
      : await supabase.from("creator_post_likes").delete().eq("post_id", postId).eq("user_id", me);
    if (res.error) { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); }
  }

  async function send() {
    const body = text.trim();
    if (!me) return toast("Sign in to comment");
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from("creator_post_comments").insert({ post_id: postId, user_id: me, body });
    setBusy(false);
    if (error) return toast.error("Couldn't post your comment");
    setText("");
    void loadComments();
  }

  async function remove(id: string) {
    await supabase.from("creator_post_comments").delete().eq("id", id);
    setComments((c) => c.filter((x) => x.id !== id));
  }

  const muted = dark ? "text-white/50" : "text-slate-500";
  const strong = dark ? "text-white" : "text-slate-900";
  const border = dark ? "border-white/10" : "border-slate-200";

  return (
    <div className="mt-3">
      <div className={`flex items-center gap-4 text-[12px] font-bold ${muted}`}>
        <button type="button" onClick={toggleLike} className="flex items-center gap-1.5 active:scale-95">
          <Heart className={`h-4 w-4 ${liked ? "fill-[#E5484D] text-[#E5484D]" : ""}`} /> {likes}
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 active:scale-95">
          <MessageCircle className="h-4 w-4" /> {comments.length}
        </button>
      </div>
      {open && (
        <div className={`mt-3 rounded-2xl border ${border} p-3`}>
          {comments.length === 0 ? (
            <p className={`text-[12px] ${muted}`}>No comments yet — be the first.</p>
          ) : (
            <ul className="max-h-60 space-y-2 overflow-y-auto">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[12.5px]">
                  {c.avatar ? (
                    <img src={c.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${dark ? "bg-white/10 text-white/80" : "bg-slate-200 text-slate-700"}`}>
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 pt-0.5">
                    <b className={strong}>{c.name}</b> <span className={dark ? "text-white/75" : "text-slate-700"}>{c.body}</span>
                  </span>
                  {(c.user_id === me || (me && me === authorId)) && (
                    <button type="button" aria-label="Delete comment" onClick={() => remove(c.id)} className={muted}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={1000}
              placeholder={me ? "Add a comment…" : "Sign in to comment"}
              className={`min-w-0 flex-1 rounded-full border ${border} bg-transparent px-3 py-2 text-[12.5px] ${strong} outline-none`}
            />
            <button type="button" disabled={busy || !text.trim()} onClick={send} aria-label="Send" className="rounded-full bg-[#E5484D] p-2 disabled:opacity-40" style={{ color: "#ffffff" }}>
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { FileText, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteCreatorPost, listMyCreatorDrafts } from "@/lib/creators.functions";
import { contentTypeLabel } from "./CreatorResourceCard";

/** The signed-in creator's drafts: edit (then publish) or delete. */
export function CreatorDraftsSheet({
  open,
  isApp,
  onClose,
  onEdit,
}: {
  open: boolean;
  isApp: boolean;
  onClose: () => void;
  onEdit: (postId: string) => void;
}) {
  const fetchDrafts = useServerFn(listMyCreatorDrafts);
  const remove = useServerFn(deleteCreatorPost);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: drafts, isLoading, refetch } = useQuery({
    queryKey: ["creator-drafts"],
    queryFn: () => fetchDrafts(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const del = async (id: string) => {
    if (!window.confirm("Delete this draft?")) return;
    setBusyId(id);
    try {
      await remove({ data: { postId: id } });
      toast.success("Draft deleted");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    } finally {
      setBusyId(null);
    }
  };

  const panel = isApp ? "border-white/10 bg-[#0E0E10] text-white" : "border-slate-200 bg-white text-slate-900";
  const muted = isApp ? "text-white/45" : "text-slate-500";
  const row = isApp ? "border-white/10" : "border-slate-100";

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className={`flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[18px] border sm:rounded-[18px] ${panel}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Your drafts"
      >
        <div className={`flex items-center justify-between border-b px-4 py-3 ${row}`}>
          <p className="text-[15px] font-bold">Your drafts</p>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(12px,env(safe-area-inset-bottom))]">
          {isLoading ? (
            <p className={`p-6 text-center text-[13px] ${muted}`}>Loading drafts…</p>
          ) : !drafts?.length ? (
            <div className="p-8 text-center">
              <FileText className={`mx-auto h-7 w-7 ${muted}`} />
              <p className="mt-2 text-[13px] font-bold">No drafts yet</p>
              <p className={`mt-1 text-[12px] ${muted}`}>Use "Save draft" in the composer to finish a post later.</p>
            </div>
          ) : (
            drafts.map((d) => (
              <div key={d.id} className={`flex items-center gap-3 border-b px-4 py-3 ${row}`}>
                <span className={`h-12 w-12 shrink-0 overflow-hidden rounded-[8px] ${isApp ? "bg-white/5" : "bg-slate-100"}`}>
                  {d.mediaUrls[0] && d.mediaType === "image" ? <img src={d.mediaUrls[0]} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold">{d.title}</p>
                  <p className={`text-[11px] ${muted}`}>
                    {contentTypeLabel(d.contentType)} · edited {new Date(d.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => onEdit(d.id)}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11.5px] font-bold"
                  style={{ background: "#E5484D", color: "#ffffff" }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => void del(d.id)}
                  disabled={busyId === d.id}
                  aria-label="Delete draft"
                  className={`grid h-8 w-8 place-items-center rounded-full border disabled:opacity-50 ${row}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

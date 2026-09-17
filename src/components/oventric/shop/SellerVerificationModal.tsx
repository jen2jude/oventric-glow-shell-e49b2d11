import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2, X } from "lucide-react";
import {
  getMySellerVerification,
  requestSellerVerification,
  type MySellerVerification,
} from "@/lib/seller-verification.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultBrandName?: string;
  defaultCountry?: string | null;
}

/** Small seller-verification request form, opened from the seller's storefront. */
export function SellerVerificationModal({ open, onClose, defaultBrandName, defaultCountry }: Props) {
  const loadStatus = useServerFn(getMySellerVerification);
  const submit = useServerFn(requestSellerVerification);

  const [status, setStatus] = useState<MySellerVerification | null>(null);
  const [legalName, setLegalName] = useState("");
  const [brandName, setBrandName] = useState(defaultBrandName ?? "");
  const [contactEmail, setContactEmail] = useState("");
  const [country, setCountry] = useState(defaultCountry ?? "");
  const [website, setWebsite] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    void loadStatus().then(setStatus).catch(() => setStatus(null));
  }, [open, loadStatus]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pending = status?.status === "pending";
  const approved = status?.status === "approved";
  const blocked = status ? !status.eligible : false;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await submit({
        data: { legalName, brandName, contactEmail, country, website, note },
      });
      setMessage(res.message);
      if (res.ok) void loadStatus().then(setStatus).catch(() => undefined);
    } catch {
      setMessage("Could not submit your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-[#E5484D]">Seller verification</div>
            <h2 className="mt-1 text-lg font-black text-slate-900">Request a verified shop badge</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {approved ? (
            <div className="flex items-start gap-3 rounded-xl bg-[#F7F8FA] p-4 text-sm text-slate-700">
              <BadgeCheck className="mt-0.5 h-5 w-5 text-[#E5484D]" />
              <span>Your shop is verified. The badge shows on your storefront and seller listings.</span>
            </div>
          ) : pending ? (
            <div className="rounded-xl bg-[#F7F8FA] p-4 text-sm text-slate-700">
              Your verification request is under review. We&apos;ll let you know once it has been checked.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {blocked && status?.reason && (
                <div className="rounded-xl bg-[#FEF2F2] p-3 text-sm font-semibold text-[#B42318]">{status.reason}</div>
              )}
              <Field label="Full legal name" value={legalName} onChange={setLegalName} required />
              <Field label="Shop / brand name" value={brandName} onChange={setBrandName} />
              <Field label="Contact email" value={contactEmail} onChange={setContactEmail} type="email" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country" value={country} onChange={setCountry} />
                <Field label="Website or social link" value={website} onChange={setWebsite} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Anything we should know?
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#E5484D]"
                />
              </div>
              {message && <div className="text-sm font-semibold text-slate-700">{message}</div>}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 rounded-xl border border-[#E5E7EB] px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || blocked}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#E5484D] px-5 text-sm font-black text-white disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#E5484D]"
      />
    </div>
  );
}

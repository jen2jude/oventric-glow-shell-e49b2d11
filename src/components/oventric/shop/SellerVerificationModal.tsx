import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getMySellerVerification,
  requestSellerVerification,
  PROOF_DOC_KINDS,
  PROOF_DOC_LABELS,
  type MySellerVerification,
} from "@/lib/seller-verification.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultBrandName?: string;
  defaultCountry?: string | null;
}

const ACCEPT = "application/pdf,image/jpeg,image/jpg,image/png";

/** Seller-verification request form, opened from the seller's own storefront. */
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
  const [businessType, setBusinessType] = useState<"registered" | "unregistered">("unregistered");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [proofDocKind, setProofDocKind] = useState<string>("utility_bill");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
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

  const pending = status?.status === "pending" || status?.status === "under_review";
  const approved = status?.status === "approved";
  const blocked = status ? !status.eligible : false;

  const uploadOne = async (userId: string, file: File, label: string) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${userId}/${label}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("seller-verification")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) throw new Error(error.message);
    return path;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofFile || !passportFile) {
      setMessage("Please upload both your proof of address and passport photo.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error("Please sign in again.");

      const proofDocPath = await uploadOne(userId, proofFile, "proof-of-address");
      const passportPhotoPath = await uploadOne(userId, passportFile, "passport-photo");

      const res = await submit({
        data: {
          legalName,
          brandName,
          contactEmail,
          country,
          website,
          note,
          businessType,
          registrationNumber,
          businessAddress,
          proofDocKind,
          proofDocPath,
          passportPhotoPath,
        },
      });
      setMessage(res.message);
      if (res.ok) void loadStatus().then(setStatus).catch(() => undefined);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not submit your request. Please try again.");
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
              {status?.status === "rejected" && status.reviewNote && (
                <div className="rounded-xl bg-[#FEF2F2] p-3 text-sm text-[#B42318]">
                  <span className="font-bold">Previous request declined:</span> {status.reviewNote}
                </div>
              )}

              <Field label="Full legal name" value={legalName} onChange={setLegalName} required />
              <Field label="Shop / brand name" value={brandName} onChange={setBrandName} />
              <Field label="Contact email" value={contactEmail} onChange={setContactEmail} type="email" required />

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Business registration type
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["registered", "unregistered"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBusinessType(t)}
                      className={`h-11 rounded-xl border text-sm font-bold capitalize ${
                        businessType === t
                          ? "border-[#E5484D] bg-[#FEF2F2] text-[#E5484D]"
                          : "border-[#E5E7EB] bg-white text-slate-600"
                      }`}
                    >
                      {t === "registered" ? "Registered business" : "Unregistered"}
                    </button>
                  ))}
                </div>
              </div>

              {businessType === "registered" && (
                <Field
                  label="Business registration number"
                  value={registrationNumber}
                  onChange={setRegistrationNumber}
                  required
                />
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Business address</label>
                <textarea
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  rows={2}
                  required
                  maxLength={400}
                  className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#E5484D]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country" value={country} onChange={setCountry} />
                <Field label="Website or social link" value={website} onChange={setWebsite} />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Proof of address document type
                </label>
                <select
                  value={proofDocKind}
                  onChange={(e) => setProofDocKind(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#E5484D]"
                >
                  {PROOF_DOC_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {PROOF_DOC_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <FileField
                label="Proof of address (PDF or JPG)"
                file={proofFile}
                onPick={setProofFile}
                accept={ACCEPT}
              />
              <FileField
                label="Passport photo of seller (JPG or PNG)"
                file={passportFile}
                onPick={setPassportFile}
                accept="image/jpeg,image/jpg,image/png"
              />

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

function FileField({
  label,
  file,
  onPick,
  accept,
}: {
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
  accept: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
      <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F7F8FA] px-3 py-3 text-sm text-slate-600 hover:border-[#E5484D]">
        <Upload className="h-4 w-4 text-[#E5484D]" />
        <span className="truncate">{file ? file.name : "Choose a file (max 15MB)"}</span>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>
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

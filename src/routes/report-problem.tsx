import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoLayout } from "@/components/oventric/PublicInfoLayout";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitReport } from "@/lib/reports.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { toast } from "sonner";
import { Bug, AlertTriangle, Ban, ShieldAlert, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import helpImage from "@/assets/public-pages/help-editorial.jpg";

export const Route = createFileRoute("/report-problem")({
  head: () => ({
    meta: [
      { title: "Report a problem — Oventric" },
      {
        name: "description",
        content: "Report bugs, abuse, or platform issues to the Oventric team.",
      },
      { property: "og:title", content: "Report a problem — Oventric" },
      { property: "og:description", content: "Tell us what went wrong so we can fix it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

const issues = [
  { key: "spam" as const, icon: AlertTriangle, title: "Spam or misleading content" },
  { key: "harassment" as const, icon: ShieldAlert, title: "Harassment, hate, or unsafe behavior" },
  { key: "ip" as const, icon: Ban, title: "Copyright / IP infringement" },
  { key: "scam" as const, icon: Bug, title: "Fraud, scam, or payment issue" },
];

function ReportPage() {
  const submit = useServerFn(submitReport);
  const { isAuthenticated, openGate } = useAuthGate();
  const [reason, setReason] = useState<"spam" | "harassment" | "ip" | "scam">("scam");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const onSubmit = async () => {
    if (!isAuthenticated) {
      openGate("generic");
      return;
    }
    if (note.trim().length < 8) {
      toast.error("Please describe the issue in a bit more detail.");
      return;
    }
    setSending(true);
    try {
      await submit({ data: { targetId: "platform-report", targetKind: "platform", reason, note } });
      toast.success("Report received — thank you.");
      setNote("");
    } catch (e) {
      console.error(e);
      toast.error("Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicInfoLayout eyebrow="Support" title="Tell us what went wrong." description="Report a technical issue, unsafe behavior, infringement or payment concern for review." icon={Bug} image={helpImage} imageAlt="Support headset beside a guide and safety shield">
        <div className="grid gap-3 sm:grid-cols-2">
          {issues.map((it) => {
            const active = reason === it.key;
            return (
              <Button
                type="button"
                variant="outline"
                key={it.key}
                onClick={() => setReason(it.key)}
                className={`h-auto min-h-20 justify-start whitespace-normal p-4 text-left ${
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card text-foreground"
                }`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-md ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <it.icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  {it.title}
                </span>
              </Button>
            );
          })}
        </div>

        <label htmlFor="report-note" className="mt-8 block text-sm font-bold text-foreground">
          What happened?
        </label>
        <textarea
          id="report-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 280))}
          placeholder="Please describe the issue — what you were doing, what you expected, what happened instead."
          rows={5}
          className="mt-2 w-full rounded-md border border-input bg-background p-4 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
        <div className="mt-1 text-right text-xs text-muted-foreground">{note.length} / 280</div>

        <Button
          onClick={onSubmit}
          disabled={sending}
          className="mt-5 h-11 w-full sm:w-auto"
        >
          <Send />{sending ? "Sending..." : "Send report"}
        </Button>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">You will need to sign in before submitting so we can securely follow up with you.</p>
    </PublicInfoLayout>
  );
}

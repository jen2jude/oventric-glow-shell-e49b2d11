import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, ShoppingBag } from "lucide-react";

/** Matches a product permalink inside a chat message body. */
export const PRODUCT_LINK_RE = /https?:\/\/[^\s]*\/product\/([0-9a-fA-F-]{36})/;

/** Extract the product id clipped into a message body, if any. */
export function extractProductId(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = PRODUCT_LINK_RE.exec(body);
  return m ? m[1] : null;
}

/** Message body with the product permalink stripped out. */
export function stripProductLink(body: string | null | undefined): string {
  return body ? body.replace(PRODUCT_LINK_RE, "").trim() : "";
}

/**
 * Inline product card rendered inside a chat bubble when the body carries a
 * product link. Persisted in the message body, so it survives reloads.
 */
export function ProductBubbleCard({
  productId,
  mine,
  onNavigate,
}: {
  productId: string;
  mine: boolean;
  /** Called right before navigating (used to close chat overlays). */
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();

  const go = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onNavigate?.();
    void navigate({ to: "/product/$id", params: { id: productId } });
  };

  return (
    <div
      className={`mt-2 rounded-[10px] overflow-hidden border ${
        mine
          ? "border-white/30 bg-white/10"
          : "border-border bg-background"
      }`}
    >
      <button
        type="button"
        onClick={go}
        className="w-full flex items-center gap-2 px-2.5 py-3 hover:opacity-90 text-left"
      >
        <ShoppingBag className={`w-4 h-4 shrink-0 ${mine ? "text-white" : "text-primary"}`} />
        <span
          className={`text-[11px] font-semibold truncate ${
            mine ? "text-white" : "text-foreground"
          }`}
        >
          Product attached — tap to open
        </span>
      </button>
      <button
        type="button"
        onClick={go}
        className="w-full flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold py-2"
      >
        <ExternalLink className="w-3.5 h-3.5" /> View product
      </button>
    </div>
  );
}

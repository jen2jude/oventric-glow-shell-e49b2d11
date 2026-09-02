import type { WalletTxDTO } from "@/lib/wallet.functions";
import { formatMoney } from "@/lib/fx-display";

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function downloadWalletCsv(items: WalletTxDTO[], filename = "wallet-activity.csv") {
  const header = ["Tx ID", "Type", "Amount", "Currency", "Direction", "Status", "Occurred At"];
  const rows = items.map((t) => [
    t.txHash,
    t.type,
    String(t.amount),
    t.currency,
    t.inflow ? "IN" : "OUT",
    t.status,
    t.occurredAt,
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => csvEscape(String(c))).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printWalletPdf(items: WalletTxDTO[], homeCurrency: string) {
  const win = window.open("", "_blank", "width=800,height=1000");
  if (!win) return;
  const rows = items
    .map(
      (t) => `<tr>
        <td>${t.txHash}</td>
        <td>${t.type}</td>
        <td style="text-align:right">${t.inflow ? "+" : "-"}${formatMoney(t.amount, t.currency)}</td>
        <td>${t.status}</td>
        <td>${new Date(t.occurredAt).toLocaleString()}</td>
      </tr>`,
    )
    .join("");
  win.document.write(`
    <html>
      <head>
        <title>Wallet Activity — ${homeCurrency}</title>
        <style>
          body { font-family: -apple-system, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p { color: #555; font-size: 12px; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; }
          th { text-transform: uppercase; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <h1>Wallet Activity</h1>
        <p>Generated ${new Date().toLocaleString()} · ${items.length} entries</p>
        <table>
          <thead><tr><th>Tx ID</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  win.document.close();
}

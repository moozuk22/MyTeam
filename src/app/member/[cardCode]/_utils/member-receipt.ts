import { type MemberProfile } from "../_types/member-types";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function buildMemberReceiptHtml(
  selectedReceipt: { paidFor: string; paidAt: string },
  member: Pick<MemberProfile, "name" | "clubName">,
  formatReceiptPeriod: (value: string) => string,
) {
  const period = formatReceiptPeriod(selectedReceipt.paidFor);
  const paidAt = new Date(selectedReceipt.paidAt).toLocaleDateString("bg-BG");
  const clubName = member.clubName?.trim() || "Клуб";
  const safeMemberName = escapeHtml(member.name);
  const safeClubName = escapeHtml(clubName);
  const safePeriod = escapeHtml(period);
  const safePaidAt = escapeHtml(paidAt);

  const receiptHtml = `<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Разписка - ${safePeriod}</title>
  <style>
    body { margin: 0; background: #fff; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .pt { display: flex; gap: 8px; margin: 16px 20px; }
    .pt button { padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
    .pt-p { background: #111827; color: #fff; border: none; }
    .pt-c { background: #f3f4f6; border: 1px solid #d1d5db; }
    .wrap { max-width: 420px; margin: 0 auto; padding: 20px; }
    .card { border-radius: 12px; border: 1px solid #e5e7eb; padding: 20px; }
    .head { text-align: center; margin-bottom: 10px; }
    .title { margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; }
    .sub { margin: 4px 0 0; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: .14em; }
    .sep { border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0; }
    .row { display: flex; justify-content: space-between; gap: 12px; margin: 10px 0; font-size: 14px; }
    .lbl { color: #6b7280; }
    .val { font-weight: 700; color: #111827; text-align: right; }
    .stamp-wrap { display: flex; justify-content: center; margin: 20px 0 8px; }
    .stamp { width: 96px; height: 96px; border-radius: 999px; border: 3px dashed rgba(50,205,50,.6); color: #26a826; font-size: 13px; font-weight: 900; letter-spacing: .05em; display: flex; align-items: center; justify-content: center; transform: rotate(-12deg); }
    @media print { .pt { display: none; } }
    @page { margin: 12mm; }
  </style>
</head>
<body>
  <div class="pt">
    <button class="pt-c" onclick="window.close()">✕ Затвори</button>
    <button class="pt-p" onclick="window.print()">🖨 Принтирай</button>
  </div>
  <div class="wrap">
    <div class="card">
      <div class="head">
        <h1 class="title">${safeClubName}</h1>
        <p class="sub">Разписка за членски внос</p>
      </div>
      <hr class="sep" />
      <div class="row"><span class="lbl">Състезател:</span><span class="val">${safeMemberName}</span></div>
      <div class="row"><span class="lbl">Период:</span><span class="val">${safePeriod}</span></div>
      <div class="row"><span class="lbl">Дата на плащане:</span><span class="val">${safePaidAt}</span></div>
      <hr class="sep" />
      <div class="stamp-wrap"><div class="stamp">ПЛАТЕНО</div></div>
    </div>
  </div>
</body>
</html>`;

  return receiptHtml;
}

export function printMemberReceipt(
  selectedReceipt: { paidFor: string; paidAt: string },
  member: Pick<MemberProfile, "name" | "clubName">,
  formatReceiptPeriod: (value: string) => string,
) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const receiptHtml = buildMemberReceiptHtml(
    selectedReceipt,
    member,
    formatReceiptPeriod,
  );
  const blob = new Blob([receiptHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

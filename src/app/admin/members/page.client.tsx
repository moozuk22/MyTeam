"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractUploadPathFromCloudinaryUrl } from "@/lib/cloudinaryImagePath";
import { uploadImage } from "@/lib/uploadImage";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import "./page.css";

// Reports-related imports
const MONTHS = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];

type ReportKind = "monthly" | "yearly";

interface ReportPaymentLog {
  id: string;
  paidFor: string;
  paidAt: string;
}

interface ReportPlayer {
  id: string;
  fullName: string;
  teamGroup: number | null;
  paymentLogs: ReportPaymentLog[];
}

type PlayerStatus = "paid" | "warning" | "overdue";

interface PaymentLog {
  id: string;
  paidFor: string;
  paidAt: string;
}

interface MemberCard {
  cardCode: string;
  isActive: boolean;
}

interface MemberClub {
  id: string;
  name: string;
}

interface ClubOption {
  id: string;
  name: string;
  emblemUrl?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
}

interface Member {
  id: string;
  fullName: string;
  nfcTagId: string;
  status: PlayerStatus;
  teamGroup: number | null;
  jerseyNumber: string | null;
  avatarUrl: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  birthDate: string | null;
  lastPaymentDate: string | null;
  club?: MemberClub;
  paymentLogs: PaymentLog[];
  cards: MemberCard[];
  isActive: boolean;
}

function normalizeMember(item: unknown): Member {
  const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
  const fullName = String(raw.fullName ?? "").trim();
  const cards: MemberCard[] = Array.isArray(raw.cards)
    ? raw.cards.map((card) => {
      const cardRaw = typeof card === "object" && card !== null ? (card as Record<string, unknown>) : {};
      return {
        cardCode: String(cardRaw.cardCode ?? ""),
        isActive: Boolean(cardRaw.isActive),
      };
    })
    : [];
  const activeCard = cards.find((c) => c.isActive);
  const nfcTagId = activeCard?.cardCode ?? cards[0]?.cardCode ?? "";
  const paymentLogs: PaymentLog[] = Array.isArray(raw.paymentLogs)
    ? raw.paymentLogs.map((log) => {
      const logRaw = typeof log === "object" && log !== null ? (log as Record<string, unknown>) : {};
      return {
        id: String(logRaw.id ?? ""),
        paidFor: String(logRaw.paidFor ?? ""),
        paidAt: String(logRaw.paidAt ?? ""),
      };
    })
    : [];
  const rawStatus = raw.status;
  const status: PlayerStatus =
    rawStatus === "paid" || rawStatus === "warning" || rawStatus === "overdue"
      ? rawStatus
      : "paid";

  const imageUrl = raw.imageUrl ? String(raw.imageUrl) : null;
  const avatarUrl = raw.avatarUrl ? String(raw.avatarUrl) : imageUrl;
  const clubRaw = typeof raw.club === "object" && raw.club !== null ? (raw.club as Record<string, unknown>) : null;

  return {
    id: String(raw.id ?? ""),
    fullName,
    nfcTagId,
    status,
    teamGroup: typeof raw.teamGroup === "number" ? raw.teamGroup : null,
    jerseyNumber: raw.jerseyNumber ? String(raw.jerseyNumber) : null,
    avatarUrl,
    imageUrl,
    imagePublicId: raw.imagePublicId ? String(raw.imagePublicId) : null,
    birthDate: raw.birthDate ? String(raw.birthDate) : null,
    lastPaymentDate: raw.lastPaymentDate ? String(raw.lastPaymentDate) : null,
    club: clubRaw
      ? {
        id: String(clubRaw.id ?? ""),
        name: String(clubRaw.name ?? ""),
      }
      : undefined,
    paymentLogs,
    cards,
    isActive: Boolean(raw.isActive ?? true),
  };
}

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
  border: string;
  cls: string;
}

/* ── Icons ── */
const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
  </svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />
  </svg>
);
const CircleCheckBigIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" />
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="M12 5v14" />
  </svg>
);

/* ── Status helpers ── */
const getStatusMeta = (status: PlayerStatus): StatusMeta => {
  if (status === "paid") return {
    label: "Платено",
    color: "#32cd32",
    bg: "rgba(50,205,50,0.2)",
    border: "rgba(50,205,50,0.3)",
    cls: "badge--paid",
  };
  if (status === "warning") return {
    label: "Напомняне",
    color: "#ffd700",
    bg: "rgba(255,215,0,0.2)",
    border: "rgba(255,215,0,0.3)",
    cls: "badge--reminder",
  };
  return {
    label: "Просрочено",
    color: "#ff4d4d",
    bg: "rgba(255,77,77,0.2)",
    border: "rgba(255,77,77,0.3)",
    cls: "badge--overdue",
  };
};

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "rgba(255,255,255,0.4)" }}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "rgba(255,255,255,0.4)" }}>
    <path d="M8 2v4" /><path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </svg>
);
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const ReceiptIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <path d="M12 17.5v-11" />
  </svg>
);

// Reports-related icons
const ChartColumnIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <path d="M16 3.128a4 4 0 0 1 0 7.744" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 7h6v6" />
    <path d="m22 7-8.5 8.5-5-5L2 17" />
  </svg>
);

const CircleAlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

const PrinterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </svg>
);

// Reports Dialog Component
function ReportsDialog({ onClose, clubId }: { onClose: () => void; clubId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(MONTHS[now.getMonth()] ?? MONTHS[0]);
  const [year, setYear] = useState(String(Math.max(2026, now.getFullYear())));
  const [group, setGroup] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [players, setPlayers] = useState<ReportPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const endpoint = clubId ? `/api/admin/members?clubId=${encodeURIComponent(clubId)}` : "/api/admin/members";
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) {
          setPlayers([]);
          return;
        }
        const data = (await response.json()) as ReportPlayer[];
        setPlayers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching report players:", error);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchPlayers();
  }, [clubId]);

  const years = Array.from(
    { length: Math.max(1, now.getFullYear() - 2026 + 2) },
    (_, idx) => String(2026 + idx),
  );

  const groups = [...new Set(
    players
      .map((player) => player.teamGroup)
      .filter((value): value is number => value !== null),
  )].sort((a, b) => b - a);

  const selectedMonthIdx = MONTHS.indexOf(month);
  const selectedYear = Number(year);

  const getPaymentDateForMonth = (player: ReportPlayer): string | null => {
    let latestPaidAt: Date | null = null;

    for (const log of player.paymentLogs ?? []) {
      const paidForDate = new Date(log.paidFor);
      const paidAtDate = new Date(log.paidAt);
      if (Number.isNaN(paidForDate.getTime()) || Number.isNaN(paidAtDate.getTime())) {
        continue;
      }
      if (paidForDate.getMonth() !== selectedMonthIdx || paidForDate.getFullYear() !== selectedYear) {
        continue;
      }
      if (!latestPaidAt || paidAtDate > latestPaidAt) {
        latestPaidAt = paidAtDate;
      }
    }

    return latestPaidAt ? latestPaidAt.toLocaleDateString("bg-BG") : null;
  };

  const getPaymentDateForYear = (player: ReportPlayer): string | null => {
    let latestPaidAt: Date | null = null;

    for (const log of player.paymentLogs ?? []) {
      const paidForDate = new Date(log.paidFor);
      const paidAtDate = new Date(log.paidAt);
      if (Number.isNaN(paidForDate.getTime()) || Number.isNaN(paidAtDate.getTime())) {
        continue;
      }
      if (paidForDate.getFullYear() !== selectedYear) {
        continue;
      }
      if (!latestPaidAt || paidAtDate > latestPaidAt) {
        latestPaidAt = paidAtDate;
      }
    }

    return latestPaidAt ? latestPaidAt.toLocaleDateString("bg-BG") : null;
  };

  const groupFiltered = players.filter((player) => {
    if (group === "all") {
      return true;
    }
    return String(player.teamGroup ?? "") === group;
  });

  const rows = groupFiltered.map((player) => {
    const paidDate = getPaymentDateForMonth(player);
    return {
      id: player.id,
      name: player.fullName,
      group: player.teamGroup,
      date: paidDate ?? "—",
      paid: Boolean(paidDate),
    };
  });

  const rowsYearly = groupFiltered.map((player) => {
    const paidDate = getPaymentDateForYear(player);
    return {
      id: player.id,
      name: player.fullName,
      group: player.teamGroup,
      date: paidDate ?? "—",
      paid: Boolean(paidDate),
    };
  });

  const paidCount = rows.filter((row) => row.paid).length;
  const total = rows.length;
  const pct = total > 0 ? Math.round((paidCount / total) * 100) : 0;
  const missing = total - paidCount;

  const filtered = rows.filter((row) => {
    if (statusFilter === "paid") return row.paid;
    if (statusFilter === "unpaid") return !row.paid;
    return true;
  });

  const filteredYearly = rowsYearly.filter((row) => {
    if (statusFilter === "paid") return row.paid;
    if (statusFilter === "unpaid") return !row.paid;
    return true;
  });

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const printReport = (kind: ReportKind) => {
    const baseRows = kind === "monthly" ? rows : rowsYearly;
    const rowsToPrint = kind === "monthly" ? filtered : filteredYearly;
    const paid = baseRows.filter((row) => row.paid).length;
    const totalRows = baseRows.length;
    const percent = totalRows > 0 ? Math.round((paid / totalRows) * 100) : 0;
    const unpaid = totalRows - paid;
    const periodTitle = kind === "monthly" ? `${month} ${year}` : `Year ${year}`;

    if (typeof window === "undefined" || typeof document === "undefined") return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      document.body.removeChild(iframe);
      return;
    }

    const tableRowsHtml = rowsToPrint.length > 0
      ? rowsToPrint
        .map((row, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${escapeHtml(row.name)}</td>
              <td>${row.group ?? "—"}</td>
              <td>${escapeHtml(row.date)}</td>
              <td>${row.paid ? "Paid" : "Unpaid"}</td>
            </tr>
          `)
        .join("")
      : `<tr><td colspan="5" style="text-align:center;color:#6b7280;">No data for selected filters.</td></tr>`;

    doc.open();
    doc.write(`<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${kind === "monthly" ? "Monthly report" : "Yearly report"}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
    .page { padding: 24px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .sub { margin: 0 0 14px; color: #6b7280; font-size: 13px; }
    .stats { display: flex; gap: 12px; margin: 0 0 16px; flex-wrap: wrap; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; min-width: 140px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e5e7eb; padding: 7px 8px; text-align: left; }
    th { background: #f9fafb; }
    @page { margin: 10mm; }
  </style>
</head>
<body>
  <div class="page">
    <h1>${kind === "monthly" ? "Monthly report" : "Yearly report"}</h1>
    <p class="sub">Period: ${escapeHtml(periodTitle)}</p>
    <div class="stats">
      <div class="stat">Paid: <strong>${paid}</strong> / ${totalRows}</div>
      <div class="stat">Collection rate: <strong>${percent}%</strong></div>
      <div class="stat">Unpaid: <strong>${unpaid}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Group</th>
          <th>Payment date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${tableRowsHtml}</tbody>
    </table>
  </div>
</body>
</html>`);
    doc.close();

    window.setTimeout(() => {
      win.focus();
      win.print();
      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 80);
  };

  return (
    <div className="rd-overlay" onClick={onClose}>
      <div className="rd-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="rd-close" onClick={onClose} aria-label="Затвори">
          <XIcon />
        </button>

        <div className="rd-header">
          <h2 className="rd-title">
            <ChartColumnIcon size={20} />
            Център за отчети
          </h2>
        </div>

        <div className="rd-filters">
          <div className="rd-filters-left">
            <div className="rd-field">
              <label className="rd-label">Месец</label>
              <div className="rd-select-wrap">
                <select className="rd-select rd-select--w140" value={month} onChange={(e) => setMonth(e.target.value)}>
                  {MONTHS.map((m) => <option key={m}>{m}</option>)}
                </select>
                <ChevronDownIcon />
              </div>
            </div>

            <div className="rd-field">
              <label className="rd-label">Година</label>
              <div className="rd-select-wrap">
                <select className="rd-select rd-select--w100" value={year} onChange={(e) => setYear(e.target.value)}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDownIcon />
              </div>
            </div>
          </div>

          <div className="rd-field">
            <label className="rd-label">Набор</label>
            <div className="rd-select-wrap">
              <select className="rd-select rd-select--w120" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="all">Всички</option>
                {groups.map((g) => <option key={g} value={String(g)}>{g}</option>)}
              </select>
              <ChevronDownIcon />
            </div>
          </div>

          <div className="rd-field">
            <label className="rd-label">Статус</label>
            <div className="rd-seg">
              <button className={`rd-seg-btn${statusFilter === "all" ? " active" : ""}`} onClick={() => setStatusFilter("all")}>Всички</button>
              <button className={`rd-seg-btn${statusFilter === "paid" ? " active" : ""}`} onClick={() => setStatusFilter("paid")}>Платили</button>
              <button className={`rd-seg-btn${statusFilter === "unpaid" ? " active" : ""}`} onClick={() => setStatusFilter("unpaid")}>Неплатили</button>
            </div>
          </div>
        </div>

        <div className="rd-stats">
          <div className="rd-stat">
            <div className="rd-stat-label"><UsersIcon />Общо събрани такси</div>
            <div className="rd-stat-num rd-stat-num--green">
              {paidCount}<span className="rd-stat-denom">/ {total}</span>
            </div>
          </div>
          <div className="rd-stat">
            <div className="rd-stat-label"><TrendingUpIcon />Процент събираемост</div>
            <div className={`rd-stat-num ${pct >= 75 ? "rd-stat-num--green" : "rd-stat-num--red"}`}>{pct}%</div>
          </div>
          <div className="rd-stat">
            <div className="rd-stat-label"><CircleAlertIcon />Липсващи плащания</div>
            <div className="rd-stat-num rd-stat-num--red">{missing}</div>
          </div>
        </div>

        <div className="rd-table-wrap">
          <table className="rd-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Име</th>
                <th>Набор</th>
                <th>Дата на плащане</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="rd-empty-row">Зареждане...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="rd-empty-row">Няма играчи за избраните филтри.</td>
                </tr>
              )}
              {!loading && filtered.map((row, i) => (
                <tr key={row.id}>
                  <td className="rd-td-muted">{i + 1}</td>
                  <td>{row.name}</td>
                  <td className="rd-td-dim">{row.group ?? "—"}</td>
                  <td className="rd-td-dim">{row.date}</td>
                  <td>
                    <span className={`rd-badge ${row.paid ? "rd-badge--paid" : "rd-badge--unpaid"}`}>
                      {row.paid ? "Платено" : "Неплатено"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rd-footer">
          <button className="rd-footer-btn" onClick={() => printReport("monthly")}>
            <PrinterIcon />
            Генерирай месечен отчет
          </button>
          <button className="rd-footer-btn" onClick={() => printReport("yearly")}>
            <CalendarIcon />
            Генерирай годишен отчет
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Member Detail Modal ── */
function MemberDetailModal({
  member,
  onClose,
  onRequestDelete,
  onRequestEdit,
}: {
  member: Member;
  onClose: () => void;
  onRequestDelete: (member: Member) => void;
  onRequestEdit: (member: Member) => void;
}) {
  const s = getStatusMeta(member.status);
  const [historyOpen, setHistoryOpen] = useState(false);

  const paymentHistory = [...(member.paymentLogs ?? [])].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
  const lastPayment = paymentHistory[0];
  const activeCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "Няма активна карта";

  return (
    <div className="amp-overlay" onClick={onClose}>
      <div className="amp-modal" onClick={e => e.stopPropagation()}>

        {/* green tint */}
        <div className="amp-modal-tint" aria-hidden="true" />

        {/* Title */}
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">{member.fullName} - Статистика</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори">
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">

          {/* Info card — 2-col grid */}
          <div className="amp-info-card">

            {/* Row 1 col 1: Име */}
            <div className="amp-info-cell">
              <UserIcon />
              <div>
                <p className="amp-lbl">Име</p>
                <p className="amp-val">{member.fullName}</p>
              </div>
            </div>

            {/* Row 1 col 2: Набор */}
            <div className="amp-info-cell">
              <span className="amp-lbl">Набор:</span>
              <span className="amp-val">{member.teamGroup ?? "—"}</span>
            </div>

            {/* Row 2 col 1: Статус */}
            <div className="amp-info-cell">
              <span className="amp-lbl">Статус:</span>
              <span className="amp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                {s.label}
              </span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Активна карта:</span>
              <span className="amp-val">{activeCardCode}</span>
            </div>

            {/* Row 3 full: Последно плащане */}
            <div className="amp-info-cell amp-info-cell--full">
              <CalendarIcon />
              <div>
                <p className="amp-lbl">Последно плащане</p>
                <p className="amp-val">
                  {lastPayment
                    ? new Date(lastPayment.paidAt).toLocaleDateString("bg-BG") + " г."
                    : "Няма плащания"}
                </p>
              </div>
            </div>

          </div>

          {/* Accordion */}
          <div className="amp-acc">
            <button className="amp-acc-trigger" onClick={() => setHistoryOpen(v => !v)}>
              <span>История на плащанията</span>
              <span className={`amp-acc-chevron${historyOpen ? " open" : ""}`}><ChevronDownIcon /></span>
            </button>
            <div className={`amp-acc-body${historyOpen ? " open" : ""}`}>
              <div className="amp-acc-inner">
                {paymentHistory.length === 0 ? (
                  <div className="amp-acc-empty">
                    <ReceiptIcon />
                    <p>Все още няма регистрирани плащания</p>
                  </div>
                ) : (
                  <div className="amp-acc-list">
                    {paymentHistory.map((p) => (
                      <div key={p.id} className="amp-acc-row">
                        <span className="amp-acc-period">{p.paidFor}</span>
                        <span className="amp-acc-date">{new Date(p.paidAt).toLocaleDateString("bg-BG")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="amp-modal-actions amp-modal-actions--end">
            <button
              className="amp-btn amp-btn--ghost"
              onClick={() => onRequestEdit(member)}
            >
              Редактирай
            </button>
            <button
              className="amp-btn amp-btn--danger"
              onClick={() => onRequestDelete(member)}
            >
              Премахни играч
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Confirm Delete Modal ── */
function ConfirmDeleteModal({
  member,
  onCancel,
  onConfirm,
  isDeleting,
  error,
}: {
  member: Member;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error: string;
}) {
  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isDeleting ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди премахване</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да премахнеш <strong>{member.fullName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            Играчът ще бъде маркиран като неактивен.
          </p>

          {error && <p className="amp-confirm-error">{error}</p>}

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Премахване..." : "Премахни"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Player Card ── */
function PlayerCard({ member, onClick }: { member: Member; onClick: () => void }) {
  const router = useRouter();
  const s = getStatusMeta(member.status);
  const initial = member.fullName.trim().charAt(0).toUpperCase() || "?";
  const needsAction = member.status === "overdue" || member.status === "warning";
  const cardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "";

  return (
    <div className="pc-card" onClick={onClick}>
      <div className="pc-shimmer" aria-hidden="true" />
      <div className="pc-content">
        {/* Avatar */}
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt={member.fullName} className="pc-avatar pc-avatar--img" />
        ) : (
          <div className="pc-avatar" style={{ color: s.color, background: s.bg, borderColor: s.border }}>
            <span className="pc-avatar-letter">{initial}</span>
          </div>
        )}

        {/* Name + badge */}
        <div className="pc-info">
          <span className="pc-name">{member.fullName}</span>
          <div className="pc-badges">
            <span className="amp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
              {s.label}
            </span>
          </div>
        </div>

        <div className="pc-actions">
          {cardCode && (
            <button
              type="button"
              className="pc-profile-btn"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/member/${encodeURIComponent(cardCode)}`);
              }}
            >
              виж профил
            </button>
          )}

          {!needsAction && (
            <span style={{ color: "#32cd32", flexShrink: 0 }}>
              <CircleCheckBigIcon size={24} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
function AdminMembersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId") ?? "";
  const [members, setMembers] = useState<Member[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [editError, setEditError]               = useState("");
  const [isSavingEdit, setIsSavingEdit]         = useState(false);
  const [clubs, setClubs]                       = useState<ClubOption[]>([]);
  const [editForm, setEditForm] = useState({
    fullName: "",
    clubId: "",
    teamGroup: "",
    jerseyNumber: "",
    birthDate: "",
    avatarUrl: "",
    imageUrl: "",
    imagePublicId: "",
  });
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreviewUrl, setEditAvatarPreviewUrl] = useState("");
  const [clubName, setClubName] = useState("Всички отбори");
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubOption | null>(null);
  const [clubEditForm, setClubEditForm] = useState({
    name: "",
    emblemUrl: "",
    imageUrl: "",
    imagePublicId: "",
  });
  const [clubEditImageFile, setClubEditImageFile] = useState<File | null>(null);
  const [clubEditPreviewUrl, setClubEditPreviewUrl] = useState<string | null>(null);
  const [isSavingClub, setIsSavingClub] = useState(false);
  const [clubEditError, setClubEditError] = useState("");
  const [isNewCardConfirmOpen, setIsNewCardConfirmOpen] = useState(false);
  const [isAssigningNewCard, setIsAssigningNewCard] = useState(false);

  const closeEditModal = () => {
    setMemberToEdit(null);
    setEditAvatarFile(null);
    setEditAvatarPreviewUrl("");
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || isDeletingMember) return;

    setIsDeletingMember(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/admin/members/${memberToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let message = "Неуспешно премахване на играч.";
        try {
          const data = await response.json();
          if (typeof data?.error === "string" && data.error.trim()) {
            message = data.error.trim();
          }
        } catch {
          // Keep generic message when response body is not JSON.
        }
        setDeleteError(message);
        return;
      }

      setMembers((prev) => prev.filter((member) => member.id !== memberToDelete.id));
      setSelectedMember((prev) => (prev?.id === memberToDelete.id ? null : prev));
      setMemberToDelete(null);
    } catch (error) {
      console.error("Error removing member:", error);
      setDeleteError("Възникна грешка при премахване на играч.");
    } finally {
      setIsDeletingMember(false);
    }
  };

  const openEditMember = async (member: Member) => {
    setEditError("");
    if (clubs.length === 0) {
      try {
        const response = await fetch("/api/admin/clubs", { cache: "no-store" });
        if (response.ok) {
          const clubsPayload: unknown = await response.json();
          const normalizedClubs: ClubOption[] = Array.isArray(clubsPayload)
            ? clubsPayload
              .map((club) => {
                const item =
                  typeof club === "object" && club !== null
                    ? (club as {
                      id?: unknown;
                      name?: unknown;
                      emblemUrl?: unknown;
                      imageUrl?: unknown;
                      imagePublicId?: unknown;
                    })
                    : {};
                const rawName = String(item.name ?? "").trim();
                return {
                  id: String(item.id ?? ""),
                  name: rawName,
                  emblemUrl: typeof item.emblemUrl === "string" ? item.emblemUrl : null,
                  imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
                  imagePublicId: typeof item.imagePublicId === "string" ? item.imagePublicId : null,
                };
              })
              .filter((club) => club.id && club.name)
            : [];
          setClubs(normalizedClubs);
        }
      } catch (error) {
        console.error("Error loading clubs for edit:", error);
      }
    }
    setMemberToEdit(member);
    setEditAvatarFile(null);
    setEditAvatarPreviewUrl("");
    setEditForm({
      fullName: member.fullName,
      clubId: member.club?.id ?? "",
      teamGroup: member.teamGroup !== null ? String(member.teamGroup) : "",
      jerseyNumber: member.jerseyNumber ?? "",
      birthDate: member.birthDate ? new Date(member.birthDate).toISOString().slice(0, 10) : "",
      avatarUrl: member.avatarUrl ?? "",
      imageUrl: member.imageUrl ?? "",
      imagePublicId: member.imagePublicId ?? "",
    });
  };

  useEffect(() => {
    if (!editAvatarFile) {
      setEditAvatarPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(editAvatarFile);
    setEditAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [editAvatarFile]);

  const handleSaveMemberEdit = async () => {
    if (!memberToEdit || isSavingEdit) return;
    const fullName = editForm.fullName.trim();
    if (!fullName) {
      setEditError("Името е задължително.");
      return;
    }
    if (!editForm.clubId) {
      setEditError("Изберете отбор.");
      return;
    }

    const teamGroupValue = editForm.teamGroup.trim();
    const parsedTeamGroup = teamGroupValue === "" ? null : Number.parseInt(teamGroupValue, 10);
    if (parsedTeamGroup !== null && Number.isNaN(parsedTeamGroup)) {
      setEditError("Наборът трябва да е число.");
      return;
    }

    setIsSavingEdit(true);
    setEditError("");
    try {
      let resolvedAvatarUrl = editForm.avatarUrl.trim() || null;
      let resolvedImageUrl = editForm.imageUrl.trim() || null;
      let resolvedImagePublicId = editForm.imagePublicId.trim() || null;

      if (editAvatarFile) {
        const uploaded = await uploadImage(
          editAvatarFile,
          "player",
          fullName || editAvatarFile.name,
        );
        resolvedAvatarUrl = uploaded.secure_url;
        resolvedImageUrl = extractUploadPathFromCloudinaryUrl(uploaded.secure_url);
        resolvedImagePublicId = uploaded.public_id;
      }

      const response = await fetch(`/api/admin/members/${memberToEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          clubId: editForm.clubId,
          teamGroup: parsedTeamGroup,
          jerseyNumber: editForm.jerseyNumber.trim() || null,
          birthDate: editForm.birthDate.trim() || null,
          avatarUrl: resolvedAvatarUrl,
          imageUrl: resolvedImageUrl,
          imagePublicId: resolvedImagePublicId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Неуспешно редактиране на играч.";
        setEditError(message);
        return;
      }

      const updatedMember = normalizeMember(data);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberToEdit.id ? updatedMember : m
        )
      );

      setSelectedMember((prev) =>
        prev?.id === memberToEdit.id ? updatedMember : prev
      );

      closeEditModal();
    } catch (error) {
      console.error("Error updating member:", error);
      setEditError("Възникна грешка при редактиране.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAssignNewCard = async () => {
    if (!memberToEdit || isSavingEdit || isAssigningNewCard) return;

    setIsAssigningNewCard(true);
    setEditError("");

    try {
      const response = await fetch(`/api/admin/members/${memberToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_new_card" }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Неуспешно генериране на нова карта.";
        setEditError(message);
        return;
      }

      const updatedMember = normalizeMember(data);
      setMembers((prev) => prev.map((m) => (m.id === memberToEdit.id ? updatedMember : m)));
      setSelectedMember((prev) => (prev?.id === memberToEdit.id ? updatedMember : prev));
      setMemberToEdit(updatedMember);
    } catch (error) {
      console.error("Error assigning new card:", error);
      setEditError("Възникна грешка при генериране на нова карта.");
    } finally {
      setIsAssigningNewCard(false);
    }
  };

  const handleConfirmAssignNewCard = async () => {
    setIsNewCardConfirmOpen(false);
    await handleAssignNewCard();
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/admin/check-session", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok) {
          setIsAdmin(false);
          return;
        }

        const payload = (await response.json()) as { isAdmin?: boolean; roles?: string[] };
        setIsAdmin(Boolean(payload.isAdmin) || (Array.isArray(payload.roles) && payload.roles.includes("admin")));
      } catch {
        setIsAdmin(false);
      }
    };

    void fetchSession();
  }, []);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const clubsResponse = await fetch("/api/admin/clubs", { cache: "no-store" });
        if (!clubsResponse.ok) {
          router.replace("/404");
          return;
        }

        const clubsPayload: unknown = await clubsResponse.json();
        if (clubId) {
          const selectedClub = Array.isArray(clubsPayload)
            ? clubsPayload.find((club) => {
              const item =
                typeof club === "object" && club !== null
                  ? (club as { id?: unknown; name?: unknown })
                  : {};
              return String(item.id ?? "") === clubId;
            })
            : null;

          if (!selectedClub || typeof selectedClub.name !== "string" || !selectedClub.name.trim()) {
            router.replace("/404");
            return;
          }

          setClubName(selectedClub.name.trim());

          const logo = (selectedClub as Record<string, unknown>).imageUrl;
          if (typeof logo === "string" && logo) {
            setClubLogoUrl(logo);
          } else {
            setClubLogoUrl(null);
          }
        } else {
          setClubName("Р’СЃРёС‡РєРё РѕС‚Р±РѕСЂРё");
          setClubLogoUrl(null);
        }

        const endpoint = clubId
          ? `/api/admin/members?clubId=${encodeURIComponent(clubId)}`
          : "/api/admin/members";
        const res = await fetch(endpoint);
        if (res.status === 404) {
          router.replace("/404");
          return;
        }
        if (res.ok) {
          const data: unknown = await res.json();
          const rawItems = Array.isArray(data) ? data : [];
          const normalized: Member[] = rawItems.map((item) => normalizeMember(item));
          const activeMembers = normalized.filter((member) => member.isActive);
          setMembers(activeMembers);
          const nameFromMembers = normalized[0]?.club?.name;
          if (clubId && nameFromMembers) {
            setClubName(nameFromMembers);
          }
        }
      } catch (err) {
        console.error("Error fetching members:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchClubName = async () => {
      if (!clubId) {
        setClubName("Всички отбори");
        return;
      }

      try {
        const response = await fetch("/api/admin/clubs", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const clubs: unknown = await response.json();
        const selectedClub = Array.isArray(clubs)
          ? clubs.find((club) => {
            const item =
              typeof club === "object" && club !== null
                ? (club as { id?: unknown })
                : {};
            return String(item.id ?? "") === clubId;
          })
          : null;
        if (selectedClub?.name) {
          setClubName(String(selectedClub.name));
        }
        const logo = (selectedClub as Record<string, unknown> | null)?.imageUrl;
        if (typeof logo === "string" && logo) {
          setClubLogoUrl(logo);
        }
      } catch (err) {
        console.error("Error fetching clubs:", err);
      }
    };

    void fetchMembers();
    void fetchClubName();
  }, [clubId, router]);

  /* ── Derived ── */
  const groupOptions = [...new Set(
    members.map((m) => m.teamGroup).filter((g): g is number => g !== null)
  )].sort((a, b) => b - a);

  const filtered = members.filter((m) => {
    const matchGroup = selectedGroup === "all" || String(m.teamGroup) === selectedGroup;
    if (!matchGroup) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.jerseyNumber ?? "").toLowerCase().includes(q) ||
      m.cards.some((c) => c.cardCode.toLowerCase().includes(q)) ||
      (m.club?.name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="amp-page">
      <div className="amp-dot-grid" aria-hidden="true" />

      <div className="amp-inner">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
          <AdminLogoutButton />
        </div>

        {/* ── Page header ── */}
        <div className="amp-header">
          <h1 className="amp-title">Списък играчи</h1>
          <p className="amp-subtitle">Търсене, филтриране и ръчно отбелязване на плащания</p>
          <div className="amp-title-line" />
        </div>

        <div className="amp-club-info">
          {clubLogoUrl ? (
            <img
              src={clubLogoUrl}
              alt={clubName}
              className="amp-club-logo"
            />
          ) : (
            <div className="amp-club-icon">🏆</div>
          )}
          <h2 className="amp-club-name">{clubName}</h2>
        </div>

        {/* ── Nav row ── */}
        <div className="amp-nav-row">
          <div className="amp-nav-left">
            {isAdmin && (
              <button className="amp-back-btn" onClick={() => router.push("/admin/players")}>
                <ArrowLeftIcon />
                Назад към отбори
              </button>
            )}
            <button className="amp-add-btn" onClick={() => router.push(`/admin/members/add?clubId=${encodeURIComponent(clubId)}`)}>
              <PlusIcon />
              Добави играч
            </button>
          </div>
          {isAdmin && clubId && (
            <button
              className="amp-edit-team-btn"
              onClick={() => router.push(`/admin/teams/${encodeURIComponent(clubId)}/edit`)}
            >
              Редактирай отбор
            </button>
          )}
        </div>

        {/* Reports button */}
        <button className="amp-reports-btn" onClick={() => setReportsOpen(true)}>
          <ChartColumnIcon />
          Център за отчети
        </button>

        {/* ── Content ── */}
        <div className="amp-content">

          {/* Group filter pills */}
          <div className="amp-pills">
            <button
              className={`amp-pill${selectedGroup === "all" ? " amp-pill--active" : ""}`}
              onClick={() => setSelectedGroup("all")}
            >
              Всички
            </button>
            {groupOptions.map((g) => (
              <button
                key={g}
                className={`amp-pill${selectedGroup === String(g) ? " amp-pill--active" : ""}`}
                onClick={() => setSelectedGroup(String(g))}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="amp-search-wrap">
            <SearchIcon />
            <input
              className="amp-search"
              type="text"
              placeholder="Търси по име или номер..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="amp-search-clear" onClick={() => setSearchTerm("")}>
                <XIcon />
              </button>
            )}
          </div>

          {/* Cards */}
          {loading ? (
            <div className="amp-loading">
              <div className="amp-spinner" />
            </div>
          ) : (
            <div className="amp-cards">
              {filtered.map((m) => (
                <PlayerCard key={m.id} member={m} onClick={() => setSelectedMember(m)} />
              ))}
              {filtered.length === 0 && (
                <p className="amp-empty">Няма намерени играчи</p>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Detail modal */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onRequestEdit={openEditMember}
          onRequestDelete={(member) => {
            setDeleteError("");
            setMemberToDelete(member);
          }}
        />
      )}
      {memberToEdit && (
        <div className="amp-overlay" onClick={isSavingEdit ? undefined : closeEditModal}>
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Редактиране на играч</span>
              <button
                className="amp-modal-close"
                onClick={closeEditModal}
                aria-label="Затвори"
                disabled={isSavingEdit || isAssigningNewCard}
              >
                <XIcon />
              </button>
            </h2>

            <div className="amp-modal-body">
              <div className="amp-edit-grid">
                <label className="amp-edit-field">
                  <span className="amp-lbl">Име и фамилия</span>
                  <input
                    className="amp-edit-input"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                </label>
                <label className="amp-edit-field">
                  <span className="amp-lbl">Club</span>
                  <select
                    className="amp-edit-input"
                    value={editForm.clubId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, clubId: e.target.value }))}
                  >
                    <option value="" disabled>
                      Изберете отбор
                    </option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="amp-edit-field">
                  <span className="amp-lbl">Номер в отбора</span>
                  <input
                    className="amp-edit-input"
                    value={editForm.jerseyNumber}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, jerseyNumber: e.target.value }))}
                  />
                </label>
                <label className="amp-edit-field">
                  <span className="amp-lbl">Набор</span>
                  <input
                    className="amp-edit-input"
                    inputMode="numeric"
                    value={editForm.teamGroup}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        teamGroup: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                  />
                </label>
                <label className="amp-edit-field">
                  <span className="amp-lbl">Дата на раждане</span>
                  <input
                    className="amp-edit-input"
                    type="date"
                    value={editForm.birthDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                  />
                </label>
                <label className="amp-edit-field amp-edit-field--full">
                  <span className="amp-lbl">Текуща снимка</span>
                  {editAvatarPreviewUrl || editForm.avatarUrl ? (
                    <img
                      src={editAvatarPreviewUrl || editForm.avatarUrl}
                      alt={editForm.fullName || "Player avatar"}
                      className="amp-edit-avatar-preview"
                    />
                  ) : (
                    <p className="amp-edit-image-empty">Няма качена снимка.</p>
                  )}
                </label>
                <label className="amp-edit-field amp-edit-field--full">
                  <span className="amp-lbl">Качи нова снимка</span>
                  <input
                    className="amp-edit-input amp-edit-input--file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditAvatarFile(e.target.files?.[0] ?? null)}
                    disabled={isSavingEdit || isAssigningNewCard}
                  />
                </label>
                <div className="amp-edit-field amp-edit-field--full">
                  <span className="amp-lbl">Активна карта</span>
                  <div className="amp-modal-actions amp-modal-actions--end">
                    <p className="amp-val" style={{ marginRight: "auto" }}>
                      {memberToEdit.cards.find((card) => card.isActive)?.cardCode ||
                        memberToEdit.cards[0]?.cardCode ||
                        "Няма активна карта"}
                    </p>
                    {isAdmin && (
                      <button
                        className="amp-btn amp-btn--ghost"
                        onClick={() => setIsNewCardConfirmOpen(true)}
                        disabled={isSavingEdit || isAssigningNewCard}
                        type="button"
                      >
                        {isAssigningNewCard ? "Генериране..." : "Нова карта"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {editError && <p className="amp-confirm-error">{editError}</p>}

              <div className="amp-modal-actions">
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={closeEditModal}
                  disabled={isSavingEdit || isAssigningNewCard}
                >
                  Отказ
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  onClick={handleSaveMemberEdit}
                  disabled={isSavingEdit || isAssigningNewCard}
                >
                  {isSavingEdit ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {memberToEdit && isNewCardConfirmOpen && (
        <ConfirmNewCardModal
          member={memberToEdit}
          onCancel={() => {
            if (!isAssigningNewCard) {
              setIsNewCardConfirmOpen(false);
            }
          }}
          onConfirm={handleConfirmAssignNewCard}
          isAssigning={isAssigningNewCard}
        />
      )}
      {memberToDelete && (
        <ConfirmDeleteModal
          member={memberToDelete}
          onCancel={() => {
            if (!isDeletingMember) {
              setDeleteError("");
              setMemberToDelete(null);
            }
          }}
          onConfirm={handleDeleteMember}
          isDeleting={isDeletingMember}
          error={deleteError}
        />
      )}
      {reportsOpen && <ReportsDialog onClose={() => setReportsOpen(false)} clubId={clubId} />}
    </main>
  );
}

export default function AdminMembersPage() {
  return (
    <Suspense fallback={<main className="amp-page" />}>
      <AdminMembersPageContent />
    </Suspense>
  );
}

function ConfirmNewCardModal({
  member,
  onCancel,
  onConfirm,
  isAssigning,
}: {
  member: Member;
  onCancel: () => void;
  onConfirm: () => void;
  isAssigning: boolean;
}) {
  const currentCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.cards[0]?.cardCode ||
    "Няма активна карта";

  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isAssigning ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди нова карта</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isAssigning}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да генерираш нова карта за <strong>{member.fullName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            Текущата активна карта <strong>{currentCardCode}</strong> ще бъде автоматично деактивирана.
          </p>

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isAssigning}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--primary" onClick={onConfirm} disabled={isAssigning}>
              {isAssigning ? "Генериране..." : "Генерирай нова карта"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

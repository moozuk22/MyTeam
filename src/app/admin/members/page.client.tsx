"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractUploadPathFromCloudinaryUrl } from "@/lib/cloudinaryImagePath";
import { uploadImage } from "@/lib/uploadImage";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import "./page.css";

// Reports-related imports
const MONTHS = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];
const TRAINING_SELECTION_WINDOW_DAYS = 30;
const TRAINING_WEEKDAY_SHORT_BG = Array.from({ length: 7 }, (_, index) =>
  new Intl.DateTimeFormat("bg-BG", { weekday: "short" })
    .format(new Date(Date.UTC(2024, 0, index + 1)))
    .replace(".", ""),
);

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

type PlayerStatus = "paid" | "warning" | "overdue" | "paused";

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
  reminderDay?: number;
  overdueDay?: number;
  reminderHour?: number;
  reminderMinute?: number;
  overdueHour?: number;
  overdueMinute?: number;
  trainingDates?: string[];
  trainingWeekdays?: number[];
  trainingWindowDays?: number;
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

interface TrainingAttendancePlayer {
  id: string;
  fullName: string;
  teamGroup: number | null;
  cardCode: string | null;
  optedOut: boolean;
}

interface TrainingUpcomingDateItem {
  date: string;
  weekday: number;
  stats: {
    total: number;
    attending: number;
    optedOut: number;
  };
}

interface TrainingScheduleGroup {
  id: string;
  name: string;
  teamGroups: number[];
  trainingDates: string[];
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
    rawStatus === "paid" || rawStatus === "warning" || rawStatus === "overdue" || rawStatus === "paused"
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

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getTodayIsoDate(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatBirthDateForExport(value: string | null): string {
  if (!value) {
    return "-";
  }

  const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-GB", { timeZone: "UTC" });
}

function getNextTrainingCalendarDates(days = TRAINING_SELECTION_WINDOW_DAYS): string[] {
  const startIso = getTodayIsoDate();
  const start = new Date(`${startIso}T00:00:00.000Z`).getTime();
  const result: string[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    result.push(toIsoDateOnly(new Date(start + offset * 24 * 60 * 60 * 1000)));
  }

  return result;
}

function getWeekdayMondayFirstIndex(isoDate: string): number {
  const day = new Date(`${isoDate}T12:00:00.000Z`).getUTCDay();
  return (day + 6) % 7;
}

function parseSelectedTeamGroup(selectedGroup: string): number | null {
  if (selectedGroup === "all") {
    return null;
  }
  const parsed = Number.parseInt(selectedGroup, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function buildCalendarMonths(dates: string[]) {
  const monthKeys = Array.from(
    new Set(
      dates.map((date) => {
        const [year, month] = date.split("-").map((value) => Number.parseInt(value ?? "", 10));
        return `${year}-${month}`;
      }),
    ),
  );

  return monthKeys
    .map((key) => {
      const [year, month] = key.split("-").map((value) => Number.parseInt(value ?? "", 10));
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
      }

      const firstDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const leadingEmpty = getWeekdayMondayFirstIndex(firstDate);
      const cells: Array<string | null> = Array.from({ length: leadingEmpty }, () => null);

      for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
      }
      while (cells.length % 7 !== 0) {
        cells.push(null);
      }

      return {
        key,
        label: `${MONTHS[month - 1] ?? ""} ${year}`,
        cells,
      };
    })
    .filter((month): month is { key: string; label: string; cells: Array<string | null> } => month !== null)
    .sort((a, b) => a.key.localeCompare(b.key));
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

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
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
  if (status === "paused") return {
    label: "Пауза",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.2)",
    border: "rgba(96,165,250,0.3)",
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

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
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
  actionMode = "active",
  onRequestReactivate,
  onRequestPermanentDelete,
  isReactivating = false,
  isDeletingPermanent = false,
}: {
  member: Member;
  onClose: () => void;
  onRequestDelete: (member: Member) => void;
  onRequestEdit: (member: Member) => void;
  actionMode?: "active" | "inactive";
  onRequestReactivate?: (member: Member) => void;
  onRequestPermanentDelete?: (member: Member) => void;
  isReactivating?: boolean;
  isDeletingPermanent?: boolean;
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
            {actionMode === "active" ? (
              <>
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
              </>
            ) : (
              <>
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => onRequestReactivate?.(member)}
                  disabled={isReactivating || isDeletingPermanent}
                >
                  {isReactivating ? "Възстановяване..." : "Възстанови"}
                </button>
                <button
                  className="amp-btn amp-btn--danger"
                  onClick={() => onRequestPermanentDelete?.(member)}
                  disabled={isReactivating || isDeletingPermanent}
                >
                  {isDeletingPermanent ? "Изтриване..." : "Изтрий"}
                </button>
              </>
            )}
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
function PlayerCard({
  member,
  onClick,
  actionMode = "profile",
  isActionLoading = false,
  onReactivate,
  isDeleteLoading = false,
  onPermanentDelete,
}: {
  member: Member;
  onClick: () => void;
  actionMode?: "profile" | "reactivate";
  isActionLoading?: boolean;
  onReactivate?: () => void;
  isDeleteLoading?: boolean;
  onPermanentDelete?: () => void;
}) {
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
          <div className="pc-name-container">
            {member.fullName.split(' ').map((part, index) => (
              <span key={index} className="pc-name-row">{part}</span>
            ))}
          </div>
          <div className="pc-badges">
            <span className="amp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
              {s.label}
            </span>
          </div>
        </div>

        <div className="pc-actions">
          {actionMode === "profile" && cardCode && (
            <button
              type="button"
              className="pc-profile-btn"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/member/${encodeURIComponent(cardCode)}`);
              }}
            >
              профил
            </button>
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
  const [isCoach, setIsCoach] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [trainingGroupScope, setTrainingGroupScope] = useState("");
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
  const [inactivePlayersOpen, setInactivePlayersOpen] = useState(false);
  const [reactivatingMemberId, setReactivatingMemberId] = useState<string | null>(null);
  const [deletingPermanentMemberId, setDeletingPermanentMemberId] = useState<string | null>(null);
  const [memberToPermanentDelete, setMemberToPermanentDelete] = useState<Member | null>(null);
  const [inactiveActionError, setInactiveActionError] = useState("");
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);
  const [isTeamDeleteConfirmOpen, setIsTeamDeleteConfirmOpen] = useState(false);
  const [schedulerSettingsOpen, setSchedulerSettingsOpen] = useState(false);
  const [schedulerSettingsLoading, setSchedulerSettingsLoading] = useState(false);
  const [schedulerSettingsSaving, setSchedulerSettingsSaving] = useState(false);
  const [schedulerSettingsError, setSchedulerSettingsError] = useState("");
  const [schedulerForm, setSchedulerForm] = useState({
    reminderDay: "25",
    overdueDay: "1",
    reminderHour: "10",
    reminderMinute: "0",
    overdueHour: "10",
    overdueMinute: "0",
    trainingDates: [] as string[],
  });
  const reminderTimeValue = `${schedulerForm.reminderHour.padStart(2, "0")}:${schedulerForm.reminderMinute.padStart(2, "0")}`;
  const overdueTimeValue = `${schedulerForm.overdueHour.padStart(2, "0")}:${schedulerForm.overdueMinute.padStart(2, "0")}`;
  const [trainingAttendanceOpen, setTrainingAttendanceOpen] = useState(false);
  const [trainingAttendanceView, setTrainingAttendanceView] = useState<"teamGroup" | "trainingGroups">("teamGroup");
  const [trainingAttendanceLoading, setTrainingAttendanceLoading] = useState(false);
  const [trainingAttendanceError, setTrainingAttendanceError] = useState("");
  const [trainingAttendanceDate, setTrainingAttendanceDate] = useState(getTodayIsoDate());
  const [trainingAttendancePlayers, setTrainingAttendancePlayers] = useState<TrainingAttendancePlayer[]>([]);
  const [trainingAttendanceStats, setTrainingAttendanceStats] = useState({
    total: 0,
    attending: 0,
    optedOut: 0,
  });
  const [trainingUpcomingDates, setTrainingUpcomingDates] = useState<TrainingUpcomingDateItem[]>([]);
  const [trainingNote, setTrainingNote] = useState("");
  const [trainingNoteSaving, setTrainingNoteSaving] = useState(false);
  const [trainingNoteTargetDates, setTrainingNoteTargetDates] = useState<string[]>([]);
  const [trainingBulkNoteOpen, setTrainingBulkNoteOpen] = useState(false);
  const [trainingNoteSuccessOpen, setTrainingNoteSuccessOpen] = useState(false);
  const [trainingNoteSuccessMessage, setTrainingNoteSuccessMessage] = useState("");
  const [trainingNotesByDate, setTrainingNotesByDate] = useState<Record<string, string>>({});
  const [trainingNoteComparisonLoading, setTrainingNoteComparisonLoading] = useState(false);
  const [trainingDayDetailsOpen, setTrainingDayDetailsOpen] = useState(false);
  const [trainingDayDetailsOpening, setTrainingDayDetailsOpening] = useState(false);
  const [trainingDaysEditorOpen, setTrainingDaysEditorOpen] = useState(false);
  const [trainingDaysEditorLoading, setTrainingDaysEditorLoading] = useState(false);
  const [trainingDaysEditorSaving, setTrainingDaysEditorSaving] = useState(false);
  const [trainingDaysEditorError, setTrainingDaysEditorError] = useState("");
  const [trainingDaysInitialDates, setTrainingDaysInitialDates] = useState<string[]>([]);
  const [trainingDaysSuccessOpen, setTrainingDaysSuccessOpen] = useState(false);
  const [trainingDaysSuccessMessage, setTrainingDaysSuccessMessage] = useState("");
  const [trainingDaysEditorMode, setTrainingDaysEditorMode] = useState<"teamGroup" | "createGroup" | "trainingGroup">("teamGroup");
  const [trainingDaysEditorGroups, setTrainingDaysEditorGroups] = useState<string[]>([]);
  const [trainingDaysEditorGroupName, setTrainingDaysEditorGroupName] = useState("");
  const [trainingDaysEditorCreateOpen, setTrainingDaysEditorCreateOpen] = useState(false);
  const [trainingGroupCreateOpen, setTrainingGroupCreateOpen] = useState(false);
  const [trainingGroupCreateSaving, setTrainingGroupCreateSaving] = useState(false);
  const [trainingGroupCreateError, setTrainingGroupCreateError] = useState("");
  const [trainingGroupCreateGroups, setTrainingGroupCreateGroups] = useState<string[]>([]);
  const [trainingGroupCreateName, setTrainingGroupCreateName] = useState("");
  const [trainingGroupEditOpen, setTrainingGroupEditOpen] = useState(false);
  const [trainingGroupEditSaving, setTrainingGroupEditSaving] = useState(false);
  const [trainingGroupEditError, setTrainingGroupEditError] = useState("");
  const [trainingGroupDeleteConfirmOpen, setTrainingGroupDeleteConfirmOpen] = useState(false);
  const [trainingGroupDeleteSaving, setTrainingGroupDeleteSaving] = useState(false);
  const [trainingGroupEditId, setTrainingGroupEditId] = useState("");
  const [trainingGroupEditName, setTrainingGroupEditName] = useState("");
  const [trainingGroupEditGroups, setTrainingGroupEditGroups] = useState<string[]>([]);
  const [selectedTrainingGroupId, setSelectedTrainingGroupId] = useState("");
  const [postTeamGroupSavePromptOpen, setPostTeamGroupSavePromptOpen] = useState(false);
  const [postTeamGroupSavePromptGroupId, setPostTeamGroupSavePromptGroupId] = useState("");
  const [postTeamGroupSavePromptGroupName, setPostTeamGroupSavePromptGroupName] = useState("");
  const [teamGroupWarningModalOpen, setTeamGroupWarningModalOpen] = useState(false);
  const [pendingTeamGroupWarningGroups, setPendingTeamGroupWarningGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [trainingScheduleGroupsLoading, setTrainingScheduleGroupsLoading] = useState(false);
  const [trainingScheduleGroups, setTrainingScheduleGroups] = useState<TrainingScheduleGroup[]>([]);
  const schedulerCalendarDates = getNextTrainingCalendarDates();
  const schedulerCalendarDateSet = new Set(schedulerCalendarDates);
  const schedulerCalendarMonths = buildCalendarMonths(schedulerCalendarDates);
  const trainingUpcomingDateSet = new Set(trainingUpcomingDates.map((item) => item.date));
  const trainingUpcomingByDate = new Map(trainingUpcomingDates.map((item) => [item.date, item]));
  const trainingAttendanceCalendarMonths = buildCalendarMonths(trainingUpcomingDates.map((item) => item.date));
  const todayIsoDate = getTodayIsoDate();
  const trainingNoteTeamGroupFilter = parseSelectedTeamGroup(trainingGroupScope);
  const trainingNoteScopeKey =
    trainingAttendanceView === "trainingGroups"
      ? `trainingGroup:${selectedTrainingGroupId || "-"}`
      : `teamGroup:${trainingNoteTeamGroupFilter === null ? "all" : String(trainingNoteTeamGroupFilter)}`;
  const effectiveTrainingNoteTargetDates =
    trainingNoteTargetDates.length > 0
      ? trainingNoteTargetDates
      : trainingAttendanceDate
        ? [trainingAttendanceDate]
        : [];
  const effectiveTrainingNoteTargetDatesKey = effectiveTrainingNoteTargetDates.join("|");
  const isTrainingNoteSameAsExisting =
    effectiveTrainingNoteTargetDates.length > 0 &&
    effectiveTrainingNoteTargetDates.every((date) =>
      Object.prototype.hasOwnProperty.call(trainingNotesByDate, `${trainingNoteScopeKey}|${date}`),
    ) &&
    effectiveTrainingNoteTargetDates.every(
      (date) => (trainingNotesByDate[`${trainingNoteScopeKey}|${date}`] ?? "").trim() === trainingNote.trim(),
    );

  useEffect(() => {
    if (!clubId) return;
    document.cookie = `admin_last_club_id=${encodeURIComponent(clubId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [clubId]);

  // Force early layout calculation for group filter dropdown
  useEffect(() => {
    const select = document.querySelector('.amp-content > .amp-edit-field:first-child select');
    if (select) {
      // Trigger a reflow to force browser to calculate dropdown position early
      (select as HTMLSelectElement).focus();
      setTimeout(() => {
        (select as HTMLSelectElement).blur();
      }, 0);
    }
  }, []);

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

      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberToDelete.id
            ? {
              ...member,
              isActive: false,
              cards: member.cards.map((card) => ({ ...card, isActive: false })),
            }
            : member,
        ),
      );
      setSelectedMember((prev) => (prev?.id === memberToDelete.id ? null : prev));
      setMemberToDelete(null);
    } catch (error) {
      console.error("Error removing member:", error);
      setDeleteError("Възникна грешка при премахване на играч.");
    } finally {
      setIsDeletingMember(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!isAdmin || !clubId || isDeletingTeam) {
      return;
    }

    const displayTeamName = clubName?.trim() || "този отбор";
    setIsDeletingTeam(true);
    try {
      const response = await fetch(`/api/admin/teams/${encodeURIComponent(clubId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Неуспешно изтриване на отбора.";
        throw new Error(message);
      }

      window.alert(`Отбор "${displayTeamName}" беше изтрит успешно.`);
      setIsTeamDeleteConfirmOpen(false);
      router.push("/admin/players");
    } catch (error) {
      console.error("Error deleting team:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Възникна грешка при изтриване на отбора.",
      );
    } finally {
      setIsDeletingTeam(false);
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

  const handleReactivateMember = async (member: Member) => {
    if (reactivatingMemberId || deletingPermanentMemberId) return;
    setInactiveActionError("");
    setReactivatingMemberId(member.id);
    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Неуспешно активиране на играч.";
        setInactiveActionError(message);
        return;
      }

      const updatedMember = normalizeMember(data);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updatedMember : m)));
      setSelectedMember((prev) => (prev?.id === member.id ? updatedMember : prev));
    } catch (error) {
      console.error("Error reactivating member:", error);
      setInactiveActionError("Възникна грешка при активиране на играч.");
    } finally {
      setReactivatingMemberId(null);
    }
  };

  const handlePermanentDeleteMember = async () => {
    if (!memberToPermanentDelete || reactivatingMemberId || deletingPermanentMemberId) return;
    const member = memberToPermanentDelete;

    setInactiveActionError("");
    setDeletingPermanentMemberId(member.id);
    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_permanently" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Неуспешно изтриване на играч.";
        setInactiveActionError(message);
        return;
      }

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setSelectedMember((prev) => (prev?.id === member.id ? null : prev));
    } catch (error) {
      console.error("Error permanently deleting member:", error);
      setInactiveActionError("Възникна грешка при изтриване на играч.");
    } finally {
      setDeletingPermanentMemberId(null);
      setMemberToPermanentDelete(null);
    }
  };

  const refreshMembersList = async () => {
    try {
      const endpoint = clubId
        ? `/api/admin/members?clubId=${encodeURIComponent(clubId)}`
        : "/api/admin/members";
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data: unknown = await response.json();
      const rawItems = Array.isArray(data) ? data : [];
      const normalized: Member[] = rawItems.map((item) => normalizeMember(item));
      setMembers(normalized);
    } catch (error) {
      console.error("Error refreshing members list:", error);
    }
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
          setIsCoach(false);
          return;
        }

        const payload = (await response.json()) as {
          isAdmin?: boolean;
          isCoach?: boolean;
          roles?: string[];
        };
        setIsAdmin(Boolean(payload.isAdmin) || (Array.isArray(payload.roles) && payload.roles.includes("admin")));
        setIsCoach(Boolean(payload.isCoach) || (Array.isArray(payload.roles) && payload.roles.includes("coach")));
      } catch {
        setIsAdmin(false);
        setIsCoach(false);
      }
    };

    void fetchSession();
  }, []);

  useEffect(() => {
    if (!clubId) {
      router.replace("/admin/login");
      return;
    }

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
          setClubName("Всички отбори");
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
          setMembers(normalized);
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

  useEffect(() => {
    if (!isAdmin) {
      setInactivePlayersOpen(false);
      setReactivatingMemberId(null);
      setDeletingPermanentMemberId(null);
      setMemberToPermanentDelete(null);
      setInactiveActionError("");
    }
  }, [isAdmin]);

  /* ── Derived ── */
  const groupOptions = [...new Set(
    members.map((m) => m.teamGroup).filter((g): g is number => g !== null)
  )].sort((a, b) => a - b);
  const activeMembersByGroup = members.reduce<Record<number, number>>((acc, member) => {
    if (!member.isActive || member.teamGroup === null) {
      return acc;
    }
    acc[member.teamGroup] = (acc[member.teamGroup] ?? 0) + 1;
    return acc;
  }, {});
  const selectedTeamGroup = parseSelectedTeamGroup(trainingGroupScope);
  const selectedTrainingGroup = trainingScheduleGroups.find((group) => group.id === selectedTrainingGroupId) ?? null;
  const selectedTeamGroupLinkedTrainingGroups =
    selectedTeamGroup === null
      ? []
      : trainingScheduleGroups.filter((group) => group.teamGroups.includes(selectedTeamGroup));
  const normalizedTrainingDaysSelection = schedulerForm.trainingDates
    .map((value) => String(value ?? "").trim())
    .filter((value) => schedulerCalendarDateSet.has(value))
    .sort((a, b) => a.localeCompare(b));
  const normalizedTrainingDaysInitial = trainingDaysInitialDates
    .map((value) => String(value ?? "").trim())
    .filter((value) => schedulerCalendarDateSet.has(value))
    .sort((a, b) => a.localeCompare(b));
  const isTrainingDaysScheduleUnchanged =
    trainingDaysEditorMode !== "createGroup" &&
    normalizedTrainingDaysSelection.join("|") === normalizedTrainingDaysInitial.join("|");
  const activeMembersCount = members.filter((m) => m.isActive).length;
  const inactiveMembers = members.filter((m) => !m.isActive);

  useEffect(() => {
    if (groupOptions.length === 0) {
      if (trainingGroupScope !== "") {
        setTrainingGroupScope("");
      }
      return;
    }
    const hasSelectedScope = groupOptions.some((group) => String(group) === trainingGroupScope);
    if (!hasSelectedScope) {
      setTrainingGroupScope(String(groupOptions[0]));
    }
  }, [groupOptions, trainingGroupScope]);

  const filtered = members.filter((m) => {
    if (!m.isActive) return false;

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

  const handleDownloadMemberLinks = async () => {
    if (!isAdmin || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const rows = members
      .filter((member) => member.isActive)
      .map((member) => {
        const cardCode =
          member.cards.find((card) => card.isActive)?.cardCode ||
          member.cards[0]?.cardCode ||
          "";

        if (!cardCode) {
          return null;
        }

        return {
          fullName: member.fullName,
          birthDate: formatBirthDateForExport(member.birthDate),
          url: `${window.location.origin}/member/${encodeURIComponent(cardCode)}`,
        };
      })
      .filter((item): item is { fullName: string; birthDate: string; url: string } => item !== null)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));

    if (rows.length === 0) {
      window.alert("Няма активни играчи с карта за export.");
      return;
    }

    const header = [
      `Отбор: ${clubName || "-"}`,
      `Общо активни играчи: ${rows.length}`,
      "",
    ].join("\n");
    const entries = rows
      .map(
        (row, index) =>
          `${index + 1}. ${row.fullName}\n` +
          `   Birthdate: ${row.birthDate}\n` +
          `   ${row.url}`,
      )
      .join("\n\n");
    const content = `${header}${entries}\n`.replace(/\n/g, "\r\n");
    const safeClub = (clubName || "club")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "");
    const defaultBaseName = `${safeClub || "club"}-member-links`;
    const requestedName = window.prompt("Име на файла:", defaultBaseName) ?? "";
    const cleanBaseName = (requestedName.trim() || defaultBaseName).replace(/[\\/:*?"<>|]/g, "-");
    const filename = `${cleanBaseName}.txt`;
    const blob = new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const openSchedulerSettings = async () => {
    if (!clubId) return;
    setSchedulerSettingsError("");
    setSchedulerSettingsLoading(true);
    setSchedulerSettingsOpen(true);
    try {
      const search = new URLSearchParams();
      if (selectedTeamGroup !== null) {
        search.set("teamGroup", String(selectedTeamGroup));
      }
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/scheduler${search.size ? `?${search.toString()}` : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешно зареждане на графика.");
      }
      const payload = await response.json();
      setSchedulerForm({
        reminderDay: String(payload.reminderDay ?? 25),
        overdueDay: String(payload.overdueDay ?? 1),
        reminderHour: String(payload.reminderHour ?? 10),
        reminderMinute: String(payload.reminderMinute ?? 0),
        overdueHour: String(payload.overdueHour ?? 10),
        overdueMinute: String(payload.overdueMinute ?? 0),
        trainingDates: Array.isArray(payload.trainingDates)
          ? payload.trainingDates
              .map((value: unknown) => String(value ?? "").trim())
              .filter((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value))
              .sort((a: string, b: string) => a.localeCompare(b))
          : [],
      });
    } catch (error) {
      setSchedulerSettingsError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setSchedulerSettingsLoading(false);
    }
  };

  const loadTrainingScheduleGroups = async (): Promise<TrainingScheduleGroup[]> => {
    if (!clubId) return [];
    setTrainingScheduleGroupsLoading(true);
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Неуспешно зареждане на тренировъчните групи.");
      }
      const payload: unknown = await response.json();
      const groups = Array.isArray(payload)
        ? payload.map((item) => {
          const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
          const teamGroups = Array.isArray(raw.teamGroups)
            ? raw.teamGroups
                .map((value) => Number.parseInt(String(value), 10))
                .filter((value) => Number.isInteger(value))
                .sort((a, b) => a - b)
            : [];
          const trainingDates = Array.isArray(raw.trainingDates)
            ? raw.trainingDates
                .map((value) => String(value ?? "").trim())
                .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
                .sort((a, b) => a.localeCompare(b))
            : [];
          return {
            id: String(raw.id ?? ""),
            name: String(raw.name ?? "").trim(),
            teamGroups,
            trainingDates,
          } satisfies TrainingScheduleGroup;
        }).filter((group) => group.id && group.teamGroups.length >= 2)
        : [];
      setTrainingScheduleGroups(groups);
      setSelectedTrainingGroupId((prev) => {
        if (prev && groups.some((group) => group.id === prev)) {
          return prev;
        }
        return groups[0]?.id ?? "";
      });
      return groups;
    } catch {
      setTrainingScheduleGroups([]);
      setSelectedTrainingGroupId("");
      return [];
    } finally {
      setTrainingScheduleGroupsLoading(false);
    }
  };

  const openTrainingGroupCreateModal = () => {
    setTrainingGroupCreateError("");
    setTrainingGroupCreateName("");
    setTrainingGroupCreateGroups([]);
    setTrainingGroupCreateOpen(true);
  };

  const openTrainingGroupEditModal = (groupId: string) => {
    const group = trainingScheduleGroups.find((item) => item.id === groupId);
    if (!group) {
      setTrainingAttendanceError("Сборният отбор не е намерен.");
      return;
    }
    setTrainingGroupEditError("");
    setTrainingGroupEditId(group.id);
    setTrainingGroupEditName(group.name);
    setTrainingGroupEditGroups(group.teamGroups.map((value) => String(value)));
    setTrainingGroupEditOpen(true);
  };

  const saveTrainingGroupFromModal = async () => {
    if (!clubId || trainingGroupCreateSaving) return;
    setTrainingGroupCreateSaving(true);
    setTrainingGroupCreateError("");
    try {
      const selectedGroups = trainingGroupCreateGroups
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value));
      if (selectedGroups.length < 2) {
        throw new Error("Изберете поне 2 набора.");
      }

      const defaultName = selectedGroups.map((group) => String(group)).join("/");
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trainingGroupCreateName.trim() || defaultName,
          teamGroups: selectedGroups,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешно създаване на сборен отбор.");
      }

      setTrainingGroupCreateOpen(false);
      await loadTrainingScheduleGroups();
    } catch (error) {
      setTrainingGroupCreateError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingGroupCreateSaving(false);
    }
  };

  const saveTrainingGroupEditFromModal = async () => {
    if (!clubId || !trainingGroupEditId || trainingGroupEditSaving) return;
    setTrainingGroupEditSaving(true);
    setTrainingGroupEditError("");
    try {
      const selectedGroups = trainingGroupEditGroups
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value));
      if (selectedGroups.length < 2) {
        throw new Error("Изберете поне 2 набора.");
      }

      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups/${encodeURIComponent(trainingGroupEditId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trainingGroupEditName.trim(),
            teamGroups: selectedGroups,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешна редакция на сборния отбор.");
      }

      setTrainingGroupEditOpen(false);
      const refreshedGroups = await loadTrainingScheduleGroups();
      if (trainingAttendanceView === "trainingGroups") {
        const hasSelected = refreshedGroups.some((group) => group.id === trainingGroupEditId);
        if (hasSelected) {
          setSelectedTrainingGroupId(trainingGroupEditId);
          await fetchTrainingAttendance(undefined, undefined, trainingGroupEditId, "trainingGroups");
        } else {
          const fallbackId = refreshedGroups[0]?.id ?? "";
          setSelectedTrainingGroupId(fallbackId);
          if (fallbackId) {
            await fetchTrainingAttendance(undefined, undefined, fallbackId, "trainingGroups");
          } else {
            setTrainingAttendancePlayers([]);
            setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
            setTrainingUpcomingDates([]);
            setTrainingAttendanceDate("");
          }
        }
      }
    } catch (error) {
      setTrainingGroupEditError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingGroupEditSaving(false);
    }
  };

  const deleteSelectedTrainingGroup = async () => {
    if (!clubId || !selectedTrainingGroupId || trainingGroupDeleteSaving) return;

    setTrainingGroupDeleteSaving(true);
    setTrainingAttendanceError("");
    try {
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups/${encodeURIComponent(selectedTrainingGroupId)}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешно изтриване на сборния отбор.");
      }

      setTrainingDayDetailsOpen(false);
      setTrainingBulkNoteOpen(false);
      setTrainingDaysEditorOpen(false);
      setTrainingDaysEditorError("");
      setTrainingNoteTargetDates([]);
      const refreshedGroups = await loadTrainingScheduleGroups();
      const fallbackId = refreshedGroups[0]?.id ?? "";
      setSelectedTrainingGroupId(fallbackId);
      if (trainingAttendanceView === "trainingGroups") {
        if (fallbackId) {
          await fetchTrainingAttendance(undefined, undefined, fallbackId, "trainingGroups");
        } else {
          setTrainingAttendancePlayers([]);
          setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
          setTrainingUpcomingDates([]);
          setTrainingAttendanceDate("");
        }
      }
    } catch (error) {
      setTrainingAttendanceError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingGroupDeleteSaving(false);
      setTrainingGroupDeleteConfirmOpen(false);
    }
  };

  const openTrainingDaysEditor = async (mode: "teamGroup" | "createGroup" | "trainingGroup" = "teamGroup") => {
    if (!clubId) return;
    if (trainingDaysEditorOpen) {
      setTrainingDaysEditorOpen(false);
      setTrainingDaysEditorError("");
      return;
    }

    setTrainingDaysEditorMode(mode);
    setTrainingDaysEditorGroups([]);
    setTrainingDaysEditorGroupName("");
    setTrainingDaysEditorCreateOpen(true);
    setTrainingDaysEditorError("");
    setTrainingDaysInitialDates([]);
    setTrainingDaysEditorLoading(true);
    const loadedGroups = await loadTrainingScheduleGroups();
    try {
      if (mode === "trainingGroup") {
        const resolvedGroup =
          loadedGroups.find((group) => group.id === selectedTrainingGroupId) ??
          trainingScheduleGroups.find((group) => group.id === selectedTrainingGroupId) ??
          null;
        if (!resolvedGroup) {
          throw new Error("Изберете сборен отбор.");
        }
        const nextWindowDates = [...resolvedGroup.trainingDates]
          .map((value) => String(value ?? "").trim())
          .filter((value) => schedulerCalendarDateSet.has(value))
          .sort((a, b) => a.localeCompare(b));
        setSchedulerForm((prev) => ({
          ...prev,
          trainingDates: nextWindowDates,
        }));
        setTrainingDaysInitialDates(nextWindowDates);
        setTrainingDaysEditorOpen(true);
        return;
      }

      const search = new URLSearchParams();
      if (selectedTeamGroup !== null) {
        search.set("teamGroup", String(selectedTeamGroup));
      }
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/scheduler${search.size ? `?${search.toString()}` : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешно зареждане на графика.");
      }
      const payload = await response.json();
      const resolvedTrainingDates =
        mode === "createGroup"
          ? []
          : Array.isArray(payload.trainingDates)
            ? payload.trainingDates
                .map((value: unknown) => String(value ?? "").trim())
                .filter((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value))
                .sort((a: string, b: string) => a.localeCompare(b))
            : [];
      setSchedulerForm({
        reminderDay: String(payload.reminderDay ?? 25),
        overdueDay: String(payload.overdueDay ?? 1),
        reminderHour: String(payload.reminderHour ?? 10),
        reminderMinute: String(payload.reminderMinute ?? 0),
        overdueHour: String(payload.overdueHour ?? 10),
        overdueMinute: String(payload.overdueMinute ?? 0),
        trainingDates: resolvedTrainingDates,
      });
      setTrainingDaysInitialDates(resolvedTrainingDates);
      setTrainingDaysEditorOpen(true);
    } catch (error) {
      setTrainingDaysEditorError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingDaysEditorLoading(false);
    }
  };

  const executeTeamGroupTrainingDaysSave = async (affectedTrainingGroupsSnapshot: Array<{ id: string; name: string }>) => {
    const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/scheduler`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderDay: Number.parseInt(schedulerForm.reminderDay, 10),
        overdueDay: Number.parseInt(schedulerForm.overdueDay, 10),
        reminderHour: Number.parseInt(schedulerForm.reminderHour, 10),
        reminderMinute: Number.parseInt(schedulerForm.reminderMinute, 10),
        overdueHour: Number.parseInt(schedulerForm.overdueHour, 10),
        overdueMinute: Number.parseInt(schedulerForm.overdueMinute, 10),
        trainingDates: schedulerForm.trainingDates,
        teamGroup: selectedTeamGroup,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || "Неуспешно запазване на тренировъчните дни.");
    }

    setTrainingDaysEditorCreateOpen(false);
    setTrainingDaysEditorGroupName("");
    setTrainingDaysEditorGroups([]);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysSuccessMessage(
      schedulerForm.trainingDates.length > 1
        ? `Промените по графика са изпратени успешно за ${schedulerForm.trainingDates.length} дни.`
        : "Промените по графика са изпратени успешно.",
    );
    setTrainingDaysSuccessOpen(true);
    const refreshedGroups = await loadTrainingScheduleGroups();
    await fetchTrainingAttendance(trainingAttendanceDate);
    if (affectedTrainingGroupsSnapshot.length > 0) {
      const firstExisting =
        refreshedGroups.find((group) => affectedTrainingGroupsSnapshot.some((item) => item.id === group.id)) ?? null;
      if (firstExisting) {
        setPostTeamGroupSavePromptGroupId(firstExisting.id);
        setPostTeamGroupSavePromptGroupName(firstExisting.name);
        setPostTeamGroupSavePromptOpen(true);
      }
    }
  };

  const saveTrainingDaysFromTrainingModal = async () => {
    if (!clubId || trainingDaysEditorSaving) return;
    setTrainingDaysEditorSaving(true);
    setTrainingDaysEditorError("");
    try {
      const affectedTrainingGroupsSnapshot = selectedTeamGroupLinkedTrainingGroups.map((group) => ({
        id: group.id,
        name: group.name,
      }));
      if (trainingDaysEditorMode === "trainingGroup") {
        const nextTrainingDates = schedulerForm.trainingDates
          .map((value) => String(value ?? "").trim())
          .filter((value) => schedulerCalendarDateSet.has(value))
          .sort((a, b) => a.localeCompare(b));
        if (nextTrainingDates.join("|") === normalizedTrainingDaysInitial.join("|")) {
          throw new Error("Графикът е същият като предишния.");
        }
        const groupResponse = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups/${encodeURIComponent(selectedTrainingGroupId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trainingDates: nextTrainingDates,
            }),
          },
        );
        if (!groupResponse.ok) {
          const payload = await groupResponse.json().catch(() => ({}));
          throw new Error(payload?.error || "Неуспешно запазване на тренировъчните дни.");
        }
        setTrainingDaysEditorCreateOpen(false);
        setTrainingDaysEditorGroupName("");
        setTrainingDaysEditorGroups([]);
        await loadTrainingScheduleGroups();
        await fetchTrainingAttendance(trainingAttendanceDate);
        setTrainingDaysEditorOpen(false);
        setTrainingDaysSuccessMessage(
          nextTrainingDates.length > 1
            ? `Промените по графика са изпратени успешно за ${nextTrainingDates.length} дни.`
            : "Промените по графика са изпратени успешно.",
        );
        setTrainingDaysSuccessOpen(true);
        return;
      }

      if (normalizedTrainingDaysSelection.join("|") === normalizedTrainingDaysInitial.join("|")) {
        throw new Error("Графикът е същият като предишния.");
      }
      if (selectedTeamGroupLinkedTrainingGroups.length > 0) {
        setPendingTeamGroupWarningGroups(affectedTrainingGroupsSnapshot);
        setTeamGroupWarningModalOpen(true);
        return;
      }
      await executeTeamGroupTrainingDaysSave(affectedTrainingGroupsSnapshot);
    } catch (error) {
      setTrainingDaysEditorError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingDaysEditorSaving(false);
    }
  };

  const saveTrainingDaysForSelectedGroups = async () => {
    if (!clubId || trainingDaysEditorSaving) return;
    setTrainingDaysEditorSaving(true);
    setTrainingDaysEditorError("");
    try {
      const selectedGroups = trainingDaysEditorGroups
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value));
      if (selectedGroups.length < 2) {
        throw new Error("Изберете поне 2 набора.");
      }
      const defaultName = selectedGroups.map((group) => String(group)).join("/");
      const createResponse = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trainingDaysEditorGroupName.trim() || defaultName,
          teamGroups: selectedGroups,
        }),
      });
      if (!createResponse.ok) {
        const payload = await createResponse.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешно създаване на сборен отбор.");
      }
      setTrainingDaysEditorOpen(false);
      await fetchTrainingAttendance(trainingAttendanceDate);
    } catch (error) {
      setTrainingDaysEditorError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingDaysEditorSaving(false);
    }
  };

  const saveSchedulerSettings = async () => {
    if (!clubId || schedulerSettingsSaving) return;
    setSchedulerSettingsSaving(true);
    setSchedulerSettingsError("");
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/scheduler`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderDay: Number.parseInt(schedulerForm.reminderDay, 10),
          overdueDay: Number.parseInt(schedulerForm.overdueDay, 10),
          reminderHour: Number.parseInt(schedulerForm.reminderHour, 10),
          reminderMinute: Number.parseInt(schedulerForm.reminderMinute, 10),
          overdueHour: Number.parseInt(schedulerForm.overdueHour, 10),
          overdueMinute: Number.parseInt(schedulerForm.overdueMinute, 10),
          trainingDates: schedulerForm.trainingDates,
          teamGroup: selectedTeamGroup,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешно запазване на графика.");
      }
      setSchedulerSettingsOpen(false);
    } catch (error) {
      setSchedulerSettingsError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setSchedulerSettingsSaving(false);
    }
  };

  const toggleTrainingDate = (date: string) => {
    setSchedulerForm((prev) => {
      const hasDate = prev.trainingDates.includes(date);
      const nextDates = hasDate
        ? prev.trainingDates.filter((value) => value !== date)
        : [...prev.trainingDates, date].sort((a, b) => a.localeCompare(b));
      return {
        ...prev,
        trainingDates: nextDates,
      };
    });
  };

  const toggleTrainingNoteTargetDate = (date: string) => {
    setTrainingNoteTargetDates((prev) => {
      const hasDate = prev.includes(date);
      if (hasDate) {
        return prev.filter((value) => value !== date);
      }
      return [...prev, date].sort((a, b) => a.localeCompare(b));
    });
  };

  const fetchTrainingAttendance = async (
    date?: string,
    groupScopeOverride?: string,
    trainingGroupIdOverride?: string,
    viewOverride?: "teamGroup" | "trainingGroups",
  ) => {
    if (!clubId) return;
    const resolvedView = viewOverride ?? trainingAttendanceView;
    const teamGroupFilter =
      resolvedView === "teamGroup"
        ? parseSelectedTeamGroup(groupScopeOverride ?? trainingGroupScope)
        : null;
    const trainingGroupFilter =
      resolvedView === "trainingGroups"
        ? (trainingGroupIdOverride ?? selectedTrainingGroupId).trim()
        : "";
    setTrainingAttendanceLoading(true);
    setTrainingAttendanceError("");
    try {
      const search = new URLSearchParams();
      if (date) {
        search.set("date", date);
      }
      if (teamGroupFilter !== null) {
        search.set("teamGroup", String(teamGroupFilter));
      }
      if (trainingGroupFilter) {
        search.set("trainingGroupId", trainingGroupFilter);
      }
      const query = search.size ? `?${search.toString()}` : "";
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance${query}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Неуспешно зареждане на присъствие.",
        );
      }

      const payload = await response.json();
      const players = Array.isArray(payload?.players)
        ? payload.players.map((item: unknown) => {
            const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
            return {
              id: String(raw.id ?? ""),
              fullName: String(raw.fullName ?? ""),
              teamGroup: typeof raw.teamGroup === "number" ? raw.teamGroup : null,
              cardCode: raw.cardCode ? String(raw.cardCode) : null,
              optedOut: Boolean(raw.optedOut),
            } satisfies TrainingAttendancePlayer;
          })
        : [];
      const upcomingDates = Array.isArray(payload?.upcomingDates)
        ? payload.upcomingDates
            .map((item: unknown) => {
              const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
              const rawStats =
                typeof raw.stats === "object" && raw.stats !== null
                  ? (raw.stats as Record<string, unknown>)
                  : {};
              return {
                date: String(raw.date ?? ""),
                weekday: Number(raw.weekday ?? 0),
                stats: {
                  total: Number(rawStats.total ?? 0),
                  attending: Number(rawStats.attending ?? 0),
                  optedOut: Number(rawStats.optedOut ?? 0),
                },
              };
            })
            .filter((item: TrainingUpcomingDateItem) => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
        : [];

      const resolvedDate = String(payload?.trainingDate ?? date ?? "");
      const resolvedScopeKey =
        resolvedView === "trainingGroups"
          ? `trainingGroup:${trainingGroupFilter || "-"}`
          : `teamGroup:${teamGroupFilter === null ? "all" : String(teamGroupFilter)}`;
      setTrainingAttendanceDate(resolvedDate);
      setTrainingAttendancePlayers(players);
      setTrainingAttendanceStats({
        total: Number(payload?.stats?.total ?? players.length),
        attending: Number(
          payload?.stats?.attending ??
            players.filter((player: TrainingAttendancePlayer) => !player.optedOut).length,
        ),
        optedOut: Number(
          payload?.stats?.optedOut ??
            players.filter((player: TrainingAttendancePlayer) => player.optedOut).length,
        ),
      });
      setTrainingUpcomingDates(upcomingDates);
      setTrainingNote(typeof payload?.note === "string" ? payload.note : "");
      if (resolvedDate) {
        setTrainingNotesByDate((prev) => ({
          ...prev,
          [`${resolvedScopeKey}|${resolvedDate}`]: typeof payload?.note === "string" ? payload.note : "",
        }));
      }
      setTrainingNoteTargetDates((prev) => {
        const allowedSet = new Set(upcomingDates.map((item: TrainingUpcomingDateItem) => item.date));
        const filtered = prev.filter((item) => allowedSet.has(item));
        if (filtered.length > 0) {
          return filtered;
        }
        return resolvedDate ? [resolvedDate] : [];
      });
    } catch (error) {
      setTrainingAttendancePlayers([]);
      setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
      setTrainingUpcomingDates([]);
      setTrainingNote("");
      setTrainingNoteTargetDates([]);
      setTrainingAttendanceError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingAttendanceLoading(false);
    }
  };

  const openTrainingAttendance = async () => {
    if (!clubId) return;
    setTrainingAttendanceOpen(true);
    setPostTeamGroupSavePromptOpen(false);
    setTrainingAttendanceView("teamGroup");
    setSelectedTrainingGroupId("");
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingNoteTargetDates([]);
    await Promise.all([
      fetchTrainingAttendance(undefined, trainingGroupScope),
      loadTrainingScheduleGroups(),
    ]);
  };

  const handleTrainingGroupScopeChange = async (nextScope: string) => {
    setTrainingGroupScope(nextScope);
    if (!trainingAttendanceOpen) {
      return;
    }
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingAttendanceError("");
    setTrainingNoteTargetDates([]);
    await fetchTrainingAttendance(undefined, nextScope);
  };

  const handleTrainingAttendanceViewChange = async (nextView: "teamGroup" | "trainingGroups") => {
    setTrainingAttendanceView(nextView);
    if (!trainingAttendanceOpen) {
      return;
    }
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingAttendanceError("");
    setTrainingNoteTargetDates([]);

    if (nextView === "teamGroup") {
      await fetchTrainingAttendance(undefined, trainingGroupScope, undefined, "teamGroup");
      return;
    }

    const groups = trainingScheduleGroups.length > 0 ? trainingScheduleGroups : await loadTrainingScheduleGroups();
    const resolvedGroupId =
      selectedTrainingGroupId && groups.some((group) => group.id === selectedTrainingGroupId)
        ? selectedTrainingGroupId
        : (groups[0]?.id ?? "");
    setSelectedTrainingGroupId(resolvedGroupId);
    if (!resolvedGroupId) {
      setTrainingAttendancePlayers([]);
      setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
      setTrainingUpcomingDates([]);
      setTrainingAttendanceDate("");
      return;
    }
    await fetchTrainingAttendance(undefined, undefined, resolvedGroupId, "trainingGroups");
  };

  const handleSelectedTrainingGroupChange = async (nextGroupId: string) => {
    setSelectedTrainingGroupId(nextGroupId);
    if (!trainingAttendanceOpen || trainingAttendanceView !== "trainingGroups") {
      return;
    }
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingAttendanceError("");
    setTrainingNoteTargetDates([]);
    await fetchTrainingAttendance(undefined, undefined, nextGroupId, "trainingGroups");
  };

  const openTrainingDaysEditorForCurrentScope = async () => {
    if (trainingAttendanceView === "trainingGroups") {
      if (!selectedTrainingGroupId) {
        setTrainingAttendanceError("Изберете сборен отбор.");
        return;
      }
      await openTrainingDaysEditor("trainingGroup");
      return;
    }
    await openTrainingDaysEditor("teamGroup");
  };

  const handlePostTeamGroupSavePromptConfirm = async () => {
    setPostTeamGroupSavePromptOpen(false);
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingAttendanceError("");
    setTrainingNoteTargetDates([]);
    setTrainingAttendanceView("trainingGroups");
    if (postTeamGroupSavePromptGroupId) {
      setSelectedTrainingGroupId(postTeamGroupSavePromptGroupId);
      await fetchTrainingAttendance(undefined, undefined, postTeamGroupSavePromptGroupId, "trainingGroups");
      openTrainingGroupEditModal(postTeamGroupSavePromptGroupId);
    }
  };

  const handleTeamGroupWarningCancel = () => {
    setTeamGroupWarningModalOpen(false);
    setPendingTeamGroupWarningGroups([]);
  };

  const handleTeamGroupWarningConfirm = async () => {
    const snapshot = [...pendingTeamGroupWarningGroups];
    setTeamGroupWarningModalOpen(false);
    setPendingTeamGroupWarningGroups([]);
    if (snapshot.length === 0) {
      return;
    }

    setTrainingDaysEditorSaving(true);
    setTrainingDaysEditorError("");
    try {
      await executeTeamGroupTrainingDaysSave(snapshot);
    } catch (error) {
      setTrainingDaysEditorError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingDaysEditorSaving(false);
    }
  };

  const openTrainingDayDetails = async (date: string) => {
    setTrainingDayDetailsOpening(true);
    setTrainingAttendanceDate(date);
    try {
      await fetchTrainingAttendance(date);
      setTrainingDayDetailsOpen(true);
    } finally {
      setTrainingDayDetailsOpening(false);
    }
  };

  const saveTrainingNote = async () => {
    if (!clubId || trainingNoteSaving) return;
    setTrainingNoteSaving(true);
    setTrainingAttendanceError("");
    try {
      const targetDates =
        trainingNoteTargetDates.length > 0
          ? trainingNoteTargetDates
          : trainingAttendanceDate
            ? [trainingAttendanceDate]
            : [];
      if (targetDates.length === 0) {
        throw new Error("Select at least one training day for note.");
      }
      const nextNoteNormalized = trainingNote.trim();
      const teamGroupFilter =
        trainingAttendanceView === "teamGroup"
          ? selectedTeamGroup
          : null;
      const existingNotesByDate = await Promise.all(
        targetDates.map(async (targetDate) => {
          const search = new URLSearchParams({ date: targetDate });
          if (trainingAttendanceView === "trainingGroups") {
            if (selectedTrainingGroupId) {
              search.set("trainingGroupId", selectedTrainingGroupId);
            }
          } else if (teamGroupFilter !== null) {
            search.set("teamGroup", String(teamGroupFilter));
          }
          const response = await fetch(
            `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance?${search.toString()}`,
            { cache: "no-store" },
          );
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(
              typeof payload?.error === "string" && payload.error.trim()
                ? payload.error.trim()
                : "Неуспешно зареждане на текущото описание.",
            );
          }
          const payload = await response.json().catch(() => ({}));
          return {
            date: targetDate,
            note: typeof payload?.note === "string" ? payload.note.trim() : "",
          };
        }),
      );
      const datesToSave = existingNotesByDate
        .filter((item) => item.note !== nextNoteNormalized)
        .map((item) => item.date);
      if (datesToSave.length === 0) {
        throw new Error("Описанието е същото като предишното за избраната дата.");
      }

      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingDate: datesToSave[0],
          note: trainingNote,
          ...(trainingAttendanceView === "trainingGroups"
            ? { trainingGroupId: selectedTrainingGroupId || null }
            : { teamGroup: selectedTeamGroup }),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Неуспешно запазване на описание.",
        );
      }
      for (const targetDate of datesToSave.slice(1)) {
        const bulkResponse = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trainingDate: targetDate,
            note: trainingNote,
            ...(trainingAttendanceView === "trainingGroups"
              ? { trainingGroupId: selectedTrainingGroupId || null }
              : { teamGroup: selectedTeamGroup }),
          }),
        });
        if (!bulkResponse.ok) {
          const payload = await bulkResponse.json().catch(() => ({}));
          throw new Error(
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error.trim()
              : `Failed saving note for ${targetDate}.`,
          );
        }
      }
      setTrainingNotesByDate((prev) => {
        const next = { ...prev };
        for (const date of datesToSave) {
          next[`${trainingNoteScopeKey}|${date}`] = trainingNote;
        }
        return next;
      });
      await fetchTrainingAttendance();
      setTrainingBulkNoteOpen(false);
      setTrainingNoteSuccessMessage(
        datesToSave.length > 1
          ? `Промените са изпратени успешно за ${datesToSave.length} дни.`
          : "Промените са изпратени успешно.",
      );
      setTrainingNoteSuccessOpen(true);
    } catch (error) {
      setTrainingAttendanceError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingNoteSaving(false);
    }
  };

  useEffect(() => {
    if (!trainingBulkNoteOpen || !clubId) {
      setTrainingNoteComparisonLoading(false);
      return;
    }
    const missingDates = effectiveTrainingNoteTargetDates.filter(
      (date) => !Object.prototype.hasOwnProperty.call(trainingNotesByDate, `${trainingNoteScopeKey}|${date}`),
    );
    if (missingDates.length === 0) {
      setTrainingNoteComparisonLoading(false);
      return;
    }

    let cancelled = false;
    const loadMissingNotes = async () => {
      setTrainingNoteComparisonLoading(true);
      try {
        const fetched = await Promise.all(
          missingDates.map(async (targetDate) => {
            const search = new URLSearchParams({ date: targetDate });
            if (trainingAttendanceView === "trainingGroups") {
              if (selectedTrainingGroupId) {
                search.set("trainingGroupId", selectedTrainingGroupId);
              }
            } else if (trainingNoteTeamGroupFilter !== null) {
              search.set("teamGroup", String(trainingNoteTeamGroupFilter));
            }
            const response = await fetch(
              `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance?${search.toString()}`,
              { cache: "no-store" },
            );
            if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(
                typeof payload?.error === "string" && payload.error.trim()
                  ? payload.error.trim()
                  : "Неуспешно зареждане на текущото описание.",
              );
            }
            const payload = await response.json().catch(() => ({}));
            return [targetDate, typeof payload?.note === "string" ? payload.note : ""] as const;
          }),
        );
        if (cancelled) {
          return;
        }
        setTrainingNotesByDate((prev) => {
          const next = { ...prev };
          for (const [date, note] of fetched) {
            next[`${trainingNoteScopeKey}|${date}`] = note;
          }
          return next;
        });
      } catch (error) {
        if (!cancelled) {
          setTrainingAttendanceError(error instanceof Error ? error.message : "Възникна грешка.");
        }
      } finally {
        if (!cancelled) {
          setTrainingNoteComparisonLoading(false);
        }
      }
    };

    void loadMissingNotes();
    return () => {
      cancelled = true;
    };
  }, [
    trainingBulkNoteOpen,
    clubId,
    trainingAttendanceView,
    selectedTrainingGroupId,
    trainingNoteTeamGroupFilter,
    trainingNoteScopeKey,
    effectiveTrainingNoteTargetDatesKey,
    trainingNotesByDate,
  ]);

  useEffect(() => {
    if (!trainingAttendanceOpen || !clubId || !trainingAttendanceDate) {
      return;
    }

    const search = new URLSearchParams({ date: trainingAttendanceDate });
    if (trainingAttendanceView === "trainingGroups") {
      if (selectedTrainingGroupId) {
        search.set("trainingGroupId", selectedTrainingGroupId);
      }
    } else if (selectedTeamGroup !== null) {
      search.set("teamGroup", String(selectedTeamGroup));
    }
    const streamUrl =
      `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance/stream` +
      `?${search.toString()}`;
    const source = new EventSource(streamUrl, { withCredentials: true });

    const handleUpdate = () => {
      void fetchTrainingAttendance(trainingAttendanceDate);
    };

    source.addEventListener("attendance-update", handleUpdate);

    return () => {
      source.removeEventListener("attendance-update", handleUpdate);
      source.close();
    };
  }, [trainingAttendanceOpen, clubId, trainingAttendanceDate, selectedTeamGroup, trainingAttendanceView, selectedTrainingGroupId]);

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
              <div className="amp-nav-back">
                <button className="amp-back-btn" onClick={() => router.push("/admin/players")}>
                  <ArrowLeftIcon />
                  Назад към отбори
                </button>
              </div>
            )}
            <button className="amp-add-btn" onClick={() => router.push(`/admin/members/add?clubId=${encodeURIComponent(clubId)}`)}>
              <PlusIcon />
              Добави играч
            </button>
            {isAdmin && (
              <button
                className="amp-inactive-toggle-btn"
                onClick={async () => {
                  setInactiveActionError("");
                  await refreshMembersList();
                  setInactivePlayersOpen(true);
                }}
                type="button"
              >
                {"\u041f\u043e\u043a\u0430\u0436\u0438 \u043d\u0435\u0430\u043a\u0442\u0438\u0432\u043d\u0438 \u0438\u0433\u0440\u0430\u0447\u0438"}
              </button>
            )}
          </div>
          {isAdmin && clubId && (
            <div className="amp-team-actions">
              <button
                className="amp-edit-team-btn"
                onClick={() => router.push(`/admin/teams/${encodeURIComponent(clubId)}/edit`)}
                disabled={isDeletingTeam}
              >
                Редактирай отбор
              </button>
              <button
                className="amp-delete-team-btn"
                onClick={() => setIsTeamDeleteConfirmOpen(true)}
                disabled={isDeletingTeam}
                type="button"
              >
                <TrashIcon />
                {isDeletingTeam ? "Изтриване..." : "Изтрий отбор"}
              </button>
            </div>
          )}
        </div>

        <div className="amp-tools-row">
          <button className="amp-reports-btn" onClick={() => setReportsOpen(true)}>
            <ChartColumnIcon />
            Център за отчети
          </button>
          {(isAdmin || isCoach) && clubId && (
            <>
              <button className="amp-download-links-btn amp-scheduler-settings-btn" onClick={() => void openSchedulerSettings()} type="button">
                <CalendarIcon />
                {"\u0413\u0440\u0430\u0444\u0438\u043a \u0438\u0437\u0432\u0435\u0441\u0442\u0438\u044f"}
              </button>
              <button className="amp-download-links-btn amp-scheduler-settings-btn" onClick={() => void openTrainingAttendance()} type="button">
                <UsersIcon />
                {"Тренировъчен график"}
              </button>
              {isAdmin && (
                <button className="amp-download-links-btn" onClick={() => void handleDownloadMemberLinks()} type="button">
                  <DownloadIcon />
                  Изтегли линкове
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Content ── */}
        <div className="amp-content">

          {/* Group filter dropdown */}
          <label className="amp-edit-field" style={{ marginBottom: "10px", maxWidth: "320px" }}>
            <span className="amp-lbl">Набор</span>
            <select
              className="amp-edit-input"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="all">Всички ({activeMembersCount})</option>
              {groupOptions.map((g) => (
                <option key={g} value={String(g)} label={`${g} (${activeMembersByGroup[g] ?? 0})`}>
                  {g} ({activeMembersByGroup[g] ?? 0})
                </option>
              ))}
            </select>
          </label>

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
          actionMode={selectedMember.isActive ? "active" : "inactive"}
          onRequestEdit={openEditMember}
          onRequestDelete={(member) => {
            setDeleteError("");
            setMemberToDelete(member);
          }}
          onRequestReactivate={handleReactivateMember}
          onRequestPermanentDelete={(member) => {
            if (reactivatingMemberId || deletingPermanentMemberId) return;
            setInactiveActionError("");
            setMemberToPermanentDelete(member);
          }}
          isReactivating={reactivatingMemberId === selectedMember.id}
          isDeletingPermanent={deletingPermanentMemberId === selectedMember.id}
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

            <div className={`amp-modal-body${trainingDayDetailsOpening ? " amp-modal-body--loading-only" : ""}`}>
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
      {isTeamDeleteConfirmOpen && isAdmin && clubId && (
        <ConfirmDeleteTeamModal
          teamName={clubName?.trim() || "този отбор"}
          isDeleting={isDeletingTeam}
          onCancel={() => {
            if (!isDeletingTeam) {
              setIsTeamDeleteConfirmOpen(false);
            }
          }}
          onConfirm={handleDeleteTeam}
        />
      )}
      {trainingGroupDeleteConfirmOpen && (
        <ConfirmDeleteTrainingGroupModal
          groupName={
            trainingScheduleGroups.find((group) => group.id === selectedTrainingGroupId)?.name?.trim() ||
            "този сборен отбор"
          }
          isDeleting={trainingGroupDeleteSaving}
          onCancel={() => {
            if (!trainingGroupDeleteSaving) {
              setTrainingGroupDeleteConfirmOpen(false);
            }
          }}
          onConfirm={() => void deleteSelectedTrainingGroup()}
        />
      )}
      {reportsOpen && <ReportsDialog onClose={() => setReportsOpen(false)} clubId={clubId} />}
      {trainingAttendanceOpen && (
        <div
          className="amp-overlay"
          onClick={() => {
            if (!trainingNoteSaving) {
              setTrainingAttendanceOpen(false);
              setTrainingDayDetailsOpen(false);
              setTrainingDaysEditorOpen(false);
            }
          }}
        >
          <div className="amp-modal amp-modal--confirm amp-modal--training-attendance" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Текущ график</span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setTrainingAttendanceOpen(false);
                  setTrainingDayDetailsOpen(false);
                  setTrainingDaysEditorOpen(false);
                }}
                aria-label="Затвори"
                disabled={trainingNoteSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <div
                style={{
                  display: "inline-flex",
                  gap: "6px",
                  padding: "5px",
                  width: "fit-content",
                  maxWidth: "100%",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
                  margin: "0 auto 14px auto",
                }}
              >
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => void handleTrainingAttendanceViewChange("teamGroup")}
                  style={{
                    borderRadius: "999px",
                    minWidth: "120px",
                    fontWeight: 700,
                    borderColor: trainingAttendanceView === "teamGroup" ? "rgba(50,205,50,0.62)" : "rgba(255,255,255,0.2)",
                    background: trainingAttendanceView === "teamGroup"
                      ? "linear-gradient(135deg, rgba(50,205,50,0.24), rgba(50,205,50,0.12))"
                      : "rgba(255,255,255,0.04)",
                    color: trainingAttendanceView === "teamGroup" ? "#cfffcc" : "#ffffff",
                    boxShadow: trainingAttendanceView === "teamGroup" ? "0 0 18px rgba(50,205,50,0.2)" : undefined,
                  }}
                  disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDaysEditorSaving}
                >
                  Отбор
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => void handleTrainingAttendanceViewChange("trainingGroups")}
                  style={{
                    borderRadius: "999px",
                    minWidth: "150px",
                    fontWeight: 700,
                    borderColor: trainingAttendanceView === "trainingGroups" ? "rgba(50,205,50,0.62)" : "rgba(255,255,255,0.2)",
                    background: trainingAttendanceView === "trainingGroups"
                      ? "linear-gradient(135deg, rgba(50,205,50,0.24), rgba(50,205,50,0.12))"
                      : "rgba(255,255,255,0.04)",
                    color: trainingAttendanceView === "trainingGroups" ? "#cfffcc" : "#ffffff",
                    boxShadow: trainingAttendanceView === "trainingGroups" ? "0 0 18px rgba(50,205,50,0.2)" : undefined,
                  }}
                  disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDaysEditorSaving}
                >
                  Сборни отбори
                </button>
              </div>
              {trainingAttendanceView === "teamGroup" ? (
              <label className="amp-edit-field" style={{ marginBottom: "12px" }}>
                <span className="amp-lbl">Набор</span>
                <select
                  className="amp-edit-input"
                  value={trainingGroupScope}
                  onChange={(e) => void handleTrainingGroupScopeChange(e.target.value)}
                  disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDaysEditorSaving}
                >
                  <option value="all">Всички набори</option>
                  {groupOptions.map((group) => (
                    <option key={`training-scope-${group}`} value={String(group)}>
                      Набор {group}
                    </option>
                  ))}
                </select>
              </label>
              ) : (
                <div style={{ marginBottom: "12px" }}>
                  <span className="amp-lbl">Сборни отбори</span>
                  <div style={{ marginTop: "8px", marginBottom: "10px" }}>
                    <button
                      type="button"
                      className="amp-btn amp-btn--primary"
                      onClick={openTrainingGroupCreateModal}
                      disabled={trainingNoteSaving || trainingGroupCreateSaving}
                    >
                      {trainingGroupCreateSaving ? "Запазване..." : "Създай сборен отбор"}
                    </button>
                  </div>
                  {trainingScheduleGroupsLoading ? (
                    <p className="amp-empty amp-empty--modal">Зареждане...</p>
                  ) : trainingScheduleGroups.length === 0 ? (
                    <p className="amp-empty amp-empty--modal">Няма създадени сборни отбори</p>
                  ) : (
                    <>
                    <label className="amp-edit-field" style={{ marginBottom: "12px" }}>
                      <span className="amp-lbl">Сборен отбор</span>
                      <select
                        className="amp-edit-input"
                        value={selectedTrainingGroupId}
                        onChange={(e) => void handleSelectedTrainingGroupChange(e.target.value)}
                        disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDaysEditorSaving || trainingScheduleGroupsLoading}
                      >
                        {trainingScheduleGroups.map((group) => (
                          <option key={`training-group-option-${group.id}`} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="amp-training-group-actions">
                    <button
                      type="button"
                      className="amp-btn amp-btn--ghost"
                      onClick={() => openTrainingGroupEditModal(selectedTrainingGroupId)}
                      disabled={!selectedTrainingGroupId || trainingScheduleGroupsLoading || trainingGroupEditSaving || trainingGroupDeleteSaving}
                    >
                      {trainingGroupEditSaving ? "Отваряне..." : "Редактирай сборен отбор"}
                    </button>
                    <button
                      type="button"
                      className="amp-btn amp-btn--danger"
                      onClick={() => setTrainingGroupDeleteConfirmOpen(true)}
                      disabled={!selectedTrainingGroupId || trainingScheduleGroupsLoading || trainingGroupEditSaving || trainingGroupDeleteSaving}
                    >
                      {trainingGroupDeleteSaving ? "Изтриване..." : "Изтрий сборен отбор"}
                    </button>
                    </div>
                    </>
                  )}
                </div>
              )}
              {trainingDayDetailsOpening && (
                <div className="amp-modal-loading-overlay">
                  <div className="amp-loading" style={{ minHeight: 120 }}>
                    <div className="amp-spinner" />
                  </div>
                </div>
              )}
              <label className="amp-edit-field" style={{ position: "relative" }}>
                {trainingAttendanceLoading && (
                  <div className="amp-modal-loading-overlay" style={{ position: "absolute", inset: 0, zIndex: 10 }}>
                    <div className="amp-loading" style={{ minHeight: 200 }}>
                      <div className="amp-spinner" />
                      <p style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Зареждане...</p>
                    </div>
                  </div>
                )}
                <div className="amp-training-calendar amp-training-calendar--attendance">
                  {trainingAttendanceCalendarMonths.map((month) => (
                    <div key={month.key} className="amp-training-month">
                      <div className="amp-training-month-title">{month.label}</div>
                      <div className="amp-training-weekdays-row">
                        {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                          <span key={`${month.key}-${weekday}`} className="amp-training-weekday-cell">
                            {weekday}
                          </span>
                        ))}
                      </div>
                      <div className="amp-training-month-grid">
                        {month.cells.map((date, index) => {
                          if (!date) {
                            return (
                              <span
                                key={`${month.key}-empty-${index}`}
                                className="amp-training-calendar-cell amp-training-calendar-cell--empty"
                                aria-hidden="true"
                              />
                            );
                          }
                          const dayNumber = Number.parseInt(date.slice(8, 10), 10);
                          const dateData = trainingUpcomingByDate.get(date);
                          if (!dateData || !trainingUpcomingDateSet.has(date)) {
                            return (
                              <span
                                key={date}
                                className="amp-training-calendar-cell amp-training-calendar-cell--disabled"
                                aria-hidden="true"
                              >
                                <span className="amp-training-day-number">{dayNumber}</span>
                              </span>
                            );
                          }

                          const isActive = trainingAttendanceDate === date;
                          const isToday = todayIsoDate === date;
                          return (
                            <button
                              key={date}
                              type="button"
                              className={`amp-training-date-btn amp-training-date-btn--training${isActive ? " amp-training-date-btn--active" : ""}${isToday ? " amp-training-date-btn--today" : ""}`}
                              onClick={() => void openTrainingDayDetails(date)}
                              disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDayDetailsOpening}
                            >
                              <span className="amp-training-day-number">{dayNumber}</span>
                              <span className="amp-training-day-meta">
                                {dateData.stats.attending}/{dateData.stats.total}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {false && trainingDaysEditorOpen && (
                  <div className="amp-training-days-editor">
                    <div className="amp-training-days-editor-header">
                      <span className="amp-lbl">Избери тренировъчни дни (следващи 30 дни)</span>
                      <span className="amp-lbl">Избрани: {schedulerForm.trainingDates.length}</span>
                    </div>
                    <div className="amp-training-calendar">
                      {schedulerCalendarMonths.map((month) => (
                        <div key={month.key} className="amp-training-month">
                          <div className="amp-training-month-title">{month.label}</div>
                          <div className="amp-training-weekdays-row">
                            {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                              <span key={`${month.key}-${weekday}`} className="amp-training-weekday-cell">
                                {weekday}
                              </span>
                            ))}
                          </div>
                          <div className="amp-training-month-grid">
                            {month.cells.map((date, index) => {
                              if (!date) {
                                return (
                                  <span
                                    key={`${month.key}-empty-${index}`}
                                    className="amp-training-calendar-cell amp-training-calendar-cell--empty"
                                    aria-hidden="true"
                                  />
                                );
                              }
                              const dayNumber = Number.parseInt(date.slice(8, 10), 10);
                              const isSelectable = schedulerCalendarDateSet.has(date);
                              if (!isSelectable) {
                                return (
                                  <span
                                    key={date}
                                    className="amp-training-calendar-cell amp-training-calendar-cell--disabled"
                                    aria-hidden="true"
                                  >
                                    <span className="amp-training-day-number">{dayNumber}</span>
                                  </span>
                                );
                              }

                              const isSelected = schedulerForm.trainingDates.includes(date);
                              const isToday = todayIsoDate === date;
                              return (
                                <button
                                  key={date}
                                  type="button"
                                  className={`amp-training-date-btn${isSelected ? " amp-training-date-btn--active" : ""}${isToday ? " amp-training-date-btn--today" : ""}`}
                                  onClick={() => toggleTrainingDate(date)}
                                  disabled={trainingDaysEditorSaving}
                                >
                                  <span className="amp-training-day-number">{dayNumber}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {trainingDaysEditorError && <p className="amp-confirm-error">{trainingDaysEditorError}</p>}
                    <div className="amp-modal-actions amp-modal-actions--end">
                      <button
                        type="button"
                        className="amp-btn amp-btn--ghost"
                        onClick={() => setTrainingDaysEditorOpen(false)}
                        disabled={trainingDaysEditorSaving}
                      >
                        Отказ
                      </button>
                      <button
                        type="button"
                        className="amp-btn amp-btn--primary"
                        onClick={() => void saveTrainingDaysForSelectedGroups()}
                        disabled={trainingDaysEditorSaving || trainingDaysEditorLoading}
                      >
                        {trainingDaysEditorSaving ? "Запазване..." : "Запази дни"}
                      </button>
                    </div>
                  </div>
                )}
                <div className="amp-training-note-targets">
                  <button
                    type="button"
                    className="amp-btn amp-btn--ghost"
                    onClick={() => toggleTrainingNoteTargetDate(trainingAttendanceDate)}
                    disabled={trainingNoteSaving || trainingAttendanceLoading || !trainingAttendanceDate}
                  >
                    {trainingNoteTargetDates.includes(trainingAttendanceDate)
                      ? "Премахни ден от избора"
                      : "Добави ден към избора"}
                  </button>
                  <button
                    type="button"
                    className="amp-btn amp-btn--ghost"
                    onClick={() => setTrainingNoteTargetDates(trainingAttendanceDate ? [trainingAttendanceDate] : [])}
                    disabled={trainingNoteSaving || trainingAttendanceLoading}
                  >
                    Остави само текущия ден
                  </button>
                  <span className="amp-lbl">
                    Избрани дни за добавяне на описание: {trainingNoteTargetDates.length}
                  </span>
                </div>
                <textarea
                  className="amp-edit-input amp-training-note"
                  value={trainingNote}
                  onChange={(e) => setTrainingNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Добавете инструкции, сборен час, локация..."
                  disabled={trainingNoteSaving || trainingAttendanceLoading}
                />
              </label>
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => void openTrainingDaysEditorForCurrentScope()}
                  disabled={trainingNoteSaving || trainingDaysEditorSaving}
                >
                  {trainingDaysEditorLoading
                    ? "Зареждане..."
                    : trainingDaysEditorOpen
                      ? "Скрий настройка"
                      : "Насрочи тренировки"}
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  onClick={() => {
                    setTrainingNoteTargetDates(trainingAttendanceDate ? [trainingAttendanceDate] : []);
                    setTrainingBulkNoteOpen(true);
                  }}
                  disabled={trainingAttendanceLoading || trainingNoteSaving || !trainingAttendanceDate}
                >
                  {trainingNoteSaving
                    ? "Запазване..."
                    : `Добави описание`}
                </button>
              </div>
              {trainingAttendanceError && <p className="amp-confirm-error">{trainingAttendanceError}</p>}
              <div className="amp-training-table-wrap">
                {trainingAttendanceLoading ? (
                  <p className="amp-empty amp-empty--modal">Зареждане...</p>
                ) : trainingAttendancePlayers.length === 0 ? (
                  <p className="amp-empty amp-empty--modal">Няма играчи за този отбор.</p>
                ) : (
                  <table className="amp-training-table">
                    <thead>
                      <tr>
                        <th>Име</th>
                        <th>Набор</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingAttendancePlayers.map((player) => (
                        <tr key={player.id}>
                          <td>{player.fullName}</td>
                          <td>{player.teamGroup ?? "-"}</td>
                          <td>
                            <span className={player.optedOut ? "amp-training-tag amp-training-tag--out" : "amp-training-tag amp-training-tag--in"}>
                              {player.optedOut ? "Няма да присъства" : "Ще присъства"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {teamGroupWarningModalOpen && (
        <div className="amp-overlay amp-overlay--confirm" style={{ zIndex: 20000 }} onClick={handleTeamGroupWarningCancel}>
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Внимание</span>
              <button
                className="amp-modal-close"
                onClick={handleTeamGroupWarningCancel}
                aria-label="Затвори"
                disabled={trainingDaysEditorSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <p className="amp-lbl" style={{ whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                {`Набор ${selectedTeamGroup} е в сборни отбори: ${pendingTeamGroupWarningGroups.map((group) => group.name).join(", ")}. Продължаването ще го премахне от тези групи и може да се наложи да промените имената им.`}
              </p>
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={handleTeamGroupWarningCancel}
                  disabled={trainingDaysEditorSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void handleTeamGroupWarningConfirm()}
                  disabled={trainingDaysEditorSaving}
                >
                  Продължи
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {postTeamGroupSavePromptOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          style={{ zIndex: 20000 }}
          onClick={() => setPostTeamGroupSavePromptOpen(false)}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Потвърждение</span>
              <button
                className="amp-modal-close"
                onClick={() => setPostTeamGroupSavePromptOpen(false)}
                aria-label="Затвори"
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <p className="amp-lbl" style={{ whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                {`Искате ли да направите промени по сборен отбор ${postTeamGroupSavePromptGroupName}?`}
              </p>
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setPostTeamGroupSavePromptOpen(false)}
                >
                  Не
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void handlePostTeamGroupSavePromptConfirm()}
                >
                  Да
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {trainingGroupEditOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          style={{ zIndex: 20000 }}
          onClick={() => {
            if (!trainingGroupEditSaving) {
              setTrainingGroupEditOpen(false);
              setTrainingGroupEditError("");
            }
          }}
        >
          <div className="amp-modal amp-modal--confirm amp-modal--training-days-editor" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Редакция на сборен отбор</span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setTrainingGroupEditOpen(false);
                  setTrainingGroupEditError("");
                }}
                aria-label="Затвори"
                disabled={trainingGroupEditSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <label className="amp-edit-field">
                <span className="amp-lbl">Име на група</span>
                <input
                  className="amp-edit-input"
                  value={trainingGroupEditName}
                  onChange={(e) => setTrainingGroupEditName(e.target.value)}
                  placeholder={trainingGroupEditGroups.length > 0 ? trainingGroupEditGroups.join("/") : "2012/2013"}
                  disabled={trainingGroupEditSaving}
                />
              </label>
              <div className="amp-training-days-editor-header amp-training-days-editor-header--stack" style={{ marginTop: "10px" }}>
                <span className="amp-lbl">Набори за групата (минимум 2):</span>
                <div className="amp-group-check-grid">
                  {groupOptions.map((group) => {
                    const value = String(group);
                    const isChecked = trainingGroupEditGroups.includes(value);
                    return (
                      <label
                        key={`training-group-edit-${group}`}
                        className={`amp-group-check-chip${isChecked ? " is-selected" : ""}${trainingGroupEditSaving ? " is-disabled" : ""}`}
                      >
                        <input
                          className="amp-group-check-input"
                          type="checkbox"
                          checked={isChecked}
                          disabled={trainingGroupEditSaving}
                          onChange={(e) => {
                            setTrainingGroupEditGroups((prev) => {
                              if (e.target.checked) {
                                return [...new Set([...prev, value])].sort((a, b) => Number(a) - Number(b));
                              }
                              return prev.filter((item) => item !== value);
                            });
                          }}
                        />
                        <span className="amp-group-check-box" aria-hidden="true" />
                        <span className="amp-lbl amp-group-check-label">Набор {group}</span>
                      </label>
                    );
                  })}
                </div>
                <span className="amp-lbl amp-group-check-hint">
                  {trainingGroupEditGroups.length === 0
                    ? "Изберете поне 2 набора."
                    : `Избрани набори: ${trainingGroupEditGroups.join(", ")}`}
                </span>
              </div>
              {trainingGroupEditError && <p className="amp-confirm-error">{trainingGroupEditError}</p>}
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => {
                    setTrainingGroupEditOpen(false);
                    setTrainingGroupEditError("");
                  }}
                  disabled={trainingGroupEditSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveTrainingGroupEditFromModal()}
                  disabled={trainingGroupEditSaving}
                >
                  {trainingGroupEditSaving ? "Запазване..." : "Запази промените"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {trainingGroupCreateOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!trainingGroupCreateSaving) {
              setTrainingGroupCreateOpen(false);
              setTrainingGroupCreateError("");
            }
          }}
        >
          <div className="amp-modal amp-modal--confirm amp-modal--training-days-editor" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Създай сборен отбор</span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setTrainingGroupCreateOpen(false);
                  setTrainingGroupCreateError("");
                }}
                aria-label="Затвори"
                disabled={trainingGroupCreateSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <label className="amp-edit-field">
                <span className="amp-lbl">Име на група (по избор)</span>
                <input
                  className="amp-edit-input"
                  value={trainingGroupCreateName}
                  onChange={(e) => setTrainingGroupCreateName(e.target.value)}
                  placeholder={trainingGroupCreateGroups.length > 0 ? trainingGroupCreateGroups.join("/") : "2012/2013"}
                  disabled={trainingGroupCreateSaving}
                />
              </label>
              <div className="amp-training-days-editor-header amp-training-days-editor-header--stack" style={{ marginTop: "10px" }}>
                <span className="amp-lbl">Набори за групата (минимум 2):</span>
                <div className="amp-group-check-grid">
                  {groupOptions.map((group) => {
                    const value = String(group);
                    const isChecked = trainingGroupCreateGroups.includes(value);
                    return (
                      <label
                        key={`training-group-create-${group}`}
                        className={`amp-group-check-chip${isChecked ? " is-selected" : ""}${trainingGroupCreateSaving ? " is-disabled" : ""}`}
                      >
                        <input
                          className="amp-group-check-input"
                          type="checkbox"
                          checked={isChecked}
                          disabled={trainingGroupCreateSaving}
                          onChange={(e) => {
                            setTrainingGroupCreateGroups((prev) => {
                              if (e.target.checked) {
                                return [...new Set([...prev, value])].sort((a, b) => Number(a) - Number(b));
                              }
                              return prev.filter((item) => item !== value);
                            });
                          }}
                        />
                        <span className="amp-group-check-box" aria-hidden="true" />
                        <span className="amp-lbl amp-group-check-label">Набор {group}</span>
                      </label>
                    );
                  })}
                </div>
                <span className="amp-lbl amp-group-check-hint">
                  {trainingGroupCreateGroups.length === 0
                    ? "Изберете поне 2 набора."
                    : `Избрани набори: ${trainingGroupCreateGroups.join(", ")}`}
                </span>
              </div>
              {trainingGroupCreateError && <p className="amp-confirm-error">{trainingGroupCreateError}</p>}
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => {
                    setTrainingGroupCreateOpen(false);
                    setTrainingGroupCreateError("");
                  }}
                  disabled={trainingGroupCreateSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveTrainingGroupFromModal()}
                  disabled={trainingGroupCreateSaving}
                >
                  {trainingGroupCreateSaving ? "Създаване..." : "Създай сборен отбор"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {trainingDaysEditorOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!trainingDaysEditorSaving) {
              setTrainingDaysEditorOpen(false);
            }
          }}
        >
          <div className="amp-modal amp-modal--confirm amp-modal--training-days-editor" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Задай тренировъчни дни</span>
              <button
                className="amp-modal-close"
                onClick={() => setTrainingDaysEditorOpen(false)}
                aria-label="Затвори"
                disabled={trainingDaysEditorSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body" style={{ position: "relative" }}>
              {trainingDaysEditorSaving && (
                <div className="amp-modal-loading-overlay" style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(16,16,20,0.9)" }}>
                  <div className="amp-loading" style={{ minHeight: 200 }}>
                    <div className="amp-spinner" />
                    <p style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Запазване...</p>
                  </div>
                </div>
              )}
              {false && !trainingDaysEditorCreateOpen && (
                <>
                  <div className="amp-training-days-editor-header" style={{ alignItems: "flex-start", flexDirection: "column", gap: "8px" }}>
                    <span className="amp-lbl">Създадени сборни отбори</span>
                    {trainingScheduleGroupsLoading ? (
                      <p className="amp-empty amp-empty--modal">Зареждане...</p>
                    ) : trainingScheduleGroups.length === 0 ? (
                      <p className="amp-empty amp-empty--modal">Няма създадени сборни отбори</p>
                    ) : (
                      <div style={{ display: "grid", gap: "8px", width: "100%" }}>
                        {trainingScheduleGroups.map((group) => (
                          <div key={group.id} className="amp-card-row" style={{ padding: "10px 12px" }}>
                            <div style={{ fontWeight: 700 }}>{group.name}</div>
                            <div style={{ opacity: 0.8 }}>Набори: {group.teamGroups.join(", ")}</div>
                            <div style={{ opacity: 0.8 }}>Дати: {group.trainingDates.length}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="amp-modal-actions amp-modal-actions--end">
                    <button
                      type="button"
                      className="amp-btn amp-btn--ghost"
                      onClick={() => setTrainingDaysEditorOpen(false)}
                      disabled={trainingDaysEditorSaving}
                    >
                      Затвори
                    </button>
                    <button
                      type="button"
                      className="amp-btn amp-btn--primary"
                      onClick={() => {
                        setTrainingDaysEditorCreateOpen(true);
                        setTrainingDaysEditorError("");
                      }}
                      disabled={trainingDaysEditorSaving || trainingDaysEditorLoading}
                    >
                      Създай сборен отбор
                    </button>
                  </div>
                </>
              )}
              {trainingDaysEditorCreateOpen && (
              <>
              <div className="amp-training-days-editor-header">
                <span className="amp-lbl">
                  {trainingDaysEditorMode === "createGroup"
                    ? "Създай сборен отбор"
                    : trainingDaysEditorMode === "trainingGroup"
                      ? "Задай тренировъчни дни за сборен отбор"
                    : "Избери тренировъчни дни (следващи 30 дни)"}
                </span>
                {trainingDaysEditorMode !== "createGroup" && (
                  <span className="amp-lbl">Избрани: {schedulerForm.trainingDates.length}</span>
                )}
              </div>
              <div className="amp-training-days-editor-header" style={{ marginTop: "8px", justifyContent: "space-between", gap: "10px" }}>
                <span
                  className="amp-lbl"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: "999px",
                    border: "1px solid rgba(50,205,50,0.45)",
                    background: "rgba(50,205,50,0.16)",
                    color: "#d7ffd7",
                    fontWeight: 700,
                  }}
                >
                  {trainingDaysEditorMode === "trainingGroup"
                    ? `Сборен отбор: ${selectedTrainingGroup?.name ?? "-"}`
                    : selectedTeamGroup === null
                      ? "Набор: Всички"
                      : `Набор: ${selectedTeamGroup}`}
                </span>
                <span>
                  {trainingDaysEditorMode === "trainingGroup"
                    ? `Тези промени ще се запазят за сборен отбор ${selectedTrainingGroup?.name ?? "-"}.`
                    : selectedTeamGroup === null
                      ? "Тези промени ще се запазят за всички набори."
                      : `Тези промени ще се запазят за набор ${selectedTeamGroup}.`}
                </span>
              </div>
              {trainingDaysEditorMode === "teamGroup" && selectedTeamGroupLinkedTrainingGroups.length > 0 && (
                <p className="amp-confirm-error" style={{ marginTop: "8px" }}>
                  {`Внимание: набор ${selectedTeamGroup} участва в сборни отбори (${selectedTeamGroupLinkedTrainingGroups.map((group) => group.name).join(", ")}). При запазване ще бъде премахнат от тях и може да се наложи преименуване на групите.`}
                </p>
              )}
              {trainingDaysEditorMode === "createGroup" && (
              <>
              <label className="amp-edit-field" style={{ marginTop: "8px" }}>
                <span className="amp-lbl">Име на група (по избор)</span>
                <input
                  className="amp-edit-input"
                  value={trainingDaysEditorGroupName}
                  onChange={(e) => setTrainingDaysEditorGroupName(e.target.value)}
                  placeholder={trainingDaysEditorGroups.length > 0 ? trainingDaysEditorGroups.map((group) => String(group)).join("/") : "2012/2013"}
                  disabled={trainingDaysEditorSaving}
                />
              </label>
              <div className="amp-training-days-editor-header" style={{ marginTop: "8px", alignItems: "flex-start", flexDirection: "column", gap: "8px" }}>
                <span className="amp-lbl">Набори за прилагане (може повече от един):</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {groupOptions.map((group) => {
                    const value = String(group);
                    const isChecked = trainingDaysEditorGroups.includes(value);
                    return (
                      <label
                        key={`training-days-group-${group}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          border: "1px solid rgba(255,255,255,0.22)",
                          background: isChecked ? "rgba(50,205,50,0.16)" : "rgba(255,255,255,0.06)",
                          cursor: trainingDaysEditorSaving ? "default" : "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={trainingDaysEditorSaving}
                          onChange={(e) => {
                            setTrainingDaysEditorGroups((prev) => {
                              if (e.target.checked) {
                                return [...new Set([...prev, value])].sort((a, b) => Number(a) - Number(b));
                              }
                              return prev.filter((item) => item !== value);
                            });
                          }}
                        />
                        <span className="amp-lbl">Набор {group}</span>
                      </label>
                    );
                  })}
                </div>
                <span className="amp-lbl" style={{ opacity: 0.8 }}>
                  {trainingDaysEditorGroups.length === 0
                    ? "Изберете поне 2 набора."
                    : `Избрани набори: ${trainingDaysEditorGroups.join(", ")}`}
                </span>
              </div>
              </>
              )}
              {trainingDaysEditorMode !== "createGroup" && (
              <div className="amp-training-calendar">
                {schedulerCalendarMonths.map((month) => (
                  <div key={month.key} className="amp-training-month">
                    <div className="amp-training-month-title">{month.label}</div>
                    <div className="amp-training-weekdays-row">
                      {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                        <span key={`${month.key}-${weekday}`} className="amp-training-weekday-cell">
                          {weekday}
                        </span>
                      ))}
                    </div>
                    <div className="amp-training-month-grid">
                      {month.cells.map((date, index) => {
                        if (!date) {
                          return (
                            <span
                              key={`${month.key}-empty-${index}`}
                              className="amp-training-calendar-cell amp-training-calendar-cell--empty"
                              aria-hidden="true"
                            />
                          );
                        }
                        const dayNumber = Number.parseInt(date.slice(8, 10), 10);
                        const isSelectable = schedulerCalendarDateSet.has(date);
                        if (!isSelectable) {
                          return (
                            <span
                              key={date}
                              className="amp-training-calendar-cell amp-training-calendar-cell--disabled"
                              aria-hidden="true"
                            >
                              <span className="amp-training-day-number">{dayNumber}</span>
                            </span>
                          );
                        }

                        const isSelected = schedulerForm.trainingDates.includes(date);
                        const isToday = todayIsoDate === date;
                        return (
                          <button
                            key={date}
                            type="button"
                            className={`amp-training-date-btn${isSelected ? " amp-training-date-btn--active" : ""}${isToday ? " amp-training-date-btn--today" : ""}`}
                            onClick={() => toggleTrainingDate(date)}
                            disabled={trainingDaysEditorSaving}
                          >
                            <span className="amp-training-day-number">{dayNumber}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              )}
              {trainingDaysEditorError && <p className="amp-confirm-error">{trainingDaysEditorError}</p>}
              {isTrainingDaysScheduleUnchanged && !trainingDaysEditorError && (
                <p className="amp-confirm-error">Графикът е същият като предишния.</p>
              )}
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => {
                    setTrainingDaysEditorOpen(false);
                    setTrainingDaysEditorCreateOpen(false);
                    setTrainingDaysEditorError("");
                  }}
                  disabled={trainingDaysEditorSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void (trainingDaysEditorMode === "createGroup" ? saveTrainingDaysForSelectedGroups() : saveTrainingDaysFromTrainingModal())}
                  disabled={
                    trainingDaysEditorSaving ||
                    trainingDaysEditorLoading ||
                    (trainingDaysEditorMode !== "createGroup" && isTrainingDaysScheduleUnchanged)
                  }
                >
                  {trainingDaysEditorSaving
                    ? "Запазване..."
                    : trainingDaysEditorMode === "createGroup"
                      ? "Създай сборен отбор"
                      : "Запази дни"}
                </button>
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      )}
      {trainingDaysSuccessOpen && (
        <div className="amp-overlay amp-overlay--confirm" onClick={() => setTrainingDaysSuccessOpen(false)}>
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Изпратено</span>
              <button
                className="amp-modal-close"
                onClick={() => setTrainingDaysSuccessOpen(false)}
                aria-label="Затвори"
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <p className="amp-confirm-text">{trainingDaysSuccessMessage}</p>
              <div className="amp-modal-actions amp-modal-actions--end">
                <button className="amp-btn amp-btn--primary" onClick={() => setTrainingDaysSuccessOpen(false)}>
                  Добре
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {trainingDayDetailsOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!trainingNoteSaving) {
              setTrainingDayDetailsOpen(false);
            }
          }}
        >
          <div className="amp-modal amp-modal--confirm amp-modal--training-day-details" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Детайли за тренировка</span>
              <button
                className="amp-modal-close"
                onClick={() => setTrainingDayDetailsOpen(false)}
                aria-label="Затвори"
                disabled={trainingNoteSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <div className="amp-training-stats">
                <span>Дата: {trainingAttendanceDate || "-"}</span>
                <span>Общо: {trainingAttendanceStats.total}</span>
                <span>Присъстват: {trainingAttendanceStats.attending}</span>
                <span>Отказали: {trainingAttendanceStats.optedOut}</span>
              </div>
              <div className="amp-edit-field">
                <span className="amp-lbl">Описание за деня</span>
                {trainingNote.trim() ? (
                  <p className="amp-val">{trainingNote}</p>
                ) : (
                  <p className="amp-val" style={{ color: "rgba(255,255,255,0.55)" }}>Няма описание.</p>
                )}
              </div>
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  className="amp-btn amp-btn--primary"
                  onClick={() => {
                    setTrainingNoteTargetDates(trainingAttendanceDate ? [trainingAttendanceDate] : []);
                    setTrainingBulkNoteOpen(true);
                  }}
                  disabled={trainingAttendanceLoading || trainingNoteSaving || !trainingAttendanceDate}
                >
                  Добави описание
                </button>
              </div>
              <div className="amp-training-table-wrap">
                {trainingAttendanceLoading ? (
                  <p className="amp-empty amp-empty--modal">Зареждане...</p>
                ) : trainingAttendancePlayers.length === 0 ? (
                  <p className="amp-empty amp-empty--modal">Няма играчи за този отбор.</p>
                ) : (
                  <table className="amp-training-table">
                    <thead>
                      <tr>
                        <th>Име</th>
                        <th>Набор</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingAttendancePlayers.map((player) => (
                        <tr key={player.id}>
                          <td>{player.fullName}</td>
                          <td>{player.teamGroup ?? "-"}</td>
                          <td>
                            <span className={player.optedOut ? "amp-training-tag amp-training-tag--out" : "amp-training-tag amp-training-tag--in"}>
                              {player.optedOut ? "Няма да присъства" : "Ще присъства"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {trainingBulkNoteOpen && (
        <div className="amp-overlay amp-overlay--confirm" onClick={() => setTrainingBulkNoteOpen(false)}>
          <div className="amp-modal amp-modal--confirm amp-modal--training-note" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Добави описание</span>
              <button
                className="amp-modal-close"
                onClick={() => setTrainingBulkNoteOpen(false)}
                aria-label="Затвори"
                disabled={trainingNoteSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body" style={{ position: "relative" }}>
              {trainingNoteSaving && (
                <div className="amp-modal-loading-overlay" style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(16,16,20,0.9)" }}>
                  <div className="amp-loading" style={{ minHeight: 200 }}>
                    <div className="amp-spinner" />
                    <p style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Запазване...</p>
                  </div>
                </div>
              )}
              <label className="amp-edit-field">
                <span className="amp-lbl">Избери дни</span>
                <div className="amp-training-calendar amp-training-calendar--attendance">
                  {trainingAttendanceCalendarMonths.map((month) => (
                    <div key={month.key} className="amp-training-month">
                      <div className="amp-training-month-title">{month.label}</div>
                      <div className="amp-training-weekdays-row">
                        {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                          <span key={`${month.key}-${weekday}`} className="amp-training-weekday-cell">
                            {weekday}
                          </span>
                        ))}
                      </div>
                      <div className="amp-training-month-grid">
                        {month.cells.map((date, index) => {
                          if (!date) {
                            return (
                              <span
                                key={`${month.key}-empty-${index}`}
                                className="amp-training-calendar-cell amp-training-calendar-cell--empty"
                                aria-hidden="true"
                              />
                            );
                          }
                          const dayNumber = Number.parseInt(date.slice(8, 10), 10);
                          const dateData = trainingUpcomingByDate.get(date);
                          if (!dateData || !trainingUpcomingDateSet.has(date)) {
                            return (
                              <span
                                key={date}
                                className="amp-training-calendar-cell amp-training-calendar-cell--disabled"
                                aria-hidden="true"
                              >
                                <span className="amp-training-day-number">{dayNumber}</span>
                              </span>
                            );
                          }

                          const isSelected = trainingNoteTargetDates.includes(date);
                          const isToday = todayIsoDate === date;
                          return (
                            <button
                              key={date}
                              type="button"
                              className={`amp-training-date-btn amp-training-date-btn--training${isSelected ? " amp-training-date-btn--selected" : ""}${isToday ? " amp-training-date-btn--today" : ""}`}
                              onClick={() => toggleTrainingNoteTargetDate(date)}
                              disabled={trainingNoteSaving}
                            >
                              <span className="amp-training-day-number">{dayNumber}</span>
                              <span className="amp-training-day-meta">
                                {dateData.stats.attending}/{dateData.stats.total}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </label>
              <label className="amp-edit-field">
                <span className="amp-lbl">Описание</span>
                <textarea
                  className="amp-edit-input amp-training-note"
                  value={trainingNote}
                  onChange={(e) => setTrainingNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Добавете инструкции, сборен час, локация..."
                  disabled={trainingNoteSaving}
                />
              </label>
              {trainingAttendanceError && <p className="amp-confirm-error">{trainingAttendanceError}</p>}
              {isTrainingNoteSameAsExisting && !trainingAttendanceError && (
                <p className="amp-confirm-error">Описанието е същото като предишното за избраната дата.</p>
              )}
              <div className="amp-modal-actions">
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setTrainingBulkNoteOpen(false)}
                  disabled={trainingNoteSaving}
                >
                  Отказ
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveTrainingNote()}
                  disabled={
                    trainingNoteSaving ||
                    trainingNoteComparisonLoading ||
                    effectiveTrainingNoteTargetDates.length === 0 ||
                    isTrainingNoteSameAsExisting
                  }
                >
                  {trainingNoteSaving
                    ? "Запазване..."
                    : `Запази описание за ${effectiveTrainingNoteTargetDates.length} ден(дни)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {trainingNoteSuccessOpen && (
        <div className="amp-overlay amp-overlay--confirm" onClick={() => setTrainingNoteSuccessOpen(false)}>
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Изпратено</span>
              <button
                className="amp-modal-close"
                onClick={() => setTrainingNoteSuccessOpen(false)}
                aria-label="Затвори"
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <p className="amp-confirm-text">{trainingNoteSuccessMessage}</p>
              <div className="amp-modal-actions amp-modal-actions--end">
                <button className="amp-btn amp-btn--primary" onClick={() => setTrainingNoteSuccessOpen(false)}>
                  Добре
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {inactivePlayersOpen && (
        <InactivePlayersModal
          members={inactiveMembers}
          isReactivating={Boolean(reactivatingMemberId)}
          reactivatingMemberId={reactivatingMemberId}
          isDeletingPermanent={Boolean(deletingPermanentMemberId)}
          deletingPermanentMemberId={deletingPermanentMemberId}
          error={inactiveActionError}
          onClose={() => {
            if (reactivatingMemberId || deletingPermanentMemberId || memberToPermanentDelete) return;
            setInactivePlayersOpen(false);
            setInactiveActionError("");
          }}
          onSelectMember={(member) => {
            if (reactivatingMemberId || deletingPermanentMemberId || memberToPermanentDelete) return;
            setInactivePlayersOpen(false);
            setSelectedMember(member);
          }}
          onReactivate={handleReactivateMember}
          onPermanentDelete={(member) => {
            if (reactivatingMemberId || deletingPermanentMemberId) return;
            setInactiveActionError("");
            setMemberToPermanentDelete(member);
          }}
        />
      )}
      {memberToPermanentDelete && (
        <ConfirmPermanentDeleteModal
          member={memberToPermanentDelete}
          isDeleting={Boolean(deletingPermanentMemberId)}
          onCancel={() => {
            if (!deletingPermanentMemberId) {
              setMemberToPermanentDelete(null);
            }
          }}
          onConfirm={handlePermanentDeleteMember}
        />
      )}
      {schedulerSettingsOpen && (
        <div
          className="amp-overlay"
          onClick={() => {
            if (!schedulerSettingsSaving) {
              setSchedulerSettingsOpen(false);
            }
          }}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Настройки на график</span>
              <button
                className="amp-modal-close"
                onClick={() => setSchedulerSettingsOpen(false)}
                aria-label="Затвори"
                disabled={schedulerSettingsSaving}
              >
                <XIcon />
              </button>
            </h2>

            <div className="amp-modal-body">
              {schedulerSettingsLoading ? (
                <p className="amp-empty amp-empty--modal">Зареждане...</p>
              ) : (
                <div className="amp-edit-grid">
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Ден месечно напомняне (1-28)</span>
                    <input
                      className="amp-edit-input"
                      inputMode="numeric"
                      value={schedulerForm.reminderDay}
                      onChange={(e) =>
                        setSchedulerForm((prev) => ({
                          ...prev,
                          reminderDay: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      disabled={schedulerSettingsSaving}
                    />
                  </label>
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Ден за начало на платежния месец</span>
                    <input
                      className="amp-edit-input"
                      inputMode="numeric"
                      value={schedulerForm.overdueDay}
                      onChange={(e) =>
                        setSchedulerForm((prev) => ({
                          ...prev,
                          overdueDay: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      disabled={schedulerSettingsSaving}
                    />
                  </label>
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Час за месечно напомняне</span>
                    <input
                      className="amp-edit-input"
                      type="time"
                      step={60}
                      value={reminderTimeValue}
                      onChange={(e) => {
                        const [hour = "0", minute = "0"] = e.target.value.split(":");
                        setSchedulerForm((prev) => ({
                          ...prev,
                          reminderHour: hour.replace(/\D/g, ""),
                          reminderMinute: minute.replace(/\D/g, ""),
                        }));
                      }}
                      disabled={schedulerSettingsSaving}
                    />
                  </label>
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Час за просрочие</span>
                    <input
                      className="amp-edit-input"
                      type="time"
                      step={60}
                      value={overdueTimeValue}
                      onChange={(e) => {
                        const [hour = "0", minute = "0"] = e.target.value.split(":");
                        setSchedulerForm((prev) => ({
                          ...prev,
                          overdueHour: hour.replace(/\D/g, ""),
                          overdueMinute: minute.replace(/\D/g, ""),
                        }));
                      }}
                      disabled={schedulerSettingsSaving}
                    />
                  </label>
                  </div>
                )}

              {schedulerSettingsError && <p className="amp-confirm-error">{schedulerSettingsError}</p>}

              <div className="amp-modal-actions">
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setSchedulerSettingsOpen(false)}
                  disabled={schedulerSettingsSaving}
                >
                  Отказ
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveSchedulerSettings()}
                  disabled={schedulerSettingsSaving || schedulerSettingsLoading}
                >
                  {schedulerSettingsSaving ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function InactivePlayersModal({
  members,
  isReactivating,
  reactivatingMemberId,
  isDeletingPermanent,
  deletingPermanentMemberId,
  error,
  onClose,
  onSelectMember,
  onReactivate,
  onPermanentDelete,
}: {
  members: Member[];
  isReactivating: boolean;
  reactivatingMemberId: string | null;
  isDeletingPermanent: boolean;
  deletingPermanentMemberId: string | null;
  error: string;
  onClose: () => void;
  onSelectMember: (member: Member) => void;
  onReactivate: (member: Member) => void;
  onPermanentDelete: (member: Member) => void;
}) {
  return (
    <div className="amp-overlay" onClick={onClose}>
      <div className="amp-modal amp-modal--inactive" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Неактивни играчи</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори">
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          {error && <p className="amp-confirm-error">{error}</p>}
          {members.length === 0 ? (
            <p className="amp-empty amp-empty--modal">Няма неактивни играчи</p>
          ) : (
            <div className="amp-cards">
              {members.map((member) => (
                <PlayerCard
                  key={member.id}
                  member={member}
                  onClick={() => onSelectMember(member)}
                  actionMode="reactivate"
                  isActionLoading={isReactivating && reactivatingMemberId === member.id}
                  onReactivate={() => onReactivate(member)}
                  isDeleteLoading={isDeletingPermanent && deletingPermanentMemberId === member.id}
                  onPermanentDelete={() => onPermanentDelete(member)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmPermanentDeleteModal({
  member,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  member: Member;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isDeleting ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди изтриване завинаги</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да изтриеш завинаги <strong>{member.fullName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            Това действие е необратимо и ще премахне играча и свързаните данни.
          </p>

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Изтриване..." : "Изтрий завинаги"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteTeamModal({
  teamName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  teamName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isDeleting ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди изтриване на отбор</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да изтриеш <strong>{teamName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            Това действие е необратимо и ще изтрие всички играчи, снимки, плащания, карти и свързани записи.
          </p>

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Изтриване..." : "Изтрий отбора"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteTrainingGroupModal({
  groupName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  groupName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isDeleting ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди изтриване на сборен отбор</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да изтриеш <strong>{groupName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            Това действие е необратимо и ще премахне сборния отбор и свързаните му тренировъчни дни.
          </p>

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Изтриване..." : "Изтрий сборния отбор"}
            </button>
          </div>
        </div>
      </div>
    </div>
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

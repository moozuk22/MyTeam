"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractUploadPathFromCloudinaryUrl } from "@/lib/cloudinaryImagePath";
import { uploadImage, validateImageFile } from "@/lib/uploadImage";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import "./page.css";

// Reports-related imports
const MONTHS = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];
const TRAINING_SELECTION_WINDOW_DAYS = 30;
const TRAINING_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TRAINING_WEEKDAY_SHORT_BG = Array.from({ length: 7 }, (_, index) =>
  new Intl.DateTimeFormat("bg-BG", { weekday: "short" })
    .format(new Date(Date.UTC(2024, 0, index + 1)))
    .replace(".", ""),
);
const TRAINING_WEEKDAY_LONG_BG = Array.from({ length: 7 }, (_, index) => {
  const day = new Intl.DateTimeFormat("bg-BG", { weekday: "long" }).format(new Date(Date.UTC(2024, 0, index + 1)));
  return day.charAt(0).toUpperCase() + day.slice(1);
});

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
  isActive?: boolean;
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
  secondReminderDay?: number | null;
  secondReminderHour?: number | null;
  secondReminderMinute?: number | null;
  overdueHour?: number;
  overdueMinute?: number;
  trainingDates?: string[];
  trainingTime?: string | null;
  trainingDateTimes?: Record<string, string> | null;
  trainingWeekdays?: number[];
  trainingWindowDays?: number;
  trainingGroupMode?: "team_group" | "custom_group";
}

interface Member {
  id: string;
  fullName: string;
  nfcTagId: string;
  status: PlayerStatus;
  teamGroup: number | null;
  coachGroupId: string | null;
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

interface CoachGroup {
  id: string;
  name: string;
  playerCount: number;
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
  trainingTime?: string | null;
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
  trainingTime?: string | null;
  trainingDateTimes?: Record<string, string> | null;
}

interface CustomTrainingGroup {
  id: string;
  name: string;
  playerIds: string[];
  trainingDates: string[];
  trainingTime?: string | null;
  trainingDateTimes?: Record<string, string> | null;
}

type TrainingTimeMode = "all" | "perDay" | "byWeekday";

interface TrainingTodaySessionItem {
  id: string;
  scopeType: "teamGroup" | "trainingGroup";
  label: string;
  teamGroups: number[];
  stats: {
    total: number;
    attending: number;
    optedOut: number;
  };
}

interface AttendanceReportPlayer {
  id: string;
  fullName: string;
  teamGroup: number | null;
  attendance: Record<string, { present: boolean; reasonCode: string | null }>;
}

interface AttendanceReportData {
  trainingDates: string[];
  players: AttendanceReportPlayer[];
}

interface MemberNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  teamGroup?: number | null;
  trainingGroups?: Array<{
    id: string;
    name: string;
  }>;
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
    coachGroupId: raw.coachGroupId ? String(raw.coachGroupId) : null,
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

function formatIsoDateForDisplay(value: string): string {
  const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) {
    return value;
  }
  const [, year, month, day] = isoMatch;
  return `${day}.${month}.${year}`;
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

function normalizeTrainingDateTimes(
  raw: unknown,
  selectedDates: string[],
  fallbackTrainingTime?: string | null,
): Record<string, string> {
  const selectedSet = new Set(selectedDates);
  const normalized: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!selectedSet.has(date)) {
        continue;
      }
      const time = typeof value === "string" ? value.trim() : "";
      if (TRAINING_TIME_REGEX.test(time)) {
        normalized[date] = time;
      }
    }
  }
  const fallback = typeof fallbackTrainingTime === "string" ? fallbackTrainingTime.trim() : "";
  if (TRAINING_TIME_REGEX.test(fallback)) {
    for (const date of selectedDates) {
      if (!normalized[date]) {
        normalized[date] = fallback;
      }
    }
  }
  return normalized;
}

function getUniformTrainingTime(dates: string[], dateTimes: Record<string, string>): string {
  if (dates.length === 0) {
    return "";
  }
  const first = (dateTimes[dates[0]] ?? "").trim();
  if (!TRAINING_TIME_REGEX.test(first)) {
    return "";
  }
  return dates.every((date) => (dateTimes[date] ?? "").trim() === first) ? first : "";
}

function inferTrainingTimeMode(dates: string[], dateTimes: Record<string, string>): TrainingTimeMode {
  if (dates.length <= 1) {
    return "all";
  }
  if (getUniformTrainingTime(dates, dateTimes)) {
    return "all";
  }

  const weekdayToTime = new Map<number, string>();
  let isByWeekday = true;
  for (const date of dates) {
    const time = (dateTimes[date] ?? "").trim();
    if (!TRAINING_TIME_REGEX.test(time)) {
      isByWeekday = false;
      break;
    }
    const weekday = getWeekdayMondayFirstIndex(date);
    const prev = weekdayToTime.get(weekday);
    if (!prev) {
      weekdayToTime.set(weekday, time);
      continue;
    }
    if (prev !== time) {
      isByWeekday = false;
      break;
    }
  }

  return isByWeekday ? "byWeekday" : "perDay";
}

function parseSelectedTeamGroup(selectedGroup: string): number | null {
  if (selectedGroup === "all") {
    return null;
  }
  const parsed = Number.parseInt(selectedGroup, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(normalized);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
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
const BellIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </svg>
);

const BellOffIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 8.21 3.342" />
    <path d="m2 2 20 20" />
  </svg>
);

const SpinnerIcon = ({ size = 16 }: { size?: number }) => (
  <svg className="spin-icon" width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const ShareIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v13" />
    <path d="m16 6-4-4-4 4" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
  </svg>
);

const ImportSheetsIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8" />
    <path d="M8 17h5" />
    <path d="M8 9h2" />
  </svg>
);

const PhotoImportIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

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
const CalendarIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "rgba(255,255,255,0.4)" }}>
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

const PencilIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
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

const ClipboardListIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </svg>
);

// Attendance Coach Dashboard Component
function AttendanceDashboard({
  onClose,
  clubId,
  coachGroupId = "",
  coachGroupName = "",
}: {
  onClose: () => void;
  clubId: string;
  coachGroupId?: string;
  coachGroupName?: string;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(todayIso);
  const [scopeType, setScopeType] = useState<"group" | "player">("group");
  const [groupScope, setGroupScope] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allPlayers, setAllPlayers] = useState<Array<{ id: string; fullName: string; teamGroup: number | null }>>([]);
  const [data, setData] = useState<AttendanceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableGroups, setAvailableGroups] = useState<number[]>([]);
  const [scheduleGroups, setScheduleGroups] = useState<TrainingScheduleGroup[]>([]);
  const [editMode, setEditMode] = useState(false);
  // key: "playerId|date", value: optedOut boolean (desired new state)
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const attendanceScopeKey = `${clubId}|${coachGroupId}`;

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        let playerTeamGroups: number[] = [];
        const membersSearch = new URLSearchParams();
        if (clubId) {
          membersSearch.set("clubId", clubId);
        }
        if (coachGroupId) {
          membersSearch.set("coachGroupId", coachGroupId);
        }
        const membersUrl = membersSearch.size
          ? `/api/admin/members?${membersSearch.toString()}`
          : "/api/admin/members";
        const groupsUrl = `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups`;

        const [membersRes, groupsRes] = await Promise.all([
          fetch(membersUrl, { cache: "no-store" }),
          fetch(groupsUrl, { cache: "no-store" }),
        ]);

        if (membersRes.ok) {
          const raw: unknown = await membersRes.json();
          const items = Array.isArray(raw) ? raw : [];
          const players = items
            .map((item: unknown) => {
              const r =
                typeof item === "object" && item !== null
                  ? (item as Record<string, unknown>)
                  : {};
              return {
                id: String(r.id ?? ""),
                fullName: String(r.fullName ?? "").trim(),
                teamGroup: typeof r.teamGroup === "number" ? r.teamGroup : null,
              };
            })
            .filter((p) => p.id && p.fullName);
          setAllPlayers(players.sort((a, b) => a.fullName.localeCompare(b.fullName, "bg")));
          const groups = Array.from(
            new Set(players.map((p) => p.teamGroup).filter((g): g is number => g !== null)),
          ).sort((a, b) => a - b);
          playerTeamGroups = groups;
          setAvailableGroups(groups);
        }

        if (groupsRes.ok) {
          const payload: unknown = await groupsRes.json();
          const groups: TrainingScheduleGroup[] = Array.isArray(payload)
            ? payload
              .map((item) => {
                const raw =
                  typeof item === "object" && item !== null
                    ? (item as Record<string, unknown>)
                    : {};
                const tg = Array.isArray(raw.teamGroups)
                  ? raw.teamGroups
                    .map((v) => Number.parseInt(String(v), 10))
                    .filter((v) => Number.isInteger(v))
                    .sort((a, b) => a - b)
                  : [];
                const td = Array.isArray(raw.trainingDates)
                  ? raw.trainingDates
                    .map((v) => String(v ?? "").trim())
                    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
                  : [];
                return {
                  id: String(raw.id ?? ""),
                  name: String(raw.name ?? "").trim(),
                  teamGroups: tg,
                  trainingDates: td,
                  trainingTime: typeof raw.trainingTime === "string" ? raw.trainingTime.trim() : null,
                  trainingDateTimes: null,
                } satisfies TrainingScheduleGroup;
              })
              .filter((g) => g.id && g.teamGroups.length >= 2)
              .filter((g) => !coachGroupId || g.teamGroups.some((teamGroup) => playerTeamGroups.includes(teamGroup)))
            : [];
          setScheduleGroups(groups);
        }
      } catch {
        // silent
      }
    };
    void fetchOptions();
     
  }, [attendanceScopeKey]);

  useEffect(() => {
    if (scopeType === "group" && !groupScope && (scheduleGroups.length > 0 || availableGroups.length > 0)) {
      if (scheduleGroups.length > 0) {
        setGroupScope(`tg:${scheduleGroups[0].id}`);
      } else if (availableGroups.length > 0) {
        const trainingGroupYears = new Set(scheduleGroups.flatMap((g) => g.teamGroups));
        const standalone = availableGroups.filter((g) => !trainingGroupYears.has(g));
        if (standalone.length > 0) {
          setGroupScope(`year:${standalone[0]}`);
        }
      }
    }
  }, [scheduleGroups, availableGroups, scopeType, groupScope]);

  useEffect(() => {
    if (!from || !to || from > to) return;
    if (scopeType === "player" && !selectedPlayerId) return;

    let cancelled = false;

    const doFetch = async () => {
      setLoading(true);
      setError("");
      setData(null);
      setEditMode(false);
      setPendingChanges(new Map());
      setSaveError("");
      try {
        const search = new URLSearchParams({ from, to });
        if (scopeType === "player") {
          search.set("playerId", selectedPlayerId);
        } else if (groupScope.startsWith("tg:")) {
          search.set("trainingGroupId", groupScope.slice(3));
        } else if (groupScope.startsWith("year:")) {
          search.set("teamGroup", groupScope.slice(5));
        }
        if (coachGroupId) {
          search.set("coachGroupId", coachGroupId);
        }
        const res = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance/report?${search.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          throw new Error(
            typeof payload?.error === "string" ? payload.error : "Грешка при зареждане.",
          );
        }
        const payload = (await res.json()) as AttendanceReportData;
        const reportData: AttendanceReportData = {
          ...payload,
          trainingDates: [...payload.trainingDates].sort((a, b) => b.localeCompare(a)),
        };
        if (cancelled) return;
        setData(reportData);
      } catch (e) {
        if (!cancelled && (e as { name?: string }).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Грешка при зареждане.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(() => { void doFetch(); }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
     
  }, [from, to, scopeType, groupScope, selectedPlayerId, attendanceScopeKey]);

  const formatDateHeader = (iso: string): string => {
    const parts = iso.split("-");
    const month = parts[1] ?? "01";
    const day = parts[2] ?? "01";
    const monthIdx = parseInt(month, 10) - 1;
    const shortMonths = ["Ян", "Фев", "Мар", "Апр", "Май", "Юни", "Юли", "Авг", "Сеп", "Окт", "Ное", "Дек"];
    return `${day}\n${shortMonths[monthIdx] ?? ""}`;
  };

  const emptyLabel = groupScope.startsWith("tg:")
    ? "Няма играчи в избраната група."
    : groupScope.startsWith("year:")
      ? "Няма играчи в избрания набор."
      : "Няма активни играчи.";

  const trainingGroupYears = new Set(scheduleGroups.flatMap((g) => g.teamGroups));
  const standaloneGroups = availableGroups.filter((g) => !trainingGroupYears.has(g));

  const filteredSearchPlayers = playerSearch.length >= 1 && !selectedPlayerId
    ? allPlayers.filter((p) =>
      p.fullName.toLowerCase().includes(playerSearch.toLowerCase()),
    ).slice(0, 10)
    : [];

  const handleCellClick = (playerId: string, date: string) => {
    if (saving) return;
    const key = `${playerId}|${date}`;
    const originalOptedOut = !(data?.players.find((p) => p.id === playerId)?.attendance[date]?.present ?? true);
    const currentOptedOut = pendingChanges.has(key) ? pendingChanges.get(key)! : originalOptedOut;
    const newOptedOut = !currentOptedOut;

    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (newOptedOut === originalOptedOut) {
        next.delete(key);
      } else {
        next.set(key, newOptedOut);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (pendingChanges.size === 0 || saving) return;
    setSaving(true);
    setSaveError("");

    try {
      await Promise.all(
        Array.from(pendingChanges.entries()).map(async ([key, optedOut]) => {
          const separatorIdx = key.indexOf("|");
          const playerId = key.slice(0, separatorIdx);
          const trainingDate = key.slice(separatorIdx + 1);
          const res = await fetch(
            `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId, trainingDate, optedOut }),
            },
          );
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error((json as { error?: string }).error ?? "Грешка при запис.");
          }
        }),
      );

      // Commit pending changes into the data state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => {
            const updatedAttendance = { ...p.attendance };
            for (const [key, optedOut] of pendingChanges.entries()) {
              const sepIdx = key.indexOf("|");
              if (key.slice(0, sepIdx) !== p.id) continue;
              const date = key.slice(sepIdx + 1);
              updatedAttendance[date] = {
                present: !optedOut,
                reasonCode: optedOut ? "other" : null,
              };
            }
            return { ...p, attendance: updatedAttendance };
          }),
        };
      });

      setPendingChanges(new Map());
      setEditMode(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Грешка при запис.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setPendingChanges(new Map());
    setEditMode(false);
    setSaveError("");
  };

  const printAttendance = () => {
    if (!data || typeof window === "undefined" || typeof document === "undefined") return;

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

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const scopeTitle = coachGroupId ? `Само за треньорска група: ${coachGroupName || "текущата група"}` : "";

    const tHeadHtml = `
      <tr>
        <th style="padding: 6px; text-align: left; border-bottom: 2px solid #ccc; white-space: nowrap;">Име</th>
        ${data.trainingDates.map(d => `<th style="padding: 6px; border-bottom: 2px solid #ccc; text-align: center;">${d.split('-')[2]}.${d.split('-')[1]}</th>`).join('')}
        <th style="padding: 6px; border-bottom: 2px solid #ccc; text-align: center;">%</th>
      </tr>
    `;

    const tbodyHtml = data.players.map((player) => {
      const presentCount = data.trainingDates.filter(d => player.attendance[d]?.present ?? true).length;
      const pct = data.trainingDates.length > 0 ? Math.round((presentCount / data.trainingDates.length) * 100) : 0;
      
      const cellsHtml = data.trainingDates.map((d) => {
        const cell = player.attendance[d];
        if (!cell) return `<td style="padding: 4px; text-align: center; color: #999;">–</td>`;
        return cell.present 
          ? `<td style="padding: 4px; text-align: center; color: #16a34a; font-weight: bold;">&#x2713;</td>`
          : `<td style="padding: 4px; text-align: center; color: #dc2626;">&#x2717;</td>`;
      }).join('');

      return `
        <tr>
          <td style="padding: 4px; border-bottom: 1px solid #eee; white-space: nowrap;">${escapeHtml(player.fullName)}</td>
          ${cellsHtml}
          <td style="padding: 4px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${pct}%</td>
        </tr>
      `;
    }).join("");

    let tfootHtml = "";
    if (scopeType === "group") {
      const footerCellsHtml = data.trainingDates.map((d) => {
        const presentOnDate = data.players.filter(p => p.attendance[d]?.present ?? true).length;
        const pct = data.players.length > 0 ? Math.round((presentOnDate / data.players.length) * 100) : 0;
        return `<td style="padding: 6px; text-align: center; font-weight: bold;">${pct}%</td>`;
      }).join("");

      tfootHtml = `
        <tr style="background: #f9fafb;">
          <td style="padding: 6px; text-align: right; font-weight: bold;">Средно</td>
          ${footerCellsHtml}
          <td style="padding: 6px;"></td>
        </tr>
      `;
    }

    doc.open();
    doc.write(`<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Присъствия</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
    .page { padding: 20px; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    @page { size: landscape; margin: 10mm; }
  </style>
</head>
<body>
  <div class="page">
    <h1>Отчет присъствия (${from} до ${to})</h1>
    ${scopeTitle ? `<p style="margin: 0 0 12px; color: #6b7280; font-size: 13px;">${escapeHtml(scopeTitle)}</p>` : ""}
    <table>
      <thead>${tHeadHtml}</thead>
      <tbody>${tbodyHtml}</tbody>
      ${tfootHtml ? `<tfoot>${tfootHtml}</tfoot>` : ""}
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
      <div className="rd-dialog acd-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="rd-close" onClick={onClose} aria-label="Затвори">
          <XIcon />
        </button>

        <div className="rd-header">
          <h2 className="rd-title">
            <ClipboardListIcon size={20} />
            Присъствия на тренировки
          </h2>
          {coachGroupId && (
            <p className="rd-subtitle">
              Само за треньорска група: {coachGroupName || "текущата група"}
            </p>
          )}
        </div>

        <div className="rd-filters">
          <div className="rd-field">
            <label className="rd-label">От</label>
            <div className="rd-select-wrap">
              <input
                type="date"
                className="rd-date-input"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
              <CalendarIcon size={16} />
            </div>
          </div>
          <div className="rd-field">
            <label className="rd-label">До</label>
            <div className="rd-select-wrap">
              <input
                type="date"
                className="rd-date-input"
                value={to}
                min={from}
                max={todayIso}
                onChange={(e) => setTo(e.target.value)}
              />
              <CalendarIcon size={16} />
            </div>
          </div>
          <div className="rd-field">
            <label className="rd-label">Вид</label>
            <div className="rd-select-wrap">
              <select
                className="rd-select"
                value={scopeType}
                onChange={(e) => {
                  const next = e.target.value as "group" | "player";
                  setScopeType(next);
                  setData(null);
                  setError("");
                  if (next === "player") {
                    setPlayerSearch("");
                    setSelectedPlayerId("");
                  }
                }}
              >
                <option value="group">Отбор</option>
                <option value="player">Играч</option>
              </select>
              <ChevronDownIcon />
            </div>
          </div>
          {scopeType === "group" ? (
            <div className="rd-field">
              <label className="rd-label">Група</label>
              <div className="rd-select-wrap">
                <select
                  className="rd-select"
                  value={groupScope}
                  onChange={(e) => setGroupScope(e.target.value)}
                >
                  {scheduleGroups.map((g) => (
                    <option key={g.id} value={`tg:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                  {standaloneGroups.map((g) => (
                    <option key={g} value={`year:${g}`}>
                      Набор {g}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon />
              </div>
            </div>
          ) : (
            <div className="rd-field acd-player-search-field">
              <label className="rd-label">Играч</label>
              <div className="acd-player-search">
                <input
                  type="text"
                  className="acd-search-input"
                  placeholder="Търси играч..."
                  value={playerSearch}
                  autoComplete="off"
                  onChange={(e) => {
                    setPlayerSearch(e.target.value);
                    setSelectedPlayerId("");
                    setShowSearchResults(true);
                    setData(null);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
                />
                {showSearchResults && filteredSearchPlayers.length > 0 && (
                  <ul className="acd-search-results">
                    {filteredSearchPlayers.map((p) => (
                      <li
                        key={p.id}
                        className="acd-search-result"
                        onMouseDown={() => {
                          setSelectedPlayerId(p.id);
                          setPlayerSearch(p.fullName);
                          setShowSearchResults(false);
                        }}
                      >
                        {p.fullName}
                        {p.teamGroup !== null && (
                          <span className="acd-search-result-group">Набор {p.teamGroup}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {loading && (
            <div className="acd-inline-spinner">
              <SpinnerIcon size={16} />
            </div>
          )}
        </div>

        {error && <p className="acd-error">{error}</p>}

        {data && (
          <>
            {data.trainingDates.length === 0 ? (
              <p className="acd-empty">Няма тренировки в избрания период.</p>
            ) : data.players.length === 0 ? (
              <p className="acd-empty">{emptyLabel}</p>
            ) : (
              <div className="acd-table-wrap">
                <table className="acd-table">
                  <thead>
                    <tr>
                      <th className="acd-th-name">Играч</th>
                      {data.trainingDates.map((d) => (
                        <th key={d} className="acd-th-date" title={d}>
                          <span className="acd-date-label">{formatDateHeader(d)}</span>
                        </th>
                      ))}
                      <th className="acd-th-pct">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.map((player) => {
                      const presentCount = data.trainingDates.filter(
                        (d) => player.attendance[d]?.present ?? true,
                      ).length;
                      const pct =
                        data.trainingDates.length > 0
                          ? Math.round((presentCount / data.trainingDates.length) * 100)
                          : 0;
                      return (
                        <tr key={player.id}>
                          <td className="acd-td-name">{player.fullName}</td>
                          {data.trainingDates.map((d) => {
                            const cell = player.attendance[d];
                            if (!cell) {
                              return (
                                <td key={d} className="acd-cell acd-cell--na">
                                  –
                                </td>
                              );
                            }
                            const cellKey = `${player.id}|${d}`;
                            const hasPending = pendingChanges.has(cellKey);
                            const displayOptedOut = hasPending ? pendingChanges.get(cellKey)! : !cell.present;
                            const displayPresent = !displayOptedOut;
                            const editTitle = displayPresent
                              ? "Клик за отбелязване на отсъствие"
                              : "Клик за отбелязване на присъствие";
                            const viewTitle = displayPresent
                              ? "Присъства"
                              : !hasPending && cell.reasonCode === "injury" ? "Контузия"
                              : !hasPending && cell.reasonCode === "sick" ? "Болен"
                              : !hasPending && cell.reasonCode === "other" ? "Друга причина"
                              : !hasPending && cell.reasonCode ? `Причина: ${cell.reasonCode}` : "Отказал се";
                            const displayReasonCode = hasPending ? (displayOptedOut ? "other" : null) : cell.reasonCode;
                            return (
                              <td
                                key={d}
                                className={`acd-cell ${displayPresent ? "acd-cell--present" : "acd-cell--absent"}${editMode ? " acd-cell--editable" : ""}${hasPending ? " acd-cell--pending" : ""}`}
                                title={editMode ? editTitle : viewTitle}
                                onClick={editMode && !saving ? () => handleCellClick(player.id, d) : undefined}
                              >
                                {displayPresent ? "✓" : (
                                  displayReasonCode === "injury" ? "Конт" :
                                    displayReasonCode === "sick" ? "Болен" :
                                      displayReasonCode === "other" ? "Друго" :
                                        displayReasonCode ? displayReasonCode.slice(0, 4) : "✗"
                                )}
                              </td>
                            );
                          })}
                          <td
                            className={`acd-td-pct ${pct >= 75 ? "acd-pct--good" : pct >= 50 ? "acd-pct--warn" : "acd-pct--low"}`}
                          >
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {scopeType === "group" && (
                    <tfoot>
                      <tr className="acd-summary-row">
                        <td className="acd-td-name acd-summary-label">Средно</td>
                        {data.trainingDates.map((d) => {
                          const presentOnDate = data.players.filter(
                            (p) => p.attendance[d]?.present ?? true,
                          ).length;
                          const pct =
                            data.players.length > 0
                              ? Math.round((presentOnDate / data.players.length) * 100)
                              : 0;
                          return (
                            <td
                              key={d}
                              className={`acd-cell ${pct >= 75 ? "acd-pct--good" : pct >= 50 ? "acd-pct--warn" : "acd-pct--low"}`}
                            >
                              {pct}%
                            </td>
                          );
                        })}
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </>
        )}

        {!data && !loading && !error && (
          <p className="acd-empty">
            {scopeType === "player" && !selectedPlayerId
              ? "Изберете играч за да видите присъствията."
              : "Няма данни за избрания период."}
          </p>
        )}

        {saveError && <p className="acd-error">{saveError}</p>}

        {data && data.players.length > 0 && data.trainingDates.length > 0 && (
          <div className="rd-footer" style={{ marginTop: "4px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {!editMode && (
              <button className="rd-footer-btn" onClick={printAttendance} type="button">
                <PrinterIcon /> Отпечатай
              </button>
            )}
            {!editMode ? (
              <button
                type="button"
                className="rd-footer-btn"
                onClick={() => { setEditMode(true); setSaveError(""); }}
              >
                <PencilIcon size={14} /> Редактирай
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="rd-footer-btn rd-footer-btn--save"
                  disabled={pendingChanges.size === 0 || saving}
                  onClick={handleSave}
                >
                  {saving ? <SpinnerIcon size={14} /> : <PencilIcon size={14} />}
                  {saving ? "Запис..." : `Запази${pendingChanges.size > 0 ? ` (${pendingChanges.size})` : ""}`}
                </button>
                <button
                  type="button"
                  className="rd-footer-btn"
                  disabled={saving}
                  onClick={handleCancelEdit}
                >
                  Отмени
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Reports Dialog Component
function ReportsDialog({
  onClose,
  clubId,
  coachGroupId = "",
  coachGroupName = "",
}: {
  onClose: () => void;
  clubId: string;
  coachGroupId?: string;
  coachGroupName?: string;
}) {
  const now = new Date();
  const [month, setMonth] = useState(MONTHS[now.getMonth()] ?? MONTHS[0]);
  const [year, setYear] = useState(String(Math.max(2026, now.getFullYear())));
  const [group, setGroup] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [players, setPlayers] = useState<ReportPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const reportScopeKey = `${clubId}|${coachGroupId}`;

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const search = new URLSearchParams();
        if (clubId) {
          search.set("clubId", clubId);
        }
        if (coachGroupId) {
          search.set("coachGroupId", coachGroupId);
        }
        const endpoint = search.size ? `/api/admin/members?${search.toString()}` : "/api/admin/members";
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) {
          setPlayers([]);
          return;
        }
        const data = await response.json();
        const normalizedPlayers: ReportPlayer[] = Array.isArray(data)
          ? data.map((item) => {
            const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
            const paymentLogs = Array.isArray(raw.paymentLogs)
              ? raw.paymentLogs.map((log) => {
                const logRaw =
                  typeof log === "object" && log !== null ? (log as Record<string, unknown>) : {};
                return {
                  id: String(logRaw.id ?? ""),
                  paidFor: String(logRaw.paidFor ?? ""),
                  paidAt: String(logRaw.paidAt ?? ""),
                };
              })
              : [];

            return {
              id: String(raw.id ?? ""),
              fullName: String(raw.fullName ?? ""),
              teamGroup: typeof raw.teamGroup === "number" ? raw.teamGroup : null,
              paymentLogs,
              isActive: raw.isActive === false ? false : true,
            };
          })
          : [];
        setPlayers(normalizedPlayers);
      } catch (error) {
        console.error("Error fetching report players:", error);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchPlayers();
  }, [reportScopeKey]);

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
      isActive: player.isActive !== false,
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
      isActive: player.isActive !== false,
    };
  });

  const statsRows = rows.filter((row) => row.isActive);
  const paidCount = statsRows.filter((row) => row.paid).length;
  const total = statsRows.length;
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
    const periodTitle = kind === "monthly" ? `${month} ${year}` : `Година ${year}`;
    const scopeTitle = coachGroupId ? `Само за треньорска група: ${coachGroupName || "текущата група"}` : "";

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
              <td>${row.paid ? "Платено" : "Неплатено"}</td>
            </tr>
          `)
        .join("")
      : `<tr><td colspan="5" style="text-align:center;color:#6b7280;">Няма данни за избраните филтри.</td></tr>`;

    doc.open();
    doc.write(`<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${kind === "monthly" ? "Месечен отчет" : "Годишен отчет"}</title>
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
    <h1>${kind === "monthly" ? "Месечен отчет" : "Годишен отчет"}</h1>
    <p class="sub">Период: ${escapeHtml(periodTitle)}</p>
    ${scopeTitle ? `<p class="sub">${escapeHtml(scopeTitle)}</p>` : ""}
    <div class="stats">
      <div class="stat">Платили: <strong>${paid}</strong> / ${totalRows}</div>
      <div class="stat">Събираемост: <strong>${percent}%</strong></div>
      <div class="stat">Неплатили: <strong>${unpaid}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Име</th>
          <th>Набор</th>
          <th>Дата на плащане</th>
          <th>Статус</th>
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
          {coachGroupId && (
            <p className="rd-subtitle">
              Само за треньорска група: {coachGroupName || "текущата група"}
            </p>
          )}
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
function MemberDetailModalLegacy({
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
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const paymentHistory = [...(member.paymentLogs ?? [])].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
  const lastPayment = paymentHistory[0];
  const memberCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "";
  const memberClubId = member.club?.id ?? "";
  const memberId = member.id;
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
  coachGroups,
  onCoachGroupAssigned,
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
  coachGroups?: CoachGroup[];
  onCoachGroupAssigned?: (memberId: string, coachGroupId: string | null) => void;
}) {
  const s = getStatusMeta(member.status);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [assignCoachGroupValue, setAssignCoachGroupValue] = useState<string | null>(member.coachGroupId);
  const [assignCoachGroupSaving, setAssignCoachGroupSaving] = useState(false);
  const [assignCoachGroupError, setAssignCoachGroupError] = useState("");
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const paymentHistory = [...(member.paymentLogs ?? [])].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
  const lastPayment = paymentHistory[0];
  const memberCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "";
  const activeCardCode = memberCardCode || "Няма активна карта";
  const memberClubId = member.club?.id ?? "";
  const memberId = member.id;

  const fetchNotifications = async () => {
    if (!memberClubId || !memberId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setNotificationsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(memberClubId)}/notifications?playerId=${encodeURIComponent(memberId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload.unreadCount ?? 0));
    } catch (error) {
      console.error("Failed to fetch member notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationsRead = async () => {
    if (!memberClubId || !memberId) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(memberClubId)}/notifications/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId: memberId }),
      });
      if (!response.ok) {
        return;
      }

      const nowIso = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? nowIso })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark member notifications as read:", error);
    }
  };

  const handleOpenNotificationsPanel = async () => {
    setNotificationsPanelOpen(true);
    await fetchNotifications();
    await markNotificationsRead();
  };

  useEffect(() => {
    let cancelled = false;

    const fetchUnread = async () => {
      if (!memberClubId || !memberId) {
        setUnreadCount(0);
        return;
      }

      try {
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(memberClubId)}/notifications?playerId=${encodeURIComponent(memberId)}`,
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) {
          return;
        }
        const payload = await response.json();
        setUnreadCount(Number(payload.unreadCount ?? 0));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch member unread notifications:", error);
        }
      }
    };

    void fetchUnread();
    return () => {
      cancelled = true;
    };
  }, [memberClubId, memberId]);

  return (
    <div className="amp-overlay" onClick={onClose}>
      <div className="amp-modal" onClick={e => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />

        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">{member.fullName} - Статистика</span>
          <div className="amp-modal-title-actions">
            <button
              className="amp-member-bell-btn"
              onClick={() => void handleOpenNotificationsPanel()}
              aria-label="Известия"
              disabled={!memberClubId || !memberId}
            >
              <BellIcon />
              {unreadCount > 0 ? (
                <span className="amp-member-bell-dot">{unreadCount > 99 ? "99+" : unreadCount}</span>
              ) : null}
            </button>
            <button className="amp-modal-close" onClick={onClose} aria-label="Затвори">
              <XIcon />
            </button>
          </div>
        </h2>

        <div className="amp-modal-body">
          <div className="amp-info-card">
            <div className="amp-info-cell">
              <UserIcon />
              <div>
                <p className="amp-lbl">Име</p>
                <p className="amp-val">{member.fullName}</p>
              </div>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Набор:</span>
              <span className="amp-val">{member.teamGroup ?? "-"}</span>
            </div>

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

            {coachGroups && coachGroups.length > 0 && actionMode === "active" && (
              <div className="amp-info-cell amp-info-cell--full">
                <div style={{ width: "100%" }}>
                  <p className="amp-lbl" style={{ marginBottom: "6px" }}>Треньорска група</p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <select
                      className="amp-edit-input"
                      value={assignCoachGroupValue ?? ""}
                      onChange={(e) => { setAssignCoachGroupValue(e.target.value || null); setAssignCoachGroupError(""); }}
                      disabled={assignCoachGroupSaving}
                      style={{ flex: 1 }}
                    >
                      <option value="">Без група</option>
                      {coachGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="amp-btn amp-btn--ghost amp-btn--compact"
                      disabled={assignCoachGroupSaving || assignCoachGroupValue === member.coachGroupId}
                      onClick={async () => {
                        setAssignCoachGroupSaving(true);
                        setAssignCoachGroupError("");
                        try {
                          const response = await fetch(`/api/admin/members/${encodeURIComponent(member.id)}/coach-group`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ coachGroupId: assignCoachGroupValue }),
                          });
                          if (!response.ok) {
                            const payload = await response.json().catch(() => ({}));
                            throw new Error(String((payload as { error?: unknown }).error ?? "Грешка"));
                          }
                          onCoachGroupAssigned?.(member.id, assignCoachGroupValue);
                        } catch (err) {
                          setAssignCoachGroupError(err instanceof Error ? err.message : "Грешка");
                        } finally {
                          setAssignCoachGroupSaving(false);
                        }
                      }}
                    >
                      {assignCoachGroupSaving ? "..." : "Запиши"}
                    </button>
                  </div>
                  {assignCoachGroupError && <p className="amp-confirm-error" style={{ marginTop: "6px", marginBottom: 0 }}>{assignCoachGroupError}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="amp-acc">
            <button className="amp-acc-trigger" onClick={() => setHistoryOpen((v) => !v)}>
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
                <button className="amp-btn amp-btn--ghost" onClick={() => onRequestEdit(member)}>
                  Редактирай
                </button>
                <button className="amp-btn amp-btn--danger" onClick={() => onRequestDelete(member)}>
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

      {notificationsPanelOpen ? (
        <div className="amp-overlay amp-overlay--member-notifications" onClick={() => setNotificationsPanelOpen(false)}>
          <div className="amp-modal amp-modal--member-notifications" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Известия</span>
              <button className="amp-modal-close" onClick={() => setNotificationsPanelOpen(false)} aria-label="Затвори">
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {notificationsLoading ? (
                <p className="amp-empty amp-empty--modal">Зареждане...</p>
              ) : notifications.length === 0 ? (
                <p className="amp-empty amp-empty--modal">Няма известия</p>
              ) : (
                <div className="amp-member-notifications-list">
                  {notifications.map((notif) => (
                    <article
                      key={notif.id}
                      className={`amp-member-notification-item${notif.readAt ? "" : " amp-member-notification-item--unread"}`}
                    >
                      <div className="amp-member-notification-head">
                        <h3>{notif.title}</h3>
                        {!notif.readAt ? <span className="amp-member-notification-new" aria-label="Ново" /> : null}
                      </div>
                      <p>{notif.body}</p>
                      <div className="amp-member-notification-meta">
                        {typeof notif.teamGroup === "number" ? <span>Набор: {notif.teamGroup}</span> : null}
                        {Array.isArray(notif.trainingGroups) && notif.trainingGroups.length > 0 ? (
                          <span>Сборен отбор: {notif.trainingGroups.map((group) => group.name).join(", ")}</span>
                        ) : null}
                      </div>
                      <time dateTime={notif.sentAt}>
                        {new Date(notif.sentAt).toLocaleDateString("bg-BG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
            грачът ще бъде маркиран като неактивен.
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
  coachGroupName,
}: {
  member: Member;
  onClick: () => void;
  actionMode?: "profile" | "reactivate";
  isActionLoading?: boolean;
  onReactivate?: () => void;
  isDeleteLoading?: boolean;
  onPermanentDelete?: () => void;
  coachGroupName?: string | null;
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
            {coachGroupName && (
              <span className="amp-badge" style={{ color: "#6366f1", background: "#ede9fe", border: "1px solid #c4b5fd", fontSize: "0.7rem" }}>
                {coachGroupName}
              </span>
            )}
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
  const coachGroupId = searchParams.get("coachGroupId") ?? "";
  const [coachGroups, setCoachGroups] = useState<CoachGroup[]>([]);
  const [coachGroupsPanelOpen, setCoachGroupsPanelOpen] = useState(false);
  const [coachGroupCreateName, setCoachGroupCreateName] = useState("");
  const [coachGroupCreateError, setCoachGroupCreateError] = useState("");
  const [coachGroupCreateSaving, setCoachGroupCreateSaving] = useState(false);
  const [coachGroupDeleteId, setCoachGroupDeleteId] = useState<string | null>(null);
  const [coachGroupDeleteSaving, setCoachGroupDeleteSaving] = useState(false);
  const [coachGroupCopiedId, setCoachGroupCopiedId] = useState<string | null>(null);
  const [coachGroupEditId, setCoachGroupEditId] = useState<string | null>(null);
  const [coachGroupEditName, setCoachGroupEditName] = useState("");
  const [coachGroupEditSaving, setCoachGroupEditSaving] = useState(false);
  const [coachGroupEditError, setCoachGroupEditError] = useState("");
  const [memberCoachGroupAssignMemberId, setMemberCoachGroupAssignMemberId] = useState<string | null>(null);
  const [coachGroupScheduleRedirectOpen, setCoachGroupScheduleRedirectOpen] = useState(false);
  const [memberCoachGroupAssignValue, setMemberCoachGroupAssignValue] = useState<string | null>(null);
  const [memberCoachGroupAssignSaving, setMemberCoachGroupAssignSaving] = useState(false);
  const [memberCoachGroupAssignError, setMemberCoachGroupAssignError] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);
  const [isClubPushSupported, setIsClubPushSupported] = useState(true);
  const [isClubPushSubscribed, setIsClubPushSubscribed] = useState(false);
  const [clubPushBusy, setClubPushBusy] = useState(false);
  const [clubPushStatusMessage, setClubPushStatusMessage] = useState("");
  const [clubPushErrorMessage, setClubPushErrorMessage] = useState("");
  const [isClubIPhone, setIsClubIPhone] = useState(false);
  const [isClubStandalone, setIsClubStandalone] = useState(false);
  const [showClubIphoneGuide, setShowClubIphoneGuide] = useState(false);
  const [clubNotificationsPanelOpen, setClubNotificationsPanelOpen] = useState(false);
  const [clubNotificationsLoading, setClubNotificationsLoading] = useState(false);
  const [clubNotifications, setClubNotifications] = useState<MemberNotification[]>([]);
  const [clubNotificationsUnreadCount, setClubNotificationsUnreadCount] = useState(0);
  const [clubNotificationsDateFilter, setClubNotificationsDateFilter] = useState("");
  const [clubNotificationsScopeType, setClubNotificationsScopeType] = useState<"team" | "trainingGroup" | "admin">("team");
  const [clubNotificationsScopeValue, setClubNotificationsScopeValue] = useState("all");
  const [lastHandledCoachPushOpenTs, setLastHandledCoachPushOpenTs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [trainingGroupScope, setTrainingGroupScope] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
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
  const [attendanceDashboardOpen, setAttendanceDashboardOpen] = useState(false);
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
  const [secondReminderEnabled, setSecondReminderEnabled] = useState(false);
  const [schedulerForm, setSchedulerForm] = useState({
    reminderDay: "25",
    overdueDay: "1",
    reminderHour: "10",
    reminderMinute: "0",
    secondReminderDay: "",
    secondReminderHour: "10",
    secondReminderMinute: "0",
    overdueHour: "10",
    overdueMinute: "0",
    trainingDates: [] as string[],
    trainingTime: "",
  });
  const [trainingDateTimes, setTrainingDateTimes] = useState<Record<string, string>>({});
  const [trainingDaysInitialDateTimes, setTrainingDaysInitialDateTimes] = useState<Record<string, string>>({});
  const [trainingTimeMode, setTrainingTimeMode] = useState<TrainingTimeMode>("all");
  const reminderTimeValue = `${schedulerForm.reminderHour.padStart(2, "0")}:${schedulerForm.reminderMinute.padStart(2, "0")}`;
  const secondReminderTimeValue = `${schedulerForm.secondReminderHour.padStart(2, "0")}:${schedulerForm.secondReminderMinute.padStart(2, "0")}`;
  const overdueTimeValue = `${schedulerForm.overdueHour.padStart(2, "0")}:${schedulerForm.overdueMinute.padStart(2, "0")}`;
  const [trainingAttendanceOpen, setTrainingAttendanceOpen] = useState(false);
  const [trainingAttendanceView, setTrainingAttendanceView] = useState<"teamGroup" | "trainingGroups" | "today">("teamGroup");
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
  const [trainingTodayLoading, setTrainingTodayLoading] = useState(false);
  const [trainingTodayDate, setTrainingTodayDate] = useState(getTodayIsoDate());
  const [trainingTodayNote, setTrainingTodayNote] = useState("");
  const [trainingTodaySessions, setTrainingTodaySessions] = useState<TrainingTodaySessionItem[]>([]);
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
  const [trainingGroupMode, setTrainingGroupMode] = useState<"team_group" | "custom_group">("team_group");
  const [trainingGroupModeDraft, setTrainingGroupModeDraft] = useState<"team_group" | "custom_group">("team_group");
  const [trainingGroupModeSettingsOpen, setTrainingGroupModeSettingsOpen] = useState(false);
  const [trainingGroupModeSaving, setTrainingGroupModeSaving] = useState(false);
  const [trainingGroupModeError, setTrainingGroupModeError] = useState("");
  const [trainingDaysEditorMode, setTrainingDaysEditorMode] = useState<"teamGroup" | "createGroup" | "trainingGroup" | "customGroup" | "coachGroup">("teamGroup");
  const [trainingDaysEditorGroups, setTrainingDaysEditorGroups] = useState<string[]>([]);
  const [trainingDaysEditorGroupName, setTrainingDaysEditorGroupName] = useState("");
  const [trainingDaysEditorCreateOpen, setTrainingDaysEditorCreateOpen] = useState(false);
  const [trainingGroupCreateOpen, setTrainingGroupCreateOpen] = useState(false);
  const [trainingGroupCreateSaving, setTrainingGroupCreateSaving] = useState(false);
  const [trainingGroupCreateError, setTrainingGroupCreateError] = useState("");
  const [trainingGroupCreateGroups, setTrainingGroupCreateGroups] = useState<string[]>([]);
  const [trainingGroupCreateName, setTrainingGroupCreateName] = useState("");
  const [trainingGroupCreatePlayerIds, setTrainingGroupCreatePlayerIds] = useState<string[]>([]);
  const [trainingGroupEditOpen, setTrainingGroupEditOpen] = useState(false);
  const [trainingGroupEditSaving, setTrainingGroupEditSaving] = useState(false);
  const [trainingGroupEditError, setTrainingGroupEditError] = useState("");
  const [trainingGroupDeleteConfirmOpen, setTrainingGroupDeleteConfirmOpen] = useState(false);
  const [trainingGroupDeleteSaving, setTrainingGroupDeleteSaving] = useState(false);
  const [trainingGroupEditId, setTrainingGroupEditId] = useState("");
  const [trainingGroupEditName, setTrainingGroupEditName] = useState("");
  const [trainingGroupEditGroups, setTrainingGroupEditGroups] = useState<string[]>([]);
  const [trainingGroupEditPlayerIds, setTrainingGroupEditPlayerIds] = useState<string[]>([]);
  const [selectedTrainingGroupId, setSelectedTrainingGroupId] = useState("");
  const [postTeamGroupSavePromptOpen, setPostTeamGroupSavePromptOpen] = useState(false);
  const [postTeamGroupSavePromptGroupId, setPostTeamGroupSavePromptGroupId] = useState("");
  const [postTeamGroupSavePromptGroupName, setPostTeamGroupSavePromptGroupName] = useState("");
  const [teamGroupWarningModalOpen, setTeamGroupWarningModalOpen] = useState(false);
  const [pendingTeamGroupWarningGroups, setPendingTeamGroupWarningGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [importSheetsOpen, setImportSheetsOpen] = useState(false);
  const [importPhotosOpen, setImportPhotosOpen] = useState(false);
  const [trainingScheduleGroupsLoading, setTrainingScheduleGroupsLoading] = useState(false);
  const [trainingScheduleGroups, setTrainingScheduleGroups] = useState<TrainingScheduleGroup[]>([]);
  const [customTrainingGroups, setCustomTrainingGroups] = useState<CustomTrainingGroup[]>([]);
  const schedulerCalendarDates = getNextTrainingCalendarDates();
  const schedulerCalendarDateSet = new Set(schedulerCalendarDates);
  const schedulerCalendarMonths = buildCalendarMonths(schedulerCalendarDates);
  const trainingUpcomingDateSet = new Set(trainingUpcomingDates.map((item) => item.date));
  const trainingUpcomingByDate = new Map(trainingUpcomingDates.map((item) => [item.date, item]));
  const trainingAttendanceCalendarMonths = buildCalendarMonths(trainingUpcomingDates.map((item) => item.date));
  const todayIsoDate = getTodayIsoDate();
  const clubNotificationTeamGroups = Array.from(
    new Set(
      clubNotifications
        .map((item) => (typeof item.teamGroup === "number" ? item.teamGroup : null))
        .filter((value): value is number => typeof value === "number"),
    ),
  ).sort((a, b) => a - b);
  const clubNotificationTrainingGroups = Array.from(
    new Map(
      clubNotifications
        .flatMap((item) =>
          Array.isArray(item.trainingGroups)
            ? item.trainingGroups.map((group) => [group.id, group] as const)
            : [],
        ),
    ).values(),
  );
  const filteredClubNotifications = clubNotifications.filter((item) => {
    const notifDate = new Date(item.sentAt).toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
    if (clubNotificationsDateFilter && notifDate !== clubNotificationsDateFilter) {
      return false;
    }
    if (clubNotificationsScopeType === "admin") {
      return item.type === "admin_message";
    }
    if (clubNotificationsScopeValue !== "all") {
      if (clubNotificationsScopeType === "team") {
        const selectedGroup = Number.parseInt(clubNotificationsScopeValue, 10);
        if (!Number.isInteger(selectedGroup) || item.teamGroup !== selectedGroup) {
          return false;
        }
      } else {
        const hasTrainingGroup = Array.isArray(item.trainingGroups)
          ? item.trainingGroups.some((group) => group.id === clubNotificationsScopeValue)
          : false;
        if (!hasTrainingGroup) {
          return false;
        }
      }
    }
    return true;
  });
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

  useEffect(() => {
    if (!clubId) return;

    const sendPresence = (action: "connect" | "disconnect") => {
      const blob = new Blob(
        [JSON.stringify({ clubId, action })],
        { type: "application/json" }
      );
      try {
        navigator.sendBeacon("/api/admin/track/presence", blob);
      } catch {
        // Presence tracking is best-effort and should not interrupt the admin page.
      }
    };

    const sendConnect = () => {
      sendPresence("connect");
    };

    const sendDisconnect = () => {
      sendPresence("disconnect");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendDisconnect();
      } else {
        sendConnect();
      }
    };

    sendConnect();
    window.addEventListener("pagehide", sendDisconnect);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", sendDisconnect);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sendDisconnect();
    };
  }, [clubId]);

  useEffect(() => {
    if (!clubId) {
      setClubNotifications([]);
      setClubNotificationsUnreadCount(0);
      setClubNotificationsDateFilter("");
      setClubNotificationsScopeType("team");
      setClubNotificationsScopeValue("all");
      return;
    }
    void fetchClubNotifications();
  }, [clubId]);

  useEffect(() => {
    if (!clubId) {
      return;
    }

    const streamUrl = `/api/admin/clubs/${encodeURIComponent(clubId)}/notifications/events`;
    const source = new EventSource(streamUrl, { withCredentials: true });

    source.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!payload || typeof payload !== "object") {
        return;
      }

      const type = "type" in payload ? String((payload as { type?: unknown }).type ?? "") : "";
      if (type !== "notification-created") {
        return;
      }

      void fetchClubNotifications();
    };

    source.onerror = () => {
      // Let browser auto-reconnect.
    };

    return () => {
      source.close();
    };
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

  const handleEnableClubNotifications = async () => {
    setClubPushStatusMessage("");
    setClubPushErrorMessage("");

    if (!clubId || !isClubPushSupported) {
      setClubPushErrorMessage("Този браузър не поддържа push известия или липсва HTTPS.");
      return;
    }

    setClubPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setClubPushErrorMessage("Достъпът до известия е отказан от браузъра.");
        setIsClubPushSubscribed(false);
        return;
      }

      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicKeyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
        if (!publicKeyResponse.ok) {
          const payload = await publicKeyResponse.json().catch(() => ({ error: "Missing VAPID configuration" }));
          throw new Error(String(payload.error ?? "Failed to get VAPID public key"));
        }
        const { publicKey } = (await publicKeyResponse.json()) as { publicKey: string };
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        });
      }

      const saveResponse = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/push-subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          ...(coachGroupId ? { coachGroupId } : {}),
        }),
      });

      if (!saveResponse.ok) {
        const payload = await saveResponse.json().catch(() => ({ error: "Failed to save subscription" }));
        throw new Error(String(payload.error ?? "Failed to save subscription"));
      }

      setIsClubPushSubscribed(true);
      const scopeLabel = coachGroupId
        ? (coachGroups.find((g) => g.id === coachGroupId)?.name ?? "тази група треньор")
        : "този отбор";
      setClubPushStatusMessage(`Известията за треньори са активирани за ${scopeLabel}.`);
    } catch (error) {
      console.error("Enable club notifications error:", error);
      setClubPushErrorMessage(error instanceof Error ? error.message : "Неуспешно активиране на известията.");
    } finally {
      setClubPushBusy(false);
    }
  };

  const handleDisableClubNotifications = async () => {
    setClubPushStatusMessage("");
    setClubPushErrorMessage("");

    if (!clubId) {
      return;
    }

    setClubPushBusy(true);
    try {
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsClubPushSubscribed(false);
        return;
      }

      const endpoint = subscription.endpoint;
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/push-subscriptions`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to disable subscription" }));
        throw new Error(String(payload.error ?? "Failed to disable subscription"));
      }

      setIsClubPushSubscribed(false);
      setClubPushStatusMessage("Известията за треньори са изключени за този отбор.");
    } catch (error) {
      console.error("Disable club notifications error:", error);
      setClubPushErrorMessage(error instanceof Error ? error.message : "Неуспешно изключване на известията.");
    } finally {
      setClubPushBusy(false);
    }
  };

  const fetchClubNotifications = async () => {
    if (!clubId) {
      setClubNotifications([]);
      setClubNotificationsUnreadCount(0);
      return;
    }

    setClubNotificationsLoading(true);
    try {
      const search = new URLSearchParams();
      if (coachGroupId) {
        search.set("coachGroupId", coachGroupId);
      }
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/notifications${search.size ? `?${search.toString()}` : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      setClubNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      setClubNotificationsUnreadCount(Number(payload.unreadCount ?? 0));
    } catch (error) {
      console.error("Failed to fetch club notifications:", error);
    } finally {
      setClubNotificationsLoading(false);
    }
  };

  const markClubNotificationsRead = async () => {
    if (!clubId) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/notifications/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(coachGroupId ? { coachGroupId } : {}),
        }),
      });
      if (!response.ok) {
        return;
      }

      const nowIso = new Date().toISOString();
      setClubNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? nowIso })));
      setClubNotificationsUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark club notifications as read:", error);
    }
  };

  const handleOpenClubNotificationsPanel = async () => {
    setClubNotificationsPanelOpen(true);
    await fetchClubNotifications();
    await markClubNotificationsRead();
  };

  useEffect(() => {
    const pushOpenTs = searchParams.get("pushOpenTs");
    const shouldOpenFromPush =
      searchParams.get("fromPush") === "1" &&
      searchParams.get("openCoachNotifications") === "1" &&
      Boolean(pushOpenTs);

    if (!shouldOpenFromPush || !pushOpenTs || pushOpenTs === lastHandledCoachPushOpenTs) {
      return;
    }

    setLastHandledCoachPushOpenTs(pushOpenTs);
    void handleOpenClubNotificationsPanel();

    const cleanedParams = new URLSearchParams(searchParams.toString());
    cleanedParams.delete("fromPush");
    cleanedParams.delete("openBell");
    cleanedParams.delete("openCoachNotifications");
    cleanedParams.delete("pushOpenTs");
    const cleanedQuery = cleanedParams.toString();
    const cleanPath = "/admin/members";
    router.replace(cleanedQuery ? `${cleanPath}?${cleanedQuery}` : cleanPath, { scroll: false });
  }, [lastHandledCoachPushOpenTs, router, searchParams]);

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
    setMemberCoachGroupAssignValue(null);
    setMemberCoachGroupAssignError("");
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
      const params = new URLSearchParams();
      if (clubId) params.set("clubId", clubId);
      if (coachGroupId) params.set("coachGroupId", coachGroupId);
      const endpoint = params.toString() ? `/api/admin/members?${params.toString()}` : "/api/admin/members";
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
    if (typeof window === "undefined") {
      return;
    }
    const ua = window.navigator.userAgent || "";
    setIsClubIPhone(/iPhone/i.test(ua));
    const standaloneByDisplayMode = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
    const standaloneByNavigator = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsClubStandalone(standaloneByDisplayMode || standaloneByNavigator);
  }, []);

  const clubPushScopeKey = `${clubId}|${coachGroupId}`;

  useEffect(() => {
    let cancelled = false;

    const syncClubPushState = async () => {
      setClubPushErrorMessage("");
      setClubPushStatusMessage("");

      if (!clubId || typeof window === "undefined") {
        if (!cancelled) {
          setIsClubPushSubscribed(false);
        }
        return;
      }

      const supportsPush =
        window.isSecureContext &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!supportsPush) {
        if (!cancelled) {
          setIsClubPushSupported(false);
          setIsClubPushSubscribed(false);
        }
        return;
      }

      if (!cancelled) {
        setIsClubPushSupported(true);
      }

      try {
        await navigator.serviceWorker.register("/sw.js");
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          if (!cancelled) {
            setIsClubPushSubscribed(false);
          }
          return;
        }

        const endpoint = subscription.endpoint.trim();
        const search = new URLSearchParams({ endpoint });
        if (coachGroupId) {
          search.set("coachGroupId", coachGroupId);
        }
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/push-subscriptions?${search.toString()}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          if (!cancelled) {
            setIsClubPushSubscribed(false);
          }
          return;
        }

        const payload = (await response.json()) as { isActive?: unknown };
        if (!cancelled) {
          setIsClubPushSubscribed(Boolean(payload.isActive));
        }
      } catch (error) {
        console.error("Club push state sync error:", error);
        if (!cancelled) {
          setIsClubPushSubscribed(false);
        }
      }
    };

    void syncClubPushState();

    return () => {
      cancelled = true;
    };
  }, [clubPushScopeKey]);

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
          const selectedMode = (selectedClub as Record<string, unknown>).trainingGroupMode;
          setTrainingGroupMode(selectedMode === "custom_group" ? "custom_group" : "team_group");
          setTrainingGroupModeDraft(selectedMode === "custom_group" ? "custom_group" : "team_group");

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

        const fetchParams = new URLSearchParams();
        if (clubId) fetchParams.set("clubId", clubId);
        if (coachGroupId) fetchParams.set("coachGroupId", coachGroupId);
        const endpoint = fetchParams.toString() ? `/api/admin/members?${fetchParams.toString()}` : "/api/admin/members";
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
        const selectedMode = (selectedClub as Record<string, unknown> | null)?.trainingGroupMode;
        setTrainingGroupMode(selectedMode === "custom_group" ? "custom_group" : "team_group");
        setTrainingGroupModeDraft(selectedMode === "custom_group" ? "custom_group" : "team_group");
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
    void loadCoachGroups();
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

  useEffect(() => {
    setSelectedGroup("all");
  }, [trainingGroupMode]);

  /* ── Derived ── */
  const groupOptions = [...new Set(
    members.filter((m) => m.isActive).map((m) => m.teamGroup).filter((g): g is number => g !== null)
  )].sort((a, b) => a - b);
  const activeMembersByGroup = members.reduce<Record<number, number>>((acc, member) => {
    if (!member.isActive || member.teamGroup === null) {
      return acc;
    }
    acc[member.teamGroup] = (acc[member.teamGroup] ?? 0) + 1;
    return acc;
  }, {});
  const resolvedTrainingGroupScope = groupOptions.some((group) => String(group) === trainingGroupScope)
    ? trainingGroupScope
    : (groupOptions[0] ? String(groupOptions[0]) : "");
  const selectedTeamGroup = parseSelectedTeamGroup(resolvedTrainingGroupScope);
  const selectedTrainingGroup = trainingScheduleGroups.find((group) => group.id === selectedTrainingGroupId) ?? null;
  const selectedCustomGroup = customTrainingGroups.find((group) => group.id === selectedTrainingGroupId) ?? null;
  const currentCoachGroupName = coachGroupId
    ? (coachGroups.find((group) => group.id === coachGroupId)?.name.trim() ?? "")
    : "";
  const isCustomTrainingGroupMode = trainingGroupMode === "custom_group";
  const activeMemberIdSet = new Set(members.filter((m) => m.isActive).map((m) => m.id));
  const activeMembersByCustomGroup = customTrainingGroups.reduce<Record<string, number>>((acc, group) => {
    acc[group.id] = group.playerIds.filter((id) => activeMemberIdSet.has(id)).length;
    return acc;
  }, {});
  const customTrainingGroupAssignedPlayerIds = new Set(customTrainingGroups.flatMap((group) => group.playerIds));
  const customTrainingGroupEditPlayerIdsSet = new Set(trainingGroupEditPlayerIds);
  const customTrainingGroupEditOriginalPlayerIds = new Set(
    customTrainingGroups.find((g) => g.id === trainingGroupEditId)?.playerIds ?? [],
  );
  const availablePlayersForCustomGroupCreate = members.filter(
    (member) => member.isActive && !customTrainingGroupAssignedPlayerIds.has(member.id),
  );
  const availablePlayersForCustomGroupEdit = members.filter(
    (member) =>
      member.isActive &&
      (!customTrainingGroupAssignedPlayerIds.has(member.id) || customTrainingGroupEditOriginalPlayerIds.has(member.id)),
  );
  const trainingGroupTeamGroupSet = new Set(trainingScheduleGroups.flatMap((g) => g.teamGroups));
  const standaloneTeamGroups = groupOptions.filter((g) => !trainingGroupTeamGroupSet.has(g));
  const unifiedGroupScopeValue =
    isCustomTrainingGroupMode
      ? (selectedTrainingGroupId || "")
      : trainingAttendanceView === "trainingGroups"
      ? (selectedTrainingGroupId || "")
      : `year:${resolvedTrainingGroupScope}`;
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
  const normalizedTrainingDateTimesSelection = normalizeTrainingDateTimes(
    trainingDateTimes,
    normalizedTrainingDaysSelection,
    trainingTimeMode === "all" ? schedulerForm.trainingTime : null,
  );
  const normalizedTrainingDateTimesInitial = normalizeTrainingDateTimes(
    trainingDaysInitialDateTimes,
    normalizedTrainingDaysInitial,
    "",
  );
  const hasMissingTrainingTime =
    normalizedTrainingDaysSelection.length > 0 &&
    normalizedTrainingDaysSelection.some((date) => !TRAINING_TIME_REGEX.test((normalizedTrainingDateTimesSelection[date] ?? "").trim()));
  const normalizedTrainingDateTimesSelectionKey = normalizedTrainingDaysSelection
    .map((date) => `${date}:${normalizedTrainingDateTimesSelection[date] ?? ""}`)
    .join("|");
  const normalizedTrainingDateTimesInitialKey = normalizedTrainingDaysInitial
    .map((date) => `${date}:${normalizedTrainingDateTimesInitial[date] ?? ""}`)
    .join("|");
  const isTrainingDaysScheduleUnchanged =
    trainingDaysEditorMode !== "createGroup" &&
    normalizedTrainingDaysSelection.join("|") === normalizedTrainingDaysInitial.join("|") &&
    normalizedTrainingDateTimesSelectionKey === normalizedTrainingDateTimesInitialKey;
  const trainingWeekdayBuckets = Array.from(
    new Set(
      normalizedTrainingDaysSelection
        .map((date) => getWeekdayMondayFirstIndex(date))
        .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6),
    ),
  ).sort((a, b) => a - b);
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

  useEffect(() => {
    setTrainingDateTimes((prev) => {
      const selected = new Set(schedulerForm.trainingDates);
      let changed = false;
      const next: Record<string, string> = {};
      for (const date of schedulerForm.trainingDates) {
        const value = (prev[date] ?? "").trim();
        if (value) {
          next[date] = value;
        }
      }
      if (Object.keys(prev).length !== Object.keys(next).length) {
        changed = true;
      } else {
        for (const key of Object.keys(prev)) {
          if (!selected.has(key) || prev[key] !== next[key]) {
            changed = true;
            break;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [schedulerForm.trainingDates]);

  useEffect(() => {
    if (trainingTimeMode === "all") {
      return;
    }
    if (schedulerForm.trainingDates.length === 0) {
      if (schedulerForm.trainingTime) {
        setSchedulerForm((prev) => ({ ...prev, trainingTime: "" }));
      }
      return;
    }

    const firstTime = schedulerForm.trainingDates
      .map((date) => (trainingDateTimes[date] ?? "").trim())
      .find((value) => TRAINING_TIME_REGEX.test(value)) ?? "";

    if (firstTime && firstTime !== schedulerForm.trainingTime) {
      setSchedulerForm((prev) => ({ ...prev, trainingTime: firstTime }));
    }
  }, [schedulerForm.trainingDates, schedulerForm.trainingTime, trainingDateTimes, trainingTimeMode]);

  const filtered = members.filter((m) => {
    if (!m.isActive) return false;

    const matchGroup = selectedGroup === "all"
      || (isCustomTrainingGroupMode
        ? (customTrainingGroups.find((g) => g.id === selectedGroup)?.playerIds ?? []).includes(m.id)
        : String(m.teamGroup) === selectedGroup);
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

  const enableSecondReminder = () => {
    setSecondReminderEnabled(true);
    setSchedulerForm((prev) => {
      const primaryDay = Number.parseInt(prev.reminderDay, 10);
      const fallbackDay = Number.isInteger(primaryDay)
        ? Math.min(28, Math.max(1, primaryDay < 28 ? primaryDay + 1 : primaryDay - 1))
        : 26;
      return {
        ...prev,
        secondReminderDay: prev.secondReminderDay || String(fallbackDay),
        secondReminderHour: prev.secondReminderHour || "10",
        secondReminderMinute: prev.secondReminderMinute || "0",
      };
    });
  };

  const disableSecondReminder = () => {
    setSecondReminderEnabled(false);
    setSchedulerForm((prev) => ({
      ...prev,
      secondReminderDay: "",
      secondReminderHour: "10",
      secondReminderMinute: "0",
    }));
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
      const resolvedTrainingDates = Array.isArray(payload.trainingDates)
        ? payload.trainingDates
          .map((value: unknown) => String(value ?? "").trim())
          .filter((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value))
          .sort((a: string, b: string) => a.localeCompare(b))
        : [];
      const resolvedDateTimes = normalizeTrainingDateTimes(
        payload.trainingDateTimes,
        resolvedTrainingDates,
        typeof payload.trainingTime === "string" ? payload.trainingTime : null,
      );
      const resolvedUniformTime =
        getUniformTrainingTime(
          resolvedTrainingDates,
          resolvedDateTimes,
        ) ||
        (typeof payload.trainingTime === "string" && TRAINING_TIME_REGEX.test(payload.trainingTime.trim())
          ? payload.trainingTime.trim()
          : "");
      const hasSecondReminder =
        Number.isInteger(payload.secondReminderDay) &&
        Number.isInteger(payload.secondReminderHour) &&
        Number.isInteger(payload.secondReminderMinute);
      setSchedulerForm({
        reminderDay: String(payload.reminderDay ?? 25),
        overdueDay: String(payload.overdueDay ?? 1),
        reminderHour: String(payload.reminderHour ?? 10),
        reminderMinute: String(payload.reminderMinute ?? 0),
        secondReminderDay: hasSecondReminder ? String(payload.secondReminderDay) : "",
        secondReminderHour: hasSecondReminder ? String(payload.secondReminderHour) : "10",
        secondReminderMinute: hasSecondReminder ? String(payload.secondReminderMinute) : "0",
        overdueHour: String(payload.overdueHour ?? 10),
        overdueMinute: String(payload.overdueMinute ?? 0),
        trainingDates: resolvedTrainingDates,
        trainingTime: resolvedUniformTime,
      });
      setSecondReminderEnabled(hasSecondReminder);
      setTrainingDateTimes(resolvedDateTimes);
      setTrainingTimeMode(inferTrainingTimeMode(resolvedTrainingDates, resolvedDateTimes));
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
            trainingTime:
              typeof raw.trainingTime === "string" && TRAINING_TIME_REGEX.test(raw.trainingTime.trim())
                ? raw.trainingTime.trim()
                : null,
            trainingDateTimes: normalizeTrainingDateTimes(
              raw.trainingDateTimes,
              trainingDates,
              typeof raw.trainingTime === "string" ? raw.trainingTime : null,
            ),
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

  const loadCustomTrainingGroups = async (): Promise<CustomTrainingGroup[]> => {
    if (!clubId) return [];
    setTrainingScheduleGroupsLoading(true);
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load custom training groups.");
      }
      const payload: unknown = await response.json();
      const groups = Array.isArray(payload)
        ? payload.map((item) => {
          const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
          const trainingDates = Array.isArray(raw.trainingDates)
            ? raw.trainingDates
              .map((value) => String(value ?? "").trim())
              .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
              .sort((a, b) => a.localeCompare(b))
            : [];
          const playerIds = Array.isArray(raw.playerIds)
            ? raw.playerIds.map((value) => String(value ?? "").trim()).filter(Boolean)
            : [];
          return {
            id: String(raw.id ?? ""),
            name: String(raw.name ?? "").trim(),
            playerIds,
            trainingDates,
            trainingTime:
              typeof raw.trainingTime === "string" && TRAINING_TIME_REGEX.test(raw.trainingTime.trim())
                ? raw.trainingTime.trim()
                : null,
            trainingDateTimes: normalizeTrainingDateTimes(
              raw.trainingDateTimes,
              trainingDates,
              typeof raw.trainingTime === "string" ? raw.trainingTime : null,
            ),
          } satisfies CustomTrainingGroup;
        }).filter((group) => group.id && group.name)
        : [];
      setCustomTrainingGroups(groups);
      setSelectedTrainingGroupId((prev) => {
        if (prev && groups.some((group) => group.id === prev)) {
          return prev;
        }
        return groups[0]?.id ?? "";
      });
      return groups;
    } catch {
      setCustomTrainingGroups([]);
      setSelectedTrainingGroupId("");
      return [];
    } finally {
      setTrainingScheduleGroupsLoading(false);
    }
  };

  const loadCoachGroups = async (): Promise<CoachGroup[]> => {
    if (!clubId) return [];
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups`, {
        cache: "no-store",
      });
      if (!response.ok) return [];
      const payload: unknown = await response.json();
      const groups: CoachGroup[] = Array.isArray(payload)
        ? payload
          .map((item) => {
            const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
            return {
              id: String(raw.id ?? ""),
              name: String(raw.name ?? "").trim(),
              playerCount: typeof raw.playerCount === "number" ? raw.playerCount : 0,
            };
          })
          .filter((g) => g.id && g.name)
        : [];
      setCoachGroups(groups);
      return groups;
    } catch {
      return [];
    }
  };

  const saveTrainingGroupMode = async (nextMode: "team_group" | "custom_group") => {
    if (!clubId || trainingGroupModeSaving) return;
    if (nextMode === trainingGroupMode) {
      setTrainingGroupModeSettingsOpen(false);
      setTrainingGroupModeError("");
      return;
    }
    setTrainingGroupModeSaving(true);
    setTrainingAttendanceError("");
    setTrainingGroupModeError("");
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-group-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingGroupMode: nextMode }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to save training group mode.");
      }
      setTrainingGroupMode(nextMode);
      setTrainingGroupModeDraft(nextMode);
      setSelectedTrainingGroupId("");
      setTrainingAttendancePlayers([]);
      setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
      setTrainingUpcomingDates([]);
      if (nextMode === "custom_group") {
        await loadCustomTrainingGroups();
      } else {
        await loadTrainingScheduleGroups();
      }
      setTrainingGroupModeSettingsOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save training group mode.";
      setTrainingGroupModeError(message);
      setTrainingAttendanceError(message);
    } finally {
      setTrainingGroupModeSaving(false);
    }
  };

  const openTrainingGroupModeSettings = () => {
    setTrainingGroupModeDraft(trainingGroupMode);
    setTrainingGroupModeError("");
    setTrainingGroupModeSettingsOpen(true);
  };

  const openTrainingGroupCreateModal = () => {
    setTrainingGroupCreateError("");
    setTrainingGroupCreateGroups([]);
    setTrainingGroupCreateName("");
    setTrainingGroupCreatePlayerIds([]);
    setTrainingGroupCreateOpen(true);
  };

  const openTrainingGroupEditModal = (groupId: string) => {
    if (isCustomTrainingGroupMode) {
      const group = customTrainingGroups.find((item) => item.id === groupId);
      if (!group) {
        setTrainingAttendanceError("Custom training group not found.");
        return;
      }
      setTrainingGroupEditError("");
      setTrainingGroupEditId(group.id);
      setTrainingGroupEditName(group.name);
      setTrainingGroupEditPlayerIds(group.playerIds);
      setTrainingGroupEditOpen(true);
      return;
    }
    const group = trainingScheduleGroups.find((item) => item.id === groupId);
    if (!group) {
      setTrainingAttendanceError("Сборният отбор не е намерен.");
      return;
    }
    const initialGroups = group.teamGroups.map((value) => String(value));
    setTrainingGroupEditError("");
    setTrainingGroupEditId(group.id);
    setTrainingGroupEditGroups(initialGroups);
    setTrainingGroupEditName(group.name || initialGroups.slice().sort((a, b) => Number(a) - Number(b)).join("/"));
    setTrainingGroupEditOpen(true);
  };

  const saveTrainingGroupFromModal = async () => {
    if (!clubId || trainingGroupCreateSaving) return;
    setTrainingGroupCreateSaving(true);
    setTrainingGroupCreateError("");
    try {
      if (isCustomTrainingGroupMode) {
        const name = trainingGroupCreateName.trim();
        if (!name) {
          throw new Error("Enter a group name.");
        }
        const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            playerIds: trainingGroupCreatePlayerIds,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to create custom training group.");
        }
        setTrainingGroupCreateOpen(false);
        await loadCustomTrainingGroups();
        return;
      }
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
          name: defaultName,
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
      if (isCustomTrainingGroupMode) {
        const name = trainingGroupEditName.trim();
        if (!name) {
          throw new Error("Enter a group name.");
        }
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups/${encodeURIComponent(trainingGroupEditId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              playerIds: trainingGroupEditPlayerIds,
            }),
          },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to edit custom training group.");
        }
        setTrainingGroupEditOpen(false);
        const refreshedGroups = await loadCustomTrainingGroups();
        const fallbackId = refreshedGroups.some((group) => group.id === trainingGroupEditId)
          ? trainingGroupEditId
          : refreshedGroups[0]?.id ?? "";
        setSelectedTrainingGroupId(fallbackId);
        if (trainingAttendanceOpen && fallbackId) {
          await fetchTrainingAttendance(undefined, undefined, fallbackId, "trainingGroups");
        }
        return;
      }
      const selectedGroups = trainingGroupEditGroups
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value));
      if (selectedGroups.length < 2) {
        throw new Error("Изберете поне 2 набора.");
      }

      const generatedName = selectedGroups
        .slice()
        .sort((a, b) => a - b)
        .map((value) => String(value))
        .join("/");
      const nextName = trainingGroupEditName.trim() || generatedName;

      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups/${encodeURIComponent(trainingGroupEditId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nextName,
            teamGroups: selectedGroups,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешна редакция на сборния отбор.");
      }

      setTrainingGroupEditOpen(false);
      const refreshedGroups = isCustomTrainingGroupMode
        ? await loadCustomTrainingGroups()
        : await loadTrainingScheduleGroups();
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
        isCustomTrainingGroupMode
          ? `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups/${encodeURIComponent(selectedTrainingGroupId)}`
          : `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups/${encodeURIComponent(selectedTrainingGroupId)}`,
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
      const refreshedGroups = isCustomTrainingGroupMode
        ? await loadCustomTrainingGroups()
        : await loadTrainingScheduleGroups();
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

  const openTrainingDaysEditor = async (mode: "teamGroup" | "createGroup" | "trainingGroup" | "customGroup" | "coachGroup" = "teamGroup") => {
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
    setTrainingDaysInitialDateTimes({});
    setTrainingDateTimes({});
    setTrainingTimeMode("all");
    setTrainingDaysEditorLoading(true);
    const loadedGroups = isCustomTrainingGroupMode ? [] : await loadTrainingScheduleGroups();
    const loadedCustomGroups = isCustomTrainingGroupMode ? await loadCustomTrainingGroups() : [];
    try {
      if (mode === "customGroup") {
        const resolvedGroup =
          loadedCustomGroups.find((group) => group.id === selectedTrainingGroupId) ??
          customTrainingGroups.find((group) => group.id === selectedTrainingGroupId) ??
          null;
        if (!resolvedGroup) {
          throw new Error("Select a custom training group.");
        }
        const nextWindowDates = [...resolvedGroup.trainingDates]
          .map((value) => String(value ?? "").trim())
          .filter((value) => schedulerCalendarDateSet.has(value))
          .sort((a, b) => a.localeCompare(b));
        const resolvedDateTimes = normalizeTrainingDateTimes(
          resolvedGroup.trainingDateTimes,
          nextWindowDates,
          resolvedGroup.trainingTime ?? null,
        );
        const resolvedUniformTime = getUniformTrainingTime(nextWindowDates, resolvedDateTimes);
        setSchedulerForm((prev) => ({
          ...prev,
          trainingDates: nextWindowDates,
          trainingTime: resolvedUniformTime,
        }));
        setTrainingDaysInitialDates(nextWindowDates);
        setTrainingDateTimes(resolvedDateTimes);
        setTrainingDaysInitialDateTimes(resolvedDateTimes);
        setTrainingTimeMode(inferTrainingTimeMode(nextWindowDates, resolvedDateTimes));
        setTrainingDaysEditorOpen(true);
        return;
      }
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
        const resolvedDateTimes = normalizeTrainingDateTimes(
          resolvedGroup.trainingDateTimes,
          nextWindowDates,
          resolvedGroup.trainingTime ?? null,
        );
        const resolvedUniformTime = getUniformTrainingTime(nextWindowDates, resolvedDateTimes);
        setSchedulerForm((prev) => ({
          ...prev,
          trainingDates: nextWindowDates,
          trainingTime: resolvedUniformTime,
        }));
        setTrainingDaysInitialDates(nextWindowDates);
        setTrainingDateTimes(resolvedDateTimes);
        setTrainingDaysInitialDateTimes(resolvedDateTimes);
        setTrainingTimeMode(inferTrainingTimeMode(nextWindowDates, resolvedDateTimes));
        setTrainingDaysEditorOpen(true);
        return;
      }
      if (mode === "coachGroup") {
        if (!coachGroupId) throw new Error("Няма избрана треньорска група.");
        const cgResponse = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups/${encodeURIComponent(coachGroupId)}/schedule`,
          { cache: "no-store" },
        );
        if (!cgResponse.ok) {
          const cgPayload = await cgResponse.json().catch(() => ({}));
          throw new Error((cgPayload as { error?: unknown }).error as string || "Неуспешно зареждане на графика.");
        }
        const cgPayload = await cgResponse.json();
        const nextWindowDates = Array.isArray(cgPayload.trainingDates)
          ? (cgPayload.trainingDates as unknown[])
              .map((v) => String(v ?? "").trim())
              .filter((v) => schedulerCalendarDateSet.has(v))
              .sort((a, b) => a.localeCompare(b))
          : [];
        const resolvedDateTimes = normalizeTrainingDateTimes(
          cgPayload.trainingDateTimes,
          nextWindowDates,
          typeof cgPayload.trainingTime === "string" ? cgPayload.trainingTime : null,
        );
        const resolvedUniformTime = getUniformTrainingTime(nextWindowDates, resolvedDateTimes);
        setSchedulerForm((prev) => ({
          ...prev,
          trainingDates: nextWindowDates,
          trainingTime: resolvedUniformTime,
        }));
        setTrainingDaysInitialDates(nextWindowDates);
        setTrainingDateTimes(resolvedDateTimes);
        setTrainingDaysInitialDateTimes(resolvedDateTimes);
        setTrainingTimeMode(inferTrainingTimeMode(nextWindowDates, resolvedDateTimes));
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
      const resolvedDateTimes = mode === "createGroup"
        ? {}
        : normalizeTrainingDateTimes(
          payload.trainingDateTimes,
          resolvedTrainingDates,
          typeof payload.trainingTime === "string" ? payload.trainingTime : null,
        );
      const resolvedUniformTime = getUniformTrainingTime(resolvedTrainingDates, resolvedDateTimes);
      const hasSecondReminder =
        Number.isInteger(payload.secondReminderDay) &&
        Number.isInteger(payload.secondReminderHour) &&
        Number.isInteger(payload.secondReminderMinute);
      setSchedulerForm({
        reminderDay: String(payload.reminderDay ?? 25),
        overdueDay: String(payload.overdueDay ?? 1),
        reminderHour: String(payload.reminderHour ?? 10),
        reminderMinute: String(payload.reminderMinute ?? 0),
        secondReminderDay: hasSecondReminder ? String(payload.secondReminderDay) : "",
        secondReminderHour: hasSecondReminder ? String(payload.secondReminderHour) : "10",
        secondReminderMinute: hasSecondReminder ? String(payload.secondReminderMinute) : "0",
        overdueHour: String(payload.overdueHour ?? 10),
        overdueMinute: String(payload.overdueMinute ?? 0),
        trainingDates: resolvedTrainingDates,
        trainingTime: resolvedUniformTime,
      });
      setSecondReminderEnabled(hasSecondReminder);
      setTrainingDaysInitialDates(resolvedTrainingDates);
      setTrainingDateTimes(resolvedDateTimes);
      setTrainingDaysInitialDateTimes(resolvedDateTimes);
      setTrainingTimeMode(inferTrainingTimeMode(resolvedTrainingDates, resolvedDateTimes));
      setTrainingDaysEditorOpen(true);
    } catch (error) {
      setTrainingDaysEditorError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingDaysEditorLoading(false);
    }
  };

  const executeTeamGroupTrainingDaysSave = async (affectedTrainingGroupsSnapshot: Array<{ id: string; name: string }>) => {
    const normalizedTrainingTime = schedulerForm.trainingTime.trim();
    if (hasMissingTrainingTime) {
      throw new Error("Въведете валиден час на тренировка (HH:mm).");
    }
    const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/scheduler`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderDay: Number.parseInt(schedulerForm.reminderDay, 10),
        overdueDay: Number.parseInt(schedulerForm.overdueDay, 10),
        reminderHour: Number.parseInt(schedulerForm.reminderHour, 10),
        reminderMinute: Number.parseInt(schedulerForm.reminderMinute, 10),
        secondReminderDay: secondReminderEnabled ? Number.parseInt(schedulerForm.secondReminderDay, 10) : null,
        secondReminderHour: secondReminderEnabled ? Number.parseInt(schedulerForm.secondReminderHour, 10) : null,
        secondReminderMinute: secondReminderEnabled ? Number.parseInt(schedulerForm.secondReminderMinute, 10) : null,
        overdueHour: Number.parseInt(schedulerForm.overdueHour, 10),
        overdueMinute: Number.parseInt(schedulerForm.overdueMinute, 10),
        trainingDates: schedulerForm.trainingDates,
        trainingTime: normalizedTrainingTime || null,
        trainingDateTimes: normalizeTrainingDateTimes(
          trainingDateTimes,
          schedulerForm.trainingDates,
          trainingTimeMode === "all" ? normalizedTrainingTime : null,
        ),
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
      if (trainingDaysEditorMode === "trainingGroup" || trainingDaysEditorMode === "customGroup" || trainingDaysEditorMode === "coachGroup") {
        const normalizedTrainingTime = schedulerForm.trainingTime.trim();
        if (hasMissingTrainingTime) {
          throw new Error("Въведете валиден час на тренировка (HH:mm).");
        }
        const nextTrainingDates = schedulerForm.trainingDates
          .map((value) => String(value ?? "").trim())
          .filter((value) => schedulerCalendarDateSet.has(value))
          .sort((a, b) => a.localeCompare(b));
        const nextTrainingDateTimes = normalizeTrainingDateTimes(
          trainingDateTimes,
          nextTrainingDates,
          trainingTimeMode === "all" ? normalizedTrainingTime : null,
        );
        const nextTrainingDateTimesKey = nextTrainingDates
          .map((date) => `${date}:${nextTrainingDateTimes[date] ?? ""}`)
          .join("|");
        const initialTrainingDateTimesKey = normalizedTrainingDaysInitial
          .map((date) => `${date}:${normalizedTrainingDateTimesInitial[date] ?? ""}`)
          .join("|");
        if (
          nextTrainingDates.join("|") === normalizedTrainingDaysInitial.join("|") &&
          nextTrainingDateTimesKey === initialTrainingDateTimesKey
        ) {
          throw new Error("Графикът е същият като предишния.");
        }
        const groupResponse = await fetch(
          trainingDaysEditorMode === "customGroup"
            ? `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups/${encodeURIComponent(selectedTrainingGroupId)}`
            : trainingDaysEditorMode === "coachGroup"
              ? `/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups/${encodeURIComponent(coachGroupId)}/schedule`
              : `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups/${encodeURIComponent(selectedTrainingGroupId)}`,
          {
            method: trainingDaysEditorMode === "coachGroup" ? "PUT" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trainingDates: nextTrainingDates,
              trainingTime: normalizedTrainingTime || null,
              trainingDateTimes: normalizeTrainingDateTimes(
                trainingDateTimes,
                nextTrainingDates,
                trainingTimeMode === "all" ? normalizedTrainingTime : null,
              ),
            }),
          },
        );
        if (!groupResponse.ok) {
          const payload = await groupResponse.json().catch(() => ({}));
          throw new Error((payload as { error?: unknown }).error as string || "Неуспешно запазване на тренировъчните дни.");
        }
        setTrainingDaysEditorCreateOpen(false);
        setTrainingDaysEditorGroupName("");
        setTrainingDaysEditorGroups([]);
        if (trainingDaysEditorMode === "coachGroup") {
          setTrainingDaysEditorOpen(false);
        } else if (trainingDaysEditorMode === "customGroup") {
          await loadCustomTrainingGroups();
          await fetchTrainingAttendance(trainingAttendanceDate);
          setTrainingDaysEditorOpen(false);
        } else {
          await loadTrainingScheduleGroups();
          await fetchTrainingAttendance(trainingAttendanceDate);
          setTrainingDaysEditorOpen(false);
        }
        setTrainingDaysSuccessMessage(
          nextTrainingDates.length > 1
            ? `Промените по графика са изпратени успешно за ${nextTrainingDates.length} дни.`
            : "Промените по графика са изпратени успешно.",
        );
        setTrainingDaysSuccessOpen(true);
        return;
      }

      if (
        normalizedTrainingDaysSelection.join("|") === normalizedTrainingDaysInitial.join("|") &&
        normalizedTrainingDateTimesSelectionKey === normalizedTrainingDateTimesInitialKey
      ) {
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
      const normalizedTrainingTime = schedulerForm.trainingTime.trim();
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/scheduler`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderDay: Number.parseInt(schedulerForm.reminderDay, 10),
          overdueDay: Number.parseInt(schedulerForm.overdueDay, 10),
          reminderHour: Number.parseInt(schedulerForm.reminderHour, 10),
          reminderMinute: Number.parseInt(schedulerForm.reminderMinute, 10),
          secondReminderDay: secondReminderEnabled ? Number.parseInt(schedulerForm.secondReminderDay, 10) : null,
          secondReminderHour: secondReminderEnabled ? Number.parseInt(schedulerForm.secondReminderHour, 10) : null,
          secondReminderMinute: secondReminderEnabled ? Number.parseInt(schedulerForm.secondReminderMinute, 10) : null,
          overdueHour: Number.parseInt(schedulerForm.overdueHour, 10),
          overdueMinute: Number.parseInt(schedulerForm.overdueMinute, 10),
          trainingDates: schedulerForm.trainingDates,
          trainingTime: normalizedTrainingTime || null,
          trainingDateTimes: normalizeTrainingDateTimes(
            trainingDateTimes,
            schedulerForm.trainingDates,
            trainingTimeMode === "all" ? normalizedTrainingTime : null,
          ),
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

  const handleTrainingTimeModeChange = (mode: TrainingTimeMode) => {
    setTrainingTimeMode(mode);
    if (mode === "all") {
      const current = schedulerForm.trainingTime.trim();
      if (TRAINING_TIME_REGEX.test(current)) {
        setTrainingDateTimes((prev) => {
          const next = { ...prev };
          for (const date of schedulerForm.trainingDates) {
            next[date] = current;
          }
          return next;
        });
      } else {
        const uniform = getUniformTrainingTime(schedulerForm.trainingDates, trainingDateTimes);
        if (uniform) {
          setSchedulerForm((prev) => ({ ...prev, trainingTime: uniform }));
        }
      }
    }
  };

  const handleTrainingAllTimeChange = (value: string) => {
    const nextValue = value.trim();
    setSchedulerForm((prev) => ({
      ...prev,
      trainingTime: nextValue,
    }));
    if (!TRAINING_TIME_REGEX.test(nextValue)) {
      return;
    }
    setTrainingDateTimes((prev) => {
      const next = { ...prev };
      for (const date of schedulerForm.trainingDates) {
        next[date] = nextValue;
      }
      return next;
    });
  };

  const handleTrainingDateTimeChange = (date: string, value: string) => {
    const nextValue = value.trim();
    setTrainingDateTimes((prev) => ({
      ...prev,
      [date]: nextValue,
    }));
  };

  const handleTrainingWeekdayTimeChange = (weekdayIndex: number, value: string) => {
    const nextValue = value.trim();
    setTrainingDateTimes((prev) => {
      const next = { ...prev };
      for (const date of schedulerForm.trainingDates) {
        if (getWeekdayMondayFirstIndex(date) === weekdayIndex) {
          next[date] = nextValue;
        }
      }
      return next;
    });
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
    setTrainingDateTimes((prev) => {
      const next = { ...prev };
      const hasDate = Object.prototype.hasOwnProperty.call(next, date);
      if (hasDate) {
        delete next[date];
      } else if (trainingTimeMode === "all" && TRAINING_TIME_REGEX.test(schedulerForm.trainingTime.trim())) {
        next[date] = schedulerForm.trainingTime.trim();
      } else if (trainingTimeMode === "byWeekday") {
        const weekdayIndex = getWeekdayMondayFirstIndex(date);
        const weekdayMatch = schedulerForm.trainingDates.find(
          (existingDate) => getWeekdayMondayFirstIndex(existingDate) === weekdayIndex && TRAINING_TIME_REGEX.test((next[existingDate] ?? "").trim()),
        );
        if (weekdayMatch) {
          next[date] = (next[weekdayMatch] ?? "").trim();
        }
      }
      return next;
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
        search.set(isCustomTrainingGroupMode ? "customTrainingGroupId" : "trainingGroupId", trainingGroupFilter);
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
              trainingTime:
                typeof raw.trainingTime === "string" && TRAINING_TIME_REGEX.test(raw.trainingTime.trim())
                  ? raw.trainingTime.trim()
                  : null,
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

  const fetchTrainingTodaySessions = async () => {
    if (!clubId) return;
    setTrainingTodayLoading(true);
    setTrainingAttendanceError("");
    try {
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance/today`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Неуспешно зареждане на тренировките за днес.",
        );
      }
      const payload = await response.json();
      const sessions = Array.isArray(payload?.sessions)
        ? payload.sessions.map((item: unknown) => {
          const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
          const rawStats =
            typeof raw.stats === "object" && raw.stats !== null
              ? (raw.stats as Record<string, unknown>)
              : {};
          return {
            id: String(raw.id ?? ""),
            scopeType: raw.scopeType === "trainingGroup" ? "trainingGroup" : "teamGroup",
            label: String(raw.label ?? ""),
            teamGroups: Array.isArray(raw.teamGroups)
              ? raw.teamGroups
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value))
              : [],
            stats: {
              total: Number(rawStats.total ?? 0),
              attending: Number(rawStats.attending ?? 0),
              optedOut: Number(rawStats.optedOut ?? 0),
            },
          } satisfies TrainingTodaySessionItem;
        })
        : [];
      setTrainingTodaySessions(sessions);
      setTrainingTodayDate(
        typeof payload?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
          ? payload.date
          : getTodayIsoDate(),
      );
      setTrainingTodayNote(typeof payload?.note === "string" ? payload.note : "");
    } catch (error) {
      setTrainingTodaySessions([]);
      setTrainingTodayNote("");
      setTrainingAttendanceError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingTodayLoading(false);
    }
  };

  const openTrainingAttendance = async () => {
    if (!clubId) return;
    setTrainingAttendanceOpen(true);
    setPostTeamGroupSavePromptOpen(false);
    setTrainingAttendanceView("trainingGroups");
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingNoteTargetDates([]);
    const groups = isCustomTrainingGroupMode ? await loadCustomTrainingGroups() : await loadTrainingScheduleGroups();
    const resolvedGroupId =
      selectedTrainingGroupId && groups.some((g) => g.id === selectedTrainingGroupId)
        ? selectedTrainingGroupId
        : (groups[0]?.id ?? "");
    setSelectedTrainingGroupId(resolvedGroupId);
    if (resolvedGroupId) {
      await fetchTrainingAttendance(undefined, undefined, resolvedGroupId, "trainingGroups");
    } else {
      // No training groups — fall back to first standalone team group
      if (isCustomTrainingGroupMode) {
        setTrainingAttendancePlayers([]);
        setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
        setTrainingUpcomingDates([]);
        setTrainingAttendanceDate("");
        return;
      }
      const firstStandalone = standaloneTeamGroups[0];
      if (firstStandalone !== undefined) {
        const yearStr = String(firstStandalone);
        setTrainingAttendanceView("teamGroup");
        setTrainingGroupScope(yearStr);
        await fetchTrainingAttendance(undefined, yearStr, undefined, "teamGroup");
      } else if (resolvedTrainingGroupScope) {
        setTrainingAttendanceView("teamGroup");
        await fetchTrainingAttendance(undefined, resolvedTrainingGroupScope, undefined, "teamGroup");
      } else {
        setTrainingAttendancePlayers([]);
        setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
        setTrainingUpcomingDates([]);
        setTrainingAttendanceDate("");
      }
    }
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

  const handleTrainingAttendanceViewChange = async (nextView: "teamGroup" | "trainingGroups" | "today") => {
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

    if (nextView === "today") {
      await fetchTrainingTodaySessions();
      return;
    }

    if (nextView === "teamGroup") {
      // Internally kept for standalone team group selections
      await fetchTrainingAttendance(undefined, resolvedTrainingGroupScope, undefined, "teamGroup");
      return;
    }

    const groups = isCustomTrainingGroupMode
      ? (customTrainingGroups.length > 0 ? customTrainingGroups : await loadCustomTrainingGroups())
      : (trainingScheduleGroups.length > 0 ? trainingScheduleGroups : await loadTrainingScheduleGroups());
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

  const handleUnifiedGroupChange = async (value: string) => {
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingAttendanceError("");
    setTrainingNoteTargetDates([]);
    if (value.startsWith("year:")) {
      const yearStr = value.slice(5);
      setTrainingAttendanceView("teamGroup");
      setTrainingGroupScope(yearStr);
      if (trainingAttendanceOpen) {
        await fetchTrainingAttendance(undefined, yearStr, undefined, "teamGroup");
      }
    } else {
      setTrainingAttendanceView("trainingGroups");
      setSelectedTrainingGroupId(value);
      if (trainingAttendanceOpen && value) {
        await fetchTrainingAttendance(undefined, undefined, value, "trainingGroups");
      }
    }
  };

  const openTrainingDaysEditorForCurrentScope = async () => {
    if (trainingAttendanceView === "trainingGroups") {
      if (!selectedTrainingGroupId) {
        setTrainingAttendanceError("Изберете сборен отбор.");
        return;
      }
      await openTrainingDaysEditor(isCustomTrainingGroupMode ? "customGroup" : "trainingGroup");
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
              search.set(isCustomTrainingGroupMode ? "customTrainingGroupId" : "trainingGroupId", selectedTrainingGroupId);
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
            ? isCustomTrainingGroupMode
              ? { customTrainingGroupId: selectedTrainingGroupId || null }
              : { trainingGroupId: selectedTrainingGroupId || null }
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
              ? isCustomTrainingGroupMode
                ? { customTrainingGroupId: selectedTrainingGroupId || null }
                : { trainingGroupId: selectedTrainingGroupId || null }
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
                search.set(isCustomTrainingGroupMode ? "customTrainingGroupId" : "trainingGroupId", selectedTrainingGroupId);
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
    if (!trainingAttendanceOpen || !clubId || !trainingAttendanceDate || trainingAttendanceView === "today") {
      return;
    }

    const search = new URLSearchParams({ date: trainingAttendanceDate });
    if (trainingAttendanceView === "trainingGroups") {
      if (selectedTrainingGroupId) {
        search.set(isCustomTrainingGroupMode ? "customTrainingGroupId" : "trainingGroupId", selectedTrainingGroupId);
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
        <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
          {isAdmin && (
            <button
              className="amp-back-btn amp-btn--compact"
              onClick={() => router.push("/admin/players")}
            >
              <ArrowLeftIcon />
              <span>Назад</span>
            </button>
          )}
          <div style={{ marginLeft: "auto" }}>
            <AdminLogoutButton />
          </div>
        </div>

        {/* ── Page header ── */}
        <div className="amp-header">
          <h1 className="amp-title">Списък играчи</h1>
          <p className="amp-subtitle">Търсене, филтриране и ръчно отбелязване на плащания</p>
          <div className="amp-title-line" />
        </div>

        <div className="amp-club-info">
          <div className="amp-club-info-left">
            {clubLogoUrl ? (
              <img
                src={clubLogoUrl}
                alt={clubName}
                className="amp-club-logo"
              />
            ) : (
              <div className="amp-club-icon">🏆</div>
            )}
            <h2 className="amp-club-name">
              {clubName}
              {currentCoachGroupName && <span>{` - ${currentCoachGroupName}`}</span>}
            </h2>
          </div>
          {clubId && (
            <div className="amp-modal-title-actions">
              <button
                className="amp-member-bell-btn"
                type="button"
                onClick={() => void handleOpenClubNotificationsPanel()}
                aria-label="All coach notifications"
              >
                <BellIcon />
                {clubNotificationsUnreadCount > 0 ? (
                  <span className="amp-member-bell-dot">
                    {clubNotificationsUnreadCount > 99 ? "99+" : clubNotificationsUnreadCount}
                  </span>
                ) : null}
              </button>
            </div>
          )}
        </div>

        {/* ── Buttons grid ── */}
        <div className="amp-buttons-grid">
          <button className="amp-add-btn" onClick={() => router.push(`/admin/members/add?clubId=${encodeURIComponent(clubId)}${coachGroupId ? `&coachGroupId=${encodeURIComponent(coachGroupId)}` : ""}`)}>
            <PlusIcon />
            Добави играч
          </button>
          {isAdmin && clubId && (
            <button className="amp-import-sheets-btn amp-btn--compact" onClick={() => setImportSheetsOpen(true)} type="button">
              <ImportSheetsIcon />
              <span>Импорт</span>
            </button>
          )}
          {isAdmin && clubId && (
            <button className="amp-import-sheets-btn amp-btn--compact" onClick={() => setImportPhotosOpen(true)} type="button">
              <PhotoImportIcon />
              <span>Снимки</span>
            </button>
          )}
          {isAdmin && (
            <button
              className="amp-inactive-toggle-btn amp-btn--compact"
              onClick={async () => {
                setInactiveActionError("");
                await refreshMembersList();
                setInactivePlayersOpen(true);
              }}
              type="button"
            >
              <UsersIcon />
              <span>Неактивни</span>
            </button>
          )}
          {isAdmin && clubId && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              onClick={openTrainingGroupModeSettings}
              type="button"
            >
              <UsersIcon />
              <span>Групи</span>
            </button>
          )}
          {isAdmin && clubId && !coachGroupId && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              onClick={() => { void loadCoachGroups(); setCoachGroupsPanelOpen(true); }}
              type="button"
            >
              <UsersIcon />
              <span>Треньори</span>
            </button>
          )}
          <button className="amp-reports-btn amp-btn--compact" onClick={() => setReportsOpen(true)}>
            <ChartColumnIcon size={16} />
            <span>Отчети</span>
          </button>
          {(isAdmin || isCoach) && clubId && (
            <>
              <button
                className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                onClick={() => void openSchedulerSettings()}
                type="button"
              >
                <CalendarIcon />
                <span>Известия</span>
              </button>
              <button
                className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                onClick={() => {
                  if (coachGroupId) {
                    void openTrainingAttendance();
                  } else if (coachGroups.length > 1) {
                    setCoachGroupScheduleRedirectOpen(true);
                  } else if (coachGroups.length === 1) {
                    window.location.href = `/admin/members?clubId=${encodeURIComponent(clubId)}&coachGroupId=${encodeURIComponent(coachGroups[0].id)}`;
                  } else {
                    void openTrainingAttendance();
                  }
                }}
                type="button"
              >
                <UsersIcon />
                <span>График</span>
              </button>
              <button
                className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                onClick={() => setAttendanceDashboardOpen(true)}
                type="button"
              >
                <ClipboardListIcon />
                <span>Присъствия</span>
              </button>
              {isAdmin && (
                <button
                  className="amp-download-links-btn amp-btn--compact"
                  onClick={() => void handleDownloadMemberLinks()}
                  type="button"
                >
                  <DownloadIcon />
                  <span>Линкове</span>
                </button>
              )}
            </>
          )}
          {isAdmin && clubId && (
            <>
              <button
                className="amp-edit-team-btn amp-btn--compact"
                onClick={() => router.push(`/admin/teams/${encodeURIComponent(clubId)}/edit`)}
                disabled={isDeletingTeam}
              >
                <PencilIcon size={14} />
                <span>Редактирай</span>
              </button>
              <button
                className="amp-delete-team-btn amp-btn--compact"
                onClick={() => setIsTeamDeleteConfirmOpen(true)}
                disabled={isDeletingTeam}
                type="button"
              >
                <TrashIcon />
                <span>Изтрий</span>
              </button>
            </>
          )}
        </div>
        {(isClubPushSupported || (isClubIPhone && !isClubStandalone)) && clubId && (
          <>
            {isClubPushSubscribed && (
              <div className="push-enabled-banner">
                <span className="push-enabled-check" aria-hidden="true">✓</span>
                <span className="push-enabled-text">Известията са активирани</span>
              </div>
            )}
            {(!isClubIPhone || isClubStandalone) && (
              isClubPushSubscribed ? (
                <button
                  className="bell-btn bell-btn--disable"
                  onClick={handleDisableClubNotifications}
                  disabled={clubPushBusy}
                >
                  {clubPushBusy ? <SpinnerIcon /> : <BellOffIcon />}
                  {clubPushBusy ? "Изключване..." : "Изключване на известия"}
                </button>
              ) : (
                <button
                  className="bell-btn"
                  onClick={handleEnableClubNotifications}
                  disabled={clubPushBusy}
                >
                  {clubPushBusy ? <SpinnerIcon /> : <BellIcon />}
                  {clubPushBusy ? "Активиране..." : "Активиране на известия"}
                </button>
              )
            )}
            {isClubIPhone && !isClubStandalone && (
              <>
                <button className="add-btn add-btn--white-text" onClick={() => setShowClubIphoneGuide((v) => !v)}>
                  <ShareIcon size={16} />
                  Добавете към начален екран
                </button>

                <p className="hint-text">
                  За да активирате известията на iPhone, натиснете бутона Share и изберете &ldquo;Добавяне към начален екран&rdquo;.
                </p>

                {showClubIphoneGuide && (
                  <div className="instr-box">
                    <button className="instr-close" onClick={() => setShowClubIphoneGuide(false)} aria-label="Затвори">
                      <XIcon />
                    </button>
                    <p className="instr-heading">Как да активирате известия на iPhone:</p>
                    <ol className="instr-list">
                      <li>
                        <span className="step-badge">1</span>
                        <span>Натиснете бутона <ShareIcon size={14} /> <strong>Share</strong> в долната лента на Safari</span>
                      </li>
                      <li>
                        <span className="step-badge">2</span>
                        <span>Превъртете надолу и изберете <PlusIcon /> <strong>&ldquo;Добавяне към начален екран&rdquo;</strong></span>
                      </li>
                      <li>
                        <span className="step-badge">3</span>
                        <span>Отворете приложението от началния екран и натиснете <strong>&ldquo;Активиране на известия&rdquo;</strong></span>
                      </li>
                    </ol>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Content ── */}
        {clubPushStatusMessage && (
          <p className="amp-lbl" style={{ marginTop: "8px" }}>
            {clubPushStatusMessage}
          </p>
        )}
        {clubPushErrorMessage && <p className="amp-confirm-error">{clubPushErrorMessage}</p>}

        <div className="amp-content">

          {/* Coach group page links */}
          {!coachGroupId && coachGroups.length > 0 && (
            <div className="amp-coach-group-nav-list">
              {coachGroups.map((group) => (
                <button
                  key={group.id}
                  className="amp-coach-group-nav-btn"
                  onClick={() => { window.location.href = `/admin/members?clubId=${encodeURIComponent(clubId)}&coachGroupId=${encodeURIComponent(group.id)}`; }}
                  type="button"
                >
                  <span>{group.name}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Group filter dropdown */}
          <div className="amp-edit-field" style={{ marginBottom: "10px", padding: "0", position: "relative" }}>
            <div
              className="amp-edit-input amp-edit-input-text-center"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
              onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
            >
              {selectedGroup === "all"
                ? `Всички (${activeMembersCount})`
                : isCustomTrainingGroupMode
                  ? `${customTrainingGroups.find((g) => g.id === selectedGroup)?.name ?? selectedGroup} (${activeMembersByCustomGroup[selectedGroup] ?? 0})`
                  : `${selectedGroup} (${(activeMembersByGroup as Record<string, number>)[selectedGroup] ?? 0})`}
            </div>
            {isGroupDropdownOpen && (
              <>
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setIsGroupDropdownOpen(false)} />
                <div className="amp-custom-dropdown-menu" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", backgroundColor: "#1e1e1e", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px", zIndex: 999, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                  <div className={`amp-custom-dropdown-item ${selectedGroup === "all" ? "active" : ""}`} onClick={() => { setSelectedGroup("all"); setIsGroupDropdownOpen(false); }}>
                    Всички ({activeMembersCount})
                  </div>
                  {isCustomTrainingGroupMode
                    ? customTrainingGroups
                        .filter((g) => (activeMembersByCustomGroup[g.id] ?? 0) > 0)
                        .map((g) => (
                          <div key={g.id} className={`amp-custom-dropdown-item ${selectedGroup === g.id ? "active" : ""}`} onClick={() => { setSelectedGroup(g.id); setIsGroupDropdownOpen(false); }}>
                            {g.name} ({activeMembersByCustomGroup[g.id] ?? 0})
                          </div>
                        ))
                    : groupOptions.map((g) => (
                        <div key={g} className={`amp-custom-dropdown-item ${selectedGroup === String(g) ? "active" : ""}`} onClick={() => { setSelectedGroup(String(g)); setIsGroupDropdownOpen(false); }}>
                          {g} ({(activeMembersByGroup as Record<string, number>)[g] ?? 0})
                        </div>
                      ))}
                </div>
              </>
            )}
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
                <PlayerCard
                  key={m.id}
                  member={m}
                  onClick={() => setSelectedMember(m)}
                  coachGroupName={!coachGroupId && m.coachGroupId ? (coachGroups.find((g) => g.id === m.coachGroupId)?.name ?? null) : null}
                />
              ))}
              {filtered.length === 0 && (
                <p className="amp-empty">Няма намерени играчи</p>
              )}
            </div>
          )}

        </div>
      </div>

      {clubNotificationsPanelOpen ? (
        <div className="amp-overlay amp-overlay--member-notifications" onClick={() => setClubNotificationsPanelOpen(false)}>
          <div className="amp-modal amp-modal--member-notifications" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">{"\u0418\u0437\u0432\u0435\u0441\u0442\u0438\u044f \u0437\u0430 \u0442\u0440\u0435\u043d\u044c\u043e\u0440\u0438"}</span>
              <button className="amp-modal-close" onClick={() => setClubNotificationsPanelOpen(false)} aria-label={"\u0417\u0430\u0442\u0432\u043e\u0440\u0438"}>
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {clubNotificationsLoading ? (
                <p className="amp-empty amp-empty--modal">{"\u0417\u0430\u0440\u0435\u0436\u0434\u0430\u043d\u0435..."}</p>
              ) : clubNotifications.length === 0 ? (
                <p className="amp-empty amp-empty--modal">{"\u041d\u044f\u043c\u0430 \u0438\u0437\u0432\u0435\u0441\u0442\u0438\u044f"}</p>
              ) : (
                <>
                  <div className="amp-notification-filters">
                    <label className="amp-notification-filter amp-notification-filter--date">
                      <span>{"\u0414\u0430\u0442\u0430"}</span>
                      <div className="amp-notification-date-row">
                        <button
                          type="button"
                          className={`amp-btn amp-btn--ghost amp-notification-date-all-btn${clubNotificationsDateFilter ? "" : " amp-notification-date-all-btn--active"
                            }`}
                          onClick={() => setClubNotificationsDateFilter("")}
                        >
                          {"\u0412\u0441\u0438\u0447\u043a\u0438"}
                        </button>
                        <input
                          type="date"
                          className="amp-edit-input amp-notification-date-input"
                          value={clubNotificationsDateFilter}
                          max={todayIsoDate}
                          onChange={(event) => setClubNotificationsDateFilter(event.target.value)}
                        />
                      </div>
                    </label>
                    <label className="amp-notification-filter">
                      <span>{"\u0424\u0438\u043b\u0442\u044a\u0440 \u043f\u043e"}</span>
                      <select
                        className="amp-edit-input"
                        value={clubNotificationsScopeType}
                        onChange={(event) => {
                          const val = event.target.value;
                          const nextType = val === "trainingGroup" ? "trainingGroup" : val === "admin" ? "admin" : "team";
                          setClubNotificationsScopeType(nextType);
                          setClubNotificationsScopeValue("all");
                        }}
                      >
                        <option value="team">{"\u041e\u0442\u0431\u043e\u0440"}</option>
                        <option value="trainingGroup">{"\u0421\u0431\u043e\u0440\u0435\u043d \u043e\u0442\u0431\u043e\u0440"}</option>
                        <option value="admin">{"\u0410\u0434\u043c\u0438\u043d"}</option>
                      </select>
                    </label>
                    {clubNotificationsScopeType !== "admin" && (
                      <label className="amp-notification-filter">
                        <span>
                          {clubNotificationsScopeType === "team"
                            ? "\u0418\u0437\u0431\u0435\u0440\u0438 \u043e\u0442\u0431\u043e\u0440"
                            : "\u0418\u0437\u0431\u0435\u0440\u0438 \u0441\u0431\u043e\u0440\u0435\u043d \u043e\u0442\u0431\u043e\u0440"}
                        </span>
                        <select
                          className="amp-edit-input"
                          value={clubNotificationsScopeValue}
                          onChange={(event) => setClubNotificationsScopeValue(event.target.value)}
                        >
                          <option value="all">{"\u0412\u0441\u0438\u0447\u043a\u0438"}</option>
                          {clubNotificationsScopeType === "team"
                            ? clubNotificationTeamGroups.map((group) => (
                              <option key={group} value={String(group)}>
                                {group}
                              </option>
                            ))
                            : clubNotificationTrainingGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </div>
                  {filteredClubNotifications.length === 0 ? (
                    <p className="amp-empty amp-empty--modal">{"\u041d\u044f\u043c\u0430 \u0438\u0437\u0432\u0435\u0441\u0442\u0438\u044f \u0437\u0430 \u0438\u0437\u0431\u0440\u0430\u043d\u0438\u0442\u0435 \u0444\u0438\u043b\u0442\u0440\u0438"}</p>
                  ) : (
                    <div className="amp-member-notifications-list">
                      {filteredClubNotifications.map((notif) => (
                        <article
                          key={notif.id}
                          className={`amp-member-notification-item${notif.readAt ? "" : " amp-member-notification-item--unread"}`}
                        >
                          <div className="amp-member-notification-head">
                            <h3>{notif.title}</h3>
                            {!notif.readAt ? <span className="amp-member-notification-new" aria-label={"\u041d\u043e\u0432\u043e"} /> : null}
                          </div>
                          {notif.type === "admin_message" ? (
                            <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", background: "rgba(201,168,76,0.15)", color: "var(--accent-gold-color)", marginBottom: "6px" }}>
                              {"\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440"}
                            </span>
                          ) : null}
                          <p style={{ whiteSpace: "pre-wrap" }}>{notif.body}</p>
                          <div className="amp-member-notification-meta">
                            {typeof notif.teamGroup === "number" ? <span>{"\u041e\u0442\u0431\u043e\u0440: "}{notif.teamGroup}</span> : null}
                            {Array.isArray(notif.trainingGroups) && notif.trainingGroups.length > 0 ? (
                              <span>{"\u0421\u0431\u043e\u0440\u0435\u043d \u043e\u0442\u0431\u043e\u0440: "}{notif.trainingGroups.map((group) => group.name).join(", ")}</span>
                            ) : null}
                          </div>
                          <time dateTime={notif.sentAt}>
                            {new Date(notif.sentAt).toLocaleDateString("bg-BG", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
          coachGroups={isAdmin && coachGroups.length > 0 ? coachGroups : undefined}
          onCoachGroupAssigned={(memberId, newCoachGroupId) => {
            setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, coachGroupId: newCoachGroupId } : m));
            setSelectedMember((prev) => prev?.id === memberId ? { ...prev, coachGroupId: newCoachGroupId } : prev);
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
                {isAdmin && coachGroups.length > 0 && (
                  <div className="amp-edit-field">
                    <span className="amp-lbl">Група треньор</span>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <select
                        className="amp-edit-input"
                        value={memberCoachGroupAssignValue ?? memberToEdit.coachGroupId ?? ""}
                        onChange={(e) => setMemberCoachGroupAssignValue(e.target.value || null)}
                        disabled={memberCoachGroupAssignSaving}
                      >
                        <option value="">Без група</option>
                        {coachGroups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="amp-btn amp-btn--ghost amp-btn--compact"
                        disabled={memberCoachGroupAssignSaving}
                        onClick={async () => {
                          if (!memberToEdit) return;
                          setMemberCoachGroupAssignSaving(true);
                          setMemberCoachGroupAssignError("");
                          try {
                            const nextValue = memberCoachGroupAssignValue === undefined
                              ? memberToEdit.coachGroupId
                              : memberCoachGroupAssignValue;
                            const response = await fetch(`/api/admin/members/${memberToEdit.id}/coach-group`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ coachGroupId: nextValue || null }),
                            });
                            if (!response.ok) {
                              const payload = await response.json().catch(() => ({}));
                              throw new Error(String((payload as { error?: unknown }).error ?? "Грешка"));
                            }
                            const updatedCoachGroupId = nextValue || null;
                            setMembers((prev) => prev.map((m) => m.id === memberToEdit.id ? { ...m, coachGroupId: updatedCoachGroupId } : m));
                            setSelectedMember((prev) => prev?.id === memberToEdit.id ? { ...prev, coachGroupId: updatedCoachGroupId } : prev);
                            setMemberToEdit((prev) => prev ? { ...prev, coachGroupId: updatedCoachGroupId } : prev);
                            setMemberCoachGroupAssignValue(null);
                            void loadCoachGroups();
                          } catch (err) {
                            setMemberCoachGroupAssignError(err instanceof Error ? err.message : "Грешка");
                          } finally {
                            setMemberCoachGroupAssignSaving(false);
                          }
                        }}
                      >
                        Запази
                      </button>
                    </div>
                    {memberCoachGroupAssignError && (
                      <p className="amp-error" style={{ marginTop: "4px" }}>{memberCoachGroupAssignError}</p>
                    )}
                  </div>
                )}
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
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) {
                        const err = validateImageFile(file);
                        if (err) { setEditError(err); e.target.value = ""; return; }
                      }
                      setEditAvatarFile(file);
                    }}
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
      {trainingGroupModeSettingsOpen && isAdmin && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!trainingGroupModeSaving) {
              setTrainingGroupModeSettingsOpen(false);
              setTrainingGroupModeError("");
            }
          }}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Настройки на групите</span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setTrainingGroupModeSettingsOpen(false);
                  setTrainingGroupModeError("");
                }}
                aria-label="Затвори"
                disabled={trainingGroupModeSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <div className="amp-training-view-switch" style={{ marginBottom: "14px" }}>
                <button
                  type="button"
                  className={`amp-btn amp-btn--ghost amp-training-view-btn${trainingGroupModeDraft === "team_group" ? " is-active" : ""}`}
                  onClick={() => setTrainingGroupModeDraft("team_group")}
                  disabled={trainingGroupModeSaving}
                >
                  По набори
                </button>
                <button
                  type="button"
                  className={`amp-btn amp-btn--ghost amp-training-view-btn${trainingGroupModeDraft === "custom_group" ? " is-active" : ""}`}
                  onClick={() => setTrainingGroupModeDraft("custom_group")}
                  disabled={trainingGroupModeSaving}
                >
                  По избрани групи
                </button>
              </div>
              <p className="amp-lbl" style={{ whiteSpace: "normal", textAlign: "center" }}>
                Избраният начин ще определи как треньорите виждат групите и създават тренировъчни графици.
              </p>
              {trainingGroupModeError && <p className="amp-confirm-error">{trainingGroupModeError}</p>}
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => {
                    setTrainingGroupModeSettingsOpen(false);
                    setTrainingGroupModeDraft(trainingGroupMode);
                    setTrainingGroupModeError("");
                  }}
                  disabled={trainingGroupModeSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveTrainingGroupMode(trainingGroupModeDraft)}
                  disabled={trainingGroupModeSaving}
                >
                  {trainingGroupModeSaving ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {coachGroupsPanelOpen && isAdmin && (
        <div className="amp-overlay amp-overlay--confirm" onClick={() => { setCoachGroupsPanelOpen(false); setCoachGroupCreateName(""); setCoachGroupCreateError(""); setCoachGroupDeleteId(null); setCoachGroupEditId(null); setCoachGroupEditName(""); setCoachGroupEditError(""); }}>
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Групи за треньори</span>
              <button className="amp-modal-close" onClick={() => { setCoachGroupsPanelOpen(false); setCoachGroupCreateName(""); setCoachGroupCreateError(""); setCoachGroupDeleteId(null); setCoachGroupEditId(null); setCoachGroupEditName(""); setCoachGroupEditError(""); }} aria-label="Затвори">
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {/* Create form */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <input
                  className="amp-edit-input"
                  placeholder="Ново име на група"
                  value={coachGroupCreateName}
                  onChange={(e) => { setCoachGroupCreateName(e.target.value); setCoachGroupCreateError(""); }}
                  disabled={coachGroupCreateSaving}
                  maxLength={100}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="amp-btn amp-btn--primary amp-btn--compact"
                  disabled={coachGroupCreateSaving || !coachGroupCreateName.trim()}
                  onClick={async () => {
                    const name = coachGroupCreateName.trim();
                    if (!name || !clubId) return;
                    setCoachGroupCreateSaving(true);
                    setCoachGroupCreateError("");
                    try {
                      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name }),
                      });
                      if (!response.ok) {
                        const payload = await response.json().catch(() => ({}));
                        throw new Error(String((payload as { error?: unknown }).error ?? "Грешка"));
                      }
                      setCoachGroupCreateName("");
                      void loadCoachGroups();
                    } catch (err) {
                      setCoachGroupCreateError(err instanceof Error ? err.message : "Грешка");
                    } finally {
                      setCoachGroupCreateSaving(false);
                    }
                  }}
                >
                  {coachGroupCreateSaving ? "..." : "Създай"}
                </button>
              </div>
              {coachGroupCreateError && <p className="amp-confirm-error" style={{ marginBottom: "8px" }}>{coachGroupCreateError}</p>}

              {/* Group list */}
              {coachGroups.length === 0 ? (
                <p className="amp-empty amp-empty--modal">Няма групи за треньори.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {coachGroups.map((group) => (
                    <div key={group.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {coachGroupEditId === group.id ? (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <input
                              className="amp-edit-input"
                              value={coachGroupEditName}
                              onChange={(e) => { setCoachGroupEditName(e.target.value); setCoachGroupEditError(""); }}
                              disabled={coachGroupEditSaving}
                              maxLength={100}
                              style={{ flex: 1 }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="amp-btn amp-btn--primary amp-btn--compact"
                              disabled={coachGroupEditSaving || !coachGroupEditName.trim() || coachGroupEditName.trim() === group.name}
                              onClick={async () => {
                                const name = coachGroupEditName.trim();
                                if (!name || !clubId) return;
                                setCoachGroupEditSaving(true);
                                setCoachGroupEditError("");
                                try {
                                  const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups/${encodeURIComponent(group.id)}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ name }),
                                  });
                                  if (!response.ok) {
                                    const payload = await response.json().catch(() => ({}));
                                    throw new Error(String((payload as { error?: unknown }).error ?? "Грешка"));
                                  }
                                  setCoachGroupEditId(null);
                                  setCoachGroupEditName("");
                                  void loadCoachGroups();
                                } catch (err) {
                                  setCoachGroupEditError(err instanceof Error ? err.message : "Грешка");
                                } finally {
                                  setCoachGroupEditSaving(false);
                                }
                              }}
                            >
                              {coachGroupEditSaving ? "..." : "Запиши"}
                            </button>
                            <button
                              type="button"
                              className="amp-btn amp-btn--ghost amp-btn--compact"
                              disabled={coachGroupEditSaving}
                              onClick={() => { setCoachGroupEditId(null); setCoachGroupEditName(""); setCoachGroupEditError(""); }}
                            >
                              Отказ
                            </button>
                          </div>
                          {coachGroupEditError && <p className="amp-confirm-error" style={{ margin: 0 }}>{coachGroupEditError}</p>}
                        </div>
                      ) : (
                        <>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500 }}>{group.name}</span>
                            <span style={{ marginLeft: "8px", fontSize: "0.8rem", opacity: 0.6 }}>{group.playerCount} играчи</span>
                          </div>
                          {coachGroupDeleteId !== group.id && (
                            <button
                              type="button"
                              className="amp-btn amp-btn--ghost amp-btn--compact"
                              onClick={async () => {
                                const url = `${window.location.origin}/admin/members?clubId=${encodeURIComponent(clubId)}&coachGroupId=${encodeURIComponent(group.id)}`;
                                try {
                                  await navigator.clipboard.writeText(url);
                                  setCoachGroupCopiedId(group.id);
                                  setTimeout(() => setCoachGroupCopiedId(null), 2000);
                                } catch {
                                  const tmp = document.createElement("input");
                                  tmp.value = url;
                                  document.body.appendChild(tmp);
                                  tmp.select();
                                  document.execCommand("copy");
                                  document.body.removeChild(tmp);
                                  setCoachGroupCopiedId(group.id);
                                  setTimeout(() => setCoachGroupCopiedId(null), 2000);
                                }
                              }}
                              style={{ minWidth: "90px" }}
                            >
                              {coachGroupCopiedId === group.id ? "Копирано!" : "Копирай линк"}
                            </button>
                          )}
                          {coachGroupDeleteId === group.id ? (
                            <>
                              <button
                                type="button"
                                className="amp-btn amp-btn--danger amp-btn--compact"
                                disabled={coachGroupDeleteSaving}
                                onClick={async () => {
                                  if (!clubId) return;
                                  setCoachGroupDeleteSaving(true);
                                  try {
                                    const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups/${encodeURIComponent(group.id)}`, { method: "DELETE" });
                                    if (!response.ok) throw new Error("Грешка при изтриване");
                                    setCoachGroupDeleteId(null);
                                    void loadCoachGroups();
                                    void refreshMembersList();
                                  } catch {
                                    // ignore
                                  } finally {
                                    setCoachGroupDeleteSaving(false);
                                  }
                                }}
                              >
                                {coachGroupDeleteSaving ? "..." : "Потвърди"}
                              </button>
                              <button type="button" className="amp-btn amp-btn--ghost amp-btn--compact" disabled={coachGroupDeleteSaving} onClick={() => setCoachGroupDeleteId(null)}>
                                Отказ
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="amp-btn amp-btn--ghost amp-btn--icon-only"
                                title="Редактирай"
                                onClick={() => { setCoachGroupEditId(group.id); setCoachGroupEditName(group.name); setCoachGroupEditError(""); setCoachGroupDeleteId(null); }}
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button type="button" className="amp-btn amp-btn--ghost amp-btn--compact" onClick={() => setCoachGroupDeleteId(group.id)}>
                                Изтрий
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {trainingGroupDeleteConfirmOpen && (
        <ConfirmDeleteTrainingGroupModal
          groupName={
            (isCustomTrainingGroupMode
              ? customTrainingGroups.find((group) => group.id === selectedTrainingGroupId)?.name?.trim()
              : trainingScheduleGroups.find((group) => group.id === selectedTrainingGroupId)?.name?.trim()) ||
            (isCustomTrainingGroupMode ? "тази група" : "този сборен отбор")
          }
          isCustomGroup={isCustomTrainingGroupMode}
          isDeleting={trainingGroupDeleteSaving}
          onCancel={() => {
            if (!trainingGroupDeleteSaving) {
              setTrainingGroupDeleteConfirmOpen(false);
            }
          }}
          onConfirm={() => void deleteSelectedTrainingGroup()}
        />
      )}
      {reportsOpen && (
        <ReportsDialog
          onClose={() => setReportsOpen(false)}
          clubId={clubId}
          coachGroupId={coachGroupId}
          coachGroupName={currentCoachGroupName}
        />
      )}
      {attendanceDashboardOpen && clubId && (
        <AttendanceDashboard
          onClose={() => setAttendanceDashboardOpen(false)}
          clubId={clubId}
          coachGroupId={coachGroupId}
          coachGroupName={currentCoachGroupName}
        />
      )}

      {coachGroupScheduleRedirectOpen && (
        <div className="amp-overlay amp-overlay--confirm" onClick={() => setCoachGroupScheduleRedirectOpen(false)}>
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient" style={{ flex: 1, textAlign: "center", paddingLeft: "32px" }}>График</span>
              <button className="amp-modal-close" onClick={() => setCoachGroupScheduleRedirectOpen(false)} aria-label="Затвори">
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <p style={{ textAlign: "center", opacity: 0.8 }}>
                За да зададете тренировъчен график, влезте в страницата на съответния треньор.
              </p>
            </div>
          </div>
        </div>
      )}
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
              <div className="amp-training-view-switch">
                <button
                  type="button"
                  className={`amp-btn amp-btn--ghost amp-training-view-btn${trainingAttendanceView !== "today" ? " is-active" : ""}`}
                  onClick={() => void handleTrainingAttendanceViewChange("trainingGroups")}
                  disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDaysEditorSaving}
                >
                  Отбори
                </button>
                <button
                  type="button"
                  className={`amp-btn amp-btn--ghost amp-training-view-btn${trainingAttendanceView === "today" ? " is-active" : ""}`}
                  onClick={() => void handleTrainingAttendanceViewChange("today")}
                  disabled={trainingAttendanceLoading || trainingTodayLoading || trainingNoteSaving || trainingDaysEditorSaving}
                >
                  Днес
                </button>
              </div>
              {trainingAttendanceView === "today" ? (
                <div className="amp-training-today-panel">
                  <div className="amp-training-stats">
                    <span>Дата: {formatIsoDateForDisplay(trainingTodayDate || todayIsoDate)}</span>
                    <span>Тренировки: {trainingTodaySessions.length}</span>
                  </div>
                  {trainingTodayLoading ? (
                    <p className="amp-empty amp-empty--modal">Зареждане...</p>
                  ) : trainingTodaySessions.length === 0 ? (
                    <p className="amp-empty amp-empty--modal">Няма насрочени тренировки за днес.</p>
                  ) : (
                    <div className="amp-training-today-list">
                      {trainingTodaySessions.map((session) => (
                        <article key={session.id} className="amp-training-today-item">
                          <h3>{session.label}</h3>
                          <div className="amp-training-today-meta">
                            <span>
                              {session.scopeType === "trainingGroup" ? "Набори" : "Отбор"}:{" "}
                              {session.teamGroups.length > 0 ? session.teamGroups.join(", ") : "-"}
                            </span>
                            <span>
                              Присъстващи: {session.stats.attending}/{session.stats.total}
                            </span>
                            <span>Отсъстващи: {session.stats.optedOut}</span>
                          </div>
                          <p className="amp-training-today-note">
                            {trainingTodayNote.trim() ? `Описание: ${trainingTodayNote}` : "Описание: няма"}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ marginBottom: "10px" }}>
                      <button
                        type="button"
                        className="amp-btn amp-btn--primary"
                        onClick={openTrainingGroupCreateModal}
                        disabled={trainingNoteSaving || trainingGroupCreateSaving}
                        style={{ width: "100%" }}
                      >
                        {trainingGroupCreateSaving
                          ? "Запазване..."
                          : isCustomTrainingGroupMode
                            ? "Създай група"
                            : "Създай сборен отбор"}
                      </button>
                    </div>
                    {trainingScheduleGroupsLoading ? (
                      <p className="amp-empty amp-empty--modal">Зареждане...</p>
                    ) : (isCustomTrainingGroupMode ? customTrainingGroups.length === 0 : (trainingScheduleGroups.length === 0 && standaloneTeamGroups.length === 0)) ? (
                      <p className="amp-empty amp-empty--modal">Няма групи.</p>
                    ) : (
                      <>
                        <label className="amp-edit-field" style={{ marginBottom: "12px", textAlign: "center" }}>
                          <span className="amp-lbl" style={{ textAlign: "center" }}>Група</span>
                          <select
                            className="amp-edit-input"
                            style={{ textAlign: "center", textAlignLast: "center", paddingLeft: "28px" }}
                            value={unifiedGroupScopeValue}
                            onChange={(e) => void handleUnifiedGroupChange(e.target.value)}
                            disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDaysEditorSaving || trainingScheduleGroupsLoading}
                          >
                            {isCustomTrainingGroupMode ? customTrainingGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            )) : trainingScheduleGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                            {!isCustomTrainingGroupMode && standaloneTeamGroups.map((g) => (
                              <option key={g} value={`year:${g}`}>
                                Набор {g}
                              </option>
                            ))}
                          </select>
                        </label>
                        {trainingAttendanceView === "trainingGroups" && selectedTrainingGroupId && (
                          <div className="amp-training-group-actions">
                            <button
                              type="button"
                              className="amp-btn amp-btn--ghost"
                              onClick={() => openTrainingGroupEditModal(selectedTrainingGroupId)}
                              disabled={trainingScheduleGroupsLoading || trainingGroupEditSaving || trainingGroupDeleteSaving}
                            >
                              {trainingGroupEditSaving
                                ? "Отваряне..."
                                : isCustomTrainingGroupMode
                                  ? "Редактирай група"
                                  : "Редактирай сборен отбор"}
                            </button>
                            <button
                              type="button"
                              className="amp-btn amp-btn--danger"
                              onClick={() => setTrainingGroupDeleteConfirmOpen(true)}
                              disabled={trainingScheduleGroupsLoading || trainingGroupEditSaving || trainingGroupDeleteSaving}
                            >
                              {trainingGroupDeleteSaving
                                ? "Изтриване..."
                                : isCustomTrainingGroupMode
                                  ? "Изтрий група"
                                  : "Изтрий сборен отбор"}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
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
                              const trainingTimeLabel = dateData.trainingTime?.trim() ?? "";
                              return (
                                <button
                                  key={date}
                                  type="button"
                                  className={`amp-training-date-btn amp-training-date-btn--training${isActive ? " amp-training-date-btn--active" : ""}${isToday ? " amp-training-date-btn--today" : ""}`}
                                  onClick={() => void openTrainingDayDetails(date)}
                                  disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDayDetailsOpening}
                                >
                                  <span className="amp-training-day-number">{dayNumber}</span>
                                  {trainingTimeLabel && (
                                    <span className="amp-training-day-time">{trainingTimeLabel}</span>
                                  )}
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
                </>
              )}
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
                {`скате ли да направите промени по сборен отбор ${postTeamGroupSavePromptGroupName}?`}
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
              <span className="amp-modal-title-gradient">{isCustomTrainingGroupMode ? "Редакция на група" : "Редакция на сборен отбор"}</span>
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
              {isCustomTrainingGroupMode && (
                <>
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Име на групата</span>
                    <input
                      className="amp-edit-input"
                      value={trainingGroupEditName}
                      onChange={(e) => setTrainingGroupEditName(e.target.value)}
                      disabled={trainingGroupEditSaving}
                    />
                  </label>
                  <div className="amp-training-days-editor-header amp-training-days-editor-header--stack" style={{ marginTop: "10px" }}>
                    <span className="amp-lbl">Играчите в групата</span>
                    <div className="amp-group-check-grid">
                      {availablePlayersForCustomGroupEdit.map((member) => {
                        const isChecked = trainingGroupEditPlayerIds.includes(member.id);
                        return (
                          <label key={`custom-training-group-edit-${member.id}`} className={`amp-group-check-chip${isChecked ? " is-selected" : ""}${trainingGroupEditSaving ? " is-disabled" : ""}`}>
                            <input
                              className="amp-group-check-input"
                              type="checkbox"
                              checked={isChecked}
                              disabled={trainingGroupEditSaving}
                              onChange={(e) => {
                                setTrainingGroupEditPlayerIds((prev) => e.target.checked
                                  ? [...new Set([...prev, member.id])]
                                  : prev.filter((item) => item !== member.id));
                              }}
                            />
                            <span className="amp-group-check-box" aria-hidden="true" />
                            <span className="amp-lbl amp-group-check-label">{member.fullName}</span>
                          </label>
                        );
                      })}
                    </div>
                    {availablePlayersForCustomGroupEdit.length === 0 && (
                      <p className="amp-empty amp-empty--modal">Няма свободни играчи за добавяне.</p>
                    )}
                  </div>
                </>
              )}
              {!isCustomTrainingGroupMode && (
                <>
              <label className="amp-edit-field">
                <span className="amp-lbl">Име на група</span>
                <input
                  className="amp-edit-input"
                  value={trainingGroupEditName}
                  placeholder={trainingGroupEditGroups.length > 0 ? trainingGroupEditGroups.join("/") : "2012/2013"}
                  onChange={(e) => setTrainingGroupEditName(e.target.value)}
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
                </>
              )}
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
              <span className="amp-modal-title-gradient">{isCustomTrainingGroupMode ? "Създай група" : "Създай сборен отбор"}</span>
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
              {isCustomTrainingGroupMode && (
                <>
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Име на групата</span>
                    <input
                      className="amp-edit-input"
                      value={trainingGroupCreateName}
                      onChange={(e) => setTrainingGroupCreateName(e.target.value)}
                      placeholder="Например: Сутрешна група"
                      disabled={trainingGroupCreateSaving}
                    />
                  </label>
                  <div className="amp-training-days-editor-header amp-training-days-editor-header--stack" style={{ marginTop: "10px" }}>
                    <span className="amp-lbl">Играчите в групата</span>
                    <div className="amp-group-check-grid">
                      {availablePlayersForCustomGroupCreate.map((member) => {
                        const isChecked = trainingGroupCreatePlayerIds.includes(member.id);
                        return (
                          <label key={`custom-training-group-create-${member.id}`} className={`amp-group-check-chip${isChecked ? " is-selected" : ""}${trainingGroupCreateSaving ? " is-disabled" : ""}`}>
                            <input
                              className="amp-group-check-input"
                              type="checkbox"
                              checked={isChecked}
                              disabled={trainingGroupCreateSaving}
                              onChange={(e) => {
                                setTrainingGroupCreatePlayerIds((prev) => e.target.checked
                                  ? [...new Set([...prev, member.id])]
                                  : prev.filter((item) => item !== member.id));
                              }}
                            />
                            <span className="amp-group-check-box" aria-hidden="true" />
                            <span className="amp-lbl amp-group-check-label">{member.fullName}</span>
                          </label>
                        );
                      })}
                    </div>
                    {availablePlayersForCustomGroupCreate.length === 0 && (
                      <p className="amp-empty amp-empty--modal">Няма свободни играчи за добавяне.</p>
                    )}
                  </div>
                </>
              )}
              {!isCustomTrainingGroupMode && (
                <>
              <div className="amp-training-days-editor-header amp-training-days-editor-header--stack">
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
                    : `Избрани набори: ${trainingGroupCreateGroups.join(", ")} — Името ще бъде: ${trainingGroupCreateGroups.join("/")}`}
                </span>
              </div>
                </>
              )}
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
                  {trainingGroupCreateSaving
                    ? "Създаване..."
                    : isCustomTrainingGroupMode
                      ? "Създай група"
                      : "Създай сборен отбор"}
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
                  <div className="amp-training-days-editor-header" style={{ flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      {trainingDaysEditorMode === "createGroup"
                        ? "Създай сборен отбор"
                        : trainingDaysEditorMode === "trainingGroup"
                          ? "Задай тренировъчни дни за сборен отбор"
                          : trainingDaysEditorMode === "coachGroup"
                            ? "Тренировъчен график"
                            : "Избери тренировъчни дни (следващи 30 дни)"}
                    </span>
                    {trainingDaysEditorMode !== "createGroup" && (
                      <span className="amp-lbl" style={{ textAlign: "center" }}>Избрани: {schedulerForm.trainingDates.length}</span>
                    )}
                  </div>
                  <div className="amp-training-days-editor-header" style={{ marginTop: "8px", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" }}>
                    <span
                      className="amp-lbl"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        border: "1px solid rgba(50,205,50,0.45)",
                        background: "rgba(50,205,50,0.16)",
                        color: "#d7ffd7",
                        fontWeight: 700,
                        textAlign: "center",
                        width: "100%"
                      }}
                    >
                      {trainingDaysEditorMode === "trainingGroup"
                        ? `Сборен отбор: ${selectedTrainingGroup?.name ?? "-"}`
                        : trainingDaysEditorMode === "customGroup"
                          ? `Персонализирана група: ${selectedCustomGroup?.name ?? "-"}`
                          : trainingDaysEditorMode === "coachGroup"
                            ? `Треньорска група: ${coachGroups.find((g) => g.id === coachGroupId)?.name ?? ""}`
                            : selectedTeamGroup === null
                              ? "Набор: Всички"
                              : `Набор: ${selectedTeamGroup}`}
                    </span>
                    <span style={{ textAlign: "center" }}>
                      {trainingDaysEditorMode === "trainingGroup"
                        ? `Тези промени ще се запазят за сборен отбор ${selectedTrainingGroup?.name ?? "-"}.`
                        : trainingDaysEditorMode === "customGroup"
                          ? `Тези промени ще се запазят за персонализирана група ${selectedCustomGroup?.name ?? "-"}.`
                          : trainingDaysEditorMode === "coachGroup"
                            ? `Тези промени ще се запазят за треньорска група ${coachGroups.find((g) => g.id === coachGroupId)?.name ?? ""}.`
                            : selectedTeamGroup === null
                              ? "Тези промени ще се запазят за всички набори."
                              : `Тези промени ще се запазят за набор ${selectedTeamGroup}.`}
                    </span>
                  </div>
                  {trainingDaysEditorMode !== "createGroup" && (
                    <label className="amp-edit-field" style={{ marginTop: "8px", display: "none", textAlign: "center" }}>
                      <span className="amp-lbl" style={{ textAlign: "center" }}>Час на тренировка (HH:mm)</span>
                      <div className="amp-edit-input" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
                        <input
                          className="amp-inner-time-input"
                          type="time"
                          step={60}
                          value={schedulerForm.trainingTime}
                          onChange={(e) => handleTrainingAllTimeChange(e.target.value)}
                          required
                          disabled={trainingDaysEditorSaving}
                        />
                      </div>
                    </label>
                  )}
                  {trainingDaysEditorMode !== "createGroup" && (
                    <div className="amp-training-time-panel" style={{ marginTop: "8px", textAlign: "center" }}>
                      <span className="amp-lbl" style={{ textAlign: "center" }}>Задай час за:</span>
                      <div className="amp-pills amp-training-time-mode-buttons" style={{ justifyContent: "center" }}>
                        <button
                          type="button"
                          className={`amp-pill${trainingTimeMode === "all" ? " amp-pill--active" : ""}`}
                          onClick={() => handleTrainingTimeModeChange("all")}
                          disabled={trainingDaysEditorSaving}
                        >
                          Всички тренировки
                        </button>
                        <button
                          type="button"
                          className={`amp-pill${trainingTimeMode === "perDay" ? " amp-pill--active" : ""}`}
                          onClick={() => handleTrainingTimeModeChange("perDay")}
                          disabled={trainingDaysEditorSaving}
                        >
                          По една тренировка
                        </button>
                        <button
                          type="button"
                          className={`amp-pill${trainingTimeMode === "byWeekday" ? " amp-pill--active" : ""}`}
                          onClick={() => handleTrainingTimeModeChange("byWeekday")}
                          disabled={trainingDaysEditorSaving}
                        >
                          За седмица
                        </button>
                      </div>
                    </div>
                  )}
                  {trainingDaysEditorMode !== "createGroup" && trainingTimeMode === "all" && (
                    <label className="amp-edit-field" style={{ marginTop: "8px", textAlign: "center" }}>
                      <span className="amp-lbl" style={{ textAlign: "center" }}>Час на тренировка (HH:mm)</span>
                      <div className="amp-edit-input" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
                        <input
                          className="amp-inner-time-input"
                          type="time"
                          step={60}
                          value={schedulerForm.trainingTime}
                          onChange={(e) => handleTrainingAllTimeChange(e.target.value)}
                          required
                          disabled={trainingDaysEditorSaving}
                        />
                      </div>
                    </label>
                  )}
                  {trainingDaysEditorMode !== "createGroup" && trainingTimeMode === "perDay" && (
                    <div className="amp-training-time-list" style={{ marginTop: "8px" }}>
                      {normalizedTrainingDaysSelection.length === 0 ? (
                        <span className="amp-lbl" style={{ opacity: 0.78, textAlign: "center", display: "block" }}>
                          {"\u041f\u044a\u0440\u0432\u043e \u0438\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u044a\u0447\u043d\u0438 \u0434\u0430\u0442\u0438."}
                        </span>
                      ) : (
                        normalizedTrainingDaysSelection.map((date) => (
                          <label key={`per-day-time-${date}`} className="amp-edit-field" style={{ textAlign: "center" }}>
                            <span className="amp-lbl" style={{ textAlign: "center" }}>{formatIsoDateForDisplay(date)}</span>
                            <div className="amp-edit-input" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
                              <input
                                className="amp-inner-time-input"
                                type="time"
                                step={60}
                                value={trainingDateTimes[date] ?? ""}
                                onChange={(e) => handleTrainingDateTimeChange(date, e.target.value)}
                                required
                                disabled={trainingDaysEditorSaving}
                              />
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                  {trainingDaysEditorMode !== "createGroup" && trainingTimeMode === "byWeekday" && (
                    <div className="amp-training-time-list" style={{ marginTop: "8px" }}>
                      {trainingWeekdayBuckets.length === 0 ? (
                        <span className="amp-lbl" style={{ opacity: 0.78, textAlign: "center", display: "block" }}>
                          {"\u041f\u044a\u0440\u0432\u043e \u0438\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u044a\u0447\u043d\u0438 \u0434\u0430\u0442\u0438."}
                        </span>
                      ) : (
                        trainingWeekdayBuckets.map((weekdayIndex) => {
                          const weekdayDate = normalizedTrainingDaysSelection.find(
                            (date) => getWeekdayMondayFirstIndex(date) === weekdayIndex,
                          );
                          const weekdayTime =
                            (weekdayDate ? trainingDateTimes[weekdayDate] : "") ??
                            schedulerForm.trainingTime;
                          return (
                            <label key={`weekday-time-${weekdayIndex}`} className="amp-edit-field" style={{ textAlign: "center" }}>
                              <span className="amp-lbl" style={{ textAlign: "center" }}>{TRAINING_WEEKDAY_LONG_BG[weekdayIndex] ?? `#${weekdayIndex + 1}`}</span>
                                <div className="amp-edit-input" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
                                <input
                                  className="amp-inner-time-input"
                                  type="time"
                                  step={60}
                                  value={weekdayTime ?? ""}
                                  onChange={(e) => handleTrainingWeekdayTimeChange(weekdayIndex, e.target.value)}
                                  required
                                  disabled={trainingDaysEditorSaving}
                                />
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                  {trainingDaysEditorMode === "teamGroup" && selectedTeamGroupLinkedTrainingGroups.length > 0 && (
                    <p className="amp-confirm-error" style={{ marginTop: "8px", textAlign: "center" }}>
                      {`Внимание: набор ${selectedTeamGroup} участва в сборни отбори (${selectedTeamGroupLinkedTrainingGroups.map((group) => group.name).join(", ")}). При запазване ще бъде премахнат от тях и може да се наложи преименуване на групите.`}
                    </p>
                  )}
                  {trainingDaysEditorMode === "createGroup" && (
                    <>
                      <label className="amp-edit-field" style={{ marginTop: "8px", textAlign: "center" }}>
                        <span className="amp-lbl" style={{ textAlign: "center" }}>Име на група (по избор)</span>
                        <input
                          style={{ textAlign: "center" }}
                          className="amp-edit-input"
                          value={trainingDaysEditorGroupName}
                          onChange={(e) => setTrainingDaysEditorGroupName(e.target.value)}
                          placeholder={trainingDaysEditorGroups.length > 0 ? trainingDaysEditorGroups.map((group) => String(group)).join("/") : "2012/2013"}
                          disabled={trainingDaysEditorSaving}
                        />
                      </label>
                      <div className="amp-training-days-editor-header" style={{ marginTop: "8px", alignItems: "center", flexDirection: "column", gap: "8px", textAlign: "center" }}>
                        <span className="amp-lbl" style={{ textAlign: "center" }}>Набори за прилагане (може повече от един):</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                          {groupOptions.map((group) => {
                            const value = String(group);
                            const isChecked = trainingDaysEditorGroups.includes(value);
                            return (
                              <label
                                key={`training-days-group-${group}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "6px",
                                  padding: "6px 10px",
                                  borderRadius: "999px",
                                  border: "1px solid rgba(255,255,255,0.22)",
                                  background: isChecked ? "rgba(50,205,50,0.16)" : "rgba(255,255,255,0.06)",
                                  cursor: trainingDaysEditorSaving ? "default" : "pointer",
                                  textAlign: "center"
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
                        <span className="amp-lbl" style={{ opacity: 0.8, textAlign: "center" }}>
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
                              return (
                                <button
                                  key={date}
                                  type="button"
                                  className={`amp-training-date-btn${isSelected ? " amp-training-date-btn--active" : ""}`}
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
                  {trainingDaysEditorError && <p className="amp-confirm-error" style={{ textAlign: "center" }}>{trainingDaysEditorError}</p>}
                  {isTrainingDaysScheduleUnchanged && !trainingDaysEditorError && (
                    <p className="amp-confirm-error" style={{ textAlign: "center" }}>Графикът е същият като предишния.</p>
                  )}
                  <div className="amp-modal-actions" style={{ justifyContent: "center" }}>
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
                        (trainingDaysEditorMode !== "createGroup" && isTrainingDaysScheduleUnchanged) ||
                        (trainingDaysEditorMode !== "createGroup" &&
                          hasMissingTrainingTime)
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
                <span>Дата: {trainingAttendanceDate ? formatIsoDateForDisplay(trainingAttendanceDate) : "-"}</span>
                <span>Общо: {trainingAttendanceStats.total}</span>
                <span>Присъстващи: {trainingAttendanceStats.attending}</span>
                <span>Отсъстващи: {trainingAttendanceStats.optedOut}</span>
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
                          const trainingTimeLabel = dateData.trainingTime?.trim() ?? "";
                          return (
                            <button
                              key={date}
                              type="button"
                              className={`amp-training-date-btn amp-training-date-btn--training${isSelected ? " amp-training-date-btn--selected" : ""}${isToday ? " amp-training-date-btn--today" : ""}`}
                              onClick={() => toggleTrainingNoteTargetDate(date)}
                              disabled={trainingNoteSaving}
                            >
                              <span className="amp-training-day-number">{dayNumber}</span>
                              {trainingTimeLabel && (
                                <span className="amp-training-day-time">{trainingTimeLabel}</span>
                              )}
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
              <span className="amp-modal-title-gradient" style={{ flex: 1, textAlign: "center", paddingLeft: "32px" }}>Месечно напомняне</span>
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
                  <label className="amp-edit-field amp-scheduler-primary-day" style={{ textAlign: "center" }}>
                    <span className="amp-lbl" style={{ textAlign: "center" }}>Ден месечно напомняне (1-28)</span>
                    <input
                      className="amp-edit-input"
                      style={{ textAlign: "center" }}
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
                  <label className="amp-edit-field amp-scheduler-overdue-day" style={{ textAlign: "center" }}>
                    <span className="amp-lbl" style={{ textAlign: "center" }}>Ден за начало на платежния месец</span>
                    <input
                      className="amp-edit-input"
                      style={{ textAlign: "center" }}
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
                  <label className="amp-edit-field amp-scheduler-primary-time" style={{ textAlign: "center" }}>
                    <span className="amp-lbl" style={{ textAlign: "center" }}>Час за месечно напомняне</span>
                    <div className="amp-edit-input" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
                      <input
                        className="amp-inner-time-input"
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
                    </div>
                  </label>
                  <div className="amp-edit-field amp-edit-field--full amp-scheduler-section-title amp-scheduler-section-title--second" style={{ textAlign: "center" }}>
                    <span className="amp-lbl" style={{ textAlign: "center" }}>Второ напомняне (по избор)</span>
                  </div>
                  {!secondReminderEnabled ? (
                    <div className="amp-edit-field amp-edit-field--full amp-scheduler-second-toggle" style={{ textAlign: "center" }}>
                      <span className="amp-lbl" style={{ textAlign: "center" }}>Второ месечно напомняне</span>
                      <button
                        className="amp-btn amp-btn--ghost amp-btn--compact"
                        style={{ width: "100%", justifyContent: "center" }}
                        type="button"
                        onClick={enableSecondReminder}
                        disabled={schedulerSettingsSaving}
                      >
                        Добави второ напомняне
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="amp-edit-field amp-scheduler-second-day" style={{ textAlign: "center" }}>
                        <span className="amp-lbl" style={{ textAlign: "center" }}>Ден второ месечно напомняне (1-28)</span>
                        <input
                          className="amp-edit-input"
                          style={{ textAlign: "center" }}
                          inputMode="numeric"
                          value={schedulerForm.secondReminderDay}
                          onChange={(e) =>
                            setSchedulerForm((prev) => ({
                              ...prev,
                              secondReminderDay: e.target.value.replace(/\D/g, ""),
                            }))
                          }
                          disabled={schedulerSettingsSaving}
                        />
                      </label>
                      <label className="amp-edit-field amp-scheduler-second-time" style={{ textAlign: "center" }}>
                        <span className="amp-lbl" style={{ textAlign: "center" }}>Час за второ месечно напомняне</span>
                        <div className="amp-edit-input" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
                          <input
                            className="amp-inner-time-input"
                            type="time"
                            step={60}
                            value={secondReminderTimeValue}
                            onChange={(e) => {
                              const [hour = "0", minute = "0"] = e.target.value.split(":");
                              setSchedulerForm((prev) => ({
                                ...prev,
                                secondReminderHour: hour.replace(/\D/g, ""),
                                secondReminderMinute: minute.replace(/\D/g, ""),
                              }));
                            }}
                            disabled={schedulerSettingsSaving}
                          />
                        </div>
                      </label>
                      <div className="amp-edit-field amp-edit-field--full amp-scheduler-second-remove" style={{ textAlign: "center" }}>
                        <span className="amp-lbl" style={{ textAlign: "center" }}>Опция</span>
                        <button
                          className="amp-btn amp-btn--ghost amp-btn--compact"
                          style={{ width: "100%", justifyContent: "center" }}
                          type="button"
                          onClick={disableSecondReminder}
                          disabled={schedulerSettingsSaving}
                        >
                          Премахни второто напомняне
                        </button>
                      </div>
                    </>
                  )}
                  <div className="amp-edit-field amp-edit-field--full amp-scheduler-section-title amp-scheduler-section-title--overdue" style={{ textAlign: "center" }}>
                    <span className="amp-lbl" style={{ textAlign: "center" }}>Просрочие</span>
                  </div>
                  <label className="amp-edit-field amp-scheduler-overdue-time" style={{ textAlign: "center" }}>
                    <span className="amp-lbl" style={{ textAlign: "center" }}>Час за просрочие</span>
                    <div className="amp-edit-input" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
                      <input
                        className="amp-inner-time-input"
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
                    </div>
                  </label>
                </div>
              )}

              {schedulerSettingsError && <p className="amp-confirm-error" style={{ textAlign: "center" }}>{schedulerSettingsError}</p>}

              <div className="amp-modal-actions" style={{ justifyContent: "center" }}>
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
                  disabled={
                    schedulerSettingsSaving ||
                    schedulerSettingsLoading
                  }
                >
                  {schedulerSettingsSaving ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importSheetsOpen && clubId && (
        <ImportFromSheetsModal
          clubId={clubId}
          onClose={() => setImportSheetsOpen(false)}
          onImported={() => void refreshMembersList()}
        />
      )}

      {importPhotosOpen && clubId && (
        <ImportPhotosFromDriveModal
          clubId={clubId}
          onClose={() => setImportPhotosOpen(false)}
          onImported={() => void refreshMembersList()}
        />
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

/* ── Import From Sheets Modal ── */

type ImportStep = "browse" | "preview" | "importing" | "results";

type PhotoImportStep = "browse" | "confirm" | "importing" | "results";

type DriveItem = { id: string; name: string; mimeType: string };

type ParsedPlayerRow = {
  rowIndex: number;
  fullName: string;
  birthDateIso: string | null;
  teamGroup: number | null;
  jerseyNumber: string | null;
  warning?: string;
};

type ImportResult = {
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; name: string; reason: string }>;
};

type PhotoImportResult = {
  totalFiles: number;
  totalPlayersScanned: number;
  updated: number;
  unchanged: number;
  skippedExisting: number;
  skippedAmbiguous: number;
  unmatched: number;
  failedUploads: number;
  details: {
    updatedPlayers: Array<{ playerId: string; playerName: string; fileName: string }>;
    unmatchedFiles: string[];
    ambiguousFiles: string[];
    failedFiles: Array<{ fileName: string; reason: string }>;
  };
};

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const SheetFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8" /><path d="M8 17h5" />
  </svg>
);

function ImportFromSheetsModal({
  clubId,
  onClose,
  onImported,
}: {
  clubId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<ImportStep>("browse");
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [driveItems, setDriveItems] = useState<{ folders: DriveItem[]; sheets: DriveItem[] } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<DriveItem | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedPlayerRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  // Auto-load root folder on mount
  useEffect(() => {
    void loadDriveFolder("root");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDriveFolder(folderId: string) {
    setDriveLoading(true);
    setDriveError("");
    try {
      const res = await fetch(`/api/admin/google/drive?folderId=${encodeURIComponent(folderId)}`);
      const data = (await res.json().catch(() => ({}))) as { folders?: DriveItem[]; sheets?: DriveItem[]; error?: string };
      if (!res.ok) {
        setDriveError(data.error ?? "Грешка при зареждане на Drive.");
        return;
      }
      setDriveItems({ folders: data.folders ?? [], sheets: data.sheets ?? [] });
    } catch {
      setDriveError("Грешка при свързване.");
    } finally {
      setDriveLoading(false);
    }
  }

  function navigateIntoFolder(folder: DriveItem) {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    void loadDriveFolder(folder.id);
  }

  function navigateToStackIndex(index: number) {
    const newStack = folderStack.slice(0, index);
    setFolderStack(newStack);
    const folderId = newStack.length > 0 ? newStack[newStack.length - 1].id : "root";
    void loadDriveFolder(folderId);
  }

  async function selectSheet(sheet: DriveItem) {
    setSelectedSheet(sheet);
    setPreviewLoading(true);
    setPreviewError("");
    setStep("preview");
    try {
      const res = await fetch(
        `/api/admin/members/import-sheets?spreadsheetId=${encodeURIComponent(sheet.id)}`,
      );
      const data = (await res.json()) as { rows?: ParsedPlayerRow[]; error?: string };
      if (!res.ok) {
        setPreviewError(data.error ?? "Грешка при четене на таблицата.");
        return;
      }
      setPreviewRows(data.rows ?? []);
    } catch {
      setPreviewError("Грешка при свързване.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runImport() {
    if (!selectedSheet) return;
    setStep("importing");
    setImportError("");
    try {
      const res = await fetch("/api/admin/members/import-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId: selectedSheet.id, clubId }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        setImportError(data.error ?? "Грешката при импортиране.");
        setStep("preview");
        return;
      }
      setImportResult(data);
      setStep("results");
      onImported();
    } catch {
      setImportError("Грешка при свързване.");
      setStep("preview");
    }
  }

  const validRowCount = previewRows.filter((r) => !r.warning || r.birthDateIso).length;

  return (
    <div className="amp-overlay" onClick={step === "importing" ? undefined : onClose}>
      <div className="amp-modal amp-modal--import-sheets" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Импорт от Google Sheets</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори" disabled={step === "importing"}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">

          {/* ── Browse step ── */}
          {step === "browse" && (
            <div className="amp-import-browse">
              {/* Breadcrumb */}
              <div className="amp-drive-breadcrumb">
                <button
                  className="amp-drive-crumb"
                  onClick={() => navigateToStackIndex(0)}
                  type="button"
                >
                  My Drive
                </button>
                {folderStack.map((folder, idx) => (
                  <span key={folder.id} className="amp-drive-crumb-sep">
                    <span className="amp-drive-crumb-arrow">›</span>
                    <button
                      className="amp-drive-crumb"
                      onClick={() => navigateToStackIndex(idx + 1)}
                      type="button"
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {driveError && <p className="amp-confirm-error" style={{ margin: "8px 0" }}>{driveError}</p>}

              {driveLoading ? (
                <div className="amp-import-loading">
                  <SpinnerIcon size={20} />
                  <span>Зареждане...</span>
                </div>
              ) : (
                <div className="amp-drive-list">
                  {(!driveItems || (driveItems.folders.length === 0 && driveItems.sheets.length === 0)) && (
                    <p className="amp-empty" style={{ padding: "16px 0" }}>Няма папки или таблици тук.</p>
                  )}
                  {driveItems?.folders.map((folder) => (
                    <button
                      key={folder.id}
                      className="amp-drive-item amp-drive-item--folder"
                      onClick={() => navigateIntoFolder(folder)}
                      type="button"
                    >
                      <FolderIcon />
                      <span>{folder.name}</span>
                    </button>
                  ))}
                  {driveItems?.sheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      className="amp-drive-item amp-drive-item--sheet"
                      onClick={() => void selectSheet(sheet)}
                      type="button"
                    >
                      <SheetFileIcon />
                      <span>{sheet.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Preview step ── */}
          {step === "preview" && (
            <div className="amp-import-preview">
              <p className="amp-import-sheet-name">
                <SheetFileIcon />
                <strong>{selectedSheet?.name}</strong>
              </p>

              {previewLoading && (
                <div className="amp-import-loading">
                  <SpinnerIcon size={20} />
                  <span>Четене на таблицата...</span>
                </div>
              )}

              {previewError && <p className="amp-confirm-error">{previewError}</p>}

              {!previewLoading && !previewError && previewRows.length === 0 && (
                <p className="amp-empty">Не са намерени редове с данни.</p>
              )}

              {!previewLoading && !previewError && previewRows.length > 0 && (
                <>
                  <p className="amp-import-row-count">
                    {validRowCount} от {previewRows.length} реда ще бъдат импортирани
                    {previewRows.some((r) => r.warning) && (
                      <span className="amp-import-warn-count"> · {previewRows.filter((r) => r.warning).length} с предупреждения</span>
                    )}
                  </p>
                  <div className="amp-preview-table-wrap">
                    <table className="amp-preview-table">
                      <thead>
                        <tr>
                          <th>Ime</th>
                          <th>Роден</th>
                          <th>№</th>
                          <th>Отбор</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr key={row.rowIndex} className={row.warning ? "amp-preview-row--warn" : ""}>
                            <td>{row.fullName}</td>
                            <td>{row.birthDateIso ? new Date(row.birthDateIso).toLocaleDateString("bg-BG") : <span className="amp-preview-missing">{row.warning ?? "—"}</span>}</td>
                            <td>{row.jerseyNumber ?? "—"}</td>
                            <td>{row.teamGroup ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importError && <p className="amp-confirm-error" style={{ marginTop: 8 }}>{importError}</p>}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button
                  className="amp-btn amp-btn--ghost"
                  type="button"
                  onClick={() => { setStep("browse"); setPreviewError(""); setImportError(""); }}
                >
                  Назад
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={() => void runImport()}
                  disabled={previewLoading || validRowCount === 0}
                >
                  Импортирай {validRowCount > 0 ? `${validRowCount} играча` : ""}
                </button>
              </div>
            </div>
          )}

          {/* ── Importing step ── */}
          {step === "importing" && (
            <div className="amp-import-loading amp-import-loading--center">
              <SpinnerIcon size={28} />
              <span>Импортиране...</span>
            </div>
          )}

          {/* ── Results step ── */}
          {step === "results" && importResult && (
            <div className="amp-import-results">
              <div className="amp-import-result-stats">
                <div className="amp-import-stat amp-import-stat--created">
                  <span className="amp-import-stat-num">{importResult.created}</span>
                  <span className="amp-import-stat-lbl">Добавени</span>
                </div>
                <div className="amp-import-stat amp-import-stat--skipped">
                  <span className="amp-import-stat-num">{importResult.skipped}</span>
                  <span className="amp-import-stat-lbl">Пропуснати</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="amp-import-errors">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setErrorsExpanded((v) => !v)}
                  >
                    {errorsExpanded ? "▲" : "▼"} {importResult.errors.length} грешки
                  </button>
                  {errorsExpanded && (
                    <ul className="amp-import-errors-list">
                      {importResult.errors.map((e) => (
                        <li key={e.row}>
                          <span className="amp-import-err-row">Ред {e.row}</span> {e.name} — {e.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button className="amp-btn amp-btn--primary" type="button" onClick={onClose}>
                  Затвори
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ── Import Photos From Drive Modal ── */

function ImportPhotosFromDriveModal({
  clubId,
  onClose,
  onImported,
}: {
  clubId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<PhotoImportStep>("browse");
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [driveItems, setDriveItems] = useState<{ folders: DriveItem[]; sheets: DriveItem[]; images: DriveItem[] } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [importResult, setImportResult] = useState<PhotoImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [detailsExpanded, setDetailsExpanded] = useState<"unmatched" | "ambiguous" | "failed" | null>(null);

  useEffect(() => {
    void loadDriveFolder("root");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDriveFolder(folderId: string) {
    setDriveLoading(true);
    setDriveError("");
    try {
      const res = await fetch(`/api/admin/google/drive?folderId=${encodeURIComponent(folderId)}&mode=photos`);
      const data = (await res.json().catch(() => ({}))) as { folders?: DriveItem[]; sheets?: DriveItem[]; images?: DriveItem[]; error?: string };
      if (!res.ok) {
        setDriveError(data.error ?? "Грешка при зареждане на Drive.");
        return;
      }
      setDriveItems({ folders: data.folders ?? [], sheets: [], images: data.images ?? [] });
    } catch {
      setDriveError("Грешка при свързване.");
    } finally {
      setDriveLoading(false);
    }
  }

  function navigateIntoFolder(folder: DriveItem) {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    void loadDriveFolder(folder.id);
  }

  function navigateToStackIndex(index: number) {
    const newStack = folderStack.slice(0, index);
    setFolderStack(newStack);
    const folderId = newStack.length > 0 ? newStack[newStack.length - 1].id : "root";
    void loadDriveFolder(folderId);
  }

  function selectCurrentFolder() {
    if (folderStack.length === 0) return;
    const current = folderStack[folderStack.length - 1];
    setSelectedFolder(current);
    setStep("confirm");
  }

  async function runImport() {
    if (!selectedFolder) return;
    setStep("importing");
    setImportError("");
    try {
      const res = await fetch("/api/admin/members/import-drive-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: selectedFolder.id, clubId, overwrite }),
      });
      const data = (await res.json()) as PhotoImportResult & { error?: string };
      if (!res.ok) {
        setImportError(data.error ?? "Грешка при импортиране.");
        setStep("confirm");
        return;
      }
      setImportResult(data);
      setStep("results");
      onImported();
    } catch {
      setImportError("Грешка при свързване.");
      setStep("confirm");
    }
  }

  return (
    <div className="amp-overlay" onClick={step === "importing" ? undefined : onClose}>
      <div className="amp-modal amp-modal--import-sheets" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Импорт на снимки от Google Drive</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори" disabled={step === "importing"}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">

          {/* ── Browse step ── */}
          {step === "browse" && (
            <div className="amp-import-browse">
              <div className="amp-drive-breadcrumb">
                <button
                  className="amp-drive-crumb"
                  onClick={() => navigateToStackIndex(0)}
                  type="button"
                >
                  My Drive
                </button>
                {folderStack.map((folder, idx) => (
                  <span key={folder.id} className="amp-drive-crumb-sep">
                    <span className="amp-drive-crumb-arrow">›</span>
                    <button
                      className="amp-drive-crumb"
                      onClick={() => navigateToStackIndex(idx + 1)}
                      type="button"
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {driveError && <p className="amp-confirm-error" style={{ margin: "8px 0" }}>{driveError}</p>}

              {driveLoading ? (
                <div className="amp-import-loading">
                  <SpinnerIcon size={20} />
                  <span>Зареждане...</span>
                </div>
              ) : (
                <div className="amp-drive-list">
                  {(!driveItems || (driveItems.folders.length === 0 && driveItems.images.length === 0)) && (
                    <p className="amp-empty" style={{ padding: "16px 0" }}>Няма папки или снимки тук.</p>
                  )}
                  {driveItems?.folders.map((folder) => (
                    <button
                      key={folder.id}
                      className="amp-drive-item amp-drive-item--folder"
                      onClick={() => navigateIntoFolder(folder)}
                      type="button"
                    >
                      <FolderIcon />
                      <span>{folder.name}</span>
                    </button>
                  ))}
                  {driveItems?.images.map((img) => (
                    <div
                      key={img.id}
                      className="amp-drive-item amp-drive-item--file"
                    >
                      <PhotoImportIcon size={14} />
                      <span>{img.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={selectCurrentFolder}
                  disabled={folderStack.length === 0 || driveLoading}
                >
                  Избери тази папка
                </button>
              </div>
            </div>
          )}

          {/* ── Confirm step ── */}
          {step === "confirm" && selectedFolder && (
            <div className="amp-import-preview">
              <p className="amp-import-folder-name">
                <FolderIcon />
                <strong>{selectedFolder.name}</strong>
              </p>
              <p className="amp-import-confirm-hint">
                Снимките в тази папка ще бъдат съпоставени с играчите по име на файл.
              </p>
              <label className="amp-import-overwrite-label">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                Презапиши съществуващи снимки
              </label>

              {importError && <p className="amp-confirm-error" style={{ marginTop: 8 }}>{importError}</p>}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button
                  className="amp-btn amp-btn--ghost"
                  type="button"
                  onClick={() => { setStep("browse"); setImportError(""); }}
                >
                  Назад
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={() => void runImport()}
                >
                  Импортирай снимките
                </button>
              </div>
            </div>
          )}

          {/* ── Importing step ── */}
          {step === "importing" && (
            <div className="amp-import-loading amp-import-loading--center">
              <SpinnerIcon size={28} />
              <span>Импортиране на снимки...</span>
            </div>
          )}

          {/* ── Results step ── */}
          {step === "results" && importResult && (
            <div className="amp-import-results">
              <div className="amp-import-result-stats amp-import-result-stats--wrap">
                <div className="amp-import-stat amp-import-stat--created">
                  <span className="amp-import-stat-num">{importResult.updated}</span>
                  <span className="amp-import-stat-lbl">Обновени</span>
                </div>
                <div className="amp-import-stat amp-import-stat--skipped">
                  <span className="amp-import-stat-num">{importResult.skippedExisting}</span>
                  <span className="amp-import-stat-lbl">Пропуснати</span>
                </div>
                <div className="amp-import-stat amp-import-stat--warning">
                  <span className="amp-import-stat-num">{importResult.unmatched}</span>
                  <span className="amp-import-stat-lbl">Несъвпадащи</span>
                </div>
                {importResult.failedUploads > 0 && (
                  <div className="amp-import-stat amp-import-stat--error">
                    <span className="amp-import-stat-num">{importResult.failedUploads}</span>
                    <span className="amp-import-stat-lbl">Грешки</span>
                  </div>
                )}
              </div>

              {importResult.details.unmatchedFiles.length > 0 && (
                <div className="amp-import-errors amp-import-errors--warning">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setDetailsExpanded((v) => v === "unmatched" ? null : "unmatched")}
                  >
                    {detailsExpanded === "unmatched" ? "▲" : "▼"} {importResult.details.unmatchedFiles.length} несъвпадащи файла
                  </button>
                  {detailsExpanded === "unmatched" && (
                    <ul className="amp-import-errors-list">
                      {importResult.details.unmatchedFiles.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {importResult.details.ambiguousFiles.length > 0 && (
                <div className="amp-import-errors amp-import-errors--warning">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setDetailsExpanded((v) => v === "ambiguous" ? null : "ambiguous")}
                  >
                    {detailsExpanded === "ambiguous" ? "▲" : "▼"} {importResult.details.ambiguousFiles.length} двусмислени файла
                  </button>
                  {detailsExpanded === "ambiguous" && (
                    <ul className="amp-import-errors-list">
                      {importResult.details.ambiguousFiles.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {importResult.details.failedFiles.length > 0 && (
                <div className="amp-import-errors">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setDetailsExpanded((v) => v === "failed" ? null : "failed")}
                  >
                    {detailsExpanded === "failed" ? "▲" : "▼"} {importResult.details.failedFiles.length} неуспешни качвания
                  </button>
                  {detailsExpanded === "failed" && (
                    <ul className="amp-import-errors-list">
                      {importResult.details.failedFiles.map((f) => (
                        <li key={f.fileName}>
                          <span className="amp-import-err-row">{f.fileName}</span> — {f.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button className="amp-btn amp-btn--primary" type="button" onClick={onClose}>
                  Затвори
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteTrainingGroupModal({
  groupName,
  isCustomGroup,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  groupName: string;
  isCustomGroup: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const subject = isCustomGroup ? "група" : "сборен отбор";
  const subjectWithArticle = isCustomGroup ? "групата" : "сборния отбор";
  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isDeleting ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">{`Потвърди изтриване на ${subject}`}</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да изтриеш <strong>{groupName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            {`Това действие е необратимо и ще премахне ${subjectWithArticle} и свързаните тренировъчни дни.`}
          </p>

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Изтриване..." : `Изтрий ${subjectWithArticle}`}
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

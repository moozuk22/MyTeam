"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { uploadImage } from "@/lib/uploadImage";
import { extractUploadPathFromCloudinaryUrl } from "@/lib/cloudinaryImagePath";
import "./page.css";

interface MemberProfile {
  id: string;
  cardCode: string;
  name: string;
  clubId?: string | null;
  clubName?: string | null;
  clubSports?: string | null;
  clubLogoUrl?: string | null;
  avatarUrl?: string | null;
  jerseyNumber?: string | null;
  birthDate?: string | null;
  isActive?: boolean;
  team_group?: number | null;
  status?: "paid" | "warning" | "overdue" | "paused";
  last_payment_date?: string | null;
  notifications?: Array<{
    id: string;
    title: string;
    sentAt: string;
  }>;
  paymentLogs?: Array<{
    id: string;
    paidFor: string;
    paidAt: string;
  }>;
  paymentWaivers?: Array<{
    id: string;
    waivedFor: string;
    reason?: string | null;
    createdAt: string;
    createdBy: string;
  }>;
  isPausedThisMonth?: boolean;
}

interface TrainingDayStatus {
  date: string;
  weekday: number;
  optedOut: boolean;
  optOutReasonCode?: TrainingOptOutReasonCode | null;
  optOutReasonText?: string | null;
  trainingTime?: string;
  note: string;
}

type TrainingOptOutReasonCode = "injury" | "sick" | "other";

const SPEED_LINES = [8, 16, 24, 33, 42, 54, 65, 76, 85, 93];

const MONTH_NAMES_BG = [
  "Яну", "Фев", "Мар", "Апр", "Май", "Юни",
  "Юли", "Авг", "Сеп", "Окт", "Ное", "Дек",
];

const MONTH_NAMES_BG_FULL = [
  "Януари", "Февруари", "Март", "Април", "Май", "Юни",
  "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември",
];

const TRAINING_WEEKDAY_LABELS_BG: Record<number, string> = {
  1: "Понеделник",
  2: "Вторник",
  3: "Сряда",
  4: "Четвъртък",
  5: "Петък",
  6: "Събота",
  7: "Неделя",
};
const TRAINING_WEEKDAY_SHORT_BG = Array.from({ length: 7 }, (_, index) =>
  new Intl.DateTimeFormat("bg-BG", { weekday: "short" })
    .format(new Date(Date.UTC(2024, 0, 1 + index)))
    .replace(".", ""),
);

const STATUS_MAP = {
  paid: { label: "ТАКСА: ПЛАТЕНА", cls: "green glow" },
  warning: { label: "ПРЕДСТОЯЩО ПЛАЩАНЕ", cls: "yellow glow-yellow" },
  overdue: { label: "ТАКСА: ДЪЛЖИМА", cls: "red glow-red" },
} as const;

const ShareIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v13" />
    <path d="m16 6-4-4-4 4" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
  </svg>
);

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

const FileTextIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);

const PrinterIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const ArrowLeftIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const ChevronIcon = ({ direction }: { direction: "left" | "right" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
  </svg>
);

// ── Helpers ──────────────────────────────────────────────
function parseYearMonth(dateStr: string): { year: number; month: number } {
  const d = new Date(dateStr);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

function cmpYM(a: { year: number; month: number }, b: { year: number; month: number }) {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

function addMonths(ym: { year: number; month: number }, n: number) {
  const d = new Date(ym.year, ym.month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function toISOMonth(ym: { year: number; month: number }) {
  const mm = String(ym.month + 1).padStart(2, "0");
  return `${ym.year}-${mm}-01T00:00:00.000Z`;
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

function formatIsoDateForBgDisplay(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMonthYearInBgUtc(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const text = parsed.toLocaleDateString("bg-BG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getTrainingDateTimeMs(dateIso: string, trainingTime?: string): number {
  const normalizedTime =
    typeof trainingTime === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(trainingTime.trim())
      ? trainingTime.trim()
      : "00:00";
  const parsed = new Date(`${dateIso}T${normalizedTime}:00`);
  return parsed.getTime();
}

export default function MemberCardPage({
  params,
}: {
  params: Promise<{ cardCode: string }>;
}) {
  const { cardCode } = use(params);
  const normalizedCardCode = cardCode.trim().toUpperCase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState("");
  const [pushStatusTone, setPushStatusTone] = useState<"success" | "danger">("success");
  const [pushErrorMessage, setPushErrorMessage] = useState("");
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [sportDepotModalOpen, setSportDepotModalOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [idbModalOpen, setIdbModalOpen] = useState(false);
  const [idbCodeCopied, setIdbCodeCopied] = useState(false);
  const [nikoModalOpen, setNikoModalOpen] = useState(false);
  const [nikoCodeCopied, setNikoCodeCopied] = useState(false);
  const [dalidaModalOpen, setDalidaModalOpen] = useState(false);
  const [dalidaCodeCopied, setDalidaCodeCopied] = useState(false);
  const [allDiscountsModalOpen, setAllDiscountsModalOpen] = useState(false);
  const [isIPhoneDevice, setIsIPhoneDevice] = useState(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState("");
  const [editForm, setEditForm] = useState({
    fullName: "",
    birthDate: "",
    teamGroup: "",
    jerseyNumber: "",
  });

  // Notifications
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    url?: string | null;
    sentAt: string;
    readAt: string | null;
  }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [lastHandledPushOpenTs, setLastHandledPushOpenTs] = useState<string | null>(null);

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedYM, setSelectedYM] = useState<{ year: number; month: number } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseActionLoading, setPauseActionLoading] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [selectedPauseMonths, setSelectedPauseMonths] = useState<Array<{ year: number; month: number }>>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    id: string;
    paidFor: string;
    paidAt: string;
  } | null>(null);
  const [trainingDays, setTrainingDays] = useState<TrainingDayStatus[]>([]);
  const [trainingWindowDays, setTrainingWindowDays] = useState(30);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingSavingDate, setTrainingSavingDate] = useState<string | null>(null);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [trainingDetailsDate, setTrainingDetailsDate] = useState<string | null>(null);
  const [trainingNotePopupOpen, setTrainingNotePopupOpen] = useState(false);
  const [trainingAttendancePopupOpen, setTrainingAttendancePopupOpen] = useState(false);
  const [trainingConfirmModalOpen, setTrainingConfirmModalOpen] = useState(false);
  const [trainingConfirmAction, setTrainingConfirmAction] = useState<"attend" | "optOut" | null>(null);
  const [trainingOptOutReasonCode, setTrainingOptOutReasonCode] = useState<TrainingOptOutReasonCode | "">("");
  const [trainingOptOutReasonText, setTrainingOptOutReasonText] = useState("");
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());

  // ── Derived: paid months set ─────────────────────────
  const paidSet = new Set<string>(
    (member?.paymentLogs ?? []).map(({ paidFor }) => {
      const { year, month } = parseYearMonth(paidFor);
      return `${year}-${month}`;
    })
  );
  const waivedSet = new Set<string>(
    (member?.paymentWaivers ?? []).map(({ waivedFor }) => {
      const { year, month } = parseYearMonth(waivedFor);
      return `${year}-${month}`;
    })
  );
  const settledSet = new Set<string>([...paidSet, ...waivedSet]);
  const selectedPauseKeys = new Set(
    selectedPauseMonths.map((item) => `${item.year}-${item.month}`),
  );
  const canApplyPause = selectedPauseMonths.some(
    (item) => !waivedSet.has(`${item.year}-${item.month}`),
  );
  const canRemovePause = selectedPauseMonths.some(
    (item) => waivedSet.has(`${item.year}-${item.month}`),
  );
  const trainingDaysSorted = [...trainingDays].sort((a, b) => a.date.localeCompare(b.date));
  const trainingDaysWithNotes = trainingDaysSorted.filter((item) => item.note.trim().length > 0);
  const trainingByDate = new Map(trainingDaysSorted.map((item) => [item.date, item]));
  const trainingDetailsItem = trainingDetailsDate ? trainingByDate.get(trainingDetailsDate) ?? null : null;
  const today = new Date();
  const todayDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const trainingMonths = (() => {
    const monthMap = new Map<string, { year: number; month: number }>();
    for (const item of trainingDaysSorted) {
      const [yearStr, monthStr] = item.date.split("-");
      const year = Number.parseInt(yearStr ?? "", 10);
      const month = Number.parseInt(monthStr ?? "", 10);
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        continue;
      }
      monthMap.set(`${year}-${month}`, { year, month });
    }

    return [...monthMap.values()]
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year))
      .map(({ year, month }) => {
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
        const leadingEmptyDays = (firstWeekday + 6) % 7;
        const cells: Array<string | null> = Array.from({ length: leadingEmptyDays }, () => null);
        for (let day = 1; day <= daysInMonth; day += 1) {
          cells.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        }
        while (cells.length % 7 !== 0) {
          cells.push(null);
        }

        return {
          key: `${year}-${month}`,
          label: `${MONTH_NAMES_BG_FULL[month - 1] ?? ""} ${year}`,
          cells,
        };
      });
  })();
  const nextTrainingEntry =
    trainingDaysSorted
      .filter((item) => !item.optedOut)
      .map((item) => ({
        item,
        targetMs: getTrainingDateTimeMs(item.date, item.trainingTime),
      }))
      .filter((entry) => Number.isFinite(entry.targetMs))
      .sort((a, b) => a.targetMs - b.targetMs)
      .find((entry) => entry.targetMs >= countdownNowMs) ?? null;
  const nextTrainingDate = nextTrainingEntry?.item.date ?? null;
  const nextTrainingTime = nextTrainingEntry?.item.trainingTime?.trim() || null;
  const nextTrainingCountdown = (() => {
    if (!nextTrainingEntry) {
      return null;
    }
    const diffMs = Math.max(0, nextTrainingEntry.targetMs - countdownNowMs);
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  })();

  // Last paid month
  const lastPaidYM: { year: number; month: number } | null = (() => {
    if (!member?.paymentLogs?.length) return null;
    return [...member.paymentLogs]
      .map(({ paidFor }) => parseYearMonth(paidFor))
      .sort((a, b) => cmpYM(b, a))[0];
  })();

  // Next unpaid = first month that is not settled (paid or waived)
  const firstUnpaidYM = (() => {
    let candidate = lastPaidYM
      ? addMonths(lastPaidYM, 1)
      : { year: new Date().getFullYear(), month: new Date().getMonth() };

    while (settledSet.has(`${candidate.year}-${candidate.month}`)) {
      candidate = addMonths(candidate, 1);
    }

    return candidate;
  })();

  const openPaymentModal = () => {
    setCalendarYear(firstUnpaidYM.year);
    setSelectedYM(firstUnpaidYM);
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  // Month state
  type MonthState = "paid" | "waived" | "selected" | "next" | "available" | "disabled";
  const getMonthState = (ym: { year: number; month: number }): MonthState => {
    const key = `${ym.year}-${ym.month}`;
    if (paidSet.has(key)) return "paid";
    if (waivedSet.has(key)) return "waived";
    if (cmpYM(ym, firstUnpaidYM) < 0) return "disabled";
    const isNext = key === `${firstUnpaidYM.year}-${firstUnpaidYM.month}`;
    if (selectedYM && `${selectedYM.year}-${selectedYM.month}` === key) return "selected";
    if (isNext) return "next";
    return "available";
  };

  const handleMonthClick = (ym: { year: number; month: number }) => {
    const key = `${ym.year}-${ym.month}`;
    if (paidSet.has(key) || waivedSet.has(key)) return;
    // Only allow selecting the exact next unpaid month — no skipping
    if (key !== `${firstUnpaidYM.year}-${firstUnpaidYM.month}`) return;
    setSelectedYM(ym);
  };

  void handleMonthClick;

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const response = await fetch(`/api/members/${normalizedCardCode}/notifications`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleNotificationsPanelOpen = async () => {
    if (isAdmin || isCoach) {
      return;
    }
    setNotificationsPanelOpen(true);
    await fetchNotifications();

    // Mark all as read when opening the panel
    if (unreadCount > 0) {
      try {
        const response = await fetch(`/api/members/${normalizedCardCode}/notifications/read`, {
          method: "POST",
        });
        if (response.ok) {
          setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
          setUnreadCount(0);
        }
      } catch (error) {
        console.error("Failed to mark notifications as read:", error);
      }
    }
  };

  const getOptOutDatesFromDays = (days: TrainingDayStatus[]) =>
    days
      .filter((item) => item.optedOut)
      .map((item) => item.date)
      .sort((a, b) => a.localeCompare(b));

  const fetchTrainingDays = async (): Promise<TrainingDayStatus[]> => {
    setTrainingLoading(true);
    setTrainingError(null);
    try {
      const response = await fetch(`/api/members/${normalizedCardCode}/training`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Неуспешно зареждане на тренировките.",
        );
      }

      const payload = await response.json();
      const days = Array.isArray(payload?.dates)
        ? payload.dates
          .map((item: unknown) => {
            const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
            return {
              date: String(raw.date ?? ""),
              weekday: Number(raw.weekday ?? 0),
              optedOut: Boolean(raw.optedOut),
              optOutReasonCode:
                raw.optOutReasonCode === "injury" || raw.optOutReasonCode === "sick" || raw.optOutReasonCode === "other"
                  ? raw.optOutReasonCode
                  : null,
              optOutReasonText: String(raw.optOutReasonText ?? "").trim() || null,
              trainingTime: String(raw.trainingTime ?? "").trim(),
              note: String(raw.note ?? ""),
            } satisfies TrainingDayStatus;
          })
          .filter((item: TrainingDayStatus) => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
        : [];
      const nextWindowDays = Number.parseInt(String(payload?.trainingWindowDays ?? "30"), 10);
      setTrainingWindowDays(Number.isInteger(nextWindowDays) && nextWindowDays > 0 ? nextWindowDays : 30);
      setTrainingDays(days);
      return days;
    } catch (error) {
      console.error("Failed to fetch training schedule:", error);
      setTrainingError(error instanceof Error ? error.message : "Възникна грешка.");
      setTrainingDays([]);
      return [];
    } finally {
      setTrainingLoading(false);
    }
  };

  const openTrainingModal = async () => {
    setTrainingError(null);
    setTrainingNotePopupOpen(false);
    setTrainingDetailsDate(trainingDaysSorted[0]?.date ?? null);
    setTrainingModalOpen(true);
    const latestDays = await fetchTrainingDays();
    setTrainingDetailsDate(latestDays[0]?.date ?? null);
  };

  const closeTrainingModal = () => {
    setTrainingNotePopupOpen(false);
    setTrainingDetailsDate(trainingDaysSorted[0]?.date ?? null);
    setTrainingModalOpen(false);
  };

  const trackDiscount = (partner: string, action: "view" | "copy" | "link_click") => {
    void fetch(`/api/members/${normalizedCardCode}/discount-usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner, action }),
    }).catch(() => {});
  };

  // Fetch member
  useEffect(() => {
    const fetchMember = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/members/${normalizedCardCode}`, { cache: "no-store" });
        if (!response.ok) {
          setMember(null);
          setError("Профилът не е намерен.");
          return;
        }
        const data = (await response.json()) as MemberProfile;
        setMember(data);
      } catch (e) {
        console.error("Failed to fetch member:", e);
        setError("Възникна грешка при зареждане.");
      } finally {
        setLoading(false);
      }
    };
    void fetchMember();
  }, [normalizedCardCode]);

  useEffect(() => {
    void fetchTrainingDays();
  }, [normalizedCardCode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  // Live updates via SSE (no polling)
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const source = new EventSource(`/api/members/${normalizedCardCode}/events`);

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

      if (type === "ping" || type === "connected") {
        return;
      }

      if (type === "status-updated" || type === "payment-history-updated") {
        void (async () => {
          try {
            const response = await fetch(`/api/members/${normalizedCardCode}`, { cache: "no-store" });
            if (!response.ok) {
              return;
            }
            const data = (await response.json()) as MemberProfile;
            setMember(data);
          } catch (error) {
            console.error("Failed to refresh member after live update event:", error);
          }
        })();
      }

      if (type === "training-updated") {
        void fetchTrainingDays();
      }

      if (type === "notification-created") {
        void (async () => {
          try {
            const response = await fetch(`/api/members/${normalizedCardCode}/notifications`, {
              cache: "no-store",
            });
            if (!response.ok) {
              return;
            }
            const data = await response.json();
            setUnreadCount(data.unreadCount || 0);
            if (notificationsPanelOpen) {
              setNotifications(data.notifications || []);
            }
          } catch (error) {
            console.error("Failed to refresh notifications after event:", error);
          }
        })();
      }
    };

    source.onerror = () => {
      // Let browser auto-reconnect.
    };

    return () => {
      source.close();
    };
  }, [normalizedCardCode, notificationsPanelOpen]);

  // Fetch unread notification count on page load
  useEffect(() => {
    if (isAdmin || isCoach) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(`/api/members/${normalizedCardCode}/notifications`, { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    };
    void fetchUnreadCount();
  }, [normalizedCardCode, isAdmin, isCoach]);

  useEffect(() => {
    if (!member) {
      return;
    }

    setEditForm({
      fullName: member.name ?? "",
      birthDate: member.birthDate ? new Date(member.birthDate).toISOString().slice(0, 10) : "",
      teamGroup: member.team_group !== null && member.team_group !== undefined ? String(member.team_group) : "",
      jerseyNumber: member.jerseyNumber ?? "",
    });
    setEditImageFile(null);
    setEditImagePreviewUrl("");
  }, [member]);

  useEffect(() => {
    if (!editImageFile) {
      setEditImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(editImageFile);
    setEditImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [editImageFile]);

  useEffect(() => {
    if (isAdmin || isCoach) {
      return;
    }

    const pushOpenTs = searchParams.get("pushOpenTs");
    const fromPush = searchParams.get("fromPush") === "1" && Boolean(pushOpenTs);
    const shouldOpenBell = fromPush && searchParams.get("openBell") === "1";
    const shouldOpenTraining = fromPush && searchParams.get("openTraining") === "1";

    if ((!shouldOpenBell && !shouldOpenTraining) || !pushOpenTs || pushOpenTs === lastHandledPushOpenTs) {
      return;
    }

    setLastHandledPushOpenTs(pushOpenTs);

    if (shouldOpenTraining) {
      setTrainingError(null);
      setTrainingNotePopupOpen(false);
      setTrainingModalOpen(true);
    }

    if (shouldOpenBell) {
      setNotificationsPanelOpen(true);
      void (async () => {
        setLoadingNotifications(true);
        try {
          const response = await fetch(`/api/members/${normalizedCardCode}/notifications`, { cache: "no-store" });
          if (response.ok) {
            const data = await response.json();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
          }
        } catch (error) {
          console.error("Failed to fetch notifications:", error);
        } finally {
          setLoadingNotifications(false);
        }

        try {
          const response = await fetch(`/api/members/${normalizedCardCode}/notifications/read`, {
            method: "POST",
          });
          if (response.ok) {
            setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
            setUnreadCount(0);
          }
        } catch (error) {
          console.error("Failed to mark notifications as read:", error);
        }
      })();
    }

    const cleanedParams = new URLSearchParams(searchParams.toString());
    cleanedParams.delete("fromPush");
    cleanedParams.delete("openBell");
    cleanedParams.delete("openTraining");
    cleanedParams.delete("pushOpenTs");
    const cleanedQuery = cleanedParams.toString();
    const cleanPath = `/member/${encodeURIComponent(normalizedCardCode)}`;
    router.replace(cleanedQuery ? `${cleanPath}?${cleanedQuery}` : cleanPath, { scroll: false });
  }, [normalizedCardCode, lastHandledPushOpenTs, router, searchParams, isAdmin, isCoach]);

  useEffect(() => {
    const checkAdminSession = async () => {
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
        const payload = (await response.json()) as { isAdmin?: boolean; isCoach?: boolean };
        setIsAdmin(Boolean(payload.isAdmin));
        setIsCoach(Boolean(payload.isCoach));
      } catch {
        setIsAdmin(false);
        setIsCoach(false);
      }
    };

    void checkAdminSession();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const ua = window.navigator.userAgent || "";
    setIsIPhoneDevice(/iPhone/i.test(ua));
    const standaloneByDisplayMode = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
    const standaloneByNavigator = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandaloneMode(standaloneByDisplayMode || standaloneByNavigator);
  }, []);

  useEffect(() => {
    const detectExistingPushSubscription = async () => {
      if (typeof window === "undefined") {
        return;
      }

      const supportsPush =
        window.isSecureContext &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!supportsPush) {
        setIsPushEnabled(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        setIsPushEnabled(Boolean(existingSubscription));
      } catch (subscriptionError) {
        console.error("Detect push subscription error:", subscriptionError);
        setIsPushEnabled(false);
      }
    };

    void detectExistingPushSubscription();
  }, []);

  const handleEnablePushNotifications = async () => {
    setPushStatusMessage("");
    setPushStatusTone("success");
    setPushErrorMessage("");

    if (typeof window === "undefined") {
      return;
    }

    const supportsPush =
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!supportsPush) {
      setPushErrorMessage("Push is not supported on this device or HTTPS is missing.");
      return;
    }

    setIsEnablingPush(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushErrorMessage("Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const keyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
      if (!keyResponse.ok) {
        const payload = await keyResponse.json().catch(() => ({}));
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Missing VAPID server configuration."
        );
      }

      const { publicKey } = (await keyResponse.json()) as { publicKey: string };

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        }));

      const saveResponse = await fetch(
        `/api/members/${encodeURIComponent(normalizedCardCode)}/push-subscriptions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        }
      );

      if (!saveResponse.ok) {
        const payload = await saveResponse.json().catch(() => ({}));
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Failed to enable push notifications."
        );
      }

      setIsPushEnabled(true);
      setPushStatusMessage("");
      setPushStatusTone("success");
    } catch (pushError) {
      console.error("Enable push error:", pushError);
      setPushErrorMessage(
        pushError instanceof Error ? pushError.message : "Unexpected push setup error."
      );
      setIsPushEnabled(false);
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleDisablePushNotifications = async () => {
    setPushStatusMessage("");
    setPushStatusTone("danger");
    setPushErrorMessage("");

    if (typeof window === "undefined") {
      return;
    }

    const supportsPush =
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!supportsPush) {
      setPushErrorMessage("Push is not supported on this device or HTTPS is missing.");
      return;
    }

    setIsEnablingPush(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existingSubscription = await registration.pushManager.getSubscription();
      if (!existingSubscription) {
        setIsPushEnabled(false);
        setPushStatusMessage("Известията вече са изключени.");
        setPushStatusTone("danger");
        return;
      }

      const endpoint = existingSubscription.endpoint;
      await existingSubscription.unsubscribe();

      const deleteResponse = await fetch(
        `/api/members/${encodeURIComponent(normalizedCardCode)}/push-subscriptions`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }
      );

      if (!deleteResponse.ok) {
        const payload = await deleteResponse.json().catch(() => ({}));
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Failed to disable push notifications."
        );
      }

      setIsPushEnabled(false);
      setPushStatusMessage("Известията са изключени.");
      setPushStatusTone("danger");
    } catch (pushError) {
      console.error("Disable push error:", pushError);
      setPushErrorMessage(
        pushError instanceof Error ? pushError.message : "Unexpected push disable error."
      );
    } finally {
      setIsEnablingPush(false);
    }
  };

  // Submit payment
  const handlePayment = async () => {
    if (!selectedYM || !member) return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const response = await fetch(`/api/members/${normalizedCardCode}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidFor: toISOMonth(selectedYM) }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Грешка при плащане");
      }
      const refreshed = await fetch(`/api/members/${normalizedCardCode}`, { cache: "no-store" });
      if (refreshed.ok) setMember(await refreshed.json());
      setPaymentModalOpen(false);
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Възникна грешка");
    } finally {
      setPaymentLoading(false);
    }
  };

  const togglePauseMonth = (ym: { year: number; month: number }) => {
    const key = `${ym.year}-${ym.month}`;
    setSelectedPauseMonths((prev) => {
      const exists = prev.some((item) => `${item.year}-${item.month}` === key);
      if (exists) {
        return prev.filter((item) => `${item.year}-${item.month}` !== key);
      }
      return [...prev, ym];
    });
  };

  const handleManagePauseMonths = async (mode: "pause" | "remove") => {
    if (!member || selectedPauseMonths.length === 0) {
      return;
    }

    setPauseActionLoading(true);
    setPauseError(null);
    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manage_pause_months",
          mode,
          reason: pauseReason.trim() || null,
          months: selectedPauseMonths.map((item) => toISOMonth(item)),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          typeof err?.error === "string" && err.error.trim()
            ? err.error
            : "Неуспешна промяна на пауза.",
        );
      }

      const refreshed = await fetch(`/api/members/${normalizedCardCode}`, { cache: "no-store" });
      if (refreshed.ok) {
        setMember((await refreshed.json()) as MemberProfile);
      }

      setSelectedPauseMonths([]);
      setPauseReason("");
      setPauseModalOpen(false);
    } catch (error) {
      setPauseError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setPauseActionLoading(false);
    }
  };

  const handleSavePublicEdit = async () => {
    if (!member || editSaving) return;

    const fullName = editForm.fullName.trim();
    if (!fullName) {
      setEditError("Името е задължително.");
      return;
    }

    const teamGroup =
      editForm.teamGroup.trim() === ""
        ? null
        : Number.parseInt(editForm.teamGroup.trim(), 10);
    if (teamGroup !== null && Number.isNaN(teamGroup)) {
      setEditError("Наборът трябва да е число.");
      return;
    }

    setEditSaving(true);
    setEditError("");
    try {
      let uploadedImagePath: string | null = null;
      if (editImageFile) {
        const uploaded = await uploadImage(
          editImageFile,
          "player",
          fullName || editImageFile.name,
        );
        uploadedImagePath = extractUploadPathFromCloudinaryUrl(uploaded.secure_url);
      }

      const response = await fetch(`/api/members/${normalizedCardCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          birthDate: editForm.birthDate.trim() || null,
          teamGroup,
          jerseyNumber: editForm.jerseyNumber.trim() || null,
          ...(uploadedImagePath ? { imageUrl: uploadedImagePath } : {}),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEditError(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Възникна грешка при редактиране.",
        );
        return;
      }

      const refreshed = await fetch(`/api/members/${normalizedCardCode}`, { cache: "no-store" });
      if (refreshed.ok) {
        setMember((await refreshed.json()) as MemberProfile);
      }
      setEditImageFile(null);
      setEditImagePreviewUrl("");
      setEditModalOpen(false);
    } catch (e) {
      console.error("Public member edit error:", e);
      setEditError("Възникна грешка при редактиране.");
    } finally {
      setEditSaving(false);
    }
  };

  const formatReceiptPeriod = (value: string) => formatMonthYearInBgUtc(value);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const handlePrintReceipt = () => {
    if (!selectedReceipt || !member || typeof window === "undefined" || typeof document === "undefined") return;

    const period = formatReceiptPeriod(selectedReceipt.paidFor);
    const paidAt = new Date(selectedReceipt.paidAt).toLocaleDateString("bg-BG");
    const clubName = member.clubName?.trim() || "Клуб";
    const safeMemberName = escapeHtml(member.name);
    const safeClubName = escapeHtml(clubName);
    const safePeriod = escapeHtml(period);
    const safePaidAt = escapeHtml(paidAt);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Разписка - ${safePeriod}</title>
  <style>
    body { margin: 0; background: #fff; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
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
    @page { margin: 12mm; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="head">
        <h1 class="title">${safeClubName}</h1>
        <p class="sub">Разписка за членски внос</p>
      </div>
      <hr class="sep" />
      <div class="row"><span class="lbl">Играч:</span><span class="val">${safeMemberName}</span></div>
      <div class="row"><span class="lbl">Период:</span><span class="val">${safePeriod}</span></div>
      <div class="row"><span class="lbl">Дата на плащане:</span><span class="val">${safePaidAt}</span></div>
      <hr class="sep" />
      <div class="stamp-wrap"><div class="stamp">ПЛАТЕНО</div></div>
    </div>
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
    }, 100);
  };

  const rawStatusKey = member?.status ?? "paid";
  const statusKey = rawStatusKey === "paused" ? "warning" : rawStatusKey;
  const status = STATUS_MAP[statusKey];
  const lastPaymentText = member?.last_payment_date
    ? new Date(member.last_payment_date).toLocaleDateString("bg-BG")
    : "Няма плащане";
  const birthDateText = member?.birthDate
    ? new Date(member.birthDate).toLocaleDateString("bg-BG").replace(/\s*г\.\s*$/, "")
    : "-";
  const canManagePayments = isAdmin || isCoach;
  const canPublicEdit = !isAdmin && !isCoach;
  const canUseNotifications = !isAdmin && !isCoach;
  const isOptOutReasonReady =
    trainingConfirmAction !== "optOut"
      ? true
      : trainingOptOutReasonCode !== "" &&
      (trainingOptOutReasonCode !== "other" || trainingOptOutReasonText.trim().length > 0);

  const handleTrainingAttendanceConfirm = async (
    action: "attend" | "optOut",
    item: TrainingDayStatus,
    reason?: {
      reasonCode: TrainingOptOutReasonCode;
      reasonText: string | null;
    },
  ) => {
    if (trainingSavingDate) {
      return;
    }
    setTrainingSavingDate(item.date);
    setTrainingError(null);
    try {
      const requestBody =
        action === "optOut"
          ? {
            trainingDate: item.date,
            reasonCode: reason?.reasonCode ?? "",
            reasonText: reason?.reasonText ?? "",
          }
          : { trainingDate: item.date };
      const response = await fetch(`/api/members/${normalizedCardCode}/training`, {
        method: action === "optOut" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
          throw new Error(payload.error.trim());
        }
        throw new Error(
          action === "optOut" ? "Неуспешно отказване на присъствие." : "Неуспешно потвърждаване на присъствие.",
        );
      }

      setTrainingDays((prev) =>
        prev.map((entry) =>
          entry.date === item.date
            ? {
              ...entry,
              optedOut: action === "optOut",
              optOutReasonCode: action === "optOut" ? reason?.reasonCode ?? null : null,
              optOutReasonText: action === "optOut" ? reason?.reasonText ?? null : null,
            }
            : entry,
        ),
      );
    } catch (error) {
      console.error("Failed to update training attendance:", error);
      setTrainingError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingSavingDate(null);
    }
  };

  if (loading) {
    return (
      <main className="page-bg">
        <div className="page-inner">
          <div className="card-shell">
            <div className="card-body">
              <p style={{ color: "rgba(255,255,255,0.7)", textAlign: "center" }}>Зареждане...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !member) {
    return (
      <main className="page-bg">
        <div className="page-inner">
          <div className="card-shell">
            <div className="card-body" style={{ gap: "12px" }}>
              <p style={{ color: "#e03535", textAlign: "center", margin: 0 }}>{error ?? "Профилът не е намерен."}</p>
              <button className="add-btn" onClick={() => router.push("/admin/members")}>Назад</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg">
      <div className="page-inner">
        {/* Top bar with back button and notification bell */}
        <div style={{
          display: "flex",
          justifyContent: isAdmin || isCoach ? "space-between" : "flex-end",
          alignItems: "center",
          marginBottom: "12px",
          gap: "12px"
        }}>
          {(isAdmin || isCoach) && (
            <button
              className="amp-back-btn"
              onClick={() =>
                router.push(
                  member.clubId
                    ? `/admin/members?clubId=${encodeURIComponent(member.clubId)}`
                    : "/admin/members",
                )
              }
            >
              <ArrowLeftIcon />
              Назад към играчи
            </button>
          )}

          {/* Notification bell icon */}
          {canUseNotifications && <button
            onClick={handleNotificationsPanelOpen}
            style={{
              position: "relative",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
              color: "#fff",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.15)";
              e.currentTarget.style.borderColor = "rgba(50,205,50,0.5)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            }}
            aria-label="Известия"
          >
            <BellIcon size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                background: "#ff3b3b",
                color: "#fff",
                borderRadius: "999px",
                padding: "2px 6px",
                fontSize: "10px",
                fontWeight: "700",
                minWidth: "18px",
                textAlign: "center",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
              }}>
                {unreadCount}
              </span>
            )}
          </button>}
        </div>

        {/* Member card */}
        <div className="card-shell">
          <div className="speed-lines-layer" aria-hidden="true">
            {SPEED_LINES.map((left, i) => (
              <div key={i} className="speed-line" style={{
                left: `${left}%`,
                width: i % 3 === 0 ? "3px" : "2px",
                opacity: 0.06 + (i % 3) * 0.03,
                filter: `blur(${i % 2 === 0 ? 1 : 3}px)`,
              }} />
            ))}
            <div className="speed-line speed-line--wide" style={{ left: "18%" }} />
            <div className="speed-line speed-line--wide2" style={{ left: "70%" }} />
          </div>
          <div className="vignette" aria-hidden="true" />
          <div className="card-body">
            <div className="header">
              <div className="header-logo">
                {member.clubLogoUrl ? (
                  <img src={member.clubLogoUrl} alt={member.clubName ?? "Club logo"} className="header-logo-img" />
                ) : (
                  <span className="header-logo-fallback">🏆</span>
                )}
              </div>
              <div className="header-center">
                <h1 className="card-title">КЛУБНА КАРТА <span>2026</span></h1>
                <p className="card-subtitle">{member.clubName || "Клуб"}</p>
              </div>
              <div className="shield">
                <svg viewBox="0 0 50 56" fill="none" className="shield-bg">
                  <path d="M25 2 L47 12 L47 35 Q47 50 25 54 Q3 50 3 35 L3 12 Z" fill="rgba(50,205,50,0.1)" stroke="#32cd32" strokeWidth="2.5" />
                </svg>
                <span className="shield-num">
                  {member.jerseyNumber ? `№${member.jerseyNumber}` : "\u2116 3"}
                </span>
              </div>
            </div>

            <div className="divider" />

            <div className="central">
              <div className="photo-wrap">
                <div className="photo-inner">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="photo-img"
                    />
                  ) : (
                    <span className="photo-letter">
                      {(member.name?.trim()?.charAt(0) || "?").toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div className="divider divider--short" />
              <div className="info-rows">
                <div className="info-row">
                  <span className="info-lbl">Име:</span>
                  <span className="info-val">{member.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Роден:</span>
                  <span className="info-val">{birthDateText}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Спорт:</span>
                  <span className="info-val">{member.clubSports?.trim() || "-"}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Статус:</span>
                  <span className={`info-val ${status.cls}`}>
                    {rawStatusKey === "paused" ? "ПАУЗА" : status.label}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Последно плащане:</span>
                  <span className="info-val">{lastPaymentText}</span>
                </div>
              </div>
            </div>

            <div className="divider divider--mt" />

            {/* ── Partner discount buttons — visible for admins/coaches ── */}
            {(isAdmin || isCoach) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
                {/* Sport Depot — always visible */}
                <button
                  className="sd-discount-btn"
                  style={{ marginTop: 0 }}
                  onClick={() => { setSportDepotModalOpen(true); trackDiscount("SPORT_DEPOT", "view"); }}
                  type="button"
                  aria-label="Absolute Teamsport отстъпка"
                >
                  <div className="sd-discount-logo-wrap">
                    <img src="/sd-logo.png" alt="Sport Depot" className="sd-discount-logo" />
                  </div>
                  <span className="sd-discount-label">Sport Depot</span>
                  <span className="sd-discount-badge">-10%</span>
                </button>

                {/* All offers button */}
                <button
                  onClick={() => setAllDiscountsModalOpen(true)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.8)",
                    padding: "12px",
                    borderRadius: "10px",
                    marginTop: "2px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.transform = "scale(1.01)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  type="button"
                >
                  Виж всички оферти
                </button>
              </div>
            )}
          </div>
        </div>

        {false && <div className="training-section">
          <div className="training-head">
            <h3 className="training-title">Легенда: Зелените дати са планирани тренировки, а червените са отбелязани отсъствия.</h3>
          </div>
          {canPublicEdit && (trainingLoading ? (
            <p className="training-empty">Зареждане...</p>
          ) : trainingDays.length === 0 ? (
            <p className="training-empty">Няма настроени тренировъчни дни.</p>
          ) : (
            <div className="training-calendar">
              {trainingMonths.map((month) => (
                <section key={month.key} className="training-calendar-month">
                  <h4 className="training-calendar-month-title">{month.label}</h4>
                  <div className="training-calendar-weekdays">
                    {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                      <span key={`${month.key}-${weekday}`} className="training-calendar-weekday">
                        {weekday}
                      </span>
                    ))}
                  </div>
                  <div className="training-calendar-grid">
                    {month.cells.map((cellDate, index) => {
                      if (!cellDate) {
                        return <span key={`${month.key}-empty-${index}`} className="training-calendar-cell training-calendar-cell--empty" aria-hidden="true" />;
                      }

                      const trainingItem = trainingByDate.get(cellDate);
                      const dayNumber = cellDate.slice(8, 10);
                      const isToday = cellDate === todayDateKey;
                      if (!trainingItem) {
                        return (
                          <span
                            key={cellDate}
                            className={`training-calendar-cell training-calendar-cell--off${isToday ? " training-calendar-cell--today" : ""}`}
                          >
                            <span className="training-calendar-day-number">{dayNumber}</span>
                          </span>
                        );
                      }

                      const isSaving = trainingSavingDate === trainingItem.date;
                      const trainingTimeLabel = trainingItem.trainingTime?.trim() ?? "";
                      const dateLabel = new Date(`${trainingItem.date}T12:00:00.000Z`).toLocaleDateString("bg-BG", {
                        day: "2-digit",
                        month: "2-digit",
                      });
                      return (
                        <button
                          key={cellDate}
                          className={`training-calendar-cell training-calendar-cell--training${trainingItem.optedOut ? " training-calendar-cell--opted-out" : ""}${isToday ? " training-calendar-cell--today" : ""}`}
                          onClick={() => {
                            setTrainingDetailsDate(trainingItem.date);
                            setTrainingAttendancePopupOpen(true);
                          }}
                          disabled={Boolean(trainingSavingDate)}
                          type="button"
                          aria-label={`${TRAINING_WEEKDAY_LABELS_BG[trainingItem.weekday] ?? "-"} ${dateLabel}${trainingTimeLabel ? ` ${trainingTimeLabel}` : ""}`}
                          aria-pressed={!trainingItem.optedOut}
                        >
                          <span className="training-calendar-day-number">{dayNumber}</span>
                          {trainingTimeLabel && (
                            <span className="training-calendar-time">{trainingTimeLabel}</span>
                          )}
                          <span className="training-calendar-mark">{isSaving ? "..." : trainingItem.optedOut ? "x" : "✓"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ))}
          {trainingError && <p className="training-error">{trainingError}</p>}
        </div>}

        {/* Below card buttons */}
        <div className="below-card">
          {canManagePayments && (<>
            <button className="pay-btn" onClick={openPaymentModal}>
              Плати
            </button>
            <button
              className="add-btn member-action-btn pause-btn"
              onClick={() => {
                setPauseError(null);
                setSelectedPauseMonths([]);
                setPauseReason("");
                setCalendarYear(new Date().getFullYear());
                setPauseModalOpen(true);
              }}
            >
              Пауза
            </button>
          </>)}

          <button className="add-btn member-action-btn training-schedule-btn" onClick={() => void openTrainingModal()}>
            Тренировъчен график
          </button>

          {canPublicEdit && (trainingLoading ? (
            <p className="training-next-hint">Зареждане на следваща тренировка...</p>
          ) : nextTrainingDate && nextTrainingCountdown ? (
            <div className="training-next-card">
              <p className="training-next-title">
                Следваща тренировка: {formatIsoDateForBgDisplay(nextTrainingDate)}
                {nextTrainingTime ? ` ${nextTrainingTime}` : ""}
              </p>
              <p className="training-next-countdown">
                {`${String(nextTrainingCountdown.days).padStart(2, "0")}:${String(nextTrainingCountdown.hours).padStart(2, "0")}:${String(nextTrainingCountdown.minutes).padStart(2, "0")}:${String(nextTrainingCountdown.seconds).padStart(2, "0")}`}
              </p>
            </div>
          ) : (
            <p className="training-next-hint">Няма предстояща тренировка.</p>
          ))}

          {canPublicEdit && (
            <button
              className="add-btn member-edit-btn"
              onClick={() => {
                setEditError("");
                setEditImageFile(null);
                setEditModalOpen(true);
              }}
            >
              Редактирай профил
            </button>
          )}

          {canUseNotifications && isPushEnabled && (
            <div className="push-enabled-banner">
              <span className="push-enabled-check" aria-hidden="true">✓</span>
              <span className="push-enabled-text">Известията са активирани</span>
            </div>
          )}

          {canUseNotifications && (!isIPhoneDevice || isStandaloneMode) && (
            isPushEnabled ? (
              <button className="bell-btn bell-btn--disable" onClick={handleDisablePushNotifications} disabled={isEnablingPush}>
                {isEnablingPush ? <SpinnerIcon size={16} /> : <BellOffIcon size={16} />}
                {isEnablingPush ? "Изключване..." : "Изключване на известия"}
              </button>
            ) : (
              <button className="bell-btn" onClick={handleEnablePushNotifications} disabled={isEnablingPush}>
                {isEnablingPush ? <SpinnerIcon size={16} /> : <BellIcon size={16} />}
                {isEnablingPush ? "Активиране..." : "Активиране на известия"}
              </button>
            )
          )}

          {canUseNotifications && isIPhoneDevice && !isStandaloneMode && (
            <>
              <button className="add-btn add-btn--white-text" onClick={() => setInstructionsOpen((v) => !v)}>
                <ShareIcon size={16} />
                Добавете към начален екран
              </button>

              <p className="hint-text">
                За да активирате известията на iPhone, натиснете бутона Share и изберете &ldquo;Добавяне към начален екран&rdquo;.
              </p>

              {instructionsOpen && (
                <div className="instr-box">
                  <button className="instr-close" onClick={() => setInstructionsOpen(false)} aria-label="Затвори">
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
        </div>

        {canUseNotifications && !isPushEnabled && (
          <p className="push-hint">Получавайте push известия дори когато браузърът е затворен.</p>
        )}

        {canUseNotifications && pushStatusMessage && (
          <p className="push-hint" style={{ color: pushStatusTone === "danger" ? "#ff8f8f" : "#32cd32", marginTop: "6px" }}>
            {pushStatusMessage}
          </p>
        )}
        {canUseNotifications && pushErrorMessage && (
          <p className="push-hint" style={{ color: "#ff6b6b", marginTop: "6px" }}>
            {pushErrorMessage}
          </p>
        )}

        {/* Payment history accordion */}
        <div className="accordion" style={{ marginTop: "14px" }}>
          <button className="accordion-btn" onClick={() => setAccordionOpen((v) => !v)}>
            <span>История на плащания<span className="acc-count"> ({member.paymentLogs?.length ?? 0})</span></span>
            <svg className={`chevron${accordionOpen ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div className={`acc-body${accordionOpen ? " acc-body--open" : ""}`}>
            <div className="acc-inner">
              <div className="acc-scroll">
                <div className="payment-list">
                  {member.paymentLogs && member.paymentLogs.length > 0 ? (
                    member.paymentLogs.map((item) => (
                      <div className="payment-row" key={item.id}>
                        <div className="payment-info">
                          <p className="p-month">
                            {formatMonthYearInBgUtc(item.paidFor)}
                          </p>
                          <p className="p-date">{new Date(item.paidAt).toLocaleDateString("bg-BG")}</p>
                        </div>
                        <button className="receipt-btn" onClick={() => setSelectedReceipt(item)}>
                          <FileTextIcon size={12} />
                          Разписка
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="payment-row">
                      <div className="payment-info">
                        <p className="p-month">Няма налична история.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sport Depot discount modal ── */}
        {sportDepotModalOpen && (
          <div className="pm-overlay sd-overlay" onClick={() => setSportDepotModalOpen(false)}>
            <div className="sd-modal" onClick={(e) => e.stopPropagation()}>
              <button className="pm-close sd-modal-close" onClick={() => setSportDepotModalOpen(false)} aria-label="Затвори">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>

              {/* Header */}
              <div className="sd-modal-header">
                <img src="/sd-logo.png" alt="Absolute Teamsport" className="sd-modal-logo" />
                <div className="sd-modal-title-wrap">
                  <p className="sd-modal-eyebrow">Партньорска програма</p>
                  <h2 className="sd-modal-title">Вашата клубна отстъпка</h2>
                </div>
              </div>

              <div className="sd-modal-divider" />

              {/* Discount highlights */}
              <div className="sd-highlights">
                <div className="sd-highlight">
                  <span className="sd-highlight-value">-10%</span>
                  <span className="sd-highlight-label">на редовна цена</span>
                </div>
                <div className="sd-highlight sd-highlight--red">
                  <span className="sd-highlight-value">-5%</span>
                  <span className="sd-highlight-label">на намалени (онлайн)</span>
                </div>
              </div>

              {/* Code + validity — tap to copy */}
              <button
                className={`sd-code-row${codeCopied ? " sd-code-row--copied" : ""}`}
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText("ATS_MYTEAM").then(() => {
                    setCodeCopied(true);
                    trackDiscount("SPORT_DEPOT", "copy");
                    setTimeout(() => setCodeCopied(false), 2000);
                  });
                }}
                aria-label="Копирай код ATS_MYTEAM"
              >
                <span className="sd-code-lbl">{codeCopied ? "Копирано!" : "Код:"}</span>
                <span className="sd-code">{codeCopied ? "✓" : "ATS_MYTEAM"}</span>
                {!codeCopied && (
                  <svg className="sd-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
              <p className="sd-validity">Валиден: 02.04.2026 – 01.10.2026</p>

              <div className="sd-qr-wrap">
                <p className="sd-qr-hint">Покажи кода за отстъпка на касата или въведи при поръчка онлайн на{" "}<a href="https://www.absolute-teamsport.bg" target="_blank" rel="noopener noreferrer" className="sd-store-link" onClick={() => trackDiscount("SPORT_DEPOT", "link_click")}>absolute-teamsport.bg</a></p>
              </div>

              <div className="sd-modal-divider" />

              {/* Terms */}
              <div className="sd-terms">
                <p className="sd-terms-title">Условия</p>
                <ul className="sd-terms-list">
                  <li>Важи в магазини <strong>ABSOLUTE TEAMSPORT</strong> и онлайн</li>
                  <li>Не може да се комбинира с промоции или ваучери</li>
                  <li>Не важи за артикули на ПФК „Левски", външни артикули с удължен срок и ваучери за подарък</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Innline Dragon Body discount modal ── */}
        {idbModalOpen && (
          <div className="pm-overlay sd-overlay" onClick={() => setIdbModalOpen(false)}>
            <div className="idb-modal" onClick={(e) => e.stopPropagation()}>
              <button className="pm-close sd-modal-close" onClick={() => setIdbModalOpen(false)} aria-label="Затвори">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>

              <div className="sd-modal-header">
                <img src="/idb-logo.svg" alt="Innline Dragon Body" className="sd-modal-logo" />
                <div className="sd-modal-title-wrap">
                  <p className="sd-modal-eyebrow" style={{ color: "#eab126" }}>Партньорска програма</p>
                  <h2 className="sd-modal-title">Innline Dragon Body</h2>
                </div>
              </div>

              <div className="sd-modal-divider" style={{ background: "linear-gradient(to right, transparent, rgba(234, 177, 38, 0.3), transparent)" }} />

              <div className="sd-highlights">
                <div className="idb-highlight">
                  <span className="idb-highlight-value">-10%</span>
                  <span className="sd-highlight-label">на всички процедури</span>
                </div>
              </div>

              <button
                className={`sd-code-row${idbCodeCopied ? " sd-code-row--copied" : ""}`}
                style={idbCodeCopied ? { borderColor: "#eab126", background: "rgba(234, 177, 38, 0.12)" } : {}}
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText("IDB_MYTEAM").then(() => {
                    setIdbCodeCopied(true);
                    trackDiscount("IDB", "copy");
                    setTimeout(() => setIdbCodeCopied(false), 2000);
                  });
                }}
              >
                <span className="sd-code-lbl" style={idbCodeCopied ? { color: "#eab126" } : {}}>{idbCodeCopied ? "Копирано!" : "Код:"}</span>
                <span className="idb-code">{idbCodeCopied ? "✓" : "IDB_MYTEAM"}</span>
                {!idbCodeCopied && (
                  <svg className="sd-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
              <p className="sd-validity">Валиден: 2026</p>

              <div className="sd-qr-wrap">
                <p className="sd-qr-hint">Посетете ги онлайн на{" "}<a href="https://innlinedragonbody.com" target="_blank" rel="noopener noreferrer" className="sd-store-link" style={{ color: "#eab126" }} onClick={() => trackDiscount("IDB", "link_click")}>innlinedragonbody.com</a></p>
              </div>
            </div>
          </div>
        )}

        {/* ── Mebeli Niko discount modal ── */}
        {nikoModalOpen && (
          <div className="pm-overlay sd-overlay" onClick={() => setNikoModalOpen(false)}>
            <div className="niko-modal" onClick={(e) => e.stopPropagation()}>
              <button className="pm-close sd-modal-close" onClick={() => setNikoModalOpen(false)} aria-label="Затвори">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>

              <div className="sd-modal-header">
                <img src="/niko-logo.png" alt="Mebeli Niko" className="sd-modal-logo" />
                <div className="sd-modal-title-wrap">
                  <p className="sd-modal-eyebrow" style={{ color: "#0054a6" }}>Партньорска програма</p>
                  <h2 className="sd-modal-title">Мебели NIKO</h2>
                </div>
              </div>

              <div className="sd-modal-divider" style={{ background: "linear-gradient(to right, transparent, rgba(0, 84, 166, 0.3), transparent)" }} />

              <div className="sd-highlights">
                <div className="niko-highlight">
                  <span className="niko-highlight-value">-10%</span>
                  <span className="sd-highlight-label">на редовна цена</span>
                </div>
              </div>

              <button
                className={`sd-code-row${nikoCodeCopied ? " sd-code-row--copied" : ""}`}
                style={nikoCodeCopied ? { borderColor: "#0054a6", background: "rgba(0, 84, 166, 0.12)" } : {}}
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText("NIKO_MYTEAM").then(() => {
                    setNikoCodeCopied(true);
                    trackDiscount("NIKO", "copy");
                    setTimeout(() => setNikoCodeCopied(false), 2000);
                  });
                }}
              >
                <span className="sd-code-lbl" style={nikoCodeCopied ? { color: "#0054a6" } : {}}>{nikoCodeCopied ? "Копирано!" : "Код:"}</span>
                <span className="niko-code">{nikoCodeCopied ? "✓" : "NIKO_MYTEAM"}</span>
                {!nikoCodeCopied && (
                  <svg className="sd-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
              <p className="sd-validity">Валиден: 2026</p>

              <div className="sd-qr-wrap">
                <p className="sd-qr-hint">Разгледайте каталога им на{" "}<a href="https://mebeliniko.bg" target="_blank" rel="noopener noreferrer" className="niko-store-link" onClick={() => trackDiscount("NIKO", "link_click")}>mebeliniko.bg</a></p>
              </div>
            </div>
          </div>
        )}

        {/* ── Dalida Dance discount modal ── */}
        {dalidaModalOpen && (
          <div className="pm-overlay sd-overlay" onClick={() => setDalidaModalOpen(false)}>
            <div className="dalida-modal" onClick={(e) => e.stopPropagation()}>
              <button className="pm-close sd-modal-close" onClick={() => setDalidaModalOpen(false)} aria-label="Затвори">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>

              <div className="sd-modal-header" style={{ marginBottom: "16px" }}>
                <img src="/logo-dalida.png" alt="Dalida Dance" className="sd-modal-logo" style={{ transform: "scale(1.2)" }} />
                <div className="sd-modal-title-wrap">
                  <p className="sd-modal-eyebrow" style={{ color: "rgb(201, 168, 76)" }}>Партньорска програма</p>
                  <h2 className="sd-modal-title">Dalida Dance</h2>
                </div>
              </div>

              <div className="sd-modal-divider" style={{ background: "linear-gradient(to right, transparent, rgb(201, 168, 76), transparent)", opacity: 0.3 }} />

              <div className="sd-highlights">
                <div className="dalida-highlight">
                  <span className="dalida-highlight-value">-10%</span>
                  <span className="sd-highlight-label">на шоу програми</span>
                </div>
              </div>

              <button
                className={`sd-code-row${dalidaCodeCopied ? " sd-code-row--copied" : ""}`}
                style={dalidaCodeCopied ? { borderColor: "rgb(201, 168, 76)", background: "rgba(212, 175, 55, 0.12)" } : {}}
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText("DALIDA_MYTEAM").then(() => {
                    setDalidaCodeCopied(true);
                    trackDiscount("DALIDA", "copy");
                    setTimeout(() => setDalidaCodeCopied(false), 2000);
                  });
                }}
              >
                <span className="sd-code-lbl" style={dalidaCodeCopied ? { color: "rgb(201, 168, 76)" } : {}}>{dalidaCodeCopied ? "Копирано!" : "Код:"}</span>
                <span className="dalida-code">{dalidaCodeCopied ? "✓" : "DALIDA_MYTEAM"}</span>
                {!dalidaCodeCopied && (
                  <svg className="sd-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
              <p className="sd-validity">Валиден: 2026</p>

              <div className="sd-qr-wrap">
                <p className="sd-qr-hint">Посетете ги онлайн на{" "}<a href="https://dalidadance.com" target="_blank" rel="noopener noreferrer" className="sd-store-link" style={{ color: "rgb(201, 168, 76)" }} onClick={() => trackDiscount("DALIDA", "link_click")}>dalidadance.com</a></p>
              </div>

              <div className="sd-modal-divider" style={{ background: "linear-gradient(to right, transparent, rgb(201, 168, 76), transparent)", opacity: 0.3 }} />

              <div className="sd-terms">
                <p className="sd-terms-title">Условия</p>
                <ul className="sd-terms-list">
                  <li>Отстъпката важи за всички <strong>шоу програми</strong></li>
                  <li>Необходима е предварителна резервация</li>
                  <li>Важи при представяне на промоционалния код</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── All Discounts modal ── */}
        {allDiscountsModalOpen && (
          <div className="pm-overlay sd-overlay" onClick={() => setAllDiscountsModalOpen(false)}>
            <div className="sd-modal" onClick={(e) => e.stopPropagation()} style={{ padding: "24px 20px" }}>
              <button className="pm-close sd-modal-close" onClick={() => setAllDiscountsModalOpen(false)} aria-label="Затвори">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>

              <div className="sd-modal-header" style={{ marginBottom: "16px" }}>
                <div className="sd-modal-title-wrap">
                  <p className="sd-modal-eyebrow" style={{ color: "rgb(201, 168, 76)" }}>Партньорска програма</p>
                  <h2 className="sd-modal-title">Всички оферти</h2>
                </div>
              </div>

              <div className="sd-modal-divider" style={{ background: "linear-gradient(to right, transparent, rgba(201, 168, 76, 0.5), transparent)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", maxHeight: "60vh", paddingRight: "4px" }}>
                {/* Sport Depot */}
                <button
                  className="sd-discount-btn"
                  style={{ marginTop: 0 }}
                  onClick={() => { setAllDiscountsModalOpen(false); setSportDepotModalOpen(true); trackDiscount("SPORT_DEPOT", "view"); }}
                  type="button"
                  aria-label="Absolute Teamsport отстъпка"
                >
                  <div className="sd-discount-logo-wrap">
                    <img src="/sd-logo.png" alt="Sport Depot" className="sd-discount-logo" />
                  </div>
                  <span className="sd-discount-label">Sport Depot</span>
                  <span className="sd-discount-badge">-10%</span>
                </button>

                {/* Dalida Dance */}
                <button
                  className="dalida-discount-btn"
                  style={{ marginTop: 0 }}
                  onClick={() => { setAllDiscountsModalOpen(false); setDalidaModalOpen(true); trackDiscount("DALIDA", "view"); }}
                  type="button"
                  aria-label="Dalida Dance отстъпка"
                >
                  <div className="sd-discount-logo-wrap">
                    <img src="/logo-dalida.png" alt="Dalida Dance" className="sd-discount-logo dalida-logo-fix" />
                  </div>
                  <span className="sd-discount-label">Dalida Dance</span>
                  <span className="sd-discount-badge dalida-discount-badge">-10%</span>
                </button>

                {/* Innline Dragon Body */}
                <button
                  className="idb-discount-btn"
                  style={{ marginTop: 0 }}
                  onClick={() => { setAllDiscountsModalOpen(false); setIdbModalOpen(true); trackDiscount("IDB", "view"); }}
                  type="button"
                  aria-label="Innline Dragon Body отстъпка"
                >
                  <div className="sd-discount-logo-wrap">
                    <img src="/idb-logo.svg" alt="Innline Dragon Body" className="sd-discount-logo idb-logo-fix" />
                  </div>
                  <span className="sd-discount-label">Innline Dragon Body</span>
                  <span className="sd-discount-badge">-10%</span>
                </button>

                {/* Mebeli Niko */}
                <button
                  className="niko-discount-btn"
                  style={{ marginTop: 0 }}
                  onClick={() => { setAllDiscountsModalOpen(false); setNikoModalOpen(true); trackDiscount("NIKO", "view"); }}
                  type="button"
                  aria-label="Mebeli Niko отстъпка"
                >
                  <div className="sd-discount-logo-wrap">
                    <img src="/niko-logo.png" alt="Mebeli Niko" className="sd-discount-logo niko-logo-fix" />
                  </div>
                  <span className="sd-discount-label">Мебели Нико</span>
                  <span className="sd-discount-badge">-10%</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {trainingModalOpen && (
          <div className="pm-overlay" onClick={closeTrainingModal}>
            <div className="pm-modal member-training-modal" onClick={(e) => e.stopPropagation()}>
              <div className="member-training-modal-tint" aria-hidden="true" />
              <button className="pm-close" onClick={closeTrainingModal}>
                <XIcon size={16} />
              </button>

              <div className="pm-header">
                <span className="member-training-modal-title-gradient">Тренировки</span>
                <div>
                  <h2 className="pm-title">Текущ график</h2>
                </div>
              </div>

              <div className="pm-divider" />

              <div className="training-section" style={{ margin: 0 }}>
                {trainingLoading ? (
                  <p className="training-empty">Зареждане...</p>
                ) : trainingDays.length === 0 ? (
                  <p className="training-empty">Няма настроени тренировъчни дни.</p>
                ) : (
                  <>
                    <div className="training-layout">
                      <div className="training-calendar">
                        {trainingMonths.map((month) => (
                          <section key={month.key} className="training-calendar-month">
                            <h4 className="training-calendar-month-title">{month.label}</h4>
                            <div className="training-calendar-weekdays">
                              {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                                <span key={`${month.key}-${weekday}`} className="training-calendar-weekday">
                                  {weekday}
                                </span>
                              ))}
                            </div>
                            <div className="training-calendar-grid">
                              {month.cells.map((cellDate, index) => {
                                if (!cellDate) {
                                  return <span key={`${month.key}-empty-${index}`} className="training-calendar-cell training-calendar-cell--empty" aria-hidden="true" />;
                                }

                                const trainingItem = trainingByDate.get(cellDate);
                                const dayNumber = cellDate.slice(8, 10);
                                const isToday = cellDate === todayDateKey;
                                if (!trainingItem) {
                                  return (
                                    <span
                                      key={cellDate}
                                      className={`training-calendar-cell training-calendar-cell--off${isToday ? " training-calendar-cell--today" : ""}`}
                                    >
                                      <span className="training-calendar-day-number">{dayNumber}</span>
                                    </span>
                                  );
                                }

                                const isOptedOut = trainingItem.optedOut;
                                const trainingTimeLabel = trainingItem.trainingTime?.trim() ?? "";
                                const dateLabel = new Date(`${trainingItem.date}T12:00:00.000Z`).toLocaleDateString("bg-BG", {
                                  day: "2-digit",
                                  month: "2-digit",
                                });
                                return (
                                  <button
                                    key={cellDate}
                                    className={`training-calendar-cell training-calendar-cell--training${isOptedOut ? " training-calendar-cell--opted-out" : ""}${isToday ? " training-calendar-cell--today" : ""}`}
                                    onClick={() => {
                                      setTrainingDetailsDate(trainingItem.date);
                                      setTrainingAttendancePopupOpen(true);
                                    }}
                                    disabled={Boolean(trainingSavingDate)}
                                    type="button"
                                    aria-label={`${TRAINING_WEEKDAY_LABELS_BG[trainingItem.weekday] ?? "-"} ${dateLabel}${trainingTimeLabel ? ` ${trainingTimeLabel}` : ""}`}
                                    aria-pressed={!isOptedOut}
                                  >
                                    <span className="training-calendar-day-number">{dayNumber}</span>
                                    {trainingTimeLabel && (
                                      <span className="training-calendar-time">{trainingTimeLabel}</span>
                                    )}
                                    <span className="training-calendar-mark">{isOptedOut ? "x" : "✓"}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {trainingError && <p className="training-error">{trainingError}</p>}
                {trainingAttendancePopupOpen && trainingDetailsItem && (
                  <div
                    className="pm-overlay"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrainingAttendancePopupOpen(false);
                    }}
                  >
                    <div className="pm-modal member-training-attendance-popup" onClick={(e) => e.stopPropagation()}>
                      <button className="pm-close" onClick={() => setTrainingAttendancePopupOpen(false)}>
                        <XIcon size={16} />
                      </button>
                      <div className="pm-header">
                        <h2 className="pm-title">Присъствие</h2>
                      </div>
                      <div className="pm-divider" />
                      <p className="training-note-date">
                        {new Date(`${trainingDetailsItem.date}T12:00:00.000Z`).toLocaleDateString("bg-BG", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                      {trainingDetailsItem.trainingTime?.trim() && (
                        <p className="training-note-date training-note-time" style={{ marginTop: "6px", opacity: 0.9 }}>
                          {`Час: ${trainingDetailsItem.trainingTime}`}
                        </p>
                      )}
                      {trainingDetailsItem.note?.trim() && (
                        <div className="training-note-display" style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <p style={{ margin: "0 0 6px 0", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Описание</p>
                          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.4, color: "rgba(255,255,255,0.9)" }}>{trainingDetailsItem.note}</p>
                        </div>
                      )}
                      <div className="training-attendance-buttons">
                        <button
                          className="pm-btn training-attend-btn"
                          type="button"
                          onClick={() => {
                            if (!trainingDetailsItem.optedOut) return;
                            setTrainingOptOutReasonCode("");
                            setTrainingOptOutReasonText("");
                            setTrainingConfirmAction("attend");
                            setTrainingConfirmModalOpen(true);
                          }}
                          disabled={!trainingDetailsItem.optedOut || trainingSavingDate === trainingDetailsItem.date}
                        >
                          {trainingSavingDate === trainingDetailsItem.date ? "Запазване..." : "Присъствам"}
                        </button>
                        <button
                          className="pm-btn training-optout-btn"
                          type="button"
                          onClick={() => {
                            if (trainingDetailsItem.optedOut) return;
                            setTrainingOptOutReasonCode("");
                            setTrainingOptOutReasonText("");
                            setTrainingConfirmAction("optOut");
                            setTrainingConfirmModalOpen(true);
                          }}
                          disabled={trainingDetailsItem.optedOut || trainingSavingDate === trainingDetailsItem.date}
                        >
                          {trainingSavingDate === trainingDetailsItem.date ? "Запазване..." : "Отсъствам"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {false && (
                  <div className="training-notes">
                    <p className="training-notes-title">Описание</p>
                    <div className="training-notes-list">
                      {trainingDaysWithNotes.map((item) => (
                        <div key={`note-${item.date}`} className="training-note-row">
                          <span className="training-note-date">
                            {new Date(`${item.date}T12:00:00.000Z`).toLocaleDateString("bg-BG", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </span>
                          <span className="training-note-text">{item.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {trainingConfirmModalOpen && trainingConfirmAction && trainingDetailsItem && (
          <div
            className="pm-overlay"
            onClick={(e) => {
              e.stopPropagation();
              setTrainingConfirmModalOpen(false);
              setTrainingConfirmAction(null);
              setTrainingOptOutReasonCode("");
              setTrainingOptOutReasonText("");
            }}
          >
            <div className="pm-modal member-training-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pm-header">
                <h2 className="pm-title">Потвърждение</h2>
              </div>
              <div className="pm-divider" />
              <p className="training-confirm-text">
                {trainingConfirmAction === "attend"
                  ? `Сигурни ли сте, че искате да потвърдите присъствие за ${new Date(`${trainingDetailsItem.date}T12:00:00.000Z`).toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" })}?`
                  : `Сигурни ли сте, че искате да откажете присъствие за ${new Date(`${trainingDetailsItem.date}T12:00:00.000Z`).toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" })}?`}
              </p>
              {trainingConfirmAction === "optOut" && (
                <div className="training-confirm-reason-fields">
                  <label className="training-confirm-reason-label">
                    <span className="pm-info-lbl">Причина (задължително)</span>
                    <select
                      className="training-confirm-reason-control"
                      value={trainingOptOutReasonCode}
                      onChange={(event) => {
                        const nextReason = event.target.value as TrainingOptOutReasonCode | "";
                        setTrainingOptOutReasonCode(nextReason);
                        if (nextReason !== "other") {
                          setTrainingOptOutReasonText("");
                        }
                      }}
                    >
                      <option value="">Избери причина</option>
                      <option value="injury">Контузия</option>
                      <option value="sick">Болен</option>
                      <option value="other">Друго</option>
                    </select>
                  </label>
                  {trainingOptOutReasonCode === "other" && (
                    <label className="training-confirm-reason-label">
                      <span className="pm-info-lbl">Опиши причината (задължително)</span>
                      <textarea
                        className="training-confirm-reason-control training-confirm-reason-textarea"
                        value={trainingOptOutReasonText}
                        onChange={(event) => setTrainingOptOutReasonText(event.target.value)}
                        maxLength={200}
                        rows={3}
                        placeholder="Въведи причина..."
                      />
                    </label>
                  )}
                </div>
              )}
              <div className="pm-actions training-confirm-actions">
                <button
                  className="pm-btn pm-btn--cancel"
                  type="button"
                  onClick={() => {
                    setTrainingConfirmModalOpen(false);
                    setTrainingConfirmAction(null);
                    setTrainingOptOutReasonCode("");
                    setTrainingOptOutReasonText("");
                  }}
                  disabled={trainingSavingDate === trainingDetailsItem.date}
                >
                  Отказ
                </button>
                <button
                  className="pm-btn pm-btn--submit"
                  type="button"
                  onClick={async () => {
                    if (!trainingConfirmAction || !trainingDetailsItem) return;
                    if (trainingConfirmAction === "optOut") {
                      if (!trainingOptOutReasonCode) {
                        setTrainingError("Избери причина за отсъствие.");
                        return;
                      }
                      if (trainingOptOutReasonCode === "other" && trainingOptOutReasonText.trim().length === 0) {
                        setTrainingError("Въведи причина в полето Друго.");
                        return;
                      }
                    }
                    setTrainingConfirmModalOpen(false);
                    await handleTrainingAttendanceConfirm(
                      trainingConfirmAction,
                      trainingDetailsItem,
                      trainingConfirmAction === "optOut" && trainingOptOutReasonCode
                        ? {
                          reasonCode: trainingOptOutReasonCode,
                          reasonText:
                            trainingOptOutReasonCode === "other"
                              ? trainingOptOutReasonText.trim()
                              : null,
                        }
                        : undefined,
                    );
                    setTrainingConfirmAction(null);
                    setTrainingOptOutReasonCode("");
                    setTrainingOptOutReasonText("");
                  }}
                  disabled={trainingSavingDate === trainingDetailsItem.date || !isOptOutReasonReady}
                >
                  {trainingSavingDate === trainingDetailsItem.date ? "Запазване..." : "Потвърди"}
                </button>
              </div>
            </div>
          </div>
        )}

        {editModalOpen && (
          <div className="pm-overlay" onClick={() => !editSaving && setEditModalOpen(false)}>
            <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
              <button className="pm-close" onClick={() => !editSaving && setEditModalOpen(false)}>
                <XIcon size={16} />
              </button>

              <div className="pm-header">
                <div className="pm-title-icon">✎</div>
                <div>
                  <h2 className="pm-title">Редактиране на профил</h2>
                </div>
              </div>

              <div className="pm-divider" />

              <div style={{ display: "grid", gap: "10px" }}>
                <label style={{ display: "grid", gap: "6px" }}>
                  <span className="pm-info-lbl">Име и фамилия</span>
                  <input
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      color: "#fff",
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: "6px" }}>
                  <span className="pm-info-lbl">Дата на раждане</span>
                  <input
                    type="date"
                    value={editForm.birthDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      color: "#fff",
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: "6px" }}>
                  <span className="pm-info-lbl">Набор</span>
                  <input
                    inputMode="numeric"
                    value={editForm.teamGroup}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, teamGroup: e.target.value.replace(/\D/g, "") }))
                    }
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      color: "#fff",
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: "6px" }}>
                  <span className="pm-info-lbl">Номер в отбора</span>
                  <input
                    value={editForm.jerseyNumber}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, jerseyNumber: e.target.value }))}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      color: "#fff",
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: "6px" }}>
                  <span className="pm-info-lbl">Нова снимка</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditImageFile(e.target.files?.[0] ?? null)}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      color: "#fff",
                    }}
                  />
                </label>
              </div>

              {editImagePreviewUrl && (
                <img
                  src={editImagePreviewUrl}
                  alt="Image preview"
                  style={{
                    width: "min(160px, 100%)",
                    aspectRatio: "4 / 5",
                    objectFit: "cover",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.22)",
                    marginTop: "6px",
                    marginInline: "auto",
                  }}
                />
              )}

              {editError && (
                <div className="pm-error" style={{ marginTop: "10px" }}>{editError}</div>
              )}

              <div className="pm-divider" />

              <div className="pm-actions">
                <button
                  className="pm-btn pm-btn--cancel"
                  onClick={() => setEditModalOpen(false)}
                  disabled={editSaving}
                >
                  Отказ
                </button>
                <button
                  className="pm-btn pm-btn--submit"
                  onClick={handleSavePublicEdit}
                  disabled={editSaving}
                >
                  {editSaving ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ PAYMENT MODAL ══ */}
        {paymentModalOpen && (
          <div className="pm-overlay" onClick={() => setPaymentModalOpen(false)}>
            <div className="pm-modal" onClick={(e) => e.stopPropagation()}>

              <button className="pm-close" onClick={() => setPaymentModalOpen(false)}>
                <XIcon size={16} />
              </button>

              <div className="pm-header">
                <div className="pm-title-icon">⚽</div>
                <div>
                  <h2 className="pm-title">Плащане</h2>
                  <p className="pm-name">{member.name}</p>
                </div>
              </div>

              <div className="pm-divider" />

              <div className="pm-info-row">
                <span className="pm-info-lbl">Следващ дължим месец:</span>
                <span className="pm-info-val">
                  {MONTH_NAMES_BG_FULL[firstUnpaidYM.month]} {firstUnpaidYM.year}
                </span>
              </div>

              {/* Year nav */}
              <div className="pm-year-nav">
                <button className="pm-year-btn" onClick={() => setCalendarYear((y) => y - 1)}>
                  <ChevronIcon direction="left" />
                </button>
                <span className="pm-year-label">{calendarYear}</span>
                <button className="pm-year-btn" onClick={() => setCalendarYear((y) => y + 1)}>
                  <ChevronIcon direction="right" />
                </button>
              </div>

              {/* Month grid */}
              <div className="pm-months-grid">
                {MONTH_NAMES_BG.map((name, i) => {
                  const ym = { year: calendarYear, month: i };
                  const state = getMonthState(ym);
                  const inAdvanceRange =
                    !!selectedYM &&
                    cmpYM(ym, firstUnpaidYM) >= 0 &&
                    cmpYM(ym, selectedYM) <= 0 &&
                    state !== "paid" &&
                    state !== "waived" &&
                    state !== "selected";
                  return (
                    <button
                      key={i}
                      className={`pm-month-btn pm-month-btn--${state}${inAdvanceRange ? " pm-month-btn--range" : ""}`}
                      onClick={() => {
                        const state = getMonthState(ym);
                        if (state === "paid" || state === "waived" || state === "disabled") return;
                        setSelectedYM(ym);
                      }}
                      disabled={state === "paid" || state === "waived" || state === "disabled"}
                      title={
                        state === "disabled"
                          ? "Платете първо предишните месеци"
                          : state === "paid"
                            ? "Вече платено"
                            : state === "waived"
                              ? "Освободен месец (пауза)"
                              : undefined
                      }
                    >
                      {name}
                      {state === "paid" && <span className="pm-paid-dot" />}
                      {state === "waived" && <span className="pm-waived-dot" />}
                    </button>
                  );
                })}
              </div>

              {/* Selected summary */}
              {selectedYM && (
                <div className="pm-selected-summary">
                  <span className="pm-selected-lbl">Избрано:</span>
                  <span className="pm-selected-val">
                    {cmpYM(selectedYM, firstUnpaidYM) > 0
                      ? `${MONTH_NAMES_BG_FULL[firstUnpaidYM.month]} ${firstUnpaidYM.year} - ${MONTH_NAMES_BG_FULL[selectedYM.month]} ${selectedYM.year}`
                      : `${MONTH_NAMES_BG_FULL[selectedYM.month]} ${selectedYM.year}`}
                  </span>
                </div>
              )}

              {paymentError && (
                <div className="pm-error">{paymentError}</div>
              )}

              <div className="pm-divider" />

              <div className="pm-actions">
                <button className="pm-btn pm-btn--cancel" onClick={() => setPaymentModalOpen(false)}>
                  Отказ
                </button>
                <button
                  className="pm-btn pm-btn--submit"
                  onClick={handlePayment}
                  disabled={!selectedYM || paymentLoading}
                >
                  {paymentLoading ? "Обработка..." : "Потвърди плащане"}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ══ NOTIFICATIONS PANEL ══ */}
        {pauseModalOpen && (
          <div className="pm-overlay" onClick={() => !pauseActionLoading && setPauseModalOpen(false)}>
            <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
              <button className="pm-close" onClick={() => !pauseActionLoading && setPauseModalOpen(false)}>
                <XIcon size={16} />
              </button>

              <div className="pm-header">
                <div className="pm-title-icon">II</div>
                <div>
                  <h2 className="pm-title">Пауза</h2>
                  <p className="pm-name">{member.name}</p>
                </div>
              </div>

              <div className="pm-divider" />

              <div className="pm-year-nav">
                <button className="pm-year-btn" onClick={() => setCalendarYear((y) => y - 1)}>
                  <ChevronIcon direction="left" />
                </button>
                <span className="pm-year-label">{calendarYear}</span>
                <button className="pm-year-btn" onClick={() => setCalendarYear((y) => y + 1)}>
                  <ChevronIcon direction="right" />
                </button>
              </div>

              <div className="pm-months-grid">
                {MONTH_NAMES_BG.map((name, i) => {
                  const ym = { year: calendarYear, month: i };
                  const key = `${ym.year}-${ym.month}`;
                  const isPaid = paidSet.has(key);
                  const isWaived = waivedSet.has(key);
                  const isSelected = selectedPauseKeys.has(key);

                  return (
                    <button
                      key={i}
                      className={`pm-month-btn ${isSelected ? "pm-month-btn--selected" : isWaived ? "pm-month-btn--waived" : "pm-month-btn--available"}`}
                      disabled={isPaid}
                      title={isPaid ? "Вече платен месец не може да бъде освободен." : isWaived ? "Месецът е вече в пауза." : undefined}
                      onClick={() => togglePauseMonth(ym)}
                    >
                      {name}
                      {isPaid && <span className="pm-paid-dot" />}
                      {isWaived && <span className="pm-waived-dot" />}
                    </button>
                  );
                })}
              </div>

              <label style={{ display: "grid", gap: 6, marginTop: 8 }}>
                <span className="pm-info-lbl">Причина (по избор)</span>
                <input
                  value={pauseReason}
                  onChange={(event) => setPauseReason(event.target.value)}
                  placeholder="напр. контузия, пътуване, изпити"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    color: "#fff",
                  }}
                />
              </label>

              {pauseError && <div className="pm-error">{pauseError}</div>}

              <div className="pm-divider" />

              <div className="pm-actions">
                <button
                  className="pm-btn pm-btn--cancel"
                  onClick={() => setPauseModalOpen(false)}
                  disabled={pauseActionLoading}
                >
                  Отказ
                </button>
                <button
                  className="pm-btn pm-btn--ghost"
                  onClick={() => void handleManagePauseMonths("remove")}
                  disabled={pauseActionLoading || !canRemovePause}
                >
                  {pauseActionLoading ? "Запазване..." : "Премахни пауза"}
                </button>
                <button
                  className="pm-btn pm-btn--submit"
                  onClick={() => void handleManagePauseMonths("pause")}
                  disabled={pauseActionLoading || !canApplyPause}
                >
                  {pauseActionLoading ? "Запазване..." : "Приложи пауза"}
                </button>
              </div>
            </div>
          </div>
        )}

        {canUseNotifications && notificationsPanelOpen && (
          <div className="pm-overlay" onClick={() => setNotificationsPanelOpen(false)}>
            <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
              <button className="pm-close" onClick={() => setNotificationsPanelOpen(false)}>
                <XIcon size={16} />
              </button>

              <div className="pm-header">
                <div className="pm-title-icon">🔔</div>
                <div>
                  <h2 className="pm-title">Известия</h2>
                </div>
              </div>

              <div className="pm-divider" />

              <div className="member-notifications-scroll">
                {loadingNotifications ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.6)" }}>
                    <SpinnerIcon size={24} />
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.6)" }}>
                    Няма известия
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        style={{
                          background: notif.readAt ? "rgba(255,255,255,0.05)" : "rgba(50,205,50,0.1)",
                          border: notif.readAt ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(50,205,50,0.3)",
                          borderRadius: "8px",
                          padding: "12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "4px" }}>
                          <h3 style={{
                            margin: 0,
                            fontSize: "14px",
                            fontWeight: "700",
                            color: notif.readAt ? "rgba(255,255,255,0.9)" : "#32cd32",
                          }}>
                            {notif.title}
                          </h3>
                          {!notif.readAt && (
                            <span style={{
                              background: "#ff3b3b",
                              borderRadius: "999px",
                              width: "8px",
                              height: "8px",
                              display: "block",
                              flexShrink: 0,
                              marginTop: "4px",
                            }} />
                          )}
                        </div>
                        <p style={{
                          margin: "4px 0 8px",
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.7)",
                          lineHeight: "1.4",
                        }}>
                          {notif.body}
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: "11px",
                          color: "rgba(255,255,255,0.5)",
                        }}>
                          {new Date(notif.sentAt).toLocaleDateString("bg-BG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedReceipt && (
          <div className="receipt-overlay" onClick={() => setSelectedReceipt(null)}>
            <div className="receipt-dialog" onClick={(e) => e.stopPropagation()}>
              <button className="receipt-close" onClick={() => setSelectedReceipt(null)} aria-label="Затвори">
                <XIcon size={14} />
              </button>

              <div id="receipt-print-area" className="receipt-card">
                <div className="receipt-head">
                  <h2 className="receipt-title">{member.clubName || "Клуб"}</h2>
                  <p className="receipt-sub">Разписка за членски внос</p>
                </div>

                <hr className="receipt-sep" />

                <div className="receipt-fields">
                  <div className="receipt-row">
                    <span className="receipt-lbl">Играч:</span>
                    <span className="receipt-val">{member.name}</span>
                  </div>
                  <div className="receipt-row">
                    <span className="receipt-lbl">Период:</span>
                    <span className="receipt-val">{formatReceiptPeriod(selectedReceipt.paidFor)}</span>
                  </div>
                  <div className="receipt-row">
                    <span className="receipt-lbl">Дата на плащане:</span>
                    <span className="receipt-val">{new Date(selectedReceipt.paidAt).toLocaleDateString("bg-BG")}</span>
                  </div>
                </div>

                <hr className="receipt-sep" />

                <div className="receipt-stamp-wrap">
                  <div className="receipt-stamp">ПЛАТЕНО</div>
                </div>

                <div className="receipt-actions">
                  <button className="receipt-action-btn" onClick={handlePrintReceipt}>
                    <PrinterIcon size={14} />
                    Принтирай / Запази
                  </button>
                  <button className="receipt-action-btn" onClick={() => setSelectedReceipt(null)}>
                    <XIcon size={14} />
                    Затвори
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

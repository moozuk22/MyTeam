"use client";

import MemberMatchDetailsModal, {
  type MemberMatchDetails as MemberMatch,
} from "@/components/MemberMatchDetailsModal";
import TrainingCheckInPicker from "@/components/TrainingCheckInPicker";
import { extractUploadPathFromCloudinaryUrl } from "@/lib/cloudinaryImagePath";
import { matchEventTypeLabel } from "@/lib/matchEventType";
import {
  getTrainingCountdownCandidates,
  getTrainingDateTimeMs,
} from "@/lib/memberScheduleCountdown";
import { buildMemberTrainingAttendanceRequest } from "@/lib/memberTrainingAttendance";
import { parsePlayerWeight, playerFieldEnabled } from "@/lib/playerFields";
import { getCompatiblePushSubscription } from "@/lib/push/browser";
import { uploadImage } from "@/lib/uploadImage";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useRef, useState, type CSSProperties } from "react";
import { MemberBirthdayDialog } from "./_components/MemberBirthdayDialog";
import { MemberDiscountDialog } from "./_components/MemberDiscountDialog";
import { MemberDiscountsDialog } from "./_components/MemberDiscountsDialog";
import {
  ArrowLeftIcon,
  BellIcon,
  BellOffIcon,
  FileTextIcon,
  LogoutIcon,
  PlusIcon,
  ShareIcon,
  SpinnerIcon,
  XIcon,
} from "./_components/MemberIcons";
import { MemberNotificationsDialog } from "./_components/MemberNotificationsDialog";
import { MemberPauseDialog } from "./_components/MemberPauseDialog";
import { MemberPaymentDialog } from "./_components/MemberPaymentDialog";
import { MemberProfileEditorDialog } from "./_components/MemberProfileEditorDialog";
import { MemberReceiptDialog } from "./_components/MemberReceiptDialog";
import { MemberRulesDialog } from "./_components/MemberRulesDialog";
import { MemberTrainingConfirmationDialog } from "./_components/MemberTrainingConfirmationDialog";
import { MemberTrainingDialog } from "./_components/MemberTrainingDialog";
import {
  type IrisOnlinePayment,
  type LimitedEventInfo,
  type MemberProfile,
  type MonthState,
  type TrainingDayStatus,
  type TrainingOptOutReasonCode,
  type TrainingSessionItem,
} from "./_types/member-types";
import {
  SPEED_LINES,
  STATUS_MAP,
  TRAINING_WEEKDAY_LABELS_BG,
  TRAINING_WEEKDAY_SHORT_BG,
  addMonths,
  buildTrainingCalendarMonth,
  cmpYM,
  formatIsoDateForBgDisplay,
  formatMonthYearInBgUtc,
  normalizeTrainingFieldType,
  parseYearMonth,
  toISOMonth,
} from "./_utils/member-display";
import { printMemberReceipt } from "./_utils/member-receipt";

import "./page.css";

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
  const [viewerRoleChecked, setViewerRoleChecked] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState("");
  const [pushStatusTone, setPushStatusTone] = useState<"success" | "danger">(
    "success",
  );
  const [pushErrorMessage, setPushErrorMessage] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [activeDiscount, setActiveDiscount] = useState<{
    id: string;
    name: string;
    logoUrl: string | null;
    badgeText: string | null;
    code: string | null;
    storeUrl: string | null;
    terms: string[];
    themeColor?: string | null;
    validUntil?: string | null;
  } | null>(null);
  const [activeDiscountCodeCopied, setActiveDiscountCodeCopied] =
    useState(false);
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
    rank: "",
    weight: "",
    jerseyNumber: "",
    parentPhone: "",
    playerPhone: "",
  });

  // Notifications
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      type: string;
      title: string;
      body: string;
      imageUrl?: string | null;
      url?: string | null;
      sentAt: string;
      readAt: string | null;
    }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [lastHandledPushOpenTs, setLastHandledPushOpenTs] = useState<
    string | null
  >(null);

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalMode, setPaymentModalMode] = useState<"create" | "delete">(
    "create",
  );
  const [paymentDeleteConfirmOpen, setPaymentDeleteConfirmOpen] =
    useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedYM, setSelectedYM] = useState<{
    year: number;
    month: number;
  } | null>(null);
  const [selectedPaymentDeleteMonths, setSelectedPaymentDeleteMonths] =
    useState<Array<{ year: number; month: number }>>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [irisPaymentLoading, setIrisPaymentLoading] = useState(false);
  const [irisStatusLoading, setIrisStatusLoading] = useState(false);
  const [irisPayment, setIrisPayment] = useState<IrisOnlinePayment | null>(
    null,
  );
  const irisPaymentRequestIdRef = useRef(0);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentTrainingCredits, setPaymentTrainingCredits] = useState("");
  const [trainingCreditLoading, setTrainingCreditLoading] = useState(false);
  const [trainingCheckInOpen, setTrainingCheckInOpen] = useState(false);
  const [trainingCreditError, setTrainingCreditError] = useState<string | null>(
    null,
  );
  const [trainingCreditSuccess, setTrainingCreditSuccess] = useState<
    string | null
  >(null);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseActionLoading, setPauseActionLoading] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [selectedPauseMonths, setSelectedPauseMonths] = useState<
    Array<{ year: number; month: number }>
  >([]);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    id: string;
    paidFor: string;
    paidAt: string;
  } | null>(null);
  const [trainingDays, setTrainingDays] = useState<TrainingDayStatus[]>([]);
  const [trainingWindowDays, setTrainingWindowDays] = useState(30);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [memberMatches, setMemberMatches] = useState<MemberMatch[]>([]);
  const [trainingSavingDate, setTrainingSavingDate] = useState<string | null>(
    null,
  );
  const [registerSavingEventId, setRegisterSavingEventId] = useState<
    string | null
  >(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [trainingCalendarMonth, setTrainingCalendarMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [trainingDetailsDate, setTrainingDetailsDate] = useState<string | null>(
    null,
  );
  const [trainingNotePopupOpen, setTrainingNotePopupOpen] = useState(false);
  const [trainingAttendancePopupOpen, setTrainingAttendancePopupOpen] =
    useState(false);
  const [trainingDayPopupTab, setTrainingDayPopupTab] = useState<
    "training" | "match"
  >("training");
  const [matchDetailsPopupOpen, setMatchDetailsPopupOpen] = useState(false);
  const [matchDetailsMatch, setMatchDetailsMatch] =
    useState<MemberMatch | null>(null);
  const [trainingConfirmSession, setTrainingConfirmSession] =
    useState<TrainingSessionItem | null>(null);
  const [trainingConfirmModalOpen, setTrainingConfirmModalOpen] =
    useState(false);
  const [trainingConfirmAction, setTrainingConfirmAction] = useState<
    "attend" | "optOut" | null
  >(null);
  const [trainingOptOutReasonCode, setTrainingOptOutReasonCode] = useState<
    TrainingOptOutReasonCode | ""
  >("");
  const [birthdayCardOpen, setBirthdayCardOpen] = useState(false);
  const [trainingOptOutReasonText, setTrainingOptOutReasonText] = useState("");
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());

  // ── Derived: paid months set ─────────────────────────
  const paidSet = new Set<string>(
    (member?.paymentLogs ?? []).map(({ paidFor }) => {
      const { year, month } = parseYearMonth(paidFor);
      return `${year}-${month}`;
    }),
  );
  const waivedSet = new Set<string>(
    (member?.paymentWaivers ?? []).map(({ waivedFor }) => {
      const { year, month } = parseYearMonth(waivedFor);
      return `${year}-${month}`;
    }),
  );
  const settledSet = new Set<string>([...paidSet, ...waivedSet]);

  // Demo clubs can test payments before billing activation; start from current month.
  const firstBillingYM: { year: number; month: number } | null = (() => {
    if (!member) return null;
    if (!member.firstBillingMonth) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    }
    return parseYearMonth(member.firstBillingMonth);
  })();
  const selectedPauseKeys = new Set(
    selectedPauseMonths.map((item) => `${item.year}-${item.month}`),
  );
  const selectedPaymentDeleteKeys = new Set(
    selectedPaymentDeleteMonths.map((item) => `${item.year}-${item.month}`),
  );
  const canApplyPause = selectedPauseMonths.some(
    (item) => !waivedSet.has(`${item.year}-${item.month}`),
  );
  const canRemovePause = selectedPauseMonths.some((item) =>
    waivedSet.has(`${item.year}-${item.month}`),
  );
  const trainingDaysSorted = [...trainingDays].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const trainingDaysWithNotes = trainingDaysSorted.filter(
    (item) => item.note.trim().length > 0,
  );
  const trainingByDate = new Map(
    trainingDaysSorted.map((item) => [item.date, item]),
  );
  const matchesByDate = new Map<string, MemberMatch[]>();
  for (const m of memberMatches) {
    const existing = matchesByDate.get(m.matchDate) ?? [];
    existing.push(m);
    matchesByDate.set(m.matchDate, existing);
  }
  const trainingDetailsItem = trainingDetailsDate
    ? (trainingByDate.get(trainingDetailsDate) ?? null)
    : null;
  const trainingDetailsMatches = trainingDetailsDate
    ? (matchesByDate.get(trainingDetailsDate) ?? [])
    : [];
  const today = new Date();
  const isRollingThirtyDayPayment =
    member?.paymentWorkflow === "rolling_30_days";
  const isTrainingCreditsPayment =
    member?.paymentWorkflow === "training_credits";
  const isTrainingCreditsThirtyDayPayment =
    member?.paymentWorkflow === "training_credits_30_days";
  const isTrainingCreditBasedPayment =
    isTrainingCreditsPayment || isTrainingCreditsThirtyDayPayment;
  const isThirtyDayBasedPayment =
    isRollingThirtyDayPayment || isTrainingCreditsThirtyDayPayment;
  const remainingTrainingCredits = Math.max(
    0,
    Number(member?.remainingTrainingCredits ?? 0),
  );
  const rollingPaymentWindow = (() => {
    if (!isThirtyDayBasedPayment || !member?.paymentLogs?.length) return null;
    const latestPaidStart = [...member.paymentLogs]
      .map(({ paidFor }) => new Date(paidFor))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (!latestPaidStart) return null;

    const paidUntil = new Date(
      latestPaidStart.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    const remainingMs = paidUntil.getTime() - Date.now();
    const remainingDays =
      remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;

    return { latestPaidStart, paidUntil, remainingDays };
  })();
  const hasActiveRollingPayment = Boolean(
    isRollingThirtyDayPayment &&
    rollingPaymentWindow &&
    rollingPaymentWindow.remainingDays > 0,
  );
  const hasActiveTrainingCreditWindow = Boolean(
    isTrainingCreditsThirtyDayPayment &&
    rollingPaymentWindow &&
    rollingPaymentWindow.remainingDays > 0,
  );
  const hasActiveTrainingCreditsThirtyDayPayment = Boolean(
    isTrainingCreditsThirtyDayPayment &&
    hasActiveTrainingCreditWindow &&
    remainingTrainingCredits > 0,
  );
  const todayDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const trainingMonths = [
    buildTrainingCalendarMonth(
      trainingCalendarMonth.year,
      trainingCalendarMonth.month,
    ),
  ];
  const nextScheduleEvent =
    [
      ...getTrainingCountdownCandidates(trainingDaysSorted),
      ...memberMatches.map((match) => ({
        type: "match" as const,
        date: match.matchDate,
        time: match.matchTime?.trim() || null,
        opponent: match.opponent,
        eventLabel: matchEventTypeLabel(match.eventType),
        targetMs: getTrainingDateTimeMs(match.matchDate, match.matchTime),
      })),
    ]
      .filter((entry) => Number.isFinite(entry.targetMs))
      .sort((a, b) => a.targetMs - b.targetMs)
      .find((entry) => entry.targetMs >= countdownNowMs) ?? null;
  const nextScheduleCountdown = (() => {
    if (!nextScheduleEvent) {
      return null;
    }
    const diffMs = Math.max(0, nextScheduleEvent.targetMs - countdownNowMs);
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

  // Next unpaid = first month not settled, anchored to firstBillingYM
  const firstUnpaidYM: { year: number; month: number } | null = (() => {
    if (!firstBillingYM) return null;

    let candidate = lastPaidYM ? addMonths(lastPaidYM, 1) : firstBillingYM;

    while (settledSet.has(`${candidate.year}-${candidate.month}`)) {
      candidate = addMonths(candidate, 1);
    }

    if (cmpYM(candidate, firstBillingYM) < 0) return firstBillingYM;

    return candidate;
  })();
  const paymentModalYM = firstUnpaidYM ?? {
    year: today.getFullYear(),
    month: today.getMonth(),
  };

  const openPaymentModal = () => {
    setPaymentDeleteConfirmOpen(false);
    setPaymentModalMode("create");
    setCalendarYear(paymentModalYM.year);
    setSelectedYM(paymentModalYM);
    setPaymentTrainingCredits("");
    setIrisPayment(null);
    setSelectedPaymentDeleteMonths([]);
    setPaymentError(
      isTrainingCreditBasedPayment &&
        Number(member?.defaultOnlineTrainingCredits ?? 0) <= 0
        ? "Онлайн плащането за тренировки не е конфигурирано."
        : null,
    );
    setPaymentModalOpen(true);
  };

  const openPaymentDeleteModal = () => {
    setPaymentDeleteConfirmOpen(false);
    const initialYear =
      lastPaidYM?.year ?? firstUnpaidYM?.year ?? new Date().getFullYear();
    setPaymentModalMode("delete");
    setCalendarYear(initialYear);
    setSelectedYM(null);
    setSelectedPaymentDeleteMonths([]);
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  // Month state

  const getMonthState = (ym: { year: number; month: number }): MonthState => {
    const key = `${ym.year}-${ym.month}`;
    if (selectedPaymentDeleteKeys.has(key)) return "deleteSelected";
    if (paidSet.has(key)) return "paid";
    if (waivedSet.has(key)) return "waived";
    if (paymentModalMode === "delete") return "disabled";
    if (firstBillingYM && cmpYM(ym, firstBillingYM) < 0) return "disabled";
    if (!firstUnpaidYM || cmpYM(ym, firstUnpaidYM) < 0) return "disabled";
    const isNext =
      firstUnpaidYM && key === `${firstUnpaidYM.year}-${firstUnpaidYM.month}`;
    if (selectedYM && `${selectedYM.year}-${selectedYM.month}` === key)
      return "selected";
    if (isNext) return "next";
    return "available";
  };

  const handleMonthClick = (ym: { year: number; month: number }) => {
    const key = `${ym.year}-${ym.month}`;
    if (paidSet.has(key)) {
      if (paymentModalMode !== "delete") return;
      setSelectedPaymentDeleteMonths((prev) => {
        const exists = prev.some(
          (item) => `${item.year}-${item.month}` === key,
        );
        return exists
          ? prev.filter((item) => `${item.year}-${item.month}` !== key)
          : [...prev, ym];
      });
      return;
    }
    if (waivedSet.has(key)) return;
    if (paymentModalMode === "delete") return;
    if (!firstUnpaidYM) return;
    if (cmpYM(ym, firstUnpaidYM) < 0) return;
    setSelectedPaymentDeleteMonths([]);
    setSelectedYM(ym);
    if (irisPayment || irisPaymentLoading) {
      void createIrisPaymentForSelection(ym);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const response = await fetch(
        `/api/members/${normalizedCardCode}/notifications`,
        { cache: "no-store" },
      );
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
        const response = await fetch(
          `/api/members/${normalizedCardCode}/notifications/read`,
          {
            method: "POST",
          },
        );
        if (response.ok) {
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, readAt: new Date().toISOString() })),
          );
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
      const response = await fetch(
        `/api/members/${normalizedCardCode}/training`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Неуспешно зареждане на тренировките.",
        );
      }

      const payload = await response.json();
      const trainingPayloadClubSports =
        String(payload?.clubSports ?? "").trim() || member?.clubSports || null;
      const days = Array.isArray(payload?.dates)
        ? payload.dates
            .map((item: unknown) => {
              const raw =
                typeof item === "object" && item !== null
                  ? (item as Record<string, unknown>)
                  : {};
              return {
                date: String(raw.date ?? ""),
                weekday: Number(raw.weekday ?? 0),
                optedOut: Boolean(raw.optedOut),
                optOutReasonCode:
                  raw.optOutReasonCode === "injury" ||
                  raw.optOutReasonCode === "sick" ||
                  raw.optOutReasonCode === "other"
                    ? raw.optOutReasonCode
                    : null,
                optOutReasonText:
                  String(raw.optOutReasonText ?? "").trim() || null,
                trainingTime: String(raw.trainingTime ?? "").trim(),
                trainingDurationMinutes: Number.isInteger(
                  Number(raw.trainingDurationMinutes),
                )
                  ? Number(raw.trainingDurationMinutes)
                  : undefined,
                trainingFieldName:
                  String(raw.trainingFieldName ?? "").trim() || null,
                trainingFieldType: normalizeTrainingFieldType(
                  raw.trainingFieldType,
                  trainingPayloadClubSports,
                ),
                trainingFieldPieces: Array.isArray(raw.trainingFieldPieces)
                  ? raw.trainingFieldPieces
                      .map((name) => String(name ?? "").trim())
                      .filter(Boolean)
                  : [],
                trainingFieldPieceNames: Array.isArray(
                  raw.trainingFieldPieceNames,
                )
                  ? raw.trainingFieldPieceNames
                      .map((name) => String(name ?? "").trim())
                      .filter(Boolean)
                  : [],
                note: String(raw.note ?? ""),
                limitedEvent: (() => {
                  const le = raw.limitedEvent;
                  if (!le || typeof le !== "object") return null;
                  const l = le as Record<string, unknown>;
                  if (typeof l.id !== "string" || !l.id) return null;
                  const isRegistered = Boolean(l.isRegistered);
                  const isConfirmed = isRegistered && Boolean(l.isConfirmed);
                  return {
                    id: l.id,
                    maxSpots: Number(l.maxSpots),
                    spotsRemaining: Number(l.spotsRemaining),
                    isRegistered,
                    isConfirmed,
                    waitlistPosition:
                      isRegistered &&
                      !isConfirmed &&
                      typeof l.waitlistPosition === "number"
                        ? l.waitlistPosition
                        : null,
                  } satisfies LimitedEventInfo;
                })(),
                sessions: (() => {
                  const parseLimitedEvent = (
                    le: unknown,
                  ): LimitedEventInfo | null => {
                    if (!le || typeof le !== "object") return null;
                    const l = le as Record<string, unknown>;
                    if (typeof l.id !== "string" || !l.id) return null;
                    const isRegistered = Boolean(l.isRegistered);
                    const isConfirmed = isRegistered && Boolean(l.isConfirmed);
                    return {
                      id: l.id,
                      maxSpots: Number(l.maxSpots),
                      spotsRemaining: Number(l.spotsRemaining),
                      isRegistered,
                      isConfirmed,
                      waitlistPosition:
                        isRegistered &&
                        !isConfirmed &&
                        typeof l.waitlistPosition === "number"
                          ? l.waitlistPosition
                          : null,
                    };
                  };
                  const rawSessions = Array.isArray(raw.sessions)
                    ? raw.sessions
                    : null;
                  if (!rawSessions || rawSessions.length === 0) {
                    // Fallback: synthesize single session from top-level fields
                    return [
                      {
                        scopeKey: "",
                        note: String(raw.note ?? "").trim(),
                        trainingTime: String(raw.trainingTime ?? "").trim(),
                        trainingDurationMinutes: Number.isInteger(
                          Number(raw.trainingDurationMinutes),
                        )
                          ? Number(raw.trainingDurationMinutes)
                          : undefined,
                        trainingFieldName:
                          String(raw.trainingFieldName ?? "").trim() || null,
                        trainingFieldType: normalizeTrainingFieldType(
                          raw.trainingFieldType,
                          trainingPayloadClubSports,
                        ),
                        trainingFieldPieces: Array.isArray(
                          raw.trainingFieldPieces,
                        )
                          ? (raw.trainingFieldPieces as unknown[])
                              .map((n) => String(n ?? "").trim())
                              .filter(Boolean)
                          : [],
                        trainingFieldPieceNames: Array.isArray(
                          raw.trainingFieldPieceNames,
                        )
                          ? (raw.trainingFieldPieceNames as unknown[])
                              .map((n) => String(n ?? "").trim())
                              .filter(Boolean)
                          : [],
                        limitedEvent: parseLimitedEvent(raw.limitedEvent),
                      } satisfies TrainingSessionItem,
                    ];
                  }
                  return (rawSessions as unknown[]).map((s) => {
                    const rs =
                      typeof s === "object" && s !== null
                        ? (s as Record<string, unknown>)
                        : {};
                    return {
                      id: typeof rs.id === "string" ? rs.id : undefined,
                      optedOut: Boolean(rs.optedOut),
                      optOutReasonCode:
                        typeof rs.optOutReasonCode === "string"
                          ? rs.optOutReasonCode
                          : null,
                      optOutReasonText:
                        typeof rs.optOutReasonText === "string"
                          ? rs.optOutReasonText
                          : null,
                      scopeKey: String(rs.scopeKey ?? ""),
                      groupName: String(rs.groupName ?? "").trim() || undefined,
                      note: String(rs.note ?? "").trim(),
                      trainingTime: String(rs.trainingTime ?? "").trim(),
                      trainingDurationMinutes: Number.isInteger(
                        Number(rs.trainingDurationMinutes),
                      )
                        ? Number(rs.trainingDurationMinutes)
                        : undefined,
                      trainingFieldName:
                        String(rs.trainingFieldName ?? "").trim() || null,
                      trainingFieldType: normalizeTrainingFieldType(
                        rs.trainingFieldType,
                        trainingPayloadClubSports,
                      ),
                      trainingFieldPieces: Array.isArray(rs.trainingFieldPieces)
                        ? (rs.trainingFieldPieces as unknown[])
                            .map((n) => String(n ?? "").trim())
                            .filter(Boolean)
                        : [],
                      trainingFieldPieceNames: Array.isArray(
                        rs.trainingFieldPieceNames,
                      )
                        ? (rs.trainingFieldPieceNames as unknown[])
                            .map((n) => String(n ?? "").trim())
                            .filter(Boolean)
                        : [],
                      limitedEvent: parseLimitedEvent(rs.limitedEvent),
                    } satisfies TrainingSessionItem;
                  });
                })(),
              } satisfies TrainingDayStatus;
            })
            .filter((item: TrainingDayStatus) =>
              /^\d{4}-\d{2}-\d{2}$/.test(item.date),
            )
        : [];
      const nextWindowDays = Number.parseInt(
        String(payload?.trainingWindowDays ?? "30"),
        10,
      );
      setTrainingWindowDays(
        Number.isInteger(nextWindowDays) && nextWindowDays > 0
          ? nextWindowDays
          : 30,
      );
      setTrainingDays(days);
      return days;
    } catch (error) {
      console.error("Failed to fetch training schedule:", error);
      setTrainingError(
        error instanceof Error ? error.message : "Възникна грешка.",
      );
      setTrainingDays([]);
      return [];
    } finally {
      setTrainingLoading(false);
    }
  };

  const fetchMemberMatches = async () => {
    try {
      const res = await fetch(`/api/members/${normalizedCardCode}/matches`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { matches?: MemberMatch[] };
        setMemberMatches(data.matches ?? []);
        setMatchDetailsMatch((current) =>
          current
            ? (data.matches?.find((match) => match.id === current.id) ?? null)
            : null,
        );
      }
    } catch {
      // non-critical — calendar still shows trainings
    }
  };

  const openTrainingModal = async () => {
    setTrainingError(null);
    setTrainingNotePopupOpen(false);
    setTrainingDetailsDate(trainingDaysSorted[0]?.date ?? null);
    const today = new Date();
    setTrainingCalendarMonth({
      year: today.getFullYear(),
      month: today.getMonth(),
    });
    setTrainingModalOpen(true);
    const [latestDays] = await Promise.all([
      fetchTrainingDays(),
      fetchMemberMatches(),
    ]);
    setTrainingDetailsDate(latestDays[0]?.date ?? null);
  };

  const closeTrainingModal = () => {
    setTrainingNotePopupOpen(false);
    setTrainingDetailsDate(trainingDaysSorted[0]?.date ?? null);
    setTrainingModalOpen(false);
  };

  const trackDiscount = (
    partner: string,
    action: "view" | "copy" | "link_click",
  ) => {
    void fetch(`/api/members/${normalizedCardCode}/discount-usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner, action }),
      keepalive: true,
    }).catch(() => {});
  };

  const refreshMember = async ({
    showLoading = false,
  }: { showLoading?: boolean } = {}) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetch(`/api/members/${normalizedCardCode}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setMember(null);
        setError("Профилът не е намерен.");
        return null;
      }
      const data = (await response.json()) as MemberProfile;
      setMember(data);
      return data;
    } catch (e) {
      console.error("Failed to fetch member:", e);
      setError("Възникна грешка при зареждане.");
      return null;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Fetch member
  useEffect(() => {
    void refreshMember({ showLoading: true });
  }, [normalizedCardCode]);

  useEffect(() => {
    void Promise.all([fetchTrainingDays(), fetchMemberMatches()]);
  }, [normalizedCardCode]);

  useEffect(() => {
    if (!member?.birthDate) return;
    const bday = new Date(member.birthDate);
    const now = new Date();
    const isBirthday =
      bday.getUTCMonth() === now.getMonth() &&
      bday.getUTCDate() === now.getDate();
    if (!isBirthday) return;
    const sessionKey = `birthdayShown_${member.cardCode}`;
    const fromNotification = searchParams.get("openBirthday") === "1";
    if (fromNotification || !sessionStorage.getItem(sessionKey)) {
      setBirthdayCardOpen(true);
      sessionStorage.setItem(sessionKey, "1");
    }
  }, [member, searchParams]);

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

      const type =
        "type" in payload
          ? String((payload as { type?: unknown }).type ?? "")
          : "";

      if (type === "ping" || type === "connected") {
        return;
      }

      if (
        type === "member-updated" ||
        type === "status-updated" ||
        type === "payment-history-updated" ||
        type === "notification-created"
      ) {
        void refreshMember();
      }

      if (type === "training-updated") {
        void Promise.all([fetchTrainingDays(), fetchMemberMatches()]);
      }

      if (type === "notification-created") {
        void (async () => {
          try {
            const response = await fetch(
              `/api/members/${normalizedCardCode}/notifications`,
              {
                cache: "no-store",
              },
            );
            if (!response.ok) {
              return;
            }
            const data = await response.json();
            setUnreadCount(data.unreadCount || 0);
            if (notificationsPanelOpen) {
              setNotifications(data.notifications || []);
            }
          } catch (error) {
            console.error(
              "Failed to refresh notifications after event:",
              error,
            );
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

  // Re-fetch dynamic data when app returns to foreground (SSE is lost while backgrounded on mobile).
  useEffect(() => {
    const refreshForegroundData = () => {
      void refreshMember();
      void Promise.all([fetchTrainingDays(), fetchMemberMatches()]);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshForegroundData();
    };
    const handleFocus = () => refreshForegroundData();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [normalizedCardCode]);

  useEffect(() => {
    if (
      !isThirtyDayBasedPayment ||
      !rollingPaymentWindow ||
      rollingPaymentWindow.remainingDays <= 0
    ) {
      return;
    }

    const msUntilExpiry = rollingPaymentWindow.paidUntil.getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      void refreshMember();
      return;
    }

    const timeout = window.setTimeout(
      () => {
        void refreshMember();
      },
      Math.min(msUntilExpiry + 1000, 2_147_483_647),
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    isThirtyDayBasedPayment,
    rollingPaymentWindow?.paidUntil.getTime(),
    rollingPaymentWindow?.remainingDays,
    normalizedCardCode,
  ]);

  // Fetch unread notification count on page load
  useEffect(() => {
    if (isAdmin || isCoach) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(
          `/api/members/${normalizedCardCode}/notifications`,
          { cache: "no-store" },
        );
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
    // Foreground/SSE refreshes must not overwrite an open edit draft.
    if (!member || editModalOpen) {
      return;
    }

    setEditForm({
      fullName: member.name ?? "",
      birthDate: member.birthDate
        ? new Date(member.birthDate).toISOString().slice(0, 10)
        : "",
      teamGroup:
        member.team_group !== null && member.team_group !== undefined
          ? String(member.team_group)
          : "",
      rank: member.rank ?? "",
      weight: member.weight == null ? "" : String(member.weight),
      jerseyNumber: member.jerseyNumber ?? "",
      parentPhone: member.parentPhone ?? "",
      playerPhone: member.playerPhone ?? "",
    });
    setEditImageFile(null);
    setEditImagePreviewUrl("");
  }, [member, editModalOpen]);

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
    const fromPush =
      searchParams.get("fromPush") === "1" && Boolean(pushOpenTs);
    const shouldOpenBell = fromPush && searchParams.get("openBell") === "1";
    const shouldOpenTraining =
      fromPush && searchParams.get("openTraining") === "1";
    const shouldOpenBirthday = searchParams.get("openBirthday") === "1";

    if (!shouldOpenBell && !shouldOpenTraining && !shouldOpenBirthday) {
      return;
    }

    // Bell/training require a new push event for deduplication; birthday does not
    if (
      (shouldOpenBell || shouldOpenTraining) &&
      (!pushOpenTs || pushOpenTs === lastHandledPushOpenTs)
    ) {
      if (!shouldOpenBirthday) return;
    }

    if (pushOpenTs && pushOpenTs !== lastHandledPushOpenTs) {
      setLastHandledPushOpenTs(pushOpenTs);
    }

    if (shouldOpenTraining) {
      void openTrainingModal();
    }

    if (shouldOpenBirthday) {
      setBirthdayCardOpen(true);
    }

    if (shouldOpenBell) {
      setNotificationsPanelOpen(true);
      void (async () => {
        setLoadingNotifications(true);
        try {
          const response = await fetch(
            `/api/members/${normalizedCardCode}/notifications`,
            { cache: "no-store" },
          );
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
          const response = await fetch(
            `/api/members/${normalizedCardCode}/notifications/read`,
            {
              method: "POST",
            },
          );
          if (response.ok) {
            setNotifications((prev) =>
              prev.map((n) => ({ ...n, readAt: new Date().toISOString() })),
            );
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
    cleanedParams.delete("openBirthday");
    cleanedParams.delete("pushOpenTs");
    const cleanedQuery = cleanedParams.toString();
    const cleanPath = `/member/${encodeURIComponent(normalizedCardCode)}`;
    router.replace(cleanedQuery ? `${cleanPath}?${cleanedQuery}` : cleanPath, {
      scroll: false,
    });
  }, [
    normalizedCardCode,
    lastHandledPushOpenTs,
    router,
    searchParams,
    isAdmin,
    isCoach,
  ]);

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
          setViewerRoleChecked(true);
          return;
        }
        const payload = (await response.json()) as {
          isAdmin?: boolean;
          isCoach?: boolean;
        };
        setIsAdmin(Boolean(payload.isAdmin));
        setIsCoach(Boolean(payload.isCoach));
        setViewerRoleChecked(true);
      } catch {
        setIsAdmin(false);
        setIsCoach(false);
        setViewerRoleChecked(true);
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
    const standaloneByDisplayMode =
      window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
    const standaloneByNavigator =
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;
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
        const existingSubscription =
          await registration.pushManager.getSubscription();
        if (!existingSubscription) {
          setIsPushEnabled(false);
          return;
        }

        const search = new URLSearchParams({
          endpoint: existingSubscription.endpoint,
        });
        const response = await fetch(
          `/api/members/${encodeURIComponent(normalizedCardCode)}/push-subscriptions?${search.toString()}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          setIsPushEnabled(false);
          return;
        }

        const payload = (await response.json()) as { isActive?: unknown };
        setIsPushEnabled(Boolean(payload.isActive));
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
      setPushErrorMessage(
        "Push is not supported on this device or HTTPS is missing.",
      );
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

      const keyResponse = await fetch("/api/push/public-key", {
        cache: "no-store",
      });
      if (!keyResponse.ok) {
        const payload = await keyResponse.json().catch(() => ({}));
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Missing VAPID server configuration.",
        );
      }

      const { publicKey } = (await keyResponse.json()) as { publicKey: string };

      const subscription = await getCompatiblePushSubscription(
        registration,
        publicKey,
      );

      const saveResponse = await fetch(
        `/api/members/${encodeURIComponent(normalizedCardCode)}/push-subscriptions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        },
      );

      if (!saveResponse.ok) {
        const payload = await saveResponse.json().catch(() => ({}));
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Failed to enable push notifications.",
        );
      }

      setIsPushEnabled(true);
      setPushStatusMessage("");
      setPushStatusTone("success");
    } catch (pushError) {
      console.error("Enable push error:", pushError);
      setPushErrorMessage(
        pushError instanceof Error
          ? pushError.message
          : "Unexpected push setup error.",
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
      setPushErrorMessage(
        "Push is not supported on this device or HTTPS is missing.",
      );
      return;
    }

    setIsEnablingPush(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existingSubscription =
        await registration.pushManager.getSubscription();
      if (!existingSubscription) {
        setIsPushEnabled(false);
        setPushStatusMessage("Известията вече са изключени.");
        setPushStatusTone("danger");
        return;
      }

      const endpoint = existingSubscription.endpoint;

      const deleteResponse = await fetch(
        `/api/members/${encodeURIComponent(normalizedCardCode)}/push-subscriptions`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        },
      );

      if (!deleteResponse.ok) {
        const payload = await deleteResponse.json().catch(() => ({}));
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Failed to disable push notifications.",
        );
      }

      const deletePayload = (await deleteResponse.json().catch(() => ({}))) as {
        shouldUnsubscribeBrowser?: unknown;
      };

      if (deletePayload.shouldUnsubscribeBrowser !== false) {
        await existingSubscription.unsubscribe();
      }

      setIsPushEnabled(false);
      setPushStatusMessage("Известията са изключени.");
      setPushStatusTone("danger");
    } catch (pushError) {
      console.error("Disable push error:", pushError);
      setPushErrorMessage(
        pushError instanceof Error
          ? pushError.message
          : "Unexpected push disable error.",
      );
    } finally {
      setIsEnablingPush(false);
    }
  };

  // Submit payment
  const handlePayment = async () => {
    if (!selectedYM || !member) return;
    const parsedTrainingCredits = Number(paymentTrainingCredits);
    if (
      isTrainingCreditBasedPayment &&
      (!Number.isInteger(parsedTrainingCredits) || parsedTrainingCredits < 1)
    ) {
      setPaymentError("Въведете брой тренировки по-голям от 0.");
      return;
    }
    if (hasActiveTrainingCreditsThirtyDayPayment) {
      setPaymentError(
        "Плащане може да се отчете, когато тренировките станат 0 или 30-дневният срок изтече.",
      );
      return;
    }
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const response = await fetch(
        `/api/members/${normalizedCardCode}/payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paidFor:
              isThirtyDayBasedPayment || isTrainingCreditBasedPayment
                ? new Date().toISOString()
                : toISOMonth(selectedYM),
            ...(isTrainingCreditBasedPayment
              ? { remainingTrainings: parsedTrainingCredits }
              : {}),
          }),
        },
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Грешка при плащане");
      }
      const refreshed = await fetch(`/api/members/${normalizedCardCode}`, {
        cache: "no-store",
      });
      if (refreshed.ok) setMember(await refreshed.json());
      setSelectedPaymentDeleteMonths([]);
      setPaymentModalOpen(false);
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Възникна грешка");
    } finally {
      setPaymentLoading(false);
    }
  };

  const createIrisPaymentForSelection = async (targetYM: {
    year: number;
    month: number;
  }) => {
    if (!member) return;
    if (hasActiveRollingPayment) {
      setPaymentError(`Остават ${rollingRemainingText}`);
      return;
    }
    if (hasActiveTrainingCreditsThirtyDayPayment) {
      setPaymentError(
        "Онлайн плащане е достъпно, когато тренировките станат 0 или 30-дневният срок изтече.",
      );
      return;
    }
    if (
      isTrainingCreditBasedPayment &&
      Number(member.defaultOnlineTrainingCredits ?? 0) <= 0
    ) {
      setPaymentError("Онлайн плащането за тренировки не е конфигурирано.");
      return;
    }

    const requestId = irisPaymentRequestIdRef.current + 1;
    irisPaymentRequestIdRef.current = requestId;
    setIrisPaymentLoading(true);
    setPaymentError(null);
    setIrisPayment(null);
    try {
      const response = await fetch(
        `/api/members/${normalizedCardCode}/irispay/payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paidFor:
              isThirtyDayBasedPayment || isTrainingCreditBasedPayment
                ? new Date().toISOString()
                : toISOMonth(targetYM),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (requestId !== irisPaymentRequestIdRef.current) return;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error
            : "Грешка при създаване на онлайн плащане",
        );
      }
      setIrisPayment(payload.payment as IrisOnlinePayment);
    } catch (e) {
      if (requestId !== irisPaymentRequestIdRef.current) return;
      setPaymentError(e instanceof Error ? e.message : "Възникна грешка");
    } finally {
      if (requestId === irisPaymentRequestIdRef.current) {
        setIrisPaymentLoading(false);
      }
    }
  };

  const handleIrisPayment = async () => {
    if (!selectedYM) return;
    await createIrisPaymentForSelection(selectedYM);
  };

  const handleIrisStatusCheck = async () => {
    if (!irisPayment) return;
    setIrisStatusLoading(true);
    setPaymentError(null);
    try {
      const response = await fetch(
        `/api/members/${normalizedCardCode}/irispay/payment/${encodeURIComponent(irisPayment.paymentHash)}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error
            : "Грешка при проверка на плащането",
        );
      }
      const nextStatus = payload.status as IrisOnlinePayment["status"];
      setIrisPayment((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      if (nextStatus === "CONFIRMED") {
        const refreshed = await fetch(`/api/members/${normalizedCardCode}`, {
          cache: "no-store",
        });
        if (refreshed.ok) setMember(await refreshed.json());
      }
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Възникна грешка");
    } finally {
      setIrisStatusLoading(false);
    }
  };

  const handleTrainingCreditCheckIn = async (trainingSessionId: string) => {
    if (!member || trainingCreditLoading) return;
    setTrainingCreditLoading(true);
    setTrainingCreditError(null);
    setTrainingCreditSuccess(null);
    try {
      const response = await fetch(
        `/api/members/${normalizedCardCode}/training-credit/check-in`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingSessionId }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error
            : "Грешка при чекиране на тренировка",
        );
      }
      void fetchTrainingDays();
      const refreshed = await fetch(`/api/members/${normalizedCardCode}`, {
        cache: "no-store",
      });
      if (refreshed.ok) {
        setMember((await refreshed.json()) as MemberProfile);
      } else if (typeof payload?.remainingTrainingCredits === "number") {
        setMember((prev) =>
          prev
            ? {
                ...prev,
                remainingTrainingCredits: payload.remainingTrainingCredits,
                status: payload.status === "paid" ? "paid" : "overdue",
              }
            : prev,
        );
      }
      const remaining =
        typeof payload?.remainingTrainingCredits === "number"
          ? Math.max(0, payload.remainingTrainingCredits)
          : null;
      setTrainingCreditSuccess(
        remaining === null
          ? "Тренировката е отчетена успешно."
          : `Тренировката е отчетена. Остават ${remaining}.`,
      );
    } catch (e) {
      setTrainingCreditError(
        e instanceof Error ? e.message : "Възникна грешка",
      );
      throw e;
    } finally {
      setTrainingCreditLoading(false);
    }
  };

  const handleDeletePayments = async () => {
    if (
      !member ||
      !paymentDeleteConfirmOpen ||
      paymentLoading ||
      selectedPaymentDeleteMonths.length === 0
    )
      return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const response = await fetch(
        `/api/members/${normalizedCardCode}/payment`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paidFor: selectedPaymentDeleteMonths.map((item) =>
              toISOMonth(item),
            ),
          }),
        },
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          typeof err?.error === "string" && err.error.trim()
            ? err.error
            : "Грешка при изтриване на плащания",
        );
      }

      const refreshed = await fetch(`/api/members/${normalizedCardCode}`, {
        cache: "no-store",
      });
      if (refreshed.ok) {
        setMember((await refreshed.json()) as MemberProfile);
      }
      setSelectedPaymentDeleteMonths([]);
      setPaymentDeleteConfirmOpen(false);
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

      const refreshed = await fetch(`/api/members/${normalizedCardCode}`, {
        cache: "no-store",
      });
      if (refreshed.ok) {
        setMember((await refreshed.json()) as MemberProfile);
      }

      setSelectedPauseMonths([]);
      setPauseReason("");
      setPauseModalOpen(false);
    } catch (error) {
      setPauseError(
        error instanceof Error ? error.message : "Възникна грешка.",
      );
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

    const parentPhone = editForm.parentPhone.trim() || null;
    const playerPhone = editForm.playerPhone.trim() || null;

    setEditSaving(true);
    setEditError("");
    try {
      const weight = playerFieldEnabled(member, "weight")
        ? parsePlayerWeight(editForm.weight)
        : undefined;
      let uploadedImagePath: string | null = null;
      if (editImageFile) {
        const uploaded = await uploadImage(
          editImageFile,
          "player",
          fullName || editImageFile.name,
        );
        uploadedImagePath = extractUploadPathFromCloudinaryUrl(
          uploaded.secure_url,
        );
      }

      const response = await fetch(`/api/members/${normalizedCardCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          birthDate: editForm.birthDate.trim() || null,
          ...(playerFieldEnabled(member, "teamGroup") ? { teamGroup } : {}),
          ...(playerFieldEnabled(member, "jerseyNumber")
            ? { jerseyNumber: editForm.jerseyNumber.trim() || null }
            : {}),
          ...(playerFieldEnabled(member, "rank")
            ? { rank: editForm.rank.trim() || null }
            : {}),
          ...(playerFieldEnabled(member, "weight") ? { weight } : {}),
          parentPhone,
          playerPhone,
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

      const refreshed = await fetch(`/api/members/${normalizedCardCode}`, {
        cache: "no-store",
      });
      if (refreshed.ok) {
        setMember((await refreshed.json()) as MemberProfile);
      }
      setEditImageFile(null);
      setEditImagePreviewUrl("");
      setEditModalOpen(false);
    } catch (e) {
      console.error("Public member edit error:", e);
      setEditError(
        e instanceof Error ? e.message : "Възникна грешка при редактиране.",
      );
    } finally {
      setEditSaving(false);
    }
  };

  const formatPaymentPeriod = (value: string) => {
    const start = new Date(value);
    if (isTrainingCreditsPayment) {
      return Number.isNaN(start.getTime())
        ? value
        : `Плащане на ${start.toLocaleDateString("bg-BG")}`;
    }
    if (isTrainingCreditsThirtyDayPayment) {
      if (Number.isNaN(start.getTime())) return value;
      const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      return `Тренировки: ${start.toLocaleDateString("bg-BG")} - ${end.toLocaleDateString("bg-BG")}`;
    }
    if (!isRollingThirtyDayPayment) return formatMonthYearInBgUtc(value);

    if (Number.isNaN(start.getTime())) return value;
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    return `${start.toLocaleDateString("bg-BG")} - ${end.toLocaleDateString("bg-BG")}`;
  };

  const formatReceiptPeriod = (value: string) => formatPaymentPeriod(value);

  const handlePrintReceipt = () => {
    if (selectedReceipt && member)
      printMemberReceipt(selectedReceipt, member, formatReceiptPeriod);
  };

  const rawStatusKey = member?.status ?? "paid";
  const statusKey = rawStatusKey === "paused" ? "warning" : rawStatusKey;
  const status = STATUS_MAP[statusKey];
  const lastPaymentText = member?.last_payment_date
    ? new Date(member.last_payment_date).toLocaleDateString("bg-BG")
    : "Няма плащане";
  const rollingRemainingText =
    rollingPaymentWindow && rollingPaymentWindow.remainingDays > 0
      ? `${rollingPaymentWindow.remainingDays} ${rollingPaymentWindow.remainingDays === 1 ? "ден" : "дни"}`
      : "Няма активни дни";
  const birthDateText = member?.birthDate
    ? new Date(member.birthDate)
        .toLocaleDateString("bg-BG")
        .replace(/\s*г\.\s*$/, "")
    : "-";
  const canManagePayments = isAdmin || isCoach;
  const canPublicEdit = !isAdmin && !isCoach;
  const canUseNotifications = !isAdmin && !isCoach;
  const isOptOutReasonReady =
    trainingConfirmAction !== "optOut"
      ? true
      : trainingOptOutReasonCode !== "" &&
        (trainingOptOutReasonCode !== "other" ||
          trainingOptOutReasonText.trim().length > 0);

  const handleAdminLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setIsAdmin(false);
      setIsCoach(false);
      router.refresh();
      setIsLoggingOut(false);
    }
  };

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
      const requestBody = buildMemberTrainingAttendanceRequest(
        item,
        trainingConfirmSession,
        action,
        reason,
      );
      const response = await fetch(
        `/api/members/${normalizedCardCode}/training`,
        {
          method: action === "optOut" ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (
          typeof payload?.error === "string" &&
          payload.error.trim().length > 0
        ) {
          throw new Error(payload.error.trim());
        }
        throw new Error(
          action === "optOut"
            ? "Неуспешно отказване на присъствие."
            : "Неуспешно потвърждаване на присъствие.",
        );
      }

      await fetchTrainingDays();
    } catch (error) {
      console.error("Failed to update training attendance:", error);
      setTrainingError(
        error instanceof Error ? error.message : "Възникна грешка.",
      );
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
              <p
                style={{ color: "rgba(255,255,255,0.7)", textAlign: "center" }}
              >
                Зареждане...
              </p>
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
              <p style={{ color: "#e03535", textAlign: "center", margin: 0 }}>
                {error ?? "Профилът не е намерен."}
              </p>
              <button
                className="add-btn"
                onClick={() =>
                  router.push(
                    searchParams.get("coachGroupId")
                      ? `/admin/members?coachGroupId=${encodeURIComponent(searchParams.get("coachGroupId")!)}`
                      : "/admin/members",
                  )
                }
              >
                Назад
              </button>
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
        <div
          style={{
            display: "flex",
            justifyContent: isAdmin || isCoach ? "space-between" : "flex-end",
            alignItems: "center",
            marginBottom: "12px",
            gap: "12px",
          }}
        >
          {(isAdmin || isCoach) && (
            <button
              className="amp-back-btn"
              onClick={() => {
                const backCoachGroupId = searchParams.get("coachGroupId");
                const base = member.clubId
                  ? `/admin/members?clubId=${encodeURIComponent(member.clubId)}`
                  : "/admin/members";
                router.push(
                  backCoachGroupId
                    ? `${base}&coachGroupId=${encodeURIComponent(backCoachGroupId)}`
                    : base,
                );
              }}
            >
              <ArrowLeftIcon />
              Назад към състезатели
            </button>
          )}

          {(isAdmin || isCoach) && (
            <button
              type="button"
              className="member-logout-btn"
              onClick={() => void handleAdminLogout()}
              disabled={isLoggingOut}
              aria-label="Изход"
            >
              <LogoutIcon />
              {isLoggingOut ? "Излизане..." : "Изход"}
            </button>
          )}

          {/* Notification bell icon */}
          {canUseNotifications && (
            <button
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
                <span
                  style={{
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
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Member card */}
        <div className="card-shell">
          <div className="speed-lines-layer" aria-hidden="true">
            {SPEED_LINES.map((left, i) => (
              <div
                key={i}
                className="speed-line"
                style={{
                  left: `${left}%`,
                  width: i % 3 === 0 ? "3px" : "2px",
                  opacity: 0.06 + (i % 3) * 0.03,
                  filter: `blur(${i % 2 === 0 ? 1 : 3}px)`,
                }}
              />
            ))}
            <div
              className="speed-line speed-line--wide"
              style={{ left: "18%" }}
            />
            <div
              className="speed-line speed-line--wide2"
              style={{ left: "70%" }}
            />
          </div>
          <div className="vignette" aria-hidden="true" />
          <div className="card-body">
            <div className="header">
              <div className="header-logo">
                {member.clubLogoUrl ? (
                  <img
                    src={member.clubLogoUrl}
                    alt={member.clubName ?? "Club logo"}
                    className="header-logo-img"
                  />
                ) : (
                  <span className="header-logo-fallback">🏆</span>
                )}
              </div>
              <div className="header-center">
                <h1 className="card-title">
                  КЛУБНА КАРТА <span>2026</span>
                </h1>
                <p className="card-subtitle">{member.clubName || "Клуб"}</p>
              </div>
              <div
                className="shield"
                style={
                  !(
                    playerFieldEnabled(member, "jerseyNumber") &&
                    member.jerseyNumber &&
                    Number.isFinite(Number(member.jerseyNumber))
                  )
                    ? { visibility: "hidden" }
                    : undefined
                }
              >
                <svg viewBox="0 0 50 56" fill="none" className="shield-bg">
                  <path
                    d="M25 2 L47 12 L47 35 Q47 50 25 54 Q3 50 3 35 L3 12 Z"
                    fill="rgba(50,205,50,0.1)"
                    stroke="#32cd32"
                    strokeWidth="2.5"
                  />
                </svg>
                <span className="shield-num">№{member.jerseyNumber}</span>
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
                  <span className="info-lbl">Възраст:</span>
                  <span className="info-val">{member.age ?? "—"}</span>
                </div>
                {playerFieldEnabled(member, "rank") && (
                  <div className="info-row">
                    <span className="info-lbl">Степен:</span>
                    <span className="info-val">{member.rank ?? "—"}</span>
                  </div>
                )}
                {playerFieldEnabled(member, "weight") && (
                  <div className="info-row">
                    <span className="info-lbl">Тегло:</span>
                    <span className="info-val">
                      {member.weight == null
                        ? "—"
                        : `${member.weight.toLocaleString("bg-BG")} кг`}
                    </span>
                  </div>
                )}
                {playerFieldEnabled(member, "teamGroup") && (
                  <div className="info-row">
                    <span className="info-lbl">Набор:</span>
                    <span className="info-val">{member.team_group ?? "—"}</span>
                  </div>
                )}

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
                  <span className="info-val">
                    {member.clubSports?.trim() || "-"}
                  </span>
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
                {isRollingThirtyDayPayment && (
                  <div className="info-row">
                    <span className="info-lbl">Оставащи дни:</span>
                    <span
                      className={`info-val ${hasActiveRollingPayment ? "green glow" : "red glow-red"}`}
                    >
                      {rollingRemainingText}
                    </span>
                  </div>
                )}
                {isTrainingCreditBasedPayment && (
                  <div className="info-row">
                    <span className="info-lbl">Оставащи тренировки:</span>
                    <span
                      className={`info-val ${remainingTrainingCredits > 0 ? "green glow" : "red glow-red"}`}
                    >
                      {remainingTrainingCredits}
                    </span>
                  </div>
                )}
                {isTrainingCreditsThirtyDayPayment && (
                  <div className="info-row">
                    <span className="info-lbl">Оставащи дни:</span>
                    <span
                      className={`info-val ${hasActiveTrainingCreditWindow ? "green glow" : "red glow-red"}`}
                    >
                      {rollingRemainingText}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="divider divider--mt" />

            {/* ── Partner discount buttons ── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginTop: "14px",
              }}
            >
              {member.discounts && member.discounts.length > 0 && (
                <div
                  className="sd-discount-btn"
                  onClick={() => {
                    setActiveDiscount(member.discounts![0]);
                    trackDiscount(member.discounts![0].name, "view");
                  }}
                  role="button"
                  tabIndex={0}
                  style={
                    {
                      marginTop: 0,
                      "--theme-color-main": (
                        member.discounts[0].themeColor || "#ff4d4d"
                      ).startsWith("#")
                        ? member.discounts[0].themeColor || "#ff4d4d"
                        : `#${member.discounts[0].themeColor || "ff4d4d"}`,
                      "--theme-color-shadow": `${(member.discounts[0].themeColor || "#ff4d4d").startsWith("#") ? member.discounts[0].themeColor || "#ff4d4d" : `#${member.discounts[0].themeColor || "ff4d4d"}`}99`,
                      "--theme-color-border": `${(member.discounts[0].themeColor || "#ff4d4d").startsWith("#") ? member.discounts[0].themeColor || "#ff4d4d" : `#${member.discounts[0].themeColor || "ff4d4d"}`}cc`,
                    } as CSSProperties &
                      Record<
                        | "--theme-color-main"
                        | "--theme-color-shadow"
                        | "--theme-color-border",
                        string
                      >
                  }
                >
                  <div className="sd-discount-logo-wrap">
                    <img
                      src={member.discounts[0].logoUrl || "/placeholder.webp"}
                      alt={member.discounts[0].name}
                      className="sd-discount-logo"
                    />
                  </div>
                  <span className="sd-discount-label">
                    {member.discounts[0].name}
                  </span>
                  {member.discounts[0].badgeText && (
                    <span
                      className="sd-discount-badge"
                      style={{
                        background: (
                          member.discounts[0].themeColor || "#ff4d4d"
                        ).startsWith("#")
                          ? member.discounts[0].themeColor || "#ff4d4d"
                          : `#${member.discounts[0].themeColor || "ff4d4d"}`,
                      }}
                    >
                      {/^-\d+%$/.test(member.discounts[0].badgeText) ? (
                        member.discounts[0].badgeText
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      )}
                    </span>
                  )}
                </div>
              )}

              {member.discounts && member.discounts.length > 1 && (
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
                  Виж всички оферти ({member.discounts.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {false && (
          <div className="training-section">
            <div className="training-head">
              <h3 className="training-title">
                Легенда: Зелените дати са планирани тренировки, а червените са
                отбелязани отсъствия.
              </h3>
            </div>
            {canPublicEdit &&
              (trainingLoading ? (
                <p className="training-empty">Зареждане...</p>
              ) : trainingDays.length === 0 && memberMatches.length === 0 ? (
                <p className="training-empty">
                  Няма настроени тренировъчни дни.
                </p>
              ) : (
                <div className="training-calendar">
                  {trainingMonths.map((month) => (
                    <section
                      key={month.key}
                      className="training-calendar-month"
                    >
                      <h4 className="training-calendar-month-title">
                        {month.label}
                      </h4>
                      <div className="training-calendar-weekdays">
                        {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                          <span
                            key={`${month.key}-${weekday}`}
                            className="training-calendar-weekday"
                          >
                            {weekday}
                          </span>
                        ))}
                      </div>
                      <div className="training-calendar-grid">
                        {month.cells.map((cellDate, index) => {
                          if (!cellDate) {
                            return (
                              <span
                                key={`${month.key}-empty-${index}`}
                                className="training-calendar-cell training-calendar-cell--empty"
                                aria-hidden="true"
                              />
                            );
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
                                <span className="training-calendar-day-number">
                                  {dayNumber}
                                </span>
                              </span>
                            );
                          }

                          const isSaving =
                            trainingSavingDate === trainingItem.date;
                          const trainingTimeLabel =
                            trainingItem.trainingTime?.trim() ?? "";
                          const dateLabel = new Date(
                            `${trainingItem.date}T12:00:00.000Z`,
                          ).toLocaleDateString("bg-BG", {
                            day: "2-digit",
                            month: "2-digit",
                          });
                          return (
                            <button
                              key={cellDate}
                              className={`training-calendar-cell training-calendar-cell--training${trainingItem.optedOut ? " training-calendar-cell--opted-out" : ""}${isToday ? " training-calendar-cell--today" : ""}`}
                              onClick={() => {
                                setTrainingDetailsDate(trainingItem.date);
                                setTrainingDayPopupTab("training");
                                setTrainingAttendancePopupOpen(true);
                              }}
                              disabled={Boolean(trainingSavingDate)}
                              type="button"
                              aria-label={`${TRAINING_WEEKDAY_LABELS_BG[trainingItem.weekday] ?? "-"} ${dateLabel}${trainingTimeLabel ? ` ${trainingTimeLabel}` : ""}`}
                              aria-pressed={!trainingItem.optedOut}
                            >
                              <span className="training-calendar-day-number">
                                {dayNumber}
                              </span>
                              {trainingTimeLabel && (
                                <span className="training-calendar-time">
                                  {trainingTimeLabel}
                                </span>
                              )}
                              {trainingItem.limitedEvent && !isSaving && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    color: trainingItem.limitedEvent
                                      .isRegistered
                                      ? trainingItem.limitedEvent.isConfirmed
                                        ? "#32cd32"
                                        : "#f0a030"
                                      : trainingItem.limitedEvent
                                            .spotsRemaining === 0
                                        ? "#ff6b6b"
                                        : "#f0a030",
                                  }}
                                >
                                  {trainingItem.limitedEvent.isRegistered
                                    ? trainingItem.limitedEvent.isConfirmed
                                      ? "✓"
                                      : `#${trainingItem.limitedEvent.waitlistPosition}`
                                    : trainingItem.limitedEvent
                                          .spotsRemaining === 0
                                      ? "Ч"
                                      : `${trainingItem.limitedEvent.spotsRemaining}м`}
                                </span>
                              )}
                              {!trainingItem.limitedEvent && (
                                <span className="training-calendar-mark">
                                  {isSaving
                                    ? "..."
                                    : trainingItem.optedOut
                                      ? "x"
                                      : "✓"}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ))}
            {trainingError && <p className="training-error">{trainingError}</p>}
          </div>
        )}

        {/* Below card buttons */}
        {trainingCheckInOpen && (
          <TrainingCheckInPicker
            cardCode={normalizedCardCode}
            onClose={() => setTrainingCheckInOpen(false)}
            onConfirm={handleTrainingCreditCheckIn}
          />
        )}
        <div className="below-card">
          {canManagePayments && (
            <>
              <>
                <button
                  className="pay-btn"
                  onClick={openPaymentModal}
                  title={
                    hasActiveRollingPayment
                      ? `Остават ${rollingRemainingText}`
                      : undefined
                  }
                >
                  Плати
                </button>
                {isTrainingCreditBasedPayment && (
                  <button
                    className="add-btn member-action-btn training-credit-btn"
                    onClick={() => setTrainingCheckInOpen(true)}
                    disabled={
                      trainingCreditLoading ||
                      remainingTrainingCredits <= 0 ||
                      (isTrainingCreditsThirtyDayPayment &&
                        !hasActiveTrainingCreditWindow)
                    }
                    title={
                      remainingTrainingCredits <= 0
                        ? "Няма оставащи тренировки"
                        : isTrainingCreditsThirtyDayPayment &&
                            !hasActiveTrainingCreditWindow
                          ? "30-дневният срок е изтекъл"
                          : undefined
                    }
                  >
                    {trainingCreditLoading
                      ? "Чекиране..."
                      : "Чекирай тренировка"}
                  </button>
                )}
                {!isRollingThirtyDayPayment &&
                  !isTrainingCreditBasedPayment && (
                    <button
                      className="add-btn member-action-btn payment-delete-btn"
                      onClick={openPaymentDeleteModal}
                      disabled={(member.paymentLogs?.length ?? 0) === 0}
                    >
                      Изтрий плащане
                    </button>
                  )}
              </>
              {!isRollingThirtyDayPayment && !isTrainingCreditBasedPayment && (
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
                  Архивирай
                </button>
              )}
              {trainingCreditError && (
                <p className="training-credit-error">{trainingCreditError}</p>
              )}
              {trainingCreditSuccess && (
                <p className="training-credit-success">
                  {trainingCreditSuccess}
                </p>
              )}
            </>
          )}

          {member.onlinePaymentEnabled && (
            <button
              className="pay-btn"
              onClick={openPaymentModal}
              title={
                hasActiveRollingPayment
                  ? `Остават ${rollingRemainingText}`
                  : hasActiveTrainingCreditsThirtyDayPayment
                    ? `Остават ${remainingTrainingCredits} тренировки и ${rollingRemainingText}`
                    : undefined
              }
            >
              Плати онлайн
            </button>
          )}

          <button
            className="add-btn member-action-btn training-schedule-btn"
            onClick={() => void openTrainingModal()}
          >
            График
          </button>

          {(member.clubRulesDocuments?.length ?? 0) > 0 && (
            <button
              className="add-btn member-action-btn rules-btn"
              onClick={() => setRulesOpen(true)}
              type="button"
            >
              Правилници
            </button>
          )}

          {canPublicEdit &&
            (trainingLoading ? (
              <p className="training-next-hint">
                Зареждане на следваща тренировка...
              </p>
            ) : nextScheduleEvent && nextScheduleCountdown ? (
              <div
                className={`training-next-card${nextScheduleEvent.type === "match" ? " training-next-card--match" : ""}`}
              >
                <p className="training-next-title">
                  {nextScheduleEvent.type === "match"
                    ? nextScheduleEvent.eventLabel
                    : "Следваща тренировка"}
                  : {formatIsoDateForBgDisplay(nextScheduleEvent.date)}
                  {nextScheduleEvent.time ? ` ${nextScheduleEvent.time}` : ""}
                  {nextScheduleEvent.type === "match" &&
                  nextScheduleEvent.opponent
                    ? ` срещу ${nextScheduleEvent.opponent}`
                    : ""}
                </p>
                <p
                  className={`training-next-countdown${nextScheduleEvent.type === "match" ? " training-next-countdown--match" : ""}`}
                >
                  {`${String(nextScheduleCountdown.days).padStart(2, "0")}:${String(nextScheduleCountdown.hours).padStart(2, "0")}:${String(nextScheduleCountdown.minutes).padStart(2, "0")}:${String(nextScheduleCountdown.seconds).padStart(2, "0")}`}
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
              <span className="push-enabled-check" aria-hidden="true">
                ✓
              </span>
              <span className="push-enabled-text">
                Известията са активирани
              </span>
            </div>
          )}

          {canUseNotifications &&
            (!isIPhoneDevice || isStandaloneMode) &&
            (isPushEnabled ? (
              <button
                className="bell-btn bell-btn--disable"
                onClick={handleDisablePushNotifications}
                disabled={isEnablingPush}
              >
                {isEnablingPush ? (
                  <SpinnerIcon size={16} />
                ) : (
                  <BellOffIcon size={16} />
                )}
                {isEnablingPush ? "Изключване..." : "Изключване на известия"}
              </button>
            ) : (
              <button
                className="bell-btn"
                onClick={handleEnablePushNotifications}
                disabled={isEnablingPush}
              >
                {isEnablingPush ? (
                  <SpinnerIcon size={16} />
                ) : (
                  <BellIcon size={16} />
                )}
                {isEnablingPush ? "Активиране..." : "Активиране на известия"}
              </button>
            ))}

          {canUseNotifications && isIPhoneDevice && !isStandaloneMode && (
            <>
              <button
                className="add-btn add-btn--white-text"
                onClick={() => setInstructionsOpen((v) => !v)}
              >
                <ShareIcon size={16} />
                Добавете към начален екран
              </button>

              <p className="hint-text">
                За да активирате известията на iPhone, натиснете бутона Share и
                изберете &ldquo;Добавяне към начален екран&rdquo;.
              </p>

              {instructionsOpen && (
                <div className="instr-box">
                  <button
                    className="instr-close"
                    onClick={() => setInstructionsOpen(false)}
                    aria-label="Затвори"
                  >
                    <XIcon />
                  </button>
                  <p className="instr-heading">
                    Как да активирате известия на iPhone:
                  </p>
                  <ol className="instr-list">
                    <li>
                      <span className="step-badge">1</span>
                      <span>
                        Натиснете бутона <ShareIcon size={14} />{" "}
                        <strong>Share</strong> в долната лента на Safari
                      </span>
                    </li>
                    <li>
                      <span className="step-badge">2</span>
                      <span>
                        Превъртете надолу и изберете <PlusIcon />{" "}
                        <strong>
                          &ldquo;Добавяне към начален екран&rdquo;
                        </strong>
                      </span>
                    </li>
                    <li>
                      <span className="step-badge">3</span>
                      <span>
                        Отворете приложението от началния екран и натиснете{" "}
                        <strong>&ldquo;Активиране на известия&rdquo;</strong>
                      </span>
                    </li>
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        {canUseNotifications && !isPushEnabled && (
          <p className="push-hint">
            Получавайте push известия дори когато браузърът е затворен.
          </p>
        )}

        {canUseNotifications && pushStatusMessage && (
          <p
            className="push-hint"
            style={{
              color: pushStatusTone === "danger" ? "#ff8f8f" : "#32cd32",
              marginTop: "6px",
            }}
          >
            {pushStatusMessage}
          </p>
        )}
        {canUseNotifications && pushErrorMessage && (
          <p
            className="push-hint"
            style={{ color: "#ff6b6b", marginTop: "6px" }}
          >
            {pushErrorMessage}
          </p>
        )}

        {/* Payment history accordion */}
        <div className="accordion" style={{ marginTop: "14px" }}>
          <button
            className="accordion-btn"
            onClick={() => setAccordionOpen((v) => !v)}
          >
            <span>
              История на плащания
              <span className="acc-count">
                {" "}
                ({member.paymentLogs?.length ?? 0})
              </span>
            </span>
            <svg
              className={`chevron${accordionOpen ? " open" : ""}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
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
                            {formatPaymentPeriod(item.paidFor)}
                          </p>
                          <p className="p-date">
                            {new Date(item.paidAt).toLocaleDateString("bg-BG")}
                          </p>
                        </div>
                        <button
                          className="receipt-btn"
                          onClick={() => setSelectedReceipt(item)}
                        >
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

        {/* ── Dynamic discount modal ── */}
        <MemberDiscountDialog
          activeDiscount={activeDiscount}
          setActiveDiscount={setActiveDiscount}
          activeDiscountCodeCopied={activeDiscountCodeCopied}
          setActiveDiscountCodeCopied={setActiveDiscountCodeCopied}
          trackDiscount={trackDiscount}
        />

        {/* ── Rules modal ── */}
        <MemberRulesDialog
          rulesOpen={rulesOpen}
          setRulesOpen={setRulesOpen}
          member={member}
          normalizedCardCode={normalizedCardCode}
        />

        {/* ── All Discounts modal ── */}
        <MemberDiscountsDialog
          allDiscountsModalOpen={allDiscountsModalOpen}
          setAllDiscountsModalOpen={setAllDiscountsModalOpen}
          member={member}
          setActiveDiscount={setActiveDiscount}
          trackDiscount={trackDiscount}
        />

        <MemberTrainingDialog
          trainingModalOpen={trainingModalOpen}
          closeTrainingModal={closeTrainingModal}
          trainingLoading={trainingLoading}
          trainingDays={trainingDays}
          memberMatches={memberMatches}
          setTrainingCalendarMonth={setTrainingCalendarMonth}
          trainingMonths={trainingMonths}
          trainingByDate={trainingByDate}
          matchesByDate={matchesByDate}
          todayDateKey={todayDateKey}
          setMatchDetailsMatch={setMatchDetailsMatch}
          setMatchDetailsPopupOpen={setMatchDetailsPopupOpen}
          trainingSavingDate={trainingSavingDate}
          setTrainingDetailsDate={setTrainingDetailsDate}
          setTrainingDayPopupTab={setTrainingDayPopupTab}
          setTrainingAttendancePopupOpen={setTrainingAttendancePopupOpen}
          trainingError={trainingError}
          trainingAttendancePopupOpen={trainingAttendancePopupOpen}
          trainingDetailsItem={trainingDetailsItem}
          trainingDetailsMatches={trainingDetailsMatches}
          trainingDayPopupTab={trainingDayPopupTab}
          normalizedCardCode={normalizedCardCode}
          fetchTrainingDays={fetchTrainingDays}
          isTrainingCreditBasedPayment={isTrainingCreditBasedPayment}
          member={member}
          registerError={registerError}
          registerSavingEventId={registerSavingEventId}
          setRegisterSavingEventId={setRegisterSavingEventId}
          setRegisterError={setRegisterError}
          setTrainingOptOutReasonCode={setTrainingOptOutReasonCode}
          setTrainingOptOutReasonText={setTrainingOptOutReasonText}
          setTrainingConfirmSession={setTrainingConfirmSession}
          setTrainingConfirmAction={setTrainingConfirmAction}
          setTrainingConfirmModalOpen={setTrainingConfirmModalOpen}
          fetchMemberMatches={fetchMemberMatches}
          trainingDaysWithNotes={trainingDaysWithNotes}
        />

        {matchDetailsPopupOpen && matchDetailsMatch && (
          <MemberMatchDetailsModal
            match={matchDetailsMatch}
            matches={memberMatches.filter(
              (match) => match.matchDate === matchDetailsMatch.matchDate,
            )}
            cardCode={normalizedCardCode}
            onSelect={setMatchDetailsMatch}
            onClose={() => setMatchDetailsPopupOpen(false)}
            onSaved={fetchMemberMatches}
          />
        )}

        <MemberTrainingConfirmationDialog
          trainingConfirmModalOpen={trainingConfirmModalOpen}
          trainingConfirmAction={trainingConfirmAction}
          trainingDetailsItem={trainingDetailsItem}
          setTrainingConfirmModalOpen={setTrainingConfirmModalOpen}
          setTrainingConfirmAction={setTrainingConfirmAction}
          setTrainingOptOutReasonCode={setTrainingOptOutReasonCode}
          setTrainingOptOutReasonText={setTrainingOptOutReasonText}
          trainingOptOutReasonCode={trainingOptOutReasonCode}
          trainingOptOutReasonText={trainingOptOutReasonText}
          trainingSavingDate={trainingSavingDate}
          setTrainingError={setTrainingError}
          handleTrainingAttendanceConfirm={handleTrainingAttendanceConfirm}
          isOptOutReasonReady={isOptOutReasonReady}
        />

        <MemberProfileEditorDialog
          editModalOpen={editModalOpen}
          editSaving={editSaving}
          setEditModalOpen={setEditModalOpen}
          editForm={editForm}
          setEditForm={setEditForm}
          member={member}
          setEditImageFile={setEditImageFile}
          editImagePreviewUrl={editImagePreviewUrl}
          editError={editError}
          handleSavePublicEdit={handleSavePublicEdit}
        />

        {/* ══ PAYMENT MODAL ══ */}
        <MemberPaymentDialog
          paymentModalOpen={paymentModalOpen}
          paymentLoading={paymentLoading}
          setPaymentModalOpen={setPaymentModalOpen}
          paymentDeleteConfirmOpen={paymentDeleteConfirmOpen}
          member={member}
          selectedPaymentDeleteMonths={selectedPaymentDeleteMonths}
          paymentError={paymentError}
          setPaymentDeleteConfirmOpen={setPaymentDeleteConfirmOpen}
          setPaymentError={setPaymentError}
          handleDeletePayments={handleDeletePayments}
          paymentModalMode={paymentModalMode}
          isTrainingCreditBasedPayment={isTrainingCreditBasedPayment}
          remainingTrainingCredits={remainingTrainingCredits}
          isTrainingCreditsThirtyDayPayment={isTrainingCreditsThirtyDayPayment}
          hasActiveTrainingCreditWindow={hasActiveTrainingCreditWindow}
          rollingPaymentWindow={rollingPaymentWindow}
          canManagePayments={canManagePayments}
          paymentTrainingCredits={paymentTrainingCredits}
          setPaymentTrainingCredits={setPaymentTrainingCredits}
          hasActiveTrainingCreditsThirtyDayPayment={
            hasActiveTrainingCreditsThirtyDayPayment
          }
          isRollingThirtyDayPayment={isRollingThirtyDayPayment}
          hasActiveRollingPayment={hasActiveRollingPayment}
          rollingRemainingText={rollingRemainingText}
          paymentModalYM={paymentModalYM}
          setCalendarYear={setCalendarYear}
          calendarYear={calendarYear}
          getMonthState={getMonthState}
          selectedYM={selectedYM}
          handleMonthClick={handleMonthClick}
          irisPayment={irisPayment}
          handleIrisStatusCheck={handleIrisStatusCheck}
          irisStatusLoading={irisStatusLoading}
          viewerRoleChecked={viewerRoleChecked}
          handleIrisPayment={handleIrisPayment}
          irisPaymentLoading={irisPaymentLoading}
          handlePayment={handlePayment}
        />

        {/* ══ NOTIFICATIONS PANEL ══ */}
        <MemberPauseDialog
          pauseModalOpen={pauseModalOpen}
          pauseActionLoading={pauseActionLoading}
          setPauseModalOpen={setPauseModalOpen}
          member={member}
          setCalendarYear={setCalendarYear}
          calendarYear={calendarYear}
          paidSet={paidSet}
          waivedSet={waivedSet}
          selectedPauseKeys={selectedPauseKeys}
          togglePauseMonth={togglePauseMonth}
          pauseReason={pauseReason}
          setPauseReason={setPauseReason}
          pauseError={pauseError}
          handleManagePauseMonths={handleManagePauseMonths}
          canRemovePause={canRemovePause}
          canApplyPause={canApplyPause}
        />

        <MemberNotificationsDialog
          canUseNotifications={canUseNotifications}
          notificationsPanelOpen={notificationsPanelOpen}
          setNotificationsPanelOpen={setNotificationsPanelOpen}
          loadingNotifications={loadingNotifications}
          notifications={notifications}
          setBirthdayCardOpen={setBirthdayCardOpen}
        />

        <MemberBirthdayDialog
          birthdayCardOpen={birthdayCardOpen}
          member={member}
          setBirthdayCardOpen={setBirthdayCardOpen}
        />

        <MemberReceiptDialog
          selectedReceipt={selectedReceipt}
          setSelectedReceipt={setSelectedReceipt}
          member={member}
          formatReceiptPeriod={formatReceiptPeriod}
          handlePrintReceipt={handlePrintReceipt}
        />
      </div>
    </main>
  );
}

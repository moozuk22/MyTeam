"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractUploadPathFromCloudinaryUrl } from "@/lib/cloudinaryImagePath";
import { uploadImage, validateImageFile } from "@/lib/uploadImage";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import "./page.css";

import {
  AttendanceDashboard,
  ReportsDialog,
  MemberDetailModal,
  ConfirmDeleteModal,
  PlayerCard,
  InactivePlayersModal,
  ConfirmPermanentDeleteModal,
  ConfirmDeleteTeamModal,
  ImportFromSheetsModal,
  ImportPhotosFromDriveModal,
  ConfirmDeleteTrainingGroupModal,
  ConfirmNewCardModal,
  ArrowLeftIcon,
  SearchIcon,
  XIcon,
  PlusIcon,
  TrashIcon,
  BellIcon,
  BellOffIcon,
  SpinnerIcon,
  ShareIcon,
  ImportSheetsIcon,
  PhotoImportIcon,
  CalendarIcon,
  ChartColumnIcon,
  PencilIcon,
  UsersIcon,
  ClipboardListIcon,
  DownloadIcon,
  DEFAULT_TRAINING_DURATION_MINUTES,
  TRAINING_WEEKDAY_SHORT_BG,
  TRAINING_WEEKDAY_LONG_BG,
  TRAINING_TIME_REGEX,
  normalizeMember,
  getTodayIsoDate,
  formatBirthDateForExport,
  formatIsoDateForDisplay,
  getNextTrainingCalendarDates,
  getWeekdayMondayFirstIndex,
  normalizeTrainingDateTimes,
  getUniformTrainingTime,
  normalizeTrainingDurationInput,
  getTrainingDurationFormValue,
  normalizeOptionalId,
  normalizeTrainingFieldSelections,
  inferTrainingTimeMode,
  parseSelectedTeamGroup,
  urlBase64ToUint8Array,
  buildCalendarMonths,
} from "./_components/members-page-components";
import type {
  Member,
  ClubOption,
  CoachGroup,
  MemberNotification,
  TrainingAttendancePlayer,
  TrainingUpcomingDateItem,
  TrainingScheduleGroup,
  CustomTrainingGroup,
  TrainingFieldSelection,
  TrainingField,
  TrainingTimeMode,
  TrainingDaysStep,
  TrainingTodaySessionItem,
} from "./_components/members-page-components";

/* ── Main Page ── */
function getMonthKeyFromIsoDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : getTodayIsoDate().slice(0, 7);
}

function addMonthsToMonthKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map((value) => Number.parseInt(value, 10));
  const base = new Date(Date.UTC(Number.isInteger(year) ? year : 1970, Number.isInteger(month) ? month - 1 : 0, 1));
  base.setUTCMonth(base.getUTCMonth() + delta);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getCalendarDatesForMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map((value) => Number.parseInt(value, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) =>
    `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
}

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
  const [clubBillingStatus, setClubBillingStatus] = useState<string>("");
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
  const [thirdReminderEnabled, setThirdReminderEnabled] = useState(false);
  const [schedulerForm, setSchedulerForm] = useState({
    reminderDay: "25",
    overdueDay: "1",
    reminderHour: "10",
    reminderMinute: "0",
    secondReminderDay: "",
    secondReminderHour: "10",
    secondReminderMinute: "0",
    thirdReminderDay: "",
    thirdReminderHour: "10",
    thirdReminderMinute: "0",
    overdueHour: "10",
    overdueMinute: "0",
    trainingDates: [] as string[],
    trainingTime: "",
    trainingDurationMinutes: String(DEFAULT_TRAINING_DURATION_MINUTES),
    trainingFieldId: "",
    trainingFieldPieceIds: [] as string[],
  });
  const [trainingDateTimes, setTrainingDateTimes] = useState<Record<string, string>>({});
  const [trainingFieldSelections, setTrainingFieldSelections] = useState<Record<string, TrainingFieldSelection>>({});
  const [trainingDaysInitialDateTimes, setTrainingDaysInitialDateTimes] = useState<Record<string, string>>({});
  const [trainingDaysInitialFieldSelections, setTrainingDaysInitialFieldSelections] = useState<Record<string, TrainingFieldSelection>>({});
  const [trainingTimeMode, setTrainingTimeMode] = useState<TrainingTimeMode>("all");
  const reminderTimeValue = `${schedulerForm.reminderHour.padStart(2, "0")}:${schedulerForm.reminderMinute.padStart(2, "0")}`;
  const secondReminderTimeValue = `${schedulerForm.secondReminderHour.padStart(2, "0")}:${schedulerForm.secondReminderMinute.padStart(2, "0")}`;
  const thirdReminderTimeValue = `${schedulerForm.thirdReminderHour.padStart(2, "0")}:${schedulerForm.thirdReminderMinute.padStart(2, "0")}`;
  const overdueTimeValue = `${schedulerForm.overdueHour.padStart(2, "0")}:${schedulerForm.overdueMinute.padStart(2, "0")}`;
  const [trainingAttendanceOpen, setTrainingAttendanceOpen] = useState(false);
  const [trainingAttendanceView, setTrainingAttendanceView] = useState<"teamGroup" | "trainingGroups" | "today">("teamGroup");
  const [trainingAttendanceLoading, setTrainingAttendanceLoading] = useState(false);
  const [trainingAttendanceError, setTrainingAttendanceError] = useState("");
  const [trainingAttendanceDate, setTrainingAttendanceDate] = useState(getTodayIsoDate());
  const [trainingAttendanceMonth, setTrainingAttendanceMonth] = useState(getTodayIsoDate().slice(0, 7));
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
  const [trainingDayDurationMinutes, setTrainingDayDurationMinutes] = useState(DEFAULT_TRAINING_DURATION_MINUTES);
  const [trainingDayField, setTrainingDayField] = useState<{ id: string; name: string; pieces: { id: string; name: string }[] } | null>(null);
  const [trainingDayFieldPieceIds, setTrainingDayFieldPieceIds] = useState<string[]>([]);
  const [trainingDaysEditorOpen, setTrainingDaysEditorOpen] = useState(false);
  const [trainingDaysEditorLoading, setTrainingDaysEditorLoading] = useState(false);
  const [trainingDaysEditorSaving, setTrainingDaysEditorSaving] = useState(false);
  const [trainingDaysEditorError, setTrainingDaysEditorError] = useState("");
  const [trainingDaysActiveStep, setTrainingDaysActiveStep] = useState<TrainingDaysStep>("days");
  const [trainingFieldActiveDate, setTrainingFieldActiveDate] = useState("");
  const [trainingDaysInitialDates, setTrainingDaysInitialDates] = useState<string[]>([]);
  const [trainingDaysInitialDurationMinutes, setTrainingDaysInitialDurationMinutes] = useState(DEFAULT_TRAINING_DURATION_MINUTES);
  const [trainingDaysInitialFieldId, setTrainingDaysInitialFieldId] = useState("");
  const [trainingDaysInitialFieldPieceIds, setTrainingDaysInitialFieldPieceIds] = useState<string[]>([]);
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
  const [customGroupCreateSearch, setCustomGroupCreateSearch] = useState("");
  const [trainingGroupEditOpen, setTrainingGroupEditOpen] = useState(false);
  const [trainingGroupEditSaving, setTrainingGroupEditSaving] = useState(false);
  const [trainingGroupEditError, setTrainingGroupEditError] = useState("");
  const [trainingGroupDeleteConfirmOpen, setTrainingGroupDeleteConfirmOpen] = useState(false);
  const [trainingGroupDeleteSaving, setTrainingGroupDeleteSaving] = useState(false);
  const [trainingGroupEditId, setTrainingGroupEditId] = useState("");
  const [trainingGroupEditName, setTrainingGroupEditName] = useState("");
  const [trainingGroupEditGroups, setTrainingGroupEditGroups] = useState<string[]>([]);
  const [trainingGroupEditPlayerIds, setTrainingGroupEditPlayerIds] = useState<string[]>([]);
  const [customGroupEditSearch, setCustomGroupEditSearch] = useState("");
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
  const [trainingFields, setTrainingFields] = useState<TrainingField[]>([]);
  const [trainingFieldsLoading, setTrainingFieldsLoading] = useState(false);
  const [fieldConflictsMap, setFieldConflictsMap] = useState<Record<string, { blockedPieceIds: string[]; wholeFieldBlocked: boolean }>>({});
  const [fieldConflictsLoading, setFieldConflictsLoading] = useState(false);
  const [trainingFieldModalOpen, setTrainingFieldModalOpen] = useState(false);
  const [trainingFieldSaving, setTrainingFieldSaving] = useState(false);
  const [trainingFieldError, setTrainingFieldError] = useState("");
  const [trainingFieldEditId, setTrainingFieldEditId] = useState<string | null>(null);
  const [trainingFieldName, setTrainingFieldName] = useState("");
  const [trainingFieldPieces, setTrainingFieldPieces] = useState<Array<{ id: string | null; name: string }>>([]);
  const schedulerCalendarDates = getNextTrainingCalendarDates();
  const schedulerCalendarDateSet = new Set(schedulerCalendarDates);
  const schedulerCalendarMonths = buildCalendarMonths(schedulerCalendarDates);
  const trainingUpcomingDateSet = new Set(trainingUpcomingDates.map((item) => item.date));
  const trainingUpcomingByDate = new Map(trainingUpcomingDates.map((item) => [item.date, item]));
  const trainingAttendanceCalendarDates = getCalendarDatesForMonth(trainingAttendanceMonth);
  const trainingAttendanceCalendarMonths = buildCalendarMonths(trainingAttendanceCalendarDates);
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

          const billing = (selectedClub as Record<string, unknown>).billingStatus;
          setClubBillingStatus(typeof billing === "string" ? billing : "");

          const logo = (selectedClub as Record<string, unknown>).imageUrl;
          if (typeof logo === "string" && logo) {
            setClubLogoUrl(logo);
          } else {
            setClubLogoUrl(null);
          }
        } else {
          setClubName("Всички отбори");
          setClubBillingStatus("");
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
        const billing = (selectedClub as Record<string, unknown> | null)?.billingStatus;
        setClubBillingStatus(typeof billing === "string" ? billing : "");
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
  const fieldConflictsFetchParams = useMemo<string | null>(() => {
    if (!trainingDaysEditorOpen || trainingDaysEditorMode === "createGroup" || !clubId) return null;
    const datesArr = [...schedulerForm.trainingDates].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (datesArr.length === 0) return null;
    const effectiveTimes: Record<string, string> = {};
    const fallback = trainingTimeMode === "all" ? schedulerForm.trainingTime.trim() : "";
    for (const date of datesArr) {
      const t = ((trainingDateTimes as Record<string, unknown>)[date] as string | undefined)?.trim() ?? fallback;
      if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
        effectiveTimes[date] = t;
      }
    }
    const dur = Math.max(1, Math.min(1440, Number.parseInt(schedulerForm.trainingDurationMinutes, 10) || 60));
    const params = new URLSearchParams();
    params.set("dates", datesArr.join(","));
    if (Object.keys(effectiveTimes).length > 0) {
      params.set("dateTimes", JSON.stringify(effectiveTimes));
    }
    params.set("duration", String(dur));
    if (trainingDaysEditorMode === "trainingGroup" && selectedTrainingGroupId) {
      params.set("excludeType", "trainingGroup");
      params.set("excludeId", selectedTrainingGroupId);
    } else if (trainingDaysEditorMode === "customGroup" && selectedTrainingGroupId) {
      params.set("excludeType", "customGroup");
      params.set("excludeId", selectedTrainingGroupId);
    } else if (trainingDaysEditorMode === "coachGroup" && coachGroupId) {
      params.set("excludeType", "coachGroup");
      params.set("excludeId", coachGroupId);
    } else if (trainingDaysEditorMode === "teamGroup") {
      if (selectedTeamGroup !== null) {
        params.set("excludeType", "teamGroup");
        params.set("excludeTeamGroup", String(selectedTeamGroup));
        params.set("excludeTeamGroups", String(selectedTeamGroup));
      } else {
        params.set("excludeType", "club");
      }
    }
    return params.toString();
  }, [trainingDaysEditorOpen, trainingDaysEditorMode, clubId, schedulerForm.trainingDates, schedulerForm.trainingDurationMinutes, schedulerForm.trainingTime, trainingDateTimes, trainingTimeMode, selectedTrainingGroupId, coachGroupId, selectedTeamGroup]);

  useEffect(() => {
    if (!fieldConflictsFetchParams || !clubId) {
      setFieldConflictsMap({});
      return;
    }
    let cancelled = false;
    setFieldConflictsLoading(true);
    const run = async () => {
      try {
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/field-conflicts?${fieldConflictsFetchParams}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (!response.ok) {
          setFieldConflictsMap({});
          return;
        }
        const payload = await response.json() as { occupiedResources?: unknown[] };
        if (cancelled) return;
        const occupied = Array.isArray(payload?.occupiedResources) ? payload.occupiedResources as Array<{ date?: string; fieldId: string; pieceIds: string[] }> : [];
        const map: Record<string, { blockedPieceIds: string[]; wholeFieldBlocked: boolean }> = {};
        for (const field of trainingFields) {
          const relevant = occupied.filter((r) => r.fieldId === field.id && (!r.date || r.date === trainingFieldActiveDate));
          if (relevant.length === 0) continue;
          const blockedSet = new Set<string>();
          for (const r of relevant) {
            if (r.pieceIds.length === 0) {
              for (const piece of field.pieces) blockedSet.add(piece.id);
            } else {
              for (const pid of r.pieceIds) blockedSet.add(pid);
            }
          }
          map[field.id] = { blockedPieceIds: Array.from(blockedSet), wholeFieldBlocked: true };
        }
        setFieldConflictsMap(map);
      } catch {
        if (!cancelled) setFieldConflictsMap({});
      } finally {
        if (!cancelled) setFieldConflictsLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [fieldConflictsFetchParams, clubId, trainingFields, trainingFieldActiveDate]);
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
  const filteredPlayersForCustomGroupCreate = customGroupCreateSearch.trim()
    ? availablePlayersForCustomGroupCreate.filter((m) =>
        m.fullName.toLowerCase().includes(customGroupCreateSearch.toLowerCase()),
      )
    : availablePlayersForCustomGroupCreate;
  const filteredPlayersForCustomGroupEdit = customGroupEditSearch.trim()
    ? availablePlayersForCustomGroupEdit.filter((m) =>
        m.fullName.toLowerCase().includes(customGroupEditSearch.toLowerCase()),
      )
    : availablePlayersForCustomGroupEdit;
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
  const activeTrainingFieldSelection = trainingFieldSelections[trainingFieldActiveDate] ?? { trainingFieldId: "", trainingFieldPieceIds: [] };
  const selectedActiveTrainingField = trainingFields.find((field) => field.id === activeTrainingFieldSelection.trainingFieldId) ?? null;
  const hasMissingTrainingField =
    trainingDaysEditorMode !== "createGroup" &&
    trainingFields.length > 0 &&
    schedulerForm.trainingDates.length > 0 &&
    schedulerForm.trainingDates.some((date) => !trainingFieldSelections[date]?.trainingFieldId);
  const missingTrainingFieldDates = schedulerForm.trainingDates
    .map((value) => String(value ?? "").trim())
    .filter((date) => schedulerCalendarDateSet.has(date) && !trainingFieldSelections[date]?.trainingFieldId)
    .sort((a, b) => a.localeCompare(b));
  const missingTrainingFieldMessage =
    missingTrainingFieldDates.length === 0
      ? "Трябва да изберете терен"
      : `Трябва да изберете терен за: ${missingTrainingFieldDates.map((date) => formatIsoDateForDisplay(date)).join(", ")}`;
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
  const parsedTrainingDurationSelection = Number.parseInt(schedulerForm.trainingDurationMinutes.trim(), 10);
  const normalizedTrainingDurationSelection = Number.isInteger(parsedTrainingDurationSelection)
    ? parsedTrainingDurationSelection
    : DEFAULT_TRAINING_DURATION_MINUTES;
  const hasInvalidTrainingDuration =
    trainingDaysEditorMode !== "createGroup" &&
    (!/^\d+$/.test(schedulerForm.trainingDurationMinutes.trim()) ||
      normalizedTrainingDurationSelection < 1 ||
      normalizedTrainingDurationSelection > 1440);
  const canShowTrainingDaysTimeStep =
    trainingDaysEditorMode !== "createGroup" &&
    normalizedTrainingDaysSelection.length > 0;
  const canShowTrainingDaysFieldStep =
    canShowTrainingDaysTimeStep &&
    !hasMissingTrainingTime &&
    !hasInvalidTrainingDuration;
  const effectiveTrainingDaysActiveStep: TrainingDaysStep =
    trainingDaysEditorMode === "createGroup"
      ? "days"
      : trainingDaysActiveStep === "field" && !canShowTrainingDaysFieldStep
        ? canShowTrainingDaysTimeStep
          ? "time"
          : "days"
        : trainingDaysActiveStep === "time" && !canShowTrainingDaysTimeStep
          ? "days"
          : trainingDaysActiveStep;
  const trainingWeekdayBuckets = Array.from(
    new Set(
      normalizedTrainingDaysSelection
        .map((date) => getWeekdayMondayFirstIndex(date))
        .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6),
    ),
  ).sort((a, b) => a - b);
  const trainingDaysSummaryText =
    normalizedTrainingDaysSelection.length === 0
      ? "Няма избрани дни"
      : normalizedTrainingDaysSelection.length <= 4
        ? normalizedTrainingDaysSelection.map((date) => formatIsoDateForDisplay(date)).join(", ")
        : `${normalizedTrainingDaysSelection.slice(0, 4).map((date) => formatIsoDateForDisplay(date)).join(", ")} + още ${normalizedTrainingDaysSelection.length - 4}`;
  const trainingTimeSummaryText = hasMissingTrainingTime
    ? "Няма въведен валиден час"
    : trainingTimeMode === "all"
      ? `Всички тренировки: ${schedulerForm.trainingTime.trim()}`
      : trainingTimeMode === "byWeekday"
        ? `По седмични дни: ${trainingWeekdayBuckets.map((weekdayIndex) => {
            const weekdayDate = normalizedTrainingDaysSelection.find(
              (date) => getWeekdayMondayFirstIndex(date) === weekdayIndex,
            );
            const weekdayTime = weekdayDate ? normalizedTrainingDateTimesSelection[weekdayDate] : "";
            return `${TRAINING_WEEKDAY_LONG_BG[weekdayIndex] ?? `#${weekdayIndex + 1}`} ${weekdayTime}`;
          }).join(", ")}`
        : normalizedTrainingDaysSelection.length <= 3
          ? `Индивидуално: ${normalizedTrainingDaysSelection.map((date) => `${formatIsoDateForDisplay(date)} ${normalizedTrainingDateTimesSelection[date] ?? ""}`).join(", ")}`
          : `Индивидуални часове за ${normalizedTrainingDaysSelection.length} тренировки`;
  const trainingDurationSummaryText = hasInvalidTrainingDuration
    ? "Невалидна продължителност"
    : `${normalizedTrainingDurationSelection} мин.`;
  const primaryTrainingFieldSelection =
    normalizedTrainingDaysSelection.map((date) => trainingFieldSelections[date]).find((selection) => selection?.trainingFieldId) ??
    { trainingFieldId: null, trainingFieldPieceIds: [] };
  const showTrainingStepBack =
    trainingDaysEditorMode !== "createGroup" &&
    effectiveTrainingDaysActiveStep !== "days";
  const showTrainingStepNext =
    trainingDaysEditorMode !== "createGroup" &&
    effectiveTrainingDaysActiveStep !== "field";
  const isTrainingStepNextDisabled =
    trainingDaysEditorSaving ||
    (effectiveTrainingDaysActiveStep === "days" && !canShowTrainingDaysTimeStep) ||
    (effectiveTrainingDaysActiveStep === "time" && !canShowTrainingDaysFieldStep);
  const normalizedTrainingDateTimesSelectionKey = normalizedTrainingDaysSelection
    .map((date) => `${date}:${normalizedTrainingDateTimesSelection[date] ?? ""}`)
    .join("|");
  const normalizedTrainingDateTimesInitialKey = normalizedTrainingDaysInitial
    .map((date) => `${date}:${normalizedTrainingDateTimesInitial[date] ?? ""}`)
    .join("|");
  const normalizedTrainingFieldSelectionsKey = normalizedTrainingDaysSelection
    .map((date) => {
      const selection = trainingFieldSelections[date];
      return `${date}:${selection?.trainingFieldId ?? ""}:${[...(selection?.trainingFieldPieceIds ?? [])].sort().join(",")}`;
    })
    .join("|");
  const normalizedTrainingFieldSelectionsInitialKey = normalizedTrainingDaysInitial
    .map((date) => {
      const selection = trainingDaysInitialFieldSelections[date];
      return `${date}:${selection?.trainingFieldId ?? ""}:${[...(selection?.trainingFieldPieceIds ?? [])].sort().join(",")}`;
    })
    .join("|");
  const isTrainingDaysScheduleUnchanged =
    trainingDaysEditorMode !== "createGroup" &&
    normalizedTrainingDaysSelection.join("|") === normalizedTrainingDaysInitial.join("|") &&
    normalizedTrainingDateTimesSelectionKey === normalizedTrainingDateTimesInitialKey &&
    normalizedTrainingDurationSelection === trainingDaysInitialDurationMinutes &&
    normalizedTrainingFieldSelectionsKey === normalizedTrainingFieldSelectionsInitialKey;
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
    setTrainingFieldSelections((prev) => {
      const next: Record<string, TrainingFieldSelection> = {};
      for (const date of schedulerForm.trainingDates) {
        if (prev[date]) next[date] = prev[date];
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    if (schedulerForm.trainingDates.length > 0 && !schedulerForm.trainingDates.includes(trainingFieldActiveDate)) {
      setTrainingFieldActiveDate(schedulerForm.trainingDates[0]);
    }
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
    setThirdReminderEnabled(false);
    setSchedulerForm((prev) => ({
      ...prev,
      secondReminderDay: "",
      secondReminderHour: "10",
      secondReminderMinute: "0",
      thirdReminderDay: "",
      thirdReminderHour: "10",
      thirdReminderMinute: "0",
    }));
  };

  const enableThirdReminder = () => {
    setThirdReminderEnabled(true);
    setSchedulerForm((prev) => {
      const usedDays = [
        Number.parseInt(prev.reminderDay, 10),
        Number.parseInt(prev.secondReminderDay, 10),
      ].filter((day) => Number.isInteger(day) && day >= 1 && day <= 28);
      const fallbackDay = Array.from({ length: 28 }, (_, index) => index + 1).find((day) => !usedDays.includes(day)) ?? 27;
      return {
        ...prev,
        thirdReminderDay: prev.thirdReminderDay || String(fallbackDay),
        thirdReminderHour: prev.thirdReminderHour || "10",
        thirdReminderMinute: prev.thirdReminderMinute || "0",
      };
    });
  };

  const disableThirdReminder = () => {
    setThirdReminderEnabled(false);
    setSchedulerForm((prev) => ({
      ...prev,
      thirdReminderDay: "",
      thirdReminderHour: "10",
      thirdReminderMinute: "0",
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
      const hasThirdReminder =
        Number.isInteger(payload.thirdReminderDay) &&
        Number.isInteger(payload.thirdReminderHour) &&
        Number.isInteger(payload.thirdReminderMinute);
      setSchedulerForm({
        reminderDay: String(payload.reminderDay ?? 25),
        overdueDay: String(payload.overdueDay ?? 1),
        reminderHour: String(payload.reminderHour ?? 10),
        reminderMinute: String(payload.reminderMinute ?? 0),
        secondReminderDay: hasSecondReminder ? String(payload.secondReminderDay) : "",
        secondReminderHour: hasSecondReminder ? String(payload.secondReminderHour) : "10",
        secondReminderMinute: hasSecondReminder ? String(payload.secondReminderMinute) : "0",
        thirdReminderDay: hasThirdReminder ? String(payload.thirdReminderDay) : "",
        thirdReminderHour: hasThirdReminder ? String(payload.thirdReminderHour) : "10",
        thirdReminderMinute: hasThirdReminder ? String(payload.thirdReminderMinute) : "0",
        overdueHour: String(payload.overdueHour ?? 10),
        overdueMinute: String(payload.overdueMinute ?? 0),
        trainingDates: resolvedTrainingDates,
        trainingTime: resolvedUniformTime,
        trainingDurationMinutes: getTrainingDurationFormValue(payload.trainingDurationMinutes),
        trainingFieldId: normalizeOptionalId(payload.trainingFieldId) ?? "",
        trainingFieldPieceIds: Array.isArray(payload.trainingFieldPieceIds) ? payload.trainingFieldPieceIds.map(String) : [],
      });
      setSecondReminderEnabled(hasSecondReminder);
      setThirdReminderEnabled(hasThirdReminder);
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
            trainingDurationMinutes: normalizeTrainingDurationInput(raw.trainingDurationMinutes),
            trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
            trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds) ? raw.trainingFieldPieceIds.map(String) : [],
            trainingFieldSelections: normalizeTrainingFieldSelections(raw.trainingFieldSelections, trainingDates, {
              trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
              trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds) ? raw.trainingFieldPieceIds.map(String) : [],
            }),
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

  const loadTrainingFields = async (): Promise<TrainingField[]> => {
    if (!clubId) return [];
    setTrainingFieldsLoading(true);
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/fields`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Неуспешно зареждане на терените.");
      }
      const payload: unknown = await response.json();
      const fields = Array.isArray(payload)
        ? payload.map((item) => {
          const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
          const pieces = Array.isArray(raw.pieces)
            ? raw.pieces.map((piece) => {
              const pieceRaw = typeof piece === "object" && piece !== null ? (piece as Record<string, unknown>) : {};
              return {
                id: String(pieceRaw.id ?? ""),
                name: String(pieceRaw.name ?? "").trim(),
                sortOrder: Number.isInteger(pieceRaw.sortOrder) ? Number(pieceRaw.sortOrder) : 0,
              };
            }).filter((piece) => piece.id && piece.name)
            : [];
          return {
            id: String(raw.id ?? ""),
            name: String(raw.name ?? "").trim(),
            pieces: pieces.sort((a, b) => a.sortOrder - b.sortOrder),
          } satisfies TrainingField;
        }).filter((field) => field.id && field.name)
        : [];
      setTrainingFields(fields);
      return fields;
    } catch (error) {
      setTrainingDaysEditorError(error instanceof Error ? error.message : "Възникна грешка.");
      setTrainingFields([]);
      return [];
    } finally {
      setTrainingFieldsLoading(false);
    }
  };

  const loadCustomTrainingGroups = async (): Promise<CustomTrainingGroup[]> => {
    if (!clubId) return [];
    setTrainingScheduleGroupsLoading(true);
    try {
      const search = new URLSearchParams();
      if (coachGroupId) search.set("coachGroupId", coachGroupId);
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups${search.size ? `?${search.toString()}` : ""}`, {
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
            coachGroupId: normalizeOptionalId(raw.coachGroupId),
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
            trainingDurationMinutes: normalizeTrainingDurationInput(raw.trainingDurationMinutes),
            trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
            trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds) ? raw.trainingFieldPieceIds.map(String) : [],
            trainingFieldSelections: normalizeTrainingFieldSelections(raw.trainingFieldSelections, trainingDates, {
              trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
              trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds) ? raw.trainingFieldPieceIds.map(String) : [],
            }),
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
    setCustomGroupCreateSearch("");
    setTrainingGroupCreateOpen(true);
  };

  const openTrainingGroupEditModal = (groupId: string) => {
    if (isCustomTrainingGroupMode) {
      const group = customTrainingGroups.find((item) => item.id === groupId);
      if (!group) {
        setTrainingAttendanceError("Custom training group not found.");
        return;
      }
      const activeIds = new Set(members.filter((m) => m.isActive).map((m) => m.id));
      setTrainingGroupEditError("");
      setTrainingGroupEditId(group.id);
      setTrainingGroupEditName(group.name);
      setTrainingGroupEditPlayerIds(group.playerIds.filter((id) => activeIds.has(id)));
      setCustomGroupEditSearch("");
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
            coachGroupId: coachGroupId || null,
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
    setTrainingDaysActiveStep("days");
    setTrainingDaysEditorGroups([]);
    setTrainingDaysEditorGroupName("");
    setTrainingDaysEditorCreateOpen(true);
    setTrainingDaysEditorError("");
    setTrainingDaysInitialDates([]);
    setTrainingDaysInitialDateTimes({});
    setTrainingDaysInitialFieldSelections({});
    setTrainingDaysInitialDurationMinutes(DEFAULT_TRAINING_DURATION_MINUTES);
    setTrainingDaysInitialFieldId("");
    setTrainingDaysInitialFieldPieceIds([]);
    setTrainingDateTimes({});
    setTrainingFieldSelections({});
    setTrainingFieldActiveDate("");
    setTrainingTimeMode("all");
    setTrainingDaysEditorLoading(true);
    await loadTrainingFields();
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
        const resolvedFieldSelections = normalizeTrainingFieldSelections(
          resolvedGroup.trainingFieldSelections,
          nextWindowDates,
          { trainingFieldId: resolvedGroup.trainingFieldId ?? null, trainingFieldPieceIds: resolvedGroup.trainingFieldPieceIds ?? [] },
        );
        setSchedulerForm((prev) => ({
          ...prev,
          trainingDates: nextWindowDates,
          trainingTime: resolvedUniformTime,
          trainingDurationMinutes: getTrainingDurationFormValue(resolvedGroup.trainingDurationMinutes),
          trainingFieldId: resolvedGroup.trainingFieldId ?? "",
          trainingFieldPieceIds: resolvedGroup.trainingFieldPieceIds ?? [],
        }));
        setTrainingDaysInitialDates(nextWindowDates);
        setTrainingDaysInitialDurationMinutes(normalizeTrainingDurationInput(resolvedGroup.trainingDurationMinutes));
        setTrainingDaysInitialFieldId(resolvedGroup.trainingFieldId ?? "");
        setTrainingDaysInitialFieldPieceIds(resolvedGroup.trainingFieldPieceIds ?? []);
        setTrainingDateTimes(resolvedDateTimes);
        setTrainingDaysInitialDateTimes(resolvedDateTimes);
        setTrainingFieldSelections(resolvedFieldSelections);
        setTrainingDaysInitialFieldSelections(resolvedFieldSelections);
        setTrainingFieldActiveDate(nextWindowDates[0] ?? "");
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
        const resolvedFieldSelections = normalizeTrainingFieldSelections(
          resolvedGroup.trainingFieldSelections,
          nextWindowDates,
          { trainingFieldId: resolvedGroup.trainingFieldId ?? null, trainingFieldPieceIds: resolvedGroup.trainingFieldPieceIds ?? [] },
        );
        setSchedulerForm((prev) => ({
          ...prev,
          trainingDates: nextWindowDates,
          trainingTime: resolvedUniformTime,
          trainingDurationMinutes: getTrainingDurationFormValue(resolvedGroup.trainingDurationMinutes),
          trainingFieldId: resolvedGroup.trainingFieldId ?? "",
          trainingFieldPieceIds: resolvedGroup.trainingFieldPieceIds ?? [],
        }));
        setTrainingDaysInitialDates(nextWindowDates);
        setTrainingDaysInitialDurationMinutes(normalizeTrainingDurationInput(resolvedGroup.trainingDurationMinutes));
        setTrainingDaysInitialFieldId(resolvedGroup.trainingFieldId ?? "");
        setTrainingDaysInitialFieldPieceIds(resolvedGroup.trainingFieldPieceIds ?? []);
        setTrainingDateTimes(resolvedDateTimes);
        setTrainingDaysInitialDateTimes(resolvedDateTimes);
        setTrainingFieldSelections(resolvedFieldSelections);
        setTrainingDaysInitialFieldSelections(resolvedFieldSelections);
        setTrainingFieldActiveDate(nextWindowDates[0] ?? "");
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
        const resolvedFieldSelections = normalizeTrainingFieldSelections(
          cgPayload.trainingFieldSelections,
          nextWindowDates,
          { trainingFieldId: normalizeOptionalId(cgPayload.trainingFieldId), trainingFieldPieceIds: Array.isArray(cgPayload.trainingFieldPieceIds) ? cgPayload.trainingFieldPieceIds.map(String) : [] },
        );
        setSchedulerForm((prev) => ({
          ...prev,
          trainingDates: nextWindowDates,
          trainingTime: resolvedUniformTime,
          trainingDurationMinutes: getTrainingDurationFormValue(cgPayload.trainingDurationMinutes),
          trainingFieldId: normalizeOptionalId(cgPayload.trainingFieldId) ?? "",
          trainingFieldPieceIds: Array.isArray(cgPayload.trainingFieldPieceIds) ? cgPayload.trainingFieldPieceIds.map(String) : [],
        }));
        setTrainingDaysInitialDates(nextWindowDates);
        setTrainingDaysInitialDurationMinutes(normalizeTrainingDurationInput(cgPayload.trainingDurationMinutes));
        setTrainingDaysInitialFieldId(normalizeOptionalId(cgPayload.trainingFieldId) ?? "");
        setTrainingDaysInitialFieldPieceIds(Array.isArray(cgPayload.trainingFieldPieceIds) ? cgPayload.trainingFieldPieceIds.map(String) : []);
        setTrainingDateTimes(resolvedDateTimes);
        setTrainingDaysInitialDateTimes(resolvedDateTimes);
        setTrainingFieldSelections(resolvedFieldSelections);
        setTrainingDaysInitialFieldSelections(resolvedFieldSelections);
        setTrainingFieldActiveDate(nextWindowDates[0] ?? "");
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
      const resolvedFieldSelections = normalizeTrainingFieldSelections(
        payload.trainingFieldSelections,
        resolvedTrainingDates,
        { trainingFieldId: normalizeOptionalId(payload.trainingFieldId), trainingFieldPieceIds: Array.isArray(payload.trainingFieldPieceIds) ? payload.trainingFieldPieceIds.map(String) : [] },
      );
      const hasSecondReminder =
        Number.isInteger(payload.secondReminderDay) &&
        Number.isInteger(payload.secondReminderHour) &&
        Number.isInteger(payload.secondReminderMinute);
      const hasThirdReminder =
        Number.isInteger(payload.thirdReminderDay) &&
        Number.isInteger(payload.thirdReminderHour) &&
        Number.isInteger(payload.thirdReminderMinute);
      setSchedulerForm({
        reminderDay: String(payload.reminderDay ?? 25),
        overdueDay: String(payload.overdueDay ?? 1),
        reminderHour: String(payload.reminderHour ?? 10),
        reminderMinute: String(payload.reminderMinute ?? 0),
        secondReminderDay: hasSecondReminder ? String(payload.secondReminderDay) : "",
        secondReminderHour: hasSecondReminder ? String(payload.secondReminderHour) : "10",
        secondReminderMinute: hasSecondReminder ? String(payload.secondReminderMinute) : "0",
        thirdReminderDay: hasThirdReminder ? String(payload.thirdReminderDay) : "",
        thirdReminderHour: hasThirdReminder ? String(payload.thirdReminderHour) : "10",
        thirdReminderMinute: hasThirdReminder ? String(payload.thirdReminderMinute) : "0",
        overdueHour: String(payload.overdueHour ?? 10),
        overdueMinute: String(payload.overdueMinute ?? 0),
        trainingDates: resolvedTrainingDates,
        trainingTime: resolvedUniformTime,
        trainingDurationMinutes: getTrainingDurationFormValue(payload.trainingDurationMinutes),
        trainingFieldId: normalizeOptionalId(payload.trainingFieldId) ?? "",
        trainingFieldPieceIds: Array.isArray(payload.trainingFieldPieceIds) ? payload.trainingFieldPieceIds.map(String) : [],
      });
      setSecondReminderEnabled(hasSecondReminder);
      setThirdReminderEnabled(hasThirdReminder);
      setTrainingDaysInitialDates(resolvedTrainingDates);
      setTrainingDaysInitialDurationMinutes(normalizeTrainingDurationInput(payload.trainingDurationMinutes));
      setTrainingDaysInitialFieldId(normalizeOptionalId(payload.trainingFieldId) ?? "");
      setTrainingDaysInitialFieldPieceIds(Array.isArray(payload.trainingFieldPieceIds) ? payload.trainingFieldPieceIds.map(String) : []);
      setTrainingDateTimes(resolvedDateTimes);
      setTrainingDaysInitialDateTimes(resolvedDateTimes);
      setTrainingFieldSelections(resolvedFieldSelections);
      setTrainingDaysInitialFieldSelections(resolvedFieldSelections);
      setTrainingFieldActiveDate(resolvedTrainingDates[0] ?? "");
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
    if (hasInvalidTrainingDuration) {
      throw new Error("Въведете продължителност на тренировката между 1 и 1440 минути.");
    }
    if (hasMissingTrainingField) {
      throw new Error(missingTrainingFieldMessage);
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
        thirdReminderDay: thirdReminderEnabled ? Number.parseInt(schedulerForm.thirdReminderDay, 10) : null,
        thirdReminderHour: thirdReminderEnabled ? Number.parseInt(schedulerForm.thirdReminderHour, 10) : null,
        thirdReminderMinute: thirdReminderEnabled ? Number.parseInt(schedulerForm.thirdReminderMinute, 10) : null,
        overdueHour: Number.parseInt(schedulerForm.overdueHour, 10),
        overdueMinute: Number.parseInt(schedulerForm.overdueMinute, 10),
        trainingDates: schedulerForm.trainingDates,
        trainingTime: normalizedTrainingTime || null,
        trainingDurationMinutes: normalizedTrainingDurationSelection,
        trainingFieldId: primaryTrainingFieldSelection.trainingFieldId || null,
        trainingFieldPieceIds: primaryTrainingFieldSelection.trainingFieldPieceIds,
        trainingFieldSelections,
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
        if (hasInvalidTrainingDuration) {
          throw new Error("Въведете продължителност на тренировката между 1 и 1440 минути.");
        }
        if (hasMissingTrainingField) {
          throw new Error(missingTrainingFieldMessage);
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
          nextTrainingDateTimesKey === initialTrainingDateTimesKey &&
          normalizedTrainingDurationSelection === trainingDaysInitialDurationMinutes &&
          normalizedTrainingFieldSelectionsKey === normalizedTrainingFieldSelectionsInitialKey
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
              trainingDurationMinutes: normalizedTrainingDurationSelection,
              trainingFieldId: primaryTrainingFieldSelection.trainingFieldId || null,
              trainingFieldPieceIds: primaryTrainingFieldSelection.trainingFieldPieceIds,
              trainingFieldSelections,
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
        normalizedTrainingDateTimesSelectionKey === normalizedTrainingDateTimesInitialKey &&
        normalizedTrainingFieldSelectionsKey === normalizedTrainingFieldSelectionsInitialKey
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

  const openTrainingFieldModal = (field?: TrainingField) => {
    setTrainingFieldError("");
    if (field) {
      setTrainingFieldEditId(field.id);
      setTrainingFieldName(field.name);
      setTrainingFieldPieces(field.pieces.map((piece) => ({ id: piece.id, name: piece.name })));
    } else {
      setTrainingFieldEditId(null);
      setTrainingFieldName("");
      setTrainingFieldPieces([]);
    }
    setTrainingFieldModalOpen(true);
  };

  const saveTrainingField = async () => {
    if (!clubId || trainingFieldSaving) return;
    setTrainingFieldSaving(true);
    setTrainingFieldError("");
    try {
      const endpoint = trainingFieldEditId
        ? `/api/admin/clubs/${encodeURIComponent(clubId)}/fields/${encodeURIComponent(trainingFieldEditId)}`
        : `/api/admin/clubs/${encodeURIComponent(clubId)}/fields`;
      const response = await fetch(endpoint, {
        method: trainingFieldEditId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trainingFieldName.trim(),
          pieces: trainingFieldEditId
            ? trainingFieldPieces.map((piece) => ({ id: piece.id, name: piece.name.trim() }))
            : trainingFieldPieces.map((piece) => piece.name.trim()),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Неуспешно запазване на терена.");
      }
      const fields = await loadTrainingFields();
      const savedId = typeof payload?.id === "string" ? payload.id : trainingFieldEditId;
      if (savedId && (!schedulerForm.trainingFieldId || schedulerForm.trainingFieldId === trainingFieldEditId)) {
        const savedField = fields.find((field) => field.id === savedId);
        setSchedulerForm((prev) => ({
          ...prev,
          trainingFieldId: savedId,
          trainingFieldPieceIds: savedField?.pieces.length
            ? prev.trainingFieldPieceIds.filter((id) => savedField.pieces.some((p) => p.id === id))
            : [],
        }));
      }
      setTrainingFieldModalOpen(false);
    } catch (error) {
      setTrainingFieldError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingFieldSaving(false);
    }
  };

  const deleteTrainingField = async (fieldId: string) => {
    if (!clubId || trainingFieldSaving) return;
    setTrainingFieldSaving(true);
    setTrainingFieldError("");
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/fields/${encodeURIComponent(fieldId)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Неуспешно изтриване на терена.");
      }
      await loadTrainingFields();
      setSchedulerForm((prev) => prev.trainingFieldId === fieldId
        ? { ...prev, trainingFieldId: "", trainingFieldPieceIds: [] }
        : prev);
      setTrainingFieldModalOpen(false);
    } catch (error) {
      setTrainingFieldError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingFieldSaving(false);
    }
  };

  const saveSchedulerSettings = async () => {
    if (!clubId || schedulerSettingsSaving) return;
    setSchedulerSettingsSaving(true);
    setSchedulerSettingsError("");
    try {
      const normalizedTrainingTime = schedulerForm.trainingTime.trim();
      if (hasInvalidTrainingDuration) {
        throw new Error("Въведете продължителност на тренировката между 1 и 1440 минути.");
      }
      if (hasMissingTrainingField) {
        throw new Error(missingTrainingFieldMessage);
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
          thirdReminderDay: thirdReminderEnabled ? Number.parseInt(schedulerForm.thirdReminderDay, 10) : null,
          thirdReminderHour: thirdReminderEnabled ? Number.parseInt(schedulerForm.thirdReminderHour, 10) : null,
          thirdReminderMinute: thirdReminderEnabled ? Number.parseInt(schedulerForm.thirdReminderMinute, 10) : null,
          overdueHour: Number.parseInt(schedulerForm.overdueHour, 10),
          overdueMinute: Number.parseInt(schedulerForm.overdueMinute, 10),
          trainingDates: schedulerForm.trainingDates,
          trainingTime: normalizedTrainingTime || null,
          trainingDurationMinutes: normalizedTrainingDurationSelection,
          trainingFieldId: primaryTrainingFieldSelection.trainingFieldId || null,
          trainingFieldPieceIds: primaryTrainingFieldSelection.trainingFieldPieceIds,
          trainingFieldSelections,
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
    monthOverride?: string,
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
      const requestedMonth = monthOverride ?? (date ? getMonthKeyFromIsoDate(date) : trainingAttendanceMonth);
      search.set("month", requestedMonth);
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
      setTrainingDayDurationMinutes(
        typeof payload?.trainingDurationMinutes === "number" && payload.trainingDurationMinutes > 0
          ? payload.trainingDurationMinutes
          : DEFAULT_TRAINING_DURATION_MINUTES,
      );
      const rawField = payload?.trainingField;
      setTrainingDayField(
        rawField && typeof rawField === "object" && rawField !== null
          ? {
              id: String((rawField as Record<string, unknown>).id ?? ""),
              name: String((rawField as Record<string, unknown>).name ?? ""),
              pieces: Array.isArray((rawField as Record<string, unknown>).pieces)
                ? ((rawField as Record<string, unknown>).pieces as unknown[]).map((p) => {
                    const rp = typeof p === "object" && p !== null ? (p as Record<string, unknown>) : {};
                    return { id: String(rp.id ?? ""), name: String(rp.name ?? "") };
                  })
                : [],
            }
          : null,
      );
      setTrainingDayFieldPieceIds(
        Array.isArray(payload?.trainingFieldPieceIds)
          ? (payload.trainingFieldPieceIds as unknown[]).map(String)
          : [],
      );
    } catch (error) {
      setTrainingAttendancePlayers([]);
      setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
      setTrainingUpcomingDates([]);
      setTrainingNote("");
      setTrainingNoteTargetDates([]);
      setTrainingDayDurationMinutes(DEFAULT_TRAINING_DURATION_MINUTES);
      setTrainingDayField(null);
      setTrainingDayFieldPieceIds([]);
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
    const currentMonth = getTodayIsoDate().slice(0, 7);
    setTrainingAttendanceOpen(true);
    setTrainingAttendanceMonth(currentMonth);
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
      await fetchTrainingAttendance(undefined, undefined, resolvedGroupId, "trainingGroups", currentMonth);
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
        await fetchTrainingAttendance(undefined, yearStr, undefined, "teamGroup", currentMonth);
      } else if (resolvedTrainingGroupScope) {
        setTrainingAttendanceView("teamGroup");
        await fetchTrainingAttendance(undefined, resolvedTrainingGroupScope, undefined, "teamGroup", currentMonth);
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

  const handleTrainingAttendanceMonthChange = async (delta: number) => {
    const nextMonth = addMonthsToMonthKey(trainingAttendanceMonth, delta);
    setTrainingAttendanceMonth(nextMonth);
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingAttendanceError("");
    setTrainingNoteTargetDates([]);
    await fetchTrainingAttendance(undefined, undefined, undefined, undefined, nextMonth);
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
    const month = getMonthKeyFromIsoDate(date);
    setTrainingDayDetailsOpening(true);
    setTrainingAttendanceDate(date);
    setTrainingAttendanceMonth(month);
    try {
      await fetchTrainingAttendance(date, undefined, undefined, undefined, month);
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
      void fetchTrainingAttendance(trainingAttendanceDate, undefined, undefined, undefined, trainingAttendanceMonth);
    };

    source.addEventListener("attendance-update", handleUpdate);

    return () => {
      source.removeEventListener("attendance-update", handleUpdate);
      source.close();
    };
  }, [trainingAttendanceOpen, clubId, trainingAttendanceDate, trainingAttendanceMonth, selectedTeamGroup, trainingAttendanceView, selectedTrainingGroupId]);

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
              {clubId && clubBillingStatus && (
                <span className={`amp-billing-badge amp-billing-badge--${clubBillingStatus}`}>
                  {clubBillingStatus === "active" ? "Активен" : "Демо"}
                </span>
              )}
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
                className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                onClick={() => router.push(`/admin/clubs/${encodeURIComponent(clubId)}/billing`)}
                type="button"
              >
                <span>Такси</span>
              </button>
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
                      <div className="amp-training-month-nav">
                        <button
                          type="button"
                          className="amp-training-month-nav-btn"
                          onClick={() => void handleTrainingAttendanceMonthChange(-1)}
                          disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDayDetailsOpening}
                          aria-label="Предишен месец"
                        >
                          ‹
                        </button>
                        <span className="amp-training-month-nav-title">
                          {trainingAttendanceCalendarMonths[0]?.label ?? trainingAttendanceMonth}
                        </span>
                        <button
                          type="button"
                          className="amp-training-month-nav-btn"
                          onClick={() => void handleTrainingAttendanceMonthChange(1)}
                          disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDayDetailsOpening}
                          aria-label="Следващ месец"
                        >
                          ›
                        </button>
                      </div>
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
                    <input
                      className="amp-edit-input"
                      type="search"
                      placeholder="Търси играч..."
                      value={customGroupEditSearch}
                      onChange={(e) => setCustomGroupEditSearch(e.target.value)}
                      disabled={trainingGroupEditSaving}
                      style={{ marginBottom: "8px" }}
                    />
                    <div className="amp-group-check-grid">
                      {filteredPlayersForCustomGroupEdit.map((member) => {
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
                    {availablePlayersForCustomGroupEdit.length > 0 && filteredPlayersForCustomGroupEdit.length === 0 && (
                      <p className="amp-empty amp-empty--modal">Няма играчи, отговарящи на търсенето.</p>
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
                    <input
                      className="amp-edit-input"
                      type="search"
                      placeholder="Търси играч..."
                      value={customGroupCreateSearch}
                      onChange={(e) => setCustomGroupCreateSearch(e.target.value)}
                      disabled={trainingGroupCreateSaving}
                      style={{ marginBottom: "8px" }}
                    />
                    <div className="amp-group-check-grid">
                      {filteredPlayersForCustomGroupCreate.map((member) => {
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
                    {availablePlayersForCustomGroupCreate.length > 0 && filteredPlayersForCustomGroupCreate.length === 0 && (
                      <p className="amp-empty amp-empty--modal">Няма играчи, отговарящи на търсенето.</p>
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
            <div className="amp-modal-body" style={{ position: "relative", display: "flex", flexDirection: "column" }}>
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
                    <div className="amp-training-stepper" aria-label="Стъпки за тренировъчен график" style={{ order: 0 }}>
                      <button
                        type="button"
                        className={`amp-training-step${effectiveTrainingDaysActiveStep === "days" ? " is-active" : " is-complete"}`}
                        onClick={() => setTrainingDaysActiveStep("days")}
                        disabled={trainingDaysEditorSaving}
                      >
                        <span className="amp-training-step-index">1</span>
                        Дни
                      </button>
                      <button
                        type="button"
                        className={`amp-training-step${effectiveTrainingDaysActiveStep === "time" ? " is-active" : ""}${canShowTrainingDaysFieldStep ? " is-complete" : ""}`}
                        onClick={() => setTrainingDaysActiveStep("time")}
                        disabled={trainingDaysEditorSaving || !canShowTrainingDaysTimeStep}
                      >
                        <span className="amp-training-step-index">2</span>
                        Час
                      </button>
                      <button
                        type="button"
                        className={`amp-training-step${effectiveTrainingDaysActiveStep === "field" ? " is-active" : ""}`}
                        onClick={() => setTrainingDaysActiveStep("field")}
                        disabled={trainingDaysEditorSaving || !canShowTrainingDaysFieldStep}
                      >
                        <span className="amp-training-step-index">3</span>
                        Терен
                      </button>
                    </div>
                  )}
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
                  {trainingDaysEditorMode !== "createGroup" && effectiveTrainingDaysActiveStep === "time" && (
                    <div className="amp-training-step-summary" style={{ order: 1 }}>
                      <span className="amp-training-step-summary-label">Избрани дни</span>
                      <span className="amp-training-step-summary-value">{trainingDaysSummaryText}</span>
                    </div>
                  )}
                  {trainingDaysEditorMode !== "createGroup" && effectiveTrainingDaysActiveStep === "field" && (
                    <div className="amp-training-step-summary" style={{ order: 1 }}>
                      <div>
                        <span className="amp-training-step-summary-label">Избрани дни</span>
                        <span className="amp-training-step-summary-value">{trainingDaysSummaryText}</span>
                      </div>
                      <div>
                        <span className="amp-training-step-summary-label">Час и продължителност</span>
                        <span className="amp-training-step-summary-value">{trainingTimeSummaryText} · {trainingDurationSummaryText}</span>
                      </div>
                    </div>
                  )}
                  {trainingDaysEditorMode !== "createGroup" && canShowTrainingDaysTimeStep && effectiveTrainingDaysActiveStep === "time" && (
                    <div className="amp-training-time-panel" style={{ marginTop: "8px", textAlign: "center", order: 2 }}>
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
                  {trainingDaysEditorMode !== "createGroup" && canShowTrainingDaysTimeStep && effectiveTrainingDaysActiveStep === "time" && trainingTimeMode === "all" && (
                    <label className="amp-edit-field" style={{ marginTop: "8px", textAlign: "center", order: 2 }}>
                      <span className="amp-lbl" style={{ textAlign: "center" }}>Час на тренировка</span>
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
                  {trainingDaysEditorMode !== "createGroup" && canShowTrainingDaysTimeStep && effectiveTrainingDaysActiveStep === "time" && (
                      <label className="amp-edit-field" style={{ marginTop: "8px", textAlign: "center", order: 2 }}>
                        <span className="amp-lbl" style={{ textAlign: "center" }}>Продължителност на тренировката (минути)</span>
                        <input
                            style={{ textAlign: "center" }}
                            className="amp-edit-input"
                            type="number"
                            min={1}
                            max={1440}
                            step={5}
                            value={schedulerForm.trainingDurationMinutes}
                            onChange={(e) => setSchedulerForm((prev) => ({ ...prev, trainingDurationMinutes: e.target.value }))}
                            required
                            disabled={trainingDaysEditorSaving}
                        />
                      </label>
                  )}
                  {trainingDaysEditorMode !== "createGroup" && canShowTrainingDaysTimeStep && effectiveTrainingDaysActiveStep === "time" && trainingTimeMode === "perDay" && (
                    <div className="amp-training-time-list" style={{ marginTop: "8px", order: 2 }}>
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
                  {trainingDaysEditorMode !== "createGroup" && canShowTrainingDaysTimeStep && effectiveTrainingDaysActiveStep === "time" && trainingTimeMode === "byWeekday" && (
                    <div className="amp-training-time-list" style={{ marginTop: "8px", order: 2 }}>
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
                    <p className="amp-confirm-error" style={{ marginTop: "8px", textAlign: "center", order: 3 }}>
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
                  {trainingDaysEditorMode !== "createGroup" && effectiveTrainingDaysActiveStep === "days" && (
                    <div className="amp-training-calendar" style={{ order: 1 }}>
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
                  {trainingDaysEditorMode !== "createGroup" && canShowTrainingDaysFieldStep && effectiveTrainingDaysActiveStep === "field" && trainingFields.length > 0 && (
                      <div style={{ display: "grid", gap: "12px", marginTop: "8px", width: "min(100%, 620px)", marginInline: "auto", order: 3 }}>
                        <span className="amp-lbl" style={{ textAlign: "center" }}>Терен по дни{fieldConflictsLoading ? " …" : ""}</span>
                        <div className="amp-pills" style={{ justifyContent: "center" }}>
                          {normalizedTrainingDaysSelection.map((date) => (
                            <button
                              key={`field-date-${date}`}
                              type="button"
                              className={`amp-pill${trainingFieldActiveDate === date ? " amp-pill--active" : ""}`}
                              onClick={() => setTrainingFieldActiveDate(date)}
                              disabled={trainingDaysEditorSaving}
                            >
                              {formatIsoDateForDisplay(date)}
                            </button>
                          ))}
                        </div>
                        <span className="amp-lbl" style={{ textAlign: "center", opacity: 0.82 }}>
                          Избран ден: {trainingFieldActiveDate ? formatIsoDateForDisplay(trainingFieldActiveDate) : "-"}
                        </span>
                        <div style={{ display: "grid", gap: "12px" }}>
                          {trainingFields.map((field) => {
                            const isFieldSelected = activeTrainingFieldSelection.trainingFieldId === field.id;
                            const isWholeFieldSelected = isFieldSelected && activeTrainingFieldSelection.trainingFieldPieceIds.length === 0;
                            const anyFieldSelected = !!activeTrainingFieldSelection.trainingFieldId;
                            const fieldConflict = fieldConflictsMap[field.id];
                            const isWholeFieldConflicted = Boolean(fieldConflict?.wholeFieldBlocked);
                            const pieces = field.pieces.length > 0
                                ? field.pieces
                                : [{ id: "", name: "Цял терен", sortOrder: 0 }];
                            return (
                                <div key={field.id} style={{ display: "grid", gap: "6px", opacity: anyFieldSelected && !isFieldSelected ? 0.38 : 1, transition: "opacity 0.15s ease" }}>
                                  <button
                                      type="button"
                                      onClick={() => {
                                        if (isWholeFieldConflicted) return;
                                        setTrainingFieldSelections((prev) => ({
                                          ...prev,
                                          [trainingFieldActiveDate]: { trainingFieldId: field.id, trainingFieldPieceIds: [] },
                                        }));
                                      }}
                                      disabled={trainingDaysEditorSaving || trainingFieldsLoading}
                                      title={isWholeFieldConflicted ? "Целият терен е зает в избрания час" : undefined}
                                      style={{
                                        border: 0,
                                        background: "transparent",
                                        color: isWholeFieldSelected ? "#32cd32" : isWholeFieldConflicted ? "rgba(255,120,120,0.75)" : "rgba(255,255,255,0.88)",
                                        fontWeight: 800,
                                        fontSize: "14px",
                                        textAlign: "center",
                                        cursor: trainingDaysEditorSaving || trainingFieldsLoading || isWholeFieldConflicted ? "default" : "pointer",
                                        padding: 0,
                                        textDecoration: isWholeFieldSelected ? "underline" : isWholeFieldConflicted ? "line-through" : "none",
                                        textUnderlineOffset: "3px",
                                        opacity: isFieldSelected && activeTrainingFieldSelection.trainingFieldPieceIds.length > 0 ? 0.38 : 1,
                                        transition: "opacity 0.15s ease, color 0.15s ease",
                                      }}
                                  >
                                    {field.name}
                                  </button>
                                  <div
                                      role="group"
                                      aria-label={`Терен ${field.name}`}
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: `repeat(${pieces.length}, minmax(0, 1fr))`,
                                        minHeight: "96px",
                                        aspectRatio: "3 / 1",
                                        border: isFieldSelected
                                            ? "2px solid rgba(50,205,50,0.8)"
                                            : "1px solid rgba(255,255,255,0.38)",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                        background:
                                            "linear-gradient(90deg, rgba(32,142,50,0.82) 0 12.5%, rgba(26,122,43,0.82) 12.5% 25%, rgba(32,142,50,0.82) 25% 37.5%, rgba(26,122,43,0.82) 37.5% 50%, rgba(32,142,50,0.82) 50% 62.5%, rgba(26,122,43,0.82) 62.5% 75%, rgba(32,142,50,0.82) 75% 87.5%, rgba(26,122,43,0.82) 87.5% 100%)",
                                        boxShadow: isFieldSelected ? "0 0 0 1px rgba(50,205,50,0.6), 0 0 22px rgba(50,205,50,0.28)" : "none",
                                        position: "relative",
                                      }}
                                  >
                                    <div
                                        aria-hidden="true"
                                        style={{
                                          position: "absolute",
                                          inset: "8px",
                                          border: "1px solid rgba(255,255,255,0.72)",
                                          borderRadius: "4px",
                                          pointerEvents: "none",
                                        }}
                                    />
                                    <div
                                        aria-hidden="true"
                                        style={{
                                          position: "absolute",
                                          top: "8px",
                                          bottom: "8px",
                                          left: "50%",
                                          width: "1px",
                                          background: "rgba(255,255,255,0.72)",
                                          transform: "translateX(-0.5px)",
                                          pointerEvents: "none",
                                        }}
                                    />
                                    <div
                                        aria-hidden="true"
                                        style={{
                                          position: "absolute",
                                          left: "50%",
                                          top: "50%",
                                          width: "26px",
                                          height: "26px",
                                          border: "1px solid rgba(255,255,255,0.72)",
                                          borderRadius: "999px",
                                          transform: "translate(-50%, -50%)",
                                          pointerEvents: "none",
                                        }}
                                    />
                                    <div
                                        aria-hidden="true"
                                        style={{
                                          position: "absolute",
                                          left: "50%",
                                          top: "50%",
                                          width: "4px",
                                          height: "4px",
                                          background: "rgba(255,255,255,0.8)",
                                          borderRadius: "999px",
                                          transform: "translate(-50%, -50%)",
                                          pointerEvents: "none",
                                        }}
                                    />
                                    {pieces.map((piece, index) => {
                                      const isPieceConflicted = field.pieces.length === 0
                                          ? isWholeFieldConflicted
                                          : Boolean(fieldConflict?.blockedPieceIds.includes(piece.id));
                                      const isPieceSelected =
                                          field.pieces.length === 0
                                              ? isWholeFieldSelected
                                              : isFieldSelected && (
                                              activeTrainingFieldSelection.trainingFieldPieceIds.length === 0 ||
                                              activeTrainingFieldSelection.trainingFieldPieceIds.includes(piece.id)
                                          );
                                      return (
                                          <button
                                              key={piece.id || `${field.id}-whole`}
                                              type="button"
                                              title={isPieceConflicted ? "Тази позиция е заета в избрания час" : undefined}
                                              onClick={() => {
                                                if (isPieceConflicted) return;
                                                if (field.pieces.length === 0) {
                                                  setTrainingFieldSelections((prev) => ({
                                                    ...prev,
                                                    [trainingFieldActiveDate]: { trainingFieldId: field.id, trainingFieldPieceIds: [] },
                                                  }));
                                                  return;
                                                }
                                                setTrainingFieldSelections((prev) => {
                                                  const current = prev[trainingFieldActiveDate];
                                                  const prevIds = current?.trainingFieldId === field.id && current.trainingFieldPieceIds.length > 0
                                                      ? current.trainingFieldPieceIds
                                                      : [];
                                                  let nextIds: string[];
                                                  if (prevIds.includes(piece.id)) {
                                                    nextIds = prevIds.filter((id) => id !== piece.id);
                                                    if (nextIds.length === 0) nextIds = [];
                                                  } else {
                                                    nextIds = [...prevIds, piece.id];
                                                    if (nextIds.length === field.pieces.length) nextIds = [];
                                                  }
                                                  return { ...prev, [trainingFieldActiveDate]: { trainingFieldId: field.id, trainingFieldPieceIds: nextIds } };
                                                });
                                              }}
                                              disabled={trainingDaysEditorSaving || trainingFieldsLoading}
                                              style={{
                                                minWidth: 0,
                                                border: 0,
                                                borderLeft: index === 0 ? 0 : "1px dashed rgba(255,255,255,0.68)",
                                                background: isPieceConflicted
                                                    ? "rgba(180,0,0,0.32)"
                                                    : isPieceSelected
                                                        ? "rgba(50,205,50,0.18)"
                                                        : isFieldSelected && activeTrainingFieldSelection.trainingFieldPieceIds.length > 0 && !isPieceSelected
                                                            ? "rgba(0,0,0,0.52)"
                                                            : "transparent",
                                                boxShadow: isPieceSelected && !isPieceConflicted ? "inset 0 0 0 2px #32cd32" : "none",
                                                color: isPieceConflicted
                                                    ? "rgba(255,120,120,0.85)"
                                                    : isPieceSelected
                                                        ? "#32cd32"
                                                        : isFieldSelected && activeTrainingFieldSelection.trainingFieldPieceIds.length > 0 && !isPieceSelected
                                                            ? "rgba(255,255,255,0.42)"
                                                            : "rgba(255,255,255,0.86)",
                                                fontWeight: 800,
                                                fontSize: "13px",
                                                textAlign: "center",
                                                padding: "8px",
                                                cursor: trainingDaysEditorSaving || trainingFieldsLoading || isPieceConflicted ? "not-allowed" : "pointer",
                                                position: "relative",
                                                zIndex: 1,
                                                textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                                                textDecoration: isPieceConflicted ? "line-through" : "none",
                                                transition: "background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
                                              }}
                                          >
                                            {piece.name}
                                          </button>
                                      );
                                    })}
                                  </div>
                                </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                          <button
                              type="button"
                              className="amp-btn amp-btn--ghost"
                              onClick={() => openTrainingFieldModal()}
                              disabled={trainingDaysEditorSaving}
                          >
                            Добави терен
                          </button>
                          {selectedActiveTrainingField && (
                              <button
                                  type="button"
                                  className="amp-btn amp-btn--ghost"
                                  onClick={() => openTrainingFieldModal(selectedActiveTrainingField)}
                                  disabled={trainingDaysEditorSaving}
                              >
                                Редактирай терен
                              </button>
                          )}
                        </div>
                      </div>
                  )}
                  {trainingDaysEditorMode !== "createGroup" && canShowTrainingDaysFieldStep && effectiveTrainingDaysActiveStep === "field" && trainingFields.length === 0 && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginTop: "8px", order: 3 }}>
                        <p style={{ margin: 0, textAlign: "center", opacity: 0.6, fontSize: "0.9em" }}>Изборът на терен не е задължителен.</p>
                        <button
                            type="button"
                            className="amp-btn amp-btn--ghost"
                            onClick={() => openTrainingFieldModal()}
                            disabled={trainingDaysEditorSaving}
                        >
                          Добави терен
                        </button>
                      </div>
                  )}
                  {canShowTrainingDaysFieldStep && effectiveTrainingDaysActiveStep === "field" && hasMissingTrainingField && (
                      <p className="amp-confirm-error" style={{ textAlign: "center", order: 4 }}>{missingTrainingFieldMessage}</p>
                  )}
                  {trainingDaysEditorError && <p className="amp-confirm-error" style={{ textAlign: "center", order: 4 }}>{trainingDaysEditorError}</p>}
                  {isTrainingDaysScheduleUnchanged && !trainingDaysEditorError && (
                    <p className="amp-confirm-error" style={{ textAlign: "center", order: 4 }}>Графикът е същият като предишния.</p>
                  )}
                  {(showTrainingStepBack || showTrainingStepNext) && (
                    <div className="amp-training-step-nav" style={{ order: 4 }}>
                      {showTrainingStepBack && (
                        <button
                          type="button"
                          className="amp-btn amp-btn--ghost"
                          onClick={() => {
                            setTrainingDaysActiveStep(effectiveTrainingDaysActiveStep === "field" ? "time" : "days");
                          }}
                          disabled={trainingDaysEditorSaving}
                        >
                          Назад
                        </button>
                      )}
                      {showTrainingStepNext && (
                        <button
                          type="button"
                          className="amp-btn amp-btn--primary"
                          onClick={() => {
                            setTrainingDaysActiveStep(effectiveTrainingDaysActiveStep === "days" ? "time" : "field");
                          }}
                          disabled={isTrainingStepNextDisabled}
                        >
                          Напред
                        </button>
                      )}
                    </div>
                  )}
                  <div className="amp-modal-actions" style={{ justifyContent: "center", order: 4 }}>
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
                          hasMissingTrainingTime) ||
                        hasMissingTrainingField ||
                        hasInvalidTrainingDuration
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
      {trainingFieldModalOpen && (
        <div className="amp-overlay amp-overlay--confirm" onClick={() => !trainingFieldSaving && setTrainingFieldModalOpen(false)}>
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">{trainingFieldEditId ? "Редактирай терен" : "Добави терен"}</span>
              <button
                className="amp-modal-close"
                onClick={() => setTrainingFieldModalOpen(false)}
                aria-label="Затвори"
                disabled={trainingFieldSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <label className="amp-edit-field" style={{ textAlign: "center" }}>
                <span className="amp-lbl" style={{ textAlign: "center" }}>Име на терена</span>
                <input
                  className="amp-edit-input"
                  style={{ textAlign: "center" }}
                  value={trainingFieldName}
                  onChange={(e) => setTrainingFieldName(e.target.value)}
                  disabled={trainingFieldSaving}
                />
              </label>

              <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
                <span className="amp-lbl" style={{ textAlign: "center" }}>Полета на терена</span>
                {trainingFieldPieces.length === 0 ? (
                  <p className="amp-empty amp-empty--modal" style={{ margin: 0 }}>Теренът ще се използва като цял.</p>
                ) : (
                  trainingFieldPieces.map((piece, index) => (
                    <label key={`${piece.id ?? "new"}-${index}`} className="amp-edit-field" style={{ textAlign: "center" }}>
                      <span className="amp-lbl" style={{ textAlign: "center" }}>{`Поле ${index + 1}`}</span>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          className="amp-edit-input"
                          style={{ textAlign: "center" }}
                          value={piece.name}
                          onChange={(e) => {
                            const nextName = e.target.value;
                            setTrainingFieldPieces((prev) => prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: nextName } : item,
                            ));
                          }}
                          disabled={trainingFieldSaving}
                        />
                        <button
                          type="button"
                          className="amp-btn amp-btn--ghost"
                          onClick={() => setTrainingFieldPieces((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                          disabled={trainingFieldSaving}
                        >
                          Премахни
                        </button>
                      </div>
                    </label>
                  ))
                )}
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setTrainingFieldPieces((prev) =>
                    prev.length === 0
                      ? [{ id: null, name: "Поле 1" }, { id: null, name: "Поле 2" }]
                      : [...prev, { id: null, name: `Поле ${prev.length + 1}` }],
                  )}
                  disabled={trainingFieldSaving}
                >
                  Раздели на полета
                </button>
              </div>

              {trainingFieldError && <p className="amp-confirm-error" style={{ textAlign: "center" }}>{trainingFieldError}</p>}

              <div className="amp-modal-actions amp-modal-actions--end">
                {trainingFieldEditId && (
                  <button
                    type="button"
                    className="amp-btn amp-btn--danger"
                    onClick={() => void deleteTrainingField(trainingFieldEditId)}
                    disabled={trainingFieldSaving}
                  >
                    Изтрий
                  </button>
                )}
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setTrainingFieldModalOpen(false)}
                  disabled={trainingFieldSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveTrainingField()}
                  disabled={trainingFieldSaving}
                >
                  {trainingFieldSaving ? "Запазване..." : "Запази"}
                </button>
              </div>
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
                <span>Продължителност: {trainingDayDurationMinutes} мин.</span>
              </div>
              {trainingDayField && (
                <div className="amp-edit-field">
                  <span className="amp-lbl">Терен</span>
                  <p className="amp-val">
                    {trainingDayField.name}
                    {trainingDayFieldPieceIds.length > 0 && trainingDayField.pieces.some((p) => trainingDayFieldPieceIds.includes(p.id)) && (
                      <>
                        {" — "}
                        {trainingDayField.pieces
                          .filter((p) => trainingDayFieldPieceIds.includes(p.id))
                          .map((p) => p.name)
                          .join(", ")}
                      </>
                    )}
                  </p>
                </div>
              )}
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
                  {secondReminderEnabled && (
                    <>
                      <div className="amp-edit-field amp-edit-field--full amp-scheduler-section-title amp-scheduler-section-title--third" style={{ textAlign: "center" }}>
                        <span className="amp-lbl" style={{ textAlign: "center" }}>Трето напомняне (по избор)</span>
                      </div>
                      {!thirdReminderEnabled ? (
                        <div className="amp-edit-field amp-edit-field--full amp-scheduler-third-toggle" style={{ textAlign: "center" }}>
                          <span className="amp-lbl" style={{ textAlign: "center" }}>Трето месечно напомняне</span>
                          <button
                            className="amp-btn amp-btn--ghost amp-btn--compact"
                            style={{ width: "100%", justifyContent: "center" }}
                            type="button"
                            onClick={enableThirdReminder}
                            disabled={schedulerSettingsSaving}
                          >
                            Добави трето напомняне
                          </button>
                        </div>
                      ) : (
                        <>
                          <label className="amp-edit-field amp-scheduler-third-day" style={{ textAlign: "center" }}>
                            <span className="amp-lbl" style={{ textAlign: "center" }}>Ден трето месечно напомняне (1-28)</span>
                            <input
                              className="amp-edit-input"
                              style={{ textAlign: "center" }}
                              inputMode="numeric"
                              value={schedulerForm.thirdReminderDay}
                              onChange={(e) =>
                                setSchedulerForm((prev) => ({
                                  ...prev,
                                  thirdReminderDay: e.target.value.replace(/\D/g, ""),
                                }))
                              }
                              disabled={schedulerSettingsSaving}
                            />
                          </label>
                          <label className="amp-edit-field amp-scheduler-third-time" style={{ textAlign: "center" }}>
                            <span className="amp-lbl" style={{ textAlign: "center" }}>Час за трето месечно напомняне</span>
                            <div className="amp-edit-input" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
                              <input
                                className="amp-inner-time-input"
                                type="time"
                                step={60}
                                value={thirdReminderTimeValue}
                                onChange={(e) => {
                                  const [hour = "0", minute = "0"] = e.target.value.split(":");
                                  setSchedulerForm((prev) => ({
                                    ...prev,
                                    thirdReminderHour: hour.replace(/\D/g, ""),
                                    thirdReminderMinute: minute.replace(/\D/g, ""),
                                  }));
                                }}
                                disabled={schedulerSettingsSaving}
                              />
                            </div>
                          </label>
                          <div className="amp-edit-field amp-edit-field--full amp-scheduler-third-remove" style={{ textAlign: "center" }}>
                            <span className="amp-lbl" style={{ textAlign: "center" }}>Опция</span>
                            <button
                              className="amp-btn amp-btn--ghost amp-btn--compact"
                              style={{ width: "100%", justifyContent: "center" }}
                              type="button"
                              onClick={disableThirdReminder}
                              disabled={schedulerSettingsSaving}
                            >
                              Премахни третото напомняне
                            </button>
                          </div>
                        </>
                      )}
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

export default function AdminMembersPage() {
  return (
    <Suspense fallback={<main className="amp-page" />}>
      <AdminMembersPageContent />
    </Suspense>
  );
}

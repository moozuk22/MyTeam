"use client";

import { getMatchCalendarDates } from "@/lib/matchScheduleWindow";

import MatchHistoryModal from "@/components/MatchHistoryModal";
import FacebookBirthdayModal from "@/app/admin/members/_components/FacebookBirthdayModal";
import MonthlyFeeModal from "@/app/admin/members/_components/MonthlyFeeModal";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CoachMessageModal from "@/components/admin/CoachMessageModal";
import ActiveDevicesModal from "@/app/admin/members/_components/ActiveDevicesModal";

import { isCustomTrainingGroupPaletteColor } from "@/lib/customTrainingGroupColors";
import { AttendanceDashboard } from "./_components/AttendanceDashboard";
import { ReportsDialog } from "./_components/ReportsDialog";
import { MemberDetailModal } from "./_components/MemberDetailModal";
import { InactivePlayersModal } from "./_components/InactivePlayersModal";
import { ImportFromSheetsModal } from "./_components/ImportFromSheetsModal";
import { ImportPhotosFromDriveModal } from "./_components/ImportPhotosFromDriveModal";
import {
  ConfirmDeleteModal,
  ConfirmPermanentDeleteModal,
  ConfirmDeleteTeamModal,
  ConfirmDeleteTrainingGroupModal,
  ConfirmNewCardModal,
} from "./_components/MemberConfirmationModals";
import {
  normalizeMember,
  getTodayIsoDate,
  parseSelectedTeamGroup,
  buildCalendarMonths,
} from "./_utils/members-page-utils";
import {
  type Member,
  type ClubOption,
  type TrainingField,
  type ClubMatch,
  type PaymentWorkflow,
} from "./_types/members-page-types";

import { getCalendarDatesForMonth } from "./_utils/members-calendar";
import { useCoachGroups } from "./_hooks/useCoachGroups";
import { useMembersGuide } from "./_hooks/useMembersGuide";
import { useClubNotifications } from "./_hooks/useClubNotifications";
import { useMemberManagement } from "./_hooks/useMemberManagement";
import { useClubSettings } from "./_hooks/useClubSettings";
import { useTrainingGroups } from "./_hooks/useTrainingGroups";
import { useTrainingDaysForm } from "./_hooks/useTrainingDaysForm";
import { useTrainingAttendanceState } from "./_hooks/useTrainingAttendanceState";
import { useMatchEditorState } from "./_hooks/useMatchEditorState";
import { useCoachGroupAssignments } from "./_hooks/useCoachGroupAssignments";
import { useMemberNotifications } from "./_hooks/useMemberNotifications";
import { useMemberBirthdays } from "./_hooks/useMemberBirthdays";
import { MembersOverview } from "./_components/MembersOverview";
import { ClubNotificationsDialog } from "./_components/ClubNotificationsDialog";
import { MemberEditorDialog } from "./_components/MemberEditorDialog";
import { PaymentWorkflowDialog } from "./_components/PaymentWorkflowDialog";
import { ClubRulesDialog } from "./_components/ClubRulesDialog";
import { TrainingGroupModeDialog } from "./_components/TrainingGroupModeDialog";
import { MemberBirthdaysDialog } from "./_components/MemberBirthdaysDialog";
import { CoachGroupsDialog } from "./_components/CoachGroupsDialog";
import { MatchPreviewDialog } from "./_components/MatchPreviewDialog";
import { TrainingAttendanceDialog } from "./_components/TrainingAttendanceDialog";
import { TeamGroupWarningDialog } from "./_components/TeamGroupWarningDialog";
import { PostScheduleSaveDialog } from "./_components/PostScheduleSaveDialog";
import { TrainingGroupEditorDialog } from "./_components/TrainingGroupEditorDialog";
import { TrainingGroupCreateDialog } from "./_components/TrainingGroupCreateDialog";
import { ScheduleEventDialog } from "./_components/ScheduleEventDialog";
import { TrainingDaysEditorDialog } from "./_components/TrainingDaysEditorDialog";
import { TrainingFieldEditorDialog } from "./_components/TrainingFieldEditorDialog";
import { TrainingScheduleSuccessDialog } from "./_components/TrainingScheduleSuccessDialog";
import { TrainingDayDetailsDialog } from "./_components/TrainingDayDetailsDialog";
import { TrainingNotesDialog } from "./_components/TrainingNotesDialog";
import { ClubRemindersDialog } from "./_components/ClubRemindersDialog";
import { CoachGroupAssignmentsDialog } from "./_components/CoachGroupAssignmentsDialog";
import { MemberNotificationsDialog } from "./_components/MemberNotificationsDialog";
import { MembersGuideDialog } from "./_components/MembersGuideDialog";
import { downloadMemberLinks, downloadPlayersExcel } from "./_utils/member-exports";
import "./page.css";

import { createTrainingScheduleActions } from "./_actions/createTrainingScheduleActions";
import { createTrainingFieldActions } from "./_actions/createTrainingFieldActions";
import { createTrainingAttendanceActions } from "./_actions/createTrainingAttendanceActions";
import { createClubMatchActions } from "./_actions/createClubMatchActions";
import { createTrainingNoteActions } from "./_actions/createTrainingNoteActions";
import { createReminderSettingsActions } from "./_actions/createReminderSettingsActions";

function AdminMembersPageContent({ canUseSchedule2 }: { canUseSchedule2: boolean }) {
  const router = useRouter();

  const searchParams = useSearchParams();

  const clubId = searchParams.get("clubId") ?? "";

  const coachGroupId = searchParams.get("coachGroupId") ?? "";

  const [members, setMembers] = useState<Member[]>([]);

  const [isAdmin, setIsAdmin] = useState(false);

  const [isCoach, setIsCoach] = useState(false);

  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedGroup, setSelectedGroup] = useState("all");

  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);

  const [trainingGroupScope, setTrainingGroupScope] = useState("");

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [clubPlayerFields, setClubPlayerFields] = useState<string[]>([]);

  const [clubs, setClubs] = useState<ClubOption[]>([]);

  const [clubName, setClubName] = useState("Всички отбори");

  const [clubSport, setClubSport] = useState("");

  const [clubBillingStatus, setClubBillingStatus] = useState<string>("");

  const [clubPaymentWorkflow, setClubPaymentWorkflow] = useState<PaymentWorkflow>("calendar_month");

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

  const [inactivePlayersOpen, setInactivePlayersOpen] = useState(false);

  const [isDeletingTeam, setIsDeletingTeam] = useState(false);

  const [isTeamDeleteConfirmOpen, setIsTeamDeleteConfirmOpen] = useState(false);

  const [schedulerSettingsOpen, setSchedulerSettingsOpen] = useState(false);

  const [schedulerSettingsLoading, setSchedulerSettingsLoading] = useState(false);

  const [schedulerSettingsSaving, setSchedulerSettingsSaving] = useState(false);

  const [schedulerSettingsError, setSchedulerSettingsError] = useState("");

  const [secondReminderEnabled, setSecondReminderEnabled] = useState(false);

  const [thirdReminderEnabled, setThirdReminderEnabled] = useState(false);

  const [schedulerCalendarVisibleMonthIdx, setSchedulerCalendarVisibleMonthIdx] = useState(0);

  const [trainingNote, setTrainingNote] = useState("");

  const [trainingNoteSaving, setTrainingNoteSaving] = useState(false);

  const [trainingNoteTargetDates, setTrainingNoteTargetDates] = useState<string[]>([]);

  const [trainingBulkNoteOpen, setTrainingBulkNoteOpen] = useState(false);

  const [trainingNotesByDate, setTrainingNotesByDate] = useState<Record<string, string>>({});

  const [trainingNoteComparisonLoading, setTrainingNoteComparisonLoading] = useState(false);

  const [schedule2EventTarget, setSchedule2EventTarget] = useState<{ groupId: string; date?: string } | null>(null);
  const [scheduleEventModalOpen, setScheduleEventModalOpen] = useState(false);

  const [scheduleEventStep, setScheduleEventStep] = useState<
    "type" | "match-type" | "match-days" | "match-details"
  >("type");

  const [clubMatches, setClubMatches] = useState<ClubMatch[]>([]);

  const [postTeamGroupSavePromptOpen, setPostTeamGroupSavePromptOpen] = useState(false);

  const [postTeamGroupSavePromptGroupId, setPostTeamGroupSavePromptGroupId] = useState("");

  const [postTeamGroupSavePromptGroupName, setPostTeamGroupSavePromptGroupName] = useState("");

  const [teamGroupWarningModalOpen, setTeamGroupWarningModalOpen] = useState(false);

  const [pendingTeamGroupWarningGroups, setPendingTeamGroupWarningGroups] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const [importSheetsOpen, setImportSheetsOpen] = useState(false);

  const [importPhotosOpen, setImportPhotosOpen] = useState(false);

  const [activeDevicesOpen, setActiveDevicesOpen] = useState(false);

  const [coachMessageOpen, setCoachMessageOpen] = useState(false);

  const [trainingFields, setTrainingFields] = useState<TrainingField[]>([]);

  const [trainingFieldsLoading, setTrainingFieldsLoading] = useState(false);

  const [trainingFieldModalOpen, setTrainingFieldModalOpen] = useState(false);

  const [trainingFieldSaving, setTrainingFieldSaving] = useState(false);

  const [trainingFieldError, setTrainingFieldError] = useState("");

  const [trainingFieldEditId, setTrainingFieldEditId] = useState<string | null>(null);

  const [trainingFieldName, setTrainingFieldName] = useState("");

  const [trainingFieldType, setTrainingFieldType] = useState("football");

  const [trainingFieldPieces, setTrainingFieldPieces] = useState<Array<{ id: string | null; name: string }>>(
    [],
  );

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

  const coachGroupManagement = useCoachGroups({ clubId });

  const { coachGroups, loadCoachGroups } = coachGroupManagement;

  const membersGuide = useMembersGuide({ isAdmin });

  const trainingAttendanceState = useTrainingAttendanceState();

  const {
    trainingAttendanceOpen,
    setTrainingAttendanceHideTeamsTab,
    trainingAttendanceView,
    setTrainingAttendanceView,
    setTrainingAttendanceError,
    trainingAttendanceDate,
    setTrainingAttendanceDate,
    trainingAttendanceMonth,
    setTrainingAttendancePlayers,
    setTrainingAttendanceStats,
    trainingUpcomingDates,
    setTrainingUpcomingDates,
    trainingWeekSessions,
    trainingDayDetailsOpen,
    setTrainingDayDetailsOpen,
    trainingDayDetailsTab,
    schedule2Open,
    schedule2Week,
    schedule2Groups,
    schedule2Matches,
  } = trainingAttendanceState;

  const matchEditorState = useMatchEditorState();

  const { matchHistoryOpen, setMatchHistoryOpen, matchEditTarget } = matchEditorState;

  const memberManagement = useMemberManagement({
    clubs,
    clubId,
    clubPlayerFields,
    setMembers,
    setSelectedMember,
    setClubs,
    coachGroupId,
    refreshMembersList,
    router,
  });

  const {
    memberToEdit,
    memberToDelete,
    setMemberToDelete,
    deleteError,
    setDeleteError,
    isDeletingMember,
    isNewCardConfirmOpen,
    setIsNewCardConfirmOpen,
    isAssigningNewCard,
    reactivatingMemberId,
    setReactivatingMemberId,
    deletingPermanentMemberId,
    setDeletingPermanentMemberId,
    memberToPermanentDelete,
    setMemberToPermanentDelete,
    inactiveActionError,
    setInactiveActionError,
    handleDeleteMember,
    openEditMember,
    handleConfirmAssignNewCard,
    handleReactivateMember,
    handlePermanentDeleteMember,
  } = memberManagement;

  const clubSettings = useClubSettings({
    clubId,
    clubPaymentWorkflow,
    setClubPaymentWorkflow,
    setClubs,
    refreshMembersList,
  });

  const {
    paymentAmountModalOpen,
    setPaymentAmountModalOpen,
    feeAssignments,
    setFeeAssignments,
    feeDeleteGroupId,
    setFeeDeleteGroupId,
  } = clubSettings;

  const clubNotificationsController = useClubNotifications({
    clubId,
    coachGroupId,
    coachGroups,
    searchParams,
    router,
  });

  const trainingGroups = useTrainingGroups({
    coachGroupId,
    clubId,
    setTrainingAttendanceError,
    setTrainingAttendancePlayers,
    setTrainingAttendanceStats,
    setTrainingUpcomingDates,
    members,
    refreshMembersList,
    trainingAttendanceOpen,
    fetchTrainingAttendance: (...args) => fetchTrainingAttendance(...args),
    trainingAttendanceView,
    setTrainingAttendanceDate,
    setTrainingDayDetailsOpen,
    setTrainingBulkNoteOpen,
    setTrainingDaysEditorOpen: (...args) => setTrainingDaysEditorOpen(...args),
    setTrainingDaysEditorError: (...args) => setTrainingDaysEditorError(...args),
    setTrainingNoteTargetDates,
  });

  const {
    trainingGroupMode,
    setTrainingGroupMode,
    setTrainingGroupModeDraft,
    customGroupCreateSearch,
    trainingGroupDeleteConfirmOpen,
    setTrainingGroupDeleteConfirmOpen,
    trainingGroupDeleteSaving,
    customGroupEditSearch,
    selectedTrainingGroupId,
    setSelectedTrainingGroupId,
    trainingScheduleGroups,
    customTrainingGroups,
    isCustomTrainingGroupMode,
    customTrainingGroupCoachScope,
    openTrainingGroupEditModal,
    deleteSelectedTrainingGroup,
  } = trainingGroups;

  const coachGroupAssignments = useCoachGroupAssignments({ setFeeAssignments, clubId, refreshMembersList });

  const memberNotifications = useMemberNotifications({
    clubId,
    members,
    coachGroupId,
    isCustomTrainingGroupMode,
    customTrainingGroups,
    trainingScheduleGroups,
  });

  const memberBirthdays = useMemberBirthdays({ members, coachGroupId });

  const { facebookBirthday, setFacebookBirthday } = memberBirthdays;

  const groupOptions = [
    ...new Set(
      members
        .filter((m) => m.isActive)
        .map((m) => m.teamGroup)
        .filter((g): g is number => g !== null),
    ),
  ].sort((a, b) => a - b);

  const resolvedTrainingGroupScope = groupOptions.some((group) => String(group) === trainingGroupScope)
    ? trainingGroupScope
    : groupOptions[0]
      ? String(groupOptions[0])
      : "";

  const selectedTeamGroup = parseSelectedTeamGroup(resolvedTrainingGroupScope);

  const selectedTrainingGroup =
    trainingScheduleGroups.find((group) => group.id === selectedTrainingGroupId) ?? null;

  const selectedCustomGroup =
    customTrainingGroups.find((group) => group.id === selectedTrainingGroupId) ?? null;

  const trainingDaysForm = useTrainingDaysForm({
    clubId,
    selectedTrainingGroupId,
    selectedTeamGroup,
    trainingFields,
    setTrainingNoteTargetDates,
  });

  const {
    schedulerForm,
    setTrainingDaysEditorOpen,
    setTrainingDaysEditorSaving,
    setTrainingDaysEditorError,
    schedulerCalendarMonths,
  } = trainingDaysForm;

  const handleDownloadMemberLinks = () => downloadMemberLinks({ isAdmin, members, clubName });

  const handleDownloadPlayersExcel = () => downloadPlayersExcel({ isAdmin, members, clubSport, clubName });

  const reminderTimeValue = `${schedulerForm.reminderHour.padStart(2, "0")}:${schedulerForm.reminderMinute.padStart(2, "0")}`;

  const secondReminderTimeValue = `${schedulerForm.secondReminderHour.padStart(2, "0")}:${schedulerForm.secondReminderMinute.padStart(2, "0")}`;

  const thirdReminderTimeValue = `${schedulerForm.thirdReminderHour.padStart(2, "0")}:${schedulerForm.thirdReminderMinute.padStart(2, "0")}`;

  const overdueTimeValue = `${schedulerForm.overdueHour.padStart(2, "0")}:${schedulerForm.overdueMinute.padStart(2, "0")}`;

  const matchCalendarDates = getMatchCalendarDates();

  const matchCalendarDateSet = new Set(matchCalendarDates);

  const matchCalendarMonths = buildCalendarMonths(matchCalendarDates);

  const trimCalendarMonthCells = (months: ReturnType<typeof buildCalendarMonths>, fromDate: string) =>
    months.map((m) => {
      const firstIdx = m.cells.findIndex((d) => d !== null && d >= fromDate);
      return { ...m, cells: m.cells.slice(firstIdx >= 0 ? Math.floor(firstIdx / 7) * 7 : 0) };
    });

  const schedulerCalendarMonthsTrimmed = trimCalendarMonthCells(schedulerCalendarMonths, getTodayIsoDate());

  const matchCalendarMonthsTrimmed = trimCalendarMonthCells(matchCalendarMonths, getTodayIsoDate());

  const matchCalendarMatchesByDate = new Map<string, ClubMatch[]>();

  for (const match of clubMatches) {
    if (!matchCalendarDateSet.has(match.matchDate)) continue;
    const matchesForDate = matchCalendarMatchesByDate.get(match.matchDate) ?? [];
    matchesForDate.push(match);
    matchCalendarMatchesByDate.set(match.matchDate, matchesForDate);
  }

  const trainingUpcomingDateSet = new Set(trainingUpcomingDates.map((item) => item.date));

  const trainingUpcomingByDate = new Map(trainingUpcomingDates.map((item) => [item.date, item]));

  const trainingAttendanceCalendarDates = getCalendarDatesForMonth(trainingAttendanceMonth);

  const trainingAttendanceCalendarMonths = buildCalendarMonths(trainingAttendanceCalendarDates);

  const trainingAttendanceCalendarMonthsTrimmed = trimCalendarMonthCells(
    trainingAttendanceCalendarMonths,
    getTodayIsoDate(),
  );

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

  useEffect(() => {
    const select = document.querySelector(".amp-content > .amp-edit-field:first-child select");
    if (select) {
      // Trigger a reflow to force browser to calculate dropdown position early
      (select as HTMLSelectElement).focus();
      setTimeout(() => {
        (select as HTMLSelectElement).blur();
      }, 0);
    }
  }, []);

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
      window.alert(error instanceof Error ? error.message : "Възникна грешка при изтриване на отбора.");
    } finally {
      setIsDeletingTeam(false);
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
        setIsAdmin(
          Boolean(payload.isAdmin) || (Array.isArray(payload.roles) && payload.roles.includes("admin")),
        );
        setIsCoach(
          Boolean(payload.isCoach) || (Array.isArray(payload.roles) && payload.roles.includes("coach")),
        );
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
                  typeof club === "object" && club !== null ? (club as { id?: unknown; name?: unknown }) : {};
                return String(item.id ?? "") === clubId;
              })
            : null;

          if (!selectedClub || typeof selectedClub.name !== "string" || !selectedClub.name.trim()) {
            router.replace("/404");
            return;
          }

          setClubPlayerFields(Array.isArray(selectedClub.playerFields) ? selectedClub.playerFields : []);
          setClubName(selectedClub.name.trim());
          const selectedSport = (selectedClub as Record<string, unknown>).sports;
          setClubSport(typeof selectedSport === "string" ? selectedSport.trim() : "");
          const selectedMode = (selectedClub as Record<string, unknown>).trainingGroupMode;
          setTrainingGroupMode(selectedMode === "custom_group" ? "custom_group" : "team_group");
          setTrainingGroupModeDraft(selectedMode === "custom_group" ? "custom_group" : "team_group");

          const billing = (selectedClub as Record<string, unknown>).billingStatus;
          setClubBillingStatus(typeof billing === "string" ? billing : "");
          const workflow = (selectedClub as Record<string, unknown>).paymentWorkflow;
          setClubPaymentWorkflow(
            workflow === "rolling_30_days"
              ? "rolling_30_days"
              : workflow === "training_credits"
                ? "training_credits"
                : workflow === "training_credits_30_days"
                  ? "training_credits_30_days"
                  : "calendar_month",
          );

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
        const endpoint = fetchParams.toString()
          ? `/api/admin/members?${fetchParams.toString()}`
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
              const item = typeof club === "object" && club !== null ? (club as { id?: unknown }) : {};
              return String(item.id ?? "") === clubId;
            })
          : null;
        setClubPlayerFields(Array.isArray(selectedClub?.playerFields) ? selectedClub.playerFields : []);
        if (selectedClub?.name) {
          setClubName(String(selectedClub.name));
        }
        const selectedSport = (selectedClub as Record<string, unknown> | null)?.sports;
        setClubSport(typeof selectedSport === "string" ? selectedSport.trim() : "");
        const selectedMode = (selectedClub as Record<string, unknown> | null)?.trainingGroupMode;
        setTrainingGroupMode(selectedMode === "custom_group" ? "custom_group" : "team_group");
        setTrainingGroupModeDraft(selectedMode === "custom_group" ? "custom_group" : "team_group");
        const billing = (selectedClub as Record<string, unknown> | null)?.billingStatus;
        setClubBillingStatus(typeof billing === "string" ? billing : "");
        const workflow = (selectedClub as Record<string, unknown> | null)?.paymentWorkflow;
        setClubPaymentWorkflow(
          workflow === "rolling_30_days"
            ? "rolling_30_days"
            : workflow === "training_credits"
              ? "training_credits"
              : workflow === "training_credits_30_days"
                ? "training_credits_30_days"
                : "calendar_month",
        );

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
  }, [clubId, coachGroupId, router]);

  const canViewInactiveMembers = isAdmin || isCoach;

  useEffect(() => {
    if (!canViewInactiveMembers) {
      setInactivePlayersOpen(false);
      setReactivatingMemberId(null);
      setDeletingPermanentMemberId(null);
      setMemberToPermanentDelete(null);
      setInactiveActionError("");
    }
  }, [canViewInactiveMembers]);

  useEffect(() => {
    setSelectedGroup("all");
  }, [trainingGroupMode]);

  const canManageMemberActions = isAdmin || isCoach || !searchParams.has("coachGroupId");

  const activeMembersByGroup = members.reduce<Record<number, number>>((acc, member) => {
    if (!member.isActive || member.teamGroup === null) {
      return acc;
    }
    acc[member.teamGroup] = (acc[member.teamGroup] ?? 0) + 1;
    return acc;
  }, {});

  const currentCoachGroupName = coachGroupId
    ? (coachGroups.find((group) => group.id === coachGroupId)?.name.trim() ?? "")
    : "";

  const weekSessionColorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const group of customTrainingGroups) {
      if (
        (group.coachGroupId ?? null) === customTrainingGroupCoachScope &&
        group.color &&
        isCustomTrainingGroupPaletteColor(group.color)
      ) {
        seen.set(group.color, group.name);
      }
    }
    for (const s of trainingWeekSessions) {
      if (coachGroupId) continue;
      if (s.color && isCustomTrainingGroupPaletteColor(s.color) && !seen.has(s.color)) {
        const group = customTrainingGroups.find((g) => g.color === s.color);
        seen.set(s.color, group?.name ?? "");
      }
    }
    return Array.from(seen.entries()).map(([color, label]) => ({ color, label }));
  }, [trainingWeekSessions, customTrainingGroups, customTrainingGroupCoachScope, coachGroupId]);

  const trainingAttendanceMatchesByDate = new Map<string, ClubMatch[]>();

  for (const match of clubMatches) {
    const appliesToAll = match.teamGroups.length === 0 && match.customGroupId === null;
    const appliesToSelectedTeam = selectedTeamGroup === null || match.teamGroups.includes(selectedTeamGroup);
    const appliesToSelectedTrainingGroup =
      selectedTrainingGroup?.teamGroups.some((teamGroup) => match.teamGroups.includes(teamGroup)) ?? false;
    let appliesToCurrentScope: boolean;
    if (match.customGroupId !== null) {
      appliesToCurrentScope = isCustomTrainingGroupMode && match.customGroupId === selectedCustomGroup?.id;
    } else {
      appliesToCurrentScope =
        appliesToAll ||
        (isCustomTrainingGroupMode
          ? false
          : trainingAttendanceView === "trainingGroups"
            ? appliesToSelectedTrainingGroup
            : appliesToSelectedTeam);
    }
    if (!appliesToCurrentScope) continue;
    const matchesForDate = trainingAttendanceMatchesByDate.get(match.matchDate) ?? [];
    matchesForDate.push(match);
    trainingAttendanceMatchesByDate.set(match.matchDate, matchesForDate);
  }

  const schedule2DayDetails = schedule2Open && trainingAttendanceOpen && !matchEditTarget;
  const matchEditCustomGroups = schedule2DayDetails ? schedule2Groups : customTrainingGroups;
  const dayDetailsDate = trainingDayDetailsOpen ? (trainingAttendanceDate ?? "") : "";

  const dayDetailsSessions = dayDetailsDate
    ? trainingWeekSessions.filter((s) => s.date === dayDetailsDate && s.eventType !== "match")
    : [];

  const dayDetailsMatchesAll: ClubMatch[] = dayDetailsDate
    ? (schedule2DayDetails ? schedule2Matches : clubMatches).filter((m) => m.matchDate === dayDetailsDate)
    : [];

  const dayDetailsHasTabs = schedule2DayDetails
    ? dayDetailsSessions.length + dayDetailsMatchesAll.length > 1
    : dayDetailsSessions.length > 1 || dayDetailsMatchesAll.length > 0;

  const dayDetailsIsMatchTab = trainingDayDetailsTab.startsWith("match-");

  const dayDetailsActiveMatch = dayDetailsIsMatchTab
    ? (matchEditTarget ?? dayDetailsMatchesAll.find((m) => `match-${m.id}` === trainingDayDetailsTab) ?? null)
    : null;

  const activeMemberIdSet = new Set(members.filter((m) => m.isActive).map((m) => m.id));

  const activeMembersByCustomGroup = customTrainingGroups.reduce<Record<string, number>>((acc, group) => {
    acc[group.id] = group.playerIds.filter((id) => activeMemberIdSet.has(id)).length;
    return acc;
  }, {});

  const availablePlayersForCustomGroupCreate = members.filter((member) => member.isActive);

  const availablePlayersForCustomGroupEdit = members.filter((member) => member.isActive);

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

  const unifiedGroupScopeValue = isCustomTrainingGroupMode
    ? selectedTrainingGroupId || ""
    : trainingAttendanceView === "trainingGroups"
      ? selectedTrainingGroupId || ""
      : `year:${resolvedTrainingGroupScope}`;

  const selectedCustomTrainingGroupDotColor =
    isCustomTrainingGroupMode && selectedTrainingGroupId
      ? (() => {
          const g = customTrainingGroups.find((item) => item.id === selectedTrainingGroupId);
          return g?.color && isCustomTrainingGroupPaletteColor(g.color) ? g.color : null;
        })()
      : null;

  const selectedTeamGroupLinkedTrainingGroups =
    selectedTeamGroup === null
      ? []
      : trainingScheduleGroups.filter((group) => group.teamGroups.includes(selectedTeamGroup));

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

    const matchGroup =
      selectedGroup === "all" ||
      (isCustomTrainingGroupMode
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

  const handlePostTeamGroupSavePromptConfirm = async () => {
    setPostTeamGroupSavePromptOpen(false);
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingAttendanceError("");
    setTrainingNoteTargetDates([]);
    setTrainingAttendanceHideTeamsTab(false);
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
                search.set(
                  isCustomTrainingGroupMode ? "customTrainingGroupId" : "trainingGroupId",
                  selectedTrainingGroupId,
                );
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
    if (!trainingAttendanceOpen || schedule2Open || !clubId || !trainingAttendanceDate || trainingAttendanceView === "today") {
      return;
    }

    const search = new URLSearchParams({ date: trainingAttendanceDate });
    if (trainingAttendanceView === "trainingGroups") {
      if (selectedTrainingGroupId) {
        search.set(
          isCustomTrainingGroupMode ? "customTrainingGroupId" : "trainingGroupId",
          selectedTrainingGroupId,
        );
      }
    } else if (selectedTeamGroup !== null) {
      search.set("teamGroup", String(selectedTeamGroup));
    }
    const streamUrl =
      `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance/stream` + `?${search.toString()}`;
    const source = new EventSource(streamUrl, { withCredentials: true });

    const handleUpdate = () => {
      void fetchTrainingAttendance(
        trainingAttendanceDate,
        undefined,
        undefined,
        undefined,
        trainingAttendanceMonth,
      );
    };

    source.addEventListener("attendance-update", handleUpdate);

    return () => {
      source.removeEventListener("attendance-update", handleUpdate);
      source.close();
    };
  }, [
    trainingAttendanceOpen,
    schedule2Open,
    clubId,
    trainingAttendanceDate,
    trainingAttendanceMonth,
    selectedTeamGroup,
    trainingAttendanceView,
    selectedTrainingGroupId,
  ]);

  useEffect(() => {
    if (!trainingAttendanceOpen || !clubId || (!schedule2Open && trainingAttendanceView !== "today")) {
      return;
    }
    const streamUrl = `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance/stream`;
    const source = new EventSource(streamUrl, { withCredentials: true });
    const handleUpdate = () => {
      void fetchTrainingWeekSessions({ silent: true });
    };
    source.addEventListener("attendance-update", handleUpdate);
    return () => {
      source.removeEventListener("attendance-update", handleUpdate);
      source.close();
    };
  }, [trainingAttendanceOpen, clubId, trainingAttendanceView, schedule2Open, schedule2Week, canUseSchedule2]);

  useEffect(() => {
    if (!trainingAttendanceOpen || !clubId || (!schedule2Open && trainingAttendanceView !== "today")) {
      return;
    }
    const interval = window.setInterval(() => {
      void fetchTrainingWeekSessions({ silent: true });
    }, 15000);
    return () => {
      window.clearInterval(interval);
    };
  }, [trainingAttendanceOpen, clubId, trainingAttendanceView, schedule2Open, schedule2Week, canUseSchedule2]);

  useEffect(() => {
    if (!trainingAttendanceOpen || !clubId || (!schedule2Open && trainingAttendanceView !== "today")) {
      return;
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchTrainingWeekSessions({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [trainingAttendanceOpen, clubId, trainingAttendanceView, schedule2Open, schedule2Week, canUseSchedule2]);

  const trainingScheduleActions = createTrainingScheduleActions({
    schedulerCalendarMonthsTrimmed,
    setSchedulerCalendarVisibleMonthIdx,
    setSchedule2Error: trainingAttendanceState.setSchedule2Error,
    trainingDaysForm,
    trainingGroups,
    trainingAttendanceState,
    clubId,
    coachGroupId,
    trainingNote,
    loadTrainingFields: (...args) => loadTrainingFields(...args),
    selectedTeamGroup,
    setSecondReminderEnabled,
    setThirdReminderEnabled,
    secondReminderEnabled,
    thirdReminderEnabled,
    fetchTrainingAttendance: (...args) => fetchTrainingAttendance(...args),
    setPostTeamGroupSavePromptGroupId,
    setPostTeamGroupSavePromptGroupName,
    setPostTeamGroupSavePromptOpen,
    todayIsoDate,
    fetchTrainingWeekSessions: (...args) => fetchTrainingWeekSessions(...args),
    selectedTeamGroupLinkedTrainingGroups,
    setPendingTeamGroupWarningGroups,
    setTeamGroupWarningModalOpen,
  });
  const {
    openTrainingDaysEditor,
    executeTeamGroupTrainingDaysSave,
    saveTrainingDaysFromTrainingModal,
    saveTrainingDaysForSelectedGroups,
  } = trainingScheduleActions;

  const trainingFieldActions = createTrainingFieldActions({
    trainingDaysForm,
    clubId,
    setTrainingFieldsLoading,
    setTrainingFields,
    setTrainingFieldError,
    setTrainingFieldEditId,
    setTrainingFieldName,
    setTrainingFieldType,
    setTrainingFieldPieces,
    clubSport,
    setTrainingFieldModalOpen,
    trainingFieldSaving,
    setTrainingFieldSaving,
    trainingFieldEditId,
    trainingFieldName,
    trainingFieldType,
    trainingFieldPieces,
  });
  const { loadTrainingFields, openTrainingFieldModal, saveTrainingField, deleteTrainingField } =
    trainingFieldActions;

  const trainingAttendanceActions = createTrainingAttendanceActions({
    canUseSchedule2,
    trainingAttendanceState,
    trainingGroups,
    trainingDaysForm,
    matchEditorState,
    clubId,
    trainingGroupScope,
    coachGroupId,
    currentCoachGroupName,
    setTrainingNote,
    setTrainingNotesByDate,
    setTrainingNoteTargetDates,
    setPostTeamGroupSavePromptOpen,
    setTrainingBulkNoteOpen,
    setSchedulerCalendarVisibleMonthIdx,
    fetchClubMatches: (...args) => fetchClubMatches(...args),
    standaloneTeamGroups,
    setTrainingGroupScope,
    resolvedTrainingGroupScope,
    openTrainingDaysEditor: (...args) => openTrainingDaysEditor(...args),
    trainingUpcomingByDate,
  });
  const {
    fetchTrainingAttendance,
    fetchTrainingWeekSessions,
    openTrainingAttendance,
    closeTrainingAttendance,
    handleTrainingAttendanceViewChange,
    handleTrainingAttendanceMonthChange,
    handleUnifiedGroupChange,
    openTrainingDaysEditorForCurrentScope,
    openSingleTrainingDayEditForCurrentScope,
    fetchLimitedEventForSession,
    openTrainingDayDetails,
    dismissSchedule2Details,
    loadDayDetailsSessionAttendance,
    handleDeleteTrainingDay,
  } = trainingAttendanceActions;

  const schedule2EventGroup = schedule2Groups.find((group) => group.id === schedule2EventTarget?.groupId);
  const openScheduleEvent = (target?: { groupId: string; date?: string }) => {
    if (target && trainingDaysForm.trainingDaysEditorRequest.current !== null) return;
    setSchedule2EventTarget(target ?? null);
    setScheduleEventStep("type");
    matchEditorState.setMatchSelectedDates([]);
    matchEditorState.setMatchDetailsPerDay({});
    matchEditorState.setMatchExistingIdByDate({});
    matchEditorState.setMatchEditorError("");
    matchEditorState.setMatchCalendarVisibleMonthIdx(0);
    setScheduleEventModalOpen(true);
    void fetchClubMatches();
  };

  const clubMatchActions = createClubMatchActions({
    schedule2EventTarget,
    schedule2EventGroup,
    matchEditorState,
    trainingGroups,
    trainingAttendanceState,
    trainingDaysForm,
    clubId,
    setClubMatches,
    selectedCustomGroup,
    setScheduleEventModalOpen,
    fetchTrainingWeekSessions: (...args) => fetchTrainingWeekSessions(...args),
    dayDetailsActiveMatch,
  });
  const {
    fetchClubMatches,
    toggleMatchDate,
    handleSaveMatch,
    handleDayDetailsMatchSave,
    handleDayDetailsMatchDelete,
  } = clubMatchActions;

  const trainingNoteActions = createTrainingNoteActions({
    trainingAttendanceState,
    trainingGroups,
    clubId,
    trainingNoteSaving,
    setTrainingNoteSaving,
    trainingNote,
    setTrainingBulkNoteOpen,
    trainingNoteTargetDates,
    selectedTeamGroup,
    setTrainingNotesByDate,
    trainingNoteScopeKey,
    fetchTrainingAttendance: (...args) => fetchTrainingAttendance(...args),
  });
  const { saveTrainingNote } = trainingNoteActions;

  const reminderSettingsActions = createReminderSettingsActions({
    trainingDaysForm,
    setSecondReminderEnabled,
    setThirdReminderEnabled,
    clubId,
    setSchedulerSettingsError,
    setSchedulerSettingsLoading,
    setSchedulerSettingsOpen,
    selectedTeamGroup,
    schedulerSettingsSaving,
    setSchedulerSettingsSaving,
    secondReminderEnabled,
    thirdReminderEnabled,
  });
  const {
    enableSecondReminder,
    disableSecondReminder,
    enableThirdReminder,
    disableThirdReminder,
    openSchedulerSettings,
    saveSchedulerSettings,
  } = reminderSettingsActions;

  return (
    <main className="amp-page">
      <div className="amp-dot-grid" aria-hidden="true" />

      <MembersOverview
        canUseSchedule2={canUseSchedule2}
        clubNotificationsController={clubNotificationsController}
        memberManagement={memberManagement}
        trainingGroups={trainingGroups}
        coachGroupManagement={coachGroupManagement}
        memberBirthdays={memberBirthdays}
        matchEditorState={matchEditorState}
        clubSettings={clubSettings}
        memberNotifications={memberNotifications}
        membersGuide={membersGuide}
        coachGroupAssignments={coachGroupAssignments}
        isAdmin={isAdmin}
        searchParams={searchParams}
        router={router}
        clubId={clubId}
        isCoach={isCoach}
        members={members}
        clubLogoUrl={clubLogoUrl}
        clubName={clubName}
        currentCoachGroupName={currentCoachGroupName}
        clubBillingStatus={clubBillingStatus}
        coachGroupId={coachGroupId}
        setImportSheetsOpen={setImportSheetsOpen}
        setImportPhotosOpen={setImportPhotosOpen}
        handleDownloadPlayersExcel={handleDownloadPlayersExcel}
        canViewInactiveMembers={canViewInactiveMembers}
        refreshMembersList={refreshMembersList}
        setInactivePlayersOpen={setInactivePlayersOpen}
        setReportsOpen={setReportsOpen}
        openSchedulerSettings={openSchedulerSettings}
        openTrainingAttendance={openTrainingAttendance}
        setAttendanceDashboardOpen={setAttendanceDashboardOpen}
        handleDownloadMemberLinks={handleDownloadMemberLinks}
        canManageMemberActions={canManageMemberActions}
        isDeletingTeam={isDeletingTeam}
        setIsTeamDeleteConfirmOpen={setIsTeamDeleteConfirmOpen}
        searchTerm={searchTerm}
        selectedGroup={selectedGroup}
        setActiveDevicesOpen={setActiveDevicesOpen}
        setIsGroupDropdownOpen={setIsGroupDropdownOpen}
        isGroupDropdownOpen={isGroupDropdownOpen}
        activeMembersCount={activeMembersCount}
        activeMembersByCustomGroup={activeMembersByCustomGroup}
        activeMembersByGroup={activeMembersByGroup}
        setSelectedGroup={setSelectedGroup}
        groupOptions={groupOptions}
        setSearchTerm={setSearchTerm}
        loading={loading}
        filtered={filtered}
        setSelectedMember={setSelectedMember}
      />

      <ClubNotificationsDialog
        clubNotificationsController={clubNotificationsController}
        todayIsoDate={todayIsoDate}
      />

      {/* Detail modal */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          actionMode={selectedMember.isActive ? "active" : "inactive"}
          isCoach={isCoach}
          showManagementActions={canManageMemberActions}
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
          coachGroups={(isAdmin || isCoach) && coachGroups.length > 0 ? coachGroups : undefined}
          onFeeConflict={(memberId, ids) => {
            setFeeAssignments({ [memberId]: ids });
            setPaymentAmountModalOpen(true);
          }}
          onCoachGroupAssigned={(memberId, newCoachGroupIds) => {
            setMembers((prev) =>
              prev.map((m) => (m.id === memberId ? { ...m, coachGroupIds: newCoachGroupIds } : m)),
            );
            setSelectedMember((prev) =>
              prev?.id === memberId ? { ...prev, coachGroupIds: newCoachGroupIds } : prev,
            );
          }}
        />
      )}
      <MemberEditorDialog
        memberManagement={memberManagement}
        trainingAttendanceState={trainingAttendanceState}
        isAdmin={isAdmin}
        clubs={clubs}
        coachGroupId={coachGroupId}
      />
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
      <PaymentWorkflowDialog clubSettings={clubSettings} isAdmin={isAdmin} clubId={clubId} />
      {paymentAmountModalOpen && (isAdmin || isCoach) && clubId && (
        <MonthlyFeeModal
          clubId={clubId}
          assignments={feeAssignments}
          deleteGroupId={feeDeleteGroupId}
          onClose={() => {
            setPaymentAmountModalOpen(false);
            setFeeAssignments(undefined);
            setFeeDeleteGroupId(undefined);
          }}
          onSaved={() => {
            window.location.reload();
          }}
        />
      )}
      <ClubRulesDialog clubSettings={clubSettings} isAdmin={isAdmin} isCoach={isCoach} clubId={clubId} />
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
      {isTeamDeleteConfirmOpen && isAdmin && clubId && canManageMemberActions && (
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
      <TrainingGroupModeDialog
        trainingGroups={trainingGroups}
        isAdmin={isAdmin}
        clubPlayerFields={clubPlayerFields}
        clubId={clubId}
      />
      {isAdmin && facebookBirthday && (
        <FacebookBirthdayModal
          key={`${facebookBirthday.member.id}-${facebookBirthday.date}`}
          clubId={clubId}
          coachGroupId={coachGroupId || undefined}
          playerId={facebookBirthday.member.id}
          playerName={facebookBirthday.member.fullName}
          birthdayDate={facebookBirthday.date}
          onClose={() => setFacebookBirthday(null)}
        />
      )}
      <MemberBirthdaysDialog
        memberBirthdays={memberBirthdays}
        selectedMember={selectedMember}
        coachGroupId={coachGroupId}
        currentCoachGroupName={currentCoachGroupName}
        clubName={clubName}
        isAdmin={isAdmin}
        isCoach={isCoach}
        clubId={clubId}
        setSelectedMember={setSelectedMember}
      />
      <CoachGroupsDialog
        coachGroupManagement={coachGroupManagement}
        clubSettings={clubSettings}
        isAdmin={isAdmin}
        isCoach={isCoach}
        clubId={clubId}
        refreshMembersList={refreshMembersList}
      />
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
      {matchHistoryOpen && clubId && (
        <MatchHistoryModal
          clubId={clubId}
          clubName={clubName}
          clubLogoUrl={clubLogoUrl}
          coachGroupId={coachGroupId || undefined}
          coachGroupName={coachGroups.find((group) => group.id === coachGroupId)?.name}
          onClose={() => setMatchHistoryOpen(false)}
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

      <MatchPreviewDialog
        matchEditorState={matchEditorState}
        trainingAttendanceState={trainingAttendanceState}
        clubId={clubId}
      />
      <TrainingAttendanceDialog
        canUseSchedule2={canUseSchedule2}
        closeTrainingAttendance={closeTrainingAttendance}
        openScheduleEvent={openScheduleEvent}
        fetchTrainingWeekSessions={fetchTrainingWeekSessions}
        trainingAttendanceState={trainingAttendanceState}
        trainingDaysForm={trainingDaysForm}
        trainingGroups={trainingGroups}
        matchEditorState={matchEditorState}
        trainingNoteSaving={trainingNoteSaving}
        handleTrainingAttendanceViewChange={handleTrainingAttendanceViewChange}
        weekSessionColorOptions={weekSessionColorOptions}
        selectedCustomGroup={selectedCustomGroup}
        todayIsoDate={todayIsoDate}
        openTrainingDayDetails={openTrainingDayDetails}
        standaloneTeamGroups={standaloneTeamGroups}
        coachGroupId={coachGroupId}
        currentCoachGroupName={currentCoachGroupName}
        selectedCustomTrainingGroupDotColor={selectedCustomTrainingGroupDotColor}
        unifiedGroupScopeValue={unifiedGroupScopeValue}
        handleUnifiedGroupChange={handleUnifiedGroupChange}
        handleTrainingAttendanceMonthChange={handleTrainingAttendanceMonthChange}
        trainingAttendanceCalendarMonths={trainingAttendanceCalendarMonths}
        trainingAttendanceCalendarMonthsTrimmed={trainingAttendanceCalendarMonthsTrimmed}
        trainingUpcomingByDate={trainingUpcomingByDate}
        trainingAttendanceMatchesByDate={trainingAttendanceMatchesByDate}
        trainingUpcomingDateSet={trainingUpcomingDateSet}
        saveTrainingDaysForSelectedGroups={saveTrainingDaysForSelectedGroups}
        trainingNoteTargetDates={trainingNoteTargetDates}
        setTrainingNoteTargetDates={setTrainingNoteTargetDates}
        trainingNote={trainingNote}
        setTrainingNote={setTrainingNote}
      />
      <TeamGroupWarningDialog
        trainingDaysForm={trainingDaysForm}
        teamGroupWarningModalOpen={teamGroupWarningModalOpen}
        handleTeamGroupWarningCancel={handleTeamGroupWarningCancel}
        selectedTeamGroup={selectedTeamGroup}
        pendingTeamGroupWarningGroups={pendingTeamGroupWarningGroups}
        handleTeamGroupWarningConfirm={handleTeamGroupWarningConfirm}
      />
      <PostScheduleSaveDialog
        postTeamGroupSavePromptOpen={postTeamGroupSavePromptOpen}
        setPostTeamGroupSavePromptOpen={setPostTeamGroupSavePromptOpen}
        postTeamGroupSavePromptGroupName={postTeamGroupSavePromptGroupName}
        handlePostTeamGroupSavePromptConfirm={handlePostTeamGroupSavePromptConfirm}
      />
      <TrainingGroupEditorDialog
        trainingGroups={trainingGroups}
        availablePlayersForCustomGroupEdit={availablePlayersForCustomGroupEdit}
        filteredPlayersForCustomGroupEdit={filteredPlayersForCustomGroupEdit}
        groupOptions={groupOptions}
      />
      <TrainingGroupCreateDialog
        trainingGroups={trainingGroups}
        availablePlayersForCustomGroupCreate={availablePlayersForCustomGroupCreate}
        filteredPlayersForCustomGroupCreate={filteredPlayersForCustomGroupCreate}
        groupOptions={groupOptions}
      />
      <ScheduleEventDialog
        schedule2EventTarget={schedule2EventTarget}
        schedule2EventGroup={schedule2EventGroup}
        schedule2CanCreateTraining={trainingAttendanceState.schedule2CanCreateTraining}
        openTrainingDaysEditor={openTrainingDaysEditor}
        matchEditorState={matchEditorState}
        trainingAttendanceState={trainingAttendanceState}
        trainingGroups={trainingGroups}
        scheduleEventModalOpen={scheduleEventModalOpen}
        setScheduleEventModalOpen={setScheduleEventModalOpen}
        setScheduleEventStep={setScheduleEventStep}
        scheduleEventStep={scheduleEventStep}
        openTrainingDaysEditorForCurrentScope={openTrainingDaysEditorForCurrentScope}
        selectedTrainingGroup={selectedTrainingGroup}
        selectedTeamGroup={selectedTeamGroup}
        selectedCustomGroup={selectedCustomGroup}
        matchCalendarMonthsTrimmed={matchCalendarMonthsTrimmed}
        matchCalendarMonths={matchCalendarMonths}
        matchCalendarDateSet={matchCalendarDateSet}
        matchCalendarMatchesByDate={matchCalendarMatchesByDate}
        toggleMatchDate={toggleMatchDate}
        clubId={clubId}
        handleSaveMatch={handleSaveMatch}
      />
      <TrainingDaysEditorDialog
        trainingDaysForm={trainingDaysForm}
        trainingGroups={trainingGroups}
        coachGroupManagement={coachGroupManagement}
        selectedTrainingGroup={selectedTrainingGroup}
        selectedCustomGroup={selectedCustomGroup}
        coachGroupId={coachGroupId}
        selectedTeamGroup={selectedTeamGroup}
        selectedTeamGroupLinkedTrainingGroups={selectedTeamGroupLinkedTrainingGroups}
        groupOptions={groupOptions}
        schedulerCalendarMonthsTrimmed={schedulerCalendarMonthsTrimmed}
        setSchedulerCalendarVisibleMonthIdx={setSchedulerCalendarVisibleMonthIdx}
        schedulerCalendarVisibleMonthIdx={schedulerCalendarVisibleMonthIdx}
        todayIsoDate={todayIsoDate}
        trainingFields={trainingFields}
        trainingFieldsLoading={trainingFieldsLoading}
        openTrainingFieldModal={openTrainingFieldModal}
        saveTrainingDaysForSelectedGroups={saveTrainingDaysForSelectedGroups}
        saveTrainingDaysFromTrainingModal={saveTrainingDaysFromTrainingModal}
      />
      <TrainingFieldEditorDialog
        trainingFieldModalOpen={trainingFieldModalOpen}
        trainingFieldSaving={trainingFieldSaving}
        setTrainingFieldModalOpen={setTrainingFieldModalOpen}
        trainingFieldEditId={trainingFieldEditId}
        trainingFieldType={trainingFieldType}
        setTrainingFieldType={setTrainingFieldType}
        trainingFieldName={trainingFieldName}
        setTrainingFieldName={setTrainingFieldName}
        trainingFieldPieces={trainingFieldPieces}
        setTrainingFieldPieces={setTrainingFieldPieces}
        trainingFieldError={trainingFieldError}
        deleteTrainingField={deleteTrainingField}
        saveTrainingField={saveTrainingField}
      />
      <TrainingScheduleSuccessDialog trainingDaysForm={trainingDaysForm} />
      <TrainingDayDetailsDialog
        schedule2DayDetails={schedule2DayDetails}
        dismissSchedule2Details={dismissSchedule2Details}
        matchEditCustomGroups={matchEditCustomGroups}
        schedulerCalendarDateSet={trainingDaysForm.schedulerCalendarDateSet}
        trainingAttendanceState={trainingAttendanceState}
        matchEditorState={matchEditorState}
        trainingGroups={trainingGroups}
        trainingNoteSaving={trainingNoteSaving}
        dayDetailsIsMatchTab={dayDetailsIsMatchTab}
        dayDetailsHasTabs={dayDetailsHasTabs}
        dayDetailsSessions={dayDetailsSessions}
        loadDayDetailsSessionAttendance={loadDayDetailsSessionAttendance}
        dayDetailsMatchesAll={dayDetailsMatchesAll}
        dayDetailsActiveMatch={dayDetailsActiveMatch}
        clubId={clubId}
        handleDayDetailsMatchSave={handleDayDetailsMatchSave}
        handleDayDetailsMatchDelete={handleDayDetailsMatchDelete}
        trainingNote={trainingNote}
        openSingleTrainingDayEditForCurrentScope={openSingleTrainingDayEditForCurrentScope}
        handleDeleteTrainingDay={handleDeleteTrainingDay}
        fetchLimitedEventForSession={fetchLimitedEventForSession}
      />
      <TrainingNotesDialog
        trainingDaysForm={trainingDaysForm}
        trainingAttendanceState={trainingAttendanceState}
        trainingBulkNoteOpen={trainingBulkNoteOpen}
        setTrainingBulkNoteOpen={setTrainingBulkNoteOpen}
        trainingNoteSaving={trainingNoteSaving}
        trainingAttendanceCalendarMonths={trainingAttendanceCalendarMonths}
        trainingUpcomingByDate={trainingUpcomingByDate}
        trainingAttendanceMatchesByDate={trainingAttendanceMatchesByDate}
        trainingUpcomingDateSet={trainingUpcomingDateSet}
        trainingNoteTargetDates={trainingNoteTargetDates}
        todayIsoDate={todayIsoDate}
        trainingNote={trainingNote}
        setTrainingNote={setTrainingNote}
        isTrainingNoteSameAsExisting={isTrainingNoteSameAsExisting}
        saveTrainingNote={saveTrainingNote}
        trainingNoteComparisonLoading={trainingNoteComparisonLoading}
        effectiveTrainingNoteTargetDates={effectiveTrainingNoteTargetDates}
      />
      {inactivePlayersOpen && canViewInactiveMembers && canManageMemberActions && (
        <InactivePlayersModal
          members={inactiveMembers}
          isCovered={Boolean(selectedMember)}
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
            setSelectedMember(member);
          }}
          onReactivate={handleReactivateMember}
          onBulkDelete={async (selectedMembers) => {
            if (reactivatingMemberId || deletingPermanentMemberId) return;
            setInactiveActionError("");
            const failedNames: string[] = [];
            try {
              for (const member of selectedMembers) {
                setDeletingPermanentMemberId(member.id);
                try {
                  const response = await fetch(`/api/admin/members/${member.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "delete_permanently" }),
                  });
                  if (!response.ok) {
                    failedNames.push(member.fullName);
                    continue;
                  }
                  setMembers((previous) => previous.filter((item) => item.id !== member.id));
                  setSelectedMember((previous) => (previous?.id === member.id ? null : previous));
                } catch {
                  failedNames.push(member.fullName);
                }
              }
              if (failedNames.length > 0) {
                setInactiveActionError(`Неуспешно изтриване: ${failedNames.join(", ")}. Опитай отново.`);
              }
            } finally {
              setDeletingPermanentMemberId(null);
            }
          }}
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
      <ClubRemindersDialog
        trainingDaysForm={trainingDaysForm}
        schedulerSettingsOpen={schedulerSettingsOpen}
        schedulerSettingsSaving={schedulerSettingsSaving}
        setSchedulerSettingsOpen={setSchedulerSettingsOpen}
        schedulerSettingsLoading={schedulerSettingsLoading}
        reminderTimeValue={reminderTimeValue}
        secondReminderEnabled={secondReminderEnabled}
        enableSecondReminder={enableSecondReminder}
        secondReminderTimeValue={secondReminderTimeValue}
        disableSecondReminder={disableSecondReminder}
        thirdReminderEnabled={thirdReminderEnabled}
        enableThirdReminder={enableThirdReminder}
        thirdReminderTimeValue={thirdReminderTimeValue}
        disableThirdReminder={disableThirdReminder}
        overdueTimeValue={overdueTimeValue}
        schedulerSettingsError={schedulerSettingsError}
        saveSchedulerSettings={saveSchedulerSettings}
      />

      {importSheetsOpen && clubId && (
        <ImportFromSheetsModal
          clubId={clubId}
          coachGroupId={coachGroupId || undefined}
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

      <CoachGroupAssignmentsDialog
        coachGroupAssignments={coachGroupAssignments}
        coachGroupManagement={coachGroupManagement}
        clubSettings={clubSettings}
      />

      {coachMessageOpen && (isAdmin || isCoach) && clubId && (
        <CoachMessageModal clubId={clubId} groups={coachGroups} onClose={() => setCoachMessageOpen(false)} />
      )}
      <MemberNotificationsDialog
        memberNotifications={memberNotifications}
        coachGroupManagement={coachGroupManagement}
        trainingGroups={trainingGroups}
        coachMessageOpen={coachMessageOpen}
        isAdmin={isAdmin}
        isCoach={isCoach}
        clubId={clubId}
        setCoachMessageOpen={setCoachMessageOpen}
        coachGroupId={coachGroupId}
        groupOptions={groupOptions}
      />
      {activeDevicesOpen && (isAdmin || isCoach) && clubId && (
        <ActiveDevicesModal key={clubId} clubId={clubId} onClose={() => setActiveDevicesOpen(false)} />
      )}
      <MembersGuideDialog membersGuide={membersGuide} />
    </main>
  );
}

export default function AdminMembersPage({ canUseSchedule2 = false }: { canUseSchedule2?: boolean }) {
  return (
    <Suspense fallback={<main className="amp-page" />}>
      <AdminMembersPageContent canUseSchedule2={canUseSchedule2} />
    </Suspense>
  );
}

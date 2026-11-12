import { getScopeKeyFromSessionId, parseSchedule2CustomSession, schedule2CustomSessionsUrl, type Schedule2TrainingTarget } from "../_utils/training-session-scope";
import type * as React from "react";
import { mergeTrainingCalendarDates } from "@/lib/trainingCalendarDates";
import { getNewTrainingEditorMode } from "@/lib/coachTrainingWizard";
import { type CoachTraining } from "@/lib/coachTrainingSchedule";
import { isCustomTrainingGroupPaletteColor } from "@/lib/customTrainingGroupColors";
import {
  DEFAULT_TRAINING_DURATION_MINUTES,
  TRAINING_TIME_REGEX,
  getTodayIsoDate,
  parseSelectedTeamGroup,
} from "../_utils/members-page-utils";
import {
  type TrainingAttendancePlayer,
  type TrainingUpcomingDateItem,
  type TrainingWeekSessionItem,
  type LimitedEventDetail,
} from "../_types/members-page-types";
import { getMonthKeyFromIsoDate, addMonthsToMonthKey } from "../_utils/members-calendar";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";
import { type MatchEditorState } from "../_hooks/useMatchEditorState";

import type { Schedule2Group, Schedule2Session } from "../_components/Schedule2";

type Options = {
  canUseSchedule2?: boolean;
  trainingAttendanceState: Pick<
    TrainingAttendanceState,
    | "schedule2Open"
    | "setSchedule2Open"
    | "schedule2Week"
    | "setSchedule2Week"
    | "trainingWeekRequest"
    | "trainingWeekLoadingRequest"
    | "trainingAttendanceOpenRequest"
    | "setSchedule2Groups"
    | "setSchedule2Matches"
    | "setSchedule2CanCreateTraining"
    | "setSchedule2Error"
    | "schedule2Groups"
    | "trainingAttendanceView"
    | "setTrainingAttendanceLoading"
    | "setTrainingAttendanceError"
    | "trainingAttendanceMonth"
    | "setTrainingAttendanceSessionId"
    | "setTrainingAttendanceDate"
    | "setTrainingAttendancePlayers"
    | "setTrainingAttendanceStats"
    | "setTrainingUpcomingDates"
    | "setTrainingWeekSessions"
    | "setTrainingDayDurationMinutes"
    | "setTrainingDayTime"
    | "setTrainingPlayersExpanded"
    | "setTrainingDayField"
    | "setTrainingDayFieldPieceIds"
    | "setTrainingDaySessionCancelled"
    | "setTrainingDayCancelConfirmOpen"
    | "setTrainingWeekLoading"
    | "setTrainingWeekDates"
    | "setTrainingAttendanceHideTeamsTab"
    | "setTrainingAttendanceOpen"
    | "setTrainingAttendanceMonth"
    | "setTrainingAttendanceView"
    | "setTrainingDayDetailsOpen"
    | "setWeekColorFilter"
    | "trainingAttendanceOpen"
    | "trainingAttendanceHideTeamsTab"
    | "trainingDayDetailsTab"
    | "setLimitedEvent"
    | "setLimitedEventLoading"
    | "setTrainingDayDetailsOpening"
    | "trainingDayDetailsRequest"
    | "setTrainingDayDetailsViewSnapshot"
    | "trainingWeekSessions"
    | "setTrainingDayDetailsTab"
    | "setShowLimitedForm"
    | "setLimitedEventError"
    | "setLimitedSpotsInput"
    | "setTrainingDayDetailsTabLoading"
    | "trainingAttendanceDate"
    | "trainingDayCancelLoading"
    | "setTrainingDayCancelLoading"
    | "trainingAttendanceSessionId"
    | "trainingDayTime"
    | "trainingDayDurationMinutes"
    | "trainingDayField"
    | "trainingDayFieldPieceIds"
  >;
  trainingGroups: Pick<
    TrainingGroups,
    | "selectedTrainingGroupId"
    | "isCustomTrainingGroupMode"
    | "customTrainingGroups"
    | "loadCustomTrainingGroups"
    | "trainingScheduleGroups"
    | "loadTrainingScheduleGroups"
    | "setSelectedTrainingGroupId"
  >;
  trainingDaysForm: Pick<TrainingDaysForm, "setTrainingDaysEditorOpen" | "setTrainingDaysEditorError" | "setTrainingDaysEditorLoading" | "trainingDaysEditorRequest">;
  matchEditorState: Pick<MatchEditorState, "setMatchCalendarVisibleMonthIdx" | "setMatchEditTarget">;
  clubId: string;
  trainingGroupScope: string;
  coachGroupId: string;
  currentCoachGroupName: string;
  setTrainingNote: React.Dispatch<React.SetStateAction<string>>;
  setTrainingNotesByDate: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setTrainingNoteTargetDates: React.Dispatch<React.SetStateAction<string[]>>;
  setPostTeamGroupSavePromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTrainingBulkNoteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSchedulerCalendarVisibleMonthIdx: React.Dispatch<React.SetStateAction<number>>;
  fetchClubMatches: () => Promise<void>;
  standaloneTeamGroups: number[];
  setTrainingGroupScope: React.Dispatch<React.SetStateAction<string>>;
  resolvedTrainingGroupScope: string;
  openTrainingDaysEditor: (
    mode?: "teamGroup" | "createGroup" | "trainingGroup" | "customGroup" | "coachGroup",
    editDate?: string,
    coachTarget?: { groupId: string; sessionId?: string },
    customTarget?: Schedule2TrainingTarget,
  ) => Promise<void>;
  trainingUpcomingByDate: Map<string, TrainingUpcomingDateItem>;
  onSchedule2WeekLoaded?: (groups: Schedule2Group[], sessions: Schedule2Session[]) => void;
};

export function createTrainingAttendanceActions({
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
  fetchClubMatches,
  standaloneTeamGroups,
  setTrainingGroupScope,
  resolvedTrainingGroupScope,
  openTrainingDaysEditor,
  onSchedule2WeekLoaded,
  trainingUpcomingByDate,
  canUseSchedule2 = false,
}: Options) {
  const {
    trainingAttendanceView,
    setTrainingAttendanceLoading,
    setTrainingAttendanceError,
    trainingAttendanceMonth,
    setTrainingAttendanceSessionId,
    setTrainingAttendanceDate,
    setTrainingAttendancePlayers,
    setTrainingAttendanceStats,
    setTrainingUpcomingDates,
    schedule2Open,
    setSchedule2Open,
    schedule2Week,
    setSchedule2Week,
    trainingWeekRequest,
    trainingWeekLoadingRequest,
    trainingAttendanceOpenRequest,
    setSchedule2Groups,
    setSchedule2Matches,
    setSchedule2CanCreateTraining,
    setSchedule2Error,
    schedule2Groups,
    setTrainingWeekSessions,
    setTrainingDayDurationMinutes,
    setTrainingDayTime,
    setTrainingPlayersExpanded,
    setTrainingDayField,
    setTrainingDayFieldPieceIds,
    setTrainingDaySessionCancelled,
    setTrainingDayCancelConfirmOpen,
    setTrainingWeekLoading,
    setTrainingWeekDates,
    setTrainingAttendanceHideTeamsTab,
    setTrainingAttendanceOpen,
    setTrainingAttendanceMonth,
    setTrainingAttendanceView,
    setTrainingDayDetailsOpen,
    setWeekColorFilter,
    trainingAttendanceOpen,
    trainingAttendanceHideTeamsTab,
    trainingDayDetailsTab,
    setLimitedEvent,
    setLimitedEventLoading,
    setTrainingDayDetailsOpening,
    trainingDayDetailsRequest,
    setTrainingDayDetailsViewSnapshot,
    trainingWeekSessions,
    setTrainingDayDetailsTab,
    setShowLimitedForm,
    setLimitedEventError,
    setLimitedSpotsInput,
    setTrainingDayDetailsTabLoading,
    trainingAttendanceDate,
    trainingDayCancelLoading,
    setTrainingDayCancelLoading,
    trainingAttendanceSessionId,
  } = trainingAttendanceState;
  const {
    selectedTrainingGroupId,
    isCustomTrainingGroupMode,
    customTrainingGroups,
    loadCustomTrainingGroups,
    trainingScheduleGroups,
    loadTrainingScheduleGroups,
    setSelectedTrainingGroupId,
  } = trainingGroups;
  const { setTrainingDaysEditorOpen, setTrainingDaysEditorError, setTrainingDaysEditorLoading, trainingDaysEditorRequest } = trainingDaysForm;
  const { setMatchCalendarVisibleMonthIdx, setMatchEditTarget } = matchEditorState;
  const fetchTrainingAttendance = async (
    date?: string,
    groupScopeOverride?: string,
    trainingGroupIdOverride?: string,
    viewOverride?: "teamGroup" | "trainingGroups",
    monthOverride?: string,
    trainingSessionIdOverride?: string,
    legacyScopeOverride = false,
    customScopeOverride = false,
    schedule2Details = false,
    isCurrent = () => true,
  ) => {
    if (!clubId) return;
    const resolvedView = viewOverride ?? trainingAttendanceView;
    const teamGroupFilter =
      resolvedView === "teamGroup" ? parseSelectedTeamGroup(groupScopeOverride ?? trainingGroupScope) : null;
    const trainingGroupFilter =
      resolvedView === "trainingGroups" ? (trainingGroupIdOverride ?? selectedTrainingGroupId).trim() : "";
    setTrainingAttendanceLoading(true);
    setTrainingAttendanceError("");
    try {
      const search = new URLSearchParams();
      if (schedule2Details) search.set("view", "schedule2");
      if (coachGroupId && !legacyScopeOverride && !schedule2Details) search.set("coachGroupId", coachGroupId);
      if (trainingSessionIdOverride) search.set("trainingSessionId", trainingSessionIdOverride);
      if (date) {
        search.set("date", date);
      }
      const requestedMonth = monthOverride ?? (date ? getMonthKeyFromIsoDate(date) : trainingAttendanceMonth);
      search.set("month", requestedMonth);
      if (teamGroupFilter !== null) {
        search.set("teamGroup", String(teamGroupFilter));
      }
      if (trainingGroupFilter) {
        search.set(
          customScopeOverride || isCustomTrainingGroupMode ? "customTrainingGroupId" : "trainingGroupId",
          trainingGroupFilter,
        );
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
      if (!isCurrent()) return;
      if (schedule2Details && payload.trainingDate !== date) {
        throw new Error("Тренировката не е намерена.");
      }
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
      const parseUpcomingDates = (items: unknown): TrainingUpcomingDateItem[] =>
        Array.isArray(items)
          ? items
              .map((item: unknown) => {
                const raw =
                  typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
                const rawStats =
                  typeof raw.stats === "object" && raw.stats !== null
                    ? (raw.stats as Record<string, unknown>)
                    : {};
                return {
                  date: String(raw.date ?? ""),
                  sessions: Array.isArray(raw.sessions)
                    ? raw.sessions
                        .map((entry: unknown) => {
                          const session =
                            entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
                          return {
                            id: String(session.id ?? ""),
                            trainingTime:
                              typeof session.trainingTime === "string" ? session.trainingTime : null,
                            trainingDurationMinutes: Number(session.trainingDurationMinutes ?? 60),
                          };
                        })
                        .filter((session: { id: string }) => session.id)
                    : undefined,
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

      let upcomingDates = parseUpcomingDates(payload.upcomingDates);
      if (coachGroupId && !schedule2Details) {
        const companionSearch = new URLSearchParams(search);
        companionSearch.delete("trainingSessionId");
        companionSearch.delete("date");
        if (legacyScopeOverride) companionSearch.set("coachGroupId", coachGroupId);
        else companionSearch.delete("coachGroupId");
        const companionResponse = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance?${companionSearch}`,
          { cache: "no-store" },
        );
        if (!companionResponse.ok) throw new Error("Неуспешно зареждане на всички тренировки.");
        const companion = parseUpcomingDates((await companionResponse.json()).upcomingDates);
        upcomingDates = legacyScopeOverride
          ? mergeTrainingCalendarDates(upcomingDates, companion)
          : mergeTrainingCalendarDates(companion, upcomingDates);
      }

      if (!isCurrent()) return;
      setTrainingAttendanceSessionId(
        typeof payload.trainingSessionId === "string" ? payload.trainingSessionId : null,
      );
      const resolvedDate = payload?.trainingDate || date || "";
      const resolvedScopeKey = payload.trainingSessionId
        ? `session:${payload.trainingSessionId}`
        : resolvedView === "trainingGroups"
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
      const calendarCoachGroupId = coachGroupId || payload.coachGroupId;
      if (!schedule2Details && typeof calendarCoachGroupId === "string" && calendarCoachGroupId) {
        const prefix = `coach-${calendarCoachGroupId}-`;
        const calendarSessions: TrainingWeekSessionItem[] = upcomingDates.flatMap(
          (day: TrainingUpcomingDateItem) =>
            (day.sessions ?? []).map((session) => ({
              id: `${prefix}${session.id}`,
              date: day.date,
              trainingTime: session.trainingTime,
              scopeType: "trainingGroup" as const,
              eventType: "training" as const,
              teamGroups: [],
              label: currentCoachGroupName || "Тренировка",
              durationMinutes: session.trainingDurationMinutes,
            })),
        );
        setTrainingWeekSessions((previous) => [
          ...previous.filter(
            (session) => !(session.id.startsWith(prefix) && session.date.startsWith(requestedMonth)),
          ),
          ...calendarSessions.map((session) => ({
            ...previous.find((existing) => existing.id === session.id),
            ...session,
            limitedSpots: previous.find((existing) => existing.id === session.id)?.limitedSpots,
          })),
        ]);
      }
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
      setTrainingDayTime(
        typeof payload?.trainingTime === "string" && TRAINING_TIME_REGEX.test(payload.trainingTime.trim())
          ? payload.trainingTime.trim()
          : null,
      );
      setTrainingPlayersExpanded(false);
      const rawField = payload?.trainingField;
      setTrainingDayField(
        rawField && typeof rawField === "object" && rawField !== null
          ? {
              id: String((rawField as Record<string, unknown>).id ?? ""),
              name: String((rawField as Record<string, unknown>).name ?? ""),
              fieldType:
                typeof (rawField as Record<string, unknown>).fieldType === "string"
                  ? String((rawField as Record<string, unknown>).fieldType)
                  : "football",
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
      setTrainingDaySessionCancelled(
        typeof payload?.sessionStatus === "string" ? payload.sessionStatus === "cancelled" : false,
      );
      setTrainingDayCancelConfirmOpen(false);
    } catch (error) {
      if (!isCurrent()) return;
      setTrainingAttendanceSessionId(null);
      setTrainingAttendancePlayers([]);
      setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
      setTrainingUpcomingDates([]);
      setTrainingNote("");
      setTrainingNoteTargetDates([]);
      setTrainingDayDurationMinutes(DEFAULT_TRAINING_DURATION_MINUTES);
      setTrainingDayTime(null);
      setTrainingDayField(null);
      setTrainingDayFieldPieceIds([]);
      setTrainingDaySessionCancelled(false);
      setTrainingDayCancelConfirmOpen(false);
      setTrainingAttendanceError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      if (isCurrent()) setTrainingAttendanceLoading(false);
    }
  };

  const fetchTrainingWeekSessions = async (options?: { silent?: boolean; schedule2?: boolean; week?: number }) => {
    if (!clubId) return;
    const includeFields = canUseSchedule2 && (options?.schedule2 ?? schedule2Open);
    const showLoading = !options?.silent;
    if (!showLoading && trainingWeekLoadingRequest.current !== null) return;
    const requestId = ++trainingWeekRequest.current;
    const isCurrent = () => requestId === trainingWeekRequest.current;
    if (showLoading) {
      trainingWeekLoadingRequest.current = requestId;
      setTrainingWeekLoading(true);
    }
    if (includeFields) setSchedule2Error("");
    else setTrainingAttendanceError("");
    try {
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance/week${includeFields ? `?view=schedule2&week=${options?.week ?? schedule2Week}` : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Неуспешно зареждане на седмичния график.",
        );
      }
      const payload = await response.json();
      const dates: string[] = Array.isArray(payload?.dates)
        ? payload.dates.filter((d: unknown) => typeof d === "string")
        : [];
      const sessions: Schedule2Session[] = Array.isArray(payload?.sessions)
        ? payload.sessions.map((item: unknown) => {
            const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
            return {
              id: String(raw.id ?? ""),
              date: String(raw.date ?? ""),
              trainingTime: typeof raw.trainingTime === "string" ? raw.trainingTime : null,
              scopeType: raw.scopeType === "trainingGroup" ? "trainingGroup" : "teamGroup",
              eventType: raw.eventType === "match" ? "match" : "training",
              label: String(raw.label ?? ""),
              teamGroups: Array.isArray(raw.teamGroups)
                ? (raw.teamGroups as unknown[]).map(Number).filter(Number.isInteger)
                : [],
              location: typeof raw.location === "string" ? raw.location : undefined,
              scopeLabel: typeof raw.scopeLabel === "string" ? raw.scopeLabel : undefined,
              ...(includeFields && typeof raw.fieldName === "string" ? { fieldName: raw.fieldName } : {}),
              isHome: typeof raw.isHome === "boolean" ? raw.isHome : undefined,
              durationMinutes: typeof raw.durationMinutes === "number" ? raw.durationMinutes : undefined,
              customGroupId: typeof raw.customGroupId === "string" ? raw.customGroupId : null,
              coachGroupId: typeof raw.coachGroupId === "string" ? raw.coachGroupId : null,
              color: (() => {
                const c = typeof raw.color === "string" ? raw.color.trim() : "";
                return isCustomTrainingGroupPaletteColor(c) ? c : undefined;
              })(),
              limitedSpots: (() => {
                const ls = raw.limitedSpots;
                if (!ls || typeof ls !== "object") return null;
                const o = ls as Record<string, unknown>;
                if (
                  typeof o.id !== "string" ||
                  typeof o.maxSpots !== "number" ||
                  typeof o.registeredCount !== "number"
                )
                  return null;
                return { id: o.id, maxSpots: o.maxSpots, registeredCount: o.registeredCount };
              })(),
            } satisfies TrainingWeekSessionItem;
          })
        : [];
      if (!isCurrent()) return;
      if (includeFields) {
        const groups: Schedule2Group[] = Array.isArray(payload.customGroups) ? payload.customGroups : [];
        setSchedule2Groups(groups);
        setSchedule2Matches(Array.isArray(payload.matches) ? payload.matches : []);
        setSchedule2CanCreateTraining(payload.canCreateCustomTraining === true);
        onSchedule2WeekLoaded?.(groups, sessions);
      }
      setTrainingWeekDates(dates);
      setTrainingWeekSessions(sessions);
      console.log("[WeekSchedule] sessions", sessions);
      return sessions;
    } catch (error) {
      if (!isCurrent()) return;
      if (showLoading) {
        setTrainingWeekDates([]);
        setTrainingWeekSessions([]);
      }
      const message = error instanceof Error ? error.message : "Възникна грешка.";
      if (includeFields) setSchedule2Error(message);
      else setTrainingAttendanceError(message);
      return [];
    } finally {
      if (trainingWeekLoadingRequest.current === requestId) {
        trainingWeekLoadingRequest.current = null;
        setTrainingWeekLoading(false);
      }
    }
  };

  const closeTrainingAttendance = () => {
    if (schedule2Open) {
      trainingDaysEditorRequest.current = null;
      setTrainingDaysEditorLoading(false);
    }
    ++trainingAttendanceOpenRequest.current;
    ++trainingDayDetailsRequest.current;
    ++trainingWeekRequest.current;
    trainingWeekLoadingRequest.current = null;
    setTrainingWeekLoading(false);
    setSchedule2Open(false);
    setTrainingAttendanceOpen(false);
    setTrainingAttendanceHideTeamsTab(false);
    setTrainingDayDetailsOpening(false);
    setTrainingDayDetailsOpen(false);
    setTrainingAttendanceLoading(false);
    setLimitedEventLoading(false);
    setTrainingDaysEditorOpen(false);
  };

  const openTrainingAttendance = async (options?: { hideTeamsTab?: boolean; schedule2?: boolean }) => {
    if (!clubId) return;
    const openRequest = ++trainingAttendanceOpenRequest.current;
    const currentMonth = getTodayIsoDate().slice(0, 7);
    const schedule2 = canUseSchedule2 && options?.schedule2 === true;
    setSchedule2Open(schedule2);
    setSchedule2Week(0);
    if (schedule2) {
      setSchedule2Groups([]);
      setSchedule2Matches([]);
      setSchedule2CanCreateTraining(false);
    }
    setTrainingAttendanceHideTeamsTab(Boolean(options?.hideTeamsTab));
    setTrainingAttendanceOpen(true);
    setTrainingAttendanceMonth(currentMonth);
    setPostTeamGroupSavePromptOpen(false);
    setTrainingAttendanceView("today");
    setTrainingDayDetailsOpen(false);
    setTrainingBulkNoteOpen(false);
    setTrainingDaysEditorOpen(false);
    setTrainingDaysEditorError("");
    setTrainingNoteTargetDates([]);
    setWeekColorFilter(null);
    setSchedulerCalendarVisibleMonthIdx(0);
    setMatchCalendarVisibleMonthIdx(0);
    const [sessions] = await Promise.all([
      fetchTrainingWeekSessions({ schedule2, week: 0 }),
      schedule2 ? undefined : fetchClubMatches(),
    ]);
    if (openRequest === trainingAttendanceOpenRequest.current && !schedule2 && !options?.hideTeamsTab && sessions?.length === 0) {
      setTrainingAttendanceView("trainingGroups");
      const groups = isCustomTrainingGroupMode
        ? customTrainingGroups.length > 0
          ? customTrainingGroups
          : await loadCustomTrainingGroups()
        : trainingScheduleGroups.length > 0
          ? trainingScheduleGroups
          : await loadTrainingScheduleGroups();
      if (openRequest !== trainingAttendanceOpenRequest.current) return;
      const resolvedGroupId =
        selectedTrainingGroupId && groups.some((g) => g.id === selectedTrainingGroupId)
          ? selectedTrainingGroupId
          : (groups[0]?.id ?? "");
      setSelectedTrainingGroupId(resolvedGroupId);
      if (!resolvedGroupId) {
        if (!isCustomTrainingGroupMode && standaloneTeamGroups.length > 0) {
          const firstYear = String(standaloneTeamGroups[0]);
          setTrainingAttendanceView("teamGroup");
          setTrainingGroupScope(firstYear);
          await fetchTrainingAttendance(undefined, firstYear, undefined, "teamGroup");
          return;
        }
        return;
      }
      await fetchTrainingAttendance(undefined, undefined, resolvedGroupId, "trainingGroups");
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
    if (trainingAttendanceHideTeamsTab && nextView !== "today") {
      return;
    }
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
      await fetchTrainingWeekSessions();
      return;
    }

    if (nextView === "teamGroup") {
      // Internally kept for standalone team group selections
      await fetchTrainingAttendance(undefined, resolvedTrainingGroupScope, undefined, "teamGroup");
      return;
    }

    const groups = isCustomTrainingGroupMode
      ? customTrainingGroups.length > 0
        ? customTrainingGroups
        : await loadCustomTrainingGroups()
      : trainingScheduleGroups.length > 0
        ? trainingScheduleGroups
        : await loadTrainingScheduleGroups();
    const resolvedGroupId =
      selectedTrainingGroupId && groups.some((group) => group.id === selectedTrainingGroupId)
        ? selectedTrainingGroupId
        : (groups[0]?.id ?? "");
    setSelectedTrainingGroupId(resolvedGroupId);
    if (!resolvedGroupId) {
      if (!isCustomTrainingGroupMode && standaloneTeamGroups.length > 0) {
        const firstYear = String(standaloneTeamGroups[0]);
        setTrainingAttendanceView("teamGroup");
        setTrainingGroupScope(firstYear);
        await fetchTrainingAttendance(undefined, firstYear, undefined, "teamGroup");
        return;
      }
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
    setTrainingAttendanceHideTeamsTab(false);
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
    const mode = getNewTrainingEditorMode({
      coachGroupId,
      view: trainingAttendanceView,
      isCustomGroupMode: isCustomTrainingGroupMode,
    });
    if (mode === "customGroup" || mode === "trainingGroup") {
      if (!selectedTrainingGroupId) {
        setTrainingAttendanceError("Изберете група.");
        return;
      }
    }
    await openTrainingDaysEditor(mode);
  };

  const openSingleTrainingDayEditForCurrentScope = async (date: string) => {
    const custom = schedule2Open && parseSchedule2CustomSession(trainingDayDetailsTab);
    if (custom) {
      const group = schedule2Groups.find(({ id }) => id === custom.groupId);
      if (!group) {
        setSchedule2Error("Групата вече не е в графика.");
        return;
      }
      await openTrainingDaysEditor("customGroup", date, undefined, {
        group,
        edit: {
          sessionId: custom.sessionId,
          time: trainingAttendanceState.trainingDayTime,
          duration: trainingAttendanceState.trainingDayDurationMinutes,
          fieldId: trainingAttendanceState.trainingDayField?.id ?? null,
          fieldPieceIds: trainingAttendanceState.trainingDayFieldPieceIds,
        },
      });
      return;
    }
    if (trainingDayDetailsTab.startsWith("coach-")) {
      await openTrainingDaysEditor("coachGroup", date, {
        groupId: trainingDayDetailsTab.slice(6, 42),
        sessionId: trainingDayDetailsTab.slice(43),
      });
      return;
    }
    if (trainingAttendanceView === "trainingGroups") {
      if (!selectedTrainingGroupId) return;
      await openTrainingDaysEditor(isCustomTrainingGroupMode ? "customGroup" : "trainingGroup", date);
      return;
    }
    if (coachGroupId) {
      await openTrainingDaysEditor("coachGroup", date);
      return;
    }
    await openTrainingDaysEditor("teamGroup", date);
  };

  const fetchLimitedEventForSession = async (date: string, sessionId: string) => {
    if (!clubId) return;
    const requestId = trainingDayDetailsRequest.current;
    const isCurrent = () => requestId === trainingDayDetailsRequest.current;
    const scopeKey = getScopeKeyFromSessionId(sessionId);
    if (!scopeKey) {
      setLimitedEvent(null);
      setLimitedEventLoading(false);
      return;
    }
    setLimitedEventLoading(true);
    try {
      const url = `/api/admin/clubs/${encodeURIComponent(clubId)}/limited-training-events?date=${encodeURIComponent(date)}&scopeKey=${encodeURIComponent(scopeKey)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!isCurrent()) return;
      if (!res.ok) {
        setLimitedEvent(null);
        return;
      }
      const data: unknown = await res.json();
      if (!isCurrent()) return;
      let arr = Array.isArray(data) ? data : [];
      if (!arr.length && sessionId.startsWith("coach-")) {
        const groupId = sessionId.slice(6, 42);
        const [legacyResponse, scheduleResponse] = await Promise.all([
          fetch(
            `/api/admin/clubs/${encodeURIComponent(clubId)}/limited-training-events?date=${encodeURIComponent(date)}&scopeKey=${encodeURIComponent(`coach_group:${groupId}`)}`,
            { cache: "no-store" },
          ),
          fetch(
            `/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups/${encodeURIComponent(groupId)}/schedule`,
            { cache: "no-store" },
          ),
        ]);
        if (legacyResponse.ok && scheduleResponse.ok) {
          const legacy = await legacyResponse.json();
          const schedule = await scheduleResponse.json();
          const original = (schedule.trainings as Array<CoachTraining & { createdAt: string }>)
            .filter((t) => t.date === date)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
          if (original?.id === sessionId.slice(43) && Array.isArray(legacy)) arr = legacy;
        }
      }
      if (!isCurrent()) return;
      if (arr.length === 0) {
        setLimitedEvent(null);
        return;
      }
      const ev = arr[0] as {
        id: string;
        scopeKey: string;
        scopeId: string | null;
        teamGroup: number | null;
        trainingDate: string;
        maxSpots: number;
        registeredCount: number;
      };
      // Fetch full event details with registrations
      const detailRes = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/limited-training-events/${encodeURIComponent(ev.id)}`,
        { cache: "no-store" },
      );
      if (!isCurrent()) return;
      if (!detailRes.ok) {
        setLimitedEvent(null);
        return;
      }
      const detail = (await detailRes.json()) as {
        event: LimitedEventDetail;
        registrations: LimitedEventDetail["registrations"];
        spotsRemaining: number;
      };
      if (!isCurrent()) return;
      setLimitedEvent({
        ...detail.event,
        registrations: detail.registrations,
        spotsRemaining: detail.spotsRemaining,
      });
    } catch {
      if (isCurrent()) setLimitedEvent(null);
    } finally {
      if (isCurrent()) setLimitedEventLoading(false);
    }
  };

  const openTrainingDayDetails = async (date: string, sessionId?: string) => {
    const schedule2Details = schedule2Open && trainingAttendanceOpen;
    const requestId = ++trainingDayDetailsRequest.current;
    const isCurrent = () => requestId === trainingDayDetailsRequest.current;
    setMatchEditTarget(null);
    const month = getMonthKeyFromIsoDate(date);
    setTrainingDayDetailsOpening(true);
    setTrainingDayDetailsViewSnapshot(trainingAttendanceView);
    setTrainingAttendanceDate(date);
    setTrainingAttendanceMonth(month);
    const dateSessions = trainingWeekSessions.filter(
      (session) => session.date === date && session.eventType !== "match",
    );
    const firstSession =
      dateSessions.find(
        (session) =>
          selectedTrainingGroupId &&
          (session.id === `${date}-custom-${selectedTrainingGroupId}` ||
            session.id === `${date}-group-${selectedTrainingGroupId}`),
      ) ??
      dateSessions.find(
        (session) =>
          !coachGroupId ||
          session.id.startsWith(`coach-${coachGroupId}-`) ||
          !session.id.startsWith("coach-"),
      );
    const calendarSession = trainingUpcomingByDate.get(date)?.sessions?.[0];
    const firstSessionId =
      sessionId ??
      (calendarSession && coachGroupId
        ? `coach-${coachGroupId}-${calendarSession.id}`
        : (firstSession?.id ?? "training"));
    setTrainingDayDetailsTab(firstSessionId);
    if (schedule2Details) {
      setTrainingAttendanceSessionId(null);
      setTrainingDayCancelConfirmOpen(false);
    }
    setLimitedEvent(null);
    setShowLimitedForm(false);
    setLimitedEventError("");
    setLimitedSpotsInput("10");
    if (schedule2Details && firstSessionId.startsWith("match-")) {
      setTrainingAttendanceLoading(false);
      setLimitedEventLoading(false);
      setTrainingDayDetailsOpen(true);
      setTrainingDayDetailsOpening(false);
      return;
    }
    // Resolve scope from session ID so the right group data is fetched
    let _viewOverride: "teamGroup" | "trainingGroups" | undefined;
    let _groupScopeOverride: string | undefined;
    let _trainingGroupIdOverride: string | undefined;
    const custom = schedule2Details ? parseSchedule2CustomSession(firstSessionId) : null;
    let schedule2CustomScope = false;
    if (sessionId && !sessionId.startsWith("match-")) {
      const customM = sessionId.match(/^\d{4}-\d{2}-\d{2}-custom-(.+)$/);
      const groupM = sessionId.match(/^\d{4}-\d{2}-\d{2}-group-(.+)$/);
      const teamM = sessionId.match(/^\d{4}-\d{2}-\d{2}-team-(\d+)$/);
      if (customM) {
        schedule2CustomScope = schedule2Details;
        _viewOverride = "trainingGroups";
        _trainingGroupIdOverride = customM[1];
        if (!schedule2Details) {
          setTrainingAttendanceView("trainingGroups");
          setSelectedTrainingGroupId(customM[1]);
        }
      } else if (groupM) {
        _viewOverride = "trainingGroups";
        _trainingGroupIdOverride = groupM[1];
        setTrainingAttendanceView("trainingGroups");
        setSelectedTrainingGroupId(groupM[1]);
      } else if (teamM) {
        _viewOverride = "teamGroup";
        _groupScopeOverride = teamM[1];
        setTrainingAttendanceView("teamGroup");
        setTrainingGroupScope(teamM[1]);
      }
    }
    try {
      await Promise.all([
        fetchTrainingAttendance(
          date,
          _groupScopeOverride,
          _trainingGroupIdOverride,
          _viewOverride,
          month,
          custom?.sessionId ?? (firstSessionId.startsWith("coach-") ? firstSessionId.slice(43) : undefined),
          !firstSessionId.startsWith("coach-"),
          schedule2CustomScope,
          schedule2Details,
          isCurrent,
        ),
        schedule2Details ? undefined : fetchClubMatches(),
        fetchLimitedEventForSession(date, firstSessionId),
      ]);
      if (isCurrent()) setTrainingDayDetailsOpen(true);
    } finally {
      if (isCurrent()) setTrainingDayDetailsOpening(false);
    }
  };

  const loadDayDetailsSessionAttendance = async (session: TrainingWeekSessionItem, date: string) => {
    const schedule2Details = schedule2Open && trainingAttendanceOpen;
    if (schedule2Details) {
      await openTrainingDayDetails(date, session.id);
      return;
    }
    if (session.id.startsWith("coach-")) {
      setTrainingDayDetailsTabLoading(true);
      try {
        await fetchTrainingAttendance(
          date,
          undefined,
          undefined,
          undefined,
          getMonthKeyFromIsoDate(date),
          session.id.slice(43),
          false,
          false,
        );
      } finally {
        setTrainingDayDetailsTabLoading(false);
      }
      return;
    }
    const month = getMonthKeyFromIsoDate(date);
    setTrainingDayDetailsTabLoading(true);
    try {
      if (session.scopeType === "teamGroup") {
        const tg = session.teamGroups[0];
        const groupScope = tg !== undefined && Number.isInteger(tg) ? String(tg) : "all";
        setTrainingAttendanceView("teamGroup");
        setTrainingGroupScope(groupScope);
        await fetchTrainingAttendance(date, groupScope, undefined, "teamGroup", month, undefined, true);
      } else {
        const groupPrefix = `${date}-group-`;
        const customPrefix = `${date}-custom-`;
        let groupId: string | null = null;
        if (session.id.startsWith(groupPrefix)) {
          groupId = session.id.slice(groupPrefix.length);
        } else if (session.id.startsWith(customPrefix)) {
          groupId = session.id.slice(customPrefix.length);
        }
        if (groupId) {
          setTrainingAttendanceView("trainingGroups");
          setSelectedTrainingGroupId(groupId);
          await fetchTrainingAttendance(date, undefined, groupId, "trainingGroups", month, undefined, true);
        }
      }
    } finally {
      setTrainingDayDetailsTabLoading(false);
    }
  };

  const handleDeleteTrainingDay = async () => {
    if (!clubId || !trainingAttendanceDate || trainingDayCancelLoading) return;
    setTrainingDayCancelConfirmOpen(false);
    const schedule2 = schedule2Open && trainingAttendanceOpen;
    const selected = schedule2 ? trainingWeekSessions.find((session) =>
      session.id === trainingDayDetailsTab && session.date === trainingAttendanceDate && session.eventType === "training",
    ) : undefined;
    if (schedule2 && !selected) {
      setTrainingAttendanceError("Тренировката вече не е в графика.");
      return;
    }
    setTrainingDayCancelLoading(true);
    try {
      const body: Record<string, unknown> = { date: trainingAttendanceDate };
      let url = `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance/session`;
      if (selected) {
        const custom = parseSchedule2CustomSession(selected.id);
        if (custom && selected.customGroupId === custom.groupId) {
          url = schedule2CustomSessionsUrl(clubId, custom.groupId);
          body.sessionId = custom.sessionId;
        } else if (selected.id.startsWith("coach-")) {
          body.trainingSessionId = selected.id.slice(43);
        } else if (selected.id.startsWith(`${trainingAttendanceDate}-group-`)) {
          body.trainingGroupId = selected.id.slice(17);
        } else if (selected.id.startsWith(`${trainingAttendanceDate}-team-`) && selected.teamGroups.length === 1) {
          body.teamGroup = selected.teamGroups[0];
        } else {
          throw new Error("Тренировката вече не е в графика.");
        }
      } else if (trainingAttendanceSessionId) {
        body.trainingSessionId = trainingAttendanceSessionId;
      } else if (trainingAttendanceView === "trainingGroups" && selectedTrainingGroupId) {
        body[isCustomTrainingGroupMode ? "customTrainingGroupId" : "trainingGroupId"] =
          selectedTrainingGroupId;
      } else if (trainingAttendanceView === "teamGroup") {
        const tg = parseSelectedTeamGroup(trainingGroupScope);
        if (tg !== null) body.teamGroup = tg;
      }
      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Грешка при изтриване на тренировката.");
      }
      setTrainingDayDetailsOpen(false);
      await Promise.all([fetchTrainingWeekSessions(), schedule2Open ? undefined : fetchTrainingAttendance()]);
    } catch (error) {
      setTrainingAttendanceError(
        error instanceof Error ? error.message : "Грешка при изтриване на тренировката.",
      );
    } finally {
      setTrainingDayCancelLoading(false);
    }
  };

  const dismissSchedule2Details = () => {
    ++trainingDayDetailsRequest.current;
    setTrainingDayDetailsOpening(false);
    setTrainingAttendanceLoading(false);
    setLimitedEventLoading(false);
    setTrainingDayCancelConfirmOpen(false);
  };

  return {
    fetchTrainingAttendance,
    fetchTrainingWeekSessions,
    openTrainingAttendance,
    closeTrainingAttendance,
    handleTrainingGroupScopeChange,
    handleTrainingAttendanceViewChange,
    handleTrainingAttendanceMonthChange,
    handleSelectedTrainingGroupChange,
    handleUnifiedGroupChange,
    openTrainingDaysEditorForCurrentScope,
    openSingleTrainingDayEditForCurrentScope,
    fetchLimitedEventForSession,
    openTrainingDayDetails,
    dismissSchedule2Details,
    loadDayDetailsSessionAttendance,
    handleDeleteTrainingDay,
  };
}

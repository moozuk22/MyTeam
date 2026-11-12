import type { TrainingScheduleGroup } from "../_types/members-page-types";
import type * as React from "react";
import { buildCoachWizardSchedule, type CoachWizardSelection } from "@/lib/coachTrainingWizard";
import { type CoachTraining, type CoachTrainingRecurrence } from "@/lib/coachTrainingSchedule";
import { type CoachTrainingLimit } from "@/lib/coachTrainingLimits";
import {
  DEFAULT_TRAINING_DURATION_MINUTES,
  normalizeTrainingDateTimes,
  getUniformTrainingTime,
  normalizeTrainingDurationInput,
  getTrainingDurationFormValue,
  normalizeOptionalId,
  normalizeTrainingFieldSelections,
  inferTrainingTimeMode,
} from "../_utils/members-page-utils";
import { type TrainingField, type TrainingWeekSessionItem } from "../_types/members-page-types";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";

import { schedule2CustomSessionsUrl, type Schedule2TrainingTarget } from "../_utils/training-session-scope";

type Options = {
  schedulerCalendarMonthsTrimmed: { key: string }[];
  setSchedulerCalendarVisibleMonthIdx: React.Dispatch<React.SetStateAction<number>>;
  setSchedule2Error: React.Dispatch<React.SetStateAction<string>>;
  trainingDaysForm: Pick<
    TrainingDaysForm,
    | "coachWizardTrainings"
    | "coachWizardRecurrences"
    | "coachWizardEvents"
    | "setCoachWizardSelection"
    | "schedulerCalendarDateSet"
    | "setSchedulerForm"
    | "setTrainingDateTimes"
    | "setTrainingDaysInitialDateTimes"
    | "setTrainingFieldSelections"
    | "setTrainingDaysInitialFieldSelections"
    | "setTrainingDayScheduleNotes"
    | "setSchedule2InitialNote"
    | "setTrainingDaysInitialDates"
    | "setTrainingDaysInitialDurationMinutes"
    | "setTrainingDaysInitialFieldId"
    | "setTrainingDaysInitialFieldPieceIds"
    | "setTrainingFieldActiveDate"
    | "setTrainingTimeMode"
    | "setTrainingDaysSingleEditDate"
    | "setTrainingDaysActiveStep"
    | "setTrainingDaysEditorError"
    | "setSchedulerLimitedMode"
    | "setSchedulerLimitedSpots"
    | "setSchedulerPerDayConfig"
    | "setSchedulerPerDayLimited"
    | "setCoachWizardGroupId"
    | "trainingDaysEditorOpen"
    | "trainingDaysEditorRequest"
    | "schedule2TrainingGroup"
    | "setSchedule2TrainingGroup"
    | "schedule2TrainingSessionId"
    | "setSchedule2TrainingSessionId"
    | "trainingDaysSingleEditDate"
    | "setTrainingDaysStartedFromScheduleCell"
    | "trainingEditorCustomGroupId"
    | "setTrainingDaysEditorOpen"
    | "setTrainingDaysEditorMode"
    | "setTrainingDaysEditorGroups"
    | "setTrainingDaysEditorGroupName"
    | "setTrainingDaysEditorCreateOpen"
    | "setTrainingDaysEditorLoading"
    | "setTrainingDaysPreExistingDates"
    | "setCoachWizardTrainings"
    | "setCoachWizardRecurrences"
    | "setCoachWizardVersion"
    | "setCoachWizardEvents"
    | "schedulerForm"
    | "hasMissingTrainingTime"
    | "hasInvalidTrainingDuration"
    | "hasMissingTrainingField"
    | "missingTrainingFieldMessage"
    | "trainingDaysPreExistingDates"
    | "buildMergedTrainingDateTimes"
    | "trainingTimeMode"
    | "buildMergedTrainingFieldSelections"
    | "normalizedTrainingDurationSelection"
    | "primaryTrainingFieldSelection"
    | "schedulerPerDayLimited"
    | "schedulerPerDayConfig"
    | "schedulerLimitedMode"
    | "isSchedulerLimitedSpotsValid"
    | "schedulerLimitedSpotsValue"
    | "trainingDayScheduleNotes"
    | "setTrainingDaysSuccessMessage"
    | "setTrainingDaysSuccessOpen"
    | "coachWizardGroupId"
    | "coachWizardVersion"
    | "trainingDaysEditorSaving"
    | "trainingFieldBulkApplying"
    | "setTrainingDaysEditorSaving"
    | "trainingDaysEditorMode"
    | "coachWizardSelection"
    | "normalizedTrainingDaysSelection"
    | "normalizedTrainingDateTimesSelection"
    | "trainingFieldSelections"
    | "schedulerLimitedSpots"
    | "trainingDateTimes"
    | "normalizedTrainingDaysInitial"
    | "normalizedTrainingDateTimesInitial"
    | "trainingDaysInitialDurationMinutes"
    | "normalizedTrainingFieldSelectionsKey"
    | "normalizedTrainingFieldSelectionsInitialKey"
    | "normalizedTrainingDateTimesSelectionKey"
    | "normalizedTrainingDateTimesInitialKey"
    | "trainingDaysEditorGroups"
    | "trainingDaysEditorGroupName"
  >;
  trainingGroups: Pick<
    TrainingGroups,
    | "isCustomTrainingGroupMode"
    | "loadTrainingScheduleGroups"
    | "loadCustomTrainingGroups"
    | "selectedTrainingGroupId"
    | "customTrainingGroups"
    | "trainingScheduleGroups"
  >;
  trainingAttendanceState: Pick<TrainingAttendanceState, "trainingAttendanceDate">;
  clubId: string;
  coachGroupId: string;
  trainingNote: string;
  loadTrainingFields: () => Promise<TrainingField[]>;
  selectedTeamGroup: number | null;
  setSecondReminderEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setThirdReminderEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  secondReminderEnabled: boolean;
  thirdReminderEnabled: boolean;
  fetchTrainingAttendance: (
    date?: string,
    groupScopeOverride?: string,
    trainingGroupIdOverride?: string,
    viewOverride?: "teamGroup" | "trainingGroups",
    monthOverride?: string,
    trainingSessionIdOverride?: string,
    legacyScopeOverride?: boolean,
  ) => Promise<void>;
  setPostTeamGroupSavePromptGroupId: React.Dispatch<React.SetStateAction<string>>;
  setPostTeamGroupSavePromptGroupName: React.Dispatch<React.SetStateAction<string>>;
  setPostTeamGroupSavePromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  todayIsoDate: string;
  fetchTrainingWeekSessions: (options?: {
    silent?: boolean;
  }) => Promise<TrainingWeekSessionItem[] | undefined>;
  selectedTeamGroupLinkedTrainingGroups: TrainingScheduleGroup[];
  setPendingTeamGroupWarningGroups: React.Dispatch<React.SetStateAction<{ id: string; name: string }[]>>;
  setTeamGroupWarningModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function createTrainingScheduleActions({
  trainingDaysForm,
  trainingGroups,
  trainingAttendanceState,
  clubId,
  coachGroupId,
  trainingNote,
  loadTrainingFields,
  selectedTeamGroup,
  setSecondReminderEnabled,
  setThirdReminderEnabled,
  secondReminderEnabled,
  thirdReminderEnabled,
  fetchTrainingAttendance,
  setPostTeamGroupSavePromptGroupId,
  setPostTeamGroupSavePromptGroupName,
  setPostTeamGroupSavePromptOpen,
  todayIsoDate,
  fetchTrainingWeekSessions,
  selectedTeamGroupLinkedTrainingGroups,
  setPendingTeamGroupWarningGroups,
  setTeamGroupWarningModalOpen,
  schedulerCalendarMonthsTrimmed,
  setSchedulerCalendarVisibleMonthIdx,
  setSchedule2Error,
}: Options) {
  const {
    coachWizardTrainings,
    coachWizardRecurrences,
    coachWizardEvents,
    setCoachWizardSelection,
    schedulerCalendarDateSet,
    setSchedulerForm,
    setTrainingDateTimes,
    setTrainingDaysInitialDateTimes,
    setTrainingFieldSelections,
    setTrainingDaysInitialFieldSelections,
    setTrainingDayScheduleNotes,
    setSchedule2InitialNote,
    setTrainingDaysInitialDates,
    setTrainingDaysInitialDurationMinutes,
    setTrainingDaysInitialFieldId,
    setTrainingDaysInitialFieldPieceIds,
    setTrainingFieldActiveDate,
    setTrainingTimeMode,
    setTrainingDaysSingleEditDate,
    setTrainingDaysActiveStep,
    setTrainingDaysEditorError,
    setSchedulerLimitedMode,
    setSchedulerLimitedSpots,
    setSchedulerPerDayConfig,
    setSchedulerPerDayLimited,
    setCoachWizardGroupId,
    trainingDaysEditorOpen,
    trainingDaysEditorRequest,
    schedule2TrainingGroup,
    setSchedule2TrainingGroup,
    schedule2TrainingSessionId,
    setSchedule2TrainingSessionId,
    trainingDaysSingleEditDate,
    setTrainingDaysStartedFromScheduleCell,
    trainingEditorCustomGroupId,
    setTrainingDaysEditorOpen,
    setTrainingDaysEditorMode,
    setTrainingDaysEditorGroups,
    setTrainingDaysEditorGroupName,
    setTrainingDaysEditorCreateOpen,
    setTrainingDaysEditorLoading,
    setTrainingDaysPreExistingDates,
    setCoachWizardTrainings,
    setCoachWizardRecurrences,
    setCoachWizardVersion,
    setCoachWizardEvents,
    schedulerForm,
    hasMissingTrainingTime,
    hasInvalidTrainingDuration,
    hasMissingTrainingField,
    missingTrainingFieldMessage,
    trainingDaysPreExistingDates,
    buildMergedTrainingDateTimes,
    trainingTimeMode,
    buildMergedTrainingFieldSelections,
    normalizedTrainingDurationSelection,
    primaryTrainingFieldSelection,
    schedulerPerDayLimited,
    schedulerPerDayConfig,
    schedulerLimitedMode,
    isSchedulerLimitedSpotsValid,
    schedulerLimitedSpotsValue,
    trainingDayScheduleNotes,
    setTrainingDaysSuccessMessage,
    setTrainingDaysSuccessOpen,
    coachWizardGroupId,
    coachWizardVersion,
    trainingDaysEditorSaving,
    trainingFieldBulkApplying,
    setTrainingDaysEditorSaving,
    trainingDaysEditorMode,
    coachWizardSelection,
    normalizedTrainingDaysSelection,
    normalizedTrainingDateTimesSelection,
    trainingFieldSelections,
    schedulerLimitedSpots,
    trainingDateTimes,
    normalizedTrainingDaysInitial,
    normalizedTrainingDateTimesInitial,
    trainingDaysInitialDurationMinutes,
    normalizedTrainingFieldSelectionsKey,
    normalizedTrainingFieldSelectionsInitialKey,
    normalizedTrainingDateTimesSelectionKey,
    normalizedTrainingDateTimesInitialKey,
    trainingDaysEditorGroups,
    trainingDaysEditorGroupName,
  } = trainingDaysForm;
  const {
    isCustomTrainingGroupMode,
    loadTrainingScheduleGroups,
    loadCustomTrainingGroups,
    selectedTrainingGroupId,
    customTrainingGroups,
    trainingScheduleGroups,
  } = trainingGroups;
  const { trainingAttendanceDate } = trainingAttendanceState;
  const configureCoachWizardSelection = (
    selection: CoachWizardSelection,
    rows = coachWizardTrainings,
    rules = coachWizardRecurrences,
    newDate?: string,
    events = coachWizardEvents,
  ) => {
    setCoachWizardSelection(selection);
    const id = selection.split(":")[1];
    const selected = selection.startsWith("session:") ? rows.find((t) => t.id === id) : null;
    const rule = selection.startsWith("rule:") ? rules.find((r) => r.id === id) : null;
    const targets = selected
      ? [selected]
      : rule
        ? rows.filter((t) => t.recurrenceId === rule.id && schedulerCalendarDateSet.has(t.date))
        : [];
    const dates =
      selected || rule ? [...new Set(targets.map((t) => t.date))].sort() : newDate ? [newDate] : [];
    const source = selected ?? rule;
    const time = source?.trainingTime ?? "";
    const times = Object.fromEntries(targets.map((t) => [t.date, t.trainingTime]));
    const fields = Object.fromEntries(
      targets.map((t) => [
        t.date,
        { trainingFieldId: t.trainingFieldId, trainingFieldPieceIds: t.trainingFieldPieceIds },
      ]),
    );
    const notes = Object.fromEntries(targets.map((t) => [t.date, t.note]));
    setSchedulerForm((prev) => ({
      ...prev,
      trainingDates: dates,
      trainingTime: time,
      trainingDurationMinutes: String(source?.trainingDurationMinutes ?? DEFAULT_TRAINING_DURATION_MINUTES),
      trainingFieldId: source?.trainingFieldId ?? "",
      trainingFieldPieceIds: source?.trainingFieldPieceIds ?? [],
    }));
    setTrainingDateTimes(times);
    setTrainingDaysInitialDateTimes(times);
    setTrainingFieldSelections(fields);
    setTrainingDaysInitialFieldSelections(fields);
    setTrainingDayScheduleNotes(notes);
    setTrainingDaysInitialDates(dates);
    setTrainingDaysInitialDurationMinutes(
      source?.trainingDurationMinutes ?? DEFAULT_TRAINING_DURATION_MINUTES,
    );
    setTrainingDaysInitialFieldId(source?.trainingFieldId ?? "");
    setTrainingDaysInitialFieldPieceIds(source?.trainingFieldPieceIds ?? []);
    setTrainingFieldActiveDate(dates[0] ?? "");
    setTrainingTimeMode("all");
    setTrainingDaysSingleEditDate(null);
    setTrainingDaysActiveStep(selected || rule ? "time" : "days");
    setTrainingDaysEditorError("");
    const configs = Object.fromEntries(
      targets.map((t) => {
        const event = events.find((e) => e.scopeKey.endsWith(`:session:${t.id}`));
        return [t.date, { limited: Boolean(event), spots: String(event?.maxSpots ?? 10) }];
      }),
    );
    const firstConfig = Object.values(configs)[0];
    setSchedulerLimitedMode(firstConfig?.limited ?? false);
    setSchedulerLimitedSpots(firstConfig?.spots ?? "10");
    setSchedulerPerDayConfig(configs);
    setSchedulerPerDayLimited(new Set(Object.values(configs).map((c) => `${c.limited}:${c.spots}`)).size > 1);
  };

  const openTrainingDaysEditor = async (
    mode: "teamGroup" | "createGroup" | "trainingGroup" | "customGroup" | "coachGroup" = "teamGroup",
    editDate?: string,
    coachTarget?: { groupId: string; sessionId?: string },
    customTarget?: Schedule2TrainingTarget,
  ) => {
    if (!clubId || trainingDaysEditorRequest.current !== null) return;
    if (coachGroupId && mode === "teamGroup") mode = "coachGroup";
    const targetCoachGroupId = coachTarget?.groupId ?? coachGroupId;
    if (mode === "coachGroup") setCoachWizardGroupId(targetCoachGroupId);
    if (trainingDaysEditorOpen) {
      setTrainingDaysEditorOpen(false);
      setTrainingDaysEditorError("");
      return;
    }

    const request = Symbol();
    trainingDaysEditorRequest.current = request;
    const isCurrent = () => trainingDaysEditorRequest.current === request;
    const scheduleCellDate = customTarget?.date;
    setSchedule2TrainingGroup(customTarget?.group ?? null);
    setSchedule2TrainingSessionId(customTarget?.edit?.sessionId ?? null);
    setTrainingDaysStartedFromScheduleCell(Boolean(scheduleCellDate));
    setTrainingDaysEditorMode(mode);
    setTrainingDaysSingleEditDate(editDate ?? null);
    setTrainingDaysActiveStep(editDate || scheduleCellDate ? "time" : "days");
    setTrainingDayScheduleNotes(editDate && trainingNote.trim() ? { [editDate]: trainingNote } : {});
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
    setSchedulerLimitedMode(false);
    setSchedulerLimitedSpots("10");
    setSchedulerPerDayLimited(false);
    setSchedulerPerDayConfig({});
    setTrainingDaysEditorLoading(true);
    try {
      await loadTrainingFields();
      if (!isCurrent()) return;
      if (mode === "customGroup" && customTarget) {
        const date = editDate ?? scheduleCellDate;
        setSchedule2InitialNote(editDate ? trainingNote : "");
        const dates = date ? [date] : [];
        const time = customTarget.edit?.time ?? "";
        const duration = customTarget.edit?.duration ?? DEFAULT_TRAINING_DURATION_MINUTES;
        const field = {
          trainingFieldId: customTarget.edit?.fieldId ?? "",
          trainingFieldPieceIds: customTarget.edit?.fieldPieceIds ?? [],
        };
        const times = date && time ? { [date]: time } : {};
        const fields = date ? { [date]: field } : {};
        setTrainingDaysPreExistingDates([]);
        setSchedulerForm((prev) => ({
          ...prev, trainingDates: dates, trainingTime: time,
          trainingDurationMinutes: getTrainingDurationFormValue(duration), ...field,
        }));
        setTrainingDaysInitialDates(dates);
        setTrainingDaysInitialDurationMinutes(duration);
        setTrainingDaysInitialFieldId(field.trainingFieldId);
        setTrainingDaysInitialFieldPieceIds(field.trainingFieldPieceIds);
        setTrainingDateTimes(times);
        setTrainingDaysInitialDateTimes(times);
        setTrainingFieldSelections(fields);
        setTrainingDaysInitialFieldSelections(fields);
        setTrainingFieldActiveDate(date ?? "");
        if (date) {
          const monthIndex = schedulerCalendarMonthsTrimmed.findIndex((month) => month.key === date.slice(0, 7));
          setSchedulerCalendarVisibleMonthIdx(Math.max(0, monthIndex));
        }
        setTrainingDaysEditorOpen(true);
        return;
      }
      const loadedGroups = !isCustomTrainingGroupMode && !customTarget ? await loadTrainingScheduleGroups() : [];
      if (!isCurrent()) return;
      const loadedCustomGroups = isCustomTrainingGroupMode && !customTarget ? await loadCustomTrainingGroups() : [];
      if (!isCurrent()) return;
      if (mode === "customGroup") {
        const groupId = selectedTrainingGroupId;
        const resolvedGroup =
          loadedCustomGroups.find((group) => group.id === groupId) ??
          customTrainingGroups.find((group) => group.id === groupId);
        if (!resolvedGroup) {
          throw new Error("Персонализираната група не е намерена.");
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
          {
            trainingFieldId: resolvedGroup.trainingFieldId ?? null,
            trainingFieldPieceIds: resolvedGroup.trainingFieldPieceIds ?? [],
          },
        );
        const customEditDates = editDate ? [editDate].filter((d) => nextWindowDates.includes(d)) : [];
        const customDates = customEditDates;
        setTrainingDaysPreExistingDates(nextWindowDates);
        setSchedulerForm((prev) => ({
          ...prev,
          trainingDates: customDates,
          trainingTime: resolvedUniformTime,
          trainingDurationMinutes: getTrainingDurationFormValue(resolvedGroup.trainingDurationMinutes),
          trainingFieldId: resolvedGroup.trainingFieldId ?? "",
          trainingFieldPieceIds: resolvedGroup.trainingFieldPieceIds ?? [],
        }));
        setTrainingDaysInitialDates(customDates);
        setTrainingDaysInitialDurationMinutes(
          normalizeTrainingDurationInput(resolvedGroup.trainingDurationMinutes),
        );
        setTrainingDaysInitialFieldId(resolvedGroup.trainingFieldId ?? "");
        setTrainingDaysInitialFieldPieceIds(resolvedGroup.trainingFieldPieceIds ?? []);
        setTrainingDateTimes(resolvedDateTimes);
        setTrainingDaysInitialDateTimes(resolvedDateTimes);
        setTrainingFieldSelections(resolvedFieldSelections);
        setTrainingDaysInitialFieldSelections(resolvedFieldSelections);
        setTrainingFieldActiveDate(editDate ?? nextWindowDates[0] ?? "");
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
          {
            trainingFieldId: resolvedGroup.trainingFieldId ?? null,
            trainingFieldPieceIds: resolvedGroup.trainingFieldPieceIds ?? [],
          },
        );
        const trainingGroupEditDates = editDate ? [editDate].filter((d) => nextWindowDates.includes(d)) : [];
        setTrainingDaysPreExistingDates(nextWindowDates);
        setSchedulerForm((prev) => ({
          ...prev,
          trainingDates: trainingGroupEditDates,
          trainingTime: resolvedUniformTime,
          trainingDurationMinutes: getTrainingDurationFormValue(resolvedGroup.trainingDurationMinutes),
          trainingFieldId: resolvedGroup.trainingFieldId ?? "",
          trainingFieldPieceIds: resolvedGroup.trainingFieldPieceIds ?? [],
        }));
        setTrainingDaysInitialDates(trainingGroupEditDates);
        setTrainingDaysInitialDurationMinutes(
          normalizeTrainingDurationInput(resolvedGroup.trainingDurationMinutes),
        );
        setTrainingDaysInitialFieldId(resolvedGroup.trainingFieldId ?? "");
        setTrainingDaysInitialFieldPieceIds(resolvedGroup.trainingFieldPieceIds ?? []);
        setTrainingDateTimes(resolvedDateTimes);
        setTrainingDaysInitialDateTimes(resolvedDateTimes);
        setTrainingFieldSelections(resolvedFieldSelections);
        setTrainingDaysInitialFieldSelections(resolvedFieldSelections);
        setTrainingFieldActiveDate(editDate ?? nextWindowDates[0] ?? "");
        setTrainingTimeMode(inferTrainingTimeMode(nextWindowDates, resolvedDateTimes));
        setTrainingDaysEditorOpen(true);
        return;
      }
      if (mode === "coachGroup") {
        if (!targetCoachGroupId) throw new Error("Няма избрана треньорска група.");
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups/${encodeURIComponent(targetCoachGroupId)}/schedule`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!isCurrent()) return;
        if (!response.ok) throw new Error(payload.error || "Неуспешно зареждане на графика.");
        const rows = payload.trainings as typeof coachWizardTrainings;
        const rules = payload.recurrences as CoachTrainingRecurrence[];
        setCoachWizardTrainings(rows);
        setCoachWizardRecurrences(rules);
        setCoachWizardVersion(payload.version);
        setCoachWizardEvents(payload.limitedEvents ?? []);
        setTrainingDaysPreExistingDates([
          ...new Set(
            rows
              .filter((t) => t.status === "scheduled" && schedulerCalendarDateSet.has(t.date))
              .map((t) => t.date),
          ),
        ]);
        configureCoachWizardSelection(
          coachTarget?.sessionId ? `session:${coachTarget.sessionId}` : "new",
          rows,
          rules,
          scheduleCellDate ?? editDate,
          payload.limitedEvents ?? [],
        );
        if (scheduleCellDate) {
          const monthIndex = schedulerCalendarMonthsTrimmed.findIndex((month) => month.key === scheduleCellDate.slice(0, 7));
          setSchedulerCalendarVisibleMonthIdx(Math.max(0, monthIndex));
          setTrainingDaysActiveStep("time");
        }
        setTrainingDaysEditorOpen(true);
        return;
      }

      const search = new URLSearchParams();
      if (selectedTeamGroup !== null) {
        search.set("teamGroup", String(selectedTeamGroup));
      }
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/scheduler${search.size ? `?${search.toString()}` : ""}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешно зареждане на графика.");
      }
      const payload = await response.json();
      if (!isCurrent()) return;
      const resolvedTrainingDates =
        mode === "createGroup"
          ? []
          : Array.isArray(payload.trainingDates)
            ? payload.trainingDates
                .map((value: unknown) => String(value ?? "").trim())
                .filter((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value))
                .sort((a: string, b: string) => a.localeCompare(b))
            : [];
      const resolvedDateTimes =
        mode === "createGroup"
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
        {
          trainingFieldId: normalizeOptionalId(payload.trainingFieldId),
          trainingFieldPieceIds: Array.isArray(payload.trainingFieldPieceIds)
            ? payload.trainingFieldPieceIds.map(String)
            : [],
        },
      );
      const hasSecondReminder =
        Number.isInteger(payload.secondReminderDay) &&
        Number.isInteger(payload.secondReminderHour) &&
        Number.isInteger(payload.secondReminderMinute);
      const hasThirdReminder =
        Number.isInteger(payload.thirdReminderDay) &&
        Number.isInteger(payload.thirdReminderHour) &&
        Number.isInteger(payload.thirdReminderMinute);
      const teamGroupEditDates = editDate ? [editDate].filter((d) => resolvedTrainingDates.includes(d)) : [];
      setTrainingDaysPreExistingDates(mode === "createGroup" ? [] : resolvedTrainingDates);
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
        trainingDates: mode === "createGroup" ? [] : teamGroupEditDates,
        trainingTime: resolvedUniformTime,
        trainingDurationMinutes: getTrainingDurationFormValue(payload.trainingDurationMinutes),
        trainingFieldId: normalizeOptionalId(payload.trainingFieldId) ?? "",
        trainingFieldPieceIds: Array.isArray(payload.trainingFieldPieceIds)
          ? payload.trainingFieldPieceIds.map(String)
          : [],
      });
      setSecondReminderEnabled(hasSecondReminder);
      setThirdReminderEnabled(hasThirdReminder);
      setTrainingDaysInitialDates(mode === "createGroup" ? [] : teamGroupEditDates);
      setTrainingDaysInitialDurationMinutes(normalizeTrainingDurationInput(payload.trainingDurationMinutes));
      setTrainingDaysInitialFieldId(normalizeOptionalId(payload.trainingFieldId) ?? "");
      setTrainingDaysInitialFieldPieceIds(
        Array.isArray(payload.trainingFieldPieceIds) ? payload.trainingFieldPieceIds.map(String) : [],
      );
      setTrainingDateTimes(resolvedDateTimes);
      setTrainingDaysInitialDateTimes(resolvedDateTimes);
      setTrainingFieldSelections(resolvedFieldSelections);
      setTrainingDaysInitialFieldSelections(resolvedFieldSelections);
      setTrainingFieldActiveDate(editDate ?? resolvedTrainingDates[0] ?? "");
      setTrainingTimeMode(inferTrainingTimeMode(resolvedTrainingDates, resolvedDateTimes));
      setTrainingDaysEditorOpen(true);
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof Error ? error.message : "Възникна грешка.";
      setTrainingDaysEditorError(message);
      if (customTarget) setSchedule2Error(message);
    } finally {
      if (isCurrent()) {
        trainingDaysEditorRequest.current = null;
        setTrainingDaysEditorLoading(false);
      }
    }
  };

  const executeTeamGroupTrainingDaysSave = async (
    affectedTrainingGroupsSnapshot: Array<{ id: string; name: string }>,
  ) => {
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
    const _preExistingSet = new Set(trainingDaysPreExistingDates);
    const _mergedDates = [
      ...trainingDaysPreExistingDates,
      ...schedulerForm.trainingDates.filter((d) => !_preExistingSet.has(d)),
    ].sort((a, b) => a.localeCompare(b));
    const mergedTrainingDateTimes = buildMergedTrainingDateTimes(
      _mergedDates,
      trainingTimeMode === "all" ? normalizedTrainingTime : null,
    );
    const mergedTrainingFieldSelections = buildMergedTrainingFieldSelections(_mergedDates);
    const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/scheduler`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderDay: Number.parseInt(schedulerForm.reminderDay, 10),
        overdueDay: Number.parseInt(schedulerForm.overdueDay, 10),
        reminderHour: Number.parseInt(schedulerForm.reminderHour, 10),
        reminderMinute: Number.parseInt(schedulerForm.reminderMinute, 10),
        secondReminderDay: secondReminderEnabled
          ? Number.parseInt(schedulerForm.secondReminderDay, 10)
          : null,
        secondReminderHour: secondReminderEnabled
          ? Number.parseInt(schedulerForm.secondReminderHour, 10)
          : null,
        secondReminderMinute: secondReminderEnabled
          ? Number.parseInt(schedulerForm.secondReminderMinute, 10)
          : null,
        thirdReminderDay: thirdReminderEnabled ? Number.parseInt(schedulerForm.thirdReminderDay, 10) : null,
        thirdReminderHour: thirdReminderEnabled ? Number.parseInt(schedulerForm.thirdReminderHour, 10) : null,
        thirdReminderMinute: thirdReminderEnabled
          ? Number.parseInt(schedulerForm.thirdReminderMinute, 10)
          : null,
        overdueHour: Number.parseInt(schedulerForm.overdueHour, 10),
        overdueMinute: Number.parseInt(schedulerForm.overdueMinute, 10),
        trainingDates: _mergedDates,
        trainingTime: normalizedTrainingTime || null,
        trainingDurationMinutes: normalizedTrainingDurationSelection,
        trainingFieldId: primaryTrainingFieldSelection.trainingFieldId || null,
        trainingFieldPieceIds: primaryTrainingFieldSelection.trainingFieldPieceIds,
        trainingFieldSelections: mergedTrainingFieldSelections,
        trainingDateTimes: mergedTrainingDateTimes,
        conflictCheckDates: schedulerForm.trainingDates,
        teamGroup: selectedTeamGroup,
      }),
    });
    const schedulerPayload = (await response.json().catch(() => ({}))) as {
      error?: string;
      warning?: string;
    };
    if (!response.ok) {
      throw new Error(schedulerPayload?.error || "Неуспешно запазване на тренировъчните дни.");
    }

    if (clubId && selectedTeamGroup !== null && schedulerForm.trainingDates.length > 0) {
      const scopeKey = `team_group:${selectedTeamGroup}`;
      const datesToLimit: Array<{ date: string; spots: number }> = schedulerPerDayLimited
        ? schedulerForm.trainingDates
            .filter((d) => schedulerPerDayConfig[d]?.limited)
            .map((d) => ({ date: d, spots: parseInt(schedulerPerDayConfig[d].spots, 10) }))
            .filter(({ spots }) => Number.isInteger(spots) && spots >= 1 && spots <= 200)
        : schedulerLimitedMode && isSchedulerLimitedSpotsValid
          ? schedulerForm.trainingDates.map((d) => ({ date: d, spots: schedulerLimitedSpotsValue }))
          : [];
      if (datesToLimit.length > 0) {
        await Promise.allSettled(
          datesToLimit.map(({ date, spots }) =>
            fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/limited-training-events`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scopeKey,
                scopeId: null,
                teamGroup: selectedTeamGroup,
                trainingDate: date,
                maxSpots: spots,
              }),
            }),
          ),
        );
      }
      const datesToNote = schedulerForm.trainingDates.filter((d) =>
        (trainingDayScheduleNotes[d] ?? "").trim(),
      );
      if (datesToNote.length > 0) {
        await Promise.allSettled(
          datesToNote.map((date) =>
            fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                trainingDate: date,
                note: trainingDayScheduleNotes[date]!.trim(),
                teamGroup: selectedTeamGroup,
              }),
            }),
          ),
        );
      }
    }

    setTrainingDaysEditorCreateOpen(false);
    setTrainingDaysEditorGroupName("");
    setTrainingDaysEditorGroups([]);
    setTrainingDaysEditorOpen(false);
    const schedulerBaseMsg =
      _mergedDates.length > 1
        ? `Промените по графика са изпратени успешно за ${_mergedDates.length} дни.`
        : "Промените по графика са изпратени успешно.";
    setTrainingDaysSuccessMessage(
      schedulerPayload.warning
        ? `${schedulerBaseMsg} Внимание: ${schedulerPayload.warning}`
        : schedulerBaseMsg,
    );
    setTrainingDaysSuccessOpen(true);
    const refreshedGroups = await loadTrainingScheduleGroups();
    await fetchTrainingAttendance(trainingAttendanceDate);
    if (affectedTrainingGroupsSnapshot.length > 0) {
      const firstExisting =
        refreshedGroups.find((group) =>
          affectedTrainingGroupsSnapshot.some((item) => item.id === group.id),
        ) ?? null;
      if (firstExisting) {
        setPostTeamGroupSavePromptGroupId(firstExisting.id);
        setPostTeamGroupSavePromptGroupName(firstExisting.name);
        setPostTeamGroupSavePromptOpen(true);
      }
    }
  };

  const persistCoachWizardSchedule = async (
    trainings: CoachTraining[],
    recurrences: CoachTrainingRecurrence[],
    limits: CoachTrainingLimit[] = [],
  ) => {
    const response = await fetch(
      `/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups/${encodeURIComponent(coachWizardGroupId)}/schedule`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainings: trainings.filter((t) => t.date >= todayIsoDate),
          recurrences,
          version: coachWizardVersion,
          limits,
        }),
      },
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Неуспешно запазване на графика.");
    setCoachWizardTrainings(payload.trainings);
    setCoachWizardRecurrences(payload.recurrences);
    setCoachWizardVersion(payload.version);
    return payload as {
      trainings: typeof coachWizardTrainings;
      recurrences: CoachTrainingRecurrence[];
      version: string;
    };
  };

  const saveTrainingDaysFromTrainingModal = async () => {
    if (!clubId || trainingDaysEditorSaving || trainingFieldBulkApplying) return;
    setTrainingDaysEditorSaving(true);
    setTrainingDaysEditorError("");
    try {
      if (trainingDaysEditorMode === "customGroup" && schedule2TrainingGroup) {
        if (hasMissingTrainingTime) throw new Error("Въведете валиден час на тренировка (HH:mm).");
        if (hasInvalidTrainingDuration) throw new Error("Въведете продължителност между 1 и 1440 минути.");
        if (hasMissingTrainingField) throw new Error(missingTrainingFieldMessage);
        const dates = trainingDaysSingleEditDate ? [trainingDaysSingleEditDate] : normalizedTrainingDaysSelection;
        const sessions = dates.map((date) => {
          const config = schedulerPerDayLimited
            ? schedulerPerDayConfig[date]
            : { limited: schedulerLimitedMode, spots: schedulerLimitedSpots };
          return {
            date,
            time: normalizedTrainingDateTimesSelection[date],
            duration: normalizedTrainingDurationSelection,
            ...(trainingFieldSelections[date] ?? primaryTrainingFieldSelection),
            note: trainingDayScheduleNotes[date] ?? "",
            maxSpots: config?.limited ? Number(config.spots) : null,
          };
        });
        const response = await fetch(schedule2CustomSessionsUrl(clubId, schedule2TrainingGroup.id), {
          method: trainingDaysSingleEditDate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: schedule2TrainingSessionId, sessions }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Неуспешно запазване на тренировката.");
        setTrainingDaysEditorOpen(false);
        setTrainingDaysSuccessMessage("Тренировките са запазени успешно.");
        setTrainingDaysSuccessOpen(true);
        await fetchTrainingWeekSessions();
        return;
      }
      if (trainingDaysEditorMode === "coachGroup") {
        if (hasMissingTrainingTime) throw new Error("Въведете валиден час на тренировка (HH:mm).");
        if (hasInvalidTrainingDuration) throw new Error("Въведете продължителност между 1 и 1440 минути.");
        if (hasMissingTrainingField) throw new Error(missingTrainingFieldMessage);
        const next = buildCoachWizardSchedule({
          trainings: coachWizardTrainings,
          recurrences: coachWizardRecurrences,
          selection: coachWizardSelection,
          dates: normalizedTrainingDaysSelection,
          times: normalizedTrainingDateTimesSelection,
          duration: normalizedTrainingDurationSelection,
          fields: trainingFieldSelections,
          notes: trainingDayScheduleNotes,
          timeMode: trainingTimeMode,
          today: todayIsoDate,
          createId: () => crypto.randomUUID(),
        });
        const previousIds = new Set(coachWizardTrainings.map((t) => t.id));
        const targetId = coachWizardSelection.split(":")[1];
        const targets = next.trainings.filter((t) =>
          coachWizardSelection === "new"
            ? !previousIds.has(t.id)
            : coachWizardSelection.startsWith("session:")
              ? t.id === targetId
              : t.recurrenceId === targetId,
        );
        const limits: CoachTrainingLimit[] = targets.map((t) => {
          const config = schedulerPerDayLimited
            ? schedulerPerDayConfig[t.date]
            : { limited: schedulerLimitedMode, spots: schedulerLimitedSpots };
          return { sessionId: t.id, maxSpots: config?.limited ? Number(config.spots) : null };
        });
        if (coachWizardSelection === "new" && !schedulerPerDayLimited)
          for (const rule of next.recurrences.filter(
            (r) => !coachWizardRecurrences.some((old) => old.id === r.id),
          ))
            limits.push({
              recurrenceId: rule.id,
              maxSpots: schedulerLimitedMode ? Number(schedulerLimitedSpots) : null,
            });
        await persistCoachWizardSchedule(next.trainings, next.recurrences, limits);
        setTrainingDaysEditorOpen(false);
        setTrainingDaysSuccessMessage("Тренировките са запазени успешно.");
        setTrainingDaysSuccessOpen(true);
        await fetchTrainingWeekSessions();
        return;
      }
      const affectedTrainingGroupsSnapshot = selectedTeamGroupLinkedTrainingGroups.map((group) => ({
        id: group.id,
        name: group.name,
      }));
      if (trainingDaysEditorMode === "trainingGroup" || trainingDaysEditorMode === "customGroup") {
        const customGroupId = trainingEditorCustomGroupId;
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
        const _groupPreExistingSet = new Set(trainingDaysPreExistingDates);
        const mergedTrainingDates = [
          ...trainingDaysPreExistingDates,
          ...nextTrainingDates.filter((d) => !_groupPreExistingSet.has(d)),
        ].sort((a, b) => a.localeCompare(b));
        const mergedTrainingDateTimesForPayload = buildMergedTrainingDateTimes(
          mergedTrainingDates,
          trainingTimeMode === "all" ? normalizedTrainingTime : null,
        );
        const mergedTrainingFieldSelectionsForPayload =
          buildMergedTrainingFieldSelections(mergedTrainingDates);
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
            ? `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups/${encodeURIComponent(customGroupId)}`
            : `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups/${encodeURIComponent(selectedTrainingGroupId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trainingDates: mergedTrainingDates,
              trainingTime: normalizedTrainingTime || null,
              trainingDurationMinutes: normalizedTrainingDurationSelection,
              trainingFieldId: primaryTrainingFieldSelection.trainingFieldId || null,
              trainingFieldPieceIds: primaryTrainingFieldSelection.trainingFieldPieceIds,
              trainingFieldSelections: mergedTrainingFieldSelectionsForPayload,
              trainingDateTimes: mergedTrainingDateTimesForPayload,
              conflictCheckDates: nextTrainingDates,
            }),
          },
        );
        const groupPayload = (await groupResponse.json().catch(() => ({}))) as {
          error?: string;
          warning?: string;
        };
        if (!groupResponse.ok) {
          throw new Error(groupPayload.error || "Неуспешно запазване на тренировъчните дни.");
        }

        if (clubId && nextTrainingDates.length > 0) {
          let scopeKey = "";
          let scopeId: string | null = null;
          if (trainingDaysEditorMode === "customGroup") {
            scopeKey = `custom_group:${customGroupId}`;
            scopeId = customGroupId;
          }
          if (scopeKey) {
            const datesToLimit: Array<{ date: string; spots: number }> = schedulerPerDayLimited
              ? nextTrainingDates
                  .filter((d) => schedulerPerDayConfig[d]?.limited)
                  .map((d) => ({ date: d, spots: parseInt(schedulerPerDayConfig[d].spots, 10) }))
                  .filter(({ spots }) => Number.isInteger(spots) && spots >= 1 && spots <= 200)
              : schedulerLimitedMode && isSchedulerLimitedSpotsValid
                ? nextTrainingDates.map((d) => ({ date: d, spots: schedulerLimitedSpotsValue }))
                : [];
            if (datesToLimit.length > 0) {
              await Promise.allSettled(
                datesToLimit.map(({ date, spots }) =>
                  fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/limited-training-events`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      scopeKey,
                      scopeId,
                      teamGroup: null,
                      trainingDate: date,
                      maxSpots: spots,
                    }),
                  }),
                ),
              );
            }
          }
          {
            const datesToNote = nextTrainingDates.filter((d) => (trainingDayScheduleNotes[d] ?? "").trim());
            if (datesToNote.length > 0) {
              const noteBody = (date: string) =>
                trainingDaysEditorMode === "customGroup"
                  ? {
                      trainingDate: date,
                      note: trainingDayScheduleNotes[date]!.trim(),
                      customTrainingGroupId: customGroupId,
                    }
                  : {
                      trainingDate: date,
                      note: trainingDayScheduleNotes[date]!.trim(),
                      trainingGroupId: selectedTrainingGroupId,
                    };
              await Promise.allSettled(
                datesToNote.map((date) =>
                  fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(noteBody(date)),
                  }),
                ),
              );
            }
          }
        }

        setTrainingDaysEditorCreateOpen(false);
        setTrainingDaysEditorGroupName("");
        setTrainingDaysEditorGroups([]);
        if (trainingDaysEditorMode === "customGroup") {
          await loadCustomTrainingGroups();
          await fetchTrainingAttendance(trainingAttendanceDate);
          await fetchTrainingWeekSessions();
          setTrainingDaysEditorOpen(false);
        } else {
          await loadTrainingScheduleGroups();
          await fetchTrainingAttendance(trainingAttendanceDate);
          setTrainingDaysEditorOpen(false);
        }
        const baseMsg =
          nextTrainingDates.length > 1
            ? `Промените по графика са изпратени успешно за ${nextTrainingDates.length} дни.`
            : "Промените по графика са изпратени успешно.";
        setTrainingDaysSuccessMessage(
          groupPayload.warning ? `${baseMsg} Внимание: ${groupPayload.warning}` : baseMsg,
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

  return {
    configureCoachWizardSelection,
    openTrainingDaysEditor,
    executeTeamGroupTrainingDaysSave,
    persistCoachWizardSchedule,
    saveTrainingDaysFromTrainingModal,
    saveTrainingDaysForSelectedGroups,
  };
}

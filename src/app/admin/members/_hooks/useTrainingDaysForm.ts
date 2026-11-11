"use client";

import type * as React from "react";
import { applyTrainingFieldToDates } from "@/lib/trainingFieldPicker";
import { useState, useEffect, useMemo, useRef } from "react";
import { type CoachWizardSelection } from "@/lib/coachTrainingWizard";
import { type CoachTraining, type CoachTrainingRecurrence } from "@/lib/coachTrainingSchedule";
import {
  DEFAULT_TRAINING_DURATION_MINUTES,
  TRAINING_WEEKDAY_LONG_BG,
  TRAINING_TIME_REGEX,
  formatIsoDateForDisplay,
  getNextTrainingCalendarDates,
  getWeekdayMondayFirstIndex,
  normalizeTrainingDateTimes,
  getUniformTrainingTime,
  buildCalendarMonths,
} from "../_utils/members-page-utils";
import {
  type TrainingFieldSelection,
  type TrainingField,
  type TrainingTimeMode,
  type TrainingDaysStep,
} from "../_types/members-page-types";

type TrainingDaysFormOptions = {
  clubId: string;
  selectedTrainingGroupId: string;
  selectedTeamGroup: number | null;
  trainingFields: TrainingField[];
  setTrainingNoteTargetDates: React.Dispatch<React.SetStateAction<string[]>>;
};

import type { Schedule2Group } from "../_components/Schedule2";

export function useTrainingDaysForm({
  clubId,
  selectedTrainingGroupId,
  selectedTeamGroup,
  trainingFields,
  setTrainingNoteTargetDates,
}: TrainingDaysFormOptions) {
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

  const [trainingFieldSelections, setTrainingFieldSelections] = useState<
    Record<string, TrainingFieldSelection>
  >({});

  const [trainingDaysInitialDateTimes, setTrainingDaysInitialDateTimes] = useState<Record<string, string>>(
    {},
  );

  const [trainingDaysInitialFieldSelections, setTrainingDaysInitialFieldSelections] = useState<
    Record<string, TrainingFieldSelection>
  >({});

  const [trainingTimeMode, setTrainingTimeMode] = useState<TrainingTimeMode>("all");

  const [trainingDaysEditorOpen, setTrainingDaysEditorOpen] = useState(false);

  const [trainingDaysEditorLoading, setTrainingDaysEditorLoading] = useState(false);

  const trainingDaysEditorRequest = useRef<symbol | null>(null);
  const [trainingDaysEditorSaving, setTrainingDaysEditorSaving] = useState(false);

  const [trainingDaysEditorError, setTrainingDaysEditorError] = useState("");

  const [trainingDaysPreExistingDates, setTrainingDaysPreExistingDates] = useState<string[]>([]);

  const [trainingDaysSingleEditDate, setTrainingDaysSingleEditDate] = useState<string | null>(null);

  const [trainingDaysActiveStep, setTrainingDaysActiveStep] = useState<TrainingDaysStep>("days");

  const [schedulerLimitedMode, setSchedulerLimitedMode] = useState(false);

  const [schedulerLimitedSpots, setSchedulerLimitedSpots] = useState("10");

  const [schedulerPerDayLimited, setSchedulerPerDayLimited] = useState(false);

  const [schedulerPerDayConfig, setSchedulerPerDayConfig] = useState<
    Record<string, { limited: boolean; spots: string }>
  >({});

  const [trainingFieldActiveDate, setTrainingFieldActiveDate] = useState("");

  const [trainingDaysInitialDates, setTrainingDaysInitialDates] = useState<string[]>([]);

  const [trainingDaysInitialDurationMinutes, setTrainingDaysInitialDurationMinutes] = useState(
    DEFAULT_TRAINING_DURATION_MINUTES,
  );

  const [trainingDaysInitialFieldId, setTrainingDaysInitialFieldId] = useState("");

  const [trainingDaysInitialFieldPieceIds, setTrainingDaysInitialFieldPieceIds] = useState<string[]>([]);

  const [trainingDaysSuccessOpen, setTrainingDaysSuccessOpen] = useState(false);

  const [trainingDaysSuccessMessage, setTrainingDaysSuccessMessage] = useState("");

  const [trainingDayScheduleNotes, setTrainingDayScheduleNotes] = useState<Record<string, string>>({});

  const [trainingDaysEditorMode, setTrainingDaysEditorMode] = useState<
    "teamGroup" | "createGroup" | "trainingGroup" | "customGroup" | "coachGroup"
  >("teamGroup");

  const [coachWizardGroupId, setCoachWizardGroupId] = useState("");

  const [coachWizardTrainings, setCoachWizardTrainings] = useState<
    Array<
      CoachTraining & {
        players?: Array<{
          playerId: string | null;
          playerName: string;
          present: boolean;
          reasonCode: string | null;
          reasonText: string | null;
        }>;
      }
    >
  >([]);

  const [coachWizardRecurrences, setCoachWizardRecurrences] = useState<CoachTrainingRecurrence[]>([]);

  const [coachWizardVersion, setCoachWizardVersion] = useState("");

  const [coachWizardSelection, setCoachWizardSelection] = useState<CoachWizardSelection>("new");

  const [coachWizardEvents, setCoachWizardEvents] = useState<
    Array<{ id: string; scopeKey: string; trainingDate: string; maxSpots: number }>
  >([]);

  const [trainingDaysEditorGroups, setTrainingDaysEditorGroups] = useState<string[]>([]);

  const [trainingDaysEditorGroupName, setTrainingDaysEditorGroupName] = useState("");

  const [trainingDaysEditorCreateOpen, setTrainingDaysEditorCreateOpen] = useState(false);

  const [fieldConflictsMap, setFieldConflictsMap] = useState<
    Record<string, { blockedPieceIds: string[]; wholeFieldBlocked: boolean }>
  >({});

  const [fieldConflictsLoading, setFieldConflictsLoading] = useState(false);

  const [trainingFieldBulkApplying, setTrainingFieldBulkApplying] = useState(false);

  const [trainingFieldBulkSuccess, setTrainingFieldBulkSuccess] = useState<{
    message: string;
    signature: string;
  } | null>(null);

  const [schedule2TrainingGroup, setSchedule2TrainingGroup] = useState<Schedule2Group | null>(null);
  const [trainingDaysStartedFromScheduleCell, setTrainingDaysStartedFromScheduleCell] = useState(false);
  const trainingEditorCustomGroupId = schedule2TrainingGroup?.id ?? selectedTrainingGroupId;
  const latestFieldConflictsParams = useRef<string | null>(null);

  const schedulerCalendarDates = getNextTrainingCalendarDates();

  const schedulerCalendarDateSet = new Set(schedulerCalendarDates);

  const schedulerCalendarMonths = buildCalendarMonths(schedulerCalendarDates);

  const fieldConflictsFetchParams = useMemo<string | null>(() => {
    if (!trainingDaysEditorOpen || trainingDaysEditorMode === "createGroup" || !clubId) return null;
    const datesArr = [...schedulerForm.trainingDates].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (datesArr.length === 0) return null;
    const effectiveTimes: Record<string, string> = {};
    const fallback = trainingTimeMode === "all" ? schedulerForm.trainingTime.trim() : "";
    for (const date of datesArr) {
      const t =
        trainingTimeMode === "all"
          ? fallback
          : (((trainingDateTimes as Record<string, unknown>)[date] as string | undefined)?.trim() ?? "");
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
    } else if (trainingDaysEditorMode === "customGroup" && trainingEditorCustomGroupId) {
      params.set("excludeType", "customGroup");
      params.set("excludeId", trainingEditorCustomGroupId);
    } else if (trainingDaysEditorMode === "coachGroup") {
      if (coachWizardSelection.startsWith("session:")) {
        params.set("excludeType", "coachGroup");
        params.set("excludeId", coachWizardGroupId);
        params.set("excludeSessionId", coachWizardSelection.slice(8));
      } else if (coachWizardSelection.startsWith("rule:")) {
        params.set("excludeType", "coachGroup");
        params.set("excludeId", coachWizardGroupId);
        params.set(
          "excludeSessionIds",
          coachWizardTrainings
            .filter((t) => t.recurrenceId === coachWizardSelection.slice(5))
            .map((t) => t.id)
            .join(","),
        );
      }
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
  }, [
    trainingDaysEditorOpen,
    trainingDaysEditorMode,
    clubId,
    schedulerForm.trainingDates,
    schedulerForm.trainingDurationMinutes,
    schedulerForm.trainingTime,
    trainingDateTimes,
    trainingTimeMode,
    selectedTrainingGroupId,
    trainingEditorCustomGroupId,
    coachWizardSelection,
    coachWizardGroupId,
    coachWizardTrainings,
    selectedTeamGroup,
  ]);

  latestFieldConflictsParams.current = fieldConflictsFetchParams;

  const trainingFieldBulkSignature = JSON.stringify({
    params: fieldConflictsFetchParams,
    selections: trainingFieldSelections,
  });

  useEffect(() => {
    setTrainingFieldBulkSuccess(null);
  }, [trainingDaysEditorOpen]);

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
        const payload = (await response.json()) as { occupiedResources?: unknown[] };
        if (cancelled) return;
        const occupied = Array.isArray(payload?.occupiedResources)
          ? (payload.occupiedResources as Array<{ date?: string; fieldId: string; pieceIds: string[] }>)
          : [];
        const map: Record<string, { blockedPieceIds: string[]; wholeFieldBlocked: boolean }> = {};
        for (const field of trainingFields) {
          const relevant = occupied.filter(
            (r) => r.fieldId === field.id && (!r.date || r.date === trainingFieldActiveDate),
          );
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
    return () => {
      cancelled = true;
    };
  }, [fieldConflictsFetchParams, clubId, trainingFields, trainingFieldActiveDate]);

  const activeTrainingFieldSelection = trainingFieldSelections[trainingFieldActiveDate] ?? {
    trainingFieldId: "",
    trainingFieldPieceIds: [],
  };

  const selectedActiveTrainingField =
    trainingFields.find((field) => field.id === activeTrainingFieldSelection.trainingFieldId) ?? null;

  const applyFieldToAllTrainingDays = async () => {
    if (!clubId || !fieldConflictsFetchParams || trainingFieldBulkApplying) return;
    const paramsSnapshot = fieldConflictsFetchParams;
    const dates = [...schedulerForm.trainingDates];
    const selection = {
      trainingFieldId: activeTrainingFieldSelection.trainingFieldId,
      trainingFieldPieceIds: [...activeTrainingFieldSelection.trainingFieldPieceIds],
    };
    setTrainingFieldBulkApplying(true);
    setTrainingFieldBulkSuccess(null);
    setTrainingDaysEditorError("");
    try {
      const query = new URLSearchParams(paramsSnapshot);
      const times = JSON.parse(query.get("dateTimes") ?? "{}");
      if (dates.some((date) => !times[date])) throw new Error("Задайте час за всяка избрана дата.");
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/field-conflicts?${paramsSnapshot}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Неуспешна проверка за заетост на терена. Опитайте отново.");
      const payload = await response.json();
      if (!Array.isArray(payload.occupiedResources))
        throw new Error("Неуспешна проверка за заетост на терена.");
      if (latestFieldConflictsParams.current !== paramsSnapshot)
        throw new Error("Датите или часовете са променени. Проверете отново.");
      const result = applyTrainingFieldToDates(
        trainingFieldSelections,
        dates,
        selection,
        payload.occupiedResources,
      );
      if (!result.selections) {
        setTrainingFieldActiveDate(result.conflictingDates[0]);
        throw new Error(
          `Избраният терен или позиции са заети на: ${result.conflictingDates.map(formatIsoDateForDisplay).join(", ")}. Изберете други позиции за тези дни.`,
        );
      }
      setTrainingFieldSelections(result.selections);
      setTrainingFieldBulkSuccess({
        message: `Теренът и позициите са приложени успешно за всички избрани дни (${dates.length}).`,
        signature: JSON.stringify({ params: paramsSnapshot, selections: result.selections }),
      });
    } catch (error) {
      setTrainingDaysEditorError(error instanceof Error ? error.message : "Неуспешна проверка на терена.");
    } finally {
      setTrainingFieldBulkApplying(false);
    }
  };

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
    normalizedTrainingDaysSelection.some(
      (date) => !TRAINING_TIME_REGEX.test((normalizedTrainingDateTimesSelection[date] ?? "").trim()),
    );

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
    trainingDaysEditorMode !== "createGroup" && normalizedTrainingDaysSelection.length > 0;

  const canShowTrainingDaysFieldStep =
    canShowTrainingDaysTimeStep && !hasMissingTrainingTime && !hasInvalidTrainingDuration;

  const spotsStepSupportedByMode =
    trainingDaysEditorMode === "teamGroup" ||
    trainingDaysEditorMode === "customGroup" ||
    trainingDaysEditorMode === "coachGroup";

  const canShowTrainingDaysSpotsStep = canShowTrainingDaysFieldStep && spotsStepSupportedByMode;

  const canShowTrainingDaysNotesStep = canShowTrainingDaysFieldStep;

  const stepSequence: TrainingDaysStep[] = spotsStepSupportedByMode
    ? ["days", "time", "spots", "field", "notes"]
    : ["days", "time", "field", "notes"];

  const schedulerLimitedSpotsValue = parseInt(schedulerLimitedSpots, 10);

  const isSchedulerLimitedSpotsValid =
    Number.isInteger(schedulerLimitedSpotsValue) &&
    schedulerLimitedSpotsValue >= 1 &&
    schedulerLimitedSpotsValue <= 200;

  const isSchedulerPerDayConfigValid =
    !schedulerPerDayLimited ||
    !normalizedTrainingDaysSelection.some((d) => {
      const cfg = schedulerPerDayConfig[d];
      if (!cfg?.limited) return false;
      const s = parseInt(cfg.spots, 10);
      return !Number.isInteger(s) || s < 1 || s > 200;
    });

  const effectiveTrainingDaysActiveStep: TrainingDaysStep =
    trainingDaysEditorMode === "createGroup"
      ? "days"
      : trainingDaysActiveStep === "notes" && !canShowTrainingDaysNotesStep
        ? canShowTrainingDaysFieldStep
          ? "field"
          : canShowTrainingDaysSpotsStep
            ? "spots"
            : canShowTrainingDaysTimeStep
              ? "time"
              : "days"
        : trainingDaysActiveStep === "field" && !canShowTrainingDaysFieldStep
          ? canShowTrainingDaysSpotsStep
            ? "spots"
            : canShowTrainingDaysTimeStep
              ? "time"
              : "days"
          : trainingDaysActiveStep === "spots" && !canShowTrainingDaysSpotsStep
            ? canShowTrainingDaysTimeStep
              ? "time"
              : "days"
            : trainingDaysActiveStep === "time" && !canShowTrainingDaysTimeStep
              ? "days"
              : trainingDaysActiveStep;

  const currentStepOrder = stepSequence.indexOf(effectiveTrainingDaysActiveStep);

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
        : `${normalizedTrainingDaysSelection
            .slice(0, 4)
            .map((date) => formatIsoDateForDisplay(date))
            .join(", ")} + още ${normalizedTrainingDaysSelection.length - 4}`;

  const trainingTimeSummaryText = hasMissingTrainingTime
    ? "Няма въведен валиден час"
    : trainingTimeMode === "all"
      ? `Всички тренировки: ${schedulerForm.trainingTime.trim()}`
      : trainingTimeMode === "byWeekday"
        ? `По седмични дни: ${trainingWeekdayBuckets
            .map((weekdayIndex) => {
              const weekdayDate = normalizedTrainingDaysSelection.find(
                (date) => getWeekdayMondayFirstIndex(date) === weekdayIndex,
              );
              const weekdayTime = weekdayDate ? normalizedTrainingDateTimesSelection[weekdayDate] : "";
              return `${TRAINING_WEEKDAY_LONG_BG[weekdayIndex] ?? `#${weekdayIndex + 1}`} ${weekdayTime}`;
            })
            .join(", ")}`
        : normalizedTrainingDaysSelection.length <= 3
          ? `Индивидуално: ${normalizedTrainingDaysSelection.map((date) => `${formatIsoDateForDisplay(date)} ${normalizedTrainingDateTimesSelection[date] ?? ""}`).join(", ")}`
          : `Индивидуални часове за ${normalizedTrainingDaysSelection.length} тренировки`;

  const trainingDurationSummaryText = hasInvalidTrainingDuration
    ? "Невалидна продължителност"
    : `${normalizedTrainingDurationSelection} мин.`;

  const primaryTrainingFieldSelection = normalizedTrainingDaysSelection
    .map((date) => trainingFieldSelections[date])
    .find((selection) => selection?.trainingFieldId) ?? { trainingFieldId: null, trainingFieldPieceIds: [] };

  const showTrainingStepBack =
    trainingDaysEditorMode !== "createGroup" &&
    effectiveTrainingDaysActiveStep !== "days" &&
    !(trainingDaysStartedFromScheduleCell && effectiveTrainingDaysActiveStep === "time");

  const showTrainingStepNext =
    trainingDaysEditorMode !== "createGroup" && effectiveTrainingDaysActiveStep !== "notes";

  const isTrainingStepNextDisabled =
    trainingDaysEditorSaving ||
    (effectiveTrainingDaysActiveStep === "days" && !canShowTrainingDaysTimeStep) ||
    (effectiveTrainingDaysActiveStep === "time" && !canShowTrainingDaysFieldStep) ||
    (effectiveTrainingDaysActiveStep === "spots" &&
      !schedulerPerDayLimited &&
      schedulerLimitedMode &&
      !isSchedulerLimitedSpotsValid) ||
    (effectiveTrainingDaysActiveStep === "spots" && !isSchedulerPerDayConfigValid);

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

  const buildMergedTrainingDateTimes = (dates: string[], fallbackTrainingTime: string | null) =>
    normalizeTrainingDateTimes(
      { ...trainingDaysInitialDateTimes, ...trainingDateTimes },
      dates,
      fallbackTrainingTime,
    );

  const buildMergedTrainingFieldSelections = (dates: string[]) => {
    const allowedDates = new Set(dates);
    const merged: Record<string, TrainingFieldSelection> = {};
    for (const [date, selection] of Object.entries({
      ...trainingDaysInitialFieldSelections,
      ...trainingFieldSelections,
    })) {
      if (allowedDates.has(date)) {
        merged[date] = selection;
      }
    }
    return merged;
  };

  const isTrainingDaysScheduleUnchanged =
    trainingDaysEditorMode !== "coachGroup" &&
    trainingDaysEditorMode !== "createGroup" &&
    normalizedTrainingDaysSelection.join("|") === normalizedTrainingDaysInitial.join("|") &&
    normalizedTrainingDateTimesSelectionKey === normalizedTrainingDateTimesInitialKey &&
    normalizedTrainingDurationSelection === trainingDaysInitialDurationMinutes &&
    normalizedTrainingFieldSelectionsKey === normalizedTrainingFieldSelectionsInitialKey;

  useEffect(() => {
    setTrainingDateTimes((prev) => {
      const selected = new Set([...trainingDaysPreExistingDates, ...schedulerForm.trainingDates]);
      let changed = false;
      const next: Record<string, string> = {};
      for (const date of selected) {
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
      for (const date of new Set([...trainingDaysPreExistingDates, ...schedulerForm.trainingDates])) {
        if (prev[date]) next[date] = prev[date];
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    if (
      schedulerForm.trainingDates.length > 0 &&
      !schedulerForm.trainingDates.includes(trainingFieldActiveDate)
    ) {
      setTrainingFieldActiveDate(schedulerForm.trainingDates[0]);
    }
  }, [schedulerForm.trainingDates, trainingDaysPreExistingDates]);

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

    const firstTime =
      schedulerForm.trainingDates
        .map((date) => (trainingDateTimes[date] ?? "").trim())
        .find((value) => TRAINING_TIME_REGEX.test(value)) ?? "";

    if (firstTime && firstTime !== schedulerForm.trainingTime) {
      setSchedulerForm((prev) => ({ ...prev, trainingTime: firstTime }));
    }
  }, [schedulerForm.trainingDates, schedulerForm.trainingTime, trainingDateTimes, trainingTimeMode]);

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
    if (trainingDaysEditorMode === "coachGroup" && coachWizardSelection.startsWith("session:")) {
      const selected = coachWizardTrainings.find((t) => `session:${t.id}` === coachWizardSelection);
      setSchedulerForm((prev) => ({ ...prev, trainingDates: [date] }));
      setTrainingDateTimes({ [date]: schedulerForm.trainingTime });
      setTrainingFieldSelections({
        [date]: {
          trainingFieldId: selected?.trainingFieldId ?? null,
          trainingFieldPieceIds: selected?.trainingFieldPieceIds ?? [],
        },
      });
      setTrainingDayScheduleNotes({ [date]: selected?.note ?? "" });
      setTrainingFieldActiveDate(date);
      return;
    }
    if (trainingDaysSingleEditDate === date) return;
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
          (existingDate) =>
            getWeekdayMondayFirstIndex(existingDate) === weekdayIndex &&
            TRAINING_TIME_REGEX.test((next[existingDate] ?? "").trim()),
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

  return {
    trainingDaysEditorRequest,
    schedule2TrainingGroup,
    setSchedule2TrainingGroup,
    trainingDaysStartedFromScheduleCell,
    setTrainingDaysStartedFromScheduleCell,
    trainingEditorCustomGroupId,
    schedulerForm,
    setSchedulerForm,
    trainingDateTimes,
    setTrainingDateTimes,
    trainingFieldSelections,
    setTrainingFieldSelections,
    setTrainingDaysInitialDateTimes,
    setTrainingDaysInitialFieldSelections,
    trainingTimeMode,
    setTrainingTimeMode,
    trainingDaysEditorOpen,
    setTrainingDaysEditorOpen,
    trainingDaysEditorLoading,
    setTrainingDaysEditorLoading,
    trainingDaysEditorSaving,
    setTrainingDaysEditorSaving,
    trainingDaysEditorError,
    setTrainingDaysEditorError,
    trainingDaysPreExistingDates,
    setTrainingDaysPreExistingDates,
    trainingDaysSingleEditDate,
    setTrainingDaysSingleEditDate,
    setTrainingDaysActiveStep,
    schedulerLimitedMode,
    setSchedulerLimitedMode,
    schedulerLimitedSpots,
    setSchedulerLimitedSpots,
    schedulerPerDayLimited,
    setSchedulerPerDayLimited,
    schedulerPerDayConfig,
    setSchedulerPerDayConfig,
    trainingFieldActiveDate,
    setTrainingFieldActiveDate,
    setTrainingDaysInitialDates,
    trainingDaysInitialDurationMinutes,
    setTrainingDaysInitialDurationMinutes,
    setTrainingDaysInitialFieldId,
    setTrainingDaysInitialFieldPieceIds,
    trainingDaysSuccessOpen,
    setTrainingDaysSuccessOpen,
    trainingDaysSuccessMessage,
    setTrainingDaysSuccessMessage,
    trainingDayScheduleNotes,
    setTrainingDayScheduleNotes,
    trainingDaysEditorMode,
    setTrainingDaysEditorMode,
    coachWizardGroupId,
    setCoachWizardGroupId,
    coachWizardTrainings,
    setCoachWizardTrainings,
    coachWizardRecurrences,
    setCoachWizardRecurrences,
    coachWizardVersion,
    setCoachWizardVersion,
    coachWizardSelection,
    setCoachWizardSelection,
    coachWizardEvents,
    setCoachWizardEvents,
    trainingDaysEditorGroups,
    setTrainingDaysEditorGroups,
    trainingDaysEditorGroupName,
    setTrainingDaysEditorGroupName,
    trainingDaysEditorCreateOpen,
    setTrainingDaysEditorCreateOpen,
    fieldConflictsMap,
    fieldConflictsLoading,
    trainingFieldBulkApplying,
    trainingFieldBulkSuccess,
    schedulerCalendarDateSet,
    schedulerCalendarMonths,
    trainingFieldBulkSignature,
    activeTrainingFieldSelection,
    selectedActiveTrainingField,
    applyFieldToAllTrainingDays,
    hasMissingTrainingField,
    missingTrainingFieldMessage,
    normalizedTrainingDaysSelection,
    normalizedTrainingDaysInitial,
    normalizedTrainingDateTimesSelection,
    normalizedTrainingDateTimesInitial,
    hasMissingTrainingTime,
    normalizedTrainingDurationSelection,
    hasInvalidTrainingDuration,
    canShowTrainingDaysTimeStep,
    canShowTrainingDaysFieldStep,
    spotsStepSupportedByMode,
    canShowTrainingDaysSpotsStep,
    canShowTrainingDaysNotesStep,
    stepSequence,
    schedulerLimitedSpotsValue,
    isSchedulerLimitedSpotsValid,
    effectiveTrainingDaysActiveStep,
    currentStepOrder,
    trainingWeekdayBuckets,
    trainingDaysSummaryText,
    trainingTimeSummaryText,
    trainingDurationSummaryText,
    primaryTrainingFieldSelection,
    showTrainingStepBack,
    showTrainingStepNext,
    isTrainingStepNextDisabled,
    normalizedTrainingDateTimesSelectionKey,
    normalizedTrainingDateTimesInitialKey,
    normalizedTrainingFieldSelectionsKey,
    normalizedTrainingFieldSelectionsInitialKey,
    buildMergedTrainingDateTimes,
    buildMergedTrainingFieldSelections,
    isTrainingDaysScheduleUnchanged,
    handleTrainingTimeModeChange,
    handleTrainingAllTimeChange,
    handleTrainingDateTimeChange,
    handleTrainingWeekdayTimeChange,
    toggleTrainingDate,
    toggleTrainingNoteTargetDate,
  };
}

export type TrainingDaysForm = ReturnType<typeof useTrainingDaysForm>;

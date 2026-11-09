import type * as React from "react";
import {
  TRAINING_TIME_REGEX,
  normalizeTrainingDateTimes,
  getUniformTrainingTime,
  getTrainingDurationFormValue,
  normalizeOptionalId,
  inferTrainingTimeMode,
} from "../_utils/members-page-utils";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type Options = {
  trainingDaysForm: Pick<
    TrainingDaysForm,
    | "trainingFieldSelections"
    | "setSchedulerForm"
    | "setTrainingDateTimes"
    | "setTrainingTimeMode"
    | "schedulerForm"
    | "hasInvalidTrainingDuration"
    | "hasMissingTrainingField"
    | "missingTrainingFieldMessage"
    | "normalizedTrainingDurationSelection"
    | "primaryTrainingFieldSelection"
    | "trainingDateTimes"
    | "trainingTimeMode"
  >;
  setSecondReminderEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setThirdReminderEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  clubId: string;
  setSchedulerSettingsError: React.Dispatch<React.SetStateAction<string>>;
  setSchedulerSettingsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSchedulerSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTeamGroup: number | null;
  schedulerSettingsSaving: boolean;
  setSchedulerSettingsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  secondReminderEnabled: boolean;
  thirdReminderEnabled: boolean;
};

export function createReminderSettingsActions({
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
}: Options) {
  const {
    trainingFieldSelections,
    setSchedulerForm,
    setTrainingDateTimes,
    setTrainingTimeMode,
    schedulerForm,
    hasInvalidTrainingDuration,
    hasMissingTrainingField,
    missingTrainingFieldMessage,
    normalizedTrainingDurationSelection,
    primaryTrainingFieldSelection,
    trainingDateTimes,
    trainingTimeMode,
  } = trainingDaysForm;
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
      const fallbackDay =
        Array.from({ length: 28 }, (_, index) => index + 1).find((day) => !usedDays.includes(day)) ?? 27;
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
        getUniformTrainingTime(resolvedTrainingDates, resolvedDateTimes) ||
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
        trainingFieldPieceIds: Array.isArray(payload.trainingFieldPieceIds)
          ? payload.trainingFieldPieceIds.map(String)
          : [],
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
          thirdReminderHour: thirdReminderEnabled
            ? Number.parseInt(schedulerForm.thirdReminderHour, 10)
            : null,
          thirdReminderMinute: thirdReminderEnabled
            ? Number.parseInt(schedulerForm.thirdReminderMinute, 10)
            : null,
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

  return {
    enableSecondReminder,
    disableSecondReminder,
    enableThirdReminder,
    disableThirdReminder,
    openSchedulerSettings,
    saveSchedulerSettings,
  };
}

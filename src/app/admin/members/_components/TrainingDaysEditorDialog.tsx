"use client";

import { TrainingTimeStep } from "./TrainingTimeStep";
import { TrainingDatesStep } from "./TrainingDatesStep";
import { TrainingCapacityStep } from "./TrainingCapacityStep";
import { TrainingVenueStep } from "./TrainingVenueStep";
import { TrainingNotesStep } from "./TrainingNotesStep";

import type * as React from "react";
import { TimeInput } from "@/components/TimeInput";

import { XIcon } from "./members-page-icons";
import { formatIsoDateForDisplay } from "../_utils/members-page-utils";
import {
  type TrainingScheduleGroup,
  type CustomTrainingGroup,
  type TrainingField,
} from "../_types/members-page-types";

import { type CoachGroups } from "../_hooks/useCoachGroups";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type TrainingDaysEditorDialogProps = {
  trainingDaysForm: Pick<
    TrainingDaysForm,
    | "trainingDaysEditorOpen"
    | "trainingDaysEditorSaving"
    | "setTrainingDaysEditorOpen"
    | "trainingDaysEditorCreateOpen"
    | "setTrainingDaysEditorCreateOpen"
    | "setTrainingDaysEditorError"
    | "trainingDaysEditorLoading"
    | "trainingDaysEditorMode"
    | "trainingDaysSingleEditDate"
    | "schedulerForm"
    | "coachWizardGroupId"
    | "effectiveTrainingDaysActiveStep"
    | "setTrainingDaysActiveStep"
    | "currentStepOrder"
    | "stepSequence"
    | "canShowTrainingDaysTimeStep"
    | "spotsStepSupportedByMode"
    | "canShowTrainingDaysSpotsStep"
    | "canShowTrainingDaysFieldStep"
    | "canShowTrainingDaysNotesStep"
    | "handleTrainingAllTimeChange"
    | "trainingDaysSummaryText"
    | "trainingTimeSummaryText"
    | "trainingDurationSummaryText"
    | "schedulerPerDayLimited"
    | "normalizedTrainingDaysSelection"
    | "schedulerPerDayConfig"
    | "schedulerLimitedMode"
    | "isSchedulerLimitedSpotsValid"
    | "schedulerLimitedSpotsValue"
    | "trainingTimeMode"
    | "handleTrainingTimeModeChange"
    | "setSchedulerForm"
    | "trainingDateTimes"
    | "handleTrainingDateTimeChange"
    | "trainingWeekdayBuckets"
    | "handleTrainingWeekdayTimeChange"
    | "trainingDaysEditorGroupName"
    | "setTrainingDaysEditorGroupName"
    | "trainingDaysEditorGroups"
    | "setTrainingDaysEditorGroups"
    | "schedulerCalendarMonths"
    | "schedulerCalendarDateSet"
    | "trainingDaysPreExistingDates"
    | "coachWizardTrainings"
    | "toggleTrainingDate"
    | "setSchedulerLimitedMode"
    | "schedulerLimitedSpots"
    | "setSchedulerLimitedSpots"
    | "setSchedulerPerDayConfig"
    | "setSchedulerPerDayLimited"
    | "fieldConflictsLoading"
    | "trainingFieldActiveDate"
    | "setTrainingFieldActiveDate"
    | "trainingFieldBulkApplying"
    | "applyFieldToAllTrainingDays"
    | "activeTrainingFieldSelection"
    | "trainingFieldBulkSuccess"
    | "trainingFieldBulkSignature"
    | "fieldConflictsMap"
    | "setTrainingFieldSelections"
    | "selectedActiveTrainingField"
    | "hasMissingTrainingField"
    | "missingTrainingFieldMessage"
    | "trainingDayScheduleNotes"
    | "setTrainingDayScheduleNotes"
    | "trainingDaysEditorError"
    | "isTrainingDaysScheduleUnchanged"
    | "showTrainingStepBack"
    | "showTrainingStepNext"
    | "isTrainingStepNextDisabled"
    | "hasMissingTrainingTime"
    | "hasInvalidTrainingDuration"
  >;
  trainingGroups: Pick<TrainingGroups, "trainingScheduleGroupsLoading" | "trainingScheduleGroups">;
  coachGroupManagement: Pick<CoachGroups, "coachGroups">;
  selectedTrainingGroup: TrainingScheduleGroup | null;
  selectedCustomGroup: CustomTrainingGroup | null;
  coachGroupId: string;
  selectedTeamGroup: number | null;
  selectedTeamGroupLinkedTrainingGroups: TrainingScheduleGroup[];
  groupOptions: number[];
  schedulerCalendarMonthsTrimmed: { cells: (string | null)[]; key: string; label: string }[];
  setSchedulerCalendarVisibleMonthIdx: React.Dispatch<React.SetStateAction<number>>;
  schedulerCalendarVisibleMonthIdx: number;
  todayIsoDate: string;
  trainingFields: TrainingField[];
  trainingFieldsLoading: boolean;
  openTrainingFieldModal: (field?: TrainingField) => void;
  saveTrainingDaysForSelectedGroups: () => Promise<void>;
  saveTrainingDaysFromTrainingModal: () => Promise<void>;
};

export function TrainingDaysEditorDialog({
  trainingDaysForm,
  trainingGroups,
  coachGroupManagement,
  selectedTrainingGroup,
  selectedCustomGroup,
  coachGroupId,
  selectedTeamGroup,
  selectedTeamGroupLinkedTrainingGroups,
  groupOptions,
  schedulerCalendarMonthsTrimmed,
  setSchedulerCalendarVisibleMonthIdx,
  schedulerCalendarVisibleMonthIdx,
  todayIsoDate,
  trainingFields,
  trainingFieldsLoading,
  openTrainingFieldModal,
  saveTrainingDaysForSelectedGroups,
  saveTrainingDaysFromTrainingModal,
}: TrainingDaysEditorDialogProps) {
  const {
    trainingDaysEditorOpen,
    trainingDaysEditorSaving,
    setTrainingDaysEditorOpen,
    trainingDaysEditorCreateOpen,
    setTrainingDaysEditorCreateOpen,
    setTrainingDaysEditorError,
    trainingDaysEditorLoading,
    trainingDaysEditorMode,
    trainingDaysSingleEditDate,
    schedulerForm,
    coachWizardGroupId,
    effectiveTrainingDaysActiveStep,
    setTrainingDaysActiveStep,
    currentStepOrder,
    stepSequence,
    canShowTrainingDaysTimeStep,
    spotsStepSupportedByMode,
    canShowTrainingDaysSpotsStep,
    canShowTrainingDaysFieldStep,
    canShowTrainingDaysNotesStep,
    handleTrainingAllTimeChange,
    trainingDaysSummaryText,
    trainingTimeSummaryText,
    trainingDurationSummaryText,
    schedulerPerDayLimited,
    normalizedTrainingDaysSelection,
    schedulerPerDayConfig,
    schedulerLimitedMode,
    isSchedulerLimitedSpotsValid,
    schedulerLimitedSpotsValue,
    trainingDaysEditorGroupName,
    setTrainingDaysEditorGroupName,
    trainingDaysEditorGroups,
    setTrainingDaysEditorGroups,
    trainingFieldBulkApplying,
    hasMissingTrainingField,
    missingTrainingFieldMessage,
    trainingDaysEditorError,
    isTrainingDaysScheduleUnchanged,
    showTrainingStepBack,
    showTrainingStepNext,
    isTrainingStepNextDisabled,
    hasMissingTrainingTime,
    hasInvalidTrainingDuration,
  } = trainingDaysForm;
  const { trainingScheduleGroupsLoading, trainingScheduleGroups } = trainingGroups;
  const { coachGroups } = coachGroupManagement;
  return (
    <>
      {trainingDaysEditorOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!trainingDaysEditorSaving) {
              setTrainingDaysEditorOpen(false);
            }
          }}
        >
          <div
            className="amp-modal amp-modal--confirm amp-modal--training-days-editor"
            onClick={(e) => e.stopPropagation()}
          >
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
            <div
              className="amp-modal-body"
              style={{ position: "relative", display: "flex", flexDirection: "column" }}
            >
              {trainingDaysEditorSaving && (
                <div
                  className="amp-modal-loading-overlay"
                  style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(16,16,20,0.9)" }}
                >
                  <div className="amp-loading" style={{ minHeight: 200 }}>
                    <div className="amp-spinner" />
                    <p style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                      Запазване...
                    </p>
                  </div>
                </div>
              )}
              {false && !trainingDaysEditorCreateOpen && (
                <>
                  <div
                    className="amp-training-days-editor-header"
                    style={{ alignItems: "flex-start", flexDirection: "column", gap: "8px" }}
                  >
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
                  <div
                    className="amp-training-days-editor-header"
                    style={{ flexDirection: "column", alignItems: "center", textAlign: "center" }}
                  >
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      {trainingDaysEditorMode === "createGroup"
                        ? "Създай сборен отбор"
                        : trainingDaysEditorMode === "trainingGroup"
                          ? "Задай тренировъчни дни за сборен отбор"
                          : trainingDaysEditorMode === "coachGroup"
                            ? "Тренировъчен график"
                            : "Избери тренировъчни дни (следващи 3 месеца)"}
                    </span>
                    {trainingDaysEditorMode !== "createGroup" && trainingDaysSingleEditDate === null && (
                      <span className="amp-lbl" style={{ textAlign: "center" }}>
                        Избрани: {schedulerForm.trainingDates.length}
                      </span>
                    )}
                    {trainingDaysEditorMode !== "createGroup" && trainingDaysSingleEditDate !== null && (
                      <span className="amp-lbl" style={{ textAlign: "center" }}>
                        Редактирате: {formatIsoDateForDisplay(trainingDaysSingleEditDate)}
                      </span>
                    )}
                  </div>
                  <div
                    className="amp-training-days-editor-header"
                    style={{
                      marginTop: "8px",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px",
                      textAlign: "center",
                    }}
                  >
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
                        width: "100%",
                      }}
                    >
                      {trainingDaysEditorMode === "trainingGroup"
                        ? `Сборен отбор: ${selectedTrainingGroup?.name ?? "-"}`
                        : trainingDaysEditorMode === "customGroup"
                          ? `Персонализирана група: ${selectedCustomGroup?.name ?? "-"}`
                          : trainingDaysEditorMode === "coachGroup"
                            ? `Треньорска група: ${coachGroups.find((g) => g.id === (coachWizardGroupId || coachGroupId))?.name ?? ""}`
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
                            ? `Тези промени ще се запазят за треньорска група ${coachGroups.find((g) => g.id === (coachWizardGroupId || coachGroupId))?.name ?? ""}.`
                            : selectedTeamGroup === null
                              ? "Тези промени ще се запазят за всички набори."
                              : `Тези промени ще се запазят за набор ${selectedTeamGroup}.`}
                    </span>
                  </div>
                  {trainingDaysEditorMode !== "createGroup" && (
                    <div
                      className="amp-training-stepper"
                      aria-label="Стъпки за тренировъчен график"
                      style={{ order: 0 }}
                    >
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
                        className={`amp-training-step${effectiveTrainingDaysActiveStep === "time" ? " is-active" : ""}${currentStepOrder > stepSequence.indexOf("time") ? " is-complete" : ""}`}
                        onClick={() => setTrainingDaysActiveStep("time")}
                        disabled={
                          trainingDaysEditorSaving ||
                          !canShowTrainingDaysTimeStep ||
                          stepSequence.indexOf("time") > currentStepOrder
                        }
                      >
                        <span className="amp-training-step-index">2</span>
                        Час
                      </button>
                      {spotsStepSupportedByMode && (
                        <button
                          type="button"
                          className={`amp-training-step${effectiveTrainingDaysActiveStep === "spots" ? " is-active" : ""}${currentStepOrder > stepSequence.indexOf("spots") ? " is-complete" : ""}`}
                          onClick={() => setTrainingDaysActiveStep("spots")}
                          disabled={
                            trainingDaysEditorSaving ||
                            !canShowTrainingDaysSpotsStep ||
                            stepSequence.indexOf("spots") > currentStepOrder
                          }
                        >
                          <span className="amp-training-step-index">3</span>
                          Места
                        </button>
                      )}
                      <button
                        type="button"
                        className={`amp-training-step${effectiveTrainingDaysActiveStep === "field" ? " is-active" : ""}${currentStepOrder > stepSequence.indexOf("field") ? " is-complete" : ""}`}
                        onClick={() => setTrainingDaysActiveStep("field")}
                        disabled={
                          trainingDaysEditorSaving ||
                          !canShowTrainingDaysFieldStep ||
                          stepSequence.indexOf("field") > currentStepOrder
                        }
                      >
                        <span className="amp-training-step-index">{spotsStepSupportedByMode ? 4 : 3}</span>
                        Терен
                      </button>
                      <button
                        type="button"
                        className={`amp-training-step${effectiveTrainingDaysActiveStep === "notes" ? " is-active" : ""}`}
                        onClick={() => setTrainingDaysActiveStep("notes")}
                        disabled={
                          trainingDaysEditorSaving ||
                          !canShowTrainingDaysNotesStep ||
                          stepSequence.indexOf("notes") > currentStepOrder
                        }
                      >
                        <span className="amp-training-step-index">{spotsStepSupportedByMode ? 5 : 4}</span>
                        Описание
                      </button>
                    </div>
                  )}
                  {trainingDaysEditorMode !== "createGroup" && (
                    <label
                      className="amp-edit-field"
                      style={{ marginTop: "8px", display: "none", textAlign: "center" }}
                    >
                      <span className="amp-lbl" style={{ textAlign: "center" }}>
                        Час на тренировка (HH:mm)
                      </span>
                      <div
                        className="amp-edit-input"
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          padding: 0,
                        }}
                      >
                        <TimeInput
                          className="amp-inner-time-input"
                          step={60}
                          value={schedulerForm.trainingTime}
                          onValueChange={(value) => handleTrainingAllTimeChange(value)}
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
                  {trainingDaysEditorMode !== "createGroup" &&
                    (effectiveTrainingDaysActiveStep === "spots" ||
                      effectiveTrainingDaysActiveStep === "field") && (
                      <div className="amp-training-step-summary" style={{ order: 1 }}>
                        <div>
                          <span className="amp-training-step-summary-label">Избрани дни</span>
                          <span className="amp-training-step-summary-value">{trainingDaysSummaryText}</span>
                        </div>
                        <div>
                          <span className="amp-training-step-summary-label">Час и продължителност</span>
                          <span className="amp-training-step-summary-value">
                            {trainingTimeSummaryText} · {trainingDurationSummaryText}
                          </span>
                        </div>
                        {spotsStepSupportedByMode && effectiveTrainingDaysActiveStep === "field" && (
                          <div>
                            <span className="amp-training-step-summary-label">Участие</span>
                            <span className="amp-training-step-summary-value">
                              {schedulerPerDayLimited
                                ? (() => {
                                    const limitedDays = normalizedTrainingDaysSelection.filter(
                                      (d) => schedulerPerDayConfig[d]?.limited,
                                    );
                                    return limitedDays.length === 0
                                      ? "Всички участват"
                                      : `${limitedDays.length} ${limitedDays.length === 1 ? "ден" : "дни"} с ограничени места`;
                                  })()
                                : schedulerLimitedMode && isSchedulerLimitedSpotsValid
                                  ? `Ограничено — ${schedulerLimitedSpotsValue} места`
                                  : "Всички участват"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  <TrainingTimeStep form={trainingDaysForm} />

                  {trainingDaysEditorMode === "teamGroup" &&
                    selectedTeamGroupLinkedTrainingGroups.length > 0 && (
                      <p
                        className="amp-confirm-error"
                        style={{ marginTop: "8px", textAlign: "center", order: 3 }}
                      >
                        {`Внимание: набор ${selectedTeamGroup} участва в сборни отбори (${selectedTeamGroupLinkedTrainingGroups.map((group) => group.name).join(", ")}). При запазване ще бъде премахнат от тях и може да се наложи преименуване на групите.`}
                      </p>
                    )}
                  {trainingDaysEditorMode === "createGroup" && (
                    <>
                      <label className="amp-edit-field" style={{ marginTop: "8px", textAlign: "center" }}>
                        <span className="amp-lbl" style={{ textAlign: "center" }}>
                          Име на група (по избор)
                        </span>
                        <input
                          style={{ textAlign: "center" }}
                          className="amp-edit-input"
                          value={trainingDaysEditorGroupName}
                          onChange={(e) => setTrainingDaysEditorGroupName(e.target.value)}
                          placeholder={
                            trainingDaysEditorGroups.length > 0
                              ? trainingDaysEditorGroups.map((group) => String(group)).join("/")
                              : "2012/2013"
                          }
                          disabled={trainingDaysEditorSaving}
                        />
                      </label>
                      <div
                        className="amp-training-days-editor-header"
                        style={{
                          marginTop: "8px",
                          alignItems: "center",
                          flexDirection: "column",
                          gap: "8px",
                          textAlign: "center",
                        }}
                      >
                        <span className="amp-lbl" style={{ textAlign: "center" }}>
                          Набори за прилагане (може повече от един):
                        </span>
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}
                        >
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
                                  textAlign: "center",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={trainingDaysEditorSaving}
                                  onChange={(e) => {
                                    setTrainingDaysEditorGroups((prev) => {
                                      if (e.target.checked) {
                                        return [...new Set([...prev, value])].sort(
                                          (a, b) => Number(a) - Number(b),
                                        );
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
                  <TrainingDatesStep
                    form={trainingDaysForm}
                    schedulerCalendarMonthsTrimmed={schedulerCalendarMonthsTrimmed}
                    setSchedulerCalendarVisibleMonthIdx={setSchedulerCalendarVisibleMonthIdx}
                    schedulerCalendarVisibleMonthIdx={schedulerCalendarVisibleMonthIdx}
                    todayIsoDate={todayIsoDate}
                  />
                  <TrainingCapacityStep form={trainingDaysForm} />
                  <TrainingVenueStep
                    form={trainingDaysForm}
                    trainingFields={trainingFields}
                    trainingFieldsLoading={trainingFieldsLoading}
                    openTrainingFieldModal={openTrainingFieldModal}
                  />

                  {canShowTrainingDaysFieldStep &&
                    effectiveTrainingDaysActiveStep === "field" &&
                    hasMissingTrainingField && (
                      <p className="amp-confirm-error" style={{ textAlign: "center", order: 4 }}>
                        {missingTrainingFieldMessage}
                      </p>
                    )}
                  <TrainingNotesStep form={trainingDaysForm} />
                  {trainingDaysEditorError && (
                    <p className="amp-confirm-error" style={{ textAlign: "center", order: 4 }}>
                      {trainingDaysEditorError}
                    </p>
                  )}
                  {isTrainingDaysScheduleUnchanged && !trainingDaysEditorError && (
                    <p className="amp-confirm-error" style={{ textAlign: "center", order: 4 }}>
                      Графикът е същият като предишния.
                    </p>
                  )}
                  {(showTrainingStepBack || showTrainingStepNext) && (
                    <div className="amp-training-step-nav" style={{ order: 4 }}>
                      {showTrainingStepBack && (
                        <button
                          type="button"
                          className="amp-btn amp-btn--ghost"
                          onClick={() => {
                            if (effectiveTrainingDaysActiveStep === "notes") {
                              setTrainingDaysActiveStep("field");
                            } else if (effectiveTrainingDaysActiveStep === "field") {
                              setTrainingDaysActiveStep(canShowTrainingDaysSpotsStep ? "spots" : "time");
                            } else if (effectiveTrainingDaysActiveStep === "spots") {
                              setTrainingDaysActiveStep("time");
                            } else {
                              setTrainingDaysActiveStep("days");
                            }
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
                            if (effectiveTrainingDaysActiveStep === "days") {
                              setTrainingDaysActiveStep("time");
                            } else if (effectiveTrainingDaysActiveStep === "time") {
                              setTrainingDaysActiveStep(canShowTrainingDaysSpotsStep ? "spots" : "field");
                            } else if (effectiveTrainingDaysActiveStep === "spots") {
                              setTrainingDaysActiveStep("field");
                            } else {
                              setTrainingDaysActiveStep("notes");
                            }
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
                    {(trainingDaysEditorMode === "createGroup" ||
                      effectiveTrainingDaysActiveStep === "notes") && (
                      <button
                        type="button"
                        className="amp-btn amp-btn--primary"
                        onClick={() =>
                          void (trainingDaysEditorMode === "createGroup"
                            ? saveTrainingDaysForSelectedGroups()
                            : saveTrainingDaysFromTrainingModal())
                        }
                        disabled={
                          trainingDaysEditorSaving ||
                          trainingFieldBulkApplying ||
                          trainingDaysEditorLoading ||
                          (trainingDaysEditorMode !== "createGroup" && isTrainingDaysScheduleUnchanged) ||
                          (trainingDaysEditorMode !== "createGroup" && hasMissingTrainingTime) ||
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
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import type * as React from "react";
import { TRAINING_WEEKDAY_SHORT_BG } from "../_utils/members-page-utils";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type Props = {
  form: Pick<
    TrainingDaysForm,
    | "trainingDaysEditorMode"
    | "effectiveTrainingDaysActiveStep"
    | "schedulerCalendarMonths"
    | "schedulerCalendarDateSet"
    | "schedulerForm"
    | "trainingDaysPreExistingDates"
    | "coachWizardTrainings"
    | "toggleTrainingDate"
    | "trainingDaysEditorSaving"
  >;
  schedulerCalendarMonthsTrimmed: { cells: (string | null)[]; key: string; label: string }[];
  setSchedulerCalendarVisibleMonthIdx: React.Dispatch<React.SetStateAction<number>>;
  schedulerCalendarVisibleMonthIdx: number;
  todayIsoDate: string;
};

export function TrainingDatesStep({
  form,
  schedulerCalendarMonthsTrimmed,
  setSchedulerCalendarVisibleMonthIdx,
  schedulerCalendarVisibleMonthIdx,
  todayIsoDate,
}: Props) {
  const {
    trainingDaysEditorMode,
    effectiveTrainingDaysActiveStep,
    schedulerCalendarMonths,
    schedulerCalendarDateSet,
    schedulerForm,
    trainingDaysPreExistingDates,
    coachWizardTrainings,
    toggleTrainingDate,
    trainingDaysEditorSaving,
  } = form;
  return (
    <>
      {trainingDaysEditorMode !== "createGroup" && effectiveTrainingDaysActiveStep === "days" && (
        <div className="amp-training-calendar" style={{ order: 1 }}>
          {schedulerCalendarMonthsTrimmed.length > 1 && (
            <div className="amp-training-month-nav">
              <button
                type="button"
                className="amp-training-month-nav-btn"
                onClick={() => setSchedulerCalendarVisibleMonthIdx((i) => Math.max(0, i - 1))}
                disabled={schedulerCalendarVisibleMonthIdx === 0}
                aria-label="Предишен месец"
              >
                ‹
              </button>
              <button
                type="button"
                className="amp-training-month-nav-btn"
                onClick={() =>
                  setSchedulerCalendarVisibleMonthIdx((i) =>
                    Math.min(schedulerCalendarMonthsTrimmed.length - 1, i + 1),
                  )
                }
                disabled={schedulerCalendarVisibleMonthIdx === schedulerCalendarMonths.length - 1}
                aria-label="Следващ месец"
              >
                ›
              </button>
            </div>
          )}
          {schedulerCalendarMonthsTrimmed
            .slice(schedulerCalendarVisibleMonthIdx, schedulerCalendarVisibleMonthIdx + 1)
            .map((month) => (
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
                    if (date < todayIsoDate) {
                      return (
                        <span
                          key={date}
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
                    const isPreExisting =
                      trainingDaysEditorMode !== "coachGroup" &&
                      trainingDaysPreExistingDates.includes(date) &&
                      !isSelected;
                    if (isPreExisting) {
                      return (
                        <span
                          key={date}
                          className="amp-training-calendar-cell amp-training-calendar-cell--existing"
                          title="Вече насрочена"
                        >
                          <span className="amp-training-day-number">{dayNumber}</span>
                        </span>
                      );
                    }
                    return (
                      <button
                        key={date}
                        type="button"
                        className={`amp-training-date-btn${isSelected ? " amp-training-date-btn--active" : ""}`}
                        title={
                          trainingDaysEditorMode === "coachGroup"
                            ? `${coachWizardTrainings.filter((t) => t.date === date && t.status === "scheduled").length} насрочени тренировки`
                            : undefined
                        }
                        onClick={() => toggleTrainingDate(date)}
                        disabled={trainingDaysEditorSaving}
                      >
                        <span className="amp-training-day-number">{dayNumber}</span>
                        {trainingDaysEditorMode === "coachGroup" &&
                          coachWizardTrainings.some((t) => t.date === date && t.status === "scheduled") && (
                            <span style={{ fontSize: 10, opacity: 0.75 }}>
                              {
                                coachWizardTrainings.filter(
                                  (t) => t.date === date && t.status === "scheduled",
                                ).length
                              }{" "}
                              тр.
                            </span>
                          )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </>
  );
}

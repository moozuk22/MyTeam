"use client";

import { TimeInput } from "@/components/TimeInput";
import {
  TRAINING_WEEKDAY_LONG_BG,
  formatIsoDateForDisplay,
  getWeekdayMondayFirstIndex,
} from "../_utils/members-page-utils";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type Props = {
  form: Pick<
    TrainingDaysForm,
    | "schedule2TrainingGroup"
    | "trainingDaysEditorMode"
    | "canShowTrainingDaysTimeStep"
    | "effectiveTrainingDaysActiveStep"
    | "trainingTimeMode"
    | "handleTrainingTimeModeChange"
    | "trainingDaysEditorSaving"
    | "schedulerForm"
    | "handleTrainingAllTimeChange"
    | "setSchedulerForm"
    | "normalizedTrainingDaysSelection"
    | "trainingDateTimes"
    | "handleTrainingDateTimeChange"
    | "trainingWeekdayBuckets"
    | "handleTrainingWeekdayTimeChange"
  >;
};

export function TrainingTimeStep({ form }: Props) {
  const {
    schedule2TrainingGroup,
    trainingDaysEditorMode,
    canShowTrainingDaysTimeStep,
    effectiveTrainingDaysActiveStep,
    trainingTimeMode,
    handleTrainingTimeModeChange,
    trainingDaysEditorSaving,
    schedulerForm,
    handleTrainingAllTimeChange,
    setSchedulerForm,
    normalizedTrainingDaysSelection,
    trainingDateTimes,
    handleTrainingDateTimeChange,
    trainingWeekdayBuckets,
    handleTrainingWeekdayTimeChange,
  } = form;
  return (
    <>
      {trainingDaysEditorMode !== "createGroup" &&
        canShowTrainingDaysTimeStep &&
        effectiveTrainingDaysActiveStep === "time" && (
          <div
            className="amp-training-time-panel"
            style={{ marginTop: "8px", textAlign: "center", order: 2 }}
          >
            <span className="amp-lbl" style={{ textAlign: "center" }}>
              Задай час за:
            </span>
            <select
              className="amp-edit-input"
              style={{ textAlign: "center" }}
              value={trainingTimeMode}
              onChange={(e) =>
                void handleTrainingTimeModeChange(e.target.value as "all" | "perDay" | "byWeekday")
              }
              disabled={trainingDaysEditorSaving}
            >
              <option value="all">Всички тренировки</option>
              <option value="perDay">Различни тренировки</option>
              <option value="byWeekday">Всяка седмица</option>
            </select>
          </div>
        )}
      {trainingDaysEditorMode !== "createGroup" &&
        canShowTrainingDaysTimeStep &&
        effectiveTrainingDaysActiveStep === "time" &&
        trainingTimeMode === "all" && (
          <label className="amp-edit-field" style={{ marginTop: "8px", textAlign: "center", order: 2 }}>
            <span className="amp-lbl" style={{ textAlign: "center" }}>
              Час на тренировка
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
      {trainingDaysEditorMode !== "createGroup" &&
        canShowTrainingDaysTimeStep &&
        effectiveTrainingDaysActiveStep === "time" && (
          <label className="amp-edit-field" style={{ marginTop: "8px", textAlign: "center", order: 2 }}>
            <span className="amp-lbl" style={{ textAlign: "center" }}>
              {schedule2TrainingGroup
                ? "Продължителност на тренировките за групата (минути)"
                : "Продължителност на тренировката (минути)"}
            </span>
            <input
              style={{ textAlign: "center" }}
              className="amp-edit-input"
              type="number"
              min={1}
              max={1440}
              step={5}
              value={schedulerForm.trainingDurationMinutes}
              onChange={(e) =>
                setSchedulerForm((prev) => ({ ...prev, trainingDurationMinutes: e.target.value }))
              }
              required
              disabled={trainingDaysEditorSaving}
            />
          </label>
        )}
      {trainingDaysEditorMode !== "createGroup" &&
        canShowTrainingDaysTimeStep &&
        effectiveTrainingDaysActiveStep === "time" &&
        trainingTimeMode === "perDay" && (
          <div className="amp-training-time-list" style={{ marginTop: "8px", order: 2 }}>
            {normalizedTrainingDaysSelection.length === 0 ? (
              <span className="amp-lbl" style={{ opacity: 0.78, textAlign: "center", display: "block" }}>
                {
                  "\u041f\u044a\u0440\u0432\u043e \u0438\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u044a\u0447\u043d\u0438 \u0434\u0430\u0442\u0438."
                }
              </span>
            ) : (
              normalizedTrainingDaysSelection.map((date) => (
                <label
                  key={`per-day-time-${date}`}
                  className="amp-edit-field"
                  style={{ textAlign: "center" }}
                >
                  <span className="amp-lbl" style={{ textAlign: "center" }}>
                    {formatIsoDateForDisplay(date)}
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
                      value={trainingDateTimes[date] ?? ""}
                      onValueChange={(value) => handleTrainingDateTimeChange(date, value)}
                      required
                      disabled={trainingDaysEditorSaving}
                    />
                  </div>
                </label>
              ))
            )}
          </div>
        )}
      {trainingDaysEditorMode !== "createGroup" &&
        canShowTrainingDaysTimeStep &&
        effectiveTrainingDaysActiveStep === "time" &&
        trainingTimeMode === "byWeekday" && (
          <div className="amp-training-time-list" style={{ marginTop: "8px", order: 2 }}>
            {trainingWeekdayBuckets.length === 0 ? (
              <span className="amp-lbl" style={{ opacity: 0.78, textAlign: "center", display: "block" }}>
                {
                  "\u041f\u044a\u0440\u0432\u043e \u0438\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u044a\u0447\u043d\u0438 \u0434\u0430\u0442\u0438."
                }
              </span>
            ) : (
              trainingWeekdayBuckets.map((weekdayIndex) => {
                const weekdayDate = normalizedTrainingDaysSelection.find(
                  (date) => getWeekdayMondayFirstIndex(date) === weekdayIndex,
                );
                const weekdayTime =
                  (weekdayDate ? trainingDateTimes[weekdayDate] : "") ?? schedulerForm.trainingTime;
                return (
                  <label
                    key={`weekday-time-${weekdayIndex}`}
                    className="amp-edit-field"
                    style={{ textAlign: "center" }}
                  >
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      {TRAINING_WEEKDAY_LONG_BG[weekdayIndex] ?? `#${weekdayIndex + 1}`}
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
                        value={weekdayTime ?? ""}
                        onValueChange={(value) => handleTrainingWeekdayTimeChange(weekdayIndex, value)}
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
    </>
  );
}

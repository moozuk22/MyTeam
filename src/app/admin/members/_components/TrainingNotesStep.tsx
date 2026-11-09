"use client";

import { formatIsoDateForDisplay } from "../_utils/members-page-utils";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type Props = {
  form: Pick<
    TrainingDaysForm,
    | "trainingDaysEditorMode"
    | "canShowTrainingDaysNotesStep"
    | "effectiveTrainingDaysActiveStep"
    | "normalizedTrainingDaysSelection"
    | "trainingDayScheduleNotes"
    | "setTrainingDayScheduleNotes"
    | "trainingDaysEditorSaving"
  >;
};

export function TrainingNotesStep({ form }: Props) {
  const {
    trainingDaysEditorMode,
    canShowTrainingDaysNotesStep,
    effectiveTrainingDaysActiveStep,
    normalizedTrainingDaysSelection,
    trainingDayScheduleNotes,
    setTrainingDayScheduleNotes,
    trainingDaysEditorSaving,
  } = form;
  return (
    <>
      {trainingDaysEditorMode !== "createGroup" &&
        canShowTrainingDaysNotesStep &&
        effectiveTrainingDaysActiveStep === "notes" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "8px",
              order: 3,
            }}
          >
            <p style={{ margin: 0, textAlign: "center", opacity: 0.65, fontSize: "0.85em" }}>
              Описанието е по избор. Можете да зададете различен текст за всяка тренировка.
            </p>
            {normalizedTrainingDaysSelection.map((date) => (
              <label key={`note-${date}`} className="amp-edit-field" style={{ textAlign: "center" }}>
                <span className="amp-lbl" style={{ textAlign: "center" }}>
                  {formatIsoDateForDisplay(date)}
                </span>
                <textarea
                  className="amp-edit-input amp-training-note"
                  value={trainingDayScheduleNotes[date] ?? ""}
                  onChange={(e) =>
                    setTrainingDayScheduleNotes((prev) => ({ ...prev, [date]: e.target.value }))
                  }
                  rows={2}
                  maxLength={1000}
                  placeholder="Инструкции, сборен час, локация..."
                  disabled={trainingDaysEditorSaving}
                />
              </label>
            ))}
          </div>
        )}
    </>
  );
}

"use client";

import { XIcon } from "./members-page-icons";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type TrainingScheduleSuccessDialogProps = {
  trainingDaysForm: Pick<
    TrainingDaysForm,
    "trainingDaysSuccessOpen" | "setTrainingDaysSuccessOpen" | "trainingDaysSuccessMessage"
  >;
};

export function TrainingScheduleSuccessDialog({ trainingDaysForm }: TrainingScheduleSuccessDialogProps) {
  const { trainingDaysSuccessOpen, setTrainingDaysSuccessOpen, trainingDaysSuccessMessage } =
    trainingDaysForm;
  return (
    <>
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
                <button
                  className="amp-btn amp-btn--primary"
                  onClick={() => setTrainingDaysSuccessOpen(false)}
                >
                  Добре
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

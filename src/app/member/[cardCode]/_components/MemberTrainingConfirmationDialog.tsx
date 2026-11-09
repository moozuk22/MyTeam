"use client";

import {
  type TrainingDayStatus,
  type TrainingOptOutReasonCode,
} from "../_types/member-types";

type Props = {
  trainingConfirmModalOpen: boolean;
  trainingConfirmAction: "attend" | "optOut" | null;
  trainingDetailsItem: TrainingDayStatus | null;
  setTrainingConfirmModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTrainingConfirmAction: React.Dispatch<
    React.SetStateAction<"attend" | "optOut" | null>
  >;
  setTrainingOptOutReasonCode: React.Dispatch<
    React.SetStateAction<"" | TrainingOptOutReasonCode>
  >;
  setTrainingOptOutReasonText: React.Dispatch<React.SetStateAction<string>>;
  trainingOptOutReasonCode: "" | TrainingOptOutReasonCode;
  trainingOptOutReasonText: string;
  trainingSavingDate: string | null;
  setTrainingError: React.Dispatch<React.SetStateAction<string | null>>;
  handleTrainingAttendanceConfirm: (
    action: "attend" | "optOut",
    item: TrainingDayStatus,
    reason?: {
      reasonCode: TrainingOptOutReasonCode;
      reasonText: string | null;
    },
  ) => Promise<void>;
  isOptOutReasonReady: boolean;
};

export function MemberTrainingConfirmationDialog({
  trainingConfirmModalOpen,
  trainingConfirmAction,
  trainingDetailsItem,
  setTrainingConfirmModalOpen,
  setTrainingConfirmAction,
  setTrainingOptOutReasonCode,
  setTrainingOptOutReasonText,
  trainingOptOutReasonCode,
  trainingOptOutReasonText,
  trainingSavingDate,
  setTrainingError,
  handleTrainingAttendanceConfirm,
  isOptOutReasonReady,
}: Props) {
  return (
    <>
      {trainingConfirmModalOpen &&
        trainingConfirmAction &&
        trainingDetailsItem && (
          <div
            className="pm-overlay"
            onClick={(e) => {
              e.stopPropagation();
              setTrainingConfirmModalOpen(false);
              setTrainingConfirmAction(null);
              setTrainingOptOutReasonCode("");
              setTrainingOptOutReasonText("");
            }}
          >
            <div
              className="pm-modal member-training-confirm-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pm-header">
                <h2 className="pm-title">Потвърждение</h2>
              </div>
              <div className="pm-divider" />
              <p className="training-confirm-text">
                {trainingConfirmAction === "attend"
                  ? `Сигурни ли сте, че искате да потвърдите присъствие за ${new Date(`${trainingDetailsItem.date}T12:00:00.000Z`).toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" })}?`
                  : `Сигурни ли сте, че искате да откажете присъствие за ${new Date(`${trainingDetailsItem.date}T12:00:00.000Z`).toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" })}?`}
              </p>
              {trainingConfirmAction === "optOut" && (
                <div className="training-confirm-reason-fields">
                  <label className="training-confirm-reason-label">
                    <span className="pm-info-lbl">Причина (задължително)</span>
                    <select
                      className="training-confirm-reason-control"
                      value={trainingOptOutReasonCode}
                      onChange={(event) => {
                        const nextReason = event.target.value as
                          TrainingOptOutReasonCode | "";
                        setTrainingOptOutReasonCode(nextReason);
                        if (nextReason !== "other") {
                          setTrainingOptOutReasonText("");
                        }
                      }}
                    >
                      <option value="">Избери причина</option>
                      <option value="injury">Контузия</option>
                      <option value="sick">Болен</option>
                      <option value="other">Друго</option>
                    </select>
                  </label>
                  {trainingOptOutReasonCode === "other" && (
                    <label className="training-confirm-reason-label">
                      <span className="pm-info-lbl">
                        Опиши причината (задължително)
                      </span>
                      <textarea
                        className="training-confirm-reason-control training-confirm-reason-textarea"
                        value={trainingOptOutReasonText}
                        onChange={(event) =>
                          setTrainingOptOutReasonText(event.target.value)
                        }
                        maxLength={200}
                        rows={3}
                        placeholder="Въведи причина..."
                      />
                    </label>
                  )}
                </div>
              )}
              <div className="pm-actions training-confirm-actions">
                <button
                  className="pm-btn pm-btn--cancel"
                  type="button"
                  onClick={() => {
                    setTrainingConfirmModalOpen(false);
                    setTrainingConfirmAction(null);
                    setTrainingOptOutReasonCode("");
                    setTrainingOptOutReasonText("");
                  }}
                  disabled={trainingSavingDate === trainingDetailsItem.date}
                >
                  Отказ
                </button>
                <button
                  className="pm-btn pm-btn--submit"
                  type="button"
                  onClick={async () => {
                    if (!trainingConfirmAction || !trainingDetailsItem) return;
                    if (trainingConfirmAction === "optOut") {
                      if (!trainingOptOutReasonCode) {
                        setTrainingError("Избери причина за отсъствие.");
                        return;
                      }
                      if (
                        trainingOptOutReasonCode === "other" &&
                        trainingOptOutReasonText.trim().length === 0
                      ) {
                        setTrainingError("Въведи причина в полето Друго.");
                        return;
                      }
                    }
                    setTrainingConfirmModalOpen(false);
                    await handleTrainingAttendanceConfirm(
                      trainingConfirmAction,
                      trainingDetailsItem,
                      trainingConfirmAction === "optOut" &&
                        trainingOptOutReasonCode
                        ? {
                            reasonCode: trainingOptOutReasonCode,
                            reasonText:
                              trainingOptOutReasonCode === "other"
                                ? trainingOptOutReasonText.trim()
                                : null,
                          }
                        : undefined,
                    );
                    setTrainingConfirmAction(null);
                    setTrainingOptOutReasonCode("");
                    setTrainingOptOutReasonText("");
                  }}
                  disabled={
                    trainingSavingDate === trainingDetailsItem.date ||
                    !isOptOutReasonReady
                  }
                >
                  {trainingSavingDate === trainingDetailsItem.date
                    ? "Запазване..."
                    : "Потвърди"}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

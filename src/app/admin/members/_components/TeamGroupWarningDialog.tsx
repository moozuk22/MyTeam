"use client";

import { XIcon } from "./members-page-icons";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type TeamGroupWarningDialogProps = {
  trainingDaysForm: Pick<TrainingDaysForm, "trainingDaysEditorSaving">;
  teamGroupWarningModalOpen: boolean;
  handleTeamGroupWarningCancel: () => void;
  selectedTeamGroup: number | null;
  pendingTeamGroupWarningGroups: { id: string; name: string }[];
  handleTeamGroupWarningConfirm: () => Promise<void>;
};

export function TeamGroupWarningDialog({
  trainingDaysForm,
  teamGroupWarningModalOpen,
  handleTeamGroupWarningCancel,
  selectedTeamGroup,
  pendingTeamGroupWarningGroups,
  handleTeamGroupWarningConfirm,
}: TeamGroupWarningDialogProps) {
  const { trainingDaysEditorSaving } = trainingDaysForm;
  return (
    <>
      {teamGroupWarningModalOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          style={{ zIndex: 20000 }}
          onClick={handleTeamGroupWarningCancel}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Внимание</span>
              <button
                className="amp-modal-close"
                onClick={handleTeamGroupWarningCancel}
                aria-label="Затвори"
                disabled={trainingDaysEditorSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <p
                className="amp-lbl"
                style={{ whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                {`Набор ${selectedTeamGroup} е в сборни отбори: ${pendingTeamGroupWarningGroups.map((group) => group.name).join(", ")}. Продължаването ще го премахне от тези групи и може да се наложи да промените имената им.`}
              </p>
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={handleTeamGroupWarningCancel}
                  disabled={trainingDaysEditorSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void handleTeamGroupWarningConfirm()}
                  disabled={trainingDaysEditorSaving}
                >
                  Продължи
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

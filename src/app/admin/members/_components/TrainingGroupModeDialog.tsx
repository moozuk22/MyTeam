"use client";

import { XIcon } from "./members-page-icons";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";

type TrainingGroupModeDialogProps = {
  trainingGroups: Pick<
    TrainingGroups,
    | "trainingGroupModeSettingsOpen"
    | "trainingGroupModeSaving"
    | "setTrainingGroupModeSettingsOpen"
    | "setTrainingGroupModeError"
    | "trainingGroupModeDraft"
    | "setTrainingGroupModeDraft"
    | "trainingGroupModeError"
    | "trainingGroupMode"
    | "saveTrainingGroupMode"
  >;
  isAdmin: boolean;
  clubPlayerFields: string[];
  clubId: string;
};

export function TrainingGroupModeDialog({
  trainingGroups,
  isAdmin,
  clubPlayerFields,
  clubId,
}: TrainingGroupModeDialogProps) {
  const {
    trainingGroupModeSettingsOpen,
    trainingGroupModeSaving,
    setTrainingGroupModeSettingsOpen,
    setTrainingGroupModeError,
    trainingGroupModeDraft,
    setTrainingGroupModeDraft,
    trainingGroupModeError,
    trainingGroupMode,
    saveTrainingGroupMode,
  } = trainingGroups;
  return (
    <>
      {trainingGroupModeSettingsOpen && isAdmin && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!trainingGroupModeSaving) {
              setTrainingGroupModeSettingsOpen(false);
              setTrainingGroupModeError("");
            }
          }}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Настройки на групите</span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setTrainingGroupModeSettingsOpen(false);
                  setTrainingGroupModeError("");
                }}
                aria-label="Затвори"
                disabled={trainingGroupModeSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <div className="amp-training-view-switch" style={{ marginBottom: "14px" }}>
                <button
                  type="button"
                  className={`amp-btn amp-btn--ghost amp-training-view-btn${trainingGroupModeDraft === "team_group" ? " is-active" : ""}`}
                  onClick={() => setTrainingGroupModeDraft("team_group")}
                  disabled={trainingGroupModeSaving || !clubPlayerFields.includes("teamGroup")}
                >
                  По набори
                </button>
                <button
                  type="button"
                  className={`amp-btn amp-btn--ghost amp-training-view-btn${trainingGroupModeDraft === "custom_group" ? " is-active" : ""}`}
                  onClick={() => setTrainingGroupModeDraft("custom_group")}
                  disabled={trainingGroupModeSaving}
                >
                  По избрани групи
                </button>
              </div>
              <p className="amp-group-settings-description">
                Избраният начин ще определи как треньорите виждат групите и създават тренировъчни графици.
              </p>
              {!clubPlayerFields.includes("teamGroup") && (
                <aside className="amp-group-settings-notice" role="note">
                  <svg
                    className="amp-group-settings-notice-icon"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v6M12 7h.01" />
                  </svg>
                  <p>
                    За графици по набори включете полето <strong>„Набор“</strong> от{" "}
                    <a href={`/admin/teams/${clubId}/edit`}>редакцията на клуба</a>.
                  </p>
                </aside>
              )}
              {trainingGroupModeError && <p className="amp-confirm-error">{trainingGroupModeError}</p>}
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => {
                    setTrainingGroupModeSettingsOpen(false);
                    setTrainingGroupModeDraft(trainingGroupMode);
                    setTrainingGroupModeError("");
                  }}
                  disabled={trainingGroupModeSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveTrainingGroupMode(trainingGroupModeDraft)}
                  disabled={trainingGroupModeSaving}
                >
                  {trainingGroupModeSaving ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

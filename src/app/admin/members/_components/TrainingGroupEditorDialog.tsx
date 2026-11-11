"use client";

import { XIcon } from "./members-page-icons";
import { type Member } from "../_types/members-page-types";
import { CustomTrainingGroupColorPicker } from "./CustomTrainingGroupColorPicker";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";

type TrainingGroupEditorDialogProps = {
  trainingGroups: Pick<
    TrainingGroups,
    | "trainingGroupEditOpen"
    | "trainingGroupEditSaving"
    | "setTrainingGroupEditOpen"
    | "setTrainingGroupEditError"
    | "isCustomTrainingGroupMode"
    | "trainingGroupEditName"
    | "setTrainingGroupEditName"
    | "trainingGroupEditColor"
    | "setTrainingGroupEditColor"
    | "customTrainingGroupColors"
    | "trainingGroupEditId"
    | "trainingGroupEditPlayerIds"
    | "setTrainingGroupEditPlayerIds"
    | "customGroupEditSearch"
    | "setCustomGroupEditSearch"
    | "trainingGroupEditGroups"
    | "setTrainingGroupEditGroups"
    | "trainingGroupEditError"
    | "saveTrainingGroupEditFromModal"
  >;
  availablePlayersForCustomGroupEdit: Member[];
  filteredPlayersForCustomGroupEdit: Member[];
  groupOptions: number[];
};

export function TrainingGroupEditorDialog({
  trainingGroups,
  availablePlayersForCustomGroupEdit,
  filteredPlayersForCustomGroupEdit,
  groupOptions,
}: TrainingGroupEditorDialogProps) {
  const {
    trainingGroupEditOpen,
    trainingGroupEditSaving,
    setTrainingGroupEditOpen,
    setTrainingGroupEditError,
    isCustomTrainingGroupMode,
    trainingGroupEditName,
    setTrainingGroupEditName,
    trainingGroupEditColor,
    setTrainingGroupEditColor,
    customTrainingGroupColors,
    trainingGroupEditId,
    trainingGroupEditPlayerIds,
    setTrainingGroupEditPlayerIds,
    customGroupEditSearch,
    setCustomGroupEditSearch,
    trainingGroupEditGroups,
    setTrainingGroupEditGroups,
    trainingGroupEditError,
    saveTrainingGroupEditFromModal,
  } = trainingGroups;
  return (
    <>
      {trainingGroupEditOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          style={{ zIndex: 20000 }}
          onClick={() => {
            if (!trainingGroupEditSaving) {
              setTrainingGroupEditOpen(false);
              setTrainingGroupEditError("");
            }
          }}
        >
          <div
            className="amp-modal amp-modal--confirm amp-modal--training-days-editor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">
                {isCustomTrainingGroupMode ? "Редакция на група" : "Редакция на сборен отбор"}
              </span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setTrainingGroupEditOpen(false);
                  setTrainingGroupEditError("");
                }}
                aria-label="Затвори"
                disabled={trainingGroupEditSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {isCustomTrainingGroupMode && (
                <>
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Име на групата</span>
                    <input
                      className="amp-edit-input"
                      value={trainingGroupEditName}
                      onChange={(e) => setTrainingGroupEditName(e.target.value)}
                      disabled={trainingGroupEditSaving}
                    />
                  </label>
                  <CustomTrainingGroupColorPicker
                    value={trainingGroupEditColor}
                    onChange={setTrainingGroupEditColor}
                    disabled={trainingGroupEditSaving}
                    groups={customTrainingGroupColors}
                    excludeGroupId={trainingGroupEditId}
                  />
                  <div
                    className="amp-training-days-editor-header amp-training-days-editor-header--stack"
                    style={{ marginTop: "10px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginBottom: "4px",
                      }}
                    >
                      <span className="amp-lbl" style={{ margin: 0 }}>
                        Състезателите в групата
                      </span>
                      {availablePlayersForCustomGroupEdit.length > 0 ? (
                        <button
                          type="button"
                          className="amp-btn amp-btn--ghost amp-btn--compact"
                          disabled={trainingGroupEditSaving}
                          onClick={() => {
                            const ids = availablePlayersForCustomGroupEdit.map((m) => m.id);
                            const allSelected =
                              ids.length > 0 && ids.every((id) => trainingGroupEditPlayerIds.includes(id));
                            if (allSelected) {
                              setTrainingGroupEditPlayerIds((prev) => prev.filter((id) => !ids.includes(id)));
                            } else {
                              setTrainingGroupEditPlayerIds((prev) => [...new Set([...prev, ...ids])]);
                            }
                          }}
                        >
                          {availablePlayersForCustomGroupEdit.every((m) =>
                            trainingGroupEditPlayerIds.includes(m.id),
                          )
                            ? "Премахни всички"
                            : "Избери всички"}
                        </button>
                      ) : null}
                    </div>
                    <input
                      className="amp-edit-input"
                      type="search"
                      placeholder="Търси състезател..."
                      value={customGroupEditSearch}
                      onChange={(e) => setCustomGroupEditSearch(e.target.value)}
                      disabled={trainingGroupEditSaving}
                      style={{ marginBottom: "8px" }}
                    />
                    <div className="amp-group-check-grid">
                      {filteredPlayersForCustomGroupEdit.map((member) => {
                        const isChecked = trainingGroupEditPlayerIds.includes(member.id);
                        return (
                          <label
                            key={`custom-training-group-edit-${member.id}`}
                            className={`amp-group-check-chip${isChecked ? " is-selected" : ""}${trainingGroupEditSaving ? " is-disabled" : ""}`}
                          >
                            <input
                              className="amp-group-check-input"
                              type="checkbox"
                              checked={isChecked}
                              disabled={trainingGroupEditSaving}
                              onChange={(e) => {
                                setTrainingGroupEditPlayerIds((prev) =>
                                  e.target.checked
                                    ? [...new Set([...prev, member.id])]
                                    : prev.filter((item) => item !== member.id),
                                );
                              }}
                            />
                            <span className="amp-group-check-box" aria-hidden="true" />
                            <span className="amp-lbl amp-group-check-label">{member.fullName}</span>
                          </label>
                        );
                      })}
                    </div>
                    {availablePlayersForCustomGroupEdit.length === 0 && (
                      <p className="amp-empty amp-empty--modal">Няма свободни състезатели за добавяне.</p>
                    )}
                    {availablePlayersForCustomGroupEdit.length > 0 &&
                      filteredPlayersForCustomGroupEdit.length === 0 && (
                        <p className="amp-empty amp-empty--modal">
                          Няма състезатели, отговарящи на търсенето.
                        </p>
                      )}
                  </div>
                </>
              )}
              {!isCustomTrainingGroupMode && (
                <>
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Име на група</span>
                    <input
                      className="amp-edit-input"
                      value={trainingGroupEditName}
                      placeholder={
                        trainingGroupEditGroups.length > 0 ? trainingGroupEditGroups.join("/") : "2012/2013"
                      }
                      onChange={(e) => setTrainingGroupEditName(e.target.value)}
                      disabled={trainingGroupEditSaving}
                    />
                  </label>
                  <div
                    className="amp-training-days-editor-header amp-training-days-editor-header--stack"
                    style={{ marginTop: "10px" }}
                  >
                    <span className="amp-lbl">Набори за групата (минимум 2):</span>
                    <div className="amp-group-check-grid">
                      {groupOptions.map((group) => {
                        const value = String(group);
                        const isChecked = trainingGroupEditGroups.includes(value);
                        return (
                          <label
                            key={`training-group-edit-${group}`}
                            className={`amp-group-check-chip${isChecked ? " is-selected" : ""}${trainingGroupEditSaving ? " is-disabled" : ""}`}
                          >
                            <input
                              className="amp-group-check-input"
                              type="checkbox"
                              checked={isChecked}
                              disabled={trainingGroupEditSaving}
                              onChange={(e) => {
                                setTrainingGroupEditGroups((prev) => {
                                  if (e.target.checked) {
                                    return [...new Set([...prev, value])].sort(
                                      (a, b) => Number(a) - Number(b),
                                    );
                                  }
                                  return prev.filter((item) => item !== value);
                                });
                              }}
                            />
                            <span className="amp-group-check-box" aria-hidden="true" />
                            <span className="amp-lbl amp-group-check-label">Набор {group}</span>
                          </label>
                        );
                      })}
                    </div>
                    <span className="amp-lbl amp-group-check-hint">
                      {trainingGroupEditGroups.length === 0
                        ? "Изберете поне 2 набора."
                        : `Избрани набори: ${trainingGroupEditGroups.join(", ")}`}
                    </span>
                  </div>
                </>
              )}
              {trainingGroupEditError && <p className="amp-confirm-error">{trainingGroupEditError}</p>}
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => {
                    setTrainingGroupEditOpen(false);
                    setTrainingGroupEditError("");
                  }}
                  disabled={trainingGroupEditSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveTrainingGroupEditFromModal()}
                  disabled={trainingGroupEditSaving}
                >
                  {trainingGroupEditSaving ? "Запазване..." : "Запази промените"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

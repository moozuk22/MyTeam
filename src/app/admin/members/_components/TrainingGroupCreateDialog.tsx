"use client";

import { XIcon } from "./members-page-icons";
import { type Member } from "../_types/members-page-types";
import { CustomTrainingGroupColorPicker } from "./CustomTrainingGroupColorPicker";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";

type TrainingGroupCreateDialogProps = {
  trainingGroups: Pick<
    TrainingGroups,
    | "trainingGroupCreateOpen"
    | "trainingGroupCreateSaving"
    | "setTrainingGroupCreateOpen"
    | "setTrainingGroupCreateError"
    | "setTrainingGroupCreateStep"
    | "trainingGroupCreateStep"
    | "isCustomTrainingGroupMode"
    | "noFreeCustomTrainingGroupColor"
    | "customTrainingGroups"
    | "trainingScheduleGroups"
    | "trainingGroupEditPickId"
    | "setTrainingGroupEditPickId"
    | "setSelectedTrainingGroupId"
    | "setTrainingGroupDeleteConfirmOpen"
    | "openTrainingGroupEditModal"
    | "trainingGroupCreateName"
    | "setTrainingGroupCreateName"
    | "trainingGroupCreateColor"
    | "setTrainingGroupCreateColor"
    | "customTrainingGroupColors"
    | "trainingGroupCreatePlayerIds"
    | "setTrainingGroupCreatePlayerIds"
    | "customGroupCreateSearch"
    | "setCustomGroupCreateSearch"
    | "trainingGroupCreateGroups"
    | "setTrainingGroupCreateGroups"
    | "trainingGroupCreateError"
    | "saveTrainingGroupFromModal"
  >;
  availablePlayersForCustomGroupCreate: Member[];
  filteredPlayersForCustomGroupCreate: Member[];
  groupOptions: number[];
};

export function TrainingGroupCreateDialog({
  trainingGroups,
  availablePlayersForCustomGroupCreate,
  filteredPlayersForCustomGroupCreate,
  groupOptions,
}: TrainingGroupCreateDialogProps) {
  const {
    trainingGroupCreateOpen,
    trainingGroupCreateSaving,
    setTrainingGroupCreateOpen,
    setTrainingGroupCreateError,
    setTrainingGroupCreateStep,
    trainingGroupCreateStep,
    isCustomTrainingGroupMode,
    noFreeCustomTrainingGroupColor,
    customTrainingGroups,
    trainingScheduleGroups,
    trainingGroupEditPickId,
    setTrainingGroupEditPickId,
    setSelectedTrainingGroupId,
    setTrainingGroupDeleteConfirmOpen,
    openTrainingGroupEditModal,
    trainingGroupCreateName,
    setTrainingGroupCreateName,
    trainingGroupCreateColor,
    setTrainingGroupCreateColor,
    customTrainingGroupColors,
    trainingGroupCreatePlayerIds,
    setTrainingGroupCreatePlayerIds,
    customGroupCreateSearch,
    setCustomGroupCreateSearch,
    trainingGroupCreateGroups,
    setTrainingGroupCreateGroups,
    trainingGroupCreateError,
    saveTrainingGroupFromModal,
  } = trainingGroups;
  return (
    <>
      {trainingGroupCreateOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!trainingGroupCreateSaving) {
              setTrainingGroupCreateOpen(false);
              setTrainingGroupCreateError("");
              setTrainingGroupCreateStep("picker");
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
                {trainingGroupCreateStep === "create"
                  ? isCustomTrainingGroupMode
                    ? "Нова група"
                    : "Нов сборен отбор"
                  : trainingGroupCreateStep === "edit-pick"
                    ? isCustomTrainingGroupMode
                      ? "Редактирай група"
                      : "Редактирай сборен отбор"
                    : isCustomTrainingGroupMode
                      ? "Създай / редактирай група"
                      : "Управление на сборни отбори"}
              </span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setTrainingGroupCreateOpen(false);
                  setTrainingGroupCreateError("");
                  setTrainingGroupCreateStep("picker");
                }}
                aria-label="Затвори"
                disabled={trainingGroupCreateSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {trainingGroupCreateStep === "picker" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button
                    type="button"
                    className="amp-btn amp-btn--primary"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      padding: "14px 20px",
                      fontSize: "15px",
                    }}
                    disabled={isCustomTrainingGroupMode && noFreeCustomTrainingGroupColor}
                    onClick={() => setTrainingGroupCreateStep("create")}
                  >
                    Създай група
                  </button>
                  <button
                    type="button"
                    className="amp-btn amp-btn--ghost"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      padding: "14px 20px",
                      fontSize: "15px",
                    }}
                    disabled={
                      isCustomTrainingGroupMode
                        ? customTrainingGroups.length === 0
                        : trainingScheduleGroups.length === 0
                    }
                    onClick={() => setTrainingGroupCreateStep("edit-pick")}
                  >
                    Редактирай група
                  </button>
                </div>
              )}
              {trainingGroupCreateStep === "edit-pick" && (
                <>
                  <label className="amp-edit-field" style={{ marginBottom: "16px" }}>
                    <span className="amp-lbl">Избери група</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {isCustomTrainingGroupMode &&
                        (() => {
                          const color = customTrainingGroups.find(
                            (g) => g.id === trainingGroupEditPickId,
                          )?.color;
                          return color ? (
                            <span
                              className="amp-custom-group-select-swatch"
                              style={{ backgroundColor: color }}
                              aria-hidden
                            />
                          ) : null;
                        })()}
                      <select
                        className="amp-edit-input"
                        style={{ flex: 1, textAlign: "center", textAlignLast: "center" }}
                        value={trainingGroupEditPickId}
                        onChange={(e) => setTrainingGroupEditPickId(e.target.value)}
                      >
                        {isCustomTrainingGroupMode
                          ? customTrainingGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))
                          : trainingScheduleGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                      </select>
                    </div>
                  </label>
                  <div className="amp-modal-actions" style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="amp-btn amp-btn--ghost"
                        onClick={() => setTrainingGroupCreateStep("picker")}
                      >
                        Назад
                      </button>
                      <button
                        type="button"
                        className="amp-btn amp-btn--danger"
                        disabled={!trainingGroupEditPickId}
                        onClick={() => {
                          setSelectedTrainingGroupId(trainingGroupEditPickId);
                          setTrainingGroupCreateOpen(false);
                          setTrainingGroupCreateError("");
                          setTrainingGroupCreateStep("picker");
                          setTrainingGroupDeleteConfirmOpen(true);
                        }}
                      >
                        Изтрий
                      </button>
                    </div>
                    <button
                      type="button"
                      className="amp-btn amp-btn--primary"
                      disabled={!trainingGroupEditPickId}
                      onClick={() => {
                        setTrainingGroupCreateOpen(false);
                        setTrainingGroupCreateError("");
                        setTrainingGroupCreateStep("picker");
                        openTrainingGroupEditModal(trainingGroupEditPickId);
                      }}
                    >
                      Редактирай
                    </button>
                  </div>
                </>
              )}
              {trainingGroupCreateStep === "create" && (
                <>
                  {isCustomTrainingGroupMode && (
                    <>
                      <label className="amp-edit-field">
                        <span className="amp-lbl">Име на групата</span>
                        <input
                          className="amp-edit-input"
                          value={trainingGroupCreateName}
                          onChange={(e) => setTrainingGroupCreateName(e.target.value)}
                          placeholder="Например: Сутрешна група"
                          disabled={trainingGroupCreateSaving}
                        />
                      </label>
                      <CustomTrainingGroupColorPicker
                        value={trainingGroupCreateColor}
                        onChange={setTrainingGroupCreateColor}
                        disabled={trainingGroupCreateSaving || noFreeCustomTrainingGroupColor}
                        groups={customTrainingGroupColors}
                      />
                      {noFreeCustomTrainingGroupColor && (
                        <p className="amp-empty amp-empty--modal" style={{ marginTop: 8 }}>
                          Всички цветове са заети за този клуб.
                        </p>
                      )}
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
                          {availablePlayersForCustomGroupCreate.length > 0 ? (
                            <button
                              type="button"
                              className="amp-btn amp-btn--ghost amp-btn--compact"
                              disabled={trainingGroupCreateSaving}
                              onClick={() => {
                                const ids = availablePlayersForCustomGroupCreate.map((m) => m.id);
                                const allSelected =
                                  ids.length > 0 &&
                                  ids.every((id) => trainingGroupCreatePlayerIds.includes(id));
                                if (allSelected) {
                                  setTrainingGroupCreatePlayerIds((prev) =>
                                    prev.filter((id) => !ids.includes(id)),
                                  );
                                } else {
                                  setTrainingGroupCreatePlayerIds((prev) => [...new Set([...prev, ...ids])]);
                                }
                              }}
                            >
                              {availablePlayersForCustomGroupCreate.every((m) =>
                                trainingGroupCreatePlayerIds.includes(m.id),
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
                          value={customGroupCreateSearch}
                          onChange={(e) => setCustomGroupCreateSearch(e.target.value)}
                          disabled={trainingGroupCreateSaving}
                          style={{ marginBottom: "8px" }}
                        />
                        <div className="amp-group-check-grid">
                          {filteredPlayersForCustomGroupCreate.map((member) => {
                            const isChecked = trainingGroupCreatePlayerIds.includes(member.id);
                            return (
                              <label
                                key={`custom-training-group-create-${member.id}`}
                                className={`amp-group-check-chip${isChecked ? " is-selected" : ""}${trainingGroupCreateSaving ? " is-disabled" : ""}`}
                              >
                                <input
                                  className="amp-group-check-input"
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={trainingGroupCreateSaving}
                                  onChange={(e) => {
                                    setTrainingGroupCreatePlayerIds((prev) =>
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
                        {availablePlayersForCustomGroupCreate.length === 0 && (
                          <p className="amp-empty amp-empty--modal">Няма свободни състезатели за добавяне.</p>
                        )}
                        {availablePlayersForCustomGroupCreate.length > 0 &&
                          filteredPlayersForCustomGroupCreate.length === 0 && (
                            <p className="amp-empty amp-empty--modal">
                              Няма състезатели, отговарящи на търсенето.
                            </p>
                          )}
                      </div>
                    </>
                  )}
                  {!isCustomTrainingGroupMode && (
                    <div className="amp-training-days-editor-header amp-training-days-editor-header--stack">
                      <span className="amp-lbl">Набори за групата (минимум 2):</span>
                      <div className="amp-group-check-grid">
                        {groupOptions.map((group) => {
                          const value = String(group);
                          const isChecked = trainingGroupCreateGroups.includes(value);
                          return (
                            <label
                              key={`training-group-create-${group}`}
                              className={`amp-group-check-chip${isChecked ? " is-selected" : ""}${trainingGroupCreateSaving ? " is-disabled" : ""}`}
                            >
                              <input
                                className="amp-group-check-input"
                                type="checkbox"
                                checked={isChecked}
                                disabled={trainingGroupCreateSaving}
                                onChange={(e) => {
                                  setTrainingGroupCreateGroups((prev) => {
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
                        {trainingGroupCreateGroups.length === 0
                          ? "Изберете поне 2 набора."
                          : `Избрани набори: ${trainingGroupCreateGroups.join(", ")} — Името ще бъде: ${trainingGroupCreateGroups.join("/")}`}
                      </span>
                    </div>
                  )}
                  {trainingGroupCreateError && (
                    <p className="amp-confirm-error">{trainingGroupCreateError}</p>
                  )}
                  <div className="amp-modal-actions" style={{ justifyContent: "space-between" }}>
                    <button
                      type="button"
                      className="amp-btn amp-btn--ghost"
                      onClick={() => {
                        setTrainingGroupCreateStep("picker");
                        setTrainingGroupCreateError("");
                      }}
                      disabled={trainingGroupCreateSaving}
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      className="amp-btn amp-btn--primary"
                      onClick={() => void saveTrainingGroupFromModal()}
                      disabled={
                        trainingGroupCreateSaving ||
                        (isCustomTrainingGroupMode && noFreeCustomTrainingGroupColor)
                      }
                    >
                      {trainingGroupCreateSaving
                        ? "Създаване..."
                        : isCustomTrainingGroupMode
                          ? "Създай група"
                          : "Създай сборен отбор"}
                    </button>
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

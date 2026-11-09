"use client";

import { toggleTrainingFieldPiece } from "@/lib/trainingFieldPicker";
import { formatIsoDateForDisplay } from "../_utils/members-page-utils";
import { type TrainingField } from "../_types/members-page-types";
import { getFieldBackground, renderFieldMarkings } from "./TrainingFieldPreview";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type Props = {
  form: Pick<
    TrainingDaysForm,
    | "trainingDaysEditorMode"
    | "canShowTrainingDaysFieldStep"
    | "effectiveTrainingDaysActiveStep"
    | "fieldConflictsLoading"
    | "normalizedTrainingDaysSelection"
    | "trainingFieldActiveDate"
    | "setTrainingFieldActiveDate"
    | "trainingDaysEditorSaving"
    | "trainingFieldBulkApplying"
    | "applyFieldToAllTrainingDays"
    | "activeTrainingFieldSelection"
    | "trainingFieldBulkSuccess"
    | "trainingFieldBulkSignature"
    | "fieldConflictsMap"
    | "setTrainingFieldSelections"
    | "selectedActiveTrainingField"
  >;
  trainingFields: TrainingField[];
  trainingFieldsLoading: boolean;
  openTrainingFieldModal: (field?: TrainingField) => void;
};

export function TrainingVenueStep({
  form,
  trainingFields,
  trainingFieldsLoading,
  openTrainingFieldModal,
}: Props) {
  const {
    trainingDaysEditorMode,
    canShowTrainingDaysFieldStep,
    effectiveTrainingDaysActiveStep,
    fieldConflictsLoading,
    normalizedTrainingDaysSelection,
    trainingFieldActiveDate,
    setTrainingFieldActiveDate,
    trainingDaysEditorSaving,
    trainingFieldBulkApplying,
    applyFieldToAllTrainingDays,
    activeTrainingFieldSelection,
    trainingFieldBulkSuccess,
    trainingFieldBulkSignature,
    fieldConflictsMap,
    setTrainingFieldSelections,
    selectedActiveTrainingField,
  } = form;
  return (
    <>
      {trainingDaysEditorMode !== "createGroup" &&
        canShowTrainingDaysFieldStep &&
        effectiveTrainingDaysActiveStep === "field" &&
        trainingFields.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "12px",
              marginTop: "8px",
              width: "min(100%, 620px)",
              marginInline: "auto",
              order: 3,
            }}
          >
            <span className="amp-lbl" style={{ textAlign: "center" }}>
              Терен по дни{fieldConflictsLoading ? " …" : ""}
            </span>
            <div className="amp-pills" style={{ justifyContent: "center" }}>
              {normalizedTrainingDaysSelection.map((date) => (
                <button
                  key={`field-date-${date}`}
                  type="button"
                  className={`amp-pill${trainingFieldActiveDate === date ? " amp-pill--active" : ""}`}
                  onClick={() => setTrainingFieldActiveDate(date)}
                  disabled={trainingDaysEditorSaving || trainingFieldBulkApplying}
                >
                  {formatIsoDateForDisplay(date)}
                </button>
              ))}
            </div>
            <span className="amp-lbl" style={{ textAlign: "center", opacity: 0.82 }}>
              Избран ден: {trainingFieldActiveDate ? formatIsoDateForDisplay(trainingFieldActiveDate) : "-"}
            </span>
            {normalizedTrainingDaysSelection.length > 1 && (
              <button
                type="button"
                className="amp-btn amp-btn--ghost"
                onClick={() => void applyFieldToAllTrainingDays()}
                disabled={
                  trainingDaysEditorSaving ||
                  trainingFieldsLoading ||
                  fieldConflictsLoading ||
                  trainingFieldBulkApplying ||
                  !activeTrainingFieldSelection.trainingFieldId
                }
              >
                {trainingFieldBulkApplying
                  ? "Проверка на заетостта…"
                  : "Приложи терена и позициите за всички дни"}
              </button>
            )}
            {trainingFieldBulkSuccess?.signature === trainingFieldBulkSignature && (
              <p
                role="status"
                aria-live="polite"
                style={{ margin: 0, textAlign: "center", color: "#32cd32", fontSize: 13 }}
              >
                {trainingFieldBulkSuccess.message}
              </p>
            )}
            <div style={{ display: "grid", gap: "12px" }}>
              {trainingFields.map((field) => {
                const isFieldSelected = activeTrainingFieldSelection.trainingFieldId === field.id;
                const isWholeFieldSelected =
                  isFieldSelected && activeTrainingFieldSelection.trainingFieldPieceIds.length === 0;
                const anyFieldSelected = !!activeTrainingFieldSelection.trainingFieldId;
                const fieldConflict = fieldConflictsMap[field.id];
                const isWholeFieldConflicted = Boolean(fieldConflict?.wholeFieldBlocked);
                const pieces =
                  field.pieces.length > 0 ? field.pieces : [{ id: "", name: "Цял терен", sortOrder: 0 }];
                return (
                  <div
                    key={field.id}
                    style={{
                      display: "grid",
                      gap: "6px",
                      opacity: anyFieldSelected && !isFieldSelected ? 0.38 : 1,
                      transition: "opacity 0.15s ease",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isWholeFieldConflicted) return;
                        setTrainingFieldSelections((prev) => ({
                          ...prev,
                          [trainingFieldActiveDate]: {
                            trainingFieldId: field.id,
                            trainingFieldPieceIds: [],
                          },
                        }));
                      }}
                      disabled={
                        trainingDaysEditorSaving ||
                        trainingFieldsLoading ||
                        fieldConflictsLoading ||
                        trainingFieldBulkApplying ||
                        isWholeFieldConflicted
                      }
                      title={isWholeFieldConflicted ? "Целият терен е зает в избрания час" : undefined}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: isWholeFieldSelected
                          ? "#32cd32"
                          : isWholeFieldConflicted
                            ? "rgba(255,120,120,0.75)"
                            : "rgba(255,255,255,0.88)",
                        fontWeight: 800,
                        fontSize: "14px",
                        textAlign: "center",
                        cursor:
                          trainingDaysEditorSaving || trainingFieldsLoading || isWholeFieldConflicted
                            ? "default"
                            : "pointer",
                        padding: 0,
                        textDecoration: isWholeFieldSelected
                          ? "underline"
                          : isWholeFieldConflicted
                            ? "line-through"
                            : "none",
                        textUnderlineOffset: "3px",
                        opacity:
                          isFieldSelected && activeTrainingFieldSelection.trainingFieldPieceIds.length > 0
                            ? 0.38
                            : 1,
                        transition: "opacity 0.15s ease, color 0.15s ease",
                      }}
                    >
                      {field.name}
                    </button>
                    <div
                      role="group"
                      aria-label={`Терен ${field.name}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${pieces.length}, minmax(0, 1fr))`,
                        minHeight: ["boxing", "karate"].includes(field.fieldType || "football")
                          ? undefined
                          : "96px",
                        width: ["boxing", "karate"].includes(field.fieldType || "football") ? "55%" : "100%",
                        margin: ["boxing", "karate"].includes(field.fieldType || "football")
                          ? "0 auto"
                          : undefined,
                        aspectRatio: ["boxing", "karate"].includes(field.fieldType || "football")
                          ? "1 / 1"
                          : "2.2 / 1",
                        border: isFieldSelected
                          ? "2px solid rgba(50,205,50,0.8)"
                          : "1px solid rgba(255,255,255,0.38)",
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: getFieldBackground(field.fieldType || "football"),
                        boxShadow: isFieldSelected
                          ? "0 0 0 1px rgba(50,205,50,0.6), 0 0 22px rgba(50,205,50,0.28)"
                          : "none",
                        position: "relative",
                      }}
                    >
                      {renderFieldMarkings(field.fieldType || "football")}
                      {pieces.map((piece, index) => {
                        const isPieceConflicted =
                          field.pieces.length === 0
                            ? isWholeFieldConflicted
                            : Boolean(fieldConflict?.blockedPieceIds.includes(piece.id));
                        const isPieceSelected =
                          field.pieces.length === 0
                            ? isWholeFieldSelected
                            : isFieldSelected &&
                              (activeTrainingFieldSelection.trainingFieldPieceIds.length === 0 ||
                                activeTrainingFieldSelection.trainingFieldPieceIds.includes(piece.id));
                        return (
                          <button
                            key={piece.id || `${field.id}-whole`}
                            type="button"
                            title={isPieceConflicted ? "Тази позиция е заета в избрания час" : undefined}
                            onClick={() => {
                              if (isPieceConflicted) return;
                              if (field.pieces.length === 0) {
                                setTrainingFieldSelections((prev) => ({
                                  ...prev,
                                  [trainingFieldActiveDate]: {
                                    trainingFieldId: field.id,
                                    trainingFieldPieceIds: [],
                                  },
                                }));
                                return;
                              }
                              setTrainingFieldSelections((prev) => {
                                return {
                                  ...prev,
                                  [trainingFieldActiveDate]: toggleTrainingFieldPiece(
                                    prev[trainingFieldActiveDate],
                                    field.id,
                                    piece.id,
                                    field.pieces.map((part) => part.id),
                                  ),
                                };
                              });
                            }}
                            disabled={
                              trainingDaysEditorSaving ||
                              trainingFieldsLoading ||
                              fieldConflictsLoading ||
                              trainingFieldBulkApplying ||
                              isPieceConflicted
                            }
                            style={{
                              minWidth: 0,
                              border: 0,
                              borderLeft: index === 0 ? 0 : "1px dashed rgba(255,255,255,0.68)",
                              background: isPieceConflicted
                                ? "rgba(180,0,0,0.32)"
                                : isPieceSelected
                                  ? "rgba(50,205,50,0.18)"
                                  : isFieldSelected &&
                                      activeTrainingFieldSelection.trainingFieldPieceIds.length > 0 &&
                                      !isPieceSelected
                                    ? "rgba(0,0,0,0.52)"
                                    : "transparent",
                              boxShadow:
                                isPieceSelected && !isPieceConflicted ? "inset 0 0 0 2px #32cd32" : "none",
                              color: isPieceConflicted
                                ? "rgba(255,120,120,0.85)"
                                : isPieceSelected
                                  ? "#32cd32"
                                  : isFieldSelected &&
                                      activeTrainingFieldSelection.trainingFieldPieceIds.length > 0 &&
                                      !isPieceSelected
                                    ? "rgba(255,255,255,0.42)"
                                    : "rgba(255,255,255,0.86)",
                              fontWeight: 800,
                              fontSize: "13px",
                              textAlign: "center",
                              padding: "8px",
                              cursor:
                                trainingDaysEditorSaving || trainingFieldsLoading || isPieceConflicted
                                  ? "not-allowed"
                                  : "pointer",
                              position: "relative",
                              zIndex: 1,
                              textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                              textDecoration: isPieceConflicted ? "line-through" : "none",
                              transition: "background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
                            }}
                          >
                            {piece.id ? piece.name : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="amp-btn amp-btn--ghost"
                onClick={() => openTrainingFieldModal()}
                disabled={trainingDaysEditorSaving}
              >
                Добави терен
              </button>
              {selectedActiveTrainingField && (
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => openTrainingFieldModal(selectedActiveTrainingField)}
                  disabled={trainingDaysEditorSaving}
                >
                  Редактирай терен
                </button>
              )}
            </div>
          </div>
        )}
      {trainingDaysEditorMode !== "createGroup" &&
        canShowTrainingDaysFieldStep &&
        effectiveTrainingDaysActiveStep === "field" &&
        trainingFields.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              marginTop: "8px",
              order: 3,
            }}
          >
            <p style={{ margin: 0, textAlign: "center", opacity: 0.6, fontSize: "0.9em" }}>
              Изборът на терен не е задължителен.
            </p>
            <button
              type="button"
              className="amp-btn amp-btn--ghost"
              onClick={() => openTrainingFieldModal()}
              disabled={trainingDaysEditorSaving}
            >
              Добави терен
            </button>
          </div>
        )}
    </>
  );
}

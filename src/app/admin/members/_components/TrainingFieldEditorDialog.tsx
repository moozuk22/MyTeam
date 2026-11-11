"use client";

import type * as React from "react";
import { XIcon } from "./members-page-icons";

type TrainingFieldEditorDialogProps = {
  trainingFieldModalOpen: boolean;
  trainingFieldSaving: boolean;
  setTrainingFieldModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trainingFieldEditId: string | null;
  trainingFieldType: string;
  setTrainingFieldType: React.Dispatch<React.SetStateAction<string>>;
  trainingFieldName: string;
  setTrainingFieldName: React.Dispatch<React.SetStateAction<string>>;
  trainingFieldPieces: { id: string | null; name: string }[];
  setTrainingFieldPieces: React.Dispatch<React.SetStateAction<{ id: string | null; name: string }[]>>;
  trainingFieldError: string;
  deleteTrainingField: (fieldId: string) => Promise<void>;
  saveTrainingField: () => Promise<void>;
};

export function TrainingFieldEditorDialog({
  trainingFieldModalOpen,
  trainingFieldSaving,
  setTrainingFieldModalOpen,
  trainingFieldEditId,
  trainingFieldType,
  setTrainingFieldType,
  trainingFieldName,
  setTrainingFieldName,
  trainingFieldPieces,
  setTrainingFieldPieces,
  trainingFieldError,
  deleteTrainingField,
  saveTrainingField,
}: TrainingFieldEditorDialogProps) {
  return (
    <>
      {trainingFieldModalOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => !trainingFieldSaving && setTrainingFieldModalOpen(false)}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">
                {trainingFieldEditId ? "Редактирай терен" : "Добави терен"}
              </span>
              <button
                className="amp-modal-close"
                onClick={() => setTrainingFieldModalOpen(false)}
                aria-label="Затвори"
                disabled={trainingFieldSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <label className="amp-edit-field" style={{ textAlign: "center" }}>
                <span className="amp-lbl" style={{ textAlign: "center" }}>
                  Вид терен
                </span>
                <select
                  className="amp-edit-input"
                  value={trainingFieldType}
                  onChange={(e) => setTrainingFieldType(e.target.value)}
                  disabled={trainingFieldSaving}
                  style={{ textAlign: "center" }}
                >
                  <option value="football">Футбол</option>
                  <option value="basketball">Баскетбол</option>
                  <option value="tennis">Тенис</option>
                  <option value="volleyball">Волейбол</option>
                  <option value="boxing">Бокс</option>
                  <option value="karate">Карате / Таекуондо</option>
                  <option value="swimming">Плувен басейн</option>
                </select>
              </label>
              <label className="amp-edit-field" style={{ textAlign: "center" }}>
                <span className="amp-lbl" style={{ textAlign: "center" }}>
                  Име на терена
                </span>
                <input
                  className="amp-edit-input"
                  style={{ textAlign: "center" }}
                  value={trainingFieldName}
                  onChange={(e) => setTrainingFieldName(e.target.value)}
                  disabled={trainingFieldSaving}
                />
              </label>

              <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
                <span className="amp-lbl" style={{ textAlign: "center" }}>
                  Полета на терена
                </span>
                {trainingFieldPieces.length === 0 ? (
                  <p className="amp-empty amp-empty--modal" style={{ margin: 0 }}>
                    Теренът ще се използва като цял.
                  </p>
                ) : (
                  trainingFieldPieces.map((piece, index) => (
                    <label
                      key={`${piece.id ?? "new"}-${index}`}
                      className="amp-edit-field"
                      style={{ textAlign: "center" }}
                    >
                      <span className="amp-lbl" style={{ textAlign: "center" }}>{`Поле ${index + 1}`}</span>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          className="amp-edit-input"
                          style={{ textAlign: "center" }}
                          value={piece.name}
                          onChange={(e) => {
                            const nextName = e.target.value;
                            setTrainingFieldPieces((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, name: nextName } : item,
                              ),
                            );
                          }}
                          disabled={trainingFieldSaving}
                        />
                        <button
                          type="button"
                          className="amp-btn amp-btn--ghost"
                          onClick={() =>
                            setTrainingFieldPieces((prev) =>
                              prev.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                          disabled={trainingFieldSaving}
                        >
                          Премахни
                        </button>
                      </div>
                    </label>
                  ))
                )}
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() =>
                    setTrainingFieldPieces((prev) =>
                      prev.length === 0
                        ? [
                            { id: null, name: "Поле 1" },
                            { id: null, name: "Поле 2" },
                          ]
                        : [...prev, { id: null, name: `Поле ${prev.length + 1}` }],
                    )
                  }
                  disabled={trainingFieldSaving}
                >
                  Раздели на полета
                </button>
              </div>

              {trainingFieldError && (
                <p className="amp-confirm-error" style={{ textAlign: "center" }}>
                  {trainingFieldError}
                </p>
              )}

              <div className="amp-modal-actions amp-modal-actions--end">
                {trainingFieldEditId && (
                  <button
                    type="button"
                    className="amp-btn amp-btn--danger"
                    onClick={() => void deleteTrainingField(trainingFieldEditId)}
                    disabled={trainingFieldSaving}
                  >
                    Изтрий
                  </button>
                )}
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setTrainingFieldModalOpen(false)}
                  disabled={trainingFieldSaving}
                >
                  Отказ
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveTrainingField()}
                  disabled={trainingFieldSaving}
                >
                  {trainingFieldSaving ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

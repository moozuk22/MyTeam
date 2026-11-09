import type * as React from "react";
import { type TrainingField } from "../_types/members-page-types";
import { clubSportToFieldType } from "../_components/TrainingFieldPreview";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type Options = {
  trainingDaysForm: Pick<
    TrainingDaysForm,
    "setTrainingDaysEditorError" | "schedulerForm" | "setSchedulerForm"
  >;
  clubId: string;
  setTrainingFieldsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setTrainingFields: React.Dispatch<React.SetStateAction<TrainingField[]>>;
  setTrainingFieldError: React.Dispatch<React.SetStateAction<string>>;
  setTrainingFieldEditId: React.Dispatch<React.SetStateAction<string | null>>;
  setTrainingFieldName: React.Dispatch<React.SetStateAction<string>>;
  setTrainingFieldType: React.Dispatch<React.SetStateAction<string>>;
  setTrainingFieldPieces: React.Dispatch<React.SetStateAction<{ id: string | null; name: string }[]>>;
  clubSport: string;
  setTrainingFieldModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trainingFieldSaving: boolean;
  setTrainingFieldSaving: React.Dispatch<React.SetStateAction<boolean>>;
  trainingFieldEditId: string | null;
  trainingFieldName: string;
  trainingFieldType: string;
  trainingFieldPieces: { id: string | null; name: string }[];
};

export function createTrainingFieldActions({
  trainingDaysForm,
  clubId,
  setTrainingFieldsLoading,
  setTrainingFields,
  setTrainingFieldError,
  setTrainingFieldEditId,
  setTrainingFieldName,
  setTrainingFieldType,
  setTrainingFieldPieces,
  clubSport,
  setTrainingFieldModalOpen,
  trainingFieldSaving,
  setTrainingFieldSaving,
  trainingFieldEditId,
  trainingFieldName,
  trainingFieldType,
  trainingFieldPieces,
}: Options) {
  const { setTrainingDaysEditorError, schedulerForm, setSchedulerForm } = trainingDaysForm;
  const loadTrainingFields = async (): Promise<TrainingField[]> => {
    if (!clubId) return [];
    setTrainingFieldsLoading(true);
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/fields`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setTrainingFields([]);
        return [];
      }
      const payload: unknown = await response.json();
      const fields = Array.isArray(payload)
        ? payload
            .map((item) => {
              const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
              const pieces = Array.isArray(raw.pieces)
                ? raw.pieces
                    .map((piece) => {
                      const pieceRaw =
                        typeof piece === "object" && piece !== null ? (piece as Record<string, unknown>) : {};
                      return {
                        id: String(pieceRaw.id ?? ""),
                        name: String(pieceRaw.name ?? "").trim(),
                        sortOrder: Number.isInteger(pieceRaw.sortOrder) ? Number(pieceRaw.sortOrder) : 0,
                      };
                    })
                    .filter((piece) => piece.id && piece.name)
                : [];
              return {
                id: String(raw.id ?? ""),
                name: String(raw.name ?? "").trim(),
                fieldType: typeof raw.fieldType === "string" ? raw.fieldType : "football",
                pieces: pieces.sort((a, b) => a.sortOrder - b.sortOrder),
              } satisfies TrainingField;
            })
            .filter((field) => field.id && field.name)
        : [];
      setTrainingFields(fields);
      return fields;
    } catch (error) {
      setTrainingDaysEditorError(error instanceof Error ? error.message : "Възникна грешка.");
      setTrainingFields([]);
      return [];
    } finally {
      setTrainingFieldsLoading(false);
    }
  };

  const openTrainingFieldModal = (field?: TrainingField) => {
    setTrainingFieldError("");
    if (field) {
      setTrainingFieldEditId(field.id);
      setTrainingFieldName(field.name);
      setTrainingFieldType(field.fieldType || "football");
      setTrainingFieldPieces(field.pieces.map((piece) => ({ id: piece.id, name: piece.name })));
    } else {
      setTrainingFieldEditId(null);
      setTrainingFieldName("");
      setTrainingFieldType(clubSport ? clubSportToFieldType(clubSport) : "football");
      setTrainingFieldPieces([]);
    }
    setTrainingFieldModalOpen(true);
  };

  const saveTrainingField = async () => {
    if (!clubId || trainingFieldSaving) return;
    setTrainingFieldSaving(true);
    setTrainingFieldError("");
    try {
      const endpoint = trainingFieldEditId
        ? `/api/admin/clubs/${encodeURIComponent(clubId)}/fields/${encodeURIComponent(trainingFieldEditId)}`
        : `/api/admin/clubs/${encodeURIComponent(clubId)}/fields`;
      const response = await fetch(endpoint, {
        method: trainingFieldEditId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trainingFieldName.trim(),
          fieldType: trainingFieldType,
          pieces: trainingFieldEditId
            ? trainingFieldPieces.map((piece) => ({ id: piece.id, name: piece.name.trim() }))
            : trainingFieldPieces.map((piece) => piece.name.trim()),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Неуспешно запазване на терена.",
        );
      }
      const fields = await loadTrainingFields();
      const savedId = typeof payload?.id === "string" ? payload.id : trainingFieldEditId;
      if (
        savedId &&
        (!schedulerForm.trainingFieldId || schedulerForm.trainingFieldId === trainingFieldEditId)
      ) {
        const savedField = fields.find((field) => field.id === savedId);
        setSchedulerForm((prev) => ({
          ...prev,
          trainingFieldId: savedId,
          trainingFieldPieceIds: savedField?.pieces.length
            ? prev.trainingFieldPieceIds.filter((id) => savedField.pieces.some((p) => p.id === id))
            : [],
        }));
      }
      setTrainingFieldModalOpen(false);
    } catch (error) {
      setTrainingFieldError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingFieldSaving(false);
    }
  };

  const deleteTrainingField = async (fieldId: string) => {
    if (!clubId || trainingFieldSaving) return;
    setTrainingFieldSaving(true);
    setTrainingFieldError("");
    try {
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/fields/${encodeURIComponent(fieldId)}`,
        {
          method: "DELETE",
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Неуспешно изтриване на терена.",
        );
      }
      await loadTrainingFields();
      setSchedulerForm((prev) =>
        prev.trainingFieldId === fieldId ? { ...prev, trainingFieldId: "", trainingFieldPieceIds: [] } : prev,
      );
      setTrainingFieldModalOpen(false);
    } catch (error) {
      setTrainingFieldError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingFieldSaving(false);
    }
  };

  return { loadTrainingFields, openTrainingFieldModal, saveTrainingField, deleteTrainingField };
}

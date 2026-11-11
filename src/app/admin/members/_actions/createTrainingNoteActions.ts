import type * as React from "react";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";

type Options = {
  trainingAttendanceState: Pick<
    TrainingAttendanceState,
    | "setTrainingAttendanceError"
    | "trainingAttendanceSessionId"
    | "trainingAttendanceDate"
    | "trainingAttendanceView"
  >;
  trainingGroups: Pick<TrainingGroups, "selectedTrainingGroupId" | "isCustomTrainingGroupMode">;
  clubId: string;
  trainingNoteSaving: boolean;
  setTrainingNoteSaving: React.Dispatch<React.SetStateAction<boolean>>;
  trainingNote: string;
  setTrainingBulkNoteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trainingNoteTargetDates: string[];
  selectedTeamGroup: number | null;
  setTrainingNotesByDate: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  trainingNoteScopeKey: string;
  fetchTrainingAttendance: (
    date?: string,
    groupScopeOverride?: string,
    trainingGroupIdOverride?: string,
    viewOverride?: "teamGroup" | "trainingGroups",
    monthOverride?: string,
    trainingSessionIdOverride?: string,
    legacyScopeOverride?: boolean,
  ) => Promise<void>;
};

export function createTrainingNoteActions({
  trainingAttendanceState,
  trainingGroups,
  clubId,
  trainingNoteSaving,
  setTrainingNoteSaving,
  trainingNote,
  setTrainingBulkNoteOpen,
  trainingNoteTargetDates,
  selectedTeamGroup,
  setTrainingNotesByDate,
  trainingNoteScopeKey,
  fetchTrainingAttendance,
}: Options) {
  const {
    setTrainingAttendanceError,
    trainingAttendanceSessionId,
    trainingAttendanceDate,
    trainingAttendanceView,
  } = trainingAttendanceState;
  const { selectedTrainingGroupId, isCustomTrainingGroupMode } = trainingGroups;
  const saveTrainingNote = async () => {
    if (!clubId || trainingNoteSaving) return;
    setTrainingNoteSaving(true);
    setTrainingAttendanceError("");
    try {
      if (trainingAttendanceSessionId) {
        const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingSessionId: trainingAttendanceSessionId, note: trainingNote }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Неуспешно запазване на описание.");
        setTrainingBulkNoteOpen(false);
        return;
      }
      const targetDates =
        trainingNoteTargetDates.length > 0
          ? trainingNoteTargetDates
          : trainingAttendanceDate
            ? [trainingAttendanceDate]
            : [];
      if (targetDates.length === 0) {
        throw new Error("Select at least one training day for note.");
      }
      const nextNoteNormalized = trainingNote.trim();
      const teamGroupFilter = trainingAttendanceView === "teamGroup" ? selectedTeamGroup : null;
      const existingNotesByDate = await Promise.all(
        targetDates.map(async (targetDate) => {
          const search = new URLSearchParams({ date: targetDate });
          if (trainingAttendanceView === "trainingGroups") {
            if (selectedTrainingGroupId) {
              search.set(
                isCustomTrainingGroupMode ? "customTrainingGroupId" : "trainingGroupId",
                selectedTrainingGroupId,
              );
            }
          } else if (teamGroupFilter !== null) {
            search.set("teamGroup", String(teamGroupFilter));
          }
          const response = await fetch(
            `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance?${search.toString()}`,
            { cache: "no-store" },
          );
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(
              typeof payload?.error === "string" && payload.error.trim()
                ? payload.error.trim()
                : "Неуспешно зареждане на текущото описание.",
            );
          }
          const payload = await response.json().catch(() => ({}));
          return {
            date: targetDate,
            note: typeof payload?.note === "string" ? payload.note.trim() : "",
          };
        }),
      );
      const datesToSave = existingNotesByDate
        .filter((item) => item.note !== nextNoteNormalized)
        .map((item) => item.date);
      if (datesToSave.length === 0) {
        throw new Error("Описанието е същото като предишното за избраната дата.");
      }

      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingDate: datesToSave[0],
          note: trainingNote,
          ...(trainingAttendanceView === "trainingGroups"
            ? isCustomTrainingGroupMode
              ? { customTrainingGroupId: selectedTrainingGroupId || null }
              : { trainingGroupId: selectedTrainingGroupId || null }
            : { teamGroup: selectedTeamGroup }),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Неуспешно запазване на описание.",
        );
      }
      for (const targetDate of datesToSave.slice(1)) {
        const bulkResponse = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trainingDate: targetDate,
              note: trainingNote,
              ...(trainingAttendanceView === "trainingGroups"
                ? isCustomTrainingGroupMode
                  ? { customTrainingGroupId: selectedTrainingGroupId || null }
                  : { trainingGroupId: selectedTrainingGroupId || null }
                : { teamGroup: selectedTeamGroup }),
            }),
          },
        );
        if (!bulkResponse.ok) {
          const payload = await bulkResponse.json().catch(() => ({}));
          throw new Error(
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error.trim()
              : `Failed saving note for ${targetDate}.`,
          );
        }
      }
      setTrainingNotesByDate((prev) => {
        const next = { ...prev };
        for (const date of datesToSave) {
          next[`${trainingNoteScopeKey}|${date}`] = trainingNote;
        }
        return next;
      });
      await fetchTrainingAttendance(trainingAttendanceDate || undefined);
      setTrainingBulkNoteOpen(false);
    } catch (error) {
      setTrainingAttendanceError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingNoteSaving(false);
    }
  };

  return { saveTrainingNote };
}

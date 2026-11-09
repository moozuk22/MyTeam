import type { CustomTrainingGroup } from "../_types/members-page-types";
import type * as React from "react";
import { buildMatchDetailsUpdate } from "@/lib/matchDetailsUpdate";
import { hasMatchFinished } from "@/lib/matchResult";
import { type TrainingWeekSessionItem, type ClubMatch } from "../_types/members-page-types";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";
import { type MatchEditorState } from "../_hooks/useMatchEditorState";

type Options = {
  matchEditorState: Pick<
    MatchEditorState,
    | "setMatchSelectedDates"
    | "matchEventType"
    | "matchSelectedDates"
    | "setMatchEditorSaving"
    | "setMatchEditorError"
    | "matchDetailsPerDay"
    | "matchExistingIdByDate"
    | "matchTeamGroups"
    | "setMatchDetailsPerDay"
    | "setMatchTeamGroups"
    | "setMatchExistingIdByDate"
    | "setDayDetailsMatchSaving"
    | "setDayDetailsMatchError"
    | "dayDetailsMatchEditForm"
    | "dayDetailsMatchOriginalResult"
    | "setDayDetailsMatchEditOpen"
    | "matchEditTarget"
    | "setMatchEditTarget"
    | "setDayDetailsMatchDeleteConfirm"
  >;
  trainingGroups: Pick<TrainingGroups, "isCustomTrainingGroupMode" | "customTrainingGroups">;
  trainingAttendanceState: Pick<TrainingAttendanceState, "weekColorFilter" | "setTrainingDayDetailsOpen">;
  trainingDaysForm: Pick<TrainingDaysForm, "setTrainingDaysSuccessMessage" | "setTrainingDaysSuccessOpen">;
  clubId: string;
  setClubMatches: React.Dispatch<React.SetStateAction<ClubMatch[]>>;
  selectedCustomGroup: CustomTrainingGroup | null;
  setScheduleEventModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fetchTrainingWeekSessions: (options?: {
    silent?: boolean;
  }) => Promise<TrainingWeekSessionItem[] | undefined>;
  dayDetailsActiveMatch: ClubMatch | null;
};

export function createClubMatchActions({
  matchEditorState,
  trainingGroups,
  trainingAttendanceState,
  trainingDaysForm,
  clubId,
  setClubMatches,
  selectedCustomGroup,
  setScheduleEventModalOpen,
  fetchTrainingWeekSessions,
  dayDetailsActiveMatch,
}: Options) {
  const {
    setMatchSelectedDates,
    matchEventType,
    matchSelectedDates,
    setMatchEditorSaving,
    setMatchEditorError,
    matchDetailsPerDay,
    matchExistingIdByDate,
    matchTeamGroups,
    setMatchDetailsPerDay,
    setMatchTeamGroups,
    setMatchExistingIdByDate,
    setDayDetailsMatchSaving,
    setDayDetailsMatchError,
    dayDetailsMatchEditForm,
    dayDetailsMatchOriginalResult,
    setDayDetailsMatchEditOpen,
    matchEditTarget,
    setMatchEditTarget,
    setDayDetailsMatchDeleteConfirm,
  } = matchEditorState;
  const { isCustomTrainingGroupMode, customTrainingGroups } = trainingGroups;
  const { weekColorFilter, setTrainingDayDetailsOpen } = trainingAttendanceState;
  const { setTrainingDaysSuccessMessage, setTrainingDaysSuccessOpen } = trainingDaysForm;
  const fetchClubMatches = async () => {
    if (!clubId) return;
    try {
      const res = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/matches`);
      if (res.ok) {
        const data = (await res.json()) as { matches: ClubMatch[] };
        setClubMatches(data.matches ?? []);
      }
    } catch {
      // non-critical
    }
  };

  const toggleMatchDate = (date: string) => {
    setMatchSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort(),
    );
  };

  const handleSaveMatch = async () => {
    if (!clubId || !matchEventType || matchSelectedDates.length === 0) return;
    setMatchEditorSaving(true);
    setMatchEditorError("");
    const warnings: string[] = [];
    try {
      for (const date of matchSelectedDates) {
        const details = matchDetailsPerDay[date] ?? {
          opponent: "",
          location: "",
          time: "",
          duration: "90",
          isHome: null,
        };
        const durationMinutes = Number.parseInt(details.duration || "90", 10);
        const existingId = matchExistingIdByDate[date];
        const url = existingId
          ? `/api/admin/clubs/${encodeURIComponent(clubId)}/matches/${encodeURIComponent(existingId)}`
          : `/api/admin/clubs/${encodeURIComponent(clubId)}/matches`;
        const res = await fetch(url, {
          method: existingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: details.description ?? "",
            category: details.category,
            eventType: matchEventType,
            opponent: details.opponent,
            location: details.location,
            matchDate: date,
            matchTime: details.time,
            durationMinutes,
            isHome: details.isHome,
            teamGroups: matchTeamGroups,
            customGroupId: isCustomTrainingGroupMode
              ? (selectedCustomGroup?.id ??
                (weekColorFilter
                  ? (customTrainingGroups.find((g) => g.color === weekColorFilter)?.id ?? null)
                  : null) ??
                (customTrainingGroups.length === 1 ? customTrainingGroups[0].id : null))
              : null,
          }),
        });
        const data = (await res.json()) as { error?: string; warning?: string };
        if (!res.ok) {
          setMatchEditorError(data.error ?? "Грешка при запазване.");
          return;
        }
        if (data.warning) warnings.push(data.warning);
      }
      setScheduleEventModalOpen(false);
      setMatchSelectedDates([]);
      setMatchDetailsPerDay({});
      setMatchTeamGroups([]);
      setMatchExistingIdByDate({});
      await Promise.all([fetchClubMatches(), fetchTrainingWeekSessions()]);
      if (warnings.length > 0) {
        setTrainingDaysSuccessMessage(`Мачът е запазен. Внимание: ${warnings[0]}`);
        setTrainingDaysSuccessOpen(true);
      }
    } catch {
      setMatchEditorError("Грешка при запазване.");
    } finally {
      setMatchEditorSaving(false);
    }
  };

  const handleDayDetailsMatchSave = async () => {
    if (!clubId || !dayDetailsActiveMatch) return;
    setDayDetailsMatchSaving(true);
    setDayDetailsMatchError("");
    try {
      const res = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/matches/${encodeURIComponent(dayDetailsActiveMatch.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildMatchDetailsUpdate(
              dayDetailsMatchEditForm,
              dayDetailsMatchOriginalResult.current,
              hasMatchFinished(dayDetailsActiveMatch),
            ),
          ),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDayDetailsMatchError(data.error ?? "Грешка при запазване.");
        return;
      }
      setDayDetailsMatchEditOpen(false);
      if (matchEditTarget) {
        setTrainingDayDetailsOpen(false);
        setMatchEditTarget(null);
      }
      await Promise.all([fetchClubMatches(), fetchTrainingWeekSessions()]);
    } catch {
      setDayDetailsMatchError("Грешка при запазване.");
    } finally {
      setDayDetailsMatchSaving(false);
    }
  };

  const handleDayDetailsMatchDelete = async () => {
    if (!clubId || !dayDetailsActiveMatch) return;
    setDayDetailsMatchSaving(true);
    setDayDetailsMatchError("");
    try {
      const res = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/matches/${encodeURIComponent(dayDetailsActiveMatch.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setDayDetailsMatchError("Грешка при изтриване.");
        setDayDetailsMatchSaving(false);
        return;
      }
      setTrainingDayDetailsOpen(false);
      setDayDetailsMatchDeleteConfirm(false);
      setDayDetailsMatchEditOpen(false);
      await Promise.all([fetchClubMatches(), fetchTrainingWeekSessions()]);
    } catch {
      setDayDetailsMatchError("Грешка при изтриване.");
    } finally {
      setDayDetailsMatchSaving(false);
    }
  };

  return {
    fetchClubMatches,
    toggleMatchDate,
    handleSaveMatch,
    handleDayDetailsMatchSave,
    handleDayDetailsMatchDelete,
  };
}

"use client";

import { customTrainingGroupCoachScopeKey } from "../_utils/training-session-scope";

import type * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CUSTOM_TRAINING_GROUP_COLOR_PALETTE,
  isCustomTrainingGroupPaletteColor,
} from "@/lib/customTrainingGroupColors";
import {
  TRAINING_TIME_REGEX,
  normalizeTrainingDateTimes,
  normalizeTrainingDurationInput,
  normalizeOptionalId,
  normalizeTrainingFieldSelections,
  sortByName,
} from "../_utils/members-page-utils";
import {
  type Member,
  type TrainingAttendancePlayer,
  type TrainingUpcomingDateItem,
  type TrainingScheduleGroup,
  type CustomTrainingGroup,
} from "../_types/members-page-types";

type TrainingGroupsOptions = {
  coachGroupId: string;
  clubId: string;
  setTrainingAttendanceError: React.Dispatch<React.SetStateAction<string>>;
  setTrainingAttendancePlayers: React.Dispatch<React.SetStateAction<TrainingAttendancePlayer[]>>;
  setTrainingAttendanceStats: React.Dispatch<
    React.SetStateAction<{ total: number; attending: number; optedOut: number }>
  >;
  setTrainingUpcomingDates: React.Dispatch<React.SetStateAction<TrainingUpcomingDateItem[]>>;
  members: Member[];
  refreshMembersList: () => Promise<void>;
  trainingAttendanceOpen: boolean;
  fetchTrainingAttendance: (
    date?: string,
    groupScopeOverride?: string,
    trainingGroupIdOverride?: string,
    viewOverride?: "teamGroup" | "trainingGroups",
    monthOverride?: string,
    trainingSessionIdOverride?: string,
    legacyScopeOverride?: boolean,
  ) => Promise<void>;
  trainingAttendanceView: "teamGroup" | "trainingGroups" | "today";
  setTrainingAttendanceDate: React.Dispatch<React.SetStateAction<string>>;
  setTrainingDayDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTrainingBulkNoteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTrainingDaysEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTrainingDaysEditorError: React.Dispatch<React.SetStateAction<string>>;
  setTrainingNoteTargetDates: React.Dispatch<React.SetStateAction<string[]>>;
};

import type { Schedule2Group } from "../_components/Schedule2";

export function useTrainingGroups({
  coachGroupId,
  clubId,
  setTrainingAttendanceError,
  setTrainingAttendancePlayers,
  setTrainingAttendanceStats,
  setTrainingUpcomingDates,
  members,
  refreshMembersList,
  trainingAttendanceOpen,
  fetchTrainingAttendance,
  trainingAttendanceView,
  setTrainingAttendanceDate,
  setTrainingDayDetailsOpen,
  setTrainingBulkNoteOpen,
  setTrainingDaysEditorOpen,
  setTrainingDaysEditorError,
  setTrainingNoteTargetDates,
}: TrainingGroupsOptions) {
  const [trainingGroupMode, setTrainingGroupMode] = useState<"team_group" | "custom_group">("team_group");

  const [trainingGroupModeDraft, setTrainingGroupModeDraft] = useState<"team_group" | "custom_group">(
    "team_group",
  );

  const [trainingGroupModeSettingsOpen, setTrainingGroupModeSettingsOpen] = useState(false);

  const [trainingGroupModeSaving, setTrainingGroupModeSaving] = useState(false);

  const [trainingGroupModeError, setTrainingGroupModeError] = useState("");

  const [trainingGroupCreateOpen, setTrainingGroupCreateOpen] = useState(false);

  const [trainingGroupCreateStep, setTrainingGroupCreateStep] = useState<"picker" | "create" | "edit-pick">(
    "picker",
  );

  const [trainingGroupEditPickId, setTrainingGroupEditPickId] = useState("");

  const [trainingGroupCreateSaving, setTrainingGroupCreateSaving] = useState(false);

  const [trainingGroupCreateError, setTrainingGroupCreateError] = useState("");

  const [trainingGroupCreateGroups, setTrainingGroupCreateGroups] = useState<string[]>([]);

  const [trainingGroupCreateName, setTrainingGroupCreateName] = useState("");

  const [trainingGroupCreatePlayerIds, setTrainingGroupCreatePlayerIds] = useState<string[]>([]);

  const [trainingGroupCreateColor, setTrainingGroupCreateColor] = useState("");

  const [customGroupCreateSearch, setCustomGroupCreateSearch] = useState("");

  const [trainingGroupEditOpen, setTrainingGroupEditOpen] = useState(false);

  const [trainingGroupEditSaving, setTrainingGroupEditSaving] = useState(false);

  const [trainingGroupEditError, setTrainingGroupEditError] = useState("");

  const [trainingGroupDeleteConfirmOpen, setTrainingGroupDeleteConfirmOpen] = useState(false);

  const [trainingGroupDeleteSaving, setTrainingGroupDeleteSaving] = useState(false);

  const [trainingGroupEditId, setTrainingGroupEditId] = useState("");

  const [trainingGroupEditName, setTrainingGroupEditName] = useState("");

  const [trainingGroupEditGroups, setTrainingGroupEditGroups] = useState<string[]>([]);

  const [trainingGroupEditPlayerIds, setTrainingGroupEditPlayerIds] = useState<string[]>([]);

  const [trainingGroupEditColor, setTrainingGroupEditColor] = useState("");

  const [customGroupEditSearch, setCustomGroupEditSearch] = useState("");

  const [selectedTrainingGroupId, setSelectedTrainingGroupId] = useState("");

  const [trainingScheduleGroupsLoading, setTrainingScheduleGroupsLoading] = useState(false);

  const [trainingScheduleGroups, setTrainingScheduleGroups] = useState<TrainingScheduleGroup[]>([]);

  const [customTrainingGroups, setCustomTrainingGroups] = useState<CustomTrainingGroup[]>([]);

  const [customTrainingGroupColors, setCustomTrainingGroupColors] = useState<
    Pick<CustomTrainingGroup, "id" | "color">[]
  >([]);

  const isCustomTrainingGroupMode = trainingGroupMode === "custom_group";

  const customTrainingGroupCoachScope = useMemo(
    () => customTrainingGroupCoachScopeKey(coachGroupId),
    [coachGroupId],
  );

  const noFreeCustomTrainingGroupColor = useMemo(() => {
    if (!isCustomTrainingGroupMode) return false;
    const used = new Set(
      customTrainingGroupColors.map((g) => g.color).filter(isCustomTrainingGroupPaletteColor),
    );
    return !CUSTOM_TRAINING_GROUP_COLOR_PALETTE.some((c) => !used.has(c));
  }, [isCustomTrainingGroupMode, customTrainingGroupColors]);

  const loadTrainingScheduleGroups = async (): Promise<TrainingScheduleGroup[]> => {
    if (!clubId) return [];
    setTrainingScheduleGroupsLoading(true);
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Неуспешно зареждане на тренировъчните групи.");
      }
      const payload: unknown = await response.json();
      const groups = Array.isArray(payload)
        ? payload
            .map((item) => {
              const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
              const teamGroups = Array.isArray(raw.teamGroups)
                ? raw.teamGroups
                    .map((value) => Number.parseInt(String(value), 10))
                    .filter((value) => Number.isInteger(value))
                    .sort((a, b) => a - b)
                : [];
              const trainingDates = Array.isArray(raw.trainingDates)
                ? raw.trainingDates
                    .map((value) => String(value ?? "").trim())
                    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
                    .sort((a, b) => a.localeCompare(b))
                : [];
              return {
                id: String(raw.id ?? ""),
                name: String(raw.name ?? "").trim(),
                teamGroups,
                trainingDates,
                trainingTime:
                  typeof raw.trainingTime === "string" && TRAINING_TIME_REGEX.test(raw.trainingTime.trim())
                    ? raw.trainingTime.trim()
                    : null,
                trainingDateTimes: normalizeTrainingDateTimes(
                  raw.trainingDateTimes,
                  trainingDates,
                  typeof raw.trainingTime === "string" ? raw.trainingTime : null,
                ),
                trainingDurationMinutes: normalizeTrainingDurationInput(raw.trainingDurationMinutes),
                trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
                trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds)
                  ? raw.trainingFieldPieceIds.map(String)
                  : [],
                trainingFieldSelections: normalizeTrainingFieldSelections(
                  raw.trainingFieldSelections,
                  trainingDates,
                  {
                    trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
                    trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds)
                      ? raw.trainingFieldPieceIds.map(String)
                      : [],
                  },
                ),
              } satisfies TrainingScheduleGroup;
            })
            .filter((group) => group.id && group.teamGroups.length >= 2)
        : [];
      const sortedGroups = sortByName(groups);
      setTrainingScheduleGroups(sortedGroups);
      setSelectedTrainingGroupId((prev) => {
        if (prev && sortedGroups.some((group) => group.id === prev)) {
          return prev;
        }
        return sortedGroups[0]?.id ?? "";
      });
      return sortedGroups;
    } catch {
      setTrainingScheduleGroups([]);
      setSelectedTrainingGroupId("");
      return [];
    } finally {
      setTrainingScheduleGroupsLoading(false);
    }
  };

  const loadCustomTrainingGroups = useCallback(async (target?: Schedule2Group): Promise<CustomTrainingGroup[]> => {
    if (!clubId) return [];
    if (!target) setTrainingScheduleGroupsLoading(true);
    try {
      const search = new URLSearchParams();
      const scope = target ? target.coachGroupId : coachGroupId;
      if (scope) search.set("coachGroupId", scope);
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups${search.size ? `?${search.toString()}` : ""}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to load custom training groups.");
      }
      const payload: unknown = await response.json();
      const groups = Array.isArray(payload)
        ? payload
            .map((item) => {
              const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
              const trainingDates = Array.isArray(raw.trainingDates)
                ? raw.trainingDates
                    .map((value) => String(value ?? "").trim())
                    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
                    .sort((a, b) => a.localeCompare(b))
                : [];
              const playerIds = Array.isArray(raw.playerIds)
                ? raw.playerIds.map((value) => String(value ?? "").trim()).filter(Boolean)
                : [];
              return {
                id: String(raw.id ?? ""),
                name: String(raw.name ?? "").trim(),
                coachGroupId: normalizeOptionalId(raw.coachGroupId),
                playerIds,
                trainingDates,
                trainingTime:
                  typeof raw.trainingTime === "string" && TRAINING_TIME_REGEX.test(raw.trainingTime.trim())
                    ? raw.trainingTime.trim()
                    : null,
                trainingDateTimes: normalizeTrainingDateTimes(
                  raw.trainingDateTimes,
                  trainingDates,
                  typeof raw.trainingTime === "string" ? raw.trainingTime : null,
                ),
                trainingDurationMinutes: normalizeTrainingDurationInput(raw.trainingDurationMinutes),
                trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
                trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds)
                  ? raw.trainingFieldPieceIds.map(String)
                  : [],
                trainingFieldSelections: normalizeTrainingFieldSelections(
                  raw.trainingFieldSelections,
                  trainingDates,
                  {
                    trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
                    trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds)
                      ? raw.trainingFieldPieceIds.map(String)
                      : [],
                  },
                ),
                color:
                  typeof raw.color === "string" && isCustomTrainingGroupPaletteColor(raw.color.trim())
                    ? raw.color.trim()
                    : null,
              } satisfies CustomTrainingGroup;
            })
            .filter((group) => group.id && group.name)
        : [];
      const sortedGroups = sortByName(groups);
      if (target) return sortedGroups;
      const colorsResponse = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups?colorsOnly=true`, { cache: "no-store" });
      if (!colorsResponse.ok) throw new Error("Failed to load custom training group colors.");
      setCustomTrainingGroupColors(await colorsResponse.json());
      setCustomTrainingGroups(sortedGroups);
      setSelectedTrainingGroupId((prev) => {
        if (prev && sortedGroups.some((group) => group.id === prev)) {
          return prev;
        }
        return sortedGroups[0]?.id ?? "";
      });
      return sortedGroups;
    } catch (error) {
      if (target) throw error;
      setCustomTrainingGroups([]);
      setSelectedTrainingGroupId("");
      return [];
    } finally {
      if (!target) setTrainingScheduleGroupsLoading(false);
    }
  }, [clubId, coachGroupId]);

  useEffect(() => {
    if (!clubId) {
      setCustomTrainingGroups([]);
      return;
    }

    if (trainingGroupMode !== "custom_group" && !coachGroupId) {
      setCustomTrainingGroups([]);
      return;
    }

    void loadCustomTrainingGroups();
  }, [clubId, loadCustomTrainingGroups, trainingGroupMode, coachGroupId]);

  const saveTrainingGroupMode = async (nextMode: "team_group" | "custom_group") => {
    if (!clubId || trainingGroupModeSaving) return;
    if (nextMode === trainingGroupMode) {
      setTrainingGroupModeSettingsOpen(false);
      setTrainingGroupModeError("");
      return;
    }
    setTrainingGroupModeSaving(true);
    setTrainingAttendanceError("");
    setTrainingGroupModeError("");
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-group-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingGroupMode: nextMode }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to save training group mode.");
      }
      setTrainingGroupMode(nextMode);
      setTrainingGroupModeDraft(nextMode);
      setSelectedTrainingGroupId("");
      setTrainingAttendancePlayers([]);
      setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
      setTrainingUpcomingDates([]);
      if (nextMode === "custom_group") {
        await loadCustomTrainingGroups();
      } else {
        await loadTrainingScheduleGroups();
      }
      setTrainingGroupModeSettingsOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save training group mode.";
      setTrainingGroupModeError(message);
      setTrainingAttendanceError(message);
    } finally {
      setTrainingGroupModeSaving(false);
    }
  };

  const openTrainingGroupModeSettings = () => {
    setTrainingGroupModeDraft(trainingGroupMode);
    setTrainingGroupModeError("");
    setTrainingGroupModeSettingsOpen(true);
  };

  const openTrainingGroupCreateModal = () => {
    setTrainingGroupCreateError("");
    setTrainingGroupCreateGroups([]);
    setTrainingGroupCreateName("");
    setTrainingGroupCreatePlayerIds([]);
    setCustomGroupCreateSearch("");
    const used = new Set(
      customTrainingGroupColors.map((g) => g.color).filter(isCustomTrainingGroupPaletteColor),
    );
    const firstFree =
      CUSTOM_TRAINING_GROUP_COLOR_PALETTE.find((c) => !used.has(c)) ?? CUSTOM_TRAINING_GROUP_COLOR_PALETTE[0];
    setTrainingGroupCreateColor(firstFree);
    setTrainingGroupCreateStep("picker");
    const firstGroup = isCustomTrainingGroupMode ? customTrainingGroups[0] : trainingScheduleGroups[0];
    setTrainingGroupEditPickId(firstGroup?.id ?? "");
    setTrainingGroupCreateOpen(true);
  };

  const openTrainingGroupEditModal = (groupId: string) => {
    if (isCustomTrainingGroupMode) {
      const group = customTrainingGroups.find((item) => item.id === groupId);
      if (!group) {
        setTrainingAttendanceError("Custom training group not found.");
        return;
      }
      const activeIds = new Set(members.filter((m) => m.isActive).map((m) => m.id));
      setTrainingGroupEditError("");
      setTrainingGroupEditId(group.id);
      setTrainingGroupEditName(group.name);
      setTrainingGroupEditPlayerIds(group.playerIds.filter((id) => activeIds.has(id)));
      setCustomGroupEditSearch("");
      const usedByOthers = new Set(
        customTrainingGroupColors
          .filter((item) => item.id !== group.id)
          .map((item) => item.color)
          .filter(isCustomTrainingGroupPaletteColor),
      );
      const keepColor =
        group.color && isCustomTrainingGroupPaletteColor(group.color) && !usedByOthers.has(group.color)
          ? group.color
          : null;
      setTrainingGroupEditColor(
        keepColor ??
          CUSTOM_TRAINING_GROUP_COLOR_PALETTE.find((c) => !usedByOthers.has(c)) ??
          CUSTOM_TRAINING_GROUP_COLOR_PALETTE[0],
      );
      setTrainingGroupEditOpen(true);
      return;
    }
    const group = trainingScheduleGroups.find((item) => item.id === groupId);
    if (!group) {
      setTrainingAttendanceError("Сборният отбор не е намерен.");
      return;
    }
    const initialGroups = group.teamGroups.map((value) => String(value));
    setTrainingGroupEditError("");
    setTrainingGroupEditId(group.id);
    setTrainingGroupEditGroups(initialGroups);
    setTrainingGroupEditName(
      group.name ||
        initialGroups
          .slice()
          .sort((a, b) => Number(a) - Number(b))
          .join("/"),
    );
    setTrainingGroupEditOpen(true);
  };

  const saveTrainingGroupFromModal = async () => {
    if (!clubId || trainingGroupCreateSaving) return;
    setTrainingGroupCreateSaving(true);
    setTrainingGroupCreateError("");
    try {
      if (isCustomTrainingGroupMode) {
        const name = trainingGroupCreateName.trim();
        if (!name) {
          throw new Error("Enter a group name.");
        }
        if (noFreeCustomTrainingGroupColor) {
          throw new Error("Няма свободни цветове за нова група в тази треньорска група.");
        }
        if (!isCustomTrainingGroupPaletteColor(trainingGroupCreateColor)) {
          throw new Error("Изберете цвят от палитрата.");
        }
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              playerIds: trainingGroupCreatePlayerIds,
              coachGroupId: coachGroupId || null,
              color: trainingGroupCreateColor,
            }),
          },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (response.status === 400) await loadCustomTrainingGroups();
          throw new Error(payload?.error || "Failed to create custom training group.");
        }
        setTrainingGroupCreateOpen(false);
        setTrainingGroupCreateStep("picker");
        await loadCustomTrainingGroups();
        void refreshMembersList();
        return;
      }
      const selectedGroups = trainingGroupCreateGroups
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value));
      if (selectedGroups.length < 2) {
        throw new Error("Изберете поне 2 набора.");
      }

      const defaultName = selectedGroups.map((group) => String(group)).join("/");
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: defaultName,
          teamGroups: selectedGroups,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешно създаване на сборен отбор.");
      }

      setTrainingGroupCreateOpen(false);
      setTrainingGroupCreateStep("picker");
      await loadTrainingScheduleGroups();
    } catch (error) {
      setTrainingGroupCreateError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingGroupCreateSaving(false);
    }
  };

  const saveTrainingGroupEditFromModal = async () => {
    if (!clubId || !trainingGroupEditId || trainingGroupEditSaving) return;
    setTrainingGroupEditSaving(true);
    setTrainingGroupEditError("");
    try {
      if (isCustomTrainingGroupMode) {
        const name = trainingGroupEditName.trim();
        if (!name) {
          throw new Error("Enter a group name.");
        }
        if (!isCustomTrainingGroupPaletteColor(trainingGroupEditColor)) {
          throw new Error("Изберете цвят от палитрата.");
        }
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups/${encodeURIComponent(trainingGroupEditId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              playerIds: trainingGroupEditPlayerIds,
              color: trainingGroupEditColor,
            }),
          },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (response.status === 400) await loadCustomTrainingGroups();
          throw new Error(payload?.error || "Failed to edit custom training group.");
        }
        setTrainingGroupEditOpen(false);
        const refreshedGroups = await loadCustomTrainingGroups();
        void refreshMembersList();
        const fallbackId = refreshedGroups.some((group) => group.id === trainingGroupEditId)
          ? trainingGroupEditId
          : (refreshedGroups[0]?.id ?? "");
        setSelectedTrainingGroupId(fallbackId);
        if (trainingAttendanceOpen && fallbackId) {
          await fetchTrainingAttendance(undefined, undefined, fallbackId, "trainingGroups");
        }
        return;
      }
      const selectedGroups = trainingGroupEditGroups
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value));
      if (selectedGroups.length < 2) {
        throw new Error("Изберете поне 2 набора.");
      }

      const generatedName = selectedGroups
        .slice()
        .sort((a, b) => a - b)
        .map((value) => String(value))
        .join("/");
      const nextName = trainingGroupEditName.trim() || generatedName;

      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups/${encodeURIComponent(trainingGroupEditId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nextName,
            teamGroups: selectedGroups,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешна редакция на сборния отбор.");
      }

      setTrainingGroupEditOpen(false);
      const refreshedGroups = isCustomTrainingGroupMode
        ? await loadCustomTrainingGroups()
        : await loadTrainingScheduleGroups();
      if (trainingAttendanceView === "trainingGroups") {
        const hasSelected = refreshedGroups.some((group) => group.id === trainingGroupEditId);
        if (hasSelected) {
          setSelectedTrainingGroupId(trainingGroupEditId);
          await fetchTrainingAttendance(undefined, undefined, trainingGroupEditId, "trainingGroups");
        } else {
          const fallbackId = refreshedGroups[0]?.id ?? "";
          setSelectedTrainingGroupId(fallbackId);
          if (fallbackId) {
            await fetchTrainingAttendance(undefined, undefined, fallbackId, "trainingGroups");
          } else {
            setTrainingAttendancePlayers([]);
            setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
            setTrainingUpcomingDates([]);
            setTrainingAttendanceDate("");
          }
        }
      }
    } catch (error) {
      setTrainingGroupEditError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingGroupEditSaving(false);
    }
  };

  const deleteSelectedTrainingGroup = async () => {
    if (!clubId || !selectedTrainingGroupId || trainingGroupDeleteSaving) return;

    setTrainingGroupDeleteSaving(true);
    setTrainingAttendanceError("");
    try {
      const response = await fetch(
        isCustomTrainingGroupMode
          ? `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups/${encodeURIComponent(selectedTrainingGroupId)}`
          : `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups/${encodeURIComponent(selectedTrainingGroupId)}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Неуспешно изтриване на сборния отбор.");
      }

      setTrainingDayDetailsOpen(false);
      setTrainingBulkNoteOpen(false);
      setTrainingDaysEditorOpen(false);
      setTrainingDaysEditorError("");
      setTrainingNoteTargetDates([]);
      const refreshedGroups = isCustomTrainingGroupMode
        ? await loadCustomTrainingGroups()
        : await loadTrainingScheduleGroups();
      const fallbackId = refreshedGroups[0]?.id ?? "";
      setSelectedTrainingGroupId(fallbackId);
      if (trainingAttendanceView === "trainingGroups") {
        if (fallbackId) {
          await fetchTrainingAttendance(undefined, undefined, fallbackId, "trainingGroups");
        } else {
          setTrainingAttendancePlayers([]);
          setTrainingAttendanceStats({ total: 0, attending: 0, optedOut: 0 });
          setTrainingUpcomingDates([]);
          setTrainingAttendanceDate("");
        }
      }
    } catch (error) {
      setTrainingAttendanceError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setTrainingGroupDeleteSaving(false);
      setTrainingGroupDeleteConfirmOpen(false);
    }
  };

  return {
    trainingGroupMode,
    setTrainingGroupMode,
    trainingGroupModeDraft,
    setTrainingGroupModeDraft,
    trainingGroupModeSettingsOpen,
    setTrainingGroupModeSettingsOpen,
    trainingGroupModeSaving,
    trainingGroupModeError,
    setTrainingGroupModeError,
    trainingGroupCreateOpen,
    setTrainingGroupCreateOpen,
    trainingGroupCreateStep,
    setTrainingGroupCreateStep,
    trainingGroupEditPickId,
    setTrainingGroupEditPickId,
    trainingGroupCreateSaving,
    trainingGroupCreateError,
    setTrainingGroupCreateError,
    trainingGroupCreateGroups,
    setTrainingGroupCreateGroups,
    trainingGroupCreateName,
    setTrainingGroupCreateName,
    trainingGroupCreatePlayerIds,
    setTrainingGroupCreatePlayerIds,
    trainingGroupCreateColor,
    setTrainingGroupCreateColor,
    customGroupCreateSearch,
    setCustomGroupCreateSearch,
    trainingGroupEditOpen,
    setTrainingGroupEditOpen,
    trainingGroupEditSaving,
    trainingGroupEditError,
    setTrainingGroupEditError,
    trainingGroupDeleteConfirmOpen,
    setTrainingGroupDeleteConfirmOpen,
    trainingGroupDeleteSaving,
    trainingGroupEditId,
    trainingGroupEditName,
    setTrainingGroupEditName,
    trainingGroupEditGroups,
    setTrainingGroupEditGroups,
    trainingGroupEditPlayerIds,
    setTrainingGroupEditPlayerIds,
    trainingGroupEditColor,
    setTrainingGroupEditColor,
    customGroupEditSearch,
    setCustomGroupEditSearch,
    selectedTrainingGroupId,
    setSelectedTrainingGroupId,
    trainingScheduleGroupsLoading,
    trainingScheduleGroups,
    customTrainingGroups,
    customTrainingGroupColors,
    isCustomTrainingGroupMode,
    customTrainingGroupCoachScope,
    noFreeCustomTrainingGroupColor,
    loadTrainingScheduleGroups,
    loadCustomTrainingGroups,
    saveTrainingGroupMode,
    openTrainingGroupModeSettings,
    openTrainingGroupCreateModal,
    openTrainingGroupEditModal,
    saveTrainingGroupFromModal,
    saveTrainingGroupEditFromModal,
    deleteSelectedTrainingGroup,
  };
}

export type TrainingGroups = ReturnType<typeof useTrainingGroups>;

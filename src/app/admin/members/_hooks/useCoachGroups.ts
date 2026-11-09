"use client";

import { useState } from "react";
import { type CoachGroup } from "../_types/members-page-types";
import { sortByName } from "../_utils/members-page-utils";

type CoachGroupsOptions = {
  clubId: string;
};

export function useCoachGroups({ clubId }: CoachGroupsOptions) {
  const [coachGroups, setCoachGroups] = useState<CoachGroup[]>([]);

  const [coachGroupsPanelOpen, setCoachGroupsPanelOpen] = useState(false);

  const [coachGroupCreateName, setCoachGroupCreateName] = useState("");

  const [coachGroupCreateError, setCoachGroupCreateError] = useState("");

  const [coachGroupCreateSaving, setCoachGroupCreateSaving] = useState(false);

  const [coachGroupDeleteId, setCoachGroupDeleteId] = useState<string | null>(null);

  const [coachGroupDeleteSaving, setCoachGroupDeleteSaving] = useState(false);

  const [coachGroupCopiedId, setCoachGroupCopiedId] = useState<string | null>(null);

  const [coachGroupEditId, setCoachGroupEditId] = useState<string | null>(null);

  const [coachGroupEditName, setCoachGroupEditName] = useState("");

  const [coachGroupEditSaving, setCoachGroupEditSaving] = useState(false);

  const [coachGroupEditError, setCoachGroupEditError] = useState("");

  const loadCoachGroups = async (): Promise<CoachGroup[]> => {
    if (!clubId) return [];
    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups`, {
        cache: "no-store",
      });
      if (!response.ok) return [];
      const payload: unknown = await response.json();
      const groups: CoachGroup[] = Array.isArray(payload)
        ? payload
            .map((item) => {
              const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
              return {
                id: String(raw.id ?? ""),
                name: String(raw.name ?? "").trim(),
                playerCount: typeof raw.playerCount === "number" ? raw.playerCount : 0,
              };
            })
            .filter((g) => g.id && g.name)
        : [];
      const sortedGroups = sortByName(groups);
      setCoachGroups(sortedGroups);
      return sortedGroups;
    } catch {
      return [];
    }
  };

  return {
    coachGroups,
    coachGroupsPanelOpen,
    setCoachGroupsPanelOpen,
    coachGroupCreateName,
    setCoachGroupCreateName,
    coachGroupCreateError,
    setCoachGroupCreateError,
    coachGroupCreateSaving,
    setCoachGroupCreateSaving,
    coachGroupDeleteId,
    setCoachGroupDeleteId,
    coachGroupDeleteSaving,
    setCoachGroupDeleteSaving,
    coachGroupCopiedId,
    setCoachGroupCopiedId,
    coachGroupEditId,
    setCoachGroupEditId,
    coachGroupEditName,
    setCoachGroupEditName,
    coachGroupEditSaving,
    setCoachGroupEditSaving,
    coachGroupEditError,
    setCoachGroupEditError,
    loadCoachGroups,
  };
}

export type CoachGroups = ReturnType<typeof useCoachGroups>;

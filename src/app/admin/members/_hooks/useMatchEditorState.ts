"use client";

import { type MatchEventType } from "@/lib/matchEventType";
import { type MatchResultSnapshot } from "@/lib/matchDetailsUpdate";
import { useState, useRef } from "react";
import { type ClubMatch } from "../_types/members-page-types";

export function useMatchEditorState() {
  const [matchHistoryOpen, setMatchHistoryOpen] = useState(false);

  const [matchCalendarVisibleMonthIdx, setMatchCalendarVisibleMonthIdx] = useState(0);

  const [matchEditorSaving, setMatchEditorSaving] = useState(false);

  const [matchEditorError, setMatchEditorError] = useState("");

  const [matchEventType, setMatchEventType] = useState<MatchEventType | null>(null);

  const [matchSelectedDates, setMatchSelectedDates] = useState<string[]>([]);

  const [matchDetailsPerDay, setMatchDetailsPerDay] = useState<
    Record<
      string,
      {
        description?: string;
        category?: string;
        opponent: string;
        location: string;
        time: string;
        duration: string;
        isHome: boolean | null;
      }
    >
  >({});

  const [matchTeamGroups, setMatchTeamGroups] = useState<number[]>([]);

  const [matchExistingIdByDate, setMatchExistingIdByDate] = useState<Record<string, string>>({});

  const [matchViewPopupOpen, setMatchViewPopupOpen] = useState(false);

  const [matchViewMatch, setMatchViewMatch] = useState<ClubMatch | null>(null);

  const [matchEditTarget, setMatchEditTarget] = useState<ClubMatch | null>(null);

  const [dayDetailsMatchEditOpen, setDayDetailsMatchEditOpen] = useState(false);

  const dayDetailsMatchOriginalResult = useRef<MatchResultSnapshot>({ homeScore: null, awayScore: null });

  const [dayDetailsMatchEditForm, setDayDetailsMatchEditForm] = useState<{
    description: string;
    category: string;
    opponent: string;
    location: string;
    matchDate: string;
    matchTime: string;
    durationMinutes: string;
    isHome: boolean;
    customGroupId: string | null;
    homeScore: string;
    awayScore: string;
  }>({
    description: "",
    category: "",
    homeScore: "",
    awayScore: "",
    opponent: "",
    location: "",
    matchDate: "",
    matchTime: "",
    durationMinutes: "90",
    isHome: true,
    customGroupId: null,
  });

  const [dayDetailsMatchSaving, setDayDetailsMatchSaving] = useState(false);

  const [dayDetailsMatchDeleteConfirm, setDayDetailsMatchDeleteConfirm] = useState(false);

  const [dayDetailsMatchError, setDayDetailsMatchError] = useState("");

  return {
    matchHistoryOpen,
    setMatchHistoryOpen,
    matchCalendarVisibleMonthIdx,
    setMatchCalendarVisibleMonthIdx,
    matchEditorSaving,
    setMatchEditorSaving,
    matchEditorError,
    setMatchEditorError,
    matchEventType,
    setMatchEventType,
    matchSelectedDates,
    setMatchSelectedDates,
    matchDetailsPerDay,
    setMatchDetailsPerDay,
    matchTeamGroups,
    setMatchTeamGroups,
    matchExistingIdByDate,
    setMatchExistingIdByDate,
    matchViewPopupOpen,
    setMatchViewPopupOpen,
    matchViewMatch,
    setMatchViewMatch,
    matchEditTarget,
    setMatchEditTarget,
    dayDetailsMatchEditOpen,
    setDayDetailsMatchEditOpen,
    dayDetailsMatchOriginalResult,
    dayDetailsMatchEditForm,
    setDayDetailsMatchEditForm,
    dayDetailsMatchSaving,
    setDayDetailsMatchSaving,
    dayDetailsMatchDeleteConfirm,
    setDayDetailsMatchDeleteConfirm,
    dayDetailsMatchError,
    setDayDetailsMatchError,
  };
}

export type MatchEditorState = ReturnType<typeof useMatchEditorState>;

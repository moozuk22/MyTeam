"use client";

import { useRef, useState } from "react";
import { DEFAULT_TRAINING_DURATION_MINUTES, getTodayIsoDate } from "../_utils/members-page-utils";
import {
  type TrainingAttendancePlayer,
  type TrainingUpcomingDateItem,
  type TrainingWeekSessionItem,
  type LimitedEventDetail,
} from "../_types/members-page-types";

import type { Schedule2Group, Schedule2Session } from "../_components/Schedule2";
import type { ClubMatch } from "../_types/members-page-types";

export function useTrainingAttendanceState() {
  const [trainingAttendanceOpen, setTrainingAttendanceOpen] = useState(false);

  const [trainingAttendanceHideTeamsTab, setTrainingAttendanceHideTeamsTab] = useState(false);

  const [trainingAttendanceView, setTrainingAttendanceView] = useState<
    "teamGroup" | "trainingGroups" | "today"
  >("today");

  const [trainingAttendanceLoading, setTrainingAttendanceLoading] = useState(false);

  const [trainingAttendanceError, setTrainingAttendanceError] = useState("");

  const [trainingAttendanceDate, setTrainingAttendanceDate] = useState(getTodayIsoDate());

  const [trainingAttendanceSessionId, setTrainingAttendanceSessionId] = useState<string | null>(null);

  const [trainingAttendanceMonth, setTrainingAttendanceMonth] = useState(getTodayIsoDate().slice(0, 7));

  const [trainingAttendancePlayers, setTrainingAttendancePlayers] = useState<TrainingAttendancePlayer[]>([]);

  const [trainingAttendanceStats, setTrainingAttendanceStats] = useState({
    total: 0,
    attending: 0,
    optedOut: 0,
  });

  const [trainingUpcomingDates, setTrainingUpcomingDates] = useState<TrainingUpcomingDateItem[]>([]);

  const [schedule2Open, setSchedule2Open] = useState(false);
  const [schedule2Week, setSchedule2Week] = useState(0);
  const trainingWeekRequest = useRef(0);
  const trainingWeekLoadingRequest = useRef<number | null>(null);
  const trainingAttendanceOpenRequest = useRef(0);
  const [schedule2Groups, setSchedule2Groups] = useState<Schedule2Group[]>([]);
  const [schedule2Matches, setSchedule2Matches] = useState<ClubMatch[]>([]);
  const [schedule2CanCreateTraining, setSchedule2CanCreateTraining] = useState(false);
  const [schedule2Error, setSchedule2Error] = useState("");
  const [trainingWeekSessions, setTrainingWeekSessions] = useState<Schedule2Session[]>([]);

  const [trainingWeekDates, setTrainingWeekDates] = useState<string[]>([]);

  const [trainingWeekLoading, setTrainingWeekLoading] = useState(false);

  const [weekColorFilter, setWeekColorFilter] = useState<string | null>(null);

  const [trainingDayDetailsOpen, setTrainingDayDetailsOpen] = useState(false);

  const [trainingDayDetailsOpening, setTrainingDayDetailsOpening] = useState(false);

  const [trainingDayDetailsViewSnapshot, setTrainingDayDetailsViewSnapshot] = useState<
    "teamGroup" | "trainingGroups" | "today"
  >("today");

  const [trainingDayDurationMinutes, setTrainingDayDurationMinutes] = useState(
    DEFAULT_TRAINING_DURATION_MINUTES,
  );

  const [trainingDayTime, setTrainingDayTime] = useState<string | null>(null);

  const [trainingDayField, setTrainingDayField] = useState<{
    id: string;
    name: string;
    fieldType: string;
    pieces: { id: string; name: string }[];
  } | null>(null);

  const [trainingDayFieldPieceIds, setTrainingDayFieldPieceIds] = useState<string[]>([]);

  const [trainingPlayersExpanded, setTrainingPlayersExpanded] = useState(false);

  const [trainingDayDetailsTab, setTrainingDayDetailsTab] = useState<string>("training");

  const [trainingDayDetailsTabLoading, setTrainingDayDetailsTabLoading] = useState(false);

  const [trainingDaySessionCancelled, setTrainingDaySessionCancelled] = useState(false);

  const [trainingDayCancelLoading, setTrainingDayCancelLoading] = useState(false);

  const [trainingDayCancelConfirmOpen, setTrainingDayCancelConfirmOpen] = useState(false);

  const [limitedEvent, setLimitedEvent] = useState<LimitedEventDetail | null>(null);

  const [limitedEventLoading, setLimitedEventLoading] = useState(false);

  const [limitedSpotsInput, setLimitedSpotsInput] = useState("10");

  const [showLimitedForm, setShowLimitedForm] = useState(false);

  const [limitedEventSaving, setLimitedEventSaving] = useState(false);

  const [limitedEventError, setLimitedEventError] = useState("");

  return {
    schedule2Open,
    setSchedule2Open,
    schedule2Week,
    setSchedule2Week,
    trainingWeekRequest,
    trainingWeekLoadingRequest,
    trainingAttendanceOpenRequest,
    schedule2Groups,
    setSchedule2Groups,
    schedule2Matches,
    setSchedule2Matches,
    schedule2CanCreateTraining,
    setSchedule2CanCreateTraining,
    schedule2Error,
    setSchedule2Error,
    trainingAttendanceOpen,
    setTrainingAttendanceOpen,
    trainingAttendanceHideTeamsTab,
    setTrainingAttendanceHideTeamsTab,
    trainingAttendanceView,
    setTrainingAttendanceView,
    trainingAttendanceLoading,
    setTrainingAttendanceLoading,
    trainingAttendanceError,
    setTrainingAttendanceError,
    trainingAttendanceDate,
    setTrainingAttendanceDate,
    trainingAttendanceSessionId,
    setTrainingAttendanceSessionId,
    trainingAttendanceMonth,
    setTrainingAttendanceMonth,
    trainingAttendancePlayers,
    setTrainingAttendancePlayers,
    trainingAttendanceStats,
    setTrainingAttendanceStats,
    trainingUpcomingDates,
    setTrainingUpcomingDates,
    trainingWeekSessions,
    setTrainingWeekSessions,
    trainingWeekDates,
    setTrainingWeekDates,
    trainingWeekLoading,
    setTrainingWeekLoading,
    weekColorFilter,
    setWeekColorFilter,
    trainingDayDetailsOpen,
    setTrainingDayDetailsOpen,
    trainingDayDetailsOpening,
    setTrainingDayDetailsOpening,
    trainingDayDetailsViewSnapshot,
    setTrainingDayDetailsViewSnapshot,
    trainingDayDurationMinutes,
    setTrainingDayDurationMinutes,
    trainingDayTime,
    setTrainingDayTime,
    trainingDayField,
    setTrainingDayField,
    trainingDayFieldPieceIds,
    setTrainingDayFieldPieceIds,
    trainingPlayersExpanded,
    setTrainingPlayersExpanded,
    trainingDayDetailsTab,
    setTrainingDayDetailsTab,
    trainingDayDetailsTabLoading,
    setTrainingDayDetailsTabLoading,
    trainingDaySessionCancelled,
    setTrainingDaySessionCancelled,
    trainingDayCancelLoading,
    setTrainingDayCancelLoading,
    trainingDayCancelConfirmOpen,
    setTrainingDayCancelConfirmOpen,
    limitedEvent,
    setLimitedEvent,
    limitedEventLoading,
    setLimitedEventLoading,
    limitedSpotsInput,
    setLimitedSpotsInput,
    showLimitedForm,
    setShowLimitedForm,
    limitedEventSaving,
    setLimitedEventSaving,
    limitedEventError,
    setLimitedEventError,
  };
}

export type TrainingAttendanceState = ReturnType<typeof useTrainingAttendanceState>;

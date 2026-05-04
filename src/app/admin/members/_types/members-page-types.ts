type ReportKind = "monthly" | "yearly";

interface ReportPaymentLog {
  id: string;
  paidFor: string;
  paidAt: string;
}

interface ReportPlayer {
  id: string;
  fullName: string;
  teamGroup: number | null;
  paymentLogs: ReportPaymentLog[];
  isActive?: boolean;
}

type PlayerStatus = "paid" | "warning" | "overdue" | "paused";

interface PaymentLog {
  id: string;
  paidFor: string;
  paidAt: string;
}

interface MemberCard {
  cardCode: string;
  isActive: boolean;
}

interface MemberClub {
  id: string;
  name: string;
}

interface ClubOption {
  id: string;
  name: string;
  emblemUrl?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  reminderDay?: number;
  overdueDay?: number;
  reminderHour?: number;
  reminderMinute?: number;
  secondReminderDay?: number | null;
  secondReminderHour?: number | null;
  secondReminderMinute?: number | null;
  overdueHour?: number;
  overdueMinute?: number;
  trainingDates?: string[];
  trainingTime?: string | null;
  trainingDateTimes?: Record<string, string> | null;
  trainingDurationMinutes?: number;
  trainingWeekdays?: number[];
  trainingWindowDays?: number;
  trainingGroupMode?: "team_group" | "custom_group";
  billingStatus?: string;
}

interface Member {
  id: string;
  fullName: string;
  nfcTagId: string;
  status: PlayerStatus;
  teamGroup: number | null;
  coachGroupId: string | null;
  jerseyNumber: string | null;
  avatarUrl: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  birthDate: string | null;
  lastPaymentDate: string | null;
  club?: MemberClub;
  paymentLogs: PaymentLog[];
  cards: MemberCard[];
  isActive: boolean;
}

interface CoachGroup {
  id: string;
  name: string;
  playerCount: number;
}

interface TrainingAttendancePlayer {
  id: string;
  fullName: string;
  teamGroup: number | null;
  cardCode: string | null;
  optedOut: boolean;
}

interface TrainingUpcomingDateItem {
  date: string;
  weekday: number;
  trainingTime?: string | null;
  stats: {
    total: number;
    attending: number;
    optedOut: number;
  };
}

interface TrainingScheduleGroup {
  id: string;
  name: string;
  teamGroups: number[];
  trainingDates: string[];
  trainingTime?: string | null;
  trainingDateTimes?: Record<string, string> | null;
  trainingDurationMinutes?: number;
  trainingFieldId?: string | null;
  trainingFieldPieceIds?: string[];
  trainingFieldSelections?: Record<string, TrainingFieldSelection> | null;
}

interface CustomTrainingGroup {
  id: string;
  name: string;
  playerIds: string[];
  coachGroupId?: string | null;
  trainingDates: string[];
  trainingTime?: string | null;
  trainingDateTimes?: Record<string, string> | null;
  trainingDurationMinutes?: number;
  trainingFieldId?: string | null;
  trainingFieldPieceIds?: string[];
  trainingFieldSelections?: Record<string, TrainingFieldSelection> | null;
}

interface TrainingFieldSelection {
  trainingFieldId: string | null;
  trainingFieldPieceIds: string[];
}

interface TrainingFieldPiece {
  id: string;
  name: string;
  sortOrder: number;
}

interface TrainingField {
  id: string;
  name: string;
  pieces: TrainingFieldPiece[];
}

type TrainingTimeMode = "all" | "perDay" | "byWeekday";

type TrainingDaysStep = "days" | "time" | "field";

interface TrainingTodaySessionItem {
  id: string;
  scopeType: "teamGroup" | "trainingGroup";
  label: string;
  teamGroups: number[];
  stats: {
    total: number;
    attending: number;
    optedOut: number;
  };
}

interface AttendanceReportPlayer {
  id: string;
  fullName: string;
  teamGroup: number | null;
  attendance: Record<string, { present: boolean; reasonCode: string | null }>;
}

interface AttendanceReportData {
  trainingDates: string[];
  players: AttendanceReportPlayer[];
}

interface MemberNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  teamGroup?: number | null;
  trainingGroups?: Array<{
    id: string;
    name: string;
  }>;
}

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
  border: string;
  cls: string;
}

/* ── Import From Sheets Modal ── */

type ImportStep = "browse" | "preview" | "importing" | "results";

type PhotoImportStep = "browse" | "confirm" | "importing" | "results";

type DriveItem = { id: string; name: string; mimeType: string };

type ParsedPlayerRow = {
  rowIndex: number;
  fullName: string;
  birthDateIso: string | null;
  teamGroup: number | null;
  jerseyNumber: string | null;
  warning?: string;
};

type ImportResult = {
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; name: string; reason: string }>;
};

type PhotoImportResult = {
  totalFiles: number;
  totalPlayersScanned: number;
  updated: number;
  unchanged: number;
  skippedExisting: number;
  skippedAmbiguous: number;
  unmatched: number;
  failedUploads: number;
  details: {
    updatedPlayers: Array<{ playerId: string; playerName: string; fileName: string }>;
    unmatchedFiles: string[];
    ambiguousFiles: string[];
    failedFiles: Array<{ fileName: string; reason: string }>;
  };
};

export type {
  ReportKind,
  ReportPaymentLog,
  ReportPlayer,
  PlayerStatus,
  PaymentLog,
  MemberCard,
  MemberClub,
  ClubOption,
  Member,
  CoachGroup,
  TrainingAttendancePlayer,
  TrainingUpcomingDateItem,
  TrainingScheduleGroup,
  CustomTrainingGroup,
  TrainingFieldSelection,
  TrainingFieldPiece,
  TrainingField,
  TrainingTimeMode,
  TrainingDaysStep,
  TrainingTodaySessionItem,
  AttendanceReportPlayer,
  AttendanceReportData,
  MemberNotification,
  StatusMeta,
  ImportStep,
  PhotoImportStep,
  DriveItem,
  ParsedPlayerRow,
  ImportResult,
  PhotoImportResult,
};

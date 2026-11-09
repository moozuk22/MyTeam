export interface MemberProfile {
  playerFields?: string[];
  rank?: string | null;
  weight?: number | null;
  age?: number | null;
  id: string;
  cardCode: string;
  name: string;
  clubId?: string | null;
  clubName?: string | null;
  clubSports?: string | null;
  clubLogoUrl?: string | null;
  clubRulesDocuments?: { id: string; name: string }[];
  paymentWorkflow?:
    | "calendar_month"
    | "rolling_30_days"
    | "training_credits"
    | "training_credits_30_days";
  onlinePaymentEnabled?: boolean;
  defaultOnlineTrainingCredits?: number;
  remainingTrainingCredits?: number;
  avatarUrl?: string | null;
  jerseyNumber?: string | null;
  parentPhone?: string | null;
  playerPhone?: string | null;
  birthDate?: string | null;
  isActive?: boolean;
  team_group?: number | null;
  status?: "paid" | "warning" | "overdue" | "paused";
  last_payment_date?: string | null;
  notifications?: Array<{
    id: string;
    title: string;
    sentAt: string;
  }>;
  paymentLogs?: Array<{
    id: string;
    paidFor: string;
    paidAt: string;
  }>;
  paymentWaivers?: Array<{
    id: string;
    waivedFor: string;
    reason?: string | null;
    createdAt: string;
    createdBy: string;
  }>;
  firstBillingMonth?: string | null;
  isPausedThisMonth?: boolean;
  discounts?: Array<{
    id: string;
    name: string;
    logoUrl: string | null;
    badgeText: string | null;
    code: string | null;
    storeUrl: string | null;
    terms: string[];
    themeColor: string | null;
  }>;
}

export interface LimitedEventInfo {
  id: string;
  maxSpots: number;
  spotsRemaining: number;
  isRegistered: boolean;
  isConfirmed: boolean;
  waitlistPosition: number | null;
}

export interface TrainingSessionItem {
  id?: string;
  groupName?: string;
  optedOut?: boolean;
  optOutReasonCode?: string | null;
  optOutReasonText?: string | null;
  scopeKey: string;
  note?: string;
  trainingTime?: string;
  trainingDurationMinutes?: number;
  trainingFieldName?: string | null;
  trainingFieldType?: string | null;
  trainingFieldPieces?: string[];
  trainingFieldPieceNames?: string[];
  limitedEvent?: LimitedEventInfo | null;
}

export interface TrainingDayStatus {
  date: string;
  weekday: number;
  optedOut: boolean;
  optOutReasonCode?: TrainingOptOutReasonCode | null;
  optOutReasonText?: string | null;
  trainingTime?: string;
  trainingDurationMinutes?: number;
  note: string;
  trainingFieldName?: string | null;
  trainingFieldType?: string | null;
  trainingFieldPieces?: string[];
  trainingFieldPieceNames?: string[];
  limitedEvent?: LimitedEventInfo | null;
  sessions: TrainingSessionItem[];
}

export interface IrisOnlinePayment {
  id: string;
  orderId: string;
  paymentHash: string;
  paymentLink: string;
  shortPaymentLink?: string | null;
  amount: string;
  currency: string;
  status: "WAITING" | "FAILED" | "CONFIRMED";
  qrUrl: string;
}

export type TrainingOptOutReasonCode = "injury" | "sick" | "other";

export type MonthState =
  | "paid"
  | "waived"
  | "deleteSelected"
  | "selected"
  | "next"
  | "available"
  | "disabled";

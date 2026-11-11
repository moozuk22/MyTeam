"use client";

import { MemberTrainingMatchDetails } from "./MemberTrainingMatchDetails";
import { MemberLegacyTrainingAttendance } from "./MemberLegacyTrainingAttendance";

import MemberTrainingSessions from "@/components/MemberTrainingSessions";

import { XIcon } from "./MemberIcons";
import type { MemberTrainingDialogProps } from "./MemberTrainingDialog";
export type MemberTrainingDayDialogProps = Pick<
  MemberTrainingDialogProps,
  | "trainingAttendancePopupOpen"
  | "trainingDetailsItem"
  | "setTrainingAttendancePopupOpen"
  | "trainingDetailsMatches"
  | "trainingDayPopupTab"
  | "setTrainingDayPopupTab"
  | "normalizedCardCode"
  | "fetchTrainingDays"
  | "isTrainingCreditBasedPayment"
  | "member"
  | "registerError"
  | "registerSavingEventId"
  | "setRegisterSavingEventId"
  | "setRegisterError"
  | "setTrainingOptOutReasonCode"
  | "setTrainingOptOutReasonText"
  | "setTrainingConfirmSession"
  | "setTrainingConfirmAction"
  | "setTrainingConfirmModalOpen"
  | "trainingSavingDate"
  | "fetchMemberMatches"
>;
export function MemberTrainingDayDialog({
  trainingAttendancePopupOpen,
  trainingDetailsItem,
  setTrainingAttendancePopupOpen,
  trainingDetailsMatches,
  trainingDayPopupTab,
  setTrainingDayPopupTab,
  normalizedCardCode,
  fetchTrainingDays,
  isTrainingCreditBasedPayment,
  member,
  registerError,
  registerSavingEventId,
  setRegisterSavingEventId,
  setRegisterError,
  setTrainingOptOutReasonCode,
  setTrainingOptOutReasonText,
  setTrainingConfirmSession,
  setTrainingConfirmAction,
  setTrainingConfirmModalOpen,
  trainingSavingDate,
  fetchMemberMatches,
}: MemberTrainingDayDialogProps) {
  return (
    <>
      {trainingAttendancePopupOpen && trainingDetailsItem && (
        <div
          className="pm-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setTrainingAttendancePopupOpen(false);
          }}
        >
          <div
            className="pm-modal member-training-attendance-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="pm-close"
              onClick={() => setTrainingAttendancePopupOpen(false)}
            >
              <XIcon size={16} />
            </button>
            <div className="pm-header">
              <h2 className="pm-title">
                {trainingDetailsMatches.length > 0
                  ? "Детайли за деня"
                  : "Присъствие"}
              </h2>
            </div>
            <div className="pm-divider" />
            {trainingDetailsMatches.length > 0 && (
              <div className="member-day-tabs" aria-label="Детайли за деня">
                <button
                  type="button"
                  className={`member-day-tab${trainingDayPopupTab === "training" ? " member-day-tab--active" : ""}`}
                  onClick={() => setTrainingDayPopupTab("training")}
                >
                  Тренировка
                </button>
                <button
                  type="button"
                  className={`member-day-tab member-day-tab--match${trainingDayPopupTab === "match" ? " member-day-tab--active" : ""}`}
                  onClick={() => setTrainingDayPopupTab("match")}
                >
                  Мач
                </button>
              </div>
            )}
            {trainingDayPopupTab === "training" ? (
              trainingDetailsItem.sessions.some((s) => s.id) ? (
                <MemberTrainingSessions
                  key={trainingDetailsItem.date}
                  date={trainingDetailsItem.date}
                  sessions={trainingDetailsItem.sessions}
                  cardCode={normalizedCardCode}
                  onUpdated={fetchTrainingDays}
                  attendanceEnabled={!isTrainingCreditBasedPayment}
                />
              ) : (
                <MemberLegacyTrainingAttendance
                  trainingDetailsItem={trainingDetailsItem}
                  member={member}
                  registerError={registerError}
                  registerSavingEventId={registerSavingEventId}
                  setRegisterSavingEventId={setRegisterSavingEventId}
                  setRegisterError={setRegisterError}
                  normalizedCardCode={normalizedCardCode}
                  fetchTrainingDays={fetchTrainingDays}
                  isTrainingCreditBasedPayment={isTrainingCreditBasedPayment}
                  setTrainingOptOutReasonCode={setTrainingOptOutReasonCode}
                  setTrainingOptOutReasonText={setTrainingOptOutReasonText}
                  setTrainingConfirmSession={setTrainingConfirmSession}
                  setTrainingConfirmAction={setTrainingConfirmAction}
                  setTrainingConfirmModalOpen={setTrainingConfirmModalOpen}
                  trainingSavingDate={trainingSavingDate}
                />
              )
            ) : (
              <MemberTrainingMatchDetails
                trainingDetailsMatches={trainingDetailsMatches}
                normalizedCardCode={normalizedCardCode}
                fetchMemberMatches={fetchMemberMatches}
              />
            )}
          </div>
        </div>
      )}{" "}
    </>
  );
}

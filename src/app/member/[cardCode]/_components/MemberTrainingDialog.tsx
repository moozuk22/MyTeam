"use client";
import { MemberTrainingDayDialog } from "./MemberTrainingDayDialog";

import { type MemberMatchDetails as MemberMatch } from "@/components/MemberMatchDetailsModal";
import { matchEventTypeLabel } from "@/lib/matchEventType";
import {
  type MemberProfile,
  type TrainingDayStatus,
  type TrainingOptOutReasonCode,
  type TrainingSessionItem,
} from "../_types/member-types";
import {
  TRAINING_WEEKDAY_LABELS_BG,
  TRAINING_WEEKDAY_SHORT_BG,
  addMonths,
} from "../_utils/member-display";
import { XIcon } from "./MemberIcons";

export type MemberTrainingDialogProps = {
  trainingModalOpen: boolean;
  closeTrainingModal: () => void;
  trainingLoading: boolean;
  trainingDays: TrainingDayStatus[];
  memberMatches: MemberMatch[];
  setTrainingCalendarMonth: React.Dispatch<
    React.SetStateAction<{ year: number; month: number }>
  >;
  trainingMonths: { key: string; label: string; cells: (string | null)[] }[];
  trainingByDate: Map<string, TrainingDayStatus>;
  matchesByDate: Map<string, MemberMatch[]>;
  todayDateKey: string;
  setMatchDetailsMatch: React.Dispatch<
    React.SetStateAction<MemberMatch | null>
  >;
  setMatchDetailsPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trainingSavingDate: string | null;
  setTrainingDetailsDate: React.Dispatch<React.SetStateAction<string | null>>;
  setTrainingDayPopupTab: React.Dispatch<
    React.SetStateAction<"match" | "training">
  >;
  setTrainingAttendancePopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trainingError: string | null;
  trainingAttendancePopupOpen: boolean;
  trainingDetailsItem: TrainingDayStatus | null;
  trainingDetailsMatches: MemberMatch[];
  trainingDayPopupTab: "match" | "training";
  normalizedCardCode: string;
  fetchTrainingDays: () => Promise<TrainingDayStatus[]>;
  isTrainingCreditBasedPayment: boolean;
  member: MemberProfile;
  registerError: string | null;
  registerSavingEventId: string | null;
  setRegisterSavingEventId: React.Dispatch<React.SetStateAction<string | null>>;
  setRegisterError: React.Dispatch<React.SetStateAction<string | null>>;
  setTrainingOptOutReasonCode: React.Dispatch<
    React.SetStateAction<"" | TrainingOptOutReasonCode>
  >;
  setTrainingOptOutReasonText: React.Dispatch<React.SetStateAction<string>>;
  setTrainingConfirmSession: React.Dispatch<
    React.SetStateAction<TrainingSessionItem | null>
  >;
  setTrainingConfirmAction: React.Dispatch<
    React.SetStateAction<"attend" | "optOut" | null>
  >;
  setTrainingConfirmModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fetchMemberMatches: () => Promise<void>;
  trainingDaysWithNotes: TrainingDayStatus[];
};

export function MemberTrainingDialog({
  trainingModalOpen,
  closeTrainingModal,
  trainingLoading,
  trainingDays,
  memberMatches,
  setTrainingCalendarMonth,
  trainingMonths,
  trainingByDate,
  matchesByDate,
  todayDateKey,
  setMatchDetailsMatch,
  setMatchDetailsPopupOpen,
  trainingSavingDate,
  setTrainingDetailsDate,
  setTrainingDayPopupTab,
  setTrainingAttendancePopupOpen,
  trainingError,
  trainingAttendancePopupOpen,
  trainingDetailsItem,
  trainingDetailsMatches,
  trainingDayPopupTab,
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
  fetchMemberMatches,
  trainingDaysWithNotes,
}: MemberTrainingDialogProps) {
  return (
    <>
      {trainingModalOpen && (
        <div className="pm-overlay" onClick={closeTrainingModal}>
          <div
            className="pm-modal member-training-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="member-training-modal-tint" aria-hidden="true" />
            <button className="pm-close" onClick={closeTrainingModal}>
              <XIcon size={16} />
            </button>

            <div className="pm-header">
              <span className="member-training-modal-title-gradient">
                Тренировки
              </span>
              <div>
                <h2 className="pm-title">Текущ график</h2>
              </div>
            </div>

            <div className="pm-divider" />

            <div className="training-section" style={{ margin: 0 }}>
              {trainingLoading ? (
                <p className="training-empty">Зареждане...</p>
              ) : trainingDays.length === 0 && memberMatches.length === 0 ? (
                <p className="training-empty">
                  Няма настроени тренировъчни дни.
                </p>
              ) : (
                <>
                  <div className="training-layout">
                    <div className="training-calendar">
                      <div className="training-calendar-month-nav">
                        <button
                          type="button"
                          className="training-calendar-month-nav-btn"
                          onClick={() =>
                            setTrainingCalendarMonth((current) =>
                              addMonths(current, -1),
                            )
                          }
                          aria-label="Предишен месец"
                        >
                          ‹
                        </button>
                        <span className="training-calendar-month-nav-title">
                          {trainingMonths[0]?.label ?? ""}
                        </span>
                        <button
                          type="button"
                          className="training-calendar-month-nav-btn"
                          onClick={() =>
                            setTrainingCalendarMonth((current) =>
                              addMonths(current, 1),
                            )
                          }
                          aria-label="Следващ месец"
                        >
                          ›
                        </button>
                      </div>
                      {trainingMonths.map((month) => (
                        <section
                          key={month.key}
                          className="training-calendar-month"
                        >
                          <h4 className="training-calendar-month-title">
                            {month.label}
                          </h4>
                          <div className="training-calendar-weekdays">
                            {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                              <span
                                key={`${month.key}-${weekday}`}
                                className="training-calendar-weekday"
                              >
                                {weekday}
                              </span>
                            ))}
                          </div>
                          <div className="training-calendar-grid">
                            {month.cells.map((cellDate, index) => {
                              if (!cellDate) {
                                return (
                                  <span
                                    key={`${month.key}-empty-${index}`}
                                    className="training-calendar-cell training-calendar-cell--empty"
                                    aria-hidden="true"
                                  />
                                );
                              }

                              const trainingItem = trainingByDate.get(cellDate);
                              const dayMatches =
                                matchesByDate.get(cellDate) ?? [];
                              const hasMatch = dayMatches.length > 0;
                              const dayNumber = cellDate.slice(8, 10);
                              const isToday = cellDate === todayDateKey;
                              if (!trainingItem && !hasMatch) {
                                return (
                                  <span
                                    key={cellDate}
                                    className={`training-calendar-cell training-calendar-cell--off${isToday ? " training-calendar-cell--today" : ""}`}
                                  >
                                    <span className="training-calendar-day-number">
                                      {dayNumber}
                                    </span>
                                  </span>
                                );
                              }
                              if (!trainingItem && hasMatch) {
                                return (
                                  <button
                                    key={cellDate}
                                    type="button"
                                    className={`training-calendar-cell training-calendar-cell--match${isToday ? " training-calendar-cell--today" : ""}`}
                                    onClick={() => {
                                      setMatchDetailsMatch(dayMatches[0]!);
                                      setMatchDetailsPopupOpen(true);
                                    }}
                                    aria-label={`${matchEventTypeLabel(dayMatches[0]!.eventType)}: ${dayMatches[0]!.opponent}, ${new Date(`${cellDate}T12:00:00.000Z`).toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit" })}`}
                                  >
                                    <span className="training-calendar-day-number">
                                      {dayNumber}
                                    </span>
                                    <span className="training-calendar-time">
                                      {matchEventTypeLabel(
                                        dayMatches[0]!.eventType,
                                      )}{" "}
                                      · {dayMatches[0]!.matchTime}
                                    </span>
                                    {dayMatches.length > 1 && (
                                      <span className="training-calendar-time">
                                        +{dayMatches.length - 1} събития
                                      </span>
                                    )}
                                  </button>
                                );
                              }

                              const isOptedOut = trainingItem!.optedOut;
                              const trainingTimeLabel =
                                trainingItem!.trainingTime?.trim() ?? "";
                              const multiSession =
                                (trainingItem!.sessions?.length ?? 1) > 1;
                              const dateLabel = new Date(
                                `${trainingItem!.date}T12:00:00.000Z`,
                              ).toLocaleDateString("bg-BG", {
                                day: "2-digit",
                                month: "2-digit",
                              });
                              // Priority limited event for badge: confirmed > waitlisted > available > full
                              const allLimitedSessions =
                                trainingItem!.sessions?.filter(
                                  (s) => s.limitedEvent,
                                ) ?? [];
                              const displayLimitedEvent =
                                allLimitedSessions.find(
                                  (s) => s.limitedEvent?.isConfirmed,
                                )?.limitedEvent ??
                                allLimitedSessions.find(
                                  (s) => s.limitedEvent?.isRegistered,
                                )?.limitedEvent ??
                                allLimitedSessions.find(
                                  (s) =>
                                    (s.limitedEvent?.spotsRemaining ?? 0) > 0,
                                )?.limitedEvent ??
                                allLimitedSessions[0]?.limitedEvent ??
                                trainingItem!.limitedEvent ??
                                null;
                              const isSaving =
                                trainingSavingDate === trainingItem!.date;
                              return (
                                <button
                                  key={cellDate}
                                  className={`training-calendar-cell training-calendar-cell--training${isOptedOut ? " training-calendar-cell--opted-out" : ""}${isToday ? " training-calendar-cell--today" : ""}${hasMatch ? " training-calendar-cell--has-match" : ""}`}
                                  onClick={() => {
                                    setTrainingDetailsDate(trainingItem!.date);
                                    setTrainingDayPopupTab("training");
                                    setTrainingAttendancePopupOpen(true);
                                  }}
                                  disabled={Boolean(trainingSavingDate)}
                                  type="button"
                                  aria-label={`${TRAINING_WEEKDAY_LABELS_BG[trainingItem!.weekday] ?? "-"} ${dateLabel}${trainingTimeLabel ? ` ${trainingTimeLabel}` : ""}${multiSession ? " (няколко тренировки)" : ""}`}
                                  aria-pressed={!isOptedOut}
                                >
                                  <span className="training-calendar-day-number">
                                    {dayNumber}
                                  </span>
                                  {trainingTimeLabel && (
                                    <span className="training-calendar-time">
                                      {trainingTimeLabel}
                                      {multiSession ? "+" : ""}
                                    </span>
                                  )}
                                  {displayLimitedEvent && !isSaving ? (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        lineHeight: 1,
                                        color: displayLimitedEvent.isRegistered
                                          ? displayLimitedEvent.isConfirmed
                                            ? "#32cd32"
                                            : "#f0a030"
                                          : displayLimitedEvent.spotsRemaining ===
                                              0
                                            ? "#ff6b6b"
                                            : "#f0a030",
                                      }}
                                    >
                                      {displayLimitedEvent.isRegistered
                                        ? displayLimitedEvent.isConfirmed
                                          ? "✓"
                                          : `#${displayLimitedEvent.waitlistPosition}`
                                        : displayLimitedEvent.spotsRemaining ===
                                            0
                                          ? "Ч"
                                          : `${displayLimitedEvent.spotsRemaining}м`}
                                    </span>
                                  ) : (
                                    <span className="training-calendar-mark">
                                      {isSaving
                                        ? "..."
                                        : isOptedOut
                                          ? "x"
                                          : "✓"}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {trainingError && (
                <p className="training-error">{trainingError}</p>
              )}
              <MemberTrainingDayDialog
                trainingAttendancePopupOpen={trainingAttendancePopupOpen}
                trainingDetailsItem={trainingDetailsItem}
                setTrainingAttendancePopupOpen={setTrainingAttendancePopupOpen}
                trainingDetailsMatches={trainingDetailsMatches}
                trainingDayPopupTab={trainingDayPopupTab}
                setTrainingDayPopupTab={setTrainingDayPopupTab}
                normalizedCardCode={normalizedCardCode}
                fetchTrainingDays={fetchTrainingDays}
                isTrainingCreditBasedPayment={isTrainingCreditBasedPayment}
                member={member}
                registerError={registerError}
                registerSavingEventId={registerSavingEventId}
                setRegisterSavingEventId={setRegisterSavingEventId}
                setRegisterError={setRegisterError}
                setTrainingOptOutReasonCode={setTrainingOptOutReasonCode}
                setTrainingOptOutReasonText={setTrainingOptOutReasonText}
                setTrainingConfirmSession={setTrainingConfirmSession}
                setTrainingConfirmAction={setTrainingConfirmAction}
                setTrainingConfirmModalOpen={setTrainingConfirmModalOpen}
                trainingSavingDate={trainingSavingDate}
                fetchMemberMatches={fetchMemberMatches}
              />
              {false && (
                <div className="training-notes">
                  <p className="training-notes-title">Описание</p>
                  <div className="training-notes-list">
                    {trainingDaysWithNotes.map((item) => (
                      <div
                        key={`note-${item.date}`}
                        className="training-note-row"
                      >
                        <span className="training-note-date">
                          {new Date(
                            `${item.date}T12:00:00.000Z`,
                          ).toLocaleDateString("bg-BG", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                        <span className="training-note-text">{item.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
import { MemberTrainingRegistration } from "./MemberTrainingRegistration";

import {
  formatTrainingDuration,
  normalizeTrainingFieldType,
} from "../_utils/member-display";

import type { MemberTrainingDayDialogProps } from "./MemberTrainingDayDialog";
export type MemberLegacyTrainingAttendanceProps = {
  trainingDetailsItem: NonNullable<
    MemberTrainingDayDialogProps["trainingDetailsItem"]
  >;
  member: MemberTrainingDayDialogProps["member"];
  registerError: MemberTrainingDayDialogProps["registerError"];
  registerSavingEventId: MemberTrainingDayDialogProps["registerSavingEventId"];
  setRegisterSavingEventId: MemberTrainingDayDialogProps["setRegisterSavingEventId"];
  setRegisterError: MemberTrainingDayDialogProps["setRegisterError"];
  normalizedCardCode: MemberTrainingDayDialogProps["normalizedCardCode"];
  fetchTrainingDays: MemberTrainingDayDialogProps["fetchTrainingDays"];
  isTrainingCreditBasedPayment: MemberTrainingDayDialogProps["isTrainingCreditBasedPayment"];
  setTrainingOptOutReasonCode: MemberTrainingDayDialogProps["setTrainingOptOutReasonCode"];
  setTrainingOptOutReasonText: MemberTrainingDayDialogProps["setTrainingOptOutReasonText"];
  setTrainingConfirmSession: MemberTrainingDayDialogProps["setTrainingConfirmSession"];
  setTrainingConfirmAction: MemberTrainingDayDialogProps["setTrainingConfirmAction"];
  setTrainingConfirmModalOpen: MemberTrainingDayDialogProps["setTrainingConfirmModalOpen"];
  trainingSavingDate: MemberTrainingDayDialogProps["trainingSavingDate"];
};
export function MemberLegacyTrainingAttendance({
  trainingDetailsItem,
  member,
  registerError,
  registerSavingEventId,
  setRegisterSavingEventId,
  setRegisterError,
  normalizedCardCode,
  fetchTrainingDays,
  isTrainingCreditBasedPayment,
  setTrainingOptOutReasonCode,
  setTrainingOptOutReasonText,
  setTrainingConfirmSession,
  setTrainingConfirmAction,
  setTrainingConfirmModalOpen,
  trainingSavingDate,
}: MemberLegacyTrainingAttendanceProps) {
  return (
    <>
      <div className="training-attendance-info-card">
        <div className="training-attendance-info-row">
          <span className="training-attendance-info-label">Дата</span>
          <span className="training-attendance-info-value">
            {new Date(
              `${trainingDetailsItem.date}T12:00:00.000Z`,
            ).toLocaleDateString("bg-BG", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </span>
        </div>
        {trainingDetailsItem.sessions.length === 1 && (
          <>
            {trainingDetailsItem.trainingTime?.trim() && (
              <div className="training-attendance-info-row">
                <span className="training-attendance-info-label">Час</span>
                <span className="training-attendance-info-value">
                  {trainingDetailsItem.trainingTime}
                </span>
              </div>
            )}
            {formatTrainingDuration(
              trainingDetailsItem.trainingDurationMinutes,
            ) && (
              <div className="training-attendance-info-row">
                <span className="training-attendance-info-label">
                  Продължителност
                </span>
                <span className="training-attendance-info-value">
                  {formatTrainingDuration(
                    trainingDetailsItem.trainingDurationMinutes,
                  )}
                </span>
              </div>
            )}
            {trainingDetailsItem.trainingFieldName &&
              (() => {
                const pieces = trainingDetailsItem.trainingFieldPieces?.length
                  ? trainingDetailsItem.trainingFieldPieces
                  : trainingDetailsItem.trainingFieldPieceNames?.length
                    ? trainingDetailsItem.trainingFieldPieceNames
                    : ["Цял терен"];
                const selectedPieces =
                  trainingDetailsItem.trainingFieldPieceNames ?? [];
                const isWholeFieldSelected = selectedPieces.length === 0;
                const fieldType = normalizeTrainingFieldType(
                  trainingDetailsItem.trainingFieldType,
                  member?.clubSports,
                );
                return (
                  <div className="member-training-field-visual">
                    <div
                      className={`member-training-field-name${isWholeFieldSelected ? " member-training-field-name--selected" : ""}`}
                    >
                      {trainingDetailsItem.trainingFieldName}
                    </div>
                    <div
                      className={`member-training-field-pitch member-training-field-pitch--${fieldType}`}
                      style={{
                        gridTemplateColumns: `repeat(${pieces.length}, minmax(0, 1fr))`,
                      }}
                      aria-label={`Терен ${trainingDetailsItem.trainingFieldName}`}
                    >
                      {pieces.map((piece, index) => {
                        const isSelected =
                          isWholeFieldSelected ||
                          selectedPieces.includes(piece);
                        return (
                          <div
                            key={`${piece}-${index}`}
                            className={`member-training-field-piece${isSelected ? " member-training-field-piece--selected" : ""}`}
                          >
                            {piece}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
          </>
        )}
      </div>
      {trainingDetailsItem.sessions.length > 1 &&
        trainingDetailsItem.sessions.map((session, sessionIndex) => (
          <div
            key={session.id || session.scopeKey || sessionIndex}
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(255,255,255,0.75)",
                marginBottom:
                  session.trainingTime ||
                  session.trainingDurationMinutes ||
                  session.trainingFieldName
                    ? 8
                    : 0,
              }}
            >
              {session.groupName || `Тренировка ${sessionIndex + 1}`}
              {session.trainingTime ? ` — ${session.trainingTime}` : ""}
            </div>
            {formatTrainingDuration(session.trainingDurationMinutes) && (
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.45)",
                  marginBottom: 6,
                }}
              >
                {formatTrainingDuration(session.trainingDurationMinutes)}
              </div>
            )}
            {session.trainingFieldName &&
              (() => {
                const pieces = session.trainingFieldPieces?.length
                  ? session.trainingFieldPieces
                  : session.trainingFieldPieceNames?.length
                    ? session.trainingFieldPieceNames
                    : ["Цял терен"];
                const selectedPieces = session.trainingFieldPieceNames ?? [];
                const isWholeFieldSelected = selectedPieces.length === 0;
                const fieldType = normalizeTrainingFieldType(
                  session.trainingFieldType,
                  member?.clubSports,
                );
                return (
                  <div
                    className="member-training-field-visual"
                    style={{ marginBottom: 8 }}
                  >
                    <div
                      className={`member-training-field-name${isWholeFieldSelected ? " member-training-field-name--selected" : ""}`}
                    >
                      {session.trainingFieldName}
                    </div>
                    <div
                      className={`member-training-field-pitch member-training-field-pitch--${fieldType}`}
                      style={{
                        gridTemplateColumns: `repeat(${pieces.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {pieces.map((piece, pieceIndex) => {
                        const isSelected =
                          isWholeFieldSelected ||
                          selectedPieces.includes(piece);
                        return (
                          <div
                            key={`${piece}-${pieceIndex}`}
                            className={`member-training-field-piece${isSelected ? " member-training-field-piece--selected" : ""}`}
                          >
                            {piece}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            {session.limitedEvent
              ? (() => {
                  const le = session.limitedEvent!;
                  return (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {registerError && registerSavingEventId === le.id && (
                        <p
                          style={{
                            fontSize: 12,
                            color: "#ff6b6b",
                            margin: 0,
                          }}
                        >
                          {registerError}
                        </p>
                      )}
                      {le.isRegistered ? (
                        <>
                          {le.isConfirmed ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#32cd32",
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Записан
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#f0a030",
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              В чакалня (
                              {le.waitlistPosition === 1
                                ? "следващ"
                                : `#${le.waitlistPosition}`}
                              )
                            </div>
                          )}
                          <button
                            className="pm-btn training-optout-btn"
                            type="button"
                            disabled={registerSavingEventId !== null}
                            onClick={async () => {
                              setRegisterSavingEventId(le.id);
                              setRegisterError(null);
                              try {
                                const res = await fetch(
                                  `/api/members/${normalizedCardCode}/training/register`,
                                  {
                                    method: "DELETE",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      trainingDate: trainingDetailsItem.date,
                                      limitedEventId: le.id,
                                    }),
                                  },
                                );
                                if (!res.ok) {
                                  const d = (await res
                                    .json()
                                    .catch(() => ({}))) as {
                                    error?: string;
                                  };
                                  setRegisterError(
                                    typeof d.error === "string"
                                      ? d.error
                                      : "Грешка при отказване.",
                                  );
                                  return;
                                }
                                await fetchTrainingDays();
                              } catch {
                                setRegisterError("Грешка при отказване.");
                              } finally {
                                setRegisterSavingEventId(null);
                              }
                            }}
                          >
                            {registerSavingEventId === le.id
                              ? "Запазване..."
                              : le.isConfirmed
                                ? "Откажи записването"
                                : "Откажи чакалнята"}
                          </button>
                        </>
                      ) : (
                        <button
                          className="pm-btn training-attend-btn"
                          type="button"
                          disabled={registerSavingEventId !== null}
                          onClick={async () => {
                            setRegisterSavingEventId(le.id);
                            setRegisterError(null);
                            try {
                              const res = await fetch(
                                `/api/members/${normalizedCardCode}/training/register`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    trainingDate: trainingDetailsItem.date,
                                    limitedEventId: le.id,
                                  }),
                                },
                              );
                              if (!res.ok) {
                                const d = (await res
                                  .json()
                                  .catch(() => ({}))) as {
                                  error?: string;
                                };
                                setRegisterError(
                                  typeof d.error === "string"
                                    ? d.error
                                    : "Грешка при записване.",
                                );
                                return;
                              }
                              await fetchTrainingDays();
                            } catch {
                              setRegisterError("Грешка при записване.");
                            } finally {
                              setRegisterSavingEventId(null);
                            }
                          }}
                        >
                          {registerSavingEventId === le.id
                            ? "Запазване..."
                            : le.spotsRemaining > 0
                              ? `Запиши се (${le.spotsRemaining} ${le.spotsRemaining === 1 ? "място" : "места"})`
                              : "Запиши се в чакалнята"}
                        </button>
                      )}
                    </div>
                  );
                })()
              : !isTrainingCreditBasedPayment && (
                  <div
                    className="training-attendance-buttons"
                    style={{ marginTop: 8 }}
                  >
                    <button
                      className={`pm-btn training-attend-btn${!session.optedOut ? " training-btn-selected" : ""}`}
                      type="button"
                      onClick={() => {
                        if (!session.optedOut) return;
                        setTrainingOptOutReasonCode("");
                        setTrainingOptOutReasonText("");
                        setTrainingConfirmSession(session);
                        setTrainingConfirmAction("attend");
                        setTrainingConfirmModalOpen(true);
                      }}
                      disabled={
                        !session.optedOut ||
                        trainingSavingDate === trainingDetailsItem.date
                      }
                    >
                      {!session.optedOut &&
                        trainingSavingDate !== trainingDetailsItem.date && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0 }}
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      {trainingSavingDate === trainingDetailsItem.date
                        ? "Запазване..."
                        : "Присъствам"}
                    </button>
                    <button
                      className={`pm-btn training-optout-btn${session.optedOut ? " training-btn-selected" : ""}`}
                      type="button"
                      onClick={() => {
                        if (session.optedOut) return;
                        setTrainingOptOutReasonCode("");
                        setTrainingOptOutReasonText("");
                        setTrainingConfirmSession(session);
                        setTrainingConfirmAction("optOut");
                        setTrainingConfirmModalOpen(true);
                      }}
                      disabled={
                        session.optedOut ||
                        trainingSavingDate === trainingDetailsItem.date
                      }
                    >
                      {session.optedOut &&
                        trainingSavingDate !== trainingDetailsItem.date && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0 }}
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      {trainingSavingDate === trainingDetailsItem.date
                        ? "Запазване..."
                        : "Отсъствам"}
                    </button>
                  </div>
                )}
            {session.note?.trim() && (
              <div
                className="training-attendance-note-card"
                style={{ marginTop: 8 }}
              >
                <p className="training-attendance-note-label">Описание</p>
                <p className="training-attendance-note-text">{session.note}</p>
              </div>
            )}
          </div>
        ))}
      {trainingDetailsItem.sessions.length === 1 &&
        trainingDetailsItem.note?.trim() && (
          <div className="training-attendance-note-card">
            <p className="training-attendance-note-label">Описание</p>
            <p className="training-attendance-note-text">
              {trainingDetailsItem.note}
            </p>
          </div>
        )}
      {
        <MemberTrainingRegistration
          trainingDetailsItem={trainingDetailsItem}
          isTrainingCreditBasedPayment={isTrainingCreditBasedPayment}
          registerError={registerError}
          registerSavingEventId={registerSavingEventId}
          setRegisterSavingEventId={setRegisterSavingEventId}
          setRegisterError={setRegisterError}
          normalizedCardCode={normalizedCardCode}
          fetchTrainingDays={fetchTrainingDays}
          setTrainingOptOutReasonCode={setTrainingOptOutReasonCode}
          setTrainingOptOutReasonText={setTrainingOptOutReasonText}
          setTrainingConfirmSession={setTrainingConfirmSession}
          setTrainingConfirmAction={setTrainingConfirmAction}
          setTrainingConfirmModalOpen={setTrainingConfirmModalOpen}
          trainingSavingDate={trainingSavingDate}
        />
      }
    </>
  );
}

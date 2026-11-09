"use client";

import type { MemberLegacyTrainingAttendanceProps } from "./MemberLegacyTrainingAttendance";
type Props = {
  trainingDetailsItem: NonNullable<
    MemberLegacyTrainingAttendanceProps["trainingDetailsItem"]
  >;
  isTrainingCreditBasedPayment: MemberLegacyTrainingAttendanceProps["isTrainingCreditBasedPayment"];
  registerError: MemberLegacyTrainingAttendanceProps["registerError"];
  registerSavingEventId: MemberLegacyTrainingAttendanceProps["registerSavingEventId"];
  setRegisterSavingEventId: MemberLegacyTrainingAttendanceProps["setRegisterSavingEventId"];
  setRegisterError: MemberLegacyTrainingAttendanceProps["setRegisterError"];
  normalizedCardCode: MemberLegacyTrainingAttendanceProps["normalizedCardCode"];
  fetchTrainingDays: MemberLegacyTrainingAttendanceProps["fetchTrainingDays"];
  setTrainingOptOutReasonCode: MemberLegacyTrainingAttendanceProps["setTrainingOptOutReasonCode"];
  setTrainingOptOutReasonText: MemberLegacyTrainingAttendanceProps["setTrainingOptOutReasonText"];
  setTrainingConfirmSession: MemberLegacyTrainingAttendanceProps["setTrainingConfirmSession"];
  setTrainingConfirmAction: MemberLegacyTrainingAttendanceProps["setTrainingConfirmAction"];
  setTrainingConfirmModalOpen: MemberLegacyTrainingAttendanceProps["setTrainingConfirmModalOpen"];
  trainingSavingDate: MemberLegacyTrainingAttendanceProps["trainingSavingDate"];
};
export function MemberTrainingRegistration({
  trainingDetailsItem,
  isTrainingCreditBasedPayment,
  registerError,
  registerSavingEventId,
  setRegisterSavingEventId,
  setRegisterError,
  normalizedCardCode,
  fetchTrainingDays,
  setTrainingOptOutReasonCode,
  setTrainingOptOutReasonText,
  setTrainingConfirmSession,
  setTrainingConfirmAction,
  setTrainingConfirmModalOpen,
  trainingSavingDate,
}: Props) {
  return trainingDetailsItem.sessions.length === 1 ? (
    <>
      {(trainingDetailsItem.limitedEvent || !isTrainingCreditBasedPayment) && (
        <p className="training-attendance-choice-label">Заявка</p>
      )}
      {trainingDetailsItem.limitedEvent ? (
        <div
          className="training-attendance-buttons"
          style={{ flexDirection: "column", gap: 10 }}
        >
          {registerError &&
            registerSavingEventId === trainingDetailsItem.limitedEvent.id && (
              <p
                style={{
                  fontSize: 13,
                  color: "#ff6b6b",
                  margin: 0,
                }}
              >
                {registerError}
              </p>
            )}
          {trainingDetailsItem.limitedEvent.isRegistered ? (
            <>
              {trainingDetailsItem.limitedEvent.isConfirmed ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#32cd32",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
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
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#f0a030",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
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
                  {trainingDetailsItem.limitedEvent.waitlistPosition === 1
                    ? "следващ"
                    : `#${trainingDetailsItem.limitedEvent.waitlistPosition}`}
                  )
                </div>
              )}
              <button
                className="pm-btn training-optout-btn"
                type="button"
                disabled={registerSavingEventId !== null}
                onClick={async () => {
                  const le = trainingDetailsItem.limitedEvent;
                  if (!le) return;
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
                      const d = (await res.json().catch(() => ({}))) as {
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
                {registerSavingEventId === trainingDetailsItem.limitedEvent.id
                  ? "Запазване..."
                  : trainingDetailsItem.limitedEvent.isConfirmed
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
                const le = trainingDetailsItem.limitedEvent;
                if (!le) return;
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
                    const d = (await res.json().catch(() => ({}))) as {
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
              {registerSavingEventId === trainingDetailsItem.limitedEvent.id
                ? "Запазване..."
                : trainingDetailsItem.limitedEvent.spotsRemaining > 0
                  ? `Запиши се (${trainingDetailsItem.limitedEvent.spotsRemaining} ${trainingDetailsItem.limitedEvent.spotsRemaining === 1 ? "място" : "места"})`
                  : "Запиши се в чакалнята"}
            </button>
          )}
        </div>
      ) : (
        !isTrainingCreditBasedPayment && (
          <div className="training-attendance-buttons">
            <button
              className={`pm-btn training-attend-btn${!trainingDetailsItem.optedOut ? " training-btn-selected" : ""}`}
              type="button"
              onClick={() => {
                if (!trainingDetailsItem.optedOut) return;
                setTrainingOptOutReasonCode("");
                setTrainingOptOutReasonText("");
                setTrainingConfirmSession(
                  trainingDetailsItem.sessions[0] ?? null,
                );
                setTrainingConfirmAction("attend");
                setTrainingConfirmModalOpen(true);
              }}
              disabled={
                !trainingDetailsItem.optedOut ||
                trainingSavingDate === trainingDetailsItem.date
              }
            >
              {!trainingDetailsItem.optedOut &&
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
              className={`pm-btn training-optout-btn${trainingDetailsItem.optedOut ? " training-btn-selected" : ""}`}
              type="button"
              onClick={() => {
                if (trainingDetailsItem.optedOut) return;
                setTrainingOptOutReasonCode("");
                setTrainingOptOutReasonText("");
                setTrainingConfirmSession(
                  trainingDetailsItem.sessions[0] ?? null,
                );
                setTrainingConfirmAction("optOut");
                setTrainingConfirmModalOpen(true);
              }}
              disabled={
                trainingDetailsItem.optedOut ||
                trainingSavingDate === trainingDetailsItem.date
              }
            >
              {trainingDetailsItem.optedOut &&
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
        )
      )}
    </>
  ) : null;
}

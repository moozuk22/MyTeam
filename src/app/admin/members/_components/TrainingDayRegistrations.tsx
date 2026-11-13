"use client";

import { getScopeKeyFromSessionId } from "../_utils/training-session-scope";

import type { TrainingDayDetailsDialogProps } from "./TrainingDayDetailsDialog";
type Props = {
  trainingDayDetailsTab: TrainingDayDetailsDialogProps["trainingAttendanceState"]["trainingDayDetailsTab"];
  limitedEvent: TrainingDayDetailsDialogProps["trainingAttendanceState"]["limitedEvent"];
  limitedEventLoading: TrainingDayDetailsDialogProps["trainingAttendanceState"]["limitedEventLoading"];
  showLimitedForm: TrainingDayDetailsDialogProps["trainingAttendanceState"]["showLimitedForm"];
  setShowLimitedForm: TrainingDayDetailsDialogProps["trainingAttendanceState"]["setShowLimitedForm"];
  limitedEventSaving: TrainingDayDetailsDialogProps["trainingAttendanceState"]["limitedEventSaving"];
  limitedEventError: TrainingDayDetailsDialogProps["trainingAttendanceState"]["limitedEventError"];
  limitedSpotsInput: TrainingDayDetailsDialogProps["trainingAttendanceState"]["limitedSpotsInput"];
  setLimitedSpotsInput: TrainingDayDetailsDialogProps["trainingAttendanceState"]["setLimitedSpotsInput"];
  clubId: TrainingDayDetailsDialogProps["clubId"];
  setLimitedEventError: TrainingDayDetailsDialogProps["trainingAttendanceState"]["setLimitedEventError"];
  setLimitedEventSaving: TrainingDayDetailsDialogProps["trainingAttendanceState"]["setLimitedEventSaving"];
  fetchLimitedEventForSession: TrainingDayDetailsDialogProps["fetchLimitedEventForSession"];
  trainingAttendanceDate: TrainingDayDetailsDialogProps["trainingAttendanceState"]["trainingAttendanceDate"];
  setLimitedEvent: TrainingDayDetailsDialogProps["trainingAttendanceState"]["setLimitedEvent"];
};
export function TrainingDayRegistrations({
  trainingDayDetailsTab,
  limitedEvent,
  limitedEventLoading,
  showLimitedForm,
  setShowLimitedForm,
  limitedEventSaving,
  limitedEventError,
  limitedSpotsInput,
  setLimitedSpotsInput,
  clubId,
  setLimitedEventError,
  setLimitedEventSaving,
  fetchLimitedEventForSession,
  trainingAttendanceDate,
  setLimitedEvent,
}: Props) {
  const activeScopeKey = getScopeKeyFromSessionId(trainingDayDetailsTab);
  if (!activeScopeKey) return null;
  return (
    <div
      style={{
        marginTop: 20,
        borderTop: "1px solid rgba(255,255,255,0.1)",
        paddingTop: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          Ограничени места
        </span>
        {!limitedEvent && !limitedEventLoading && !showLimitedForm && (
          <button
            type="button"
            className="amp-btn amp-btn--sm amp-btn--ghost"
            onClick={() => setShowLimitedForm(true)}
            disabled={limitedEventSaving}
          >
            + Ограничи броя места
          </button>
        )}
      </div>
      {limitedEventLoading && (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          Зареждане...
        </p>
      )}
      {limitedEventError && (
        <p style={{ fontSize: 13, color: "#ff6b6b", marginBottom: 8 }}>
          {limitedEventError}
        </p>
      )}
      {!limitedEventLoading && limitedEvent && (
        <div>
          {(() => {
            const confirmed = limitedEvent.registrations.filter(
              (r) => r.isConfirmed,
            );
            const waitlisted = limitedEvent.registrations.filter(
              (r) => !r.isConfirmed,
            );
            return (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#32cd32",
                      background: "rgba(50,205,50,0.12)",
                      border: "1px solid rgba(50,205,50,0.35)",
                      borderRadius: 6,
                      padding: "3px 10px",
                    }}
                  >
                    {confirmed.length}/{limitedEvent.maxSpots} записани
                  </span>
                  {waitlisted.length > 0 && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#f0a030",
                        background: "rgba(240,160,48,0.12)",
                        border: "1px solid rgba(240,160,48,0.35)",
                        borderRadius: 6,
                        padding: "3px 10px",
                      }}
                    >
                      {waitlisted.length} в чакалня
                    </span>
                  )}
                  {limitedEvent.spotsRemaining > 0 && (
                    <span
                      style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}
                    >
                      {limitedEvent.spotsRemaining} свободни
                    </span>
                  )}
                </div>
                {confirmed.length > 0 && (
                  <ol
                    style={{
                      margin: "0 0 8px 0",
                      padding: "0 0 0 18px",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.78)",
                    }}
                  >
                    {confirmed.map((r) => (
                      <li key={r.playerId} style={{ marginBottom: 3 }}>
                        {r.fullName}{" "}
                        <span
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 11,
                          }}
                        >
                          {new Date(r.registeredAt).toLocaleTimeString(
                            "bg-BG",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                {waitlisted.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#f0a030",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 4,
                      }}
                    >
                      Чакалня
                    </div>
                    <ol
                      start={limitedEvent.maxSpots + 1}
                      style={{
                        margin: "0 0 12px 0",
                        padding: "0 0 0 18px",
                        fontSize: 13,
                        color: "rgba(255,255,255,0.55)",
                      }}
                    >
                      {waitlisted.map((r) => (
                        <li key={r.playerId} style={{ marginBottom: 3 }}>
                          {r.fullName}{" "}
                          <span
                            style={{
                              color: "rgba(255,255,255,0.3)",
                              fontSize: 11,
                            }}
                          >
                            {new Date(r.registeredAt).toLocaleTimeString(
                              "bg-BG",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            );
          })()}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              min={1}
              max={200}
              value={limitedSpotsInput}
              onChange={(e) => setLimitedSpotsInput(e.target.value)}
              style={{
                width: 70,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.07)",
                color: "#fff",
                fontSize: 13,
              }}
              disabled={limitedEventSaving}
            />
            <button
              type="button"
              className="amp-btn amp-btn--sm amp-btn--primary"
              disabled={limitedEventSaving}
              onClick={async () => {
                if (!clubId || !limitedEvent) return;
                const maxSpots = parseInt(limitedSpotsInput, 10);
                if (
                  !Number.isInteger(maxSpots) ||
                  maxSpots < 1 ||
                  maxSpots > 200
                ) {
                  setLimitedEventError(
                    "Броят места трябва да е между 1 и 200.",
                  );
                  return;
                }
                setLimitedEventSaving(true);
                setLimitedEventError("");
                try {
                  const res = await fetch(
                    `/api/admin/clubs/${encodeURIComponent(clubId)}/limited-training-events/${encodeURIComponent(limitedEvent.id)}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ maxSpots }),
                    },
                  );
                  if (!res.ok) {
                    const d = (await res.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    setLimitedEventError(
                      typeof d.error === "string"
                        ? d.error
                        : "Грешка при запазване.",
                    );
                    return;
                  }
                  await fetchLimitedEventForSession(
                    trainingAttendanceDate ?? "",
                    trainingDayDetailsTab,
                  );
                } catch {
                  setLimitedEventError("Грешка при запазване.");
                } finally {
                  setLimitedEventSaving(false);
                }
              }}
            >
              Промени места
            </button>
            <button
              type="button"
              className="amp-btn amp-btn--sm amp-btn--danger"
              disabled={limitedEventSaving}
              onClick={async () => {
                if (!clubId || !limitedEvent) return;
                setLimitedEventSaving(true);
                setLimitedEventError("");
                try {
                  const res = await fetch(
                    `/api/admin/clubs/${encodeURIComponent(clubId)}/limited-training-events/${encodeURIComponent(limitedEvent.id)}`,
                    {
                      method: "DELETE",
                    },
                  );
                  if (!res.ok) {
                    const d = (await res.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    setLimitedEventError(
                      typeof d.error === "string"
                        ? d.error
                        : "Грешка при изтриване.",
                    );
                    return;
                  }
                  setLimitedEvent(null);
                  setLimitedSpotsInput("10");
                } catch {
                  setLimitedEventError("Грешка при изтриване.");
                } finally {
                  setLimitedEventSaving(false);
                }
              }}
            >
              Деактивирай
            </button>
          </div>
        </div>
      )}
      {!limitedEventLoading && !limitedEvent && showLimitedForm && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={1}
            max={200}
            value={limitedSpotsInput}
            onChange={(e) => setLimitedSpotsInput(e.target.value)}
            placeholder="Брой места"
            style={{
              width: 100,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.07)",
              color: "#fff",
              fontSize: 13,
            }}
            disabled={limitedEventSaving}
          />
          <button
            type="button"
            className="amp-btn amp-btn--sm amp-btn--primary"
            disabled={limitedEventSaving}
            onClick={async () => {
              if (!clubId || !trainingAttendanceDate) return;
              const maxSpots = parseInt(limitedSpotsInput, 10);
              if (
                !Number.isInteger(maxSpots) ||
                maxSpots < 1 ||
                maxSpots > 200
              ) {
                setLimitedEventError("Броят места трябва да е между 1 и 200.");
                return;
              }
              const scopeKey = getScopeKeyFromSessionId(trainingDayDetailsTab);
              if (!scopeKey) return;
              const teamGroupMatch = scopeKey.match(/^team_group:(\d+)$/);
              const teamGroup = teamGroupMatch
                ? parseInt(teamGroupMatch[1], 10)
                : null;
              const scopeId = scopeKey.startsWith("custom_group:") ? scopeKey.split(":")[1] : null;
              setLimitedEventSaving(true);
              setLimitedEventError("");
              try {
                const res = await fetch(
                  `/api/admin/clubs/${encodeURIComponent(clubId)}/limited-training-events`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      scopeKey,
                      scopeId,
                      teamGroup,
                      trainingDate: trainingAttendanceDate,
                      maxSpots,
                    }),
                  },
                );
                if (!res.ok) {
                  const d = (await res.json().catch(() => ({}))) as {
                    error?: string;
                  };
                  setLimitedEventError(
                    typeof d.error === "string"
                      ? d.error
                      : "Грешка при създаване.",
                  );
                  return;
                }
                setShowLimitedForm(false);
                await fetchLimitedEventForSession(
                  trainingAttendanceDate,
                  trainingDayDetailsTab,
                );
              } catch {
                setLimitedEventError("Грешка при създаване.");
              } finally {
                setLimitedEventSaving(false);
              }
            }}
          >
            Запази
          </button>
          <button
            type="button"
            className="amp-btn amp-btn--sm amp-btn--ghost"
            onClick={() => {
              setShowLimitedForm(false);
              setLimitedEventError("");
            }}
            disabled={limitedEventSaving}
          >
            Отказ
          </button>
        </div>
      )}
    </div>
  );
}

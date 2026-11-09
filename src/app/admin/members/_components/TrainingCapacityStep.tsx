"use client";

import { formatIsoDateForDisplay } from "../_utils/members-page-utils";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type Props = {
  form: Pick<
    TrainingDaysForm,
    | "trainingDaysEditorMode"
    | "canShowTrainingDaysSpotsStep"
    | "effectiveTrainingDaysActiveStep"
    | "schedulerPerDayLimited"
    | "schedulerLimitedMode"
    | "setSchedulerLimitedMode"
    | "trainingDaysEditorSaving"
    | "schedulerLimitedSpots"
    | "setSchedulerLimitedSpots"
    | "normalizedTrainingDaysSelection"
    | "schedulerPerDayConfig"
    | "setSchedulerPerDayConfig"
    | "setSchedulerPerDayLimited"
  >;
};

export function TrainingCapacityStep({ form }: Props) {
  const {
    trainingDaysEditorMode,
    canShowTrainingDaysSpotsStep,
    effectiveTrainingDaysActiveStep,
    schedulerPerDayLimited,
    schedulerLimitedMode,
    setSchedulerLimitedMode,
    trainingDaysEditorSaving,
    schedulerLimitedSpots,
    setSchedulerLimitedSpots,
    normalizedTrainingDaysSelection,
    schedulerPerDayConfig,
    setSchedulerPerDayConfig,
    setSchedulerPerDayLimited,
  } = form;
  return (
    <>
      {trainingDaysEditorMode !== "createGroup" &&
        canShowTrainingDaysSpotsStep &&
        effectiveTrainingDaysActiveStep === "spots" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8, order: 2 }}>
            <span className="amp-lbl" style={{ textAlign: "center" }}>
              Режим на присъствие
            </span>
            {!schedulerPerDayLimited && (
              <>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={{
                      flex: "1 1 160px",
                      maxWidth: 220,
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: `2px solid ${!schedulerLimitedMode ? "rgba(102,187,106,0.8)" : "rgba(255,255,255,0.15)"}`,
                      background: !schedulerLimitedMode ? "rgba(102,187,106,0.12)" : "rgba(255,255,255,0.04)",
                      color: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onClick={() => setSchedulerLimitedMode(false)}
                    disabled={trainingDaysEditorSaving}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Всички участват</div>
                    <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.4 }}>
                      Всеки активен състезател е маркиран като присъстващ по подразбиране.
                    </div>
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: "1 1 160px",
                      maxWidth: 220,
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: `2px solid ${schedulerLimitedMode ? "rgba(240,160,48,0.8)" : "rgba(255,255,255,0.15)"}`,
                      background: schedulerLimitedMode ? "rgba(240,160,48,0.10)" : "rgba(255,255,255,0.04)",
                      color: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onClick={() => setSchedulerLimitedMode(true)}
                    disabled={trainingDaysEditorSaving}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Ограничен брой места</div>
                    <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.4 }}>
                      Състезателите се записват сами. Само записаните участват.
                    </div>
                  </button>
                </div>
                {schedulerLimitedMode && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      justifyContent: "center",
                      marginTop: 4,
                    }}
                  >
                    <label style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Брой места:</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={schedulerLimitedSpots}
                      onChange={(e) => setSchedulerLimitedSpots(e.target.value)}
                      style={{
                        width: 80,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.07)",
                        color: "#fff",
                        fontSize: 14,
                      }}
                      disabled={trainingDaysEditorSaving}
                    />
                  </div>
                )}
              </>
            )}
            {schedulerPerDayLimited && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {normalizedTrainingDaysSelection.map((date) => {
                  const cfg = schedulerPerDayConfig[date] ?? {
                    limited: false,
                    spots: schedulerLimitedSpots,
                  };
                  const spotsNum = parseInt(cfg.spots, 10);
                  const spotsInvalid =
                    cfg.limited && (!Number.isInteger(spotsNum) || spotsNum < 1 || spotsNum > 200);
                  return (
                    <div
                      key={date}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                        {formatIsoDateForDisplay(date)}
                      </span>
                      <button
                        type="button"
                        disabled={trainingDaysEditorSaving}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          border: `1.5px solid ${!cfg.limited ? "rgba(102,187,106,0.8)" : "rgba(255,255,255,0.15)"}`,
                          background: !cfg.limited ? "rgba(102,187,106,0.15)" : "rgba(255,255,255,0.05)",
                          color: "#fff",
                        }}
                        onClick={() =>
                          setSchedulerPerDayConfig((prev) => ({
                            ...prev,
                            [date]: {
                              limited: false,
                              spots: prev[date]?.spots ?? schedulerLimitedSpots,
                            },
                          }))
                        }
                      >
                        Всички
                      </button>
                      <button
                        type="button"
                        disabled={trainingDaysEditorSaving}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          border: `1.5px solid ${cfg.limited ? "rgba(240,160,48,0.8)" : "rgba(255,255,255,0.15)"}`,
                          background: cfg.limited ? "rgba(240,160,48,0.12)" : "rgba(255,255,255,0.05)",
                          color: "#fff",
                        }}
                        onClick={() =>
                          setSchedulerPerDayConfig((prev) => ({
                            ...prev,
                            [date]: {
                              limited: true,
                              spots: prev[date]?.spots ?? schedulerLimitedSpots,
                            },
                          }))
                        }
                      >
                        Ограничено
                      </button>
                      {cfg.limited && (
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={cfg.spots}
                          disabled={trainingDaysEditorSaving}
                          onChange={(e) =>
                            setSchedulerPerDayConfig((prev) => ({
                              ...prev,
                              [date]: { limited: true, spots: e.target.value },
                            }))
                          }
                          style={{
                            width: 60,
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: `1px solid ${spotsInvalid ? "rgba(229,57,53,0.7)" : "rgba(255,255,255,0.2)"}`,
                            background: "rgba(255,255,255,0.07)",
                            color: "#fff",
                            fontSize: 13,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {normalizedTrainingDaysSelection.length > 1 && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
                <label
                  className={`amp-group-check-chip${schedulerPerDayLimited ? " is-selected" : ""}${trainingDaysEditorSaving ? " is-disabled" : ""}`}
                  style={{ fontSize: 13 }}
                >
                  <input
                    className="amp-group-check-input"
                    type="checkbox"
                    checked={schedulerPerDayLimited}
                    disabled={trainingDaysEditorSaving}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setSchedulerPerDayLimited(on);
                      if (on) {
                        const init: Record<string, { limited: boolean; spots: string }> = {};
                        for (const d of normalizedTrainingDaysSelection) {
                          init[d] = {
                            limited: schedulerLimitedMode,
                            spots: schedulerLimitedSpots,
                          };
                        }
                        setSchedulerPerDayConfig(init);
                      }
                    }}
                  />
                  <span className="amp-group-check-box" aria-hidden="true" />
                  Различна настройка за всеки ден
                </label>
              </div>
            )}
          </div>
        )}
    </>
  );
}

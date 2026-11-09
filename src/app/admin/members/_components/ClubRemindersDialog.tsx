"use client";

import type * as React from "react";
import { TimeInput } from "@/components/TimeInput";
import { XIcon } from "./members-page-icons";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";

type ClubRemindersDialogProps = {
  trainingDaysForm: Pick<TrainingDaysForm, "schedulerForm" | "setSchedulerForm">;
  schedulerSettingsOpen: boolean;
  schedulerSettingsSaving: boolean;
  setSchedulerSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  schedulerSettingsLoading: boolean;
  reminderTimeValue: string;
  secondReminderEnabled: boolean;
  enableSecondReminder: () => void;
  secondReminderTimeValue: string;
  disableSecondReminder: () => void;
  thirdReminderEnabled: boolean;
  enableThirdReminder: () => void;
  thirdReminderTimeValue: string;
  disableThirdReminder: () => void;
  overdueTimeValue: string;
  schedulerSettingsError: string;
  saveSchedulerSettings: () => Promise<void>;
};

export function ClubRemindersDialog({
  trainingDaysForm,
  schedulerSettingsOpen,
  schedulerSettingsSaving,
  setSchedulerSettingsOpen,
  schedulerSettingsLoading,
  reminderTimeValue,
  secondReminderEnabled,
  enableSecondReminder,
  secondReminderTimeValue,
  disableSecondReminder,
  thirdReminderEnabled,
  enableThirdReminder,
  thirdReminderTimeValue,
  disableThirdReminder,
  overdueTimeValue,
  schedulerSettingsError,
  saveSchedulerSettings,
}: ClubRemindersDialogProps) {
  const { schedulerForm, setSchedulerForm } = trainingDaysForm;
  return (
    <>
      {schedulerSettingsOpen && (
        <div
          className="amp-overlay"
          onClick={() => {
            if (!schedulerSettingsSaving) {
              setSchedulerSettingsOpen(false);
            }
          }}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span
                className="amp-modal-title-gradient"
                style={{ flex: 1, textAlign: "center", paddingLeft: "32px" }}
              >
                Месечно напомняне
              </span>
              <button
                className="amp-modal-close"
                onClick={() => setSchedulerSettingsOpen(false)}
                aria-label="Затвори"
                disabled={schedulerSettingsSaving}
              >
                <XIcon />
              </button>
            </h2>

            <div className="amp-modal-body">
              {schedulerSettingsLoading ? (
                <p className="amp-empty amp-empty--modal">Зареждане...</p>
              ) : (
                <div className="amp-edit-grid">
                  <label className="amp-edit-field amp-scheduler-primary-day" style={{ textAlign: "center" }}>
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      Ден месечно напомняне (1-28)
                    </span>
                    <input
                      className="amp-edit-input"
                      style={{ textAlign: "center" }}
                      inputMode="numeric"
                      value={schedulerForm.reminderDay}
                      onChange={(e) =>
                        setSchedulerForm((prev) => ({
                          ...prev,
                          reminderDay: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      disabled={schedulerSettingsSaving}
                    />
                  </label>
                  <label className="amp-edit-field amp-scheduler-overdue-day" style={{ textAlign: "center" }}>
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      Ден за начало на платежния месец
                    </span>
                    <input
                      className="amp-edit-input"
                      style={{ textAlign: "center" }}
                      inputMode="numeric"
                      value={schedulerForm.overdueDay}
                      onChange={(e) =>
                        setSchedulerForm((prev) => ({
                          ...prev,
                          overdueDay: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      disabled={schedulerSettingsSaving}
                    />
                  </label>
                  <label
                    className="amp-edit-field amp-scheduler-primary-time"
                    style={{ textAlign: "center" }}
                  >
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      Час за месечно напомняне
                    </span>
                    <div
                      className="amp-edit-input"
                      style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}
                    >
                      <TimeInput
                        className="amp-inner-time-input"
                        step={60}
                        value={reminderTimeValue}
                        onValueChange={(value) => {
                          const [hour = "0", minute = "0"] = value.split(":");
                          setSchedulerForm((prev) => ({
                            ...prev,
                            reminderHour: hour.replace(/\D/g, ""),
                            reminderMinute: minute.replace(/\D/g, ""),
                          }));
                        }}
                        disabled={schedulerSettingsSaving}
                      />
                    </div>
                  </label>
                  <div
                    className="amp-edit-field amp-edit-field--full amp-scheduler-section-title amp-scheduler-section-title--second"
                    style={{ textAlign: "center" }}
                  >
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      Второ напомняне (по избор)
                    </span>
                  </div>
                  {!secondReminderEnabled ? (
                    <div
                      className="amp-edit-field amp-edit-field--full amp-scheduler-second-toggle"
                      style={{ textAlign: "center" }}
                    >
                      <span className="amp-lbl" style={{ textAlign: "center" }}>
                        Второ месечно напомняне
                      </span>
                      <button
                        className="amp-btn amp-btn--ghost amp-btn--compact"
                        style={{ width: "100%", justifyContent: "center" }}
                        type="button"
                        onClick={enableSecondReminder}
                        disabled={schedulerSettingsSaving}
                      >
                        Добави второ напомняне
                      </button>
                    </div>
                  ) : (
                    <>
                      <label
                        className="amp-edit-field amp-scheduler-second-day"
                        style={{ textAlign: "center" }}
                      >
                        <span className="amp-lbl" style={{ textAlign: "center" }}>
                          Ден второ месечно напомняне (1-28)
                        </span>
                        <input
                          className="amp-edit-input"
                          style={{ textAlign: "center" }}
                          inputMode="numeric"
                          value={schedulerForm.secondReminderDay}
                          onChange={(e) =>
                            setSchedulerForm((prev) => ({
                              ...prev,
                              secondReminderDay: e.target.value.replace(/\D/g, ""),
                            }))
                          }
                          disabled={schedulerSettingsSaving}
                        />
                      </label>
                      <label
                        className="amp-edit-field amp-scheduler-second-time"
                        style={{ textAlign: "center" }}
                      >
                        <span className="amp-lbl" style={{ textAlign: "center" }}>
                          Час за второ месечно напомняне
                        </span>
                        <div
                          className="amp-edit-input"
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            padding: 0,
                          }}
                        >
                          <TimeInput
                            className="amp-inner-time-input"
                            step={60}
                            value={secondReminderTimeValue}
                            onValueChange={(value) => {
                              const [hour = "0", minute = "0"] = value.split(":");
                              setSchedulerForm((prev) => ({
                                ...prev,
                                secondReminderHour: hour.replace(/\D/g, ""),
                                secondReminderMinute: minute.replace(/\D/g, ""),
                              }));
                            }}
                            disabled={schedulerSettingsSaving}
                          />
                        </div>
                      </label>
                      <div
                        className="amp-edit-field amp-edit-field--full amp-scheduler-second-remove"
                        style={{ textAlign: "center" }}
                      >
                        <span className="amp-lbl" style={{ textAlign: "center" }}>
                          Опция
                        </span>
                        <button
                          className="amp-btn amp-btn--ghost amp-btn--compact"
                          style={{ width: "100%", justifyContent: "center" }}
                          type="button"
                          onClick={disableSecondReminder}
                          disabled={schedulerSettingsSaving}
                        >
                          Премахни второто напомняне
                        </button>
                      </div>
                    </>
                  )}
                  {secondReminderEnabled && (
                    <>
                      <div
                        className="amp-edit-field amp-edit-field--full amp-scheduler-section-title amp-scheduler-section-title--third"
                        style={{ textAlign: "center" }}
                      >
                        <span className="amp-lbl" style={{ textAlign: "center" }}>
                          Трето напомняне (по избор)
                        </span>
                      </div>
                      {!thirdReminderEnabled ? (
                        <div
                          className="amp-edit-field amp-edit-field--full amp-scheduler-third-toggle"
                          style={{ textAlign: "center" }}
                        >
                          <span className="amp-lbl" style={{ textAlign: "center" }}>
                            Трето месечно напомняне
                          </span>
                          <button
                            className="amp-btn amp-btn--ghost amp-btn--compact"
                            style={{ width: "100%", justifyContent: "center" }}
                            type="button"
                            onClick={enableThirdReminder}
                            disabled={schedulerSettingsSaving}
                          >
                            Добави трето напомняне
                          </button>
                        </div>
                      ) : (
                        <>
                          <label
                            className="amp-edit-field amp-scheduler-third-day"
                            style={{ textAlign: "center" }}
                          >
                            <span className="amp-lbl" style={{ textAlign: "center" }}>
                              Ден трето месечно напомняне (1-28)
                            </span>
                            <input
                              className="amp-edit-input"
                              style={{ textAlign: "center" }}
                              inputMode="numeric"
                              value={schedulerForm.thirdReminderDay}
                              onChange={(e) =>
                                setSchedulerForm((prev) => ({
                                  ...prev,
                                  thirdReminderDay: e.target.value.replace(/\D/g, ""),
                                }))
                              }
                              disabled={schedulerSettingsSaving}
                            />
                          </label>
                          <label
                            className="amp-edit-field amp-scheduler-third-time"
                            style={{ textAlign: "center" }}
                          >
                            <span className="amp-lbl" style={{ textAlign: "center" }}>
                              Час за трето месечно напомняне
                            </span>
                            <div
                              className="amp-edit-input"
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                padding: 0,
                              }}
                            >
                              <TimeInput
                                className="amp-inner-time-input"
                                step={60}
                                value={thirdReminderTimeValue}
                                onValueChange={(value) => {
                                  const [hour = "0", minute = "0"] = value.split(":");
                                  setSchedulerForm((prev) => ({
                                    ...prev,
                                    thirdReminderHour: hour.replace(/\D/g, ""),
                                    thirdReminderMinute: minute.replace(/\D/g, ""),
                                  }));
                                }}
                                disabled={schedulerSettingsSaving}
                              />
                            </div>
                          </label>
                          <div
                            className="amp-edit-field amp-edit-field--full amp-scheduler-third-remove"
                            style={{ textAlign: "center" }}
                          >
                            <span className="amp-lbl" style={{ textAlign: "center" }}>
                              Опция
                            </span>
                            <button
                              className="amp-btn amp-btn--ghost amp-btn--compact"
                              style={{ width: "100%", justifyContent: "center" }}
                              type="button"
                              onClick={disableThirdReminder}
                              disabled={schedulerSettingsSaving}
                            >
                              Премахни третото напомняне
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  <div
                    className="amp-edit-field amp-edit-field--full amp-scheduler-section-title amp-scheduler-section-title--overdue"
                    style={{ textAlign: "center" }}
                  >
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      Просрочие
                    </span>
                  </div>
                  <label
                    className="amp-edit-field amp-scheduler-overdue-time"
                    style={{ textAlign: "center" }}
                  >
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      Час за просрочие
                    </span>
                    <div
                      className="amp-edit-input"
                      style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}
                    >
                      <TimeInput
                        className="amp-inner-time-input"
                        step={60}
                        value={overdueTimeValue}
                        onValueChange={(value) => {
                          const [hour = "0", minute = "0"] = value.split(":");
                          setSchedulerForm((prev) => ({
                            ...prev,
                            overdueHour: hour.replace(/\D/g, ""),
                            overdueMinute: minute.replace(/\D/g, ""),
                          }));
                        }}
                        disabled={schedulerSettingsSaving}
                      />
                    </div>
                  </label>
                </div>
              )}

              {schedulerSettingsError && (
                <p className="amp-confirm-error" style={{ textAlign: "center" }}>
                  {schedulerSettingsError}
                </p>
              )}

              <div className="amp-modal-actions" style={{ justifyContent: "center" }}>
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setSchedulerSettingsOpen(false)}
                  disabled={schedulerSettingsSaving}
                >
                  Отказ
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveSchedulerSettings()}
                  disabled={schedulerSettingsSaving || schedulerSettingsLoading}
                >
                  {schedulerSettingsSaving ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

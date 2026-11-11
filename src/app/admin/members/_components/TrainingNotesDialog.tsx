"use client";

import type * as React from "react";
import { matchEventTypeLabel } from "@/lib/matchEventType";
import { XIcon } from "./members-page-icons";
import { TRAINING_WEEKDAY_SHORT_BG, formatIsoDateForDisplay } from "../_utils/members-page-utils";
import { type TrainingUpcomingDateItem, type ClubMatch } from "../_types/members-page-types";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";

type TrainingNotesDialogProps = {
  trainingDaysForm: Pick<TrainingDaysForm, "toggleTrainingNoteTargetDate">;
  trainingAttendanceState: Pick<TrainingAttendanceState, "trainingAttendanceError">;
  trainingBulkNoteOpen: boolean;
  setTrainingBulkNoteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trainingNoteSaving: boolean;
  trainingAttendanceCalendarMonths: { key: string; label: string; cells: Array<string | null> }[];
  trainingUpcomingByDate: Map<string, TrainingUpcomingDateItem>;
  trainingAttendanceMatchesByDate: Map<string, ClubMatch[]>;
  trainingUpcomingDateSet: Set<string>;
  trainingNoteTargetDates: string[];
  todayIsoDate: string;
  trainingNote: string;
  setTrainingNote: React.Dispatch<React.SetStateAction<string>>;
  isTrainingNoteSameAsExisting: boolean;
  saveTrainingNote: () => Promise<void>;
  trainingNoteComparisonLoading: boolean;
  effectiveTrainingNoteTargetDates: string[];
};

export function TrainingNotesDialog({
  trainingDaysForm,
  trainingAttendanceState,
  trainingBulkNoteOpen,
  setTrainingBulkNoteOpen,
  trainingNoteSaving,
  trainingAttendanceCalendarMonths,
  trainingUpcomingByDate,
  trainingAttendanceMatchesByDate,
  trainingUpcomingDateSet,
  trainingNoteTargetDates,
  todayIsoDate,
  trainingNote,
  setTrainingNote,
  isTrainingNoteSameAsExisting,
  saveTrainingNote,
  trainingNoteComparisonLoading,
  effectiveTrainingNoteTargetDates,
}: TrainingNotesDialogProps) {
  const { toggleTrainingNoteTargetDate } = trainingDaysForm;
  const { trainingAttendanceError } = trainingAttendanceState;
  return (
    <>
      {trainingBulkNoteOpen && (
        <div className="amp-overlay amp-overlay--confirm" onClick={() => setTrainingBulkNoteOpen(false)}>
          <div
            className="amp-modal amp-modal--confirm amp-modal--training-note"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Добави описание</span>
              <button
                className="amp-modal-close"
                onClick={() => setTrainingBulkNoteOpen(false)}
                aria-label="Затвори"
                disabled={trainingNoteSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body" style={{ position: "relative" }}>
              {trainingNoteSaving && (
                <div
                  className="amp-modal-loading-overlay"
                  style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(16,16,20,0.9)" }}
                >
                  <div className="amp-loading" style={{ minHeight: 200 }}>
                    <div className="amp-spinner" />
                    <p style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                      Запазване...
                    </p>
                  </div>
                </div>
              )}
              <label className="amp-edit-field">
                <span className="amp-lbl">Избери дни</span>
                <div className="amp-training-calendar amp-training-calendar--attendance">
                  {trainingAttendanceCalendarMonths.map((month) => (
                    <div key={month.key} className="amp-training-month">
                      <div className="amp-training-month-title">{month.label}</div>
                      <div className="amp-training-weekdays-row">
                        {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                          <span key={`${month.key}-${weekday}`} className="amp-training-weekday-cell">
                            {weekday}
                          </span>
                        ))}
                      </div>
                      <div className="amp-training-month-grid">
                        {month.cells.map((date, index) => {
                          if (!date) {
                            return (
                              <span
                                key={`${month.key}-empty-${index}`}
                                className="amp-training-calendar-cell amp-training-calendar-cell--empty"
                                aria-hidden="true"
                              />
                            );
                          }
                          const dayNumber = Number.parseInt(date.slice(8, 10), 10);
                          const dateData = trainingUpcomingByDate.get(date);
                          const matchesForDate = trainingAttendanceMatchesByDate.get(date) ?? [];
                          const hasMatch = matchesForDate.length > 0;
                          if ((!dateData || !trainingUpcomingDateSet.has(date)) && !hasMatch) {
                            return (
                              <span
                                key={date}
                                className="amp-training-calendar-cell amp-training-calendar-cell--disabled"
                                aria-hidden="true"
                              >
                                <span className="amp-training-day-number">{dayNumber}</span>
                              </span>
                            );
                          }
                          if (!dateData && hasMatch) {
                            return (
                              <span
                                key={date}
                                className="amp-training-date-btn amp-training-date-btn--calendar-match-only"
                                aria-label={`${matchEventTypeLabel(matchesForDate[0]?.eventType)} на ${formatIsoDateForDisplay(date)}`}
                              >
                                <span className="amp-training-day-number">{dayNumber}</span>
                                {matchesForDate[0]?.matchTime && (
                                  <span className="amp-training-day-match">
                                    {matchEventTypeLabel(matchesForDate[0].eventType)} ·{" "}
                                    {matchesForDate[0].matchTime}
                                  </span>
                                )}
                                <span className="amp-training-day-match amp-training-day-match--location">
                                  {matchesForDate[0]?.isHome ? "Д" : "Г"}
                                </span>
                              </span>
                            );
                          }

                          const isSelected = trainingNoteTargetDates.includes(date);
                          const isToday = todayIsoDate === date;
                          const trainingTimeLabel =
                            dateData!.trainingCount || dateData!.sessions?.length
                              ? ""
                              : (dateData!.trainingTime?.trim() ?? "");
                          const hasTrainingAndMatch = hasMatch;
                          return (
                            <button
                              key={date}
                              type="button"
                              className={`amp-training-date-btn amp-training-date-btn--training${hasTrainingAndMatch ? " amp-training-date-btn--training-match" : ""}${isSelected ? " amp-training-date-btn--selected" : ""}${isToday ? " amp-training-date-btn--today" : ""}`}
                              onClick={() => toggleTrainingNoteTargetDate(date)}
                              disabled={trainingNoteSaving}
                            >
                              <span className="amp-training-day-number">{dayNumber}</span>
                              {hasTrainingAndMatch && matchesForDate[0]?.matchTime && (
                                <span className="amp-training-day-match">
                                  {matchEventTypeLabel(matchesForDate[0].eventType)} ·{" "}
                                  {matchesForDate[0].matchTime}
                                </span>
                              )}
                              {hasTrainingAndMatch && (
                                <span className="amp-training-day-match amp-training-day-match--location">
                                  {matchesForDate[0]?.isHome ? "Д" : "Г"}
                                </span>
                              )}
                              {!hasTrainingAndMatch && trainingTimeLabel && (
                                <span className="amp-training-day-time">{trainingTimeLabel}</span>
                              )}
                              {!hasTrainingAndMatch && (
                                <span className="amp-training-day-meta">
                                  {dateData!.trainingCount || dateData!.sessions?.length
                                    ? `${dateData!.trainingCount || dateData!.sessions?.length} трен.`
                                    : `${dateData!.stats.attending}/${dateData!.stats.total}`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </label>
              <label className="amp-edit-field">
                <span className="amp-lbl">Описание</span>
                <textarea
                  className="amp-edit-input amp-training-note"
                  value={trainingNote}
                  onChange={(e) => setTrainingNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Добавете инструкции, сборен час, локация..."
                  disabled={trainingNoteSaving}
                />
              </label>
              {trainingAttendanceError && <p className="amp-confirm-error">{trainingAttendanceError}</p>}
              {isTrainingNoteSameAsExisting && !trainingAttendanceError && (
                <p className="amp-confirm-error">Описанието е същото като предишното за избраната дата.</p>
              )}
              <div className="amp-modal-actions">
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setTrainingBulkNoteOpen(false)}
                  disabled={trainingNoteSaving}
                >
                  Отказ
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  onClick={() => void saveTrainingNote()}
                  disabled={
                    trainingNoteSaving ||
                    trainingNoteComparisonLoading ||
                    effectiveTrainingNoteTargetDates.length === 0 ||
                    isTrainingNoteSameAsExisting
                  }
                >
                  {trainingNoteSaving
                    ? "Запазване..."
                    : `Запази описание за ${effectiveTrainingNoteTargetDates.length} ден(дни)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

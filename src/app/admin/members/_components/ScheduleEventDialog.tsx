"use client";

import type * as React from "react";
import { TimeInput } from "@/components/TimeInput";
import MatchExtraFields from "@/components/MatchExtraFields";
import { MATCH_EVENT_TYPES, matchEventTypeLabel, type MatchEventType } from "@/lib/matchEventType";
import MatchOverlapWarning from "@/components/MatchOverlapWarning";
import { XIcon } from "./members-page-icons";
import { TRAINING_WEEKDAY_SHORT_BG, formatIsoDateForDisplay } from "../_utils/members-page-utils";
import {
  type TrainingScheduleGroup,
  type CustomTrainingGroup,
  type ClubMatch,
} from "../_types/members-page-types";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";
import { type MatchEditorState } from "../_hooks/useMatchEditorState";

import type { Schedule2Group } from "./Schedule2";

type ScheduleEventDialogProps = {
  schedule2EventTarget: { groupId: string; date?: string } | null;
  schedule2EventGroup: Schedule2Group | undefined;
  schedule2CanCreateTraining: boolean;
  openTrainingDaysEditor: (
    mode: "customGroup", editDate: undefined, coachTarget: undefined,
    customTarget: { group: Schedule2Group; date?: string },
  ) => Promise<void>;
  matchEditorState: Pick<
    MatchEditorState,
    | "matchEditorSaving"
    | "matchEventType"
    | "setMatchTeamGroups"
    | "setMatchSelectedDates"
    | "setMatchDetailsPerDay"
    | "setMatchExistingIdByDate"
    | "setMatchEventType"
    | "matchSelectedDates"
    | "setMatchEditorError"
    | "setMatchCalendarVisibleMonthIdx"
    | "matchCalendarVisibleMonthIdx"
    | "matchTeamGroups"
    | "matchDetailsPerDay"
    | "matchEditorError"
  >;
  trainingAttendanceState: Pick<TrainingAttendanceState, "trainingAttendanceView">;
  trainingGroups: Pick<TrainingGroups, "isCustomTrainingGroupMode">;
  scheduleEventModalOpen: boolean;
  setScheduleEventModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setScheduleEventStep: React.Dispatch<
    React.SetStateAction<"type" | "match-type" | "match-days" | "match-details">
  >;
  scheduleEventStep: "type" | "match-type" | "match-days" | "match-details";
  openTrainingDaysEditorForCurrentScope: () => Promise<void>;
  selectedTrainingGroup: TrainingScheduleGroup | null;
  selectedTeamGroup: number | null;
  selectedCustomGroup: CustomTrainingGroup | null;
  matchCalendarMonthsTrimmed: { cells: (string | null)[]; key: string; label: string }[];
  matchCalendarMonths: { key: string; label: string; cells: Array<string | null> }[];
  matchCalendarDateSet: Set<string>;
  matchCalendarMatchesByDate: Map<string, ClubMatch[]>;
  toggleMatchDate: (date: string) => void;
  clubId: string;
  handleSaveMatch: () => Promise<void>;
};

export function ScheduleEventDialog({
  schedule2EventTarget,
  schedule2EventGroup,
  schedule2CanCreateTraining,
  openTrainingDaysEditor,
  matchEditorState,
  trainingAttendanceState,
  trainingGroups,
  scheduleEventModalOpen,
  setScheduleEventModalOpen,
  setScheduleEventStep,
  scheduleEventStep,
  openTrainingDaysEditorForCurrentScope,
  selectedTrainingGroup,
  selectedTeamGroup,
  selectedCustomGroup,
  matchCalendarMonthsTrimmed,
  matchCalendarMonths,
  matchCalendarDateSet,
  matchCalendarMatchesByDate,
  toggleMatchDate,
  clubId,
  handleSaveMatch,
}: ScheduleEventDialogProps) {
  const {
    matchEditorSaving,
    matchEventType,
    setMatchTeamGroups,
    setMatchSelectedDates,
    setMatchDetailsPerDay,
    setMatchExistingIdByDate,
    setMatchEventType,
    matchSelectedDates,
    setMatchEditorError,
    setMatchCalendarVisibleMonthIdx,
    matchCalendarVisibleMonthIdx,
    matchTeamGroups,
    matchDetailsPerDay,
    matchEditorError,
  } = matchEditorState;
  const { trainingAttendanceView } = trainingAttendanceState;
  const { isCustomTrainingGroupMode } = trainingGroups;
  const customTrainingUnavailable = Boolean(schedule2EventTarget &&
    (!schedule2EventGroup || !schedule2CanCreateTraining));
  return (
    <>
      {scheduleEventModalOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!matchEditorSaving) {
              setScheduleEventModalOpen(false);
              setScheduleEventStep("type");
            }
          }}
        >
          <div
            className={`amp-modal amp-modal--confirm${scheduleEventStep !== "type" ? " amp-modal--match-editor" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">
                {scheduleEventStep === "type"
                  ? "Насрочи събитие"
                  : scheduleEventStep === "match-type"
                    ? "Избери вид събитие"
                    : matchEventTypeLabel(matchEventType)}
              </span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setScheduleEventModalOpen(false);
                  setScheduleEventStep("type");
                }}
                aria-label="Затвори"
                disabled={matchEditorSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {scheduleEventStep === "type" ? (
                <div className={schedule2EventTarget ? "amp-schedule-event-type-picker amp-schedule-event-type-picker--schedule2" : "amp-schedule-event-type-picker"}>
                  <button
                    type="button"
                    className="amp-btn amp-schedule-event-type-btn"
                    disabled={customTrainingUnavailable}
                    onClick={() => {
                      if (customTrainingUnavailable) return;
                      setScheduleEventModalOpen(false);
                      if (schedule2EventGroup) {
                        void openTrainingDaysEditor("customGroup", undefined, undefined, {
                          group: schedule2EventGroup,
                          date: schedule2EventTarget?.date,
                        });
                      } else {
                        void openTrainingDaysEditorForCurrentScope();
                      }
                    }}
                  >
                    <span
                      className="amp-schedule-event-type-icon amp-schedule-event-type-icon--training"
                      aria-hidden="true"
                    />
                    Тренировка
                  </button>
                  {schedule2EventTarget && !schedule2CanCreateTraining && (
                    <p className="amp-lbl">Тренировки за персонализирани групи могат да се добавят в режим „Персонализирани групи“.</p>
                  )}
                  <button
                    type="button"
                    className="amp-btn amp-schedule-event-type-btn amp-schedule-event-type-btn--match"
                    onClick={() => {
                      const scopeTeamGroups =
                        trainingAttendanceView === "trainingGroups" && !isCustomTrainingGroupMode
                          ? (selectedTrainingGroup?.teamGroups ?? [])
                          : selectedTeamGroup !== null
                            ? [selectedTeamGroup]
                            : [];
                      setMatchTeamGroups(schedule2EventTarget ? [] : scopeTeamGroups);
                      const date = schedule2EventTarget?.date;
                      const selectedDate = date && matchCalendarDateSet.has(date) ? date : undefined;
                      setMatchSelectedDates(selectedDate ? [selectedDate] : []);
                      if (selectedDate) {
                        const monthIndex = matchCalendarMonthsTrimmed.findIndex((month) => month.cells.includes(selectedDate));
                        setMatchCalendarVisibleMonthIdx(Math.max(0, monthIndex));
                      }
                      setMatchDetailsPerDay({});
                      setMatchExistingIdByDate({});
                      setMatchEventType(null);
                      setScheduleEventStep("match-type");
                    }}
                  >
                    <span
                      className="amp-schedule-event-type-icon amp-schedule-event-type-icon--match"
                      aria-hidden="true"
                    />
                    Мач / Двубой / Състезание / Участие
                  </button>
                  {schedule2EventTarget && (
                    <button type="button" className="amp-btn amp-schedule-event-type-btn">
                      <span
                        className="amp-schedule-event-type-icon amp-schedule-event-type-icon--rest"
                        aria-hidden="true"
                      />
                      Почивен ден
                    </button>
                  )}
                </div>
              ) : scheduleEventStep === "match-type" ? (
                <>
                  <p className="amp-lbl" style={{ textAlign: "center" }}>
                    Изберете вида на събитието
                  </p>
                  <div className="amp-match-event-types">
                    {(Object.entries(MATCH_EVENT_TYPES) as [MatchEventType, string][]).map(
                      ([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className="amp-btn amp-btn--primary"
                          onClick={() => {
                            setMatchEventType(value);
                            setScheduleEventStep(schedule2EventTarget?.date ? "match-details" : "match-days");
                          }}
                        >
                          {label}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="amp-modal-actions amp-modal-actions--end">
                    <button
                      type="button"
                      className="amp-btn amp-btn--ghost"
                      onClick={() => setScheduleEventStep("type")}
                    >
                      Назад
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {schedule2EventTarget ? <p className="amp-lbl">{schedule2EventGroup?.name}</p> : <>
                  <div
                    className="amp-training-days-editor-header"
                    style={{ flexDirection: "column", alignItems: "center", textAlign: "center" }}
                  >
                    <span className="amp-lbl" style={{ textAlign: "center" }}>
                      {trainingAttendanceView === "trainingGroups" && !isCustomTrainingGroupMode
                        ? `${matchEventTypeLabel(matchEventType)} за сборен отбор`
                        : trainingAttendanceView === "trainingGroups" && isCustomTrainingGroupMode
                          ? `${matchEventTypeLabel(matchEventType)} за персонализирана група`
                          : matchEventTypeLabel(matchEventType)}
                    </span>
                    {scheduleEventStep === "match-days" && (
                      <span className="amp-lbl" style={{ textAlign: "center" }}>
                        Избрани: {matchSelectedDates.length}
                      </span>
                    )}
                  </div>
                  <div
                    className="amp-training-days-editor-header"
                    style={{
                      marginTop: "8px",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      className="amp-lbl"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        border: "1px solid rgba(249,115,22,0.45)",
                        background: "rgba(249,115,22,0.16)",
                        color: "#fed7aa",
                        fontWeight: 700,
                        textAlign: "center",
                        width: "100%",
                      }}
                    >
                      {trainingAttendanceView === "trainingGroups" && !isCustomTrainingGroupMode
                        ? `Сборен отбор: ${selectedTrainingGroup?.name ?? "-"}`
                        : trainingAttendanceView === "trainingGroups" && isCustomTrainingGroupMode
                          ? `Персонализирана група: ${selectedCustomGroup?.name ?? "-"}`
                          : selectedTeamGroup === null
                            ? "Набор: Всички"
                            : `Набор: ${selectedTeamGroup}`}
                    </span>
                    <span style={{ textAlign: "center" }}>
                      {trainingAttendanceView === "trainingGroups" && !isCustomTrainingGroupMode
                        ? `Този мач ще се вижда от сборен отбор ${selectedTrainingGroup?.name ?? "-"}.`
                        : trainingAttendanceView === "trainingGroups" && isCustomTrainingGroupMode
                          ? `Този мач ще се вижда от персонализирана група ${selectedCustomGroup?.name ?? "-"}.`
                          : selectedTeamGroup === null
                            ? "Този мач ще се вижда от всички набори."
                            : `Този мач ще се вижда от набор ${selectedTeamGroup}.`}
                    </span>
                  </div>
                  </>}
                  <div className="amp-training-stepper" aria-label="Стъпки за мач">
                    <button
                      type="button"
                      className={`amp-training-step${scheduleEventStep === "match-days" ? " is-active" : " is-complete"}`}
                      onClick={() => {
                        setScheduleEventStep("match-days");
                        setMatchEditorError("");
                      }}
                      disabled={matchEditorSaving}
                    >
                      <span className="amp-training-step-index">1</span>
                      {schedule2EventTarget?.date ? "Още дати" : "Дни"}
                    </button>
                    <button
                      type="button"
                      className={`amp-training-step${scheduleEventStep === "match-details" ? " is-active" : ""}`}
                      onClick={() => {
                        if (matchSelectedDates.length > 0) {
                          setScheduleEventStep("match-details");
                          setMatchEditorError("");
                        }
                      }}
                      disabled={matchEditorSaving || matchSelectedDates.length === 0}
                    >
                      <span className="amp-training-step-index">2</span>
                      Детайли
                    </button>
                  </div>
                  {scheduleEventStep === "match-days" && (
                    <>
                      <div className="amp-training-calendar" style={{ order: 1 }}>
                        {matchCalendarMonthsTrimmed.length > 1 && (
                          <div className="amp-training-month-nav">
                            <button
                              type="button"
                              className="amp-training-month-nav-btn"
                              onClick={() => setMatchCalendarVisibleMonthIdx((i) => Math.max(0, i - 1))}
                              disabled={matchCalendarVisibleMonthIdx === 0}
                              aria-label="Предишен месец"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              className="amp-training-month-nav-btn"
                              onClick={() =>
                                setMatchCalendarVisibleMonthIdx((i) =>
                                  Math.min(matchCalendarMonthsTrimmed.length - 1, i + 1),
                                )
                              }
                              disabled={matchCalendarVisibleMonthIdx === matchCalendarMonths.length - 1}
                              aria-label="Следващ месец"
                            >
                              ›
                            </button>
                          </div>
                        )}
                        {matchCalendarMonthsTrimmed
                          .slice(matchCalendarVisibleMonthIdx, matchCalendarVisibleMonthIdx + 1)
                          .map((month) => (
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
                                  if (!matchCalendarDateSet.has(date)) {
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
                                  const isSelected = matchSelectedDates.includes(date);
                                  const matchesForDate = (matchCalendarMatchesByDate.get(date) ?? []).filter(
                                    (m) => {
                                      if (schedule2EventTarget) return m.customGroupId === schedule2EventGroup?.id;
                                      if (m.customGroupId !== null) {
                                        return (
                                          isCustomTrainingGroupMode &&
                                          m.customGroupId === selectedCustomGroup?.id
                                        );
                                      }
                                      return (
                                        matchTeamGroups.length === 0 ||
                                        m.teamGroups.length === 0 ||
                                        m.teamGroups.some((tg) => matchTeamGroups.includes(tg))
                                      );
                                    },
                                  );
                                  return (
                                    <button
                                      key={date}
                                      type="button"
                                      className={`amp-training-date-btn amp-training-date-btn--match${matchesForDate.length > 0 ? " amp-training-date-btn--has-match" : ""}${isSelected ? " amp-training-date-btn--active" : ""}`}
                                      onClick={() => toggleMatchDate(date)}
                                      disabled={matchEditorSaving}
                                    >
                                      <span className="amp-training-day-number">{dayNumber}</span>
                                      {matchesForDate.slice(0, 2).map((match) => (
                                        <span key={match.id} className="amp-training-day-match">
                                          {matchEventTypeLabel(match.eventType)} · {match.matchTime}{" "}
                                          {match.opponent}
                                        </span>
                                      ))}
                                      {matchesForDate.length > 2 && (
                                        <span className="amp-training-day-match">
                                          +{matchesForDate.length - 2}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                      <div className="amp-modal-actions amp-modal-actions--end" style={{ order: 2 }}>
                        <button
                          type="button"
                          className="amp-btn amp-btn--ghost"
                          onClick={() => {
                            setScheduleEventStep("match-type");
                            setMatchEditorError("");
                          }}
                          disabled={matchEditorSaving}
                        >
                          Назад
                        </button>
                        <button
                          type="button"
                          className="amp-btn amp-btn--primary amp-btn--match"
                          onClick={() => {
                            setScheduleEventStep("match-details");
                            setMatchEditorError("");
                          }}
                          disabled={matchEditorSaving || matchSelectedDates.length === 0}
                        >
                          Напред
                        </button>
                      </div>
                    </>
                  )}
                  {scheduleEventStep === "match-details" && (
                    <>
                      <div className="amp-training-step-summary">
                        <span className="amp-training-step-summary-label">Избрани дни</span>
                        <span className="amp-training-step-summary-value">
                          {matchSelectedDates.map((d) => formatIsoDateForDisplay(d)).join(", ")}
                        </span>
                      </div>
                      <div className="amp-match-details-per-day">
                        {matchSelectedDates.map((date) => {
                          const details = matchDetailsPerDay[date] ?? {
                            opponent: "",
                            location: "",
                            time: "",
                            duration: "90",
                            isHome: null,
                          };
                          return (
                            <div key={date} className="amp-match-day-section">
                              <span className="amp-lbl amp-match-day-label">
                                {formatIsoDateForDisplay(date)}
                              </span>
                              <MatchExtraFields
                                description={details.description ?? ""}
                                category={details.category ?? ""}
                                disabled={matchEditorSaving}
                                onChange={(fields) =>
                                  setMatchDetailsPerDay((prev) => ({
                                    ...prev,
                                    [date]: { ...details, ...fields },
                                  }))
                                }
                              />
                              <label className="amp-edit-field">
                                <span className="amp-lbl">Час</span>
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
                                    value={details.time}
                                    onValueChange={(value) =>
                                      setMatchDetailsPerDay((prev) => ({
                                        ...prev,
                                        [date]: { ...details, time: value },
                                      }))
                                    }
                                    disabled={matchEditorSaving}
                                  />
                                </div>
                              </label>
                              <label className="amp-edit-field">
                                <span className="amp-lbl">Продължителност (мин.)</span>
                                <input
                                  className="amp-edit-input"
                                  type="number"
                                  min={1}
                                  max={1440}
                                  value={details.duration}
                                  onChange={(e) =>
                                    setMatchDetailsPerDay((prev) => ({
                                      ...prev,
                                      [date]: { ...details, duration: e.target.value },
                                    }))
                                  }
                                  disabled={matchEditorSaving}
                                />
                              </label>
                              {clubId && (
                                <MatchOverlapWarning
                                  clubId={clubId}
                                  date={date}
                                  time={details.time}
                                  duration={details.duration}
                                  isHome={details.isHome}
                                />
                              )}
                              <div className="amp-edit-field">
                                <span className="amp-lbl">Домакин / Гост</span>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    type="button"
                                    className={`amp-btn${details.isHome === true ? " amp-btn--primary" : " amp-btn--ghost"}`}
                                    onClick={() =>
                                      setMatchDetailsPerDay((prev) => ({
                                        ...prev,
                                        [date]: { ...details, isHome: details.isHome === true ? null : true },
                                      }))
                                    }
                                    disabled={matchEditorSaving}
                                  >
                                    Домакин
                                  </button>
                                  <button
                                    type="button"
                                    className={`amp-btn${details.isHome === false ? " amp-btn--primary" : " amp-btn--ghost"}`}
                                    onClick={() =>
                                      setMatchDetailsPerDay((prev) => ({
                                        ...prev,
                                        [date]: {
                                          ...details,
                                          isHome: details.isHome === false ? null : false,
                                        },
                                      }))
                                    }
                                    disabled={matchEditorSaving}
                                  >
                                    Гост
                                  </button>
                                </div>
                              </div>
                              <label className="amp-edit-field">
                                <span className="amp-lbl">Съперник</span>
                                <input
                                  className="amp-edit-input"
                                  type="text"
                                  value={details.opponent}
                                  onChange={(e) =>
                                    setMatchDetailsPerDay((prev) => ({
                                      ...prev,
                                      [date]: { ...details, opponent: e.target.value },
                                    }))
                                  }
                                  placeholder="Съперник"
                                  maxLength={200}
                                  disabled={matchEditorSaving}
                                />
                              </label>
                              <label className="amp-edit-field">
                                <span className="amp-lbl">Място</span>
                                <input
                                  className="amp-edit-input"
                                  type="text"
                                  value={details.location}
                                  onChange={(e) =>
                                    setMatchDetailsPerDay((prev) => ({
                                      ...prev,
                                      [date]: { ...details, location: e.target.value },
                                    }))
                                  }
                                  placeholder="Стадион / адрес"
                                  maxLength={200}
                                  disabled={matchEditorSaving}
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      {matchEditorError && <p className="amp-confirm-error">{matchEditorError}</p>}
                      <div className="amp-modal-actions amp-modal-actions--end">
                        <button
                          type="button"
                          className="amp-btn amp-btn--ghost"
                          onClick={() => {
                            setScheduleEventStep("match-days");
                            setMatchEditorError("");
                          }}
                          disabled={matchEditorSaving}
                        >
                          Назад
                        </button>
                        <button
                          type="button"
                          className="amp-btn amp-btn--primary amp-btn--match"
                          onClick={() => void handleSaveMatch()}
                          disabled={
                            matchEditorSaving ||
                            Boolean(schedule2EventTarget && !schedule2EventGroup) ||
                            !matchSelectedDates.every((d) => {
                              const det = matchDetailsPerDay[d];
                              return det?.category && det?.location?.trim() && det?.time;
                            })
                          }
                        >
                          {matchEditorSaving
                            ? "Запазване..."
                            : matchSelectedDates.length > 1
                              ? `Запази ${matchSelectedDates.length} събития`
                              : "Запази събитие"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

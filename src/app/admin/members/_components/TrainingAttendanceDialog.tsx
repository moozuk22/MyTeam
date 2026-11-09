"use client";

import type * as React from "react";
import { matchEventTypeLabel } from "@/lib/matchEventType";
import { XIcon } from "./members-page-icons";
import { TRAINING_WEEKDAY_SHORT_BG, formatIsoDateForDisplay } from "../_utils/members-page-utils";
import {
  type TrainingUpcomingDateItem,
  type CustomTrainingGroup,
  type ClubMatch,
} from "../_types/members-page-types";
import { WeeklyGrid } from "./WeeklySchedule";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type TrainingDaysForm } from "../_hooks/useTrainingDaysForm";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";
import { type MatchEditorState } from "../_hooks/useMatchEditorState";

type TrainingAttendanceDialogProps = {
  trainingAttendanceState: Pick<
    TrainingAttendanceState,
    | "trainingAttendanceOpen"
    | "setTrainingAttendanceOpen"
    | "setTrainingAttendanceHideTeamsTab"
    | "setTrainingDayDetailsOpen"
    | "trainingAttendanceView"
    | "trainingAttendanceHideTeamsTab"
    | "trainingAttendanceLoading"
    | "trainingWeekLoading"
    | "weekColorFilter"
    | "setWeekColorFilter"
    | "trainingWeekSessions"
    | "trainingWeekDates"
    | "trainingDayDetailsOpening"
    | "trainingAttendanceMonth"
    | "trainingAttendanceDate"
    | "trainingAttendanceError"
    | "trainingAttendancePlayers"
  >;
  trainingDaysForm: Pick<
    TrainingDaysForm,
    | "setTrainingDaysEditorOpen"
    | "trainingDaysEditorSaving"
    | "trainingDaysEditorOpen"
    | "schedulerForm"
    | "schedulerCalendarMonths"
    | "schedulerCalendarDateSet"
    | "toggleTrainingDate"
    | "trainingDaysEditorError"
    | "trainingDaysEditorLoading"
    | "toggleTrainingNoteTargetDate"
  >;
  trainingGroups: Pick<
    TrainingGroups,
    | "isCustomTrainingGroupMode"
    | "customTrainingGroups"
    | "trainingScheduleGroupsLoading"
    | "trainingScheduleGroups"
  >;
  matchEditorState: Pick<
    MatchEditorState,
    | "setMatchViewMatch"
    | "setMatchViewPopupOpen"
    | "setMatchSelectedDates"
    | "setMatchDetailsPerDay"
    | "setMatchExistingIdByDate"
    | "setMatchEditorError"
    | "setMatchCalendarVisibleMonthIdx"
  >;
  trainingNoteSaving: boolean;
  handleTrainingAttendanceViewChange: (nextView: "teamGroup" | "trainingGroups" | "today") => Promise<void>;
  weekSessionColorOptions: { color: string; label: string }[];
  selectedCustomGroup: CustomTrainingGroup | null;
  todayIsoDate: string;
  openTrainingDayDetails: (date: string, sessionId?: string) => Promise<void>;
  standaloneTeamGroups: number[];
  coachGroupId: string;
  currentCoachGroupName: string;
  selectedCustomTrainingGroupDotColor:
    | "#E53935"
    | "#1E88E5"
    | "#43A047"
    | "#FB8C00"
    | "#8E24AA"
    | "#00838F"
    | "#C0CA33"
    | "#6D4C41"
    | "#3949AB"
    | "#D81B60"
    | "#00796B"
    | "#F9A825"
    | "#5E35B1"
    | "#546E7A"
    | "#00ACC1"
    | "#212121"
    | "#FAFAFA"
    | "#800020"
    | "#000080"
    | "#FF00FF"
    | "#00FFFF"
    | "#FFFF00"
    | "#00FF7F"
    | "#7FFF00"
    | "#A6A6A6"
    | "#004D1A"
    | "#FF6347"
    | "#7B3F00"
    | "#6B6B00"
    | "#B57EDC"
    | "#F2B6C6"
    | "#0099FF"
    | "#C8A26A"
    | "#4D0033"
    | null;
  unifiedGroupScopeValue: string;
  handleUnifiedGroupChange: (value: string) => Promise<void>;
  handleTrainingAttendanceMonthChange: (delta: number) => Promise<void>;
  trainingAttendanceCalendarMonths: { key: string; label: string; cells: Array<string | null> }[];
  trainingAttendanceCalendarMonthsTrimmed: { cells: (string | null)[]; key: string; label: string }[];
  trainingUpcomingByDate: Map<string, TrainingUpcomingDateItem>;
  trainingAttendanceMatchesByDate: Map<string, ClubMatch[]>;
  trainingUpcomingDateSet: Set<string>;
  saveTrainingDaysForSelectedGroups: () => Promise<void>;
  trainingNoteTargetDates: string[];
  setTrainingNoteTargetDates: React.Dispatch<React.SetStateAction<string[]>>;
  trainingNote: string;
  setTrainingNote: React.Dispatch<React.SetStateAction<string>>;
  setScheduleEventModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setScheduleEventStep: React.Dispatch<
    React.SetStateAction<"type" | "match-type" | "match-days" | "match-details">
  >;
  fetchClubMatches: () => Promise<void>;
};

export function TrainingAttendanceDialog({
  trainingAttendanceState,
  trainingDaysForm,
  trainingGroups,
  matchEditorState,
  trainingNoteSaving,
  handleTrainingAttendanceViewChange,
  weekSessionColorOptions,
  selectedCustomGroup,
  todayIsoDate,
  openTrainingDayDetails,
  standaloneTeamGroups,
  coachGroupId,
  currentCoachGroupName,
  selectedCustomTrainingGroupDotColor,
  unifiedGroupScopeValue,
  handleUnifiedGroupChange,
  handleTrainingAttendanceMonthChange,
  trainingAttendanceCalendarMonths,
  trainingAttendanceCalendarMonthsTrimmed,
  trainingUpcomingByDate,
  trainingAttendanceMatchesByDate,
  trainingUpcomingDateSet,
  saveTrainingDaysForSelectedGroups,
  trainingNoteTargetDates,
  setTrainingNoteTargetDates,
  trainingNote,
  setTrainingNote,
  setScheduleEventModalOpen,
  setScheduleEventStep,
  fetchClubMatches,
}: TrainingAttendanceDialogProps) {
  const {
    trainingAttendanceOpen,
    setTrainingAttendanceOpen,
    setTrainingAttendanceHideTeamsTab,
    setTrainingDayDetailsOpen,
    trainingAttendanceView,
    trainingAttendanceHideTeamsTab,
    trainingAttendanceLoading,
    trainingWeekLoading,
    weekColorFilter,
    setWeekColorFilter,
    trainingWeekSessions,
    trainingWeekDates,
    trainingDayDetailsOpening,
    trainingAttendanceMonth,
    trainingAttendanceDate,
    trainingAttendanceError,
    trainingAttendancePlayers,
  } = trainingAttendanceState;
  const {
    setTrainingDaysEditorOpen,
    trainingDaysEditorSaving,
    trainingDaysEditorOpen,
    schedulerForm,
    schedulerCalendarMonths,
    schedulerCalendarDateSet,
    toggleTrainingDate,
    trainingDaysEditorError,
    trainingDaysEditorLoading,
    toggleTrainingNoteTargetDate,
  } = trainingDaysForm;
  const {
    isCustomTrainingGroupMode,
    customTrainingGroups,
    trainingScheduleGroupsLoading,
    trainingScheduleGroups,
  } = trainingGroups;
  const {
    setMatchViewMatch,
    setMatchViewPopupOpen,
    setMatchSelectedDates,
    setMatchDetailsPerDay,
    setMatchExistingIdByDate,
    setMatchEditorError,
    setMatchCalendarVisibleMonthIdx,
  } = matchEditorState;
  return (
    <>
      {trainingAttendanceOpen && (
        <div
          className="amp-overlay"
          onClick={() => {
            if (!trainingNoteSaving) {
              setTrainingAttendanceOpen(false);
              setTrainingAttendanceHideTeamsTab(false);
              setTrainingDayDetailsOpen(false);
              setTrainingDaysEditorOpen(false);
            }
          }}
        >
          <div
            className={`amp-modal amp-modal--confirm amp-modal--training-attendance${trainingAttendanceView === "today" ? " amp-modal--week-view" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Текущ график</span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setTrainingAttendanceOpen(false);
                  setTrainingAttendanceHideTeamsTab(false);
                  setTrainingDayDetailsOpen(false);
                  setTrainingDaysEditorOpen(false);
                }}
                aria-label="Затвори"
                disabled={trainingNoteSaving}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {trainingAttendanceHideTeamsTab ? (
                <div
                  className="amp-training-view-switch amp-training-view-switch--single"
                  role="presentation"
                >
                  <span className="amp-training-view-single-label">Тази седмица</span>
                </div>
              ) : (
                <div className="amp-training-view-switch">
                  <button
                    type="button"
                    className={`amp-btn amp-btn--ghost amp-training-view-btn${trainingAttendanceView === "today" ? " is-active" : ""}`}
                    onClick={() => void handleTrainingAttendanceViewChange("today")}
                    disabled={
                      trainingAttendanceLoading ||
                      trainingWeekLoading ||
                      trainingNoteSaving ||
                      trainingDaysEditorSaving
                    }
                  >
                    Тази седмица
                  </button>
                  <button
                    type="button"
                    className={`amp-btn amp-btn--ghost amp-training-view-btn${trainingAttendanceView !== "today" ? " is-active" : ""}`}
                    onClick={() => void handleTrainingAttendanceViewChange("trainingGroups")}
                    disabled={trainingAttendanceLoading || trainingNoteSaving || trainingDaysEditorSaving}
                  >
                    Създай график
                  </button>
                </div>
              )}
              {trainingAttendanceView === "today" ? (
                <div className="amp-training-week-panel">
                  {trainingWeekLoading ? (
                    <p className="amp-empty amp-empty--modal">Зареждане...</p>
                  ) : (
                    <>
                      {weekSessionColorOptions.length > 0 && (
                        <div
                          role="group"
                          aria-label="Филтър по група"
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            flexWrap: "wrap",
                            marginBottom: "12px",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            type="button"
                            className={`amp-pill${weekColorFilter === null ? " amp-pill--active" : ""}`}
                            aria-pressed={weekColorFilter === null}
                            onClick={() => setWeekColorFilter(null)}
                          >
                            Всички
                          </button>
                          {weekSessionColorOptions.map(({ color, label }) => (
                            <button
                              key={color}
                              type="button"
                              aria-pressed={weekColorFilter === color}
                              aria-label={label || color}
                              title={label || undefined}
                              onClick={() => setWeekColorFilter(weekColorFilter === color ? null : color)}
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                backgroundColor: color,
                                border:
                                  weekColorFilter === color
                                    ? "3px solid #fff"
                                    : "2px solid rgba(255,255,255,0.18)",
                                boxShadow: weekColorFilter === color ? `0 0 0 2px ${color}` : "none",
                                cursor: "pointer",
                                flexShrink: 0,
                                transition: "box-shadow 0.15s, border-color 0.15s",
                                padding: 0,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {trainingWeekSessions.length === 0 && (
                        <p className="amp-empty amp-empty--modal">
                          Няма насрочени събития за следващите 7 дни.
                        </p>
                      )}
                      <WeeklyGrid
                        dates={trainingWeekDates}
                        sessions={(() => {
                          const singleGroupColor =
                            isCustomTrainingGroupMode && customTrainingGroups.length === 1
                              ? customTrainingGroups[0].color
                              : null;
                          const matchColor = isCustomTrainingGroupMode
                            ? (weekColorFilter ?? selectedCustomGroup?.color ?? singleGroupColor ?? null)
                            : null;
                          const base = weekColorFilter
                            ? trainingWeekSessions.filter((s) => s.color === weekColorFilter)
                            : trainingWeekSessions;
                          return matchColor
                            ? base.map((s) =>
                                s.eventType === "match" && !s.color ? { ...s, color: matchColor } : s,
                              )
                            : base;
                        })()}
                        todayIso={todayIsoDate}
                        onDateClick={(date, sid) => void openTrainingDayDetails(date, sid)}
                      />
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: "12px" }}>
                    {trainingScheduleGroupsLoading ? (
                      <p className="amp-empty amp-empty--modal">Зареждане...</p>
                    ) : (
                        isCustomTrainingGroupMode
                          ? customTrainingGroups.length === 0
                          : trainingScheduleGroups.length === 0 && standaloneTeamGroups.length === 0
                      ) ? (
                      <p className="amp-empty amp-empty--modal">
                        {coachGroupId
                          ? `Насрочете тренировки за ${currentCoachGroupName || "треньорската група"}.`
                          : "Няма създадени групи. Използвайте бутона „Създай / редактирай група” в треньорския панел."}
                      </p>
                    ) : (
                      <>
                        <label
                          className="amp-edit-field"
                          style={{ marginBottom: "12px", textAlign: "center" }}
                        >
                          <span className="amp-lbl" style={{ textAlign: "center" }}>
                            Група
                          </span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "10px",
                            }}
                          >
                            {selectedCustomTrainingGroupDotColor && (
                              <span
                                className="amp-custom-group-select-swatch"
                                style={{ backgroundColor: selectedCustomTrainingGroupDotColor }}
                                aria-hidden
                              />
                            )}
                            <select
                              className="amp-edit-input"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                textAlign: "center",
                                textAlignLast: "center",
                                paddingLeft: "12px",
                              }}
                              value={unifiedGroupScopeValue}
                              onChange={(e) => void handleUnifiedGroupChange(e.target.value)}
                              disabled={
                                trainingAttendanceLoading ||
                                trainingNoteSaving ||
                                trainingDaysEditorSaving ||
                                trainingScheduleGroupsLoading
                              }
                            >
                              {isCustomTrainingGroupMode
                                ? customTrainingGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                      {group.name}
                                    </option>
                                  ))
                                : trainingScheduleGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                      {group.name}
                                    </option>
                                  ))}
                              {!isCustomTrainingGroupMode &&
                                standaloneTeamGroups.map((g) => (
                                  <option key={g} value={`year:${g}`}>
                                    Набор {g}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                  {!(isCustomTrainingGroupMode
                    ? customTrainingGroups.length === 0
                    : trainingScheduleGroups.length === 0 && standaloneTeamGroups.length === 0) &&
                    !trainingScheduleGroupsLoading && (
                      <>
                        {trainingDayDetailsOpening && (
                          <div className="amp-modal-loading-overlay">
                            <div className="amp-loading" style={{ minHeight: 120 }}>
                              <div className="amp-spinner" />
                            </div>
                          </div>
                        )}
                        <label className="amp-edit-field" style={{ position: "relative" }}>
                          {trainingAttendanceLoading && (
                            <div
                              className="amp-modal-loading-overlay"
                              style={{ position: "absolute", inset: 0, zIndex: 10 }}
                            >
                              <div className="amp-loading" style={{ minHeight: 200 }}>
                                <div className="amp-spinner" />
                                <p style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                                  Зареждане...
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="amp-training-calendar amp-training-calendar--attendance">
                            <div className="amp-training-month-nav">
                              <button
                                type="button"
                                className="amp-training-month-nav-btn"
                                onClick={() => void handleTrainingAttendanceMonthChange(-1)}
                                disabled={
                                  trainingAttendanceLoading ||
                                  trainingNoteSaving ||
                                  trainingDayDetailsOpening ||
                                  trainingAttendanceMonth <= todayIsoDate.slice(0, 7)
                                }
                                aria-label="Предишен месец"
                              >
                                ‹
                              </button>
                              <span className="amp-training-month-nav-title">
                                {trainingAttendanceCalendarMonths[0]?.label ?? trainingAttendanceMonth}
                              </span>
                              <button
                                type="button"
                                className="amp-training-month-nav-btn"
                                onClick={() => void handleTrainingAttendanceMonthChange(1)}
                                disabled={
                                  trainingAttendanceLoading || trainingNoteSaving || trainingDayDetailsOpening
                                }
                                aria-label="Следващ месец"
                              >
                                ›
                              </button>
                            </div>
                            {trainingAttendanceCalendarMonthsTrimmed.map((month) => (
                              <div key={month.key} className="amp-training-month">
                                <div className="amp-training-month-title">{month.label}</div>
                                <div className="amp-training-weekdays-row">
                                  {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                                    <span
                                      key={`${month.key}-${weekday}`}
                                      className="amp-training-weekday-cell"
                                    >
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
                                    if (date < todayIsoDate) {
                                      return (
                                        <span
                                          key={date}
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
                                        <button
                                          key={date}
                                          type="button"
                                          className="amp-training-date-btn amp-training-date-btn--calendar-match-only"
                                          aria-label={`${matchEventTypeLabel(matchesForDate[0]?.eventType)} на ${formatIsoDateForDisplay(date)}`}
                                          onClick={() => {
                                            setMatchViewMatch(matchesForDate[0]!);
                                            setMatchViewPopupOpen(true);
                                          }}
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
                                        </button>
                                      );
                                    }

                                    const isActive = trainingAttendanceDate === date;
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
                                        className={`amp-training-date-btn amp-training-date-btn--training${hasTrainingAndMatch ? " amp-training-date-btn--training-match" : ""}${isActive ? " amp-training-date-btn--active" : ""}${isToday ? " amp-training-date-btn--today" : ""}`}
                                        onClick={() => void openTrainingDayDetails(date)}
                                        disabled={
                                          trainingAttendanceLoading ||
                                          trainingNoteSaving ||
                                          trainingDayDetailsOpening
                                        }
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
                          {false && trainingDaysEditorOpen && (
                            <div className="amp-training-days-editor">
                              <div className="amp-training-days-editor-header">
                                <span className="amp-lbl">Избери тренировъчни дни (следващи 3 месеца)</span>
                                <span className="amp-lbl">Избрани: {schedulerForm.trainingDates.length}</span>
                              </div>
                              <div className="amp-training-calendar">
                                {schedulerCalendarMonths.map((month) => (
                                  <div key={month.key} className="amp-training-month">
                                    <div className="amp-training-month-title">{month.label}</div>
                                    <div className="amp-training-weekdays-row">
                                      {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                                        <span
                                          key={`${month.key}-${weekday}`}
                                          className="amp-training-weekday-cell"
                                        >
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
                                        const isSelectable = schedulerCalendarDateSet.has(date);
                                        if (!isSelectable) {
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

                                        const isSelected = schedulerForm.trainingDates.includes(date);
                                        const isToday = todayIsoDate === date;
                                        return (
                                          <button
                                            key={date}
                                            type="button"
                                            className={`amp-training-date-btn${isSelected ? " amp-training-date-btn--active" : ""}${isToday ? " amp-training-date-btn--today" : ""}`}
                                            onClick={() => toggleTrainingDate(date)}
                                            disabled={trainingDaysEditorSaving}
                                          >
                                            <span className="amp-training-day-number">{dayNumber}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {trainingDaysEditorError && (
                                <p className="amp-confirm-error">{trainingDaysEditorError}</p>
                              )}
                              <div className="amp-modal-actions amp-modal-actions--end">
                                <button
                                  type="button"
                                  className="amp-btn amp-btn--ghost"
                                  onClick={() => setTrainingDaysEditorOpen(false)}
                                  disabled={trainingDaysEditorSaving}
                                >
                                  Отказ
                                </button>
                                <button
                                  type="button"
                                  className="amp-btn amp-btn--primary"
                                  onClick={() => void saveTrainingDaysForSelectedGroups()}
                                  disabled={trainingDaysEditorSaving || trainingDaysEditorLoading}
                                >
                                  {trainingDaysEditorSaving ? "Запазване..." : "Запази дни"}
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="amp-training-note-targets">
                            <button
                              type="button"
                              className="amp-btn amp-btn--ghost"
                              onClick={() => toggleTrainingNoteTargetDate(trainingAttendanceDate)}
                              disabled={
                                trainingNoteSaving || trainingAttendanceLoading || !trainingAttendanceDate
                              }
                            >
                              {trainingNoteTargetDates.includes(trainingAttendanceDate)
                                ? "Премахни ден от избора"
                                : "Добави ден към избора"}
                            </button>
                            <button
                              type="button"
                              className="amp-btn amp-btn--ghost"
                              onClick={() =>
                                setTrainingNoteTargetDates(
                                  trainingAttendanceDate ? [trainingAttendanceDate] : [],
                                )
                              }
                              disabled={trainingNoteSaving || trainingAttendanceLoading}
                            >
                              Остави само текущия ден
                            </button>
                            <span className="amp-lbl">
                              Избрани дни за добавяне на описание: {trainingNoteTargetDates.length}
                            </span>
                          </div>
                          <textarea
                            className="amp-edit-input amp-training-note"
                            value={trainingNote}
                            onChange={(e) => setTrainingNote(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            placeholder="Добавете инструкции, сборен час, локация..."
                            disabled={trainingNoteSaving || trainingAttendanceLoading}
                          />
                        </label>
                      </>
                    )}
                  {(!isCustomTrainingGroupMode || customTrainingGroups.length > 0) && (
                    <div className="amp-modal-actions amp-modal-actions--end">
                      <button
                        className="amp-btn amp-btn--ghost"
                        onClick={() => {
                          setScheduleEventModalOpen(true);
                          setScheduleEventStep("type");
                          setMatchSelectedDates([]);
                          setMatchDetailsPerDay({});
                          setMatchExistingIdByDate({});
                          setMatchEditorError("");
                          setMatchCalendarVisibleMonthIdx(0);
                          void fetchClubMatches();
                        }}
                        disabled={trainingNoteSaving || trainingDaysEditorSaving}
                      >
                        Насрочи график
                      </button>
                    </div>
                  )}
                  {trainingAttendanceError && <p className="amp-confirm-error">{trainingAttendanceError}</p>}
                  <div className="amp-training-table-wrap">
                    {trainingAttendanceLoading ? (
                      <p className="amp-empty amp-empty--modal">Зареждане...</p>
                    ) : trainingAttendancePlayers.length === 0 ? (
                      <p className="amp-empty amp-empty--modal">Няма състезатели за този отбор.</p>
                    ) : (
                      <table className="amp-training-table">
                        <thead>
                          <tr>
                            <th>Име</th>
                            <th>Набор</th>
                            <th>Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trainingAttendancePlayers.map((player) => (
                            <tr key={player.id}>
                              <td>{player.fullName}</td>
                              <td>{player.teamGroup ?? "-"}</td>
                              <td>
                                <span
                                  className={
                                    player.optedOut
                                      ? "amp-training-tag amp-training-tag--out"
                                      : "amp-training-tag amp-training-tag--in"
                                  }
                                >
                                  {player.optedOut ? "Няма да присъства" : "Ще присъства"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

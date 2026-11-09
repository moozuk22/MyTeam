"use client";

import { type CSSProperties } from "react";
import {
  isCustomTrainingGroupPaletteColor,
  customTrainingGroupAccentRgba,
  customTrainingGroupReadableOnAccent,
} from "@/lib/customTrainingGroupColors";
import { TRAINING_WEEKDAY_LONG_BG, getWeekdayMondayFirstIndex } from "../_utils/members-page-utils";
import { type TrainingWeekSessionItem } from "../_types/members-page-types";

export function sortWeekSessionsForDay(a: TrainingWeekSessionItem, b: TrainingWeekSessionItem): number {
  const minutes = (s: TrainingWeekSessionItem) => {
    const t = s.trainingTime?.trim() ?? "";
    return /^\d{2}:\d{2}$/.test(t) ? parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10) : 99999;
  };
  const d = minutes(a) - minutes(b);
  if (d !== 0) return d;
  return a.label.localeCompare(b.label, "bg");
}

export function WeeklyGrid({
  dates,
  sessions,
  todayIso,
  onDateClick,
}: {
  dates: string[];
  sessions: TrainingWeekSessionItem[];
  todayIso: string;
  onDateClick?: (date: string, sessionId: string) => void;
}) {
  const sessionsByDate = new Map<string, TrainingWeekSessionItem[]>();
  for (const d of dates) sessionsByDate.set(d, []);
  for (const s of sessions) {
    const row = sessionsByDate.get(s.date);
    if (row) row.push(s);
  }
  for (const d of dates) {
    sessionsByDate.get(d)!.sort(sortWeekSessionsForDay);
  }

  return (
    <div className="amp-training-week-scroll amp-training-week-scroll--list">
      <div className="amp-training-week-list">
        {dates.map((date) => {
          const daySessions = sessionsByDate.get(date) ?? [];
          if (daySessions.length === 0) return null;
          const weekdayLong = TRAINING_WEEKDAY_LONG_BG[getWeekdayMondayFirstIndex(date)] ?? "";
          const dateLine = new Date(`${date}T12:00:00.000Z`).toLocaleDateString("bg-BG", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return (
            <section
              key={date}
              className={`amp-training-week-day-block${date === todayIso ? " amp-training-week-day-block--today" : ""}`}
            >
              <header className="amp-training-week-day-strip">
                <span className="amp-training-week-day-strip-weekday">{weekdayLong}</span>
                <span className="amp-training-week-day-strip-date">{dateLine}</span>
              </header>
              <ul className="amp-training-week-session-rows" aria-label={`График за ${weekdayLong}`}>
                {daySessions.map((session) => {
                  const accent =
                    session.color && isCustomTrainingGroupPaletteColor(session.color) ? session.color : null;
                  const rowStyle: CSSProperties | undefined = accent
                    ? {
                        background: customTrainingGroupAccentRgba(accent, 0.1),
                        borderColor: customTrainingGroupAccentRgba(accent, 0.38),
                      }
                    : undefined;
                  const timeStyle: CSSProperties | undefined = accent
                    ? {
                        color:
                          customTrainingGroupReadableOnAccent(accent) === "#fafafa"
                            ? "rgba(255,255,255,0.75)"
                            : accent,
                      }
                    : undefined;
                  const badgeStyle: CSSProperties | undefined = accent
                    ? {
                        background: accent,
                        borderColor: customTrainingGroupAccentRgba(accent, 0.55),
                        color: customTrainingGroupReadableOnAccent(accent),
                      }
                    : undefined;
                  return (
                    <li
                      key={session.id}
                      className={`amp-training-week-session-row${
                        session.eventType === "match" ? " amp-training-week-session-row--match" : ""
                      }${onDateClick ? " amp-training-week-session-row--clickable" : ""}`}
                      style={onDateClick ? { ...rowStyle, cursor: "pointer" } : rowStyle}
                      onClick={onDateClick ? () => onDateClick(session.date, session.id) : undefined}
                      role={onDateClick ? "button" : undefined}
                      tabIndex={onDateClick ? 0 : undefined}
                      onKeyDown={
                        onDateClick
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onDateClick(session.date, session.id);
                              }
                            }
                          : undefined
                      }
                    >
                      <span className="amp-training-week-session-row-time" style={timeStyle}>
                        {session.trainingTime?.trim() ? session.trainingTime.trim() : "—"}
                      </span>
                      <div className="amp-training-week-session-row-main">
                        <span className="amp-training-week-session-row-label">
                          {session.eventType === "match"
                            ? session.scopeLabel || session.label
                            : session.label}
                        </span>
                        {session.eventType === "match" && (
                          <span className="amp-training-week-session-row-meta">
                            {session.label} · {session.isHome ? "Домакин" : "Гост"}
                          </span>
                        )}
                        {session.eventType !== "match" && session.limitedSpots && (
                          <span
                            className="amp-training-week-session-row-meta"
                            title={`Ограничени места: ${session.limitedSpots.registeredCount} от ${session.limitedSpots.maxSpots} записани`}
                          >
                            {session.limitedSpots.registeredCount}/{session.limitedSpots.maxSpots} места
                          </span>
                        )}
                      </div>
                      <span
                        className={`amp-training-week-session-row-badge${
                          session.eventType === "match" ? " amp-training-week-session-row-badge--match" : ""
                        }`}
                        style={badgeStyle}
                        aria-hidden="true"
                      >
                        {session.eventType === "match" ? "М" : "Т"}
                      </span>
                      {onDateClick && (
                        <span className="amp-training-week-session-row-info" aria-hidden="true">
                          i
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

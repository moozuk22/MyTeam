"use client";

import MatchAttendanceControl from "@/components/MatchAttendanceControl";
import MemberMatchExtraDetails from "@/components/MemberMatchExtraDetails";

import { matchEventTypeLabel } from "@/lib/matchEventType";

import type { MemberTrainingDayDialogProps } from "./MemberTrainingDayDialog";
type Props = {
  trainingDetailsMatches: MemberTrainingDayDialogProps["trainingDetailsMatches"];
  normalizedCardCode: MemberTrainingDayDialogProps["normalizedCardCode"];
  fetchMemberMatches: MemberTrainingDayDialogProps["fetchMemberMatches"];
};
export function MemberTrainingMatchDetails({
  trainingDetailsMatches,
  normalizedCardCode,
  fetchMemberMatches,
}: Props) {
  return (
    <div className="member-day-match-panel">
      {trainingDetailsMatches.map((match) => (
        <div key={match.id} className="member-day-match-card">
          <div className="member-day-match-card-header">
            <span className="member-day-match-opponent">
              {matchEventTypeLabel(match.eventType)} · {match.opponent}
            </span>
            <span
              className={`match-details-badge${match.isHome ? " match-details-badge--home" : " match-details-badge--away"}`}
            >
              {match.isHome ? "Домакин" : "Гост"}
            </span>
          </div>
          <div className="match-details-body">
            <MemberMatchExtraDetails
              category={match.category}
              description={match.description}
            />
            <div className="match-details-row">
              <span className="match-details-label">Дата</span>
              <span className="match-details-value">
                {new Date(
                  `${match.matchDate}T12:00:00.000Z`,
                ).toLocaleDateString("bg-BG", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </span>
            </div>
            <div className="match-details-row">
              <span className="match-details-label">Час</span>
              <span className="match-details-value">{match.matchTime}</span>
            </div>
            <div className="match-details-row">
              <span className="match-details-label">Място</span>
              <span className="match-details-value">{match.location}</span>
            </div>
            {match.durationMinutes && (
              <div className="match-details-row">
                <span className="match-details-label">Продължителност</span>
                <span className="match-details-value">
                  {match.durationMinutes} мин
                </span>
              </div>
            )}
          </div>
          {match.attendanceEnabled && (
            <MatchAttendanceControl
              attendance={match}
              endpoint={`/api/members/${normalizedCardCode}/matches/${match.id}/attendance`}
              onSaved={fetchMemberMatches}
            />
          )}
        </div>
      ))}
    </div>
  );
}

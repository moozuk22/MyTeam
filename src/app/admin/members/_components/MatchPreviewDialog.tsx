"use client";

import { matchCategoryLabel } from "@/lib/matchCategory";
import { matchEventTypeLabel } from "@/lib/matchEventType";
import MatchAttendancePanel from "@/components/MatchAttendancePanel";
import { XIcon } from "./members-page-icons";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";
import { type MatchEditorState } from "../_hooks/useMatchEditorState";

type MatchPreviewDialogProps = {
  matchEditorState: Pick<
    MatchEditorState,
    | "matchViewPopupOpen"
    | "matchViewMatch"
    | "setMatchViewPopupOpen"
    | "dayDetailsMatchOriginalResult"
    | "setDayDetailsMatchEditForm"
    | "setDayDetailsMatchError"
    | "setDayDetailsMatchDeleteConfirm"
    | "setDayDetailsMatchEditOpen"
    | "setMatchEditTarget"
  >;
  trainingAttendanceState: Pick<
    TrainingAttendanceState,
    | "setTrainingDayDetailsViewSnapshot"
    | "trainingAttendanceView"
    | "setTrainingAttendanceDate"
    | "setTrainingDayDetailsTab"
    | "setTrainingDayDetailsOpening"
    | "setTrainingDayDetailsOpen"
  >;
  clubId: string;
};

export function MatchPreviewDialog({
  matchEditorState,
  trainingAttendanceState,
  clubId,
}: MatchPreviewDialogProps) {
  const {
    matchViewPopupOpen,
    matchViewMatch,
    setMatchViewPopupOpen,
    dayDetailsMatchOriginalResult: matchOriginalResultRef,
    setDayDetailsMatchEditForm,
    setDayDetailsMatchError,
    setDayDetailsMatchDeleteConfirm,
    setDayDetailsMatchEditOpen,
    setMatchEditTarget,
  } = matchEditorState;
  const {
    setTrainingDayDetailsViewSnapshot,
    trainingAttendanceView,
    setTrainingAttendanceDate,
    setTrainingDayDetailsTab,
    setTrainingDayDetailsOpening,
    setTrainingDayDetailsOpen,
  } = trainingAttendanceState;
  return (
    <>
      {matchViewPopupOpen && matchViewMatch && (
        <div className="amp-overlay amp-overlay--confirm" onClick={() => setMatchViewPopupOpen(false)}>
          <div className="amp-modal amp-modal--match-view" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient amp-modal-title-gradient--match">
                {matchEventTypeLabel(matchViewMatch.eventType)}
              </span>
              <button
                className="amp-modal-close"
                onClick={() => setMatchViewPopupOpen(false)}
                aria-label="Затвори"
              >
                <XIcon />
              </button>
            </h2>
            <p className="amp-match-view-date">
              {new Date(`${matchViewMatch.matchDate}T12:00:00.000Z`).toLocaleDateString("bg-BG", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
            <div className="amp-match-view-body">
              <div className="amp-match-view-row">
                <span className="amp-match-view-label">Противник</span>
                <span className="amp-match-view-value">{matchViewMatch.opponent}</span>
              </div>
              <div className="amp-match-view-row">
                <span className="amp-match-view-label">Час</span>
                <span className="amp-match-view-value">{matchViewMatch.matchTime}</span>
              </div>
              <div className="amp-match-view-row">
                <span className="amp-match-view-label">Място</span>
                <span className="amp-match-view-value">{matchViewMatch.location}</span>
              </div>
              <div className="amp-match-view-row">
                <span className="amp-match-view-label">Домакин/Гост</span>
                <span
                  className={`amp-match-view-badge${matchViewMatch.isHome ? " amp-match-view-badge--home" : " amp-match-view-badge--away"}`}
                >
                  {matchViewMatch.isHome ? "Домакин" : "Гост"}
                </span>
              </div>
              <div className="amp-match-view-row">
                <span className="amp-match-view-label">Характер на срещата</span>
                <span className="amp-match-view-value">{matchCategoryLabel(matchViewMatch.category)}</span>
              </div>
              {matchViewMatch.description && (
                <div className="amp-match-view-row">
                  <span className="amp-match-view-label">Описание</span>
                  <span className="amp-match-view-value" style={{ whiteSpace: "pre-wrap" }}>
                    {matchViewMatch.description}
                  </span>
                </div>
              )}
              {matchViewMatch.durationMinutes > 0 && (
                <div className="amp-match-view-row">
                  <span className="amp-match-view-label">Продължителност</span>
                  <span className="amp-match-view-value">{matchViewMatch.durationMinutes} мин</span>
                </div>
              )}
            </div>
            {clubId && (
              <MatchAttendancePanel key={matchViewMatch.id} clubId={clubId} matchId={matchViewMatch.id} />
            )}
            <div className="amp-modal-actions amp-modal-actions--end" style={{ marginTop: "8px" }}>
              <button
                type="button"
                className="amp-btn amp-btn--ghost"
                onClick={() => {
                  matchOriginalResultRef.current = {
                    homeScore: matchViewMatch.homeScore,
                    awayScore: matchViewMatch.awayScore,
                  };
                  setDayDetailsMatchEditForm({
                    description: matchViewMatch.description ?? "",
                    category: matchViewMatch.category ?? "",
                    opponent: matchViewMatch.opponent,
                    location: matchViewMatch.location,
                    matchDate: matchViewMatch.matchDate,
                    matchTime: matchViewMatch.matchTime,
                    durationMinutes: String(matchViewMatch.durationMinutes),
                    isHome: matchViewMatch.isHome,
                    customGroupId: matchViewMatch.customGroupId,
                    homeScore: String(matchViewMatch.homeScore ?? ""),
                    awayScore: String(matchViewMatch.awayScore ?? ""),
                  });
                  setDayDetailsMatchError("");
                  setDayDetailsMatchDeleteConfirm(false);
                  setDayDetailsMatchEditOpen(true);
                  setMatchViewPopupOpen(false);
                  setMatchEditTarget(matchViewMatch);
                  setTrainingDayDetailsViewSnapshot(trainingAttendanceView);
                  setTrainingAttendanceDate(matchViewMatch.matchDate);
                  setTrainingDayDetailsTab(`match-${matchViewMatch.id}`);
                  setTrainingDayDetailsOpening(false);
                  setTrainingDayDetailsOpen(true);
                }}
              >
                Редактирай
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
import { TrainingDayRegistrations } from "./TrainingDayRegistrations";
import { TrainingDayMatchContent } from "./TrainingDayMatchContent";
import { SkeletonLine } from "./FinanceSkeleton";

import { matchEventTypeLabel } from "@/lib/matchEventType";

import { type CSSProperties } from "react";
import {
  isCustomTrainingGroupPaletteColor,
  customTrainingGroupAccentRgba,
  customTrainingGroupReadableOnAccent,
} from "@/lib/customTrainingGroupColors";
import { XIcon } from "./members-page-icons";
import { formatIsoDateForDisplay } from "../_utils/members-page-utils";
import {
  type TrainingWeekSessionItem,
  type ClubMatch,
} from "../_types/members-page-types";
import {
  getFieldBackground,
  renderFieldMarkings,
} from "./TrainingFieldPreview";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";
import { type MatchEditorState } from "../_hooks/useMatchEditorState";

export type TrainingDayDetailsDialogProps = {
  schedule2DayDetails: boolean;
  dismissSchedule2Details: () => void;
  matchEditCustomGroups: { id: string; name: string }[];
  schedulerCalendarDateSet: Set<string>;
  trainingAttendanceState: Pick<
    TrainingAttendanceState,
    | "trainingDayDetailsOpen"
    | "trainingDayDetailsOpening"
    | "trainingDayDetailsTabLoading"
    | "setTrainingDayDetailsOpen"
    | "setTrainingAttendanceView"
    | "trainingDayDetailsViewSnapshot"
    | "trainingDayDetailsTab"
    | "setTrainingDayDetailsTab"
    | "trainingAttendanceError"
    | "trainingAttendanceDate"
    | "trainingDayTime"
    | "trainingAttendanceStats"
    | "trainingDayDurationMinutes"
    | "trainingDaySessionCancelled"
    | "trainingAttendanceLoading"
    | "trainingDayField"
    | "trainingDayFieldPieceIds"
    | "trainingDayCancelLoading"
    | "setTrainingDayCancelConfirmOpen"
    | "trainingDayCancelConfirmOpen"
    | "limitedEvent"
    | "limitedEventLoading"
    | "setTrainingPlayersExpanded"
    | "trainingPlayersExpanded"
    | "trainingAttendancePlayers"
    | "showLimitedForm"
    | "setShowLimitedForm"
    | "limitedEventSaving"
    | "limitedEventError"
    | "limitedSpotsInput"
    | "setLimitedSpotsInput"
    | "setLimitedEventError"
    | "setLimitedEventSaving"
    | "setLimitedEvent"
  >;
  matchEditorState: Pick<
    MatchEditorState,
    | "setDayDetailsMatchEditOpen"
    | "setDayDetailsMatchDeleteConfirm"
    | "setDayDetailsMatchError"
    | "dayDetailsMatchSaving"
    | "matchEditTarget"
    | "dayDetailsMatchEditOpen"
    | "dayDetailsMatchEditForm"
    | "setDayDetailsMatchEditForm"
    | "dayDetailsMatchError"
    | "setMatchEditTarget"
    | "setMatchViewPopupOpen"
    | "dayDetailsMatchDeleteConfirm"
    | "dayDetailsMatchOriginalResult"
  >;
  trainingGroups: Pick<
    TrainingGroups,
    "customTrainingGroups" | "isCustomTrainingGroupMode"
  >;
  trainingNoteSaving: boolean;
  dayDetailsIsMatchTab: boolean;
  dayDetailsHasTabs: boolean;
  dayDetailsSessions: TrainingWeekSessionItem[];
  loadDayDetailsSessionAttendance: (
    session: TrainingWeekSessionItem,
    date: string,
  ) => Promise<void>;
  dayDetailsMatchesAll: ClubMatch[];
  dayDetailsActiveMatch: ClubMatch | null;
  clubId: string;
  handleDayDetailsMatchSave: () => Promise<void>;
  handleDayDetailsMatchDelete: () => Promise<void>;
  trainingNote: string;
  openSingleTrainingDayEditForCurrentScope: (date: string) => Promise<void>;
  handleDeleteTrainingDay: () => Promise<void>;
  fetchLimitedEventForSession: (
    date: string,
    sessionId: string,
  ) => Promise<void>;
};

export function TrainingDayDetailsDialog({
  schedule2DayDetails,
  dismissSchedule2Details,
  matchEditCustomGroups,
  schedulerCalendarDateSet,
  trainingAttendanceState,
  matchEditorState,
  trainingGroups,
  trainingNoteSaving,
  dayDetailsIsMatchTab,
  dayDetailsHasTabs,
  dayDetailsSessions,
  loadDayDetailsSessionAttendance,
  dayDetailsMatchesAll,
  dayDetailsActiveMatch,
  clubId,
  handleDayDetailsMatchSave,
  handleDayDetailsMatchDelete,
  trainingNote,
  openSingleTrainingDayEditForCurrentScope,
  handleDeleteTrainingDay,
  fetchLimitedEventForSession,
}: TrainingDayDetailsDialogProps) {
  const {
    trainingDayDetailsOpen,
    trainingDayDetailsOpening,
    trainingDayDetailsTabLoading,
    setTrainingDayDetailsOpen,
    setTrainingAttendanceView,
    trainingDayDetailsViewSnapshot,
    trainingDayDetailsTab,
    setTrainingDayDetailsTab,
    trainingAttendanceError,
    trainingAttendanceDate,
    trainingDayTime,
    trainingAttendanceStats,
    trainingDayDurationMinutes,
    trainingDaySessionCancelled,
    trainingAttendanceLoading,
    trainingDayField,
    trainingDayFieldPieceIds,
    trainingDayCancelLoading,
    setTrainingDayCancelConfirmOpen,
    trainingDayCancelConfirmOpen,
    limitedEvent,
    limitedEventLoading,
    setTrainingPlayersExpanded,
    trainingPlayersExpanded,
    trainingAttendancePlayers,
    showLimitedForm,
    setShowLimitedForm,
    limitedEventSaving,
    limitedEventError,
    limitedSpotsInput,
    setLimitedSpotsInput,
    setLimitedEventError,
    setLimitedEventSaving,
    setLimitedEvent,
  } = trainingAttendanceState;
  const {
    setDayDetailsMatchEditOpen,
    setDayDetailsMatchDeleteConfirm,
    setDayDetailsMatchError,
    dayDetailsMatchSaving,
    matchEditTarget,
    dayDetailsMatchEditOpen,
    dayDetailsMatchEditForm,
    setDayDetailsMatchEditForm,
    dayDetailsMatchError,
    setMatchEditTarget,
    setMatchViewPopupOpen,
    dayDetailsMatchDeleteConfirm,
    dayDetailsMatchOriginalResult,
  } = matchEditorState;
  const { customTrainingGroups, isCustomTrainingGroupMode } = trainingGroups;
  const schedule2ActionPending = schedule2DayDetails &&
    (limitedEventSaving || trainingDayCancelLoading || dayDetailsMatchSaving);
  const closeBlocked = trainingNoteSaving || trainingDayDetailsTabLoading ||
    (!schedule2DayDetails && trainingDayDetailsOpening) || schedule2ActionPending;
  const closeDetails = () => {
    if (schedule2DayDetails) dismissSchedule2Details();
    setTrainingDayDetailsOpen(false);
    setTrainingAttendanceView(trainingDayDetailsViewSnapshot);
  };
  return (
    <>
      {(trainingDayDetailsOpen || trainingDayDetailsOpening) && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => { if (!closeBlocked) closeDetails(); }}
        >
          <div
            className="amp-modal amp-modal--confirm amp-modal--training-day-details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span
                className={`amp-modal-title-gradient${dayDetailsIsMatchTab ? " amp-modal-title-gradient--match" : ""}`}
              >
                {dayDetailsIsMatchTab
                  ? "Детайли за мач"
                  : "Детайли за тренировка"}
              </span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  closeDetails();
                  setDayDetailsMatchEditOpen(false);
                  setDayDetailsMatchDeleteConfirm(false);
                  setDayDetailsMatchError("");
                }}
                aria-label="Затвори"
                disabled={closeBlocked || dayDetailsMatchSaving}
              >
                <XIcon />
              </button>
            </h2>
            {trainingDayDetailsOpening ? schedule2DayDetails ? (
              <div className="amp-modal-body" role="status" aria-label="Зареждане" aria-busy="true">
                <div aria-hidden="true" style={{ display: "grid", gap: 12 }}>
                  <SkeletonLine wide />
                  <SkeletonLine />
                  <SkeletonLine wide />
                  <SkeletonLine wide />
                </div>
              </div>
            ) : (
              <div className="amp-modal-body">
                <div className="amp-loading">
                  <div className="amp-spinner" />
                </div>
              </div>
            ) : (
              !matchEditTarget &&
              dayDetailsHasTabs && (
                <div className="amp-day-details-tabs">
                  {dayDetailsSessions.length > 0 ? (
                    dayDetailsSessions.map((session) => {
                      const isActive =
                        !dayDetailsIsMatchTab &&
                        (dayDetailsSessions.length === 1 ||
                          trainingDayDetailsTab === session.id);
                      const accent =
                        session.color &&
                        isCustomTrainingGroupPaletteColor(session.color)
                          ? session.color
                          : null;
                      const tabStyle: CSSProperties | undefined = accent
                        ? {
                            borderColor: customTrainingGroupAccentRgba(
                              accent,
                              isActive ? 0.6 : 0.25,
                            ),
                            color:
                              customTrainingGroupReadableOnAccent(accent) ===
                              "#fafafa"
                                ? `rgba(255,255,255,${isActive ? 0.9 : 0.75})`
                                : accent,
                            background: isActive
                              ? customTrainingGroupAccentRgba(accent, 0.14)
                              : undefined,
                          }
                        : undefined;
                      return (
                        <button
                          key={session.id}
                          type="button"
                          className={`amp-day-details-tab${accent ? " amp-day-details-tab--custom" : " amp-day-details-tab--training"}${isActive ? " amp-day-details-tab--active" : ""}`}
                          style={tabStyle}
                          onClick={() => {
                            setTrainingDayDetailsTab(session.id);
                            if (
                              (dayDetailsSessions.length > 1 ||
                                dayDetailsIsMatchTab) &&
                              trainingAttendanceDate
                            ) {
                              void loadDayDetailsSessionAttendance(
                                session,
                                trainingAttendanceDate,
                              );
                            }
                          }}
                          disabled={
                            trainingDayDetailsTabLoading || trainingNoteSaving || schedule2ActionPending
                          }
                        >
                          <span className="amp-day-details-tab-type">
                            Тренировка
                          </span>
                          <span className="amp-day-details-tab-time">
                            {session.trainingTime ?? "—"}
                          </span>
                          <span className="amp-day-details-tab-label">
                            {session.label}
                          </span>
                        </button>
                      );
                    })
                  ) : !schedule2DayDetails && (
                    <button
                      type="button"
                      className={`amp-day-details-tab amp-day-details-tab--training${!dayDetailsIsMatchTab ? " amp-day-details-tab--active" : ""}`}
                      onClick={() => setTrainingDayDetailsTab("training")}
                      disabled={
                        trainingDayDetailsTabLoading || trainingNoteSaving
                      }
                    >
                      <span className="amp-day-details-tab-type">
                        Тренировка
                      </span>
                      <span className="amp-day-details-tab-time">—</span>
                    </button>
                  )}
                  {dayDetailsMatchesAll.map((match) => {
                    const isActive =
                      trainingDayDetailsTab === `match-${match.id}`;
                    const matchGroup =
                      customTrainingGroups.find(
                        (g) => g.id === match.customGroupId,
                      ) ?? null;
                    const matchGroupName = matchGroup?.name ?? matchEditCustomGroups.find((group) => group.id === match.customGroupId)?.name;
                    const matchAccent =
                      matchGroup?.color &&
                      isCustomTrainingGroupPaletteColor(matchGroup.color)
                        ? matchGroup.color
                        : null;
                    const matchTabStyle: CSSProperties | undefined = matchAccent
                      ? {
                          borderColor: customTrainingGroupAccentRgba(
                            matchAccent,
                            isActive ? 0.6 : 0.25,
                          ),
                          color:
                            customTrainingGroupReadableOnAccent(matchAccent) ===
                            "#fafafa"
                              ? `rgba(255,255,255,${isActive ? 0.9 : 0.75})`
                              : matchAccent,
                          background: isActive
                            ? customTrainingGroupAccentRgba(matchAccent, 0.14)
                            : undefined,
                        }
                      : undefined;
                    return (
                      <button
                        key={match.id}
                        type="button"
                        className={`amp-day-details-tab${matchAccent ? " amp-day-details-tab--custom" : " amp-day-details-tab--match"}${isActive ? " amp-day-details-tab--active" : ""}`}
                        style={matchTabStyle}
                        onClick={() => {
                          setTrainingDayDetailsTab(`match-${match.id}`);
                          setDayDetailsMatchEditOpen(false);
                          setDayDetailsMatchDeleteConfirm(false);
                          setDayDetailsMatchError("");
                        }}
                        disabled={
                          trainingDayDetailsTabLoading || trainingNoteSaving || schedule2ActionPending
                        }
                      >
                        <span className="amp-day-details-tab-type">
                          {matchEventTypeLabel(match.eventType)}
                        </span>
                        <span className="amp-day-details-tab-time">
                          {match.matchTime}
                        </span>
                        {matchGroupName && (
                          <span className="amp-day-details-tab-label">
                            {matchGroupName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            )}
            {!trainingDayDetailsOpening && (
              <div className="amp-modal-body">
                {dayDetailsIsMatchTab && dayDetailsActiveMatch ? (
                  <TrainingDayMatchContent
                    customTrainingGroups={customTrainingGroups}
                    matchEditCustomGroups={matchEditCustomGroups}
                    schedule2DayDetails={schedule2DayDetails}
                    dayDetailsActiveMatch={dayDetailsActiveMatch}
                    dayDetailsMatchEditOpen={dayDetailsMatchEditOpen}
                    dayDetailsMatchEditForm={dayDetailsMatchEditForm}
                    setDayDetailsMatchEditForm={setDayDetailsMatchEditForm}
                    dayDetailsMatchSaving={dayDetailsMatchSaving}
                    clubId={clubId}
                    isCustomTrainingGroupMode={isCustomTrainingGroupMode}
                    dayDetailsMatchError={dayDetailsMatchError}
                    setDayDetailsMatchEditOpen={setDayDetailsMatchEditOpen}
                    setDayDetailsMatchError={setDayDetailsMatchError}
                    matchEditTarget={matchEditTarget}
                    setTrainingDayDetailsOpen={setTrainingDayDetailsOpen}
                    setMatchEditTarget={setMatchEditTarget}
                    setMatchViewPopupOpen={setMatchViewPopupOpen}
                    handleDayDetailsMatchSave={handleDayDetailsMatchSave}
                    dayDetailsMatchDeleteConfirm={dayDetailsMatchDeleteConfirm}
                    setDayDetailsMatchDeleteConfirm={
                      setDayDetailsMatchDeleteConfirm
                    }
                    handleDayDetailsMatchDelete={handleDayDetailsMatchDelete}
                    dayDetailsMatchOriginalResult={
                      dayDetailsMatchOriginalResult
                    }
                  />
                ) : schedule2DayDetails && (dayDetailsIsMatchTab || trainingAttendanceError) ? (
                  <p className="amp-confirm-error" role="alert">{dayDetailsIsMatchTab ? "Събитието вече не е в графика." : trainingAttendanceError}</p>
                ) : (
                  <>
                    <div className="amp-training-stats">
                      <span>
                        Дата:{" "}
                        {trainingAttendanceDate
                          ? formatIsoDateForDisplay(trainingAttendanceDate)
                          : "-"}
                      </span>
                      {trainingDayTime && <span>Час: {trainingDayTime}</span>}
                      <span>Общо: {trainingAttendanceStats.total}</span>
                      <span>
                        Присъстващи: {trainingAttendanceStats.attending}
                      </span>
                      <span>
                        Отсъстващи: {trainingAttendanceStats.optedOut}
                      </span>
                      <span>
                        Продължителност: {trainingDayDurationMinutes} мин.
                      </span>
                      {trainingDaySessionCancelled && (
                        <span
                          style={{
                            color: "#ff6b6b",
                            fontWeight: 700,
                            background: "rgba(255,107,107,0.12)",
                            border: "1px solid rgba(255,107,107,0.35)",
                            borderRadius: 6,
                            padding: "2px 8px",
                          }}
                        >
                          ОТМЕНЕНА
                        </span>
                      )}
                    </div>
                    {(trainingAttendanceLoading ||
                      trainingDayDetailsTabLoading) &&
                      !trainingDayField && (
                        <div className="amp-edit-field">
                          <span className="amp-lbl">Терен</span>
                          <div
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              borderRadius: 8,
                              height: 96,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              className="amp-spinner"
                              style={{ width: 24, height: 24, borderWidth: 2 }}
                            />
                          </div>
                        </div>
                      )}
                    {trainingDayField &&
                      (() => {
                        const isWholeFieldSelected =
                          trainingDayFieldPieceIds.length === 0;
                        const pieces =
                          trainingDayField.pieces.length > 0
                            ? trainingDayField.pieces
                            : [{ id: "", name: "Цял терен" }];
                        return (
                          <div className="amp-edit-field">
                            <span className="amp-lbl">Терен</span>
                            <div style={{ display: "grid", gap: "6px" }}>
                              <div
                                style={{
                                  color: isWholeFieldSelected
                                    ? "#32cd32"
                                    : "rgba(255,255,255,0.88)",
                                  fontWeight: 800,
                                  fontSize: "14px",
                                  textAlign: "center",
                                  textDecoration: isWholeFieldSelected
                                    ? "underline"
                                    : "none",
                                  textUnderlineOffset: "3px",
                                  opacity:
                                    !isWholeFieldSelected &&
                                    trainingDayFieldPieceIds.length > 0
                                      ? 0.38
                                      : 1,
                                  transition:
                                    "opacity 0.15s ease, color 0.15s ease",
                                }}
                              >
                                {trainingDayField.name}
                              </div>
                              <div
                                aria-label={`Терен ${trainingDayField.name}`}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: `repeat(${pieces.length}, minmax(0, 1fr))`,
                                  minHeight: ["boxing", "karate"].includes(
                                    trainingDayField.fieldType || "football",
                                  )
                                    ? undefined
                                    : "96px",
                                  width: ["boxing", "karate"].includes(
                                    trainingDayField.fieldType || "football",
                                  )
                                    ? "55%"
                                    : "100%",
                                  margin: ["boxing", "karate"].includes(
                                    trainingDayField.fieldType || "football",
                                  )
                                    ? "0 auto"
                                    : undefined,
                                  aspectRatio: ["boxing", "karate"].includes(
                                    trainingDayField.fieldType || "football",
                                  )
                                    ? "1 / 1"
                                    : "2.2 / 1",
                                  border: "2px solid rgba(50,205,50,0.8)",
                                  borderRadius: "8px",
                                  overflow: "hidden",
                                  background: getFieldBackground(
                                    trainingDayField.fieldType || "football",
                                  ),
                                  boxShadow:
                                    "0 0 0 1px rgba(50,205,50,0.6), 0 0 22px rgba(50,205,50,0.28)",
                                  position: "relative",
                                }}
                              >
                                {renderFieldMarkings(
                                  trainingDayField.fieldType || "football",
                                )}
                                {pieces.map((piece, index) => {
                                  const isPieceSelected =
                                    trainingDayField.pieces.length === 0
                                      ? true
                                      : trainingDayFieldPieceIds.length === 0 ||
                                        trainingDayFieldPieceIds.includes(
                                          piece.id,
                                        );
                                  return (
                                    <div
                                      key={
                                        piece.id ||
                                        `${trainingDayField.id}-whole`
                                      }
                                      style={{
                                        minWidth: 0,
                                        borderLeft:
                                          index === 0
                                            ? 0
                                            : "1px dashed rgba(255,255,255,0.68)",
                                        background: isPieceSelected
                                          ? "rgba(50,205,50,0.18)"
                                          : "rgba(0,0,0,0.52)",
                                        boxShadow: isPieceSelected
                                          ? "inset 0 0 0 2px #32cd32"
                                          : "none",
                                        color: isPieceSelected
                                          ? "#32cd32"
                                          : "rgba(255,255,255,0.42)",
                                        fontWeight: 800,
                                        fontSize: "13px",
                                        textAlign: "center",
                                        padding: "8px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        position: "relative",
                                        zIndex: 1,
                                        textShadow:
                                          "0 1px 2px rgba(0,0,0,0.55)",
                                      }}
                                    >
                                      {piece.id ? piece.name : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    <div className="amp-edit-field">
                      <span className="amp-lbl">Описание за деня</span>
                      {trainingNote.trim() ? (
                        <p className="amp-val">{trainingNote}</p>
                      ) : (
                        <p
                          className="amp-val"
                          style={{ color: "rgba(255,255,255,0.55)" }}
                        >
                          Няма описание.
                        </p>
                      )}
                    </div>
                    <div className="amp-modal-actions amp-modal-actions--end">
                      {(!schedule2DayDetails || (trainingAttendanceDate && schedulerCalendarDateSet.has(trainingAttendanceDate))) && <button
                        className="amp-btn amp-btn--ghost"
                        onClick={() => {
                          if (!trainingAttendanceDate) return;
                          setTrainingDayDetailsOpen(false);
                          void openSingleTrainingDayEditForCurrentScope(
                            trainingAttendanceDate,
                          );
                        }}
                        disabled={
                          trainingAttendanceLoading ||
                          trainingNoteSaving ||
                          !trainingAttendanceDate ||
                          trainingDayDetailsTabLoading ||
                          trainingDayCancelLoading
                        }
                      >
                        Редактирай тренировка
                      </button>}
                      {(!schedule2DayDetails || schedulerCalendarDateSet.has(trainingAttendanceDate)) && (
                        <button
                          className="amp-btn amp-btn--danger"
                          onClick={() => setTrainingDayCancelConfirmOpen(true)}
                          disabled={
                            trainingAttendanceLoading ||
                            trainingNoteSaving ||
                            !trainingAttendanceDate ||
                            trainingDayDetailsTabLoading ||
                            trainingDayCancelLoading
                          }
                        >
                          {trainingDayCancelLoading
                            ? "..."
                            : "Изтрий тренировка"}
                        </button>
                      )}
                    </div>
                    {trainingDayCancelConfirmOpen && (
                      <div
                        style={{
                          background: "rgba(255,107,107,0.08)",
                          border: "1px solid rgba(255,107,107,0.35)",
                          borderRadius: 8,
                          padding: "12px 16px",
                          marginBottom: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#ff6b6b",
                          }}
                        >
                          Сигурни ли сте, че искате да изтриете тренировката на{" "}
                          {trainingAttendanceDate
                            ? formatIsoDateForDisplay(trainingAttendanceDate)
                            : "тази дата"}
                          ?
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            color: "rgba(255,255,255,0.6)",
                          }}
                        >
                          Тренировката, присъствието, отсъствията, описанието и
                          записванията ще бъдат изтрити окончателно.
                          Възстановяването е невъзможно.
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="amp-btn amp-btn--danger"
                            onClick={() => void handleDeleteTrainingDay()}
                            disabled={trainingDayCancelLoading}
                          >
                            {trainingDayCancelLoading ? "..." : "Да, изтрий"}
                          </button>
                          <button
                            className="amp-btn amp-btn--ghost"
                            onClick={() =>
                              setTrainingDayCancelConfirmOpen(false)
                            }
                            disabled={trainingDayCancelLoading}
                          >
                            Назад
                          </button>
                        </div>
                      </div>
                    )}
                    {limitedEvent && !limitedEventLoading && (
                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(240,160,48,0.9)",
                          background: "rgba(240,160,48,0.08)",
                          border: "1px solid rgba(240,160,48,0.25)",
                          borderRadius: 6,
                          padding: "6px 10px",
                          marginBottom: 8,
                        }}
                      >
                        Ограничен режим — всички маркирани като отсъстващи.
                        Маркирайте ръчно кой е присъствал.
                      </p>
                    )}
                    <div className="amp-training-table-wrap">
                      <button
                        type="button"
                        className="amp-training-players-toggle"
                        onClick={() =>
                          setTrainingPlayersExpanded((prev) => !prev)
                        }
                        disabled={
                          trainingAttendanceLoading ||
                          trainingDayDetailsTabLoading
                        }
                      >
                        <span>Играчи ({trainingAttendanceStats.total})</span>
                        <span
                          className={`amp-training-players-toggle-arrow${trainingPlayersExpanded ? " amp-training-players-toggle-arrow--open" : ""}`}
                        >
                          ▾
                        </span>
                      </button>
                      <div
                        className={`amp-training-players-body${trainingPlayersExpanded ? " amp-training-players-body--open" : ""}`}
                      >
                        {trainingAttendanceLoading ||
                        trainingDayDetailsTabLoading ? (
                          <p className="amp-empty amp-empty--modal">
                            Зареждане...
                          </p>
                        ) : trainingAttendancePlayers.length === 0 ? (
                          <p className="amp-empty amp-empty--modal">
                            Няма състезатели за този отбор.
                          </p>
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
                                      {player.optedOut
                                        ? "Няма да присъства"
                                        : "Ще присъства"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                    {/* ── Limited spots section ── */}
                    {
                      <TrainingDayRegistrations
                        trainingDayDetailsTab={trainingDayDetailsTab}
                        limitedEvent={limitedEvent}
                        limitedEventLoading={limitedEventLoading}
                        showLimitedForm={showLimitedForm}
                        setShowLimitedForm={setShowLimitedForm}
                        limitedEventSaving={limitedEventSaving}
                        limitedEventError={limitedEventError}
                        limitedSpotsInput={limitedSpotsInput}
                        setLimitedSpotsInput={setLimitedSpotsInput}
                        clubId={clubId}
                        setLimitedEventError={setLimitedEventError}
                        setLimitedEventSaving={setLimitedEventSaving}
                        fetchLimitedEventForSession={
                          fetchLimitedEventForSession
                        }
                        trainingAttendanceDate={trainingAttendanceDate}
                        setLimitedEvent={setLimitedEvent}
                      />
                    }
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

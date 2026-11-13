"use client";

import { TimeInput } from "@/components/TimeInput";
import MatchExtraFields from "@/components/MatchExtraFields";
import { matchCategoryLabel } from "@/lib/matchCategory";

import MatchOverlapWarning from "@/components/MatchOverlapWarning";
import { MatchResultFields } from "@/components/MatchResultFields";
import { hasMatchFinished } from "@/lib/matchResult";
import MatchAttendancePanel from "@/components/MatchAttendancePanel";

import { isCustomTrainingGroupPaletteColor } from "@/lib/customTrainingGroupColors";

import type { TrainingDayDetailsDialogProps } from "./TrainingDayDetailsDialog";
type Props = {
  schedule2DayDetails: boolean;
  matchEditCustomGroups: TrainingDayDetailsDialogProps["matchEditCustomGroups"];
  customTrainingGroups: TrainingDayDetailsDialogProps["trainingGroups"]["customTrainingGroups"];
  dayDetailsActiveMatch: NonNullable<
    TrainingDayDetailsDialogProps["dayDetailsActiveMatch"]
  >;
  dayDetailsMatchEditOpen: TrainingDayDetailsDialogProps["matchEditorState"]["dayDetailsMatchEditOpen"];
  dayDetailsMatchEditForm: TrainingDayDetailsDialogProps["matchEditorState"]["dayDetailsMatchEditForm"];
  setDayDetailsMatchEditForm: TrainingDayDetailsDialogProps["matchEditorState"]["setDayDetailsMatchEditForm"];
  dayDetailsMatchSaving: TrainingDayDetailsDialogProps["matchEditorState"]["dayDetailsMatchSaving"];
  clubId: TrainingDayDetailsDialogProps["clubId"];
  isCustomTrainingGroupMode: TrainingDayDetailsDialogProps["trainingGroups"]["isCustomTrainingGroupMode"];
  dayDetailsMatchError: TrainingDayDetailsDialogProps["matchEditorState"]["dayDetailsMatchError"];
  setDayDetailsMatchEditOpen: TrainingDayDetailsDialogProps["matchEditorState"]["setDayDetailsMatchEditOpen"];
  setDayDetailsMatchError: TrainingDayDetailsDialogProps["matchEditorState"]["setDayDetailsMatchError"];
  matchEditTarget: TrainingDayDetailsDialogProps["matchEditorState"]["matchEditTarget"];
  setTrainingDayDetailsOpen: TrainingDayDetailsDialogProps["trainingAttendanceState"]["setTrainingDayDetailsOpen"];
  setMatchEditTarget: TrainingDayDetailsDialogProps["matchEditorState"]["setMatchEditTarget"];
  setMatchViewPopupOpen: TrainingDayDetailsDialogProps["matchEditorState"]["setMatchViewPopupOpen"];
  handleDayDetailsMatchSave: TrainingDayDetailsDialogProps["handleDayDetailsMatchSave"];
  dayDetailsMatchDeleteConfirm: TrainingDayDetailsDialogProps["matchEditorState"]["dayDetailsMatchDeleteConfirm"];
  setDayDetailsMatchDeleteConfirm: TrainingDayDetailsDialogProps["matchEditorState"]["setDayDetailsMatchDeleteConfirm"];
  handleDayDetailsMatchDelete: TrainingDayDetailsDialogProps["handleDayDetailsMatchDelete"];
  dayDetailsMatchOriginalResult: TrainingDayDetailsDialogProps["matchEditorState"]["dayDetailsMatchOriginalResult"];
};
export function TrainingDayMatchContent({
  customTrainingGroups,
  matchEditCustomGroups,
  schedule2DayDetails,
  dayDetailsActiveMatch,
  dayDetailsMatchEditOpen,
  dayDetailsMatchEditForm,
  setDayDetailsMatchEditForm,
  dayDetailsMatchSaving,
  clubId,
  isCustomTrainingGroupMode,
  dayDetailsMatchError,
  setDayDetailsMatchEditOpen,
  setDayDetailsMatchError,
  matchEditTarget,
  setTrainingDayDetailsOpen,
  setMatchEditTarget,
  setMatchViewPopupOpen,
  handleDayDetailsMatchSave,
  dayDetailsMatchDeleteConfirm,
  setDayDetailsMatchDeleteConfirm,
  handleDayDetailsMatchDelete,
  dayDetailsMatchOriginalResult: dayDetailsMatchOriginalResultRef,
}: Props) {
  const matchGroup =
    customTrainingGroups.find(
      (g) => g.id === dayDetailsActiveMatch.customGroupId,
    ) ?? null;
  const matchGroupName = matchGroup?.name ?? matchEditCustomGroups.find(({ id }) => id === dayDetailsActiveMatch.customGroupId)?.name;
  const matchGroupColor =
    matchGroup?.color && isCustomTrainingGroupPaletteColor(matchGroup.color)
      ? matchGroup.color
      : null;
  return dayDetailsMatchEditOpen ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="amp-edit-field">
        <span className="amp-lbl">Дата</span>
        <input
          type="date"
          className="amp-edit-input"
          value={dayDetailsMatchEditForm.matchDate}
          onChange={(e) =>
            setDayDetailsMatchEditForm((f) => ({
              ...f,
              matchDate: e.target.value,
            }))
          }
          disabled={dayDetailsMatchSaving}
        />
      </div>
      <div className="amp-edit-field">
        <span className="amp-lbl">Час</span>
        <TimeInput
          className="amp-edit-input"
          value={dayDetailsMatchEditForm.matchTime}
          onValueChange={(value) =>
            setDayDetailsMatchEditForm((f) => ({ ...f, matchTime: value }))
          }
          disabled={dayDetailsMatchSaving}
        />
      </div>
      <div className="amp-edit-field">
        <span className="amp-lbl">Продължителност (мин.)</span>
        <input
          type="number"
          className="amp-edit-input"
          min={1}
          max={1440}
          value={dayDetailsMatchEditForm.durationMinutes}
          onChange={(e) =>
            setDayDetailsMatchEditForm((f) => ({
              ...f,
              durationMinutes: e.target.value,
            }))
          }
          disabled={dayDetailsMatchSaving}
        />
      </div>
      {clubId && (
        <MatchOverlapWarning
          clubId={clubId}
          date={dayDetailsMatchEditForm.matchDate}
          time={dayDetailsMatchEditForm.matchTime}
          duration={dayDetailsMatchEditForm.durationMinutes}
          isHome={dayDetailsMatchEditForm.isHome}
          excludeMatchId={dayDetailsActiveMatch.id}
        />
      )}
      <div className="amp-edit-field">
        <span className="amp-lbl">Домакин / Гост</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={`amp-btn${dayDetailsMatchEditForm.isHome ? " amp-btn--primary" : " amp-btn--ghost"}`}
            onClick={() =>
              setDayDetailsMatchEditForm((f) => ({ ...f, isHome: true }))
            }
            disabled={dayDetailsMatchSaving}
          >
            Домакин
          </button>
          <button
            type="button"
            className={`amp-btn${!dayDetailsMatchEditForm.isHome ? " amp-btn--primary" : " amp-btn--ghost"}`}
            onClick={() =>
              setDayDetailsMatchEditForm((f) => ({ ...f, isHome: false }))
            }
            disabled={dayDetailsMatchSaving}
          >
            Гост
          </button>
        </div>
      </div>
      <div className="amp-edit-field">
        <span className="amp-lbl">Съперник</span>
        <input
          type="text"
          className="amp-edit-input"
          value={dayDetailsMatchEditForm.opponent}
          onChange={(e) =>
            setDayDetailsMatchEditForm((f) => ({
              ...f,
              opponent: e.target.value,
            }))
          }
          placeholder="Съперник"
          disabled={dayDetailsMatchSaving}
        />
      </div>
      <div className="amp-edit-field">
        <span className="amp-lbl">Място</span>
        <input
          type="text"
          className="amp-edit-input"
          value={dayDetailsMatchEditForm.location}
          onChange={(e) =>
            setDayDetailsMatchEditForm((f) => ({
              ...f,
              location: e.target.value,
            }))
          }
          placeholder="Стадион / адрес"
          disabled={dayDetailsMatchSaving}
        />
      </div>
      {(schedule2DayDetails || isCustomTrainingGroupMode) && matchEditCustomGroups.length > 0 && (
        <div className="amp-edit-field">
          <span className="amp-lbl">Група</span>
          <select
            className="amp-edit-input"
            value={dayDetailsMatchEditForm.customGroupId ?? ""}
            onChange={(e) =>
              setDayDetailsMatchEditForm((f) => ({
                ...f,
                customGroupId: e.target.value || null,
              }))
            }
            disabled={dayDetailsMatchSaving}
          >
            <option value="" disabled={schedule2DayDetails && Boolean(dayDetailsActiveMatch.customGroupId)}>— без група —</option>
            {matchEditCustomGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <MatchExtraFields
        description={dayDetailsMatchEditForm.description}
        category={dayDetailsMatchEditForm.category}
        disabled={dayDetailsMatchSaving}
        onChange={(fields) =>
          setDayDetailsMatchEditForm((form) => ({ ...form, ...fields }))
        }
      />
      {hasMatchFinished(dayDetailsActiveMatch) && (
        <MatchResultFields
          isHome={dayDetailsMatchEditForm.isHome}
          opponent={dayDetailsMatchEditForm.opponent}
          homeScore={dayDetailsMatchEditForm.homeScore}
          awayScore={dayDetailsMatchEditForm.awayScore}
          onChange={(homeScore, awayScore) =>
            setDayDetailsMatchEditForm((form) => ({
              ...form,
              homeScore,
              awayScore,
            }))
          }
          disabled={dayDetailsMatchSaving}
        />
      )}
      {dayDetailsMatchError && (
        <p style={{ color: "#ff6b6b", fontSize: 13, margin: 0 }}>
          {dayDetailsMatchError}
        </p>
      )}
      <div className="amp-modal-actions amp-modal-actions--end">
        <button
          type="button"
          className="amp-btn amp-btn--ghost"
          onClick={() => {
            setDayDetailsMatchEditOpen(false);
            setDayDetailsMatchError("");
            if (matchEditTarget) {
              setTrainingDayDetailsOpen(false);
              setMatchEditTarget(null);
              setMatchViewPopupOpen(true);
            }
          }}
          disabled={dayDetailsMatchSaving}
        >
          Назад
        </button>
        <button
          type="button"
          className="amp-btn amp-btn--primary"
          onClick={() => void handleDayDetailsMatchSave()}
          disabled={dayDetailsMatchSaving}
        >
          {dayDetailsMatchSaving ? "Запазване..." : "Запази"}
        </button>
      </div>
    </div>
  ) : dayDetailsMatchDeleteConfirm ? (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        alignItems: "center",
        textAlign: "center",
        padding: "8px 0",
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.88)", margin: 0 }}>
        Сигурни ли сте, че искате да изтриете този мач?
      </p>
      {dayDetailsMatchError && (
        <p style={{ color: "#ff6b6b", fontSize: 13, margin: 0 }}>
          {dayDetailsMatchError}
        </p>
      )}
      <div className="amp-modal-actions amp-modal-actions--end">
        <button
          type="button"
          className="amp-btn amp-btn--ghost"
          onClick={() => {
            setDayDetailsMatchDeleteConfirm(false);
            setDayDetailsMatchError("");
          }}
          disabled={dayDetailsMatchSaving}
        >
          Отказ
        </button>
        <button
          type="button"
          className="amp-btn amp-btn--danger"
          onClick={() => void handleDayDetailsMatchDelete()}
          disabled={dayDetailsMatchSaving}
        >
          {dayDetailsMatchSaving ? "Изтриване..." : "Изтрий мача"}
        </button>
      </div>
    </div>
  ) : (
    <>
      <p className="amp-match-view-date">
        {new Date(
          `${dayDetailsActiveMatch.matchDate}T12:00:00.000Z`,
        ).toLocaleDateString("bg-BG", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </p>
      <div className="amp-match-view-body">
        {matchGroupName && (
          <div className="amp-match-view-row">
            <span className="amp-match-view-label">Група</span>
            <span
              className="amp-match-view-value"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {matchGroupColor && (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: matchGroupColor,
                    flexShrink: 0,
                  }}
                />
              )}
              {matchGroupName}
            </span>
          </div>
        )}
        <div className="amp-match-view-row">
          <span className="amp-match-view-label">Съперник</span>
          <span className="amp-match-view-value">
            {dayDetailsActiveMatch.opponent || "—"}
          </span>
        </div>
        <div className="amp-match-view-row">
          <span className="amp-match-view-label">Домакин/Гост</span>
          <span
            className={`amp-match-view-badge${dayDetailsActiveMatch.isHome ? " amp-match-view-badge--home" : " amp-match-view-badge--away"}`}
          >
            {dayDetailsActiveMatch.isHome ? "Домакин" : "Гост"}
          </span>
        </div>
        <div className="amp-match-view-row">
          <span className="amp-match-view-label">Час</span>
          <span className="amp-match-view-value">
            {dayDetailsActiveMatch.matchTime || "—"}
          </span>
        </div>
        <div className="amp-match-view-row">
          <span className="amp-match-view-label">Място</span>
          <span className="amp-match-view-value">
            {dayDetailsActiveMatch.location || "—"}
          </span>
        </div>
        <div className="amp-match-view-row">
          <span className="amp-match-view-label">Характер на срещата</span>
          <span className="amp-match-view-value">
            {matchCategoryLabel(dayDetailsActiveMatch.category)}
          </span>
        </div>
        {dayDetailsActiveMatch.description && (
          <div className="amp-match-view-row">
            <span className="amp-match-view-label">Описание</span>
            <span
              className="amp-match-view-value"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {dayDetailsActiveMatch.description}
            </span>
          </div>
        )}
        {dayDetailsActiveMatch.durationMinutes > 0 && (
          <div className="amp-match-view-row">
            <span className="amp-match-view-label">Продължителност</span>
            <span className="amp-match-view-value">
              {dayDetailsActiveMatch.durationMinutes} мин
            </span>
          </div>
        )}
        {clubId && (
          <MatchAttendancePanel
            key={dayDetailsActiveMatch.id}
            clubId={clubId}
            matchId={dayDetailsActiveMatch.id}
          />
        )}
      </div>
      <div
        className="amp-modal-actions amp-modal-actions--end"
        style={{ marginTop: "8px" }}
      >
        <button
          type="button"
          className="amp-btn amp-btn--danger"
          onClick={() => {
            setDayDetailsMatchDeleteConfirm(true);
            setDayDetailsMatchError("");
          }}
        >
          Изтрий мача
        </button>
        <button
          type="button"
          className="amp-btn amp-btn--ghost"
          onClick={() => {
            dayDetailsMatchOriginalResultRef.current = {
              homeScore: dayDetailsActiveMatch.homeScore,
              awayScore: dayDetailsActiveMatch.awayScore,
            };
            setDayDetailsMatchEditForm({
              description: dayDetailsActiveMatch.description ?? "",
              category: dayDetailsActiveMatch.category ?? "",
              opponent: dayDetailsActiveMatch.opponent,
              location: dayDetailsActiveMatch.location,
              matchDate: dayDetailsActiveMatch.matchDate,
              matchTime: dayDetailsActiveMatch.matchTime,
              durationMinutes: String(dayDetailsActiveMatch.durationMinutes),
              isHome: dayDetailsActiveMatch.isHome,
              customGroupId: dayDetailsActiveMatch.customGroupId,
              homeScore: String(dayDetailsActiveMatch.homeScore ?? ""),
              awayScore: String(dayDetailsActiveMatch.awayScore ?? ""),
            });
            setDayDetailsMatchError("");
            setDayDetailsMatchEditOpen(true);
          }}
        >
          Редактирай
        </button>
      </div>
    </>
  );
}

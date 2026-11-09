"use client";

import { type MemberProfile } from "../_types/member-types";
import { MONTH_NAMES_BG } from "../_utils/member-display";
import { ChevronIcon, XIcon } from "./MemberIcons";

type Props = {
  pauseModalOpen: boolean;
  pauseActionLoading: boolean;
  setPauseModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  member: MemberProfile;
  setCalendarYear: React.Dispatch<React.SetStateAction<number>>;
  calendarYear: number;
  paidSet: Set<string>;
  waivedSet: Set<string>;
  selectedPauseKeys: Set<string>;
  togglePauseMonth: (ym: { year: number; month: number }) => void;
  pauseReason: string;
  setPauseReason: React.Dispatch<React.SetStateAction<string>>;
  pauseError: string | null;
  handleManagePauseMonths: (mode: "pause" | "remove") => Promise<void>;
  canRemovePause: boolean;
  canApplyPause: boolean;
};

export function MemberPauseDialog({
  pauseModalOpen,
  pauseActionLoading,
  setPauseModalOpen,
  member,
  setCalendarYear,
  calendarYear,
  paidSet,
  waivedSet,
  selectedPauseKeys,
  togglePauseMonth,
  pauseReason,
  setPauseReason,
  pauseError,
  handleManagePauseMonths,
  canRemovePause,
  canApplyPause,
}: Props) {
  return (
    <>
      {pauseModalOpen && (
        <div
          className="pm-overlay"
          onClick={() => !pauseActionLoading && setPauseModalOpen(false)}
        >
          <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="pm-close"
              onClick={() => !pauseActionLoading && setPauseModalOpen(false)}
            >
              <XIcon size={16} />
            </button>

            <div className="pm-header">
              <div className="pm-title-icon">II</div>
              <div>
                <h2 className="pm-title">Архивирай</h2>
                <p className="pm-name">{member.name}</p>
              </div>
            </div>

            <div className="pm-divider" />

            <div className="pm-year-nav">
              <button
                className="pm-year-btn"
                onClick={() => setCalendarYear((y) => y - 1)}
              >
                <ChevronIcon direction="left" />
              </button>
              <span className="pm-year-label">{calendarYear}</span>
              <button
                className="pm-year-btn"
                onClick={() => setCalendarYear((y) => y + 1)}
              >
                <ChevronIcon direction="right" />
              </button>
            </div>

            <div className="pm-months-grid">
              {MONTH_NAMES_BG.map((name, i) => {
                const ym = { year: calendarYear, month: i };
                const key = `${ym.year}-${ym.month}`;
                const isPaid = paidSet.has(key);
                const isWaived = waivedSet.has(key);
                const isSelected = selectedPauseKeys.has(key);

                return (
                  <button
                    key={i}
                    className={`pm-month-btn ${isSelected ? "pm-month-btn--selected" : isWaived ? "pm-month-btn--waived" : "pm-month-btn--available"}`}
                    disabled={isPaid}
                    title={
                      isPaid
                        ? "Вече платен месец не може да бъде освободен."
                        : isWaived
                          ? "Месецът е вече в пауза."
                          : undefined
                    }
                    onClick={() => togglePauseMonth(ym)}
                  >
                    {name}
                    {isPaid && <span className="pm-paid-dot" />}
                    {isWaived && <span className="pm-waived-dot" />}
                  </button>
                );
              })}
            </div>

            <label style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <span className="pm-info-lbl">Причина (по избор)</span>
              <input
                value={pauseReason}
                onChange={(event) => setPauseReason(event.target.value)}
                placeholder="напр. контузия, пътуване, изпити"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  color: "#fff",
                }}
              />
            </label>

            {pauseError && <div className="pm-error">{pauseError}</div>}

            <div className="pm-divider" />

            <div className="pm-actions">
              <button
                className="pm-btn pm-btn--cancel"
                onClick={() => setPauseModalOpen(false)}
                disabled={pauseActionLoading}
              >
                Отказ
              </button>
              <button
                className="pm-btn pm-btn--ghost"
                onClick={() => void handleManagePauseMonths("remove")}
                disabled={pauseActionLoading || !canRemovePause}
              >
                {pauseActionLoading ? "Запазване..." : "Премахни пауза"}
              </button>
              <button
                className="pm-btn pm-btn--submit"
                onClick={() => void handleManagePauseMonths("pause")}
                disabled={pauseActionLoading || !canApplyPause}
              >
                {pauseActionLoading ? "Запазване..." : "Приложи пауза"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

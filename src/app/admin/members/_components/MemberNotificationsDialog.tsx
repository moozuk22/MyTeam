"use client";

import type * as React from "react";
import { NotificationImageAttachment } from "@/components/NotificationImageAttachment";
import { XIcon, BellIcon } from "./members-page-icons";
import { type CoachGroups } from "../_hooks/useCoachGroups";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type MemberNotifications } from "../_hooks/useMemberNotifications";

type MemberNotificationsDialogProps = {
  memberNotifications: Pick<
    MemberNotifications,
    | "notifyPanelOpen"
    | "notifyBusy"
    | "setNotifyPanelOpen"
    | "notifyCoachGroupFilter"
    | "setNotifyCoachGroupFilter"
    | "setNotifySelectedIds"
    | "notifyGroupFilter"
    | "setNotifyGroupFilter"
    | "notifySearchTerm"
    | "setNotifySearchTerm"
    | "notifyVisibleMembers"
    | "notifySelectedIds"
    | "notifyMessage"
    | "setNotifyMessage"
    | "notifyImage"
    | "setNotifyImage"
    | "notifyError"
    | "notifySuccess"
    | "handleSendNotify"
  >;
  coachGroupManagement: Pick<CoachGroups, "loadCoachGroups" | "coachGroups">;
  trainingGroups: Pick<
    TrainingGroups,
    "isCustomTrainingGroupMode" | "customTrainingGroups" | "trainingScheduleGroups"
  >;
  coachMessageOpen: boolean;
  isAdmin: boolean;
  isCoach: boolean;
  clubId: string;
  setCoachMessageOpen: React.Dispatch<React.SetStateAction<boolean>>;
  coachGroupId: string;
  groupOptions: number[];
};

export function MemberNotificationsDialog({
  memberNotifications,
  coachGroupManagement,
  trainingGroups,
  coachMessageOpen,
  isAdmin,
  isCoach,
  clubId,
  setCoachMessageOpen,
  coachGroupId,
  groupOptions,
}: MemberNotificationsDialogProps) {
  const {
    notifyPanelOpen,
    notifyBusy,
    setNotifyPanelOpen,
    notifyCoachGroupFilter,
    setNotifyCoachGroupFilter,
    setNotifySelectedIds,
    notifyGroupFilter,
    setNotifyGroupFilter,
    notifySearchTerm,
    setNotifySearchTerm,
    notifyVisibleMembers,
    notifySelectedIds,
    notifyMessage,
    setNotifyMessage,
    notifyImage,
    setNotifyImage,
    notifyError,
    notifySuccess,
    handleSendNotify,
  } = memberNotifications;
  const { loadCoachGroups, coachGroups } = coachGroupManagement;
  const { isCustomTrainingGroupMode, customTrainingGroups, trainingScheduleGroups } = trainingGroups;
  return (
    <>
      {notifyPanelOpen && !coachMessageOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!notifyBusy) setNotifyPanelOpen(false);
          }}
        >
          <div
            className="amp-modal amp-modal--confirm amp-modal--notify"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Изпрати съобщение</span>
              <button
                className="amp-modal-close"
                onClick={() => setNotifyPanelOpen(false)}
                disabled={notifyBusy}
                aria-label="Затвори"
                type="button"
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {(isAdmin || isCoach) && clubId && (
                <button
                  className="amp-btn amp-btn--ghost amp-btn--compact"
                  type="button"
                  disabled={notifyBusy}
                  style={{ marginBottom: 16 }}
                  onClick={async () => {
                    await loadCoachGroups();
                    setCoachMessageOpen(true);
                  }}
                >
                  <BellIcon />
                  <span>Изпрати до треньори</span>
                </button>
              )}
              {(isAdmin || isCoach) && !coachGroupId && coachGroups.length > 0 && (
                <label className="amp-edit-field" style={{ marginBottom: "12px" }}>
                  <span className="amp-lbl">Група треньор</span>
                  <select
                    className="amp-edit-input"
                    value={notifyCoachGroupFilter}
                    onChange={(e) => {
                      setNotifyCoachGroupFilter(e.target.value);
                      setNotifySelectedIds(new Set());
                    }}
                    disabled={notifyBusy}
                  >
                    <option value="">Всички</option>
                    {coachGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {groupOptions.length > 0 && (
                <label className="amp-edit-field" style={{ marginBottom: "12px" }}>
                  <span className="amp-lbl">Отбор / група</span>
                  <select
                    className="amp-edit-input"
                    value={notifyGroupFilter}
                    onChange={(e) => {
                      setNotifyGroupFilter(e.target.value);
                      setNotifySelectedIds(new Set());
                    }}
                    disabled={notifyBusy}
                  >
                    <option value="all">Всички</option>
                    {isCustomTrainingGroupMode ? (
                      customTrainingGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))
                    ) : (
                      <>
                        {trainingScheduleGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                        {groupOptions.map((g) => (
                          <option key={g} value={String(g)}>
                            {g}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </label>
              )}
              <label className="amp-edit-field" style={{ marginBottom: "12px" }}>
                <span className="amp-lbl">Търсене</span>
                <input
                  className="amp-edit-input"
                  type="search"
                  placeholder="Търси по име..."
                  value={notifySearchTerm}
                  onChange={(e) => setNotifySearchTerm(e.target.value)}
                  disabled={notifyBusy}
                />
              </label>
              <div className="amp-notify-count" style={{ marginBottom: "8px" }}>
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost amp-btn--compact"
                  style={{ marginRight: "8px" }}
                  disabled={notifyBusy || notifyVisibleMembers.length === 0}
                  onClick={() => setNotifySelectedIds(new Set(notifyVisibleMembers.map((m) => m.id)))}
                >
                  Избери всички видими ({notifyVisibleMembers.length})
                </button>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
                  Избрани: {notifySelectedIds.size} от {notifyVisibleMembers.length} видими
                </span>
              </div>
              <div className="amp-notify-player-list">
                {notifyVisibleMembers.length === 0 ? (
                  <p
                    style={{
                      padding: "12px",
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.4)",
                      textAlign: "center",
                    }}
                  >
                    Няма състезатели
                  </p>
                ) : (
                  notifyVisibleMembers.map((m) => (
                    <label
                      key={m.id}
                      className={`amp-notify-player-item${notifySelectedIds.has(m.id) ? " amp-notify-player-item--selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={notifySelectedIds.has(m.id)}
                        disabled={notifyBusy}
                        onChange={(e) => {
                          setNotifySelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(m.id);
                            else next.delete(m.id);
                            return next;
                          });
                        }}
                      />
                      <span className="amp-notify-player-name">{m.fullName}</span>
                      {m.teamGroup !== null && <span className="amp-notify-player-group">{m.teamGroup}</span>}
                    </label>
                  ))
                )}
              </div>
              <label className="amp-edit-field" style={{ marginTop: "16px" }}>
                <span className="amp-lbl">Съобщение</span>
                <textarea
                  className="amp-edit-input amp-notify-textarea"
                  placeholder="Въведете съобщение..."
                  value={notifyMessage}
                  rows={4}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  disabled={notifyBusy}
                  style={{ height: "auto", resize: "vertical", padding: "8px 10px" }}
                />
              </label>
              <NotificationImageAttachment
                file={notifyImage}
                onChange={setNotifyImage}
                disabled={notifyBusy}
              />
              {notifyError && (
                <p className="amp-confirm-error" style={{ marginTop: "8px" }}>
                  {notifyError}
                </p>
              )}
              {notifySuccess && (
                <p style={{ color: "#9cff9c", fontSize: "13px", fontWeight: 600, marginTop: "8px" }}>
                  {notifySuccess}
                </p>
              )}
              <div className="amp-modal-actions" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setNotifyPanelOpen(false)}
                  disabled={notifyBusy}
                >
                  Затвори
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  disabled={notifyBusy || notifySelectedIds.size === 0 || !notifyMessage.trim()}
                  onClick={() => void handleSendNotify()}
                >
                  {notifyBusy ? "Изпращане..." : `Изпрати до ${notifySelectedIds.size}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

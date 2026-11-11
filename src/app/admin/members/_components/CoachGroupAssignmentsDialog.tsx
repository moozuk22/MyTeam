"use client";

import GroupAssignmentFeeNotice from "@/app/admin/members/_components/GroupAssignmentFeeNotice";
import { XIcon } from "./members-page-icons";
import { type CoachGroups } from "../_hooks/useCoachGroups";
import { type ClubSettings } from "../_hooks/useClubSettings";
import { type CoachGroupAssignments } from "../_hooks/useCoachGroupAssignments";

type CoachGroupAssignmentsDialogProps = {
  coachGroupAssignments: Pick<
    CoachGroupAssignments,
    | "bulkCoachGroupTargetId"
    | "bulkCoachGroupBusy"
    | "setBulkCoachGroupTargetId"
    | "bulkCoachGroupSearchTerm"
    | "setBulkCoachGroupSearchTerm"
    | "bulkCoachGroupLoadingMembers"
    | "bulkCoachGroupVisibleMembers"
    | "setBulkCoachGroupSelectedIds"
    | "bulkCoachGroupSelectedIds"
    | "bulkCoachGroupFeePreview"
    | "bulkCoachGroupFeeSettings"
    | "setBulkCoachGroupBillingChoices"
    | "setBulkCoachGroupError"
    | "bulkCoachGroupError"
    | "bulkCoachGroupSaved"
    | "bulkCoachGroupHasFeeConflicts"
    | "handleBulkCoachGroupSave"
  >;
  coachGroupManagement: Pick<CoachGroups, "coachGroups">;
  clubSettings: Pick<ClubSettings, "feeAssignments" | "setFeeDeleteGroupId" | "setPaymentAmountModalOpen">;
};

export function CoachGroupAssignmentsDialog({
  coachGroupAssignments,
  coachGroupManagement,
  clubSettings,
}: CoachGroupAssignmentsDialogProps) {
  const {
    bulkCoachGroupTargetId,
    bulkCoachGroupBusy,
    setBulkCoachGroupTargetId,
    bulkCoachGroupSearchTerm,
    setBulkCoachGroupSearchTerm,
    bulkCoachGroupLoadingMembers,
    bulkCoachGroupVisibleMembers,
    setBulkCoachGroupSelectedIds,
    bulkCoachGroupSelectedIds,
    bulkCoachGroupFeePreview,
    bulkCoachGroupFeeSettings,
    setBulkCoachGroupBillingChoices,
    setBulkCoachGroupError,
    bulkCoachGroupError,
    bulkCoachGroupSaved,
    bulkCoachGroupHasFeeConflicts,
    handleBulkCoachGroupSave,
  } = coachGroupAssignments;
  const { coachGroups } = coachGroupManagement;
  const { feeAssignments, setFeeDeleteGroupId, setPaymentAmountModalOpen } = clubSettings;
  return (
    <>
      {bulkCoachGroupTargetId && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            if (!bulkCoachGroupBusy) setBulkCoachGroupTargetId(null);
          }}
        >
          <div
            className="amp-modal amp-modal--confirm amp-modal--notify"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">
                {coachGroups.find((g) => g.id === bulkCoachGroupTargetId)?.name ?? "Управление на група"}
              </span>
              <button
                className="amp-modal-close"
                onClick={() => setBulkCoachGroupTargetId(null)}
                disabled={bulkCoachGroupBusy}
                aria-label="Затвори"
                type="button"
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <label className="amp-edit-field" style={{ marginBottom: "12px" }}>
                <span className="amp-lbl">Търсене</span>
                <input
                  className="amp-edit-input"
                  type="search"
                  placeholder="Търси по име..."
                  value={bulkCoachGroupSearchTerm}
                  onChange={(e) => setBulkCoachGroupSearchTerm(e.target.value)}
                  disabled={bulkCoachGroupBusy}
                />
              </label>
              <div className="amp-notify-count" style={{ marginBottom: "8px" }}>
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost amp-btn--compact"
                  style={{ marginRight: "8px" }}
                  disabled={
                    bulkCoachGroupBusy ||
                    bulkCoachGroupLoadingMembers ||
                    bulkCoachGroupVisibleMembers.length === 0
                  }
                  onClick={() =>
                    setBulkCoachGroupSelectedIds(new Set(bulkCoachGroupVisibleMembers.map((m) => m.id)))
                  }
                >
                  Избери всички видими ({bulkCoachGroupVisibleMembers.length})
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost amp-btn--compact"
                  disabled={
                    bulkCoachGroupBusy || bulkCoachGroupLoadingMembers || bulkCoachGroupSelectedIds.size === 0
                  }
                  onClick={() => setBulkCoachGroupSelectedIds(new Set())}
                >
                  Изчисти
                </button>
              </div>
              <GroupAssignmentFeeNotice
                rows={bulkCoachGroupFeePreview}
                clubAmount={bulkCoachGroupFeeSettings?.paymentAmount ?? ""}
                busy={bulkCoachGroupBusy}
                onChoice={(playerId, groupId) => {
                  setBulkCoachGroupBillingChoices((prev) => ({ ...prev, [playerId]: groupId }));
                  setBulkCoachGroupError("");
                }}
              />
              <div className="amp-notify-player-list">
                {bulkCoachGroupLoadingMembers ? (
                  <p
                    style={{
                      padding: "12px",
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.4)",
                      textAlign: "center",
                    }}
                  >
                    Зареждане...
                  </p>
                ) : bulkCoachGroupVisibleMembers.length === 0 ? (
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
                  bulkCoachGroupVisibleMembers.map((m) => {
                    const isSelected = bulkCoachGroupSelectedIds.has(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`amp-notify-player-item${isSelected ? " amp-notify-player-item--selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={bulkCoachGroupBusy}
                          onChange={(e) => {
                            setBulkCoachGroupSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(m.id);
                              else next.delete(m.id);
                              return next;
                            });
                          }}
                        />
                        <span className="amp-notify-player-name">{m.fullName}</span>
                        {m.teamGroup !== null && (
                          <span className="amp-notify-player-group">{m.teamGroup}</span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
              {bulkCoachGroupError && (
                <div role="alert">
                  <p className="amp-confirm-error" style={{ marginTop: "8px" }}>
                    {bulkCoachGroupError}
                  </p>
                  {feeAssignments && (
                    <button
                      type="button"
                      className="amp-btn amp-btn--ghost"
                      onClick={() => {
                        setFeeDeleteGroupId(undefined);
                        setPaymentAmountModalOpen(true);
                      }}
                    >
                      Преглед на месечните такси и избор на група
                    </button>
                  )}
                </div>
              )}
              <div className="amp-modal-actions" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setBulkCoachGroupTargetId(null)}
                  disabled={bulkCoachGroupBusy}
                >
                  Затвори
                </button>
                <button
                  type="button"
                  className={`amp-btn amp-btn--primary${bulkCoachGroupSaved ? " amp-btn--saved" : ""}`}
                  disabled={
                    bulkCoachGroupBusy ||
                    bulkCoachGroupSaved ||
                    bulkCoachGroupLoadingMembers ||
                    !bulkCoachGroupFeeSettings ||
                    bulkCoachGroupHasFeeConflicts
                  }
                  onClick={() => void handleBulkCoachGroupSave()}
                >
                  {bulkCoachGroupBusy
                    ? "Запазване..."
                    : bulkCoachGroupSaved
                      ? "✓ Записано"
                      : `Запази (${bulkCoachGroupSelectedIds.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

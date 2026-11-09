"use client";

import { XIcon, PencilIcon } from "./members-page-icons";
import { type CoachGroups } from "../_hooks/useCoachGroups";
import { type ClubSettings } from "../_hooks/useClubSettings";

type CoachGroupsDialogProps = {
  coachGroupManagement: Pick<
    CoachGroups,
    | "coachGroupsPanelOpen"
    | "setCoachGroupsPanelOpen"
    | "setCoachGroupCreateName"
    | "setCoachGroupCreateError"
    | "setCoachGroupDeleteId"
    | "setCoachGroupEditId"
    | "setCoachGroupEditName"
    | "setCoachGroupEditError"
    | "coachGroupCreateName"
    | "coachGroupCreateSaving"
    | "setCoachGroupCreateSaving"
    | "loadCoachGroups"
    | "coachGroupCreateError"
    | "coachGroups"
    | "coachGroupEditId"
    | "coachGroupEditName"
    | "coachGroupEditSaving"
    | "setCoachGroupEditSaving"
    | "coachGroupEditError"
    | "coachGroupDeleteId"
    | "setCoachGroupCopiedId"
    | "coachGroupCopiedId"
    | "coachGroupDeleteSaving"
    | "setCoachGroupDeleteSaving"
  >;
  clubSettings: Pick<ClubSettings, "setFeeAssignments" | "setFeeDeleteGroupId" | "setPaymentAmountModalOpen">;
  isAdmin: boolean;
  isCoach: boolean;
  clubId: string;
  refreshMembersList: () => Promise<void>;
};

export function CoachGroupsDialog({
  coachGroupManagement,
  clubSettings,
  isAdmin,
  isCoach,
  clubId,
  refreshMembersList,
}: CoachGroupsDialogProps) {
  const {
    coachGroupsPanelOpen,
    setCoachGroupsPanelOpen,
    setCoachGroupCreateName,
    setCoachGroupCreateError,
    setCoachGroupDeleteId,
    setCoachGroupEditId,
    setCoachGroupEditName,
    setCoachGroupEditError,
    coachGroupCreateName,
    coachGroupCreateSaving,
    setCoachGroupCreateSaving,
    loadCoachGroups,
    coachGroupCreateError,
    coachGroups,
    coachGroupEditId,
    coachGroupEditName,
    coachGroupEditSaving,
    setCoachGroupEditSaving,
    coachGroupEditError,
    coachGroupDeleteId,
    setCoachGroupCopiedId,
    coachGroupCopiedId,
    coachGroupDeleteSaving,
    setCoachGroupDeleteSaving,
  } = coachGroupManagement;
  const { setFeeAssignments, setFeeDeleteGroupId, setPaymentAmountModalOpen } = clubSettings;
  return (
    <>
      {coachGroupsPanelOpen && (isAdmin || isCoach) && (
        <div
          className="amp-overlay amp-overlay--confirm"
          onClick={() => {
            setCoachGroupsPanelOpen(false);
            setCoachGroupCreateName("");
            setCoachGroupCreateError("");
            setCoachGroupDeleteId(null);
            setCoachGroupEditId(null);
            setCoachGroupEditName("");
            setCoachGroupEditError("");
          }}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Групи за треньори</span>
              <button
                className="amp-modal-close"
                onClick={() => {
                  setCoachGroupsPanelOpen(false);
                  setCoachGroupCreateName("");
                  setCoachGroupCreateError("");
                  setCoachGroupDeleteId(null);
                  setCoachGroupEditId(null);
                  setCoachGroupEditName("");
                  setCoachGroupEditError("");
                }}
                aria-label="Затвори"
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {/* Create form */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <input
                  className="amp-edit-input"
                  placeholder="Ново име на група"
                  value={coachGroupCreateName}
                  onChange={(e) => {
                    setCoachGroupCreateName(e.target.value);
                    setCoachGroupCreateError("");
                  }}
                  disabled={coachGroupCreateSaving}
                  maxLength={100}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="amp-btn amp-btn--primary amp-btn--compact"
                  disabled={coachGroupCreateSaving || !coachGroupCreateName.trim()}
                  onClick={async () => {
                    const name = coachGroupCreateName.trim();
                    if (!name || !clubId) return;
                    setCoachGroupCreateSaving(true);
                    setCoachGroupCreateError("");
                    try {
                      const response = await fetch(
                        `/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name }),
                        },
                      );
                      if (!response.ok) {
                        const payload = await response.json().catch(() => ({}));
                        throw new Error(String((payload as { error?: unknown }).error ?? "Грешка"));
                      }
                      setCoachGroupCreateName("");
                      void loadCoachGroups();
                    } catch (err) {
                      setCoachGroupCreateError(err instanceof Error ? err.message : "Грешка");
                    } finally {
                      setCoachGroupCreateSaving(false);
                    }
                  }}
                >
                  {coachGroupCreateSaving ? "..." : "Създай"}
                </button>
              </div>
              {coachGroupCreateError && (
                <p className="amp-confirm-error" style={{ marginBottom: "8px" }}>
                  {coachGroupCreateError}
                </p>
              )}

              {/* Group list */}
              {coachGroups.length === 0 ? (
                <p className="amp-empty amp-empty--modal">Няма групи за треньори.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {coachGroups.map((group) => (
                    <div
                      key={group.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {coachGroupEditId === group.id ? (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <input
                              className="amp-edit-input"
                              value={coachGroupEditName}
                              onChange={(e) => {
                                setCoachGroupEditName(e.target.value);
                                setCoachGroupEditError("");
                              }}
                              disabled={coachGroupEditSaving}
                              maxLength={100}
                              style={{ flex: 1 }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="amp-btn amp-btn--primary amp-btn--compact"
                              disabled={
                                coachGroupEditSaving ||
                                !coachGroupEditName.trim() ||
                                coachGroupEditName.trim() === group.name
                              }
                              onClick={async () => {
                                const name = coachGroupEditName.trim();
                                if (!name || !clubId) return;
                                setCoachGroupEditSaving(true);
                                setCoachGroupEditError("");
                                try {
                                  const response = await fetch(
                                    `/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups/${encodeURIComponent(group.id)}`,
                                    {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ name }),
                                    },
                                  );
                                  if (!response.ok) {
                                    const payload = await response.json().catch(() => ({}));
                                    throw new Error(
                                      String((payload as { error?: unknown }).error ?? "Грешка"),
                                    );
                                  }
                                  setCoachGroupEditId(null);
                                  setCoachGroupEditName("");
                                  void loadCoachGroups();
                                } catch (err) {
                                  setCoachGroupEditError(err instanceof Error ? err.message : "Грешка");
                                } finally {
                                  setCoachGroupEditSaving(false);
                                }
                              }}
                            >
                              {coachGroupEditSaving ? "..." : "Запиши"}
                            </button>
                            <button
                              type="button"
                              className="amp-btn amp-btn--ghost amp-btn--compact"
                              disabled={coachGroupEditSaving}
                              onClick={() => {
                                setCoachGroupEditId(null);
                                setCoachGroupEditName("");
                                setCoachGroupEditError("");
                              }}
                            >
                              Отказ
                            </button>
                          </div>
                          {coachGroupEditError && (
                            <p className="amp-confirm-error" style={{ margin: 0 }}>
                              {coachGroupEditError}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500 }}>{group.name}</span>
                            <span style={{ marginLeft: "8px", fontSize: "0.8rem", opacity: 0.6 }}>
                              {group.playerCount} Състезатели
                            </span>
                          </div>
                          {coachGroupDeleteId !== group.id && (
                            <button
                              type="button"
                              className="amp-btn amp-btn--ghost amp-btn--compact"
                              onClick={async () => {
                                const url = `${window.location.origin}/admin/members?clubId=${encodeURIComponent(clubId)}&coachGroupId=${encodeURIComponent(group.id)}`;
                                try {
                                  await navigator.clipboard.writeText(url);
                                  setCoachGroupCopiedId(group.id);
                                  setTimeout(() => setCoachGroupCopiedId(null), 2000);
                                } catch {
                                  const tmp = document.createElement("input");
                                  tmp.value = url;
                                  document.body.appendChild(tmp);
                                  tmp.select();
                                  document.execCommand("copy");
                                  document.body.removeChild(tmp);
                                  setCoachGroupCopiedId(group.id);
                                  setTimeout(() => setCoachGroupCopiedId(null), 2000);
                                }
                              }}
                              style={{ minWidth: "90px" }}
                            >
                              {coachGroupCopiedId === group.id ? "Копирано!" : "Копирай линк"}
                            </button>
                          )}
                          {coachGroupDeleteId === group.id ? (
                            <>
                              <button
                                type="button"
                                className="amp-btn amp-btn--danger amp-btn--compact"
                                disabled={coachGroupDeleteSaving}
                                onClick={async () => {
                                  if (!clubId) return;
                                  setCoachGroupDeleteSaving(true);
                                  try {
                                    const response = await fetch(
                                      `/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups/${encodeURIComponent(group.id)}`,
                                      { method: "DELETE" },
                                    );
                                    if (!response.ok) {
                                      const data = await response.json().catch(() => ({}));
                                      if (response.status === 409 && data.conflicts?.length) {
                                        setFeeAssignments(undefined);
                                        setFeeDeleteGroupId(group.id);
                                        setPaymentAmountModalOpen(true);
                                      }
                                      throw new Error(data.error ?? "Грешка при изтриване");
                                    }
                                    setCoachGroupDeleteId(null);
                                    void loadCoachGroups();
                                    void refreshMembersList();
                                  } catch (err) {
                                    setCoachGroupCreateError(
                                      err instanceof Error ? err.message : "Грешка при изтриване",
                                    );
                                  } finally {
                                    setCoachGroupDeleteSaving(false);
                                  }
                                }}
                              >
                                {coachGroupDeleteSaving ? "..." : "Потвърди"}
                              </button>
                              <button
                                type="button"
                                className="amp-btn amp-btn--ghost amp-btn--compact"
                                disabled={coachGroupDeleteSaving}
                                onClick={() => setCoachGroupDeleteId(null)}
                              >
                                Отказ
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="amp-btn amp-btn--ghost amp-btn--icon-only"
                                title="Редактирай"
                                onClick={() => {
                                  setCoachGroupEditId(group.id);
                                  setCoachGroupEditName(group.name);
                                  setCoachGroupEditError("");
                                  setCoachGroupDeleteId(null);
                                }}
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                type="button"
                                className="amp-btn amp-btn--ghost amp-btn--compact"
                                onClick={() => setCoachGroupDeleteId(group.id)}
                              >
                                Изтрий
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

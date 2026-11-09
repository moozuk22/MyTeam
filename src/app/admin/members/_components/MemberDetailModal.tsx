"use client";

import FinanceSkeleton, { SkeletonLine } from "./FinanceSkeleton";
import { playerFieldEnabled } from "@/lib/playerFields";
import { useEffect, useRef, useState } from "react";
import { NotificationImage } from "@/components/NotificationImage";
import { NotificationText } from "@/components/NotificationText";
import { type CoachGroup, type Member, type MemberNotification } from "../_types/members-page-types";
import { getStatusMeta } from "../_utils/members-page-utils";
import { BellIcon, CalendarIcon, ChevronDownIcon, PencilIcon, ReceiptIcon, UserIcon, XIcon } from "./members-page-icons";

export function MemberDetailModal({
  member,
  onClose,
  onRequestDelete,
  onRequestEdit,
  actionMode = "active",
  isCoach = false,
  showManagementActions = true,
  showProfileLink = false,
  onRequestReactivate,
  onRequestPermanentDelete,
  isReactivating = false,
  isDeletingPermanent = false,
  coachGroups,
  onCoachGroupAssigned,
  onFeeConflict,
}: {
  member: Member;
  onClose: () => void;
  onRequestDelete: (member: Member) => void;
  onRequestEdit: (member: Member) => void;
  actionMode?: "active" | "inactive";
  isCoach?: boolean;
  showManagementActions?: boolean;
  showProfileLink?: boolean;
  onRequestReactivate?: (member: Member) => void;
  onRequestPermanentDelete?: (member: Member) => void;
  isReactivating?: boolean;
  isDeletingPermanent?: boolean;
  coachGroups?: CoachGroup[];
  onCoachGroupAssigned?: (memberId: string, coachGroupIds: string[]) => void;
  onFeeConflict?: (memberId: string, coachGroupIds: string[]) => void;
}) {
  const s = getStatusMeta(member.status);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coachGroupsOpen, setCoachGroupsOpen] = useState(false);
  const [assignCoachGroupValue, setAssignCoachGroupValue] = useState<string[]>([...member.coachGroupIds]);
  const [assignCoachGroupSaving, setAssignCoachGroupSaving] = useState(false);
  const [assignCoachGroupSaved, setAssignCoachGroupSaved] = useState(false);
  const [assignCoachGroupError, setAssignCoachGroupError] = useState("");
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [coachNoteLoading, setCoachNoteLoading] = useState(false);
  const [coachNoteSaving, setCoachNoteSaving] = useState(false);
  const [coachNoteError, setCoachNoteError] = useState("");
  const [coachNote, setCoachNote] = useState("");
  const [coachNoteUpdatedAt, setCoachNoteUpdatedAt] = useState<string | null>(null);
  const [coachNoteEditing, setCoachNoteEditing] = useState(false);
  const [coachNoteDraft, setCoachNoteDraft] = useState("");
  const coachNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const paymentHistory = [...(member.paymentLogs ?? [])].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
  const lastPayment = paymentHistory[0];
  const memberCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "";
  const activeCardCode = memberCardCode || "Няма активна карта";
  const memberClubId = member.club?.id ?? "";
  const memberId = member.id;


  const fetchNotifications = async () => {
    if (!memberClubId || !memberId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setNotificationsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(memberClubId)}/notifications?playerId=${encodeURIComponent(memberId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload.unreadCount ?? 0));
    } catch (error) {
      console.error("Failed to fetch member notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationsRead = async () => {
    if (!memberClubId || !memberId) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(memberClubId)}/notifications/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId: memberId }),
      });
      if (!response.ok) {
        return;
      }

      const nowIso = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? nowIso })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark member notifications as read:", error);
    }
  };

  const handleOpenNotificationsPanel = async () => {
    setNotificationsPanelOpen(true);
    await fetchNotifications();
    await markNotificationsRead();
  };

  useEffect(() => {
    let cancelled = false;

    const fetchUnread = async () => {
      if (!memberClubId || !memberId) {
        setUnreadCount(0);
        return;
      }

      try {
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(memberClubId)}/notifications?playerId=${encodeURIComponent(memberId)}`,
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) {
          return;
        }
        const payload = await response.json();
        setUnreadCount(Number(payload.unreadCount ?? 0));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch member unread notifications:", error);
        }
      }
    };

    void fetchUnread();
    return () => {
      cancelled = true;
    };
  }, [memberClubId, memberId]);

  useEffect(() => {
    let cancelled = false;

    const loadCoachNote = async () => {
      if (!isCoach || !memberId) {
        setCoachNote("");
        setCoachNoteUpdatedAt(null);
        setCoachNoteError("");
        setCoachNoteEditing(false);
        setCoachNoteDraft("");
        return;
      }

      setCoachNoteLoading(true);
      setCoachNoteError("");
      setCoachNoteEditing(false);
      setCoachNoteDraft("");
      try {
        const response = await fetch(
          `/api/admin/members/${encodeURIComponent(memberId)}/coach-note`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(String((payload as { error?: unknown }).error ?? "Грешка"));
        }
        const payload = (await response.json()) as { note?: unknown; updatedAt?: unknown; warning?: unknown };
        if (cancelled) return;
        setCoachNote(typeof payload.note === "string" ? payload.note : "");
        setCoachNoteUpdatedAt(typeof payload.updatedAt === "string" ? payload.updatedAt : null);
        if (typeof payload.warning === "string" && payload.warning.includes("coach_note")) {
          setCoachNoteError("Бележките не са активирани (липсва поле в базата).");
        }
      } catch (err) {
        if (!cancelled) {
          setCoachNoteError(err instanceof Error ? err.message : "Грешка");
        }
      } finally {
        if (!cancelled) setCoachNoteLoading(false);
      }
    };

    void loadCoachNote();
    return () => {
      cancelled = true;
    };
  }, [isCoach, memberId]);

  useEffect(() => {
    if (coachNoteEditing) coachNoteTextareaRef.current?.focus();
  }, [coachNoteEditing]);

  const saveCoachNote = async () => {
    if (!isCoach || !memberId) return;
    const noteToSave = coachNoteEditing ? coachNoteDraft : coachNote;
    setCoachNoteSaving(true);
    setCoachNoteError("");
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}/coach-note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteToSave }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(String((payload as { error?: unknown }).error ?? "Грешка"));
      }
      const payload = (await response.json()) as { note?: unknown; updatedAt?: unknown };
      const next = typeof payload.note === "string" ? payload.note : noteToSave;
      setCoachNote(next);
      setCoachNoteDraft(next);
      setCoachNoteUpdatedAt(typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString());
      setCoachNoteEditing(false);
    } catch (err) {
      setCoachNoteError(err instanceof Error ? err.message : "Грешка");
    } finally {
      setCoachNoteSaving(false);
    }
  };

  const startCoachNoteEdit = () => {
    if (coachNoteLoading || coachNoteSaving) return;
    setCoachNoteDraft(coachNote);
    setCoachNoteEditing(true);
    setCoachNoteError("");
  };

  const cancelCoachNoteEdit = () => {
    setCoachNoteDraft(coachNote);
    setCoachNoteEditing(false);
    setCoachNoteError("");
  };

  return (
    <div className="amp-overlay" onClick={onClose}>
      <div className="amp-modal" onClick={e => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />

        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">{member.fullName} - Статистика</span>
          <div className="amp-modal-title-actions">
            <button
              className="amp-member-bell-btn"
              onClick={() => void handleOpenNotificationsPanel()}
              aria-label="Известия"
              disabled={!memberClubId || !memberId}
            >
              <BellIcon />
              {unreadCount > 0 ? (
                <span className="amp-member-bell-dot">{unreadCount > 99 ? "99+" : unreadCount}</span>
              ) : null}
            </button>
            <button className="amp-modal-close" onClick={onClose} aria-label="Затвори">
              <XIcon />
            </button>
          </div>
        </h2>

        <div className="amp-modal-body">
          <div className="amp-info-card">
            <div className="amp-info-cell">
              <UserIcon />
              <div>
                <p className="amp-lbl">Име</p>
                <p className="amp-val">{member.fullName}</p>
              </div>
            </div>

            {playerFieldEnabled(member.club, "teamGroup") && (<div className="amp-info-cell">
              <span className="amp-lbl">Набор:</span>
              <span className="amp-val">{member.teamGroup ?? "-"}</span>
            </div>)}

            <div className="amp-info-cell">
              <span className="amp-lbl">Статус:</span>
              <span className="amp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                {s.label}
              </span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Активна карта:</span>
              <span className="amp-val">{activeCardCode}</span>
            </div>

            <div className="amp-info-cell"><span className="amp-lbl">Възраст:</span><span className="amp-val">{member.age ?? "—"}</span></div>
            {playerFieldEnabled(member.club, "rank") && <div className="amp-info-cell"><span className="amp-lbl">Степен:</span><span className="amp-val">{member.rank ?? "—"}</span></div>}
            {playerFieldEnabled(member.club, "weight") && <div className="amp-info-cell"><span className="amp-lbl">Тегло:</span><span className="amp-val">{member.weight == null ? "—" : `${member.weight.toLocaleString("bg-BG")} кг`}</span></div>}
            {playerFieldEnabled(member.club, "jerseyNumber") && <div className="amp-info-cell"><span className="amp-lbl">Номер в отбора:</span><span className="amp-val">{member.jerseyNumber ?? "—"}</span></div>}

            <div className="amp-info-cell">
              <span className="amp-lbl">Телефон родител:</span>
              <span className="amp-val">{member.parentPhone ?? "Не е посочен"}</span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Телефон състезател:</span>
              <span className="amp-val">{member.playerPhone ?? "Не е посочен"}</span>
            </div>

            <div className="amp-info-cell amp-info-cell--full">
              <CalendarIcon />
              <div>
                <p className="amp-lbl">Последно плащане</p>
                <p className="amp-val">
                  {lastPayment
                    ? new Date(lastPayment.paidAt).toLocaleDateString("bg-BG") + " г."
                    : "Няма плащания"}
                </p>
              </div>
            </div>

            {coachGroups && coachGroups.length > 0 && actionMode === "active" && (
              <div className="amp-info-cell amp-info-cell--full amp-info-cell--dropdown">
                <button className="amp-info-cell-trigger" onClick={() => setCoachGroupsOpen(v => !v)}>
                  <div className="amp-info-cell-trigger-text">
                    <p className="amp-lbl">Треньорска група</p>
                    <p className="amp-val">
                      {assignCoachGroupValue.length === 0
                        ? "Не е избрана"
                        : coachGroups.filter(g => assignCoachGroupValue.includes(g.id)).map(g => g.name).join(", ")}
                    </p>
                  </div>
                  <span className={`amp-acc-chevron${coachGroupsOpen ? " open" : ""}`}><ChevronDownIcon /></span>
                </button>
                <div className={`amp-acc-body${coachGroupsOpen ? " open" : ""}`}>
                  <div className="amp-acc-inner">
                    <div className="amp-coach-group-picker">
                      <div className="amp-coach-group-picker-list">
                        {coachGroups.map((g) => (
                          <label
                            key={g.id}
                            className={`amp-coach-group-option${assignCoachGroupValue.includes(g.id) ? " is-selected" : ""}${assignCoachGroupSaving ? " is-disabled" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="amp-group-check-input"
                              disabled={assignCoachGroupSaving}
                              checked={assignCoachGroupValue.includes(g.id)}
                              onChange={(e) => {
                                setAssignCoachGroupError("");
                                setAssignCoachGroupValue((prev) =>
                                  e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                                );
                              }}
                            />
                            <span className="amp-group-check-box" aria-hidden="true" />
                            <span className="amp-coach-group-option-name">{g.name}</span>
                          </label>
                        ))}
                      </div>
                      <div className="amp-coach-group-picker-actions">
                        <button
                          type="button"
                          className={`amp-btn amp-btn--compact amp-coach-group-save-btn${assignCoachGroupSaved ? " amp-coach-group-save-btn--saved" : ""}${assignCoachGroupError ? " amp-coach-group-save-btn--error" : ""}`}
                          disabled={assignCoachGroupSaving || assignCoachGroupSaved}
                          onClick={async () => {
                            setAssignCoachGroupSaving(true);
                            setAssignCoachGroupSaved(false);
                            setAssignCoachGroupError("");
                            try {
                              const response = await fetch(`/api/admin/members/${encodeURIComponent(member.id)}/coach-group`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ coachGroupIds: assignCoachGroupValue }),
                              });
                              if (!response.ok) {
                                const payload = await response.json().catch(() => ({}));
                                if (response.status === 409 && payload.conflicts?.length && onFeeConflict) {
                                  onFeeConflict(member.id, assignCoachGroupValue); return;
                                }
                                throw new Error(String((payload as { error?: unknown }).error ?? "Грешка"));
                              }
                              onCoachGroupAssigned?.(member.id, assignCoachGroupValue);
                              setAssignCoachGroupSaved(true);
                              setTimeout(() => setAssignCoachGroupSaved(false), 2500);
                            } catch (err) {
                              setAssignCoachGroupError(err instanceof Error ? err.message : "Грешка");
                            } finally {
                              setAssignCoachGroupSaving(false);
                            }
                          }}
                        >
                          {assignCoachGroupSaving ? "Запазване..." : assignCoachGroupSaved ? "✓ Записано" : "Запиши"}
                        </button>
                      </div>
                      {assignCoachGroupError && <p className="amp-confirm-error amp-coach-group-picker-error">{assignCoachGroupError}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isCoach && actionMode === "active" ? (
              <div className="amp-info-cell amp-info-cell--full">
                <div style={{ width: "100%" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <p className="amp-lbl" style={{ margin: 0 }}>
                        Бележка от треньор
                      </p>
                      {!coachNoteLoading && (
                        <button
                          type="button"
                          className="amp-member-bell-btn"
                          onClick={() => (coachNoteEditing ? cancelCoachNoteEdit() : startCoachNoteEdit())}
                          disabled={coachNoteSaving || !!coachNoteError?.includes("липсва поле")}
                          aria-label={coachNoteEditing ? "Отказ" : "Редактирай бележка"}
                          title={coachNoteEditing ? "Отказ" : "Редактирай"}
                        >
                          {coachNoteEditing ? <XIcon /> : <PencilIcon />}
                        </button>
                      )}
                    </div>
                    {coachNoteUpdatedAt ? (
                      <span style={{ fontSize: "12px", opacity: 0.8 }}>
                        Последна промяна: {new Date(coachNoteUpdatedAt).toLocaleString("bg-BG")}
                      </span>
                    ) : null}
                  </div>

                  {coachNoteLoading ? (
                    <div role="status" aria-label="Зареждане на бележката" aria-busy="true"><SkeletonLine wide /></div>
                  ) : coachNoteEditing ? (
                    <>
                      <textarea
                        ref={coachNoteTextareaRef}
                        className="amp-edit-input"
                        value={coachNoteDraft}
                        onChange={(e) => setCoachNoteDraft(e.target.value)}
                        placeholder="Напиши инструкции/наблюдения за състезателя..."
                        rows={6}
                        style={{
                          width: "100%",
                          minHeight: "100px",
                          resize: "vertical",
                          paddingTop: "12px",
                          paddingBottom: "12px",
                        }}
                        disabled={coachNoteSaving}
                      />
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "10px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="amp-btn amp-btn--ghost amp-btn--compact"
                          onClick={() => void saveCoachNote()}
                          disabled={coachNoteSaving}
                        >
                          {coachNoteSaving ? "Запис..." : "Запази"}
                        </button>
                        {coachNoteError ? (
                          <span className="amp-confirm-error" style={{ margin: 0 }}>{coachNoteError}</span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className="amp-edit-input"
                        style={{
                          width: "100%",
                          minHeight: "100px",
                          padding: "12px 14px",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          opacity: coachNote.trim() ? 1 : 0.55,
                          fontStyle: coachNote.trim() ? "normal" : "italic",
                          cursor: "default",
                          boxSizing: "border-box",
                        }}
                        onDoubleClick={() => startCoachNoteEdit()}
                        role="presentation"
                      >
                        {coachNote.trim()
                          ? coachNote
                          : "Напиши инструкции/наблюдения за състезателя... (кликни молива за редакция)"}
                      </div>
                      {coachNoteError ? (
                        <p className="amp-confirm-error" style={{ marginTop: "8px", marginBottom: 0 }}>{coachNoteError}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="amp-acc">
            <button className="amp-acc-trigger" onClick={() => setHistoryOpen((v) => !v)}>
              <span>История на плащанията</span>
              <span className={`amp-acc-chevron${historyOpen ? " open" : ""}`}><ChevronDownIcon /></span>
            </button>
            <div className={`amp-acc-body${historyOpen ? " open" : ""}`}>
              <div className="amp-acc-inner">
                {paymentHistory.length === 0 ? (
                  <div className="amp-acc-empty">
                    <ReceiptIcon />
                    <p>Все още няма регистрирани плащания</p>
                  </div>
                ) : (
                  <div className="amp-acc-list">
                    {paymentHistory.map((p) => (
                      <div key={p.id} className="amp-acc-row">
                        <span className="amp-acc-period">{p.paidFor}</span>
                        <span className="amp-acc-date">{new Date(p.paidAt).toLocaleDateString("bg-BG")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {showProfileLink && memberCardCode && (
            <div className="amp-modal-actions amp-modal-actions--end">
              <a className="amp-btn amp-btn--ghost" href={`/member/${encodeURIComponent(memberCardCode)}`} style={{textDecoration:'none'}}>Виж профила</a>
            </div>
          )}

          {showManagementActions && (
            <div className="amp-modal-actions amp-modal-actions--end">
            {actionMode === "active" ? (
              <>
                <button className="amp-btn amp-btn--ghost" onClick={() => onRequestEdit(member)}>
                  Редактирай
                </button>
                <button className="amp-btn amp-btn--danger" onClick={() => onRequestDelete(member)}>
                  Премахни състезател
                </button>
              </>
            ) : (
              <>
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => onRequestReactivate?.(member)}
                  disabled={isReactivating || isDeletingPermanent}
                >
                  {isReactivating ? "Възстановяване..." : "Възстанови"}
                </button>
                <button
                  className="amp-btn amp-btn--danger"
                  onClick={() => onRequestPermanentDelete?.(member)}
                  disabled={isReactivating || isDeletingPermanent}
                >
                  {isDeletingPermanent ? "Изтриване..." : "Изтрий"}
                </button>
              </>
            )}
            </div>
          )}
        </div>
      </div>

      {notificationsPanelOpen ? (
        <div className="amp-overlay amp-overlay--member-notifications" onClick={() => setNotificationsPanelOpen(false)}>
          <div className="amp-modal amp-modal--member-notifications" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Известия</span>
              <button className="amp-modal-close" onClick={() => setNotificationsPanelOpen(false)} aria-label="Затвори">
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {notificationsLoading ? (
                <FinanceSkeleton variant="history" />
              ) : notifications.length === 0 ? (
                <p className="amp-empty amp-empty--modal">Няма известия</p>
              ) : (
                <div className="amp-member-notifications-list">
                  {notifications.map((notif) => (
                    <article
                      key={notif.id}
                      className={`amp-member-notification-item${notif.readAt ? "" : " amp-member-notification-item--unread"}`}
                    >
                      <div className="amp-member-notification-head">
                        <h3>{notif.title}</h3>
                        {!notif.readAt ? <span className="amp-member-notification-new" aria-label="Ново" /> : null}
                      </div>
                      <p><NotificationText text={notif.body} /></p>
                          <NotificationImage src={notif.imageUrl} />
                      <div className="amp-member-notification-meta">
                        {typeof notif.teamGroup === "number" ? <span>Набор: {notif.teamGroup}</span> : null}
                        {Array.isArray(notif.trainingGroups) && notif.trainingGroups.length > 0 ? (
                          <span>Сборен отбор: {notif.trainingGroups.map((group) => group.name).join(", ")}</span>
                        ) : null}
                      </div>
                      <time dateTime={notif.sentAt}>
                        {new Date(notif.sentAt).toLocaleDateString("bg-BG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

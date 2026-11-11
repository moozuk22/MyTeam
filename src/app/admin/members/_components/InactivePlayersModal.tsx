"use client";

import { useState } from "react";
import { type Member } from "../_types/members-page-types";
import { XIcon } from "./members-page-icons";
import { PlayerCard } from "./PlayerCard";

export function InactivePlayersModal({
  members,
  isCovered = false,
  isReactivating,
  reactivatingMemberId,
  isDeletingPermanent,
  deletingPermanentMemberId,
  error,
  onClose,
  onSelectMember,
  onReactivate,
  onPermanentDelete,
  onBulkDelete,
}: {
  members: Member[];
  isCovered?: boolean;
  isReactivating: boolean;
  reactivatingMemberId: string | null;
  isDeletingPermanent: boolean;
  deletingPermanentMemberId: string | null;
  error: string;
  onClose: () => void;
  onSelectMember: (member: Member) => void;
  onReactivate: (member: Member) => void;
  onPermanentDelete: (member: Member) => void;
  onBulkDelete: (members: Member[]) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const selectedMembers = members.filter((member) => selectedIds.has(member.id));
  const allSelected = members.length > 0 && selectedMembers.length === members.length;
  const busy = isReactivating || isDeletingPermanent || isBulkDeleting;
  const close = () => { if (!busy) onClose(); };

  return (
    <div className="amp-overlay amp-overlay--inactive" onClick={close} inert={isCovered} aria-hidden={isCovered || undefined}>
      <div className="amp-modal amp-modal--inactive" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Неактивни състезатели</span>
          <button className="amp-modal-close" onClick={close} aria-label="Затвори" disabled={busy}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-inactive-toolbar">
          <button type="button" className="amp-btn amp-btn--ghost" disabled={busy || members.length === 0 || confirmBulkDelete}
            onClick={() => setSelectedIds(allSelected ? new Set() : new Set(members.map((member) => member.id)))}>
            {allSelected ? "Отмени избора" : "Избери всички"}
          </button>
          <button type="button" className="amp-btn amp-btn--danger" disabled={busy || selectedMembers.length === 0 || confirmBulkDelete}
            onClick={() => setConfirmBulkDelete(true)}>
            {isBulkDeleting ? "Изтриване..." : `Изтрий избраните (${selectedMembers.length})`}
          </button>
          {confirmBulkDelete && (
            <div className="amp-inactive-confirm" role="alert">
              <p>Да изтрием ли завинаги избраните състезатели ({selectedMembers.length}) и свързаните данни? Действието е необратимо.</p>
              <button type="button" className="amp-btn amp-btn--ghost" disabled={busy} onClick={() => setConfirmBulkDelete(false)}>Отказ</button>
              <button type="button" className="amp-btn amp-btn--danger" disabled={busy || selectedMembers.length === 0} onClick={async () => {
                setIsBulkDeleting(true);
                try { await onBulkDelete(selectedMembers); }
                finally { setIsBulkDeleting(false); setConfirmBulkDelete(false); }
              }}>Изтрий завинаги</button>
            </div>
          )}
          {error && <p className="amp-confirm-error" role="alert">{error}</p>}
        </div>
        <div className="amp-modal-body amp-inactive-list" aria-label="Неактивни състезатели" tabIndex={0}>
          {members.length === 0 ? (
            <p className="amp-empty amp-empty--modal">Няма неактивни състезатели</p>
          ) : (
            <div className="amp-cards">
              {members.map((member) => (
                <div className={`amp-inactive-player${selectedIds.has(member.id) ? " is-selected" : ""}`} key={member.id}>
                  <label className="amp-inactive-check">
                  <input type="checkbox" aria-label={`Избери ${member.fullName}`} checked={selectedIds.has(member.id)} disabled={busy || confirmBulkDelete}
                    onChange={() => setSelectedIds((previous) => {
                      const next = new Set(previous);
                      if (next.has(member.id)) next.delete(member.id); else next.add(member.id);
                      return next;
                    })} />
                    <span className="amp-inactive-check-mark" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none"><path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  </label>
                <PlayerCard
                  member={member}
                  onClick={() => { if (!busy && !confirmBulkDelete) onSelectMember(member); }}
                  actionMode="reactivate"
                  isActionLoading={isReactivating && reactivatingMemberId === member.id}
                  onReactivate={() => { if (!busy && !confirmBulkDelete) onReactivate(member); }}
                  isDeleteLoading={isDeletingPermanent && deletingPermanentMemberId === member.id}
                  onPermanentDelete={() => { if (!busy && !confirmBulkDelete) onPermanentDelete(member); }}
                />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

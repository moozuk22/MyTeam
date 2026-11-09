"use client";

import { playerFieldEnabled } from "@/lib/playerFields";
import PlayerExtraFields from "@/components/PlayerExtraFields";
import { validateImageFile } from "@/lib/uploadImage";
import { XIcon } from "./members-page-icons";
import { type ClubOption } from "../_types/members-page-types";
import { type MemberManagement } from "../_hooks/useMemberManagement";
import { type TrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";

type MemberEditorDialogProps = {
  memberManagement: Pick<
    MemberManagement,
    | "memberToEdit"
    | "isSavingEdit"
    | "closeEditModal"
    | "isAssigningNewCard"
    | "editForm"
    | "setEditForm"
    | "editPlayerSettings"
    | "editAvatarPreviewUrl"
    | "setEditError"
    | "setEditAvatarFile"
    | "setIsNewCardConfirmOpen"
    | "editError"
    | "handleSaveMemberEdit"
  >;
  trainingAttendanceState: Pick<TrainingAttendanceState, "trainingDayDetailsOpening">;
  isAdmin: boolean;
  clubs: ClubOption[];
  coachGroupId: string;
};

export function MemberEditorDialog({
  memberManagement,
  trainingAttendanceState,
  isAdmin,
  clubs,
  coachGroupId,
}: MemberEditorDialogProps) {
  const {
    memberToEdit,
    isSavingEdit,
    closeEditModal,
    isAssigningNewCard,
    editForm,
    setEditForm,
    editPlayerSettings,
    editAvatarPreviewUrl,
    setEditError,
    setEditAvatarFile,
    setIsNewCardConfirmOpen,
    editError,
    handleSaveMemberEdit,
  } = memberManagement;
  const { trainingDayDetailsOpening } = trainingAttendanceState;
  return (
    <>
      {memberToEdit && (
        <div className="amp-overlay" onClick={isSavingEdit ? undefined : closeEditModal}>
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Редактиране на състезател</span>
              <button
                className="amp-modal-close"
                onClick={closeEditModal}
                aria-label="Затвори"
                disabled={isSavingEdit || isAssigningNewCard}
              >
                <XIcon />
              </button>
            </h2>

            <div
              className={`amp-modal-body${trainingDayDetailsOpening ? " amp-modal-body--loading-only" : ""}`}
            >
              <div className="amp-edit-grid">
                <label className="amp-edit-field">
                  <span className="amp-lbl">Име и фамилия</span>
                  <input
                    className="amp-edit-input"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                </label>
                {isAdmin && (
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Club</span>
                    <select
                      className="amp-edit-input"
                      value={editForm.clubId}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, clubId: e.target.value }))}
                    >
                      <option value="" disabled>
                        Изберете отбор
                      </option>
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <PlayerExtraFields
                  settings={editPlayerSettings}
                  values={editForm}
                  onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
                />
                {playerFieldEnabled(editPlayerSettings, "jerseyNumber") && (
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Номер в отбора</span>
                    <input
                      className="amp-edit-input"
                      value={editForm.jerseyNumber}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, jerseyNumber: e.target.value }))}
                    />
                  </label>
                )}
                <label className="amp-edit-field">
                  <span className="amp-lbl">Телефон на родител</span>
                  <input
                    className="amp-edit-input"
                    type="tel"
                    value={editForm.parentPhone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
                  />
                </label>
                <label className="amp-edit-field">
                  <span className="amp-lbl">Телефон на състезател</span>
                  <input
                    className="amp-edit-input"
                    type="tel"
                    value={editForm.playerPhone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, playerPhone: e.target.value }))}
                  />
                </label>
                {playerFieldEnabled(editPlayerSettings, "teamGroup") && (
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Набор</span>
                    <input
                      className="amp-edit-input"
                      inputMode="numeric"
                      value={editForm.teamGroup}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          teamGroup: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                    />
                  </label>
                )}
                <label className="amp-edit-field">
                  <span className="amp-lbl">Дата на раждане</span>
                  <input
                    className="amp-edit-input"
                    type="date"
                    value={editForm.birthDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                  />
                </label>
                {!coachGroupId && (
                  <label className="amp-edit-field">
                    <span className="amp-lbl">Лична такса (0 = групова / клубна)</span>
                    <input
                      className="amp-edit-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.paymentAmount}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, paymentAmount: e.target.value }))}
                    />
                  </label>
                )}
                <label className="amp-edit-field amp-edit-field--full">
                  <span className="amp-lbl">Текуща снимка</span>
                  {editAvatarPreviewUrl || editForm.avatarUrl ? (
                    <img
                      src={editAvatarPreviewUrl || editForm.avatarUrl}
                      alt={editForm.fullName || "Player avatar"}
                      className="amp-edit-avatar-preview"
                    />
                  ) : (
                    <p className="amp-edit-image-empty">Няма качена снимка.</p>
                  )}
                </label>
                <label className="amp-edit-field amp-edit-field--full">
                  <span className="amp-lbl">Качи нова снимка</span>
                  <input
                    className="amp-edit-input amp-edit-input--file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) {
                        const err = validateImageFile(file);
                        if (err) {
                          setEditError(err);
                          e.target.value = "";
                          return;
                        }
                      }
                      setEditAvatarFile(file);
                    }}
                    disabled={isSavingEdit || isAssigningNewCard}
                  />
                </label>
                <div className="amp-edit-field amp-edit-field--full">
                  <span className="amp-lbl">Активна карта</span>
                  <div className="amp-modal-actions amp-modal-actions--end">
                    <p className="amp-val" style={{ marginRight: "auto" }}>
                      {memberToEdit.cards.find((card) => card.isActive)?.cardCode ||
                        memberToEdit.cards[0]?.cardCode ||
                        "Няма активна карта"}
                    </p>
                    {isAdmin && (
                      <button
                        className="amp-btn amp-btn--ghost"
                        onClick={() => setIsNewCardConfirmOpen(true)}
                        disabled={isSavingEdit || isAssigningNewCard}
                        type="button"
                      >
                        {isAssigningNewCard ? "Генериране..." : "Нова карта"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {editError && <p className="amp-confirm-error">{editError}</p>}

              <div className="amp-modal-actions">
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={closeEditModal}
                  disabled={isSavingEdit || isAssigningNewCard}
                >
                  Отказ
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  onClick={handleSaveMemberEdit}
                  disabled={isSavingEdit || isAssigningNewCard}
                >
                  {isSavingEdit ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import PlayerExtraFields from "@/components/PlayerExtraFields";
import { playerFieldEnabled } from "@/lib/playerFields";
import { type MemberProfile } from "../_types/member-types";
import { XIcon } from "./MemberIcons";

type Props = {
  editModalOpen: boolean;
  editSaving: boolean;
  setEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editForm: {
    fullName: string;
    birthDate: string;
    teamGroup: string;
    rank: string;
    weight: string;
    jerseyNumber: string;
    parentPhone: string;
    playerPhone: string;
  };
  setEditForm: React.Dispatch<
    React.SetStateAction<{
      fullName: string;
      birthDate: string;
      teamGroup: string;
      rank: string;
      weight: string;
      jerseyNumber: string;
      parentPhone: string;
      playerPhone: string;
    }>
  >;
  member: MemberProfile;
  setEditImageFile: React.Dispatch<React.SetStateAction<File | null>>;
  editImagePreviewUrl: string;
  editError: string;
  handleSavePublicEdit: () => Promise<void>;
};

export function MemberProfileEditorDialog({
  editModalOpen,
  editSaving,
  setEditModalOpen,
  editForm,
  setEditForm,
  member,
  setEditImageFile,
  editImagePreviewUrl,
  editError,
  handleSavePublicEdit,
}: Props) {
  return (
    <>
      {editModalOpen && (
        <div
          className="pm-overlay"
          onClick={() => !editSaving && setEditModalOpen(false)}
        >
          <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="pm-close"
              onClick={() => !editSaving && setEditModalOpen(false)}
            >
              <XIcon size={16} />
            </button>

            <div className="pm-header">
              <div className="pm-title-icon">✎</div>
              <div>
                <h2 className="pm-title">Редактиране на профил</h2>
              </div>
            </div>

            <div className="pm-divider" />

            <div style={{ display: "grid", gap: "10px" }}>
              <label style={{ display: "grid", gap: "6px" }}>
                <span className="pm-info-lbl">Име и фамилия</span>
                <input
                  value={editForm.fullName}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      fullName: e.target.value,
                    }))
                  }
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    color: "#fff",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "6px" }}>
                <span className="pm-info-lbl">Дата на раждане</span>
                <input
                  type="date"
                  value={editForm.birthDate}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      birthDate: e.target.value,
                    }))
                  }
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    color: "#fff",
                  }}
                />
              </label>
              <PlayerExtraFields
                settings={member}
                values={editForm}
                variant="member"
                onChange={(field, value) =>
                  setEditForm((prev) => ({ ...prev, [field]: value }))
                }
              />
              {playerFieldEnabled(member, "teamGroup") && (
                <label style={{ display: "grid", gap: "6px" }}>
                  <span className="pm-info-lbl">Набор</span>
                  <input
                    inputMode="numeric"
                    value={editForm.teamGroup}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        teamGroup: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      color: "#fff",
                    }}
                  />
                </label>
              )}
              {playerFieldEnabled(member, "jerseyNumber") && (
                <label style={{ display: "grid", gap: "6px" }}>
                  <span className="pm-info-lbl">Номер в отбора</span>
                  <input
                    value={editForm.jerseyNumber}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        jerseyNumber: e.target.value,
                      }))
                    }
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      color: "#fff",
                    }}
                  />
                </label>
              )}
              <label style={{ display: "grid", gap: "6px" }}>
                <span className="pm-info-lbl">Телефон на родител</span>
                <input
                  type="tel"
                  value={editForm.parentPhone}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      parentPhone: e.target.value,
                    }))
                  }
                  placeholder="+359..."
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    color: "#fff",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "6px" }}>
                <span className="pm-info-lbl">Телефон на състезател</span>
                <input
                  type="tel"
                  value={editForm.playerPhone}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      playerPhone: e.target.value,
                    }))
                  }
                  placeholder="+359..."
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    color: "#fff",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "6px" }}>
                <span className="pm-info-lbl">Нова снимка</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setEditImageFile(e.target.files?.[0] ?? null)
                  }
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    color: "#fff",
                  }}
                />
              </label>
            </div>

            {editImagePreviewUrl && (
              <img
                src={editImagePreviewUrl}
                alt="Image preview"
                style={{
                  width: "min(160px, 100%)",
                  aspectRatio: "4 / 5",
                  objectFit: "cover",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.22)",
                  marginTop: "6px",
                  marginInline: "auto",
                }}
              />
            )}

            {editError && (
              <div className="pm-error" style={{ marginTop: "10px" }}>
                {editError}
              </div>
            )}

            <div className="pm-divider" />

            <div className="pm-actions">
              <button
                className="pm-btn pm-btn--cancel"
                onClick={() => setEditModalOpen(false)}
                disabled={editSaving}
              >
                Отказ
              </button>
              <button
                className="pm-btn pm-btn--submit"
                onClick={handleSavePublicEdit}
                disabled={editSaving}
              >
                {editSaving ? "Запазване..." : "Запази"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

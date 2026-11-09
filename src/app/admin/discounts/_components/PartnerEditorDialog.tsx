"use client";

import { Check, Loader2, Upload, X } from "lucide-react";
import { type PartnerDiscount } from "../_types/discount-types";

type Props = {
  editingPartner: Partial<PartnerDiscount> | null;
  setEditingPartner: React.Dispatch<
    React.SetStateAction<Partial<PartnerDiscount> | null>
  >;
  handleImageUpload: (file: File) => Promise<void>;
  saving: boolean;
  badgeIsText: boolean;
  setBadgeIsText: React.Dispatch<React.SetStateAction<boolean>>;
  handleSavePartner: () => Promise<void>;
};

export function PartnerEditorDialog({
  editingPartner,
  setEditingPartner,
  handleImageUpload,
  saving,
  badgeIsText,
  setBadgeIsText,
  handleSavePartner,
}: Props) {
  return (
    <>
      {editingPartner && (
        <div className="modal-overlay" onClick={() => setEditingPartner(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setEditingPartner(null)}
            >
              <X size={24} />
            </button>
            <h2
              style={{
                marginBottom: "25px",
                color: "#32cd32",
                textAlign: "center",
                fontSize: "28px",
                fontWeight: "800",
              }}
            >
              {editingPartner.id ? "Редактирай партньор" : "Нов партньор"}
            </h2>

            <div className="form-group">
              <label className="form-label">Име на партньора</label>
              <input
                className="form-input"
                value={editingPartner.name || ""}
                onChange={(e) =>
                  setEditingPartner({ ...editingPartner, name: e.target.value })
                }
                placeholder="напр. Sport Depot"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Лого</label>
              <div
                className="clickable-upload-area"
                onClick={() =>
                  document.getElementById("partner-logo-input")?.click()
                }
                style={{
                  width: "100%",
                  height: "150px",
                  background: "rgba(255,255,255,0.03)",
                  border: "2px dashed rgba(50, 205, 50, 0.3)",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <input
                  type="file"
                  id="partner-logo-input"
                  style={{ display: "none" }}
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files?.[0] && handleImageUpload(e.target.files[0])
                  }
                />

                {editingPartner.logoUrl ? (
                  <img
                    src={editingPartner.logoUrl}
                    alt="Logo"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      padding: "10px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    <Upload
                      size={32}
                      style={{ marginBottom: "8px", color: "#32cd32" }}
                    />
                    <p style={{ fontSize: "14px", fontWeight: "500" }}>
                      Натиснете за избор на лого
                    </p>
                  </div>
                )}

                {saving && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(0,0,0,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Loader2
                      className="animate-spin"
                      color="#32cd32"
                      size={32}
                    />
                  </div>
                )}
              </div>
            </div>

            <div
              className="form-group"
              style={{ maxWidth: "400px", margin: "0 auto 20px" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label className="form-label">Отстъпка</label>
                  {badgeIsText ? (
                    <input
                      type="text"
                      className="form-input"
                      style={{ textAlign: "center", fontWeight: "700" }}
                      value={editingPartner.badgeText || ""}
                      onChange={(e) =>
                        setEditingPartner({
                          ...editingPartner,
                          badgeText: e.target.value,
                        })
                      }
                      placeholder="Партньорска цена"
                    />
                  ) : (
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{
                          paddingLeft: "28px",
                          paddingRight: "28px",
                          textAlign: "center",
                          fontWeight: "700",
                        }}
                        value={
                          editingPartner.badgeText?.replace(/[^0-9]/g, "") || ""
                        }
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            badgeText: e.target.value.replace(/[^0-9]/g, ""),
                          })
                        }
                        placeholder="10"
                      />
                      <span
                        style={{
                          position: "absolute",
                          left: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#32cd32",
                          fontWeight: "900",
                          pointerEvents: "none",
                        }}
                      >
                        -
                      </span>
                      <span
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#32cd32",
                          fontWeight: "900",
                          pointerEvents: "none",
                        }}
                      >
                        %
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label">Валидна до</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ textAlign: "center" }}
                    value={
                      editingPartner.validUntil
                        ? new Date(editingPartner.validUntil)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setEditingPartner({
                        ...editingPartner,
                        validUntil: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginTop: "10px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: badgeIsText ? "rgba(255,255,255,0.35)" : "#32cd32",
                    fontWeight: "700",
                    transition: "color 0.2s",
                  }}
                >
                  %
                </span>
                <div
                  onClick={() => {
                    setBadgeIsText(!badgeIsText);
                    setEditingPartner({ ...editingPartner, badgeText: "" });
                  }}
                  style={{
                    width: "36px",
                    height: "20px",
                    background: badgeIsText
                      ? "#32cd32"
                      : "rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: "14px",
                      height: "14px",
                      background: badgeIsText
                        ? "#000"
                        : "rgba(255,255,255,0.5)",
                      borderRadius: "50%",
                      position: "absolute",
                      top: "3px",
                      left: badgeIsText ? "19px" : "3px",
                      transition: "left 0.2s",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    color: badgeIsText ? "#32cd32" : "rgba(255,255,255,0.35)",
                    fontWeight: "700",
                    transition: "color 0.2s",
                  }}
                >
                  Текст
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Промо код</label>
              <input
                className="form-input"
                value={editingPartner.code || ""}
                onChange={(e) =>
                  setEditingPartner({ ...editingPartner, code: e.target.value })
                }
                placeholder="MYTEAM10"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Уебсайт (незадължително)</label>
              <input
                type="url"
                className="form-input"
                value={editingPartner.storeUrl || ""}
                onChange={(e) =>
                  setEditingPartner({
                    ...editingPartner,
                    storeUrl: e.target.value || null,
                  })
                }
                placeholder="https://example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Цвят на темата</label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                {[
                  "#ff4d4d",
                  "#ff6d00",
                  "#ffca28",
                  "#c6ff00",
                  "#32cd32",
                  "#00e5ff",
                  "#2979ff",
                  "#651fff",
                  "#d500f9",
                  "#ff4081",
                  "#ffffff",
                  "#aaaaaa",
                  "#e53935",
                  "#f57c00",
                  "#fdd835",
                  "#69f0ae",
                  "#00bcd4",
                  "#1565c0",
                  "#6a1b9a",
                  "#ad1457",
                  "#ff6e40",
                  "#546e7a",
                ].map((color) => {
                  const active =
                    (editingPartner.themeColor || "").toLowerCase() ===
                    color.toLowerCase();
                  return (
                    <div
                      key={color}
                      onClick={() =>
                        setEditingPartner({
                          ...editingPartner,
                          themeColor: color,
                        })
                      }
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        background: color,
                        cursor: "pointer",
                        border: active
                          ? "2px solid #fff"
                          : "2px solid transparent",
                        boxShadow: active ? `0 0 0 2px ${color}` : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "transform 0.15s",
                      }}
                      title={color}
                    >
                      {active && (
                        <Check
                          size={14}
                          color={
                            color === "#ffffff" ||
                            color === "#ffca28" ||
                            color === "#c6ff00" ||
                            color === "#fdd835"
                              ? "#000"
                              : "#fff"
                          }
                          strokeWidth={3}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                style={{ display: "flex", gap: "10px", alignItems: "center" }}
              >
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1, fontFamily: "monospace", fontSize: "14px" }}
                  value={editingPartner.themeColor || ""}
                  onChange={(e) =>
                    setEditingPartner({
                      ...editingPartner,
                      themeColor: e.target.value,
                    })
                  }
                  placeholder="#ff4d4d"
                />
                <div
                  style={{
                    width: "47px",
                    height: "47px",
                    flexShrink: 0,
                    borderRadius: "10px",
                    background: editingPartner.themeColor || "#ff4d4d",
                    border: "2px solid rgba(255,255,255,0.1)",
                    boxShadow: `0 0 15px ${editingPartner.themeColor || "#ff4d4d"}44`,
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Условия (напишете и натиснете Enter)
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                {editingPartner.terms?.map((term, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        textAlign: "left",
                        flex: 1,
                        color: "rgba(255,255,255,0.9)",
                        lineHeight: "1.4",
                      }}
                    >
                      {term}
                    </span>
                    <button
                      onClick={() => {
                        const newTerms = [...(editingPartner.terms || [])];
                        newTerms.splice(i, 1);
                        setEditingPartner({
                          ...editingPartner,
                          terms: newTerms,
                        });
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ff4d4d",
                        cursor: "pointer",
                        display: "flex",
                        padding: "2px",
                        opacity: 0.6,
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <input
                className="form-input"
                placeholder="напр. Важи само за нови клиенти"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      setEditingPartner({
                        ...editingPartner,
                        terms: [...(editingPartner.terms || []), val],
                      });
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
            </div>

            <button
              className="save-btn"
              onClick={handleSavePartner}
              disabled={saving}
              style={{
                background: "#32cd32",
                color: "#000",
                fontWeight: "800",
                marginTop: "20px",
              }}
            >
              {saving ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                  }}
                >
                  <Loader2 className="animate-spin" /> Запазване...
                </div>
              ) : (
                "Запази партньор"
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

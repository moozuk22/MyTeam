"use client";

import { GripVertical, X } from "lucide-react";
import { type PartnerDiscount, type Team } from "../_types/discount-types";

type Props = {
  editingTeam: Team | null;
  setEditingTeam: React.Dispatch<React.SetStateAction<Team | null>>;
  draggingId: string | null;
  dragIndex: number | null;
  startY: number;
  setDragY: React.Dispatch<React.SetStateAction<number>>;
  setStartY: React.Dispatch<React.SetStateAction<number>>;
  setDragIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setDraggingId: React.Dispatch<React.SetStateAction<string | null>>;
  partners: PartnerDiscount[];
  dragY: number;
  handleSaveTeamConfig: () => Promise<void>;
  saving: boolean;
};

export function ClubDiscountEditorDialog({
  editingTeam,
  setEditingTeam,
  draggingId,
  dragIndex,
  startY,
  setDragY,
  setStartY,
  setDragIndex,
  setDraggingId,
  partners,
  dragY,
  handleSaveTeamConfig,
  saving,
}: Props) {
  return (
    <>
      {editingTeam && (
        <div className="modal-overlay" onClick={() => setEditingTeam(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setEditingTeam(null)}
            >
              <X size={24} />
            </button>

            <div style={{ marginBottom: "30px", textAlign: "center" }}>
              <h2
                style={{
                  color: "#32cd32",
                  fontSize: "28px",
                  fontWeight: "900",
                  marginBottom: "8px",
                }}
              >
                Настройка за {editingTeam.clubName}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
                Включете отстъпките за този отбор и ги подредете.
              </p>
            </div>

            <div
              className="config-list"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "30px",
                position: "relative",
              }}
              onPointerMove={(e) => {
                if (!draggingId || dragIndex === null) return;
                const deltaY = e.clientY - startY;
                setDragY(deltaY);

                const rowHeight = 66;
                const newIndex = Math.max(
                  0,
                  Math.min(
                    editingTeam.configs.length - 1,
                    Math.round(dragIndex + deltaY / rowHeight),
                  ),
                );

                if (newIndex !== dragIndex) {
                  const newConfigs = [...editingTeam.configs].sort(
                    (a, b) => a.order - b.order,
                  );
                  const [moved] = newConfigs.splice(dragIndex, 1);
                  newConfigs.splice(newIndex, 0, moved);
                  const finalConfigs = newConfigs.map((c, idx) => ({
                    ...c,
                    order: idx,
                  }));

                  // COMPENSATE STARTY TO KEEP IT STICKY
                  const diff = (newIndex - dragIndex) * rowHeight;
                  setStartY((prev) => prev + diff);
                  setDragY(deltaY - diff);
                  setDragIndex(newIndex);
                  setEditingTeam({ ...editingTeam, configs: finalConfigs });
                }
              }}
              onPointerUp={() => {
                setDraggingId(null);
                setDragY(0);
                setDragIndex(null);
              }}
              onPointerLeave={() => {
                setDraggingId(null);
                setDragY(0);
                setDragIndex(null);
              }}
            >
              {editingTeam.configs
                .sort((a, b) => a.order - b.order)
                .map((config, index) => {
                  const partner = partners.find(
                    (p) => p.id === config.discountId,
                  );
                  if (!partner) return null;

                  const isDragging = draggingId === config.discountId;

                  return (
                    <div
                      key={config.discountId}
                      onPointerDown={(e) => {
                        setDraggingId(config.discountId);
                        setDragIndex(index);
                        setStartY(e.clientY);
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      className={`config-item ${isDragging ? "dragging" : ""}`}
                      style={{
                        background: isDragging
                          ? "rgba(50, 205, 50, 0.12)"
                          : "rgba(255,255,255,0.03)",
                        border: isDragging
                          ? "2px solid #32cd32"
                          : "1px solid rgba(255,255,255,0.08)",
                        padding: "12px 16px",
                        borderRadius: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "grab",
                        transition: isDragging
                          ? "none"
                          : "transform 0.4s cubic-bezier(0.2, 1, 0.2, 1), background 0.2s",
                        transform: isDragging
                          ? `translateY(${dragY}px) scale(1.04)`
                          : "none",
                        boxShadow: isDragging
                          ? "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(50, 205, 50, 0.3)"
                          : "none",
                        zIndex: isDragging ? 100 : 1,
                        touchAction: "none",
                        willChange: "transform",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "15px",
                          pointerEvents: "none",
                        }}
                      >
                        <GripVertical
                          size={16}
                          style={{
                            color: isDragging
                              ? "#32cd32"
                              : "rgba(255,255,255,0.2)",
                          }}
                        />
                        <div
                          className="partner-logo-wrap"
                          style={{
                            width: "40px",
                            height: "40px",
                            margin: 0,
                            background: "rgba(255,255,255,0.05)",
                          }}
                        >
                          <img
                            src={partner.logoUrl || "/placeholder.webp"}
                            alt=""
                            className="partner-logo"
                          />
                        </div>
                        <div
                          style={{
                            color: config.isVisible
                              ? "#fff"
                              : "rgba(255,255,255,0.3)",
                            fontSize: "16px",
                            fontWeight: "700",
                          }}
                        >
                          {partner.name}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "15px",
                        }}
                      >
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newConfigs = editingTeam.configs.map((c) =>
                              c.discountId === config.discountId
                                ? { ...c, isVisible: !c.isVisible }
                                : c,
                            );
                            setEditingTeam({
                              ...editingTeam,
                              configs: newConfigs,
                            });
                          }}
                          style={{
                            width: "44px",
                            height: "24px",
                            background: config.isVisible
                              ? "#32cd32"
                              : "rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            position: "relative",
                            cursor: "pointer",
                            transition: "all 0.3s",
                          }}
                        >
                          <div
                            style={{
                              width: "18px",
                              height: "18px",
                              background: config.isVisible
                                ? "#000"
                                : "rgba(255,255,255,0.4)",
                              borderRadius: "50%",
                              position: "absolute",
                              top: "3px",
                              left: config.isVisible ? "23px" : "3px",
                              transition: "all 0.3s",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <button
              className="save-btn"
              onClick={handleSaveTeamConfig}
              disabled={saving}
              style={{
                background: "#32cd32",
                color: "#000",
                fontWeight: "800",
                height: "54px",
              }}
            >
              {saving ? "Запазване..." : "Запази промените"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

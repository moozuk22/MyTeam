"use client";

import { ArrowLeft, Edit2, Plus, Settings2, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PartnerClubsDialog from "./PartnerClubsDialog";
import { ClubDiscountEditorDialog } from "./_components/ClubDiscountEditorDialog";
import { PartnerEditorDialog } from "./_components/PartnerEditorDialog";
import { useClubDiscountEditor } from "./_hooks/useClubDiscountEditor";
import { usePartnerEditor } from "./_hooks/usePartnerEditor";
import { type PartnerDiscount, type Team } from "./_types/discount-types";

import "./page.css";

export default function DiscountsPageClient() {
  const router = useRouter();
  const [partners, setPartners] = useState<PartnerDiscount[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [teamSearch, setTeamSearch] = useState("");
  const [clubPartner, setClubPartner] = useState<PartnerDiscount | null>(null);
  const {
    editingTeam,
    setEditingTeam,
    draggingId,
    setDraggingId,
    dragY,
    setDragY,
    startY,
    setStartY,
    dragIndex,
    setDragIndex,
    handleSaveTeamConfig,
  } = useClubDiscountEditor({
    setSaving,
    fetchData: () => fetchData(),
  });

  const {
    editingPartner,
    setEditingPartner,
    badgeIsText,
    setBadgeIsText,
    handleSavePartner,
    handleDeletePartner,
    handleImageUpload,
  } = usePartnerEditor({ setSaving, fetchData: () => fetchData() });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [partnersRes, teamsRes] = await Promise.all([
        fetch("/api/admin/discounts"),
        fetch("/api/admin/teams/discounts"),
      ]);
      const partnersData = await partnersRes.json();
      const teamsData = await teamsRes.json();

      setPartners(Array.isArray(partnersData) ? partnersData : []);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
    } catch (error) {
      console.error("Fetch data error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="discounts-admin">
        <div className="admin-container">
          <p>Зареждане...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="discounts-admin">
      <div className="admin-container">
        <header className="admin-header">
          <div>
            <button
              onClick={() => router.push("/admin/players")}
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "6px 12px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                width: "fit-content",
                fontSize: "13px",
                fontWeight: "600",
                marginBottom: "15px",
              }}
            >
              <ArrowLeft size={14} /> Назад
            </button>
            <h1 className="admin-title">Управление на отстъпки</h1>
            <p style={{ color: "#666", marginTop: "4px" }}>
              Настройте кои отстъпки да се виждат за всеки отбор.
            </p>
          </div>
          <button
            className="add-btn"
            onClick={() => {
              setEditingPartner({});
              setBadgeIsText(false);
            }}
          >
            <Plus size={20} />
            Добави партньор
          </button>
        </header>

        <section className="section-card">
          <h3 className="section-title">
            <Settings2 size={20} /> Партньори
          </h3>
          <div className="partners-grid">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="partner-card"
                style={{
                  backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.9)), url(${partner.logoUrl || "/placeholder.webp"})`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "170px",
                  position: "relative",
                  overflow: "hidden",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                }}
              >
                <button
                  type="button"
                  className="partner-card-open"
                  aria-label={`Управление на клубовете за ${partner.name}`}
                  onClick={() => setClubPartner(partner)}
                />
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    textAlign: "center",
                    width: "100%",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    className="partner-name"
                    style={{
                      fontSize: "18px",
                      fontWeight: "800",
                      marginBottom: "10px",
                      color: "#fff",
                      textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    {partner.name}
                  </div>
                  <div
                    className="partner-badge"
                    style={{
                      display: "inline-block",
                      background: "rgba(50, 205, 50, 0.9)",
                      color: "#000",
                      padding: "6px 16px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: "800",
                      boxShadow: "0 4px 12px rgba(50, 205, 50, 0.3)",
                    }}
                  >
                    {partner.badgeText || "Няма отстъпка"}
                  </div>
                  <p className="partner-card-clubs-hint">
                    <Users size={14} />{" "}
                    {
                      teams.filter((team) =>
                        team.configs.some(
                          (config) =>
                            config.discountId === partner.id &&
                            config.teamGroup === 0 &&
                            config.isVisible,
                        ),
                      ).length
                    }{" "}
                    клуба · Управлявай
                  </p>
                  <div
                    style={{
                      marginTop: "16px",
                      display: "flex",
                      gap: "12px",
                      justifyContent: "center",
                      pointerEvents: "auto",
                    }}
                  >
                    <button
                      className="order-btn"
                      style={{
                        background: "rgba(50, 150, 255, 0.2)",
                        color: "#4dabf7",
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                      }}
                      onClick={() => {
                        setEditingPartner(partner);
                        setBadgeIsText(
                          !/^-\d+%$/.test(partner.badgeText || ""),
                        );
                      }}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      className="order-btn"
                      style={{
                        background: "rgba(255, 68, 68, 0.2)",
                        color: "#ff6666",
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                      }}
                      onClick={() => handleDeletePartner(partner.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <h3 className="section-title" style={{ margin: 0 }}>
              <Users size={20} /> Настройка по отбори
            </h3>
            <input
              type="text"
              className="form-input"
              style={{ width: "240px", fontSize: "14px" }}
              placeholder="Търси отбор..."
              aria-label="Търси отбор"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
            />
          </div>
          <div className="teams-list">
            {teams
              .filter((t) =>
                t.clubName.toLowerCase().includes(teamSearch.toLowerCase()),
              )
              .map((team) => (
                <div key={`${team.clubId}`} className="team-row">
                  <div className="team-header">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                      }}
                    >
                      <div
                        className="partner-logo-wrap"
                        style={{
                          width: "70px",
                          height: "70px",
                          margin: 0,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {team.clubLogoUrl ? (
                          <img
                            src={team.clubLogoUrl}
                            alt={team.clubName}
                            className="partner-logo"
                          />
                        ) : (
                          <Users size={32} style={{ color: "#333" }} />
                        )}
                      </div>
                      <div
                        className="team-info"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <h4
                          style={{
                            fontSize: "24px",
                            color: "#fff",
                            fontWeight: "800",
                            margin: 0,
                          }}
                        >
                          {team.clubName}
                        </h4>
                        <p
                          style={{
                            fontSize: "15px",
                            color: "rgba(255,255,255,0.5)",
                            fontWeight: "500",
                            margin: 0,
                          }}
                        >
                          {team.configs.filter((c) => c.isVisible).length}{" "}
                          активни отстъпки
                        </p>
                      </div>
                    </div>
                    <button
                      className="add-btn"
                      style={{
                        background: "#32cd32",
                        color: "#000",
                        fontWeight: "800",
                        boxShadow: "0 0 20px rgba(50, 205, 50, 0.4)",
                      }}
                      onClick={() => {
                        // Auto-populate all partners if missing
                        const allPartnerIds = partners.map((p) => p.id);
                        const existingIds = team.configs.map(
                          (c) => c.discountId,
                        );
                        const missingIds = allPartnerIds.filter(
                          (id) => !existingIds.includes(id),
                        );

                        const fullConfigs = [
                          ...team.configs,
                          ...missingIds.map((id, idx) => ({
                            discountId: id,
                            teamGroup: 0,
                            order: team.configs.length + idx,
                            isVisible: false,
                          })),
                        ];

                        setEditingTeam({ ...team, configs: fullConfigs });
                      }}
                    >
                      Настрой
                    </button>
                  </div>

                  <div
                    className="team-discounts"
                    style={{
                      marginTop: "20px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    {team.configs
                      .filter((c) => c.isVisible)
                      .sort((a, b) => a.order - b.order)
                      .map((config) => (
                        <div
                          key={config.discountId}
                          className="discount-tag"
                          style={{
                            background: "rgba(50, 205, 50, 0.1)",
                            color: "#32cd32",
                            border: "1px solid rgba(50, 205, 50, 0.2)",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <img
                            src={
                              config.discount?.logoUrl || "/placeholder.webp"
                            }
                            alt=""
                            style={{
                              width: "16px",
                              height: "16px",
                              objectFit: "contain",
                            }}
                          />
                          <span style={{ fontWeight: "600", fontSize: "13px" }}>
                            {config.discount?.name}
                          </span>
                        </div>
                      ))}
                    {team.configs.filter((c) => c.isVisible).length === 0 && (
                      <div
                        style={{
                          padding: "12px",
                          background: "rgba(255,255,255,0.02)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          color: "rgba(255,255,255,0.2)",
                          width: "100%",
                          textAlign: "center",
                          border: "1px dashed rgba(255,255,255,0.05)",
                        }}
                      >
                        Няма настроени активни отстъпки.
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>

      {clubPartner && (
        <PartnerClubsDialog
          partner={clubPartner}
          teams={teams}
          onClose={() => setClubPartner(null)}
          onSaved={() => {
            setClubPartner(null);
            void fetchData();
          }}
        />
      )}

      {/* Partner Edit Modal */}
      <PartnerEditorDialog
        editingPartner={editingPartner}
        setEditingPartner={setEditingPartner}
        handleImageUpload={handleImageUpload}
        saving={saving}
        badgeIsText={badgeIsText}
        setBadgeIsText={setBadgeIsText}
        handleSavePartner={handleSavePartner}
      />

      {/* Team Config Modal */}
      <ClubDiscountEditorDialog
        editingTeam={editingTeam}
        setEditingTeam={setEditingTeam}
        draggingId={draggingId}
        dragIndex={dragIndex}
        startY={startY}
        setDragY={setDragY}
        setStartY={setStartY}
        setDragIndex={setDragIndex}
        setDraggingId={setDraggingId}
        partners={partners}
        dragY={dragY}
        handleSaveTeamConfig={handleSaveTeamConfig}
        saving={saving}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Check, X, GripVertical, ArrowLeft, Settings2, Users, Upload, Loader2 } from "lucide-react";
import { uploadImage } from "@/lib/uploadImage";
import "./page.css";

interface PartnerDiscount {
  id: string;
  name: string;
  logoUrl: string | null;
  badgeText: string | null;
  description: string | null;
  code: string | null;
  validUntil: string | null;
  storeUrl: string | null;
  terms: string[];
}

interface TeamConfig {
  discountId: string;
  order: number;
  isVisible: boolean;
  discount?: PartnerDiscount;
}

interface Team {
  clubId: string;
  teamGroup: number;
  clubName: string;
  clubLogoUrl: string | null;
  configs: TeamConfig[];
}

export default function DiscountsPageClient() {
  const router = useRouter();
  const [partners, setPartners] = useState<PartnerDiscount[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPartner, setEditingPartner] = useState<Partial<PartnerDiscount> | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [saving, setSaving] = useState(false);

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

  const handleSavePartner = async () => {
    if (!editingPartner?.name) return;
    setSaving(true);
    try {
      const method = editingPartner.id ? "PUT" : "POST";
      const url = "/api/admin/discounts";
      
      // Ensure badgeText is formatted with - and % if it's just a number
      const payload = {
        ...editingPartner,
        badgeText: editingPartner.badgeText?.startsWith('-') ? editingPartner.badgeText : `-${editingPartner.badgeText}%`
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditingPartner(null);
        fetchData();
      }
    } catch (error) {
      console.error("Save partner error:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePartner = async (id: string) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете този партньор?")) return;
    try {
      const res = await fetch(`/api/admin/discounts?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (error) {
      console.error("Delete partner error:", error);
    }
  };

  const handleImageUpload = async (file: File) => {
    setSaving(true);
    try {
      const response = await uploadImage(file, "club", editingPartner?.name || "partner-logo");
      setEditingPartner({ ...editingPartner, logoUrl: response.secure_url });
    } catch (error) {
      alert("Грешка при качване: " + (error instanceof Error ? error.message : "Неизвестна грешка"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTeamConfig = async () => {
    if (!editingTeam) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/teams/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId: editingTeam.clubId,
          teamGroup: 0, // Set to 0 for entire club
          discountConfigs: editingTeam.configs.map((c, i) => ({
            discountId: c.discountId,
            order: i,
            isVisible: c.isVisible,
          })),
        }),
      });

      if (res.ok) {
        setEditingTeam(null);
        fetchData();
      }
    } catch (error) {
      console.error("Save team config error:", error);
    } finally {
      setSaving(false);
    }
  };

  const moveConfig = (index: number, direction: "up" | "down") => {
    if (!editingTeam) return;
    const newConfigs = [...editingTeam.configs];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newConfigs.length) return;
    
    [newConfigs[index], newConfigs[targetIndex]] = [newConfigs[targetIndex], newConfigs[index]];
    setEditingTeam({ ...editingTeam, configs: newConfigs });
  };

  const toggleVisibility = (index: number) => {
    if (!editingTeam) return;
    const newConfigs = [...editingTeam.configs];
    newConfigs[index].isVisible = !newConfigs[index].isVisible;
    setEditingTeam({ ...editingTeam, configs: newConfigs });
  };

  const addDiscountToTeam = (discountId: string) => {
    if (!editingTeam) return;
    if (editingTeam.configs.some(c => c.discountId === discountId)) return;
    
    const discount = partners.find(p => p.id === discountId);
    const newConfigs = [...editingTeam.configs, {
      discountId,
      order: editingTeam.configs.length,
      isVisible: true,
      discount
    }];
    setEditingTeam({ ...editingTeam, configs: newConfigs });
  };

  const removeDiscountFromTeam = (index: number) => {
    if (!editingTeam) return;
    const newConfigs = editingTeam.configs.filter((_, i) => i !== index);
    setEditingTeam({ ...editingTeam, configs: newConfigs });
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
              onClick={() => router.push('/admin/players')}
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
                marginBottom: "15px"
              }}
            >
              <ArrowLeft size={14} /> Назад
            </button>
            <h1 className="admin-title">Управление на отстъпки</h1>
            <p style={{ color: "#666", marginTop: "4px" }}>Настройте кои отстъпки да се виждат за всеки отбор.</p>
          </div>
          <button className="add-btn" onClick={() => setEditingPartner({})}>
            <Plus size={20} />
            Добави партньор
          </button>
        </header>

        <section className="section-card">
          <h3 className="section-title"><Settings2 size={20} /> Партньори</h3>
          <div className="partners-grid">
            {partners.map(partner => (
                <div 
                key={partner.id} 
                className="partner-card"
                style={{
                  backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.9)), url(${partner.logoUrl || "/placeholder.png"})`,
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
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                }}
              >
                <div style={{ position: "relative", zIndex: 2, textAlign: "center", width: "100%" }}>
                  <div className="partner-name" style={{ 
                    fontSize: "18px", 
                    fontWeight: "800", 
                    marginBottom: "10px", 
                    color: "#fff",
                    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase"
                  }}>
                    {partner.name}
                  </div>
                  <div className="partner-badge" style={{ 
                    display: "inline-block", 
                    background: "rgba(50, 205, 50, 0.9)", 
                    color: "#000", 
                    padding: "6px 16px", 
                    borderRadius: "10px", 
                    fontSize: "13px", 
                    fontWeight: "800",
                    boxShadow: "0 4px 12px rgba(50, 205, 50, 0.3)"
                  }}>
                    {partner.badgeText || "Няма отстъпка"}
                  </div>
                  <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "center" }}>
                    <button className="order-btn" style={{ background: "rgba(50, 150, 255, 0.2)", color: "#4dabf7", width: "36px", height: "36px", borderRadius: "10px" }} onClick={() => setEditingPartner(partner)}><Edit2 size={18} /></button>
                    <button className="order-btn" style={{ background: "rgba(255, 68, 68, 0.2)", color: "#ff6666", width: "36px", height: "36px", borderRadius: "10px" }} onClick={() => handleDeletePartner(partner.id)}><Trash2 size={18} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <h3 className="section-title"><Users size={20} /> Настройка по отбори</h3>
          <div className="teams-list">
            {teams.map(team => (
              <div key={`${team.clubId}`} className="team-row">
                <div className="team-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <div className="partner-logo-wrap" style={{ width: "70px", height: "70px", margin: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {team.clubLogoUrl ? (
                        <img src={team.clubLogoUrl} alt={team.clubName} className="partner-logo" />
                      ) : (
                        <Users size={32} style={{ color: "#333" }} />
                      )}
                    </div>
                    <div className="team-info" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <h4 style={{ fontSize: "24px", color: "#fff", fontWeight: "800", margin: 0 }}>{team.clubName}</h4>
                      <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.5)", fontWeight: "500", margin: 0 }}>{team.configs.filter(c => c.isVisible).length} активни отстъпки</p>
                    </div>
                  </div>
                  <button className="add-btn" style={{ background: "#32cd32", color: "#000", fontWeight: "800", boxShadow: "0 0 20px rgba(50, 205, 50, 0.4)" }} onClick={() => setEditingTeam(team)}>
                    Настрой
                  </button>
                </div>
                
                <div className="team-discounts" style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {team.configs.filter(c => c.isVisible).sort((a,b) => a.order - b.order).map(config => (
                    <div key={config.discountId} className="discount-tag" style={{ background: "rgba(50, 205, 50, 0.1)", color: "#32cd32", border: "1px solid rgba(50, 205, 50, 0.2)", padding: "6px 12px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <img src={config.discount?.logoUrl || "/placeholder.png"} alt="" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
                      <span style={{ fontWeight: "600", fontSize: "13px" }}>{config.discount?.name}</span>
                    </div>
                  ))}
                  {team.configs.filter(c => c.isVisible).length === 0 && (
                    <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", fontSize: "14px", color: "rgba(255,255,255,0.2)", width: "100%", textAlign: "center", border: "1px dashed rgba(255,255,255,0.05)" }}>
                      Няма настроени активни отстъпки.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Partner Edit Modal */}
      {editingPartner && (
        <div className="modal-overlay" onClick={() => setEditingPartner(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingPartner(null)}><X size={24} /></button>
            <h2 style={{ marginBottom: "25px", color: "#32cd32", textAlign: "center", fontSize: "28px", fontWeight: "800" }}>
              {editingPartner.id ? "Редактирай партньор" : "Нов партньор"}
            </h2>
            
            <div className="form-group">
              <label className="form-label">Име на партньора</label>
              <input 
                className="form-input" 
                value={editingPartner.name || ""} 
                onChange={e => setEditingPartner({...editingPartner, name: e.target.value})}
                placeholder="напр. Sport Depot"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Лого</label>
              <div 
                className="clickable-upload-area" 
                onClick={() => document.getElementById('partner-logo-input')?.click()}
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
                  position: "relative"
                }}
              >
                <input 
                  type="file" 
                  id="partner-logo-input" 
                  style={{ display: "none" }} 
                  accept="image/*"
                  onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
                
                {editingPartner.logoUrl ? (
                  <img src={editingPartner.logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "10px" }} />
                ) : (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                    <Upload size={32} style={{ marginBottom: "8px", color: "#32cd32" }} />
                    <p style={{ fontSize: "14px", fontWeight: "500" }}>Натиснете за избор на лого</p>
                  </div>
                )}
                
                {saving && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader2 className="animate-spin" color="#32cd32" size={32} />
                  </div>
                )}
              </div>
            </div>
            
            <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", maxWidth: "400px", margin: "0 auto 20px" }}>
              <div>
                <label className="form-label" style={{ textAlign: "center" }}>Отстъпка</label>
                <div style={{ position: "relative" }}>
                  <input 
                    type="text"
                    className="form-input" 
                    style={{ paddingLeft: "30px", paddingRight: "30px", textAlign: "center", fontSize: "18px", fontWeight: "700" }}
                    value={editingPartner.badgeText?.replace(/[^0-9]/g, '') || ""} 
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setEditingPartner({...editingPartner, badgeText: val});
                    }}
                    placeholder="10"
                  />
                  <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#32cd32", fontWeight: "900" }}>-</div>
                  <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#32cd32", fontWeight: "900" }}>%</div>
                </div>
              </div>
              <div>
                <label className="form-label" style={{ textAlign: "center" }}>Валидна до</label>
                <input 
                  type="date"
                  className="form-input" 
                  style={{ textAlign: "center" }}
                  value={editingPartner.validUntil ? new Date(editingPartner.validUntil).toISOString().split('T')[0] : ""} 
                  onChange={e => setEditingPartner({...editingPartner, validUntil: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Промо код</label>
              <input 
                className="form-input" 
                value={editingPartner.code || ""} 
                onChange={e => setEditingPartner({...editingPartner, code: e.target.value})}
                placeholder="MYTEAM10"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Условия (напишете и натиснете Enter)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                {editingPartner.terms?.map((term, i) => (
                  <div key={i} style={{ 
                    background: "rgba(255,255,255,0.05)", 
                    padding: "6px 12px", 
                    borderRadius: "8px", 
                    fontSize: "13px", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "8px",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}>
                    <span>{term}</span>
                    <button 
                      onClick={() => {
                        const newTerms = [...(editingPartner.terms || [])];
                        newTerms.splice(i, 1);
                        setEditingPartner({...editingPartner, terms: newTerms});
                      }}
                      style={{ background: "none", border: "none", color: "#ff4444", cursor: "pointer", display: "flex", padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <input 
                className="form-input" 
                placeholder="напр. Важи само за нови клиенти"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      setEditingPartner({
                        ...editingPartner, 
                        terms: [...(editingPartner.terms || []), val]
                      });
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>

            <button 
              className="save-btn" 
              onClick={handleSavePartner} 
              disabled={saving}
              style={{ background: "#32cd32", color: "#000", fontWeight: "800", marginTop: "20px" }}
            >
              {saving ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}><Loader2 className="animate-spin" /> Запазване...</div> : "Запази партньор"}
            </button>
          </div>
        </div>
      )}

      {/* Team Config Modal */}
      {editingTeam && (
        <div className="modal-overlay" onClick={() => setEditingTeam(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingTeam(null)}><X size={24} /></button>
            
            <div className="modal-header" style={{ textAlign: "center", marginBottom: "30px" }}>
              <h2 className="modal-title" style={{ color: "#32cd32", fontSize: "28px", fontWeight: "900", marginBottom: "8px" }}>Настройка за {editingTeam.clubName}</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Изберете кои отстъпки да се виждат и ги подредете.</p>
            </div>

            <div className="config-list" style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "30px" }}>
              {editingTeam.configs.sort((a,b) => a.order - b.order).map((config, index) => {
                const partner = partners.find(p => p.id === config.discountId);
                if (!partner) return null;
                return (
                  <div 
                    key={config.discountId} 
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("index", index.toString())}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIndex = parseInt(e.dataTransfer.getData("index"));
                      const toIndex = index;
                      const newConfigs = [...editingTeam.configs].sort((a,b) => a.order - b.order);
                      const [moved] = newConfigs.splice(fromIndex, 1);
                      newConfigs.splice(toIndex, 0, moved);
                      
                      // Re-map all orders
                      const finalConfigs = newConfigs.map((c, idx) => ({ ...c, order: idx }));
                      setEditingTeam({ ...editingTeam, configs: finalConfigs });
                    }}
                    className="config-item"
                    style={{ 
                      background: "rgba(255,255,255,0.03)", 
                      border: "1px solid rgba(255,255,255,0.08)", 
                      padding: "12px 16px", 
                      borderRadius: "16px", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      cursor: "grab",
                      transition: "background 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                      <GripVertical size={16} style={{ color: "rgba(255,255,255,0.2)" }} />
                      <div className="partner-logo-wrap" style={{ width: "40px", height: "40px", margin: 0, background: "rgba(255,255,255,0.05)" }}>
                        <img src={partner.logoUrl || "/placeholder.png"} alt="" className="partner-logo" />
                      </div>
                      <div style={{ color: config.isVisible ? "#fff" : "rgba(255,255,255,0.3)", fontSize: "16px", fontWeight: "700" }}>
                        {partner.name}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newConfigs = editingTeam.configs.map(c => 
                            c.discountId === config.discountId ? { ...c, isVisible: !c.isVisible } : c
                          );
                          setEditingTeam({ ...editingTeam, configs: newConfigs });
                        }}
                        style={{ 
                          width: "44px", 
                          height: "24px", 
                          background: config.isVisible ? "#32cd32" : "rgba(255,255,255,0.1)", 
                          borderRadius: "12px", 
                          position: "relative", 
                          cursor: "pointer",
                          transition: "all 0.3s"
                        }}
                      >
                        <div style={{ 
                          width: "18px", 
                          height: "18px", 
                          background: config.isVisible ? "#000" : "rgba(255,255,255,0.4)", 
                          borderRadius: "50%", 
                          position: "absolute", 
                          top: "3px", 
                          left: config.isVisible ? "23px" : "3px",
                          transition: "all 0.3s"
                        }} />
                      </div>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newConfigs = editingTeam.configs.filter(c => c.discountId !== config.discountId);
                          setEditingTeam({ ...editingTeam, configs: newConfigs });
                        }}
                        style={{ background: "none", border: "none", color: "rgba(255,77,77,0.5)", cursor: "pointer", padding: "4px" }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="available-partners" style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "30px" }}>
              {partners.filter(p => !editingTeam.configs.some(c => c.discountId === p.id)).map(partner => (
                <button
                  key={partner.id}
                  onClick={() => {
                    const newConfigs = [
                      ...editingTeam.configs,
                      { clubId: editingTeam.clubId, teamGroup: 0, discountId: partner.id, order: editingTeam.configs.length, isVisible: true }
                    ];
                    setEditingTeam({ ...editingTeam, configs: newConfigs });
                  }}
                  style={{ 
                    background: "rgba(255,255,255,0.03)", 
                    color: "rgba(255,255,255,0.4)", 
                    border: "1px solid rgba(255,255,255,0.08)", 
                    padding: "8px 14px", 
                    borderRadius: "10px", 
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    transition: "all 0.2s"
                  }}
                >
                  + {partner.name}
                </button>
              ))}
            </div>

            <button 
              className="save-btn" 
              onClick={handleSaveTeamConfig} 
              disabled={saving}
              style={{ background: "#32cd32", color: "#000", fontWeight: "800", height: "54px" }}
            >
              {saving ? "Запазване..." : "Запази промените"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

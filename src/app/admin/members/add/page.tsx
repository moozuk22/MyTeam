"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./page.css";

export default function AddMemberPage() {
  const [fullName, setFullName] = useState("");
  const [clubId, setClubId] = useState("");
  const [status, setStatus] = useState<"paid" | "warning" | "overdue">("paid");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [teamGroup, setTeamGroup] = useState("");
  const [lastPaymentDate, setLastPaymentDate] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleCreateMember = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const payload: Record<string, string> = {
        fullName: fullName.trim(),
        status,
      };

      if (clubId.trim()) payload.clubId = clubId.trim();
      if (jerseyNumber.trim()) payload.jerseyNumber = jerseyNumber.trim();
      if (birthDate.trim()) payload.birthDate = birthDate.trim();
      if (teamGroup.trim()) payload.teamGroup = teamGroup.trim();
      if (lastPaymentDate.trim()) payload.lastPaymentDate = lastPaymentDate.trim();
      if (avatarUrl.trim()) payload.avatarUrl = avatarUrl.trim();

      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push("/admin/members");
      } else {
        const data = await response.json();
        setError(data.error || "Грешка при създаване на играч");
      }
    } catch (err) {
      setError("Възникна грешка. Моля опитайте отново.");
      console.error("Error creating player:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-member-page">
      <div className="add-member-dot-grid" />

      <div className="add-member-inner">
        {/* Header */}
        <div className="add-member-header">
          <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="add-member-logo">
            <path d="M60 2 L115 20 L115 85 Q115 120 60 138 Q5 120 5 85 L5 20 Z" fill="#1a5c1a" stroke="#32cd32" strokeWidth="3" />
            <path d="M60 8 L109 24 L109 83 Q109 114 60 132 Q11 114 11 83 L11 24 Z" fill="#0d3d0d" />
            <rect x="15" y="18" width="90" height="22" rx="2" fill="#1a5c1a" />
            <text x="60" y="33" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="Arial, sans-serif">ФК ВИХЪР</text>
            <rect x="20" y="44" width="16" height="40" fill="#ffffff" />
            <rect x="36" y="44" width="16" height="40" fill="#32cd32" />
            <rect x="52" y="44" width="16" height="40" fill="#ffffff" />
            <rect x="68" y="44" width="16" height="40" fill="#32cd32" />
            <rect x="84" y="44" width="16" height="40" fill="#ffffff" />
            <circle cx="60" cy="64" r="14" fill="#1a5c1a" stroke="#32cd32" strokeWidth="1.5" />
            <circle cx="60" cy="64" r="10" fill="none" stroke="#ffffff" strokeWidth="1" />
            <text x="60" y="68" textAnchor="middle" fill="#ffffff" fontSize="12">⚽</text>
            <rect x="15" y="88" width="90" height="20" rx="2" fill="#1a5c1a" />
            <text x="60" y="102" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="700" fontFamily="Arial, sans-serif">ВОЙВОДИНОВО</text>
            <text x="60" y="122" textAnchor="middle" fill="#32cd32" fontSize="14" fontWeight="800" fontFamily="Arial, sans-serif">1961</text>
          </svg>
          <h1 className="add-member-title">Добави нов играч</h1>
          <div className="add-member-title-line" />
        </div>

        {/* Back button */}
        <Link href="/admin/members" className="add-member-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Назад към играчи
        </Link>

        {/* Form card */}
        <div className="add-member-card">
          <form onSubmit={handleCreateMember} className="add-member-form">

            <div className="add-member-field">
              <label className="add-member-label">Име и фамилия</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="add-member-input"
                placeholder="Въведете пълно име"
              />
            </div>

            <div className="add-member-field">
              <label className="add-member-label">Club ID <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(по желание, ако има само един клуб)</span></label>
              <input
                type="text"
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="add-member-input"
                placeholder="Club UUID"
              />
            </div>

            <div className="add-member-hint">
              ⚡ Кодът на картата се генерира автоматично при създаване на играч.
            </div>

            <div className="add-member-divider" />

            <div className="add-member-field">
              <label className="add-member-label">Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "paid" | "warning" | "overdue")}
                className="add-member-select"
              >
                <option value="paid">Платено</option>
                <option value="warning">Напомняне</option>
                <option value="overdue">Просрочено</option>
              </select>
            </div>

            <div className="add-member-field">
              <label className="add-member-label">Номер в отбора</label>
              <input
                type="text"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                className="add-member-input"
                placeholder="По желание"
              />
            </div>

            <div className="add-member-field">
              <label className="add-member-label">Дата на раждане</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="add-member-input"
              />
            </div>

            <div className="add-member-field">
              <label className="add-member-label">Набор</label>
              <input
                type="number"
                min="1"
                value={teamGroup}
                onChange={(e) => setTeamGroup(e.target.value)}
                className="add-member-input"
                placeholder="По желание"
              />
            </div>

            <div className="add-member-field">
              <label className="add-member-label">Снимка на играч</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="add-member-input"
                placeholder="https://..."
              />
            </div>

            {error && (
              <div className="add-member-error">{error}</div>
            )}

            <div className="add-member-actions">
              <button
                type="button"
                onClick={() => router.push("/admin/members")}
                className="add-member-btn-cancel"
              >
                Отказ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="add-member-btn-submit"
              >
                {isSubmitting ? "Създаване..." : "Създай играч"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
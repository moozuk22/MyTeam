"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { uploadImage } from "@/lib/uploadImage";
import { extractUploadPathFromCloudinaryUrl } from "@/lib/cloudinaryImagePath";
import "./page.css";

export default function AddMemberPage() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId")?.trim() ?? "";
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<"paid" | "warning" | "overdue">("paid");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [teamGroup, setTeamGroup] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isClubValidated, setIsClubValidated] = useState(false);
  const [isValidatingClubId, setIsValidatingClubId] = useState(true);
  const router = useRouter();
  const returnUrl = `/admin/members?clubId=${encodeURIComponent(clubId)}`;

  useEffect(() => {
    let isActive = true;

    const validateClubId = async () => {
      if (!clubId) {
        router.replace("/404");
        return;
      }

      setIsValidatingClubId(true);
      try {
        const response = await fetch("/api/admin/clubs", { cache: "no-store" });
        if (!response.ok) {
          router.replace("/404");
          return;
        }

        const clubsPayload: unknown = await response.json();
        const hasClub = Array.isArray(clubsPayload) && clubsPayload.some((club) => {
          const item =
            typeof club === "object" && club !== null
              ? (club as { id?: unknown })
              : {};
          return String(item.id ?? "") === clubId;
        });

        if (!hasClub) {
          router.replace("/404");
          return;
        }

        if (!isActive) {
          return;
        }

        setIsClubValidated(true);
      } catch (validationError) {
        console.error("Failed to validate club id:", validationError);
        router.replace("/404");
      } finally {
        if (isActive) {
          setIsValidatingClubId(false);
        }
      }
    };

    void validateClubId();

    return () => {
      isActive = false;
    };
  }, [clubId, router]);

  const handleCreateMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!isClubValidated) {
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      let resolvedAvatarUrl = avatarUrl.trim();
      let resolvedImagePublicId = "";
      let resolvedImagePath = "";
      if (avatarFile) {
        const uploaded = await uploadImage(
          avatarFile,
          "player",
          fullName.trim() || avatarFile.name,
        );
        resolvedAvatarUrl = uploaded.secure_url;
        resolvedImagePublicId = uploaded.public_id;
        resolvedImagePath = extractUploadPathFromCloudinaryUrl(uploaded.secure_url);
      }

      const payload: Record<string, string> = {
        fullName: fullName.trim(),
        status,
        clubId,
      };

      if (jerseyNumber.trim()) payload.jerseyNumber = jerseyNumber.trim();
      if (birthDate.trim()) payload.birthDate = birthDate.trim();
      if (teamGroup.trim()) payload.teamGroup = teamGroup.trim();
      if (resolvedAvatarUrl) payload.avatarUrl = resolvedAvatarUrl;
      if (resolvedImagePath) payload.imageUrl = resolvedImagePath;
      if (resolvedImagePublicId) payload.imagePublicId = resolvedImagePublicId;

      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push(returnUrl);
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

  if (isValidatingClubId || !isClubValidated) {
    return (
      <div className="add-member-page">
        <div className="add-member-dot-grid" />
        <div className="add-member-inner" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
          <p className="add-member-hint">Зареждане...</p>
        </div>
      </div>
    );
  }

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
        <Link href={returnUrl} className="add-member-back-btn">
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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={teamGroup}
                onChange={(e) => setTeamGroup(e.target.value.replace(/\D/g, ""))}
                className="add-member-input"
                placeholder="По желание"
              />
            </div>

            <div className="add-member-field">
              <label className="add-member-label">Снимка на играч</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                className="add-member-input"
              />
            </div>

            {error && (
              <div className="add-member-error">{error}</div>
            )}

            <div className="add-member-actions">
              <button
                type="button"
                onClick={() => router.push(returnUrl)}
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

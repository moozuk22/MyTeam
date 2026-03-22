"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import "./page.css";

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </svg>
);

const TriangleAlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const MONTHS = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];

interface ClubRow {
  id: string;
  name: string;
  emblemUrl?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
}

export default function AdminPlayersPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [clubsSearch, setClubsSearch] = useState("");
  const [clubsLoading, setClubsLoading] = useState(true);
  const [demoSendingType, setDemoSendingType] = useState<"reminder" | "overdue" | null>(null);

  useEffect(() => {
    const fetchClubs = async () => {
      setClubsLoading(true);
      try {
        const response = await fetch("/api/admin/clubs", { cache: "no-store" });
        if (!response.ok) {
          setClubs([]);
          return;
        }

        const data = (await response.json()) as ClubRow[];
        setClubs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching clubs:", error);
        setClubs([]);
      } finally {
        setClubsLoading(false);
      }
    };

    void fetchClubs();
  }, []);

  const sendDemoNotification = async (type: "reminder" | "overdue") => {
    if (demoSendingType) return;

    setDemoSendingType(type);
    try {
      const trainerMessage =
        type === "reminder"
          ? "Напомняне: Здравейте! Напомняме Ви, че предстои плащането на месечния Ви членски внос. "
          : "Просрочие: Здравейте! Вие просрочихте плащането и вече дължите два месечни членски вноса!";

      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "trainer_message",
          broadcast: true,
          trainerMessage,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const errorMessage =
          typeof payload.error === "string"
            ? payload.error
            : "Неуспешно изпращане на известия.";
        throw new Error(errorMessage);
      }

      const payload = (await response.json()) as {
        summary?: { sent?: number; total?: number };
      };
      const sent = payload.summary?.sent ?? 0;
      const total = payload.summary?.total ?? 0;
      window.alert(`Известия изпратени: ${sent}/${total}`);
    } catch (error) {
      console.error("Demo notification send error:", error);
      window.alert(
        error instanceof Error ? error.message : "Възникна грешка при изпращане."
      );
    } finally {
      setDemoSendingType(null);
    }
  };

  const normalizedSearch = clubsSearch.trim().toLocaleLowerCase();
  const visibleClubs = [...clubs]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .filter((club) =>
      normalizedSearch.length === 0
        ? true
        : club.name.toLocaleLowerCase().includes(normalizedSearch),
    );

  return (
    <main className="mp-page">
      <div className="mp-dot-grid" aria-hidden="true" />

      <div className="mp-inner">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
          <AdminLogoutButton />
        </div>
        <div className="mp-header">
          <h1 className="mp-title">Списък играчи</h1>
          <p className="mp-subtitle">Търсене, филтриране и ръчно отбелязване на плащания</p>
          <div className="mp-title-line" />
        </div>

        <div className="mp-demo-box">
          <p className="mp-demo-label">DEMO ACTIONS</p>
          <div className="mp-demo-actions">
            <button
              className="mp-demo-btn mp-demo-btn--yellow"
              onClick={() => void sendDemoNotification("reminder")}
              disabled={demoSendingType !== null}
            >
              <BellIcon />
              Симулирай Напомняне (25-то число)
            </button>
            <button
              className="mp-demo-btn mp-demo-btn--red"
              onClick={() => void sendDemoNotification("overdue")}
              disabled={demoSendingType !== null}
            >
              <TriangleAlertIcon />
              Симулирай Просрочие (1-во число)
            </button>
          </div>
        </div>

        <div className="mp-add-team-section">
          <button 
            className="mp-add-team-btn"
            onClick={() => router.push("/admin/teams/add")}
          >
            <span className="mp-add-team-icon">+</span>
            Добави отбор
          </button>
        </div>

        <div className="mp-teams-section">
          <div className="mp-search-wrap">
            <SearchIcon />
            <input
              className="mp-search-input"
              type="text"
              value={clubsSearch}
              onChange={(e) => setClubsSearch(e.target.value)}
              placeholder="Търси отбор..."
              aria-label="Търси отбор"
            />
            {clubsSearch && (
              <button
                type="button"
                className="mp-search-clear"
                onClick={() => setClubsSearch("")}
                aria-label="Изчисти търсенето"
              >
                <XIcon />
              </button>
            )}
          </div>
          <h2 className="mp-teams-title">Изберете отбор</h2>
          <div className="mp-teams-grid">
            {clubsLoading && (
              <div className="mp-team-empty">Зареждане на отборите...</div>
            )}

            {!clubsLoading && visibleClubs.map((club) => (
              <button
                key={club.id}
                type="button"
                className="mp-team-card"
                onClick={() => router.push(`/admin/members?clubId=${club.id}`)}
              >
                <div className="mp-team-card-content">
                  <div className="mp-team-logo-wrap">
                    {club.imageUrl || club.emblemUrl ? (
                      <img src={club.imageUrl || club.emblemUrl || ""} alt={club.name} className="mp-team-logo mp-team-logo--img" />
                    ) : (
                      <span className="mp-team-logo">🏆</span>
                    )}
                  </div>
                  <div className="mp-team-info">
                    <h3 className="mp-team-name">{club.name}</h3>
                  </div>
                  <ChevronRightIcon />
                </div>
              </button>
            ))}
            {!clubsLoading && clubs.length > 0 && visibleClubs.length === 0 && (
              <div className="mp-team-empty">Няма резултати за това търсене.</div>
            )}

            {!clubsLoading && clubs.length === 0 && (
              <div className="mp-team-empty">Няма добавени отбори.</div>
            )}
          </div>
        </div>
      </div>

    </main>
  );
}

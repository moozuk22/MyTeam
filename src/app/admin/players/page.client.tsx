"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import { DemoNotificationPanel } from "./_components/DemoNotificationPanel";
import { CoachNotificationPanel } from "./_components/CoachNotificationPanel";
import {
  BellIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "./_components/PlayersIcons";
import type { ClubRow } from "./_types/club";
import PlayerNotificationForm from "./PlayerNotificationForm";
import "./page.css";

export default function AdminPlayersPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [clubsSearch, setClubsSearch] = useState("");
  const [clubsLoading, setClubsLoading] = useState(true);
  const [togglingNotifyClubId, setTogglingNotifyClubId] = useState<
    string | null
  >(null);

  const toggleNotify = async (
    e: React.MouseEvent,
    clubId: string,
    current: boolean,
  ) => {
    e.stopPropagation();
    setTogglingNotifyClubId(clubId);
    try {
      await fetch(`/api/admin/clubs/${clubId}/notify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyOnCoachVisit: !current }),
      });
      setClubs((prev) =>
        prev.map((c) =>
          c.id === clubId ? { ...c, notifyOnCoachVisit: !current } : c,
        ),
      );
    } finally {
      setTogglingNotifyClubId(null);
    }
  };

  const fetchClubs = async () => {
    setClubsLoading(true);
    try {
      const response = await fetch("/api/admin/clubs", { cache: "no-store" });
      if (!response.ok) {
        setClubs([]);
        return;
      }

      const data = (await response.json()) as ClubRow[];
      const nextClubs = Array.isArray(data) ? data : [];
      console.log("clubs response:", nextClubs);
      setClubs(nextClubs);
    } catch (error) {
      console.error("Error fetching clubs:", error);
      setClubs([]);
    } finally {
      setClubsLoading(false);
    }
  };

  useEffect(() => {
    void fetchClubs();
  }, []);

  const normalizedSearch = clubsSearch.trim().toLocaleLowerCase();
  const visibleClubs = [...clubs]
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    .filter((club) =>
      normalizedSearch.length === 0
        ? true
        : club.name.toLocaleLowerCase().includes(normalizedSearch),
    );
  return (
    <main className="mp-page">
      <div className="mp-dot-grid" aria-hidden="true" />

      <div className="mp-inner">
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "10px",
          }}
        >
          <AdminLogoutButton />
        </div>
        <div className="mp-header">
          <h1 className="mp-title">Списък състезатели</h1>
          <p className="mp-subtitle">
            Търсене, филтриране и ръчно отбелязване на плащания
          </p>
          <div className="mp-title-line" />
        </div>

        <button
          className="mp-reports-btn"
          style={{ width: "100%", justifyContent: "center" }}
          type="button"
          onClick={() => router.push("/admin/subscriptions")}
        >
          Абонаменти
        </button>

        <button
          className="mp-reports-btn"
          style={{ width: "100%", justifyContent: "center" }}
          type="button"
          onClick={() => router.push("/admin/discounts")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Управление на отстъпки
        </button>

        <button
          className="mp-reports-btn"
          style={{
            width: "100%",
            justifyContent: "center",
            marginTop: "-16px",
          }}
          type="button"
          onClick={() => router.push("/admin/discount-stats")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Статистика на отстъпки
        </button>

        <button
          className="mp-reports-btn"
          style={{
            width: "100%",
            justifyContent: "center",
            marginTop: "-16px",
          }}
          type="button"
          onClick={() => router.push("/admin/page-clicks")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="m13 13 6 6" />
          </svg>
          Кликове на началната страница
        </button>

        <button
          className="mp-reports-btn"
          style={{
            width: "100%",
            justifyContent: "center",
            marginTop: "-16px",
          }}
          type="button"
          onClick={() => router.push("/admin/email")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          Изпрати имейл
        </button>

        <DemoNotificationPanel clubs={clubs} clubsLoading={clubsLoading} />

        <CoachNotificationPanel clubs={clubs} clubsLoading={clubsLoading} />

        <PlayerNotificationForm clubs={clubs} loading={clubsLoading} />

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
          <h2 className="mp-teams-title" style={{ textAlign: "center" }}>
            Изберете отбор:
          </h2>
          <div className="mp-teams-grid">
            {clubsLoading && (
              <div className="mp-team-empty">Зареждане на отборите...</div>
            )}

            {!clubsLoading &&
              visibleClubs.map((club) => (
                <div
                  key={club.id}
                  className={`mp-team-card${club.billingStatus === "active" ? " mp-team-card--active" : " mp-team-card--demo"}`}
                >
                  <button
                    type="button"
                    className="mp-team-card-content"
                    onClick={() =>
                      router.push(`/admin/members?clubId=${club.id}`)
                    }
                  >
                    <div className="mp-team-logo-wrap">
                      {club.imageUrl || club.emblemUrl ? (
                        <img
                          src={club.imageUrl || club.emblemUrl || ""}
                          alt={club.name}
                          className="mp-team-logo mp-team-logo--img"
                        />
                      ) : (
                        <span className="mp-team-logo">🏆</span>
                      )}
                    </div>
                    <div className="mp-team-info">
                      <h3 className="mp-team-name">{club.name}</h3>
                      {club.createdAt && (
                        <p className="mp-team-created">
                          {new Date(club.createdAt).toLocaleDateString(
                            "bg-BG",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            },
                          )}
                        </p>
                      )}
                    </div>
                    <ChevronRightIcon />
                  </button>
                  <button
                    type="button"
                    className={`mp-notify-btn${club.notifyOnCoachVisit ? " is-active" : ""}`}
                    onClick={(e) =>
                      void toggleNotify(
                        e,
                        club.id,
                        club.notifyOnCoachVisit ?? false,
                      )
                    }
                    disabled={togglingNotifyClubId === club.id}
                    title={
                      club.notifyOnCoachVisit
                        ? "Уведомленията са включени"
                        : "Уведомленията са изключени"
                    }
                  >
                    <BellIcon filled={club.notifyOnCoachVisit} />
                  </button>
                </div>
              ))}
            {!clubsLoading && clubs.length > 0 && visibleClubs.length === 0 && (
              <div className="mp-team-empty">
                Няма резултати за това търсене.
              </div>
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

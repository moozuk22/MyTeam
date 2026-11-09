"use client";
import { useEffect, useRef, useState } from "react";
import type { ClubRow } from "../_types/club";
import {
  BellIcon,
  ChevronDownIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "./PlayersIcons";

export function DemoNotificationPanel({
  clubs,
  clubsLoading,
}: {
  clubs: ClubRow[];
  clubsLoading: boolean;
}) {
  const [demoSendingType, setDemoSendingType] = useState<
    "reminder" | "overdue" | null
  >(null);
  const [demoClubIds, setDemoClubIds] = useState<string[]>([]);
  const [demoClubSearch, setDemoClubSearch] = useState("");
  const [demoClubPickerOpen, setDemoClubPickerOpen] = useState(false);
  const demoPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!demoClubPickerOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (
        demoPickerRef.current &&
        !demoPickerRef.current.contains(event.target as Node)
      ) {
        setDemoClubPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [demoClubPickerOpen]);

  useEffect(() => {
    setDemoClubIds((prev) =>
      prev.filter((id) => clubs.some((club) => club.id === id)),
    );
  }, [clubs]);
  const toggleDemoClub = (clubId: string) => {
    setDemoClubIds((prev) =>
      prev.includes(clubId)
        ? prev.filter((id) => id !== clubId)
        : [...prev, clubId],
    );
  };

  const sendDemoNotification = async (type: "reminder" | "overdue") => {
    if (demoSendingType || demoClubIds.length === 0) return;

    setDemoSendingType(type);
    try {
      const selectedDemoClubs = clubs.filter((club) =>
        demoClubIds.includes(club.id),
      );
      if (selectedDemoClubs.length === 0) {
        throw new Error("Invalid club selection.");
      }

      const membersPayloads = await Promise.all(
        selectedDemoClubs.map(async (club) => {
          const membersResponse = await fetch(
            `/api/admin/members?clubId=${encodeURIComponent(club.id)}`,
            {
              cache: "no-store",
            },
          );
          if (!membersResponse.ok) {
            throw new Error(`Failed loading members for "${club.name}".`);
          }
          return membersResponse.json();
        }),
      );
      const memberIds = Array.from(
        new Set(
          membersPayloads.flatMap((membersPayload: unknown) =>
            Array.isArray(membersPayload)
              ? membersPayload
                  .map((item) => {
                    const raw =
                      typeof item === "object" && item !== null
                        ? (item as Record<string, unknown>)
                        : {};
                    return typeof raw.id === "string" ? raw.id.trim() : "";
                  })
                  .filter((id): id is string => Boolean(id))
              : [],
          ),
        ),
      );
      if (memberIds.length === 0) {
        throw new Error("No members found in selected clubs.");
      }

      const trainerMessage =
        type === "reminder"
          ? "Напомняне: Здравейте! Напомняме Ви, че предстои плащането на месечния Ви членски внос. "
          : "Просрочие: Здравейте! Вие просрочихте плащането и вече дължите два месечни членски вноса!";

      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "trainer_message",
          memberIds,
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
        error instanceof Error
          ? error.message
          : "Възникна грешка при изпращане.",
      );
    } finally {
      setDemoSendingType(null);
    }
  };

  const demoClubSearchNormalized = demoClubSearch.trim().toLocaleLowerCase();
  const demoPickerClubs = [...clubs]
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    .filter((club) =>
      demoClubSearchNormalized.length === 0
        ? true
        : club.name.toLocaleLowerCase().includes(demoClubSearchNormalized),
    );
  const selectedDemoClubNames = clubs
    .filter((club) => demoClubIds.includes(club.id))
    .map((club) => club.name);
  const demoPickerLabel =
    selectedDemoClubNames.length === 0
      ? "Select clubs for simulation"
      : selectedDemoClubNames.length <= 2
        ? selectedDemoClubNames.join(", ")
        : `${selectedDemoClubNames[0]}, ${selectedDemoClubNames[1]} +${selectedDemoClubNames.length - 2}`;

  return (
    <div className="mp-demo-box">
      <p className="mp-demo-label">DEMO ACTIONS</p>
      <div className="mp-demo-picker" ref={demoPickerRef}>
        <button
          type="button"
          className="mp-demo-picker-trigger"
          onClick={() => setDemoClubPickerOpen((prev) => !prev)}
          aria-expanded={demoClubPickerOpen}
          disabled={clubsLoading || demoSendingType !== null}
        >
          <span className="mp-demo-picker-trigger-label">
            {demoPickerLabel}
          </span>
          <ChevronDownIcon />
        </button>
        {demoClubPickerOpen && (
          <div className="mp-demo-picker-panel">
            <div className="mp-demo-picker-search">
              <SearchIcon />
              <input
                type="text"
                value={demoClubSearch}
                onChange={(e) => setDemoClubSearch(e.target.value)}
                className="mp-search-input"
                placeholder="Search clubs..."
                aria-label="Search clubs for simulation"
              />
            </div>
            <div className="mp-demo-picker-list">
              {demoPickerClubs.length === 0 ? (
                <p className="mp-demo-picker-empty">No clubs found.</p>
              ) : (
                demoPickerClubs.map((club) => {
                  const isSelected = demoClubIds.includes(club.id);
                  return (
                    <label
                      key={`demo-picker-${club.id}`}
                      className={`mp-demo-picker-option${isSelected ? " is-selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDemoClub(club.id)}
                      />
                      <span>{club.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      <div className="mp-demo-actions">
        <button
          className="mp-demo-btn mp-demo-btn--yellow"
          onClick={() => void sendDemoNotification("reminder")}
          disabled={demoSendingType !== null || demoClubIds.length === 0}
        >
          <BellIcon />
          Симулирай Напомняне (25-то число)
        </button>
        <button
          className="mp-demo-btn mp-demo-btn--red"
          onClick={() => void sendDemoNotification("overdue")}
          disabled={demoSendingType !== null || demoClubIds.length === 0}
        >
          <TriangleAlertIcon />
          Симулирай Просрочие (1-во число)
        </button>
      </div>
    </div>
  );
}

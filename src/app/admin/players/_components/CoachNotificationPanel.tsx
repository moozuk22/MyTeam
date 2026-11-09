"use client";
import { useEffect, useRef, useState } from "react";
import type { ClubRow } from "../_types/club";
import { BellIcon, ChevronDownIcon, SearchIcon } from "./PlayersIcons";
import { NotificationImageAttachment } from "@/components/NotificationImageAttachment";
export function CoachNotificationPanel({
  clubs,
  clubsLoading,
}: {
  clubs: ClubRow[];
  clubsLoading: boolean;
}) {
  const [coachMessage, setCoachMessage] = useState("");
  const [coachImage, setCoachImage] = useState<File | null>(null);
  const [coachClubIds, setCoachClubIds] = useState<string[]>([]);
  const [coachClubPickerOpen, setCoachClubPickerOpen] = useState(false);
  const [coachClubSearch, setCoachClubSearch] = useState("");
  const [coachMessageScope, setCoachMessageScope] = useState<"main" | "all">(
    "main",
  );
  const [isSendingCoach, setIsSendingCoach] = useState(false);
  const coachPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!coachClubPickerOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (
        coachPickerRef.current &&
        !coachPickerRef.current.contains(event.target as Node)
      ) {
        setCoachClubPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [coachClubPickerOpen]);

  const sendCoachMessage = async () => {
    if (isSendingCoach || coachClubIds.length === 0 || !coachMessage.trim())
      return;
    setIsSendingCoach(true);
    try {
      const payload = {
        clubIds: coachClubIds,
        message: coachMessage.trim(),
        includeCoachGroupPages: coachMessageScope === "all",
      };
      const form = new FormData();
      form.append("payload", JSON.stringify(payload));
      if (coachImage) form.append("image", coachImage);
      const response = await fetch("/api/admin/notifications/send-to-coaches", {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => ({}))) as {
        sent?: number;
        total?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Неуспешно изпращане.",
        );
      }
      window.alert(
        `Съобщението е изпратено: ${data.sent ?? 0}/${data.total ?? 0}`,
      );
      setCoachMessage("");
      setCoachImage(null);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Възникна грешка при изпращане.",
      );
    } finally {
      setIsSendingCoach(false);
    }
  };

  const toggleCoachClub = (clubId: string) => {
    setCoachClubIds((prev) =>
      prev.includes(clubId)
        ? prev.filter((id) => id !== clubId)
        : [...prev, clubId],
    );
  };

  const coachClubSearchNormalized = coachClubSearch.trim().toLocaleLowerCase();
  const coachPickerClubs = [...clubs]
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    .filter((club) =>
      coachClubSearchNormalized.length === 0
        ? true
        : club.name.toLocaleLowerCase().includes(coachClubSearchNormalized),
    );
  const allCoachClubsSelected =
    clubs.length > 0 && coachClubIds.length === clubs.length;
  const selectedCoachClubNames = clubs
    .filter((c) => coachClubIds.includes(c.id))
    .map((c) => c.name);
  const coachPickerLabel =
    selectedCoachClubNames.length === 0
      ? "Изберете отбор"
      : selectedCoachClubNames.length <= 2
        ? selectedCoachClubNames.join(", ")
        : `${selectedCoachClubNames[0]}, ${selectedCoachClubNames[1]} +${selectedCoachClubNames.length - 2}`;

  return (
    <div className="mp-demo-box mp-notification-box mp-notification-box--coaches">
      <p className="mp-demo-label">СЪОБЩЕНИЕ ДО ТРЕНЬОРИТЕ</p>
      <div className="mp-demo-picker" ref={coachPickerRef}>
        <button
          type="button"
          className="mp-demo-picker-trigger"
          onClick={() => setCoachClubPickerOpen((prev) => !prev)}
          aria-expanded={coachClubPickerOpen}
          disabled={clubsLoading || isSendingCoach}
        >
          <span className="mp-demo-picker-trigger-label">
            {coachPickerLabel}
          </span>
          <ChevronDownIcon />
        </button>
        {coachClubPickerOpen && (
          <div className="mp-demo-picker-panel">
            <div className="mp-demo-picker-search">
              <SearchIcon />
              <input
                type="text"
                value={coachClubSearch}
                onChange={(e) => setCoachClubSearch(e.target.value)}
                className="mp-search-input"
                placeholder="Търси отбор..."
                aria-label="Търси отбор"
              />
            </div>
            <div className="mp-demo-picker-list">
              {coachPickerClubs.length === 0 ? (
                <p className="mp-demo-picker-empty">Няма намерени отбори.</p>
              ) : (
                <>
                  <label
                    className={`mp-demo-picker-option${allCoachClubsSelected ? " is-selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={allCoachClubsSelected}
                      onChange={() =>
                        setCoachClubIds(
                          allCoachClubsSelected ? [] : clubs.map((c) => c.id),
                        )
                      }
                    />
                    <span>Избери всички</span>
                  </label>
                  {coachPickerClubs.map((club) => (
                    <label
                      key={`coach-picker-${club.id}`}
                      className={`mp-demo-picker-option${coachClubIds.includes(club.id) ? " is-selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={coachClubIds.includes(club.id)}
                        onChange={() => toggleCoachClub(club.id)}
                      />
                      <span>{club.name}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <textarea
        value={coachMessage}
        onChange={(e) => setCoachMessage(e.target.value)}
        placeholder="Въведете съобщение до треньорите..."
        disabled={isSendingCoach}
        rows={3}
        style={{
          width: "100%",
          marginTop: "10px",
          padding: "10px 12px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--accent-gold-color)",
          borderRadius: "8px",
          color: "var(--text-primary)",
          fontSize: "14px",
          fontFamily: "inherit",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      <NotificationImageAttachment
        file={coachImage}
        onChange={setCoachImage}
        disabled={isSendingCoach}
      />
      <div
        className="mp-coach-scope"
        role="radiogroup"
        aria-label="Обхват на съобщението"
      >
        <label
          className={`mp-coach-scope-option${coachMessageScope === "main" ? " is-selected" : ""}`}
        >
          <input
            type="radio"
            name="coachMessageScope"
            checked={coachMessageScope === "main"}
            onChange={() => setCoachMessageScope("main")}
            disabled={isSendingCoach}
          />
          <span>Само главната страница</span>
        </label>
        <label
          className={`mp-coach-scope-option${coachMessageScope === "all" ? " is-selected" : ""}`}
        >
          <input
            type="radio"
            name="coachMessageScope"
            checked={coachMessageScope === "all"}
            onChange={() => setCoachMessageScope("all")}
            disabled={isSendingCoach}
          />
          <span>Главната и треньорските групи</span>
        </label>
      </div>
      <div className="mp-demo-actions">
        <button
          className="mp-demo-btn mp-demo-btn--yellow"
          onClick={() => void sendCoachMessage()}
          disabled={
            isSendingCoach || coachClubIds.length === 0 || !coachMessage.trim()
          }
        >
          <BellIcon />
          {isSendingCoach ? "Изпращане..." : "Изпрати до треньорите"}
        </button>
      </div>
    </div>
  );
}

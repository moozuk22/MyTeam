"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { NotificationImage } from "@/components/NotificationImage";
import styles from "./SentMessageHistoryModal.module.css";

export type SentMessageHistoryView = "admin" | "coach";

type NamedRef = { id: string; name: string | null };

export type SentMessageItem = {
  id: string;
  audience: "players" | "coaches";
  body: string;
  imageUrl: string | null;
  sentAt: string;
  recipientCount: number;
  clubs: NamedRef[];
  coachGroups: NamedRef[];
  recipients: { id: string | null; name: string }[];
};

type FilterOptions = {
  clubs: { id: string; name: string }[];
  coachGroups: { id: string; name: string; clubName: string }[];
  players: { id: string; name: string }[];
};

const SEARCH_DELAY_MS = 300;

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  timeZone: "Europe/Sofia",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Show the send time as dd.mm.yyyy HH:mm in the business time zone. */
export function formatSentAt(value: string) {
  const parts = Object.fromEntries(dateFormat.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

function names(items: NamedRef[], missing: string) {
  return items.map((item) => item.name ?? missing).join(", ");
}

/** Recipient summary such as "Иван, Мария +12". */
export function recipientSummary(message: Pick<SentMessageItem, "recipients" | "recipientCount">) {
  const shown = message.recipients.map((recipient) => recipient.name);
  const rest = message.recipientCount - shown.length;
  return `${shown.join(", ")}${rest > 0 ? ` +${rest}` : ""}`;
}

export function SentMessageCard({ message, view }: { message: SentMessageItem; view: SentMessageHistoryView }) {
  const toCoaches = message.audience === "coaches";
  const scope = view === "admin" || message.coachGroups.length === 0
    ? { label: message.clubs.length === 1 ? "Клуб" : "Клубове", value: names(message.clubs, "Изтрит клуб") }
    : { label: message.coachGroups.length === 1 ? "Група" : "Групи", value: names(message.coachGroups, "Изтрита група") };
  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <time className={styles.date} dateTime={message.sentAt}>{formatSentAt(message.sentAt)}</time>
        <span className={`${styles.badge}${toCoaches ? ` ${styles.badgeCoaches}` : ""}`}>
          {toCoaches ? "До треньори" : "До състезатели"}
        </span>
      </div>
      <p className={styles.body}>{message.body}</p>
      <NotificationImage src={message.imageUrl} />
      {scope.value && (
        <p className={styles.meta}><span className={styles.metaLabel}>{scope.label}: </span>{scope.value}</p>
      )}
      {toCoaches ? (
        view === "admin" && message.coachGroups.length > 0 ? (
          <p className={styles.meta}><span className={styles.metaLabel}>Треньорски групи: </span>{names(message.coachGroups, "Изтрита група")}</p>
        ) : null
      ) : (
        <p className={styles.meta}>
          <span className={styles.metaLabel}>Получатели ({message.recipientCount}): </span>{recipientSummary(message)}
        </p>
      )}
    </li>
  );
}

function HistorySkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Зареждане" aria-busy="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className={styles.skeletonCard} aria-hidden="true">
          <div className={styles.skeletonRow}><span className={styles.line} /><span className={`${styles.line} ${styles.short}`} /></div>
          <span className={`${styles.line} ${styles.full}`} />
          <span className={`${styles.line} ${styles.full}`} />
          <span className={styles.line} />
        </div>
      ))}
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className={styles.filters} role="status" aria-label="Зареждане" aria-busy="true">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} aria-hidden="true" style={{ display: "grid", gap: 8 }}>
          <span className={styles.line} />
          <span className={`${styles.line} ${styles.field}`} />
        </div>
      ))}
    </div>
  );
}

export default function SentMessageHistoryModal({ view, onClose }: { view: SentMessageHistoryView; onClose: () => void }) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const scopeParam = view === "admin" ? "clubId" : "coachGroupId";

  const [scopeId, setScopeId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [selectedPlayerName, setSelectedPlayerName] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [optionsRevision, setOptionsRevision] = useState(0);

  const [messages, setMessages] = useState<SentMessageItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [revision, setRevision] = useState(0);
  const listRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButton.current?.focus();
    return () => {
      listRequest.current?.abort();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(playerSearch.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [playerSearch]);

  useEffect(() => {
    const controller = new AbortController();
    setOptionsError("");
    const query = new URLSearchParams();
    if (scopeId) query.set(scopeParam, scopeId);
    if (debouncedSearch) query.set("q", debouncedSearch);
    void (async () => {
      try {
        const response = await fetch(`/api/admin/sent-messages/filters${query.size ? `?${query}` : ""}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Неуспешно зареждане на филтрите.");
        if (!controller.signal.aborted) setOptions(data as FilterOptions);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setOptionsError(cause instanceof Error ? cause.message : "Неуспешно зареждане на филтрите.");
      }
    })();
    return () => controller.abort();
  }, [scopeId, scopeParam, debouncedSearch, optionsRevision]);

  useEffect(() => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setLoading(true);
    setLoadingMore(false);
    setError("");
    setMoreError("");
    const query = new URLSearchParams();
    if (scopeId) query.set(scopeParam, scopeId);
    if (playerId) query.set("playerId", playerId);
    void (async () => {
      try {
        const response = await fetch(`/api/admin/sent-messages${query.size ? `?${query}` : ""}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Неуспешно зареждане на историята.");
        if (controller.signal.aborted) return;
        setMessages(data.messages ?? []);
        setNextCursor(data.nextCursor ?? null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setMessages([]);
        setNextCursor(null);
        setError(cause instanceof Error ? cause.message : "Неуспешно зареждане на историята.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [scopeId, scopeParam, playerId, revision]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const controller = listRequest.current;
    if (!controller) return;
    setLoadingMore(true);
    setMoreError("");
    const query = new URLSearchParams({ cursor: nextCursor });
    if (scopeId) query.set(scopeParam, scopeId);
    if (playerId) query.set("playerId", playerId);
    try {
      const response = await fetch(`/api/admin/sent-messages?${query}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Неуспешно зареждане на още съобщения.");
      if (controller.signal.aborted) return;
      setMessages((current) => {
        const seen = new Set(current.map((message) => message.id));
        return [...current, ...(data.messages ?? []).filter((message: SentMessageItem) => !seen.has(message.id))];
      });
      setNextCursor(data.nextCursor ?? null);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setMoreError(cause instanceof Error ? cause.message : "Неуспешно зареждане на още съобщения.");
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  const scopeOptions = view === "admin"
    ? (options?.clubs ?? []).map((club) => ({ value: club.id, label: club.name }))
    : (options?.coachGroups ?? []).map((group) => ({ value: group.id, label: `${group.name} · ${group.clubName}` }));
  const playerOptions = options?.players ?? [];
  const showSelectedPlayer = playerId && !playerOptions.some((player) => player.id === playerId);
  const filtered = Boolean(scopeId || playerId);

  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={onClose}>
      <div
        className={`amp-modal amp-modal--confirm amp-modal--notify ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
      >
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span id={titleId} className="amp-modal-title-gradient">История на съобщенията</span>
          <button ref={closeButton} className="amp-modal-close" type="button" aria-label="Затвори" onClick={onClose}><X size={18} /></button>
        </h2>
        <div className="amp-modal-body">
          <p className={styles.intro}>Тук виждате само съобщенията, които сте изпратили вие.</p>
          {optionsError ? (
            <div style={{ marginBottom: 16 }}>
              <p className="amp-confirm-error" role="alert">{optionsError}</p>
              <button type="button" className="amp-btn amp-btn--ghost amp-btn--compact" onClick={() => setOptionsRevision((value) => value + 1)}>Опитай отново</button>
            </div>
          ) : !options ? (
            <FiltersSkeleton />
          ) : (
            <div className={styles.filters}>
              <label className="amp-edit-field">
                <span className="amp-lbl">{view === "admin" ? "Клуб" : "Група"}</span>
                <select
                  className="amp-edit-input"
                  value={scopeId}
                  onChange={(event) => { setScopeId(event.target.value); setPlayerId(""); setSelectedPlayerName(""); }}
                >
                  <option value="">{view === "admin" ? "Всички клубове" : "Всички групи"}</option>
                  {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <div className={styles.playerFilter}>
                <label className="amp-edit-field">
                  <span className="amp-lbl">Състезател</span>
                  <select
                    className="amp-edit-input"
                    value={playerId}
                    onChange={(event) => {
                      setPlayerId(event.target.value);
                      setSelectedPlayerName(playerOptions.find((player) => player.id === event.target.value)?.name ?? "");
                    }}
                  >
                    <option value="">Всички състезатели</option>
                    {showSelectedPlayer && <option value={playerId}>{selectedPlayerName}</option>}
                    {playerOptions.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                  </select>
                </label>
                <input
                  className="amp-edit-input"
                  type="search"
                  maxLength={100}
                  placeholder="Търси състезател..."
                  aria-label="Търси състезател"
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                />
              </div>
            </div>
          )}

          {loading ? (
            <HistorySkeleton />
          ) : error ? (
            <div>
              <p className="amp-confirm-error" role="alert">{error}</p>
              <button type="button" className="amp-btn amp-btn--ghost amp-btn--compact" onClick={() => setRevision((value) => value + 1)}>Опитай отново</button>
            </div>
          ) : messages.length === 0 ? (
            <p className="amp-empty amp-empty--modal">
              {filtered ? "Няма съобщения за избраните филтри." : "Все още нямате изпратени съобщения."}
            </p>
          ) : (
            <>
              <ul className={styles.list} aria-label="Изпратени съобщения">
                {messages.map((message) => <SentMessageCard key={message.id} message={message} view={view} />)}
              </ul>
              {loadingMore && <div style={{ marginTop: 10 }}><HistorySkeleton /></div>}
              {moreError && <p className={`amp-confirm-error ${styles.status}`} role="alert">{moreError}</p>}
              {nextCursor && !loadingMore && (
                <div className={styles.more}>
                  <button type="button" className="amp-btn amp-btn--ghost" onClick={() => void loadMore()}>
                    {moreError ? "Опитай отново" : "Покажи още"}
                  </button>
                </div>
              )}
            </>
          )}

          <div className="amp-modal-actions" style={{ marginTop: 16 }}>
            <button type="button" className="amp-btn amp-btn--ghost" onClick={onClose}>Затвори</button>
          </div>
        </div>
      </div>
    </div>
  );
}

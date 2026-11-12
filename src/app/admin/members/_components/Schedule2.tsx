import { useState } from "react";
import type { TrainingWeekSessionItem } from "../_types/members-page-types";
import styles from "./Schedule2.module.css";

export type Schedule2Session = TrainingWeekSessionItem & { fieldName?: string };

export type Schedule2Group = {
  id: string;
  name: string;
  coachGroupId: string | null;
  coachName: string | null;
};
type Props = {
  dates: string[];
  sessions: Schedule2Session[];
  loading: boolean;
  openingEditor?: boolean;
  detailsActive?: boolean;
  error: string;
  today: string;
  week: number;
  lastWeek: number;
  canScheduleDate: (date: string) => boolean;
  onWeekChange: (week: number) => void;
  customGroups: Schedule2Group[];
  onOpen: (session: Schedule2Session) => void;
  onCreate: (groupId: string, date?: string) => void;
};

const dayFormat = new Intl.DateTimeFormat("bg-BG", { weekday: "short", timeZone: "UTC" });
const fullDayFormat = new Intl.DateTimeFormat("bg-BG", { weekday: "long", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function formatDay(date: string) {
  const day = new Date(date + "T00:00:00Z");
  return `${dayFormat.format(day)} ${dateFormat.format(day)}`;
}

function getField(session: Schedule2Session) {
  return session.fieldName ?? session.location?.trim() ?? "";
}

export default function Schedule2({ dates, sessions, loading, openingEditor = false, detailsActive = false, error, today, week, lastWeek, canScheduleDate, onWeekChange, customGroups, onOpen, onCreate }: Props) {
  const [view, setView] = useState<"team" | "field">("team");
  const [team, setTeam] = useState("");
  const [field, setField] = useState("");
  const [newGroup, setNewGroup] = useState("");

  function belongsToGroup(session: Schedule2Session, group: Schedule2Group) {
    if (session.customGroupId) return session.customGroupId === group.id;
    return session.eventType === "training" && Boolean(group.coachGroupId && group.coachGroupId === session.coachGroupId);
  }

  const activeTeam = customGroups.some(({ id }) => id === team) ? team : "";
  const visibleGroups = customGroups.filter(({ id }) => !activeTeam || id === activeTeam);
  const teamSessions = sessions.filter((session) =>
    (view === "field" && !activeTeam) || visibleGroups.some((group) => belongsToGroup(session, group)),
  );
  const hasUngroupedMatches = sessions.some((session) =>
    session.eventType === "match" && !customGroups.some((group) => belongsToGroup(session, group)),
  );
  const fields = [...new Set(teamSessions.map(getField).filter(Boolean))].sort((a, b) => a.localeCompare(b, "bg"));
  const activeField = fields.includes(field) ? field : "";
  const visibleSessions = teamSessions.filter((session) => !activeField || getField(session) === activeField)
    .sort((a, b) => (a.trainingTime || "99:99").localeCompare(b.trainingTime || "99:99"));
  const newGroupId = customGroups.find(({ id }) => id === newGroup)?.id ?? customGroups[0]?.id;

  function eventButton(session: Schedule2Session, fieldView = false) {
    const isMatch = session.eventType === "match";
    const time = session.trainingTime || "Без час";
    // Match labels from the weekly endpoint start with the event type.
    const separator = session.label.indexOf(" · ");
    const label = isMatch
      ? (separator === -1 ? session.label : session.label.slice(separator + 3))
      : (fieldView ? session.scopeLabel || session.label : "");
    const accessibleLabel = [time, isMatch ? session.label : "Тренировка", !isMatch && label, session.location]
      .filter(Boolean).join(", ");
    return (
      <button key={session.id} type="button" className={styles.event} data-match={isMatch} aria-label={accessibleLabel} disabled={openingEditor || detailsActive} onClick={() => onOpen(session)}>
        <strong>{time}</strong>
        {label && <span>{label}</span>}
        {session.location && <small>{session.location}</small>}
      </button>
    );
  }

  return (
    <section className={styles.planner} aria-label="Седмично планиране">
      <header className={styles.header}>
        <div>
          <h3>Седмично планиране</h3>
          <p>{dates.length > 0 && `${formatDay(dates[0])} – ${formatDay(dates[dates.length - 1])} · `}{visibleSessions.length} събития</p>
        </div>
        <div className={styles.actions}>
          {customGroups.length > 1 && (
            <label>
              Група за ново събитие
              <select value={newGroupId} onChange={(event) => setNewGroup(event.target.value)}>
                {customGroups.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          )}
          <button className={styles.create} type="button" disabled={loading || openingEditor || !newGroupId} onClick={() => { if (newGroupId) onCreate(newGroupId); }}>+ Ново събитие</button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.views} role="group" aria-label="Избор на седмица">
          <button type="button" aria-label="Предишна седмица" disabled={loading || week === 0} onClick={() => onWeekChange(week - 1)}>←</button>
          <button type="button" disabled={loading || week === 0} onClick={() => onWeekChange(0)}>Тази седмица</button>
          <button type="button" aria-label="Следваща седмица" disabled={loading || week === lastWeek} onClick={() => onWeekChange(week + 1)}>→</button>
        </div>
        <div className={styles.views} role="group" aria-label="Изглед на графика">
          <button type="button" aria-pressed={view === "team"} onClick={() => setView("team")}>По групи</button>
          <button type="button" aria-pressed={view === "field"} onClick={() => setView("field")}>Терени и часове</button>
        </div>
        <label>
          Група
          <select value={activeTeam} onChange={(event) => setTeam(event.target.value)}>
            <option value="">Всички групи</option>
            {customGroups.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>
          Терен
          <select value={activeField} onChange={(event) => setField(event.target.value)}>
            <option value="">Всички терени</option>
            {fields.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>

      {!loading && !error && view === "team" && hasUngroupedMatches && (
        <p className={styles.notice}>Мачовете без персонализирана група са в „Терени и часове“ при избрани „Всички групи“.</p>
      )}
      {error && <p role="alert" className="amp-confirm-error">{error}</p>}
      {openingEditor && <p role="status">Зареждане на редактора…</p>}
      {loading ? <p role="status">Зареждане…</p> : view === "team" && dates.length > 0 && visibleGroups.length > 0 ? (
        <div className={styles.grid} tabIndex={0} role="region" aria-label="Таблица на седмичния график">
          <table>
            <thead>
              <tr>
                <th scope="col">Група</th>
                {dates.map((date) => {
                  const day = new Date(date + "T00:00:00Z");
                  return (
                    <th key={date} scope="col" data-today={date === today}>
                      <span className={styles.weekday}>{fullDayFormat.format(day)}</span>
                      <time className={styles.dayDate} dateTime={date}>{dateFormat.format(day)}</time>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((group) => (
                <tr key={group.id}>
                  <th scope="row">
                    {group.name}
                    {group.coachName && <small className={styles.coachName}>{group.coachName}</small>}
                  </th>
                  {dates.map((date) => {
                    const entries = visibleSessions.filter((session) => session.date === date && belongsToGroup(session, group));
                    return (
                      <td key={date} data-today={date === today}>
                        {entries.length > 0 ? entries.map((session) => eventButton(session)) : !activeField && canScheduleDate(date) ? (
                          <button type="button" className={styles.emptyCell} aria-label={`Ново събитие за ${group.name}, ${formatDay(date)}`} disabled={openingEditor} onClick={() => onCreate(group.id, date)}>+</button>
                        ) : <span className={styles.dash}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : visibleSessions.length > 0 ? (
        <div className={styles.fieldDays}>
          {dates.map((date) => {
            const entries = visibleSessions.filter((session) => session.date === date);
            if (entries.length === 0) return null;
            const fieldNames = [...new Set(entries.map(getField))];
            return (
              <section key={date} className={styles.fieldDay}>
                <h4>{formatDay(date)}</h4>
                {fieldNames.map((name) => (
                  <div key={name} className={styles.fieldRow}>
                    <strong>{name || "Без терен"}</strong>
                    <div>{entries.filter((session) => getField(session) === name).map((session) => eventButton(session, true))}</div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      ) : <p>{view === "team" && customGroups.length === 0 ? "Няма персонализирани групи." : "Няма насрочени събития."}</p>}
    </section>
  );
}

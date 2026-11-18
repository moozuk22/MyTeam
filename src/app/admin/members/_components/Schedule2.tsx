import { useId, useState } from "react";
import { AttendanceFilterSelect } from "@/components/AttendanceFilterSelect";
import type { MatchEventType } from "@/lib/matchEventType";
import type { TrainingWeekSessionItem } from "../_types/members-page-types";
import { SkeletonLine } from "./FinanceSkeleton";
import styles from "./Schedule2.module.css";

export type Schedule2Session = TrainingWeekSessionItem & { fieldName?: string; matchEventType?: MatchEventType };

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
  week: number;
  lastWeek: number;
  canScheduleDate: (date: string) => boolean;
  onWeekChange: (week: number) => void;
  customGroups: Schedule2Group[];
  restDays: Record<string, string[]>;
  onOpen: (session: Schedule2Session) => void;
  onCreate: (groupId: string, date?: string) => void;
};

const dayFormat = new Intl.DateTimeFormat("bg-BG", { weekday: "short", timeZone: "UTC" });
const fullDayFormat = new Intl.DateTimeFormat("bg-BG", { weekday: "long", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function Schedule2Select(props: React.ComponentProps<typeof AttendanceFilterSelect>) {
  const id = useId();
  return (
    <div className={styles.select}>
      <label htmlFor={id}>{props.label}</label>
      <AttendanceFilterSelect {...props} id={id} />
    </div>
  );
}

function formatDay(date: string) {
  const day = new Date(date + "T00:00:00Z");
  return `${dayFormat.format(day)} ${dateFormat.format(day)}`;
}

function getField(session: Schedule2Session) {
  return session.fieldName ?? session.location?.trim() ?? "";
}

export function schedule2SessionBelongsToGroup(session: Schedule2Session, group: Schedule2Group) {
  if (session.customGroupId) return session.customGroupId === group.id;
  return session.eventType === "training" && Boolean(group.coachGroupId && group.coachGroupId === session.coachGroupId);
}

export default function Schedule2({ dates, sessions, loading, openingEditor = false, detailsActive = false, error, week, lastWeek, canScheduleDate, onWeekChange, customGroups, restDays, onOpen, onCreate }: Props) {
  const [view, setView] = useState<"team" | "field">("team");
  const [team, setTeam] = useState("");
  const [field, setField] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const activeTeam = customGroups.some(({ id }) => id === team) ? team : "";
  const visibleGroups = customGroups.filter(({ id }) => !activeTeam || id === activeTeam);
  const teamSessions = sessions.filter((session) =>
    (view === "field" && !activeTeam) || visibleGroups.some((group) => schedule2SessionBelongsToGroup(session, group)),
  );
  const hasUngroupedMatches = sessions.some((session) =>
    session.eventType === "match" && !customGroups.some((group) => schedule2SessionBelongsToGroup(session, group)),
  );
  const fields = [...new Set(teamSessions.map(getField).filter(Boolean))].sort((a, b) => a.localeCompare(b, "bg"));
  const activeField = fields.includes(field) ? field : "";
  const visibleSessions = teamSessions.filter((session) => !activeField || getField(session) === activeField)
    .sort((a, b) => (a.trainingTime || "99:99").localeCompare(b.trainingTime || "99:99"));
  const newGroupId = customGroups.find(({ id }) => id === newGroup)?.id ?? customGroups[0]?.id;
  const groupOptions = customGroups.map(({ id, name }) => ({ value: id, label: name }));

  function eventButton(session: Schedule2Session, fieldView = false) {
    const isMatch = session.eventType === "match";
    const eventType = isMatch ? session.matchEventType ?? "match" : "training";
    const matchVenue = eventType === "match" && session.isHome !== undefined
      ? (session.isHome ? "home" : "away")
      : undefined;
    const time = session.trainingTime || "Без час";
    // Match labels from the weekly endpoint start with the event type.
    const separator = session.label.indexOf(" · ");
    const label = isMatch
      ? (separator === -1 ? session.label : session.label.slice(separator + 3))
      : (fieldView ? session.scopeLabel || session.label : "");
    const accessibleLabel = [time, isMatch ? session.label : "Тренировка", !isMatch && label, session.location]
      .filter(Boolean).join(", ");
    return (
      <button key={session.id} type="button" className={styles.event} data-event-type={eventType} data-match-venue={matchVenue} aria-label={accessibleLabel} disabled={openingEditor || detailsActive} onClick={() => onOpen(session)}>
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
          {!loading && <p>{dates.length > 0 && `${formatDay(dates[0])} – ${formatDay(dates[dates.length - 1])} · `}{visibleSessions.length} събития</p>}
        </div>
        <div className={styles.actions}>
          {customGroups.length > 1 && newGroupId && (
            <Schedule2Select label="Група за ново събитие" value={newGroupId} options={groupOptions} onChange={setNewGroup} />
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
        <Schedule2Select label="Група" value={activeTeam} options={[{ value: "", label: "Всички групи" }, ...groupOptions]} onChange={setTeam} />
        <Schedule2Select label="Терен" value={activeField} options={[{ value: "", label: "Всички терени" }, ...fields.map((name) => ({ value: name, label: name }))]} onChange={setField} />
      </div>

      {!loading && !error && view === "team" && hasUngroupedMatches && (
        <p className={styles.notice}>Мачовете без персонализирана група са в „Терени и часове“ при избрани „Всички групи“.</p>
      )}
      {error && <p role="alert" className="amp-confirm-error">{error}</p>}
      {openingEditor && <div role="status" aria-label="Зареждане" aria-busy="true"><SkeletonLine /></div>}
      {loading ? (
        <div role="status" aria-label="Зареждане" aria-busy="true">
          {view === "team" ? (
            <div className={styles.grid} aria-hidden="true">
              <table className={styles.skeletonTable}>
                <tbody>
                  {[0, 1, 2].map((row) => (
                    <tr key={row}>
                      <th><SkeletonLine wide /></th>
                      {Array.from({ length: 7 }, (_, day) => <td key={day}><SkeletonLine wide /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.fieldDays} aria-hidden="true">
              {[0, 1, 2].map((day) => (
                <div className={styles.fieldDay} key={day}><SkeletonLine /><SkeletonLine wide /></div>
              ))}
            </div>
          )}
        </div>
      ) : view === "team" && dates.length > 0 && visibleGroups.length > 0 ? (
        <div className={styles.grid} tabIndex={0} role="region" aria-label="Таблица на седмичния график">
          <table>
            <thead>
              <tr>
                <th scope="col">Група</th>
                {dates.map((date) => {
                  const day = new Date(date + "T00:00:00Z");
                  return (
                    <th key={date} scope="col">
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
                    const entries = visibleSessions.filter((session) => session.date === date && schedule2SessionBelongsToGroup(session, group));
                    const restDay = entries.length === 0 && restDays[group.id]?.includes(date);
                    const canAddEvent = !activeField && canScheduleDate(date);
                    return (
                      <td key={date}>
                        {entries.map((session) => eventButton(session))}
                        {canAddEvent ? (
                          <button
                            type="button"
                            className={styles.emptyCell}
                            data-rest-day={restDay || undefined}
                            aria-label={`${restDay ? "Почивен ден" : "Ново събитие"} за ${group.name}, ${formatDay(date)}`}
                            disabled={openingEditor || detailsActive}
                            onClick={() => onCreate(group.id, date)}
                          >
                            {restDay ? "Почивен ден" : "+"}
                          </button>
                        ) : !activeField && restDay ? <span className={styles.dash}>Почивен ден</span>
                          : entries.length === 0 && <span className={styles.dash}>—</span>}
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

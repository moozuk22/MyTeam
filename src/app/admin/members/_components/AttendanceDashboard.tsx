"use client";

import { AttendanceFilterSelect } from "@/components/AttendanceFilterSelect";
import { useEffect, useState } from "react";
import { attendancePercentage } from "@/lib/attendanceEligibility";
import { type AttendanceReportData, type TrainingScheduleGroup } from "../_types/members-page-types";
import { sortByName, normalizeOptionalId, normalizeTrainingDurationInput, normalizeTrainingFieldSelections } from "../_utils/members-page-utils";
import { CalendarIcon, ClipboardListIcon, PencilIcon, PrinterIcon, SpinnerIcon, XIcon } from "./members-page-icons";

export function AttendanceDashboard({
  onClose,
  clubId,
  coachGroupId = "",
  coachGroupName = "",
}: {
  onClose: () => void;
  clubId: string;
  coachGroupId?: string;
  coachGroupName?: string;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(todayIso);
  const [eventType, setEventType] = useState<"training" | "match">("training");
  const [scopeType, setScopeType] = useState<"group" | "player">("group");
  const [selectedGroupScope, setGroupScope] = useState("");
  const groupScope = coachGroupId ? `cg:${coachGroupId}` : selectedGroupScope;
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [playerMenuOpen, setPlayerMenuOpen] = useState(false);
  const [activePlayerOption, setActivePlayerOption] = useState(0);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allPlayers, setAllPlayers] = useState<Array<{ id: string; fullName: string; teamGroup: number | null; customTrainingGroupNames: string[] }>>([]);
  const [data, setData] = useState<AttendanceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableGroups, setAvailableGroups] = useState<number[]>([]);
  const [scheduleGroups, setScheduleGroups] = useState<TrainingScheduleGroup[]>([]);
  const [coachGroupsList, setCoachGroupsList] = useState<Array<{ id: string; name: string }>>([]);
  const [editMode, setEditMode] = useState(false);
  // key: "playerId|date", value: optedOut boolean (desired new state)
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [customTrainingGroupsList, setCustomTrainingGroupsList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCustomGroupId, setSelectedCustomGroupId] = useState("");
  const attendanceScopeKey = `${clubId}|${coachGroupId}`;

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        let playerTeamGroups: number[] = [];
        const membersSearch = new URLSearchParams();
        if (clubId) {
          membersSearch.set("clubId", clubId);
        }
        if (coachGroupId) {
          membersSearch.set("coachGroupId", coachGroupId);
        }
        const membersUrl = membersSearch.size
          ? `/api/admin/members?${membersSearch.toString()}`
          : "/api/admin/members";
        const groupsUrl = `/api/admin/clubs/${encodeURIComponent(clubId)}/training-groups`;
        const coachGroupsUrl = `/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups`;

        const [membersRes, groupsRes, coachGroupsRes] = await Promise.all([
          fetch(membersUrl, { cache: "no-store" }),
          fetch(groupsUrl, { cache: "no-store" }),
          coachGroupId ? Promise.resolve(null) : fetch(coachGroupsUrl, { cache: "no-store" }),
        ]);

        if (membersRes.ok) {
          const raw: unknown = await membersRes.json();
          const items = Array.isArray(raw) ? raw : [];
          const players = items
            .map((item: unknown) => {
              const r =
                typeof item === "object" && item !== null
                  ? (item as Record<string, unknown>)
                  : {};
              return {
                id: String(r.id ?? ""),
                fullName: String(r.fullName ?? "").trim(),
                teamGroup: typeof r.teamGroup === "number" ? r.teamGroup : null,
                customTrainingGroupNames: Array.isArray(r.customTrainingGroupNames)
                  ? r.customTrainingGroupNames.filter((name): name is string => typeof name === "string" && Boolean(name.trim()))
                  : [],
              };
            })
            .filter((p) => p.id && p.fullName);
          setAllPlayers(players.sort((a, b) => a.fullName.localeCompare(b.fullName, "bg")));
          const groups = Array.from(
            new Set(players.map((p) => p.teamGroup).filter((g): g is number => g !== null)),
          ).sort((a, b) => a - b);
          playerTeamGroups = groups;
          setAvailableGroups(groups);
        }

        if (groupsRes.ok) {
          const payload: unknown = await groupsRes.json();
          const groups: TrainingScheduleGroup[] = Array.isArray(payload)
            ? payload
              .map((item) => {
                const raw =
                  typeof item === "object" && item !== null
                    ? (item as Record<string, unknown>)
                    : {};
                const tg = Array.isArray(raw.teamGroups)
                  ? raw.teamGroups
                    .map((v) => Number.parseInt(String(v), 10))
                    .filter((v) => Number.isInteger(v))
                    .sort((a, b) => a - b)
                  : [];
                const td = Array.isArray(raw.trainingDates)
                  ? raw.trainingDates
                    .map((v) => String(v ?? "").trim())
                    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
                  : [];
                return {
                  id: String(raw.id ?? ""),
                  name: String(raw.name ?? "").trim(),
                  teamGroups: tg,
                  trainingDates: td,
                  trainingTime: typeof raw.trainingTime === "string" ? raw.trainingTime.trim() : null,
                  trainingDateTimes: null,
                  trainingDurationMinutes: normalizeTrainingDurationInput(raw.trainingDurationMinutes),
                  trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
                  trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds) ? raw.trainingFieldPieceIds.map(String) : [],
                  trainingFieldSelections: normalizeTrainingFieldSelections(raw.trainingFieldSelections, td, {
                    trainingFieldId: normalizeOptionalId(raw.trainingFieldId),
                    trainingFieldPieceIds: Array.isArray(raw.trainingFieldPieceIds) ? raw.trainingFieldPieceIds.map(String) : [],
                  }),
                } satisfies TrainingScheduleGroup;
              })
              .filter((g) => g.id && g.teamGroups.length >= 2)
              .filter((g) => !coachGroupId || g.teamGroups.some((teamGroup) => playerTeamGroups.includes(teamGroup)))
            : [];
          setScheduleGroups(sortByName(groups));
        }

        if (coachGroupsRes?.ok) {
          const payload: unknown = await coachGroupsRes.json();
          const cgs = Array.isArray(payload)
            ? payload
              .map((item) => {
                const r = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
                return { id: String(r.id ?? ""), name: String(r.name ?? "").trim() };
              })
              .filter((g) => g.id && g.name)
            : [];
          setCoachGroupsList(sortByName(cgs));
        }
      } catch {
        // silent
      }
    };
    void fetchOptions();

  }, [attendanceScopeKey]);

  useEffect(() => {
    if (scopeType === "group" && !groupScope && coachGroupsList.length > 0) {
      setGroupScope(`cg:${coachGroupsList[0].id}`);
    }
  }, [coachGroupsList, scopeType, groupScope]);

  useEffect(() => {
    if (!groupScope.startsWith("cg:")) {
      setCustomTrainingGroupsList([]);
      setSelectedCustomGroupId("");
      return;
    }
    const cgId = groupScope.slice(3);
    const fetchCustomGroups = async () => {
      try {
        const res = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups?coachGroupId=${encodeURIComponent(cgId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const payload: unknown = await res.json();
        const groups = Array.isArray(payload)
          ? payload
            .map((item) => {
              const r = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
              return { id: String(r.id ?? ""), name: String(r.name ?? "").trim() };
            })
            .filter((g) => g.id && g.name)
          : [];
        const sortedGroups = sortByName(groups);
        setCustomTrainingGroupsList(sortedGroups);
        setSelectedCustomGroupId(sortedGroups.length > 0 ? sortedGroups[0].id : "");
      } catch {
        // silent
      }
    };
    void fetchCustomGroups();
  }, [groupScope, clubId]);

  useEffect(() => {
    if (!from || !to || from > to) return;
    if (scopeType === "player" && !selectedPlayerId) return;

    let cancelled = false;

    const doFetch = async () => {
      setLoading(true);
      setError("");
      setData(null);
      setEditMode(false);
      setPendingChanges(new Map());
      setSaveError("");
      try {
        const search = new URLSearchParams({ from, to });
        if (scopeType === "player") {
          search.set("playerId", selectedPlayerId);
        } else if (groupScope.startsWith("tg:")) {
          search.set("trainingGroupId", groupScope.slice(3));
        } else if (groupScope.startsWith("year:")) {
          search.set("teamGroup", groupScope.slice(5));
        } else if (groupScope.startsWith("cg:")) {
          if (selectedCustomGroupId) {
            search.set("customTrainingGroupId", selectedCustomGroupId);
          } else {
            search.set("coachGroupId", groupScope.slice(3));
          }
        }
        if (coachGroupId && (scopeType === "player" || !groupScope.startsWith("cg:"))) {
          search.set("coachGroupId", coachGroupId);
        }
        const res = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/${eventType === "match" ? "matches/attendance-report" : "training-attendance/report"}?${search.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          throw new Error(
            typeof payload?.error === "string" ? payload.error : "Грешка при зареждане.",
          );
        }
        const payload = (await res.json()) as AttendanceReportData;
        const reportData: AttendanceReportData = {
          ...payload,
          trainingDates: [...payload.trainingDates].sort((a, b) => b.slice(0, 10).localeCompare(a.slice(0, 10)) || (payload.events ? payload.events[b].time.localeCompare(payload.events[a].time) : b.localeCompare(a))),
        };
        if (cancelled) return;
        setData(reportData);
      } catch (e) {
        if (!cancelled && (e as { name?: string }).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Грешка при зареждане.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(() => { void doFetch(); }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };

  }, [from, to, scopeType, groupScope, selectedPlayerId, selectedCustomGroupId, attendanceScopeKey, eventType]);

  const formatDateHeader = (iso: string): string => {
    const parts = iso.slice(0, 10).split("-");
    const month = parts[1] ?? "01";
    const day = parts[2] ?? "01";
    const monthIdx = parseInt(month, 10) - 1;
    const shortMonths = ["Ян", "Фев", "Мар", "Апр", "Май", "Юни", "Юли", "Авг", "Сеп", "Окт", "Ное", "Дек"];
    const game = data?.events?.[iso];
    return `${day}\n${shortMonths[monthIdx] ?? ""}${game ? `\n${game.time}${game.opponent ? `\n${game.opponent}` : ""}` : iso.includes("#") ? `\n${iso.slice(11, 16)}` : ""}`;
  };

  const emptyLabel = groupScope.startsWith("tg:")
    ? "Няма състезатели в избраната група."
    : groupScope.startsWith("year:")
      ? "Няма състезатели в избрания набор."
      : groupScope.startsWith("cg:")
        ? "Няма състезатели в избраната треньорска група."
        : "Няма активни състезатели.";


  const filteredSearchPlayers = playerSearch.length >= 1 && !selectedPlayerId
    ? allPlayers.filter((p) =>
      p.fullName.toLowerCase().includes(playerSearch.toLowerCase()),
    ).slice(0, 10)
    : [];

  const handleCellClick = (playerId: string, date: string) => {
    if (saving) return;
    const key = `${playerId}|${date}`;
    const originalOptedOut = !(data?.players.find((p) => p.id === playerId)?.attendance[date]?.present ?? true);
    const currentOptedOut = pendingChanges.has(key) ? pendingChanges.get(key)! : originalOptedOut;
    const newOptedOut = !currentOptedOut;

    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (newOptedOut === originalOptedOut) {
        next.delete(key);
      } else {
        next.set(key, newOptedOut);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (pendingChanges.size === 0 || saving) return;
    setSaving(true);
    setSaveError("");

    try {
      await Promise.all(
        Array.from(pendingChanges.entries()).map(async ([key, optedOut]) => {
          const separatorIdx = key.indexOf("|");
          const playerId = key.slice(0, separatorIdx);
          const trainingDate = key.slice(separatorIdx + 1);
          const matchId = data?.events?.[trainingDate]?.matchId;
          if (eventType === "match" && !matchId) throw new Error("Мачът не е намерен. Презаредете справката.");
          const res = await fetch(
            eventType === "match"
              ? `/api/admin/clubs/${encodeURIComponent(clubId)}/matches/${encodeURIComponent(matchId!)}/attendance`
              : `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(eventType === "match"
                ? { playerId, present: !optedOut, reasonCode: "other", reasonText: "Промяна направена от треньор" }
                : { playerId, trainingDate: trainingDate.slice(0, 10), ...(trainingDate.split("#")[1]?.startsWith("custom_group:") ? { trainingScopeKey: trainingDate.split("#")[1] } : { trainingSessionId: trainingDate.includes("#") ? trainingDate.split("#")[1] : data?.trainingSessionIds?.[trainingDate] }), optedOut }),
            },
          );
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error((json as { error?: string }).error ?? "Грешка при запис.");
          }
        }),
      );

      // Commit pending changes into the data state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => {
            const updatedAttendance = { ...p.attendance };
            for (const [key, optedOut] of pendingChanges.entries()) {
              const sepIdx = key.indexOf("|");
              if (key.slice(0, sepIdx) !== p.id) continue;
              const date = key.slice(sepIdx + 1);
              updatedAttendance[date] = {
                present: !optedOut,
                reasonCode: optedOut ? "other" : null,
                reasonText: optedOut ? "Промяна направена от треньор" : null,
              };
            }
            return { ...p, attendance: updatedAttendance };
          }),
        };
      });

      setPendingChanges(new Map());
      setEditMode(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Грешка при запис.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setPendingChanges(new Map());
    setEditMode(false);
    setSaveError("");
  };

  const reportTitle = eventType === "match" ? "Присъствия на мачове" : "Присъствия на тренировки";


  const printAttendance = () => {
    if (!data || typeof window === "undefined") return;

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const scopeTitle = coachGroupId ? `Само за треньорска група: ${coachGroupName || "текущата група"}` : "";

    const tHeadHtml = `
      <tr>
        <th style="padding: 6px; text-align: left; border-bottom: 2px solid #ccc; white-space: nowrap;">Име</th>
        ${data.trainingDates.map(d => `<th style="padding: 6px; border-bottom: 2px solid #ccc; text-align: center;">${escapeHtml(formatDateHeader(d)).replaceAll("\n", "<br>")}</th>`).join('')}
        <th style="padding: 6px; border-bottom: 2px solid #ccc; text-align: center;">%</th>
      </tr>
    `;

    const tbodyHtml = data.players.map((player) => {
      const pct = attendancePercentage(data.trainingDates.map(d => player.attendance[d]));

      const cellsHtml = data.trainingDates.map((d) => {
        const cell = player.attendance[d];
        if (!cell) return `<td style="padding: 4px; text-align: center; color: #999;">–</td>`;
        return cell.present
          ? `<td style="padding: 4px; text-align: center; color: #16a34a; font-weight: bold;">&#x2713;</td>`
          : `<td style="padding: 4px; text-align: center; color: #dc2626;">&#x2717;</td>`;
      }).join('');

      return `
        <tr>
          <td style="padding: 4px; border-bottom: 1px solid #eee; white-space: nowrap;">${escapeHtml(player.fullName)}</td>
          ${cellsHtml}
          <td style="padding: 4px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${pct === null ? "–" : `${pct}%`}</td>
        </tr>
      `;
    }).join("");

    let tfootHtml = "";
    if (scopeType === "group") {
      const footerCellsHtml = data.trainingDates.map((d) => {
        const pct = attendancePercentage(data.players.map(p => p.attendance[d]));
        return `<td style="padding: 6px; text-align: center; font-weight: bold;">${pct === null ? "–" : `${pct}%`}</td>`;
      }).join("");

      tfootHtml = `
        <tr style="background: #f9fafb;">
          <td style="padding: 6px; text-align: right; font-weight: bold;">Средно</td>
          ${footerCellsHtml}
          <td style="padding: 6px;"></td>
        </tr>
      `;
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${reportTitle} (${from} до ${to})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; padding: 20px; margin: 0; }
    .pt { display: flex; gap: 8px; margin: 0 0 16px; }
    .pt button { padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
    .pt-p { background: #111827; color: #fff; border: none; }
    .pt-c { background: #f3f4f6; border: 1px solid #d1d5db; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e5e7eb; padding: 4px 6px; }
    th { background: #f9fafb; }
    @media print { .pt { display: none; } @page { size: landscape; margin: 10mm; } }
  </style>
</head>
<body>
  <div class="pt">
    <button class="pt-c" onclick="window.close()">✕ Затвори</button>
    <button class="pt-p" onclick="window.print()">🖨 Принтирай</button>
  </div>
  <div style="font-size:20px;font-weight:700;margin:0 0 16px;">${reportTitle} (${from} до ${to})</div>
  ${scopeTitle ? `<p style="margin:0 0 12px;color:#6b7280;font-size:13px;">${escapeHtml(scopeTitle)}</p>` : ""}
  <table>
    <thead>${tHeadHtml}</thead>
    <tbody>${tbodyHtml}</tbody>
    ${tfootHtml ? `<tfoot>${tfootHtml}</tfoot>` : ""}
  </table>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) { URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="rd-overlay" onClick={onClose}>
      <div className="rd-dialog acd-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="rd-close" onClick={onClose} aria-label="Затвори">
          <XIcon />
        </button>

        <div className="rd-header">
          <h2 className="rd-title">
            <ClipboardListIcon size={20} />
            {reportTitle}
          </h2>
          {coachGroupId && (
            <p className="rd-subtitle">
              Само за треньорска група: {coachGroupName || "текущата група"}
            </p>
          )}
        </div>

        <div className="rd-filters">
          <div className="rd-field">
            <label className="rd-label" htmlFor="attendance-event-type">Събития</label>
            <AttendanceFilterSelect id="attendance-event-type" label="Събития" value={eventType} options={[{ value: "training", label: "Тренировки" }, { value: "match", label: "Мачове" }]} disabled={saving || pendingChanges.size > 0} title={pendingChanges.size > 0 ? "Запазете или откажете промените преди превключване." : undefined} onChange={(value) => {
                setEventType(value as "training" | "match");
                setData(null);
                setError("");
                setSaveError("");
                setEditMode(false);
                setPendingChanges(new Map());
              }} />
          </div>
          <div className="rd-field">
            <label className="rd-label">От</label>
            <div className="rd-select-wrap">
              <input
                type="date"
                className="rd-date-input"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
              <CalendarIcon size={16} />
            </div>
          </div>
          <div className="rd-field">
            <label className="rd-label">До</label>
            <div className="rd-select-wrap">
              <input
                type="date"
                className="rd-date-input"
                value={to}
                min={from}
                max={eventType === "training" ? todayIso : undefined}
                onChange={(e) => setTo(e.target.value)}
              />
              <CalendarIcon size={16} />
            </div>
          </div>
          <div className="rd-field">
            <label className="rd-label">Вид</label>
            <AttendanceFilterSelect label="Вид" value={scopeType} options={[{ value: "group", label: "Отбор" }, { value: "player", label: "Състезател" }]} onChange={(value) => {
                  const next = value as "group" | "player";
                  setScopeType(next);
                  setData(null);
                  setError("");
                  if (next === "player") { setPlayerSearch(""); setSelectedPlayerId(""); }
                }} />
          </div>
          {scopeType === "group" ? (
            <>
              {!coachGroupId && (
                <div className="rd-field">
                  <label className="rd-label">Треньор</label>
                  <AttendanceFilterSelect label="Треньор" value={groupScope} options={coachGroupsList.map((group) => ({ value: `cg:${group.id}`, label: group.name }))} onChange={setGroupScope} />
                </div>
              )}
              {groupScope.startsWith("cg:") && customTrainingGroupsList.length > 0 && (
                <div className="rd-field">
                  <label className="rd-label">Треньорска група</label>
                  <AttendanceFilterSelect label="Треньорска група" value={selectedCustomGroupId} options={customTrainingGroupsList.map((group) => ({ value: group.id, label: group.name }))} onChange={setSelectedCustomGroupId} />
                </div>
              )}
            </>
          ) : (
            <div className="rd-field acd-player-search-field">
              <label className="rd-label">Състезател</label>
              <div className="acd-player-search">
                <input
                  type="text"
                  className="acd-search-input"
                  placeholder="Търси състезател..."
                  value={playerSearch}
                  autoComplete="off"
                  onChange={(e) => {
                    setPlayerSearch(e.target.value);
                    setSelectedPlayerId("");
                    setShowSearchResults(true);
                    setData(null);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
                />
                {showSearchResults && filteredSearchPlayers.length > 0 && (
                  <ul className="acd-search-results">
                    {filteredSearchPlayers.map((p) => (
                      <li
                        key={p.id}
                        className="acd-search-result"
                        onMouseDown={() => {
                          setSelectedPlayerId(p.id);
                          setPlayerSearch(p.fullName);
                          setShowSearchResults(false);
                        }}
                      >
                        {p.fullName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {loading && (
            <div className="acd-inline-spinner">
              <SpinnerIcon size={16} />
            </div>
          )}
        </div>

        {error && <p className="acd-error">{error}</p>}

        {data && (
          <>
            {data.trainingDates.length === 0 ? (
              <p className="acd-empty">{eventType === "match" ? "Няма мачове с включено присъствие в избрания период." : "Няма тренировки в избрания период."}</p>
            ) : data.players.length === 0 ? (
              <p className="acd-empty">{emptyLabel}</p>
            ) : (
              <div className="acd-table-wrap">
                <table className="acd-table">
                  <thead>
                    <tr>
                      <th className="acd-th-name">Състезател</th>
                      {data.trainingDates.map((d) => (
                        <th key={d} className="acd-th-date" title={formatDateHeader(d).replaceAll("\n", " ")}>
                          <span className="acd-date-label">{formatDateHeader(d)}</span>
                        </th>
                      ))}
                      <th className="acd-th-pct">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.map((player) => {
                      const pct = attendancePercentage(data.trainingDates.map(d => player.attendance[d]));
                      return (
                        <tr key={player.id}>
                          <td className="acd-td-name">{player.fullName}</td>
                          {data.trainingDates.map((d) => {
                            const cell = player.attendance[d];
                            if (!cell) {
                              return (
                                <td key={d} className="acd-cell acd-cell--na">
                                  –
                                </td>
                              );
                            }
                            const cellKey = `${player.id}|${d}`;
                            const hasPending = pendingChanges.has(cellKey);
                            const displayOptedOut = hasPending ? pendingChanges.get(cellKey)! : !cell.present;
                            const displayPresent = !displayOptedOut;
                            const editTitle = displayPresent
                              ? "Клик за отбелязване на отсъствие"
                              : "Клик за отбелязване на присъствие";
                            const viewTitle = displayPresent
                              ? "Присъства"
                              : !hasPending && cell.reasonCode === "injury" ? "Контузия"
                              : !hasPending && cell.reasonCode === "sick" ? "Болен"
                              : !hasPending && cell.reasonCode === "other" ? cell.reasonText || "Друга причина"
                              : !hasPending && cell.reasonCode === "limited_event" ? "Не е записан за ограниченото събитие"
                              : !hasPending && cell.reasonCode ? `Причина: ${cell.reasonCode}` : "Отказал се";
                            const displayReasonCode = hasPending ? (displayOptedOut ? "other" : null) : cell.reasonCode;
                            return (
                              <td
                                key={d}
                                className={`acd-cell ${displayPresent ? "acd-cell--present" : "acd-cell--absent"}${editMode ? " acd-cell--editable" : ""}${hasPending ? " acd-cell--pending" : ""}`}
                                title={editMode ? editTitle : viewTitle}
                                onClick={editMode && !saving ? () => handleCellClick(player.id, d) : undefined}
                              >
                                {displayPresent ? "✓" : (
                                  displayReasonCode === "injury" ? "Конт" :
                                    displayReasonCode === "sick" ? "Болен" :
                                      displayReasonCode === "other" ? "Друго" :
                                        displayReasonCode === "limited_event" ? "✗" :
                                          displayReasonCode ? displayReasonCode.slice(0, 4) : "✗"
                                )}
                              </td>
                            );
                          })}
                          <td
                            className={`acd-td-pct ${(pct ?? 0) >= 75 ? "acd-pct--good" : (pct ?? 0) >= 50 ? "acd-pct--warn" : "acd-pct--low"}`}
                          >
                            {pct === null ? "–" : `${pct}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {scopeType === "group" && (
                    <tfoot>
                      <tr className="acd-summary-row">
                        <td className="acd-td-name acd-summary-label">Средно</td>
                        {data.trainingDates.map((d) => {
                          const pct = attendancePercentage(data.players.map(p => p.attendance[d]));
                          return (
                            <td
                              key={d}
                              className={`acd-cell ${(pct ?? 0) >= 75 ? "acd-pct--good" : (pct ?? 0) >= 50 ? "acd-pct--warn" : "acd-pct--low"}`}
                            >
                              {pct === null ? "–" : `${pct}%`}
                            </td>
                          );
                        })}
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </>
        )}

        {!data && !loading && !error && (
          <p className="acd-empty">
            {scopeType === "player" && !selectedPlayerId
              ? "Изберете състезател за да видите присъствията."
              : "Няма данни за избрания период."}
          </p>
        )}

        {saveError && <p className="acd-error">{saveError}</p>}

        {data && data.players.length > 0 && data.trainingDates.length > 0 && (
          <div className="rd-footer" style={{ marginTop: "4px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {!editMode && (
              <button className="rd-footer-btn" onClick={printAttendance} type="button">
                <PrinterIcon /> Отпечатай
              </button>
            )}
            {!editMode ? (
              <button
                type="button"
                className="rd-footer-btn"
                onClick={() => { setEditMode(true); setSaveError(""); }}
              >
                <PencilIcon size={14} /> Редактирай
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="rd-footer-btn rd-footer-btn--save"
                  disabled={pendingChanges.size === 0 || saving}
                  onClick={handleSave}
                >
                  {saving ? <SpinnerIcon size={14} /> : <PencilIcon size={14} />}
                  {saving ? "Запис..." : `Запази${pendingChanges.size > 0 ? ` (${pendingChanges.size})` : ""}`}
                </button>
                <button
                  type="button"
                  className="rd-footer-btn"
                  disabled={saving}
                  onClick={handleCancelEdit}
                >
                  Отмени
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

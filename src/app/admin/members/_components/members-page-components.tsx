import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AttendanceReportData,
  CoachGroup,
  DriveItem,
  ImportResult,
  ImportStep,
  Member,
  MemberNotification,
  ParsedPlayerRow,
  PhotoImportResult,
  PhotoImportStep,
  ReportKind,
  ReportPlayer,
  TrainingScheduleGroup,
} from "../_types/members-page-types";
import {
  MONTHS,
  getStatusMeta,
  normalizeOptionalId,
  normalizeTrainingDurationInput,
  normalizeTrainingFieldSelections,
} from "../_utils/members-page-utils";
import {
  BellIcon,
  CalendarIcon,
  ChartColumnIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  ClipboardListIcon,
  FolderIcon,
  PencilIcon,
  PhotoImportIcon,
  PrinterIcon,
  ReceiptIcon,
  SheetFileIcon,
  SpinnerIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "./members-page-icons";
export * from "../_utils/members-page-utils";
export * from "./members-page-icons";
export type * from "../_types/members-page-types";

// Attendance Coach Dashboard Component
function AttendanceDashboard({
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
  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(todayIso);
  const [scopeType, setScopeType] = useState<"group" | "player">("group");
  const [groupScope, setGroupScope] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allPlayers, setAllPlayers] = useState<Array<{ id: string; fullName: string; teamGroup: number | null }>>([]);
  const [data, setData] = useState<AttendanceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableGroups, setAvailableGroups] = useState<number[]>([]);
  const [scheduleGroups, setScheduleGroups] = useState<TrainingScheduleGroup[]>([]);
  const [editMode, setEditMode] = useState(false);
  // key: "playerId|date", value: optedOut boolean (desired new state)
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
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

        const [membersRes, groupsRes] = await Promise.all([
          fetch(membersUrl, { cache: "no-store" }),
          fetch(groupsUrl, { cache: "no-store" }),
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
          setScheduleGroups(groups);
        }
      } catch {
        // silent
      }
    };
    void fetchOptions();
     
  }, [attendanceScopeKey]);

  useEffect(() => {
    if (scopeType === "group" && !groupScope && (scheduleGroups.length > 0 || availableGroups.length > 0)) {
      if (scheduleGroups.length > 0) {
        setGroupScope(`tg:${scheduleGroups[0].id}`);
      } else if (availableGroups.length > 0) {
        const trainingGroupYears = new Set(scheduleGroups.flatMap((g) => g.teamGroups));
        const standalone = availableGroups.filter((g) => !trainingGroupYears.has(g));
        if (standalone.length > 0) {
          setGroupScope(`year:${standalone[0]}`);
        }
      }
    }
  }, [scheduleGroups, availableGroups, scopeType, groupScope]);

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
        }
        if (coachGroupId) {
          search.set("coachGroupId", coachGroupId);
        }
        const res = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance/report?${search.toString()}`,
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
          trainingDates: [...payload.trainingDates].sort((a, b) => b.localeCompare(a)),
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
     
  }, [from, to, scopeType, groupScope, selectedPlayerId, attendanceScopeKey]);

  const formatDateHeader = (iso: string): string => {
    const parts = iso.split("-");
    const month = parts[1] ?? "01";
    const day = parts[2] ?? "01";
    const monthIdx = parseInt(month, 10) - 1;
    const shortMonths = ["Ян", "Фев", "Мар", "Апр", "Май", "Юни", "Юли", "Авг", "Сеп", "Окт", "Ное", "Дек"];
    return `${day}\n${shortMonths[monthIdx] ?? ""}`;
  };

  const emptyLabel = groupScope.startsWith("tg:")
    ? "Няма играчи в избраната група."
    : groupScope.startsWith("year:")
      ? "Няма играчи в избрания набор."
      : "Няма активни играчи.";

  const trainingGroupYears = new Set(scheduleGroups.flatMap((g) => g.teamGroups));
  const standaloneGroups = availableGroups.filter((g) => !trainingGroupYears.has(g));

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
          const res = await fetch(
            `/api/admin/clubs/${encodeURIComponent(clubId)}/training-attendance`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId, trainingDate, optedOut }),
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

  const printAttendance = () => {
    if (!data || typeof window === "undefined" || typeof document === "undefined") return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      document.body.removeChild(iframe);
      return;
    }

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
        ${data.trainingDates.map(d => `<th style="padding: 6px; border-bottom: 2px solid #ccc; text-align: center;">${d.split('-')[2]}.${d.split('-')[1]}</th>`).join('')}
        <th style="padding: 6px; border-bottom: 2px solid #ccc; text-align: center;">%</th>
      </tr>
    `;

    const tbodyHtml = data.players.map((player) => {
      const presentCount = data.trainingDates.filter(d => player.attendance[d]?.present ?? true).length;
      const pct = data.trainingDates.length > 0 ? Math.round((presentCount / data.trainingDates.length) * 100) : 0;
      
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
          <td style="padding: 4px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${pct}%</td>
        </tr>
      `;
    }).join("");

    let tfootHtml = "";
    if (scopeType === "group") {
      const footerCellsHtml = data.trainingDates.map((d) => {
        const presentOnDate = data.players.filter(p => p.attendance[d]?.present ?? true).length;
        const pct = data.players.length > 0 ? Math.round((presentOnDate / data.players.length) * 100) : 0;
        return `<td style="padding: 6px; text-align: center; font-weight: bold;">${pct}%</td>`;
      }).join("");

      tfootHtml = `
        <tr style="background: #f9fafb;">
          <td style="padding: 6px; text-align: right; font-weight: bold;">Средно</td>
          ${footerCellsHtml}
          <td style="padding: 6px;"></td>
        </tr>
      `;
    }

    doc.open();
    doc.write(`<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Присъствия</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
    .page { padding: 20px; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    @page { size: landscape; margin: 10mm; }
  </style>
</head>
<body>
  <div class="page">
    <h1>Отчет присъствия (${from} до ${to})</h1>
    ${scopeTitle ? `<p style="margin: 0 0 12px; color: #6b7280; font-size: 13px;">${escapeHtml(scopeTitle)}</p>` : ""}
    <table>
      <thead>${tHeadHtml}</thead>
      <tbody>${tbodyHtml}</tbody>
      ${tfootHtml ? `<tfoot>${tfootHtml}</tfoot>` : ""}
    </table>
  </div>
</body>
</html>`);
    doc.close();

    window.setTimeout(() => {
      win.focus();
      win.print();
      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 80);
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
            Присъствия на тренировки
          </h2>
          {coachGroupId && (
            <p className="rd-subtitle">
              Само за треньорска група: {coachGroupName || "текущата група"}
            </p>
          )}
        </div>

        <div className="rd-filters">
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
                max={todayIso}
                onChange={(e) => setTo(e.target.value)}
              />
              <CalendarIcon size={16} />
            </div>
          </div>
          <div className="rd-field">
            <label className="rd-label">Вид</label>
            <div className="rd-select-wrap">
              <select
                className="rd-select"
                value={scopeType}
                onChange={(e) => {
                  const next = e.target.value as "group" | "player";
                  setScopeType(next);
                  setData(null);
                  setError("");
                  if (next === "player") {
                    setPlayerSearch("");
                    setSelectedPlayerId("");
                  }
                }}
              >
                <option value="group">Отбор</option>
                <option value="player">Играч</option>
              </select>
              <ChevronDownIcon />
            </div>
          </div>
          {scopeType === "group" ? (
            <div className="rd-field">
              <label className="rd-label">Група</label>
              <div className="rd-select-wrap">
                <select
                  className="rd-select"
                  value={groupScope}
                  onChange={(e) => setGroupScope(e.target.value)}
                >
                  {scheduleGroups.map((g) => (
                    <option key={g.id} value={`tg:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                  {standaloneGroups.map((g) => (
                    <option key={g} value={`year:${g}`}>
                      Набор {g}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon />
              </div>
            </div>
          ) : (
            <div className="rd-field acd-player-search-field">
              <label className="rd-label">Играч</label>
              <div className="acd-player-search">
                <input
                  type="text"
                  className="acd-search-input"
                  placeholder="Търси играч..."
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
                        {p.teamGroup !== null && (
                          <span className="acd-search-result-group">Набор {p.teamGroup}</span>
                        )}
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
              <p className="acd-empty">Няма тренировки в избрания период.</p>
            ) : data.players.length === 0 ? (
              <p className="acd-empty">{emptyLabel}</p>
            ) : (
              <div className="acd-table-wrap">
                <table className="acd-table">
                  <thead>
                    <tr>
                      <th className="acd-th-name">Играч</th>
                      {data.trainingDates.map((d) => (
                        <th key={d} className="acd-th-date" title={d}>
                          <span className="acd-date-label">{formatDateHeader(d)}</span>
                        </th>
                      ))}
                      <th className="acd-th-pct">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.map((player) => {
                      const presentCount = data.trainingDates.filter(
                        (d) => player.attendance[d]?.present ?? true,
                      ).length;
                      const pct =
                        data.trainingDates.length > 0
                          ? Math.round((presentCount / data.trainingDates.length) * 100)
                          : 0;
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
                              : !hasPending && cell.reasonCode === "other" ? "Друга причина"
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
                                        displayReasonCode ? displayReasonCode.slice(0, 4) : "✗"
                                )}
                              </td>
                            );
                          })}
                          <td
                            className={`acd-td-pct ${pct >= 75 ? "acd-pct--good" : pct >= 50 ? "acd-pct--warn" : "acd-pct--low"}`}
                          >
                            {pct}%
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
                          const presentOnDate = data.players.filter(
                            (p) => p.attendance[d]?.present ?? true,
                          ).length;
                          const pct =
                            data.players.length > 0
                              ? Math.round((presentOnDate / data.players.length) * 100)
                              : 0;
                          return (
                            <td
                              key={d}
                              className={`acd-cell ${pct >= 75 ? "acd-pct--good" : pct >= 50 ? "acd-pct--warn" : "acd-pct--low"}`}
                            >
                              {pct}%
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
              ? "Изберете играч за да видите присъствията."
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

// Reports Dialog Component
function ReportsDialog({
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
  const now = new Date();
  const [month, setMonth] = useState(MONTHS[now.getMonth()] ?? MONTHS[0]);
  const [year, setYear] = useState(String(Math.max(2026, now.getFullYear())));
  const [group, setGroup] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [players, setPlayers] = useState<ReportPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const reportScopeKey = `${clubId}|${coachGroupId}`;

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const search = new URLSearchParams();
        if (clubId) {
          search.set("clubId", clubId);
        }
        if (coachGroupId) {
          search.set("coachGroupId", coachGroupId);
        }
        const endpoint = search.size ? `/api/admin/members?${search.toString()}` : "/api/admin/members";
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) {
          setPlayers([]);
          return;
        }
        const data = await response.json();
        const normalizedPlayers: ReportPlayer[] = Array.isArray(data)
          ? data.map((item) => {
            const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
            const paymentLogs = Array.isArray(raw.paymentLogs)
              ? raw.paymentLogs.map((log) => {
                const logRaw =
                  typeof log === "object" && log !== null ? (log as Record<string, unknown>) : {};
                return {
                  id: String(logRaw.id ?? ""),
                  paidFor: String(logRaw.paidFor ?? ""),
                  paidAt: String(logRaw.paidAt ?? ""),
                };
              })
              : [];

            return {
              id: String(raw.id ?? ""),
              fullName: String(raw.fullName ?? ""),
              teamGroup: typeof raw.teamGroup === "number" ? raw.teamGroup : null,
              paymentLogs,
              isActive: raw.isActive === false ? false : true,
            };
          })
          : [];
        setPlayers(normalizedPlayers);
      } catch (error) {
        console.error("Error fetching report players:", error);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchPlayers();
  }, [reportScopeKey]);

  const years = Array.from(
    { length: Math.max(1, now.getFullYear() - 2026 + 2) },
    (_, idx) => String(2026 + idx),
  );

  const groups = [...new Set(
    players
      .map((player) => player.teamGroup)
      .filter((value): value is number => value !== null),
  )].sort((a, b) => b - a);

  const selectedMonthIdx = MONTHS.indexOf(month);
  const selectedYear = Number(year);

  const getPaymentDateForMonth = (player: ReportPlayer): string | null => {
    let latestPaidAt: Date | null = null;

    for (const log of player.paymentLogs ?? []) {
      const paidForDate = new Date(log.paidFor);
      const paidAtDate = new Date(log.paidAt);
      if (Number.isNaN(paidForDate.getTime()) || Number.isNaN(paidAtDate.getTime())) {
        continue;
      }
      if (paidForDate.getMonth() !== selectedMonthIdx || paidForDate.getFullYear() !== selectedYear) {
        continue;
      }
      if (!latestPaidAt || paidAtDate > latestPaidAt) {
        latestPaidAt = paidAtDate;
      }
    }

    return latestPaidAt ? latestPaidAt.toLocaleDateString("bg-BG") : null;
  };

  const getPaymentDateForYear = (player: ReportPlayer): string | null => {
    let latestPaidAt: Date | null = null;

    for (const log of player.paymentLogs ?? []) {
      const paidForDate = new Date(log.paidFor);
      const paidAtDate = new Date(log.paidAt);
      if (Number.isNaN(paidForDate.getTime()) || Number.isNaN(paidAtDate.getTime())) {
        continue;
      }
      if (paidForDate.getFullYear() !== selectedYear) {
        continue;
      }
      if (!latestPaidAt || paidAtDate > latestPaidAt) {
        latestPaidAt = paidAtDate;
      }
    }

    return latestPaidAt ? latestPaidAt.toLocaleDateString("bg-BG") : null;
  };

  const groupFiltered = players.filter((player) => {
    if (group === "all") {
      return true;
    }
    return String(player.teamGroup ?? "") === group;
  });

  const rows = groupFiltered.map((player) => {
    const paidDate = getPaymentDateForMonth(player);
    return {
      id: player.id,
      name: player.fullName,
      group: player.teamGroup,
      date: paidDate ?? "—",
      paid: Boolean(paidDate),
      isActive: player.isActive !== false,
    };
  });

  const rowsYearly = groupFiltered.map((player) => {
    const paidDate = getPaymentDateForYear(player);
    return {
      id: player.id,
      name: player.fullName,
      group: player.teamGroup,
      date: paidDate ?? "—",
      paid: Boolean(paidDate),
      isActive: player.isActive !== false,
    };
  });

  const statsRows = rows.filter((row) => row.isActive);
  const paidCount = statsRows.filter((row) => row.paid).length;
  const total = statsRows.length;
  const pct = total > 0 ? Math.round((paidCount / total) * 100) : 0;
  const missing = total - paidCount;

  const filtered = rows.filter((row) => {
    if (statusFilter === "paid") return row.paid;
    if (statusFilter === "unpaid") return !row.paid;
    return true;
  });

  const filteredYearly = rowsYearly.filter((row) => {
    if (statusFilter === "paid") return row.paid;
    if (statusFilter === "unpaid") return !row.paid;
    return true;
  });

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const printReport = (kind: ReportKind) => {
    const baseRows = kind === "monthly" ? rows : rowsYearly;
    const rowsToPrint = kind === "monthly" ? filtered : filteredYearly;
    const paid = baseRows.filter((row) => row.paid).length;
    const totalRows = baseRows.length;
    const percent = totalRows > 0 ? Math.round((paid / totalRows) * 100) : 0;
    const unpaid = totalRows - paid;
    const periodTitle = kind === "monthly" ? `${month} ${year}` : `Година ${year}`;
    const scopeTitle = coachGroupId ? `Само за треньорска група: ${coachGroupName || "текущата група"}` : "";

    if (typeof window === "undefined" || typeof document === "undefined") return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      document.body.removeChild(iframe);
      return;
    }

    const tableRowsHtml = rowsToPrint.length > 0
      ? rowsToPrint
        .map((row, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${escapeHtml(row.name)}</td>
              <td>${row.group ?? "—"}</td>
              <td>${escapeHtml(row.date)}</td>
              <td>${row.paid ? "Платено" : "Неплатено"}</td>
            </tr>
          `)
        .join("")
      : `<tr><td colspan="5" style="text-align:center;color:#6b7280;">Няма данни за избраните филтри.</td></tr>`;

    doc.open();
    doc.write(`<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${kind === "monthly" ? "Месечен отчет" : "Годишен отчет"}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
    .page { padding: 24px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .sub { margin: 0 0 14px; color: #6b7280; font-size: 13px; }
    .stats { display: flex; gap: 12px; margin: 0 0 16px; flex-wrap: wrap; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; min-width: 140px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e5e7eb; padding: 7px 8px; text-align: left; }
    th { background: #f9fafb; }
    @page { margin: 10mm; }
  </style>
</head>
<body>
  <div class="page">
    <h1>${kind === "monthly" ? "Месечен отчет" : "Годишен отчет"}</h1>
    <p class="sub">Период: ${escapeHtml(periodTitle)}</p>
    ${scopeTitle ? `<p class="sub">${escapeHtml(scopeTitle)}</p>` : ""}
    <div class="stats">
      <div class="stat">Платили: <strong>${paid}</strong> / ${totalRows}</div>
      <div class="stat">Събираемост: <strong>${percent}%</strong></div>
      <div class="stat">Неплатили: <strong>${unpaid}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Име</th>
          <th>Набор</th>
          <th>Дата на плащане</th>
          <th>Статус</th>
        </tr>
      </thead>
      <tbody>${tableRowsHtml}</tbody>
    </table>
  </div>
</body>
</html>`);
    doc.close();

    window.setTimeout(() => {
      win.focus();
      win.print();
      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 80);
  };

  return (
    <div className="rd-overlay" onClick={onClose}>
      <div className="rd-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="rd-close" onClick={onClose} aria-label="Затвори">
          <XIcon />
        </button>

        <div className="rd-header">
          <h2 className="rd-title">
            <ChartColumnIcon size={20} />
            Център за отчети
          </h2>
          {coachGroupId && (
            <p className="rd-subtitle">
              Само за треньорска група: {coachGroupName || "текущата група"}
            </p>
          )}
        </div>

        <div className="rd-filters">
          <div className="rd-filters-left">
            <div className="rd-field">
              <label className="rd-label">Месец</label>
              <div className="rd-select-wrap">
                <select className="rd-select rd-select--w140" value={month} onChange={(e) => setMonth(e.target.value)}>
                  {MONTHS.map((m) => <option key={m}>{m}</option>)}
                </select>
                <ChevronDownIcon />
              </div>
            </div>

            <div className="rd-field">
              <label className="rd-label">Година</label>
              <div className="rd-select-wrap">
                <select className="rd-select rd-select--w100" value={year} onChange={(e) => setYear(e.target.value)}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDownIcon />
              </div>
            </div>
          </div>

          <div className="rd-field">
            <label className="rd-label">Набор</label>
            <div className="rd-select-wrap">
              <select className="rd-select rd-select--w120" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="all">Всички</option>
                {groups.map((g) => <option key={g} value={String(g)}>{g}</option>)}
              </select>
              <ChevronDownIcon />
            </div>
          </div>

          <div className="rd-field">
            <label className="rd-label">Статус</label>
            <div className="rd-seg">
              <button className={`rd-seg-btn${statusFilter === "all" ? " active" : ""}`} onClick={() => setStatusFilter("all")}>Всички</button>
              <button className={`rd-seg-btn${statusFilter === "paid" ? " active" : ""}`} onClick={() => setStatusFilter("paid")}>Платили</button>
              <button className={`rd-seg-btn${statusFilter === "unpaid" ? " active" : ""}`} onClick={() => setStatusFilter("unpaid")}>Неплатили</button>
            </div>
          </div>
        </div>

        <div className="rd-stats">
          <div className="rd-stat">
            <div className="rd-stat-label"><UsersIcon />Общо събрани такси</div>
            <div className="rd-stat-num rd-stat-num--green">
              {paidCount}<span className="rd-stat-denom">/ {total}</span>
            </div>
          </div>
          <div className="rd-stat">
            <div className="rd-stat-label"><TrendingUpIcon />Процент събираемост</div>
            <div className={`rd-stat-num ${pct >= 75 ? "rd-stat-num--green" : "rd-stat-num--red"}`}>{pct}%</div>
          </div>
          <div className="rd-stat">
            <div className="rd-stat-label"><CircleAlertIcon />Липсващи плащания</div>
            <div className="rd-stat-num rd-stat-num--red">{missing}</div>
          </div>
        </div>

        <div className="rd-table-wrap">
          <table className="rd-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Име</th>
                <th>Набор</th>
                <th>Дата на плащане</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="rd-empty-row">Зареждане...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="rd-empty-row">Няма играчи за избраните филтри.</td>
                </tr>
              )}
              {!loading && filtered.map((row, i) => (
                <tr key={row.id}>
                  <td className="rd-td-muted">{i + 1}</td>
                  <td>{row.name}</td>
                  <td className="rd-td-dim">{row.group ?? "—"}</td>
                  <td className="rd-td-dim">{row.date}</td>
                  <td>
                    <span className={`rd-badge ${row.paid ? "rd-badge--paid" : "rd-badge--unpaid"}`}>
                      {row.paid ? "Платено" : "Неплатено"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rd-footer">
          <button className="rd-footer-btn" onClick={() => printReport("monthly")}>
            <PrinterIcon />
            Генерирай месечен отчет
          </button>
          <button className="rd-footer-btn" onClick={() => printReport("yearly")}>
            <CalendarIcon />
            Генерирай годишен отчет
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Member Detail Modal ── */
function MemberDetailModalLegacy({
  member,
  onClose,
  onRequestDelete,
  onRequestEdit,
  actionMode = "active",
  onRequestReactivate,
  onRequestPermanentDelete,
  isReactivating = false,
  isDeletingPermanent = false,
}: {
  member: Member;
  onClose: () => void;
  onRequestDelete: (member: Member) => void;
  onRequestEdit: (member: Member) => void;
  actionMode?: "active" | "inactive";
  onRequestReactivate?: (member: Member) => void;
  onRequestPermanentDelete?: (member: Member) => void;
  isReactivating?: boolean;
  isDeletingPermanent?: boolean;
}) {
  const s = getStatusMeta(member.status);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const paymentHistory = [...(member.paymentLogs ?? [])].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
  const lastPayment = paymentHistory[0];
  const memberCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "";
  const memberClubId = member.club?.id ?? "";
  const memberId = member.id;
  const activeCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "Няма активна карта";

  return (
    <div className="amp-overlay" onClick={onClose}>
      <div className="amp-modal" onClick={e => e.stopPropagation()}>

        {/* green tint */}
        <div className="amp-modal-tint" aria-hidden="true" />

        {/* Title */}
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">{member.fullName} - Статистика</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори">
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">

          {/* Info card — 2-col grid */}
          <div className="amp-info-card">

            <div className="amp-info-cell">
              <UserIcon />
              <div>
                <p className="amp-lbl">Име</p>
                <p className="amp-val">{member.fullName}</p>
              </div>
            </div>

            {/* Row 1 col 2: Набор */}
            <div className="amp-info-cell">
              <span className="amp-lbl">Набор:</span>
              <span className="amp-val">{member.teamGroup ?? "—"}</span>
            </div>

            {/* Row 2 col 1: Статус */}
            <div className="amp-info-cell">
              <span className="amp-lbl">Статус:</span>
              <span className="amp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                {s.label}
              </span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Активна карта:</span>
              <span className="amp-val">{activeCardCode}</span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Телефон родител:</span>
              <span className="amp-val">{member.parentPhone ?? "Не е посочен"}</span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Телефон играч:</span>
              <span className="amp-val">{member.playerPhone ?? "Не е посочен"}</span>
            </div>

            {/* Row 3 full: Последно плащане */}
            <div className="amp-info-cell amp-info-cell--full">
              <CalendarIcon />
              <div>
                <p className="amp-lbl">Последно плащане</p>
                <p className="amp-val">
                  {lastPayment
                    ? new Date(lastPayment.paidAt).toLocaleDateString("bg-BG") + " г."
                    : "Няма плащания"}
                </p>
              </div>
            </div>

          </div>

          {/* Accordion */}
          <div className="amp-acc">
            <button className="amp-acc-trigger" onClick={() => setHistoryOpen(v => !v)}>
              <span>История на плащанията</span>
              <span className={`amp-acc-chevron${historyOpen ? " open" : ""}`}><ChevronDownIcon /></span>
            </button>
            <div className={`amp-acc-body${historyOpen ? " open" : ""}`}>
              <div className="amp-acc-inner">
                {paymentHistory.length === 0 ? (
                  <div className="amp-acc-empty">
                    <ReceiptIcon />
                    <p>Все още няма регистрирани плащания</p>
                  </div>
                ) : (
                  <div className="amp-acc-list">
                    {paymentHistory.map((p) => (
                      <div key={p.id} className="amp-acc-row">
                        <span className="amp-acc-period">{p.paidFor}</span>
                        <span className="amp-acc-date">{new Date(p.paidAt).toLocaleDateString("bg-BG")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="amp-modal-actions amp-modal-actions--end">
            {actionMode === "active" ? (
              <>
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => onRequestEdit(member)}
                >
                  Редактирай
                </button>
                <button
                  className="amp-btn amp-btn--danger"
                  onClick={() => onRequestDelete(member)}
                >
                  Премахни играч
                </button>
              </>
            ) : (
              <>
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => onRequestReactivate?.(member)}
                  disabled={isReactivating || isDeletingPermanent}
                >
                  {isReactivating ? "Възстановяване..." : "Възстанови"}
                </button>
                <button
                  className="amp-btn amp-btn--danger"
                  onClick={() => onRequestPermanentDelete?.(member)}
                  disabled={isReactivating || isDeletingPermanent}
                >
                  {isDeletingPermanent ? "Изтриване..." : "Изтрий"}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Confirm Delete Modal ── */
function MemberDetailModal({
  member,
  onClose,
  onRequestDelete,
  onRequestEdit,
  actionMode = "active",
  onRequestReactivate,
  onRequestPermanentDelete,
  isReactivating = false,
  isDeletingPermanent = false,
  coachGroups,
  onCoachGroupAssigned,
}: {
  member: Member;
  onClose: () => void;
  onRequestDelete: (member: Member) => void;
  onRequestEdit: (member: Member) => void;
  actionMode?: "active" | "inactive";
  onRequestReactivate?: (member: Member) => void;
  onRequestPermanentDelete?: (member: Member) => void;
  isReactivating?: boolean;
  isDeletingPermanent?: boolean;
  coachGroups?: CoachGroup[];
  onCoachGroupAssigned?: (memberId: string, coachGroupId: string | null) => void;
}) {
  const s = getStatusMeta(member.status);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [assignCoachGroupValue, setAssignCoachGroupValue] = useState<string | null>(member.coachGroupId);
  const [assignCoachGroupSaving, setAssignCoachGroupSaving] = useState(false);
  const [assignCoachGroupError, setAssignCoachGroupError] = useState("");
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const paymentHistory = [...(member.paymentLogs ?? [])].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
  const lastPayment = paymentHistory[0];
  const memberCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "";
  const activeCardCode = memberCardCode || "Няма активна карта";
  const memberClubId = member.club?.id ?? "";
  const memberId = member.id;

  const fetchNotifications = async () => {
    if (!memberClubId || !memberId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setNotificationsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(memberClubId)}/notifications?playerId=${encodeURIComponent(memberId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload.unreadCount ?? 0));
    } catch (error) {
      console.error("Failed to fetch member notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationsRead = async () => {
    if (!memberClubId || !memberId) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(memberClubId)}/notifications/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId: memberId }),
      });
      if (!response.ok) {
        return;
      }

      const nowIso = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? nowIso })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark member notifications as read:", error);
    }
  };

  const handleOpenNotificationsPanel = async () => {
    setNotificationsPanelOpen(true);
    await fetchNotifications();
    await markNotificationsRead();
  };

  useEffect(() => {
    let cancelled = false;

    const fetchUnread = async () => {
      if (!memberClubId || !memberId) {
        setUnreadCount(0);
        return;
      }

      try {
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(memberClubId)}/notifications?playerId=${encodeURIComponent(memberId)}`,
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) {
          return;
        }
        const payload = await response.json();
        setUnreadCount(Number(payload.unreadCount ?? 0));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch member unread notifications:", error);
        }
      }
    };

    void fetchUnread();
    return () => {
      cancelled = true;
    };
  }, [memberClubId, memberId]);

  return (
    <div className="amp-overlay" onClick={onClose}>
      <div className="amp-modal" onClick={e => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />

        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">{member.fullName} - Статистика</span>
          <div className="amp-modal-title-actions">
            <button
              className="amp-member-bell-btn"
              onClick={() => void handleOpenNotificationsPanel()}
              aria-label="Известия"
              disabled={!memberClubId || !memberId}
            >
              <BellIcon />
              {unreadCount > 0 ? (
                <span className="amp-member-bell-dot">{unreadCount > 99 ? "99+" : unreadCount}</span>
              ) : null}
            </button>
            <button className="amp-modal-close" onClick={onClose} aria-label="Затвори">
              <XIcon />
            </button>
          </div>
        </h2>

        <div className="amp-modal-body">
          <div className="amp-info-card">
            <div className="amp-info-cell">
              <UserIcon />
              <div>
                <p className="amp-lbl">Име</p>
                <p className="amp-val">{member.fullName}</p>
              </div>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Набор:</span>
              <span className="amp-val">{member.teamGroup ?? "-"}</span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Статус:</span>
              <span className="amp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                {s.label}
              </span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Активна карта:</span>
              <span className="amp-val">{activeCardCode}</span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Телефон родител:</span>
              <span className="amp-val">{member.parentPhone ?? "Не е посочен"}</span>
            </div>

            <div className="amp-info-cell">
              <span className="amp-lbl">Телефон играч:</span>
              <span className="amp-val">{member.playerPhone ?? "Не е посочен"}</span>
            </div>

            <div className="amp-info-cell amp-info-cell--full">
              <CalendarIcon />
              <div>
                <p className="amp-lbl">Последно плащане</p>
                <p className="amp-val">
                  {lastPayment
                    ? new Date(lastPayment.paidAt).toLocaleDateString("bg-BG") + " г."
                    : "Няма плащания"}
                </p>
              </div>
            </div>

            {coachGroups && coachGroups.length > 0 && actionMode === "active" && (
              <div className="amp-info-cell amp-info-cell--full">
                <div style={{ width: "100%" }}>
                  <p className="amp-lbl" style={{ marginBottom: "6px" }}>Треньорска група</p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <select
                      className="amp-edit-input"
                      value={assignCoachGroupValue ?? ""}
                      onChange={(e) => { setAssignCoachGroupValue(e.target.value || null); setAssignCoachGroupError(""); }}
                      disabled={assignCoachGroupSaving}
                      style={{ flex: 1 }}
                    >
                      <option value="">Без група</option>
                      {coachGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="amp-btn amp-btn--ghost amp-btn--compact"
                      disabled={assignCoachGroupSaving || assignCoachGroupValue === member.coachGroupId}
                      onClick={async () => {
                        setAssignCoachGroupSaving(true);
                        setAssignCoachGroupError("");
                        try {
                          const response = await fetch(`/api/admin/members/${encodeURIComponent(member.id)}/coach-group`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ coachGroupId: assignCoachGroupValue }),
                          });
                          if (!response.ok) {
                            const payload = await response.json().catch(() => ({}));
                            throw new Error(String((payload as { error?: unknown }).error ?? "Грешка"));
                          }
                          onCoachGroupAssigned?.(member.id, assignCoachGroupValue);
                        } catch (err) {
                          setAssignCoachGroupError(err instanceof Error ? err.message : "Грешка");
                        } finally {
                          setAssignCoachGroupSaving(false);
                        }
                      }}
                    >
                      {assignCoachGroupSaving ? "..." : "Запиши"}
                    </button>
                  </div>
                  {assignCoachGroupError && <p className="amp-confirm-error" style={{ marginTop: "6px", marginBottom: 0 }}>{assignCoachGroupError}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="amp-acc">
            <button className="amp-acc-trigger" onClick={() => setHistoryOpen((v) => !v)}>
              <span>История на плащанията</span>
              <span className={`amp-acc-chevron${historyOpen ? " open" : ""}`}><ChevronDownIcon /></span>
            </button>
            <div className={`amp-acc-body${historyOpen ? " open" : ""}`}>
              <div className="amp-acc-inner">
                {paymentHistory.length === 0 ? (
                  <div className="amp-acc-empty">
                    <ReceiptIcon />
                    <p>Все още няма регистрирани плащания</p>
                  </div>
                ) : (
                  <div className="amp-acc-list">
                    {paymentHistory.map((p) => (
                      <div key={p.id} className="amp-acc-row">
                        <span className="amp-acc-period">{p.paidFor}</span>
                        <span className="amp-acc-date">{new Date(p.paidAt).toLocaleDateString("bg-BG")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="amp-modal-actions amp-modal-actions--end">
            {actionMode === "active" ? (
              <>
                <button className="amp-btn amp-btn--ghost" onClick={() => onRequestEdit(member)}>
                  Редактирай
                </button>
                <button className="amp-btn amp-btn--danger" onClick={() => onRequestDelete(member)}>
                  Премахни играч
                </button>
              </>
            ) : (
              <>
                <button
                  className="amp-btn amp-btn--ghost"
                  onClick={() => onRequestReactivate?.(member)}
                  disabled={isReactivating || isDeletingPermanent}
                >
                  {isReactivating ? "Възстановяване..." : "Възстанови"}
                </button>
                <button
                  className="amp-btn amp-btn--danger"
                  onClick={() => onRequestPermanentDelete?.(member)}
                  disabled={isReactivating || isDeletingPermanent}
                >
                  {isDeletingPermanent ? "Изтриване..." : "Изтрий"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {notificationsPanelOpen ? (
        <div className="amp-overlay amp-overlay--member-notifications" onClick={() => setNotificationsPanelOpen(false)}>
          <div className="amp-modal amp-modal--member-notifications" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Известия</span>
              <button className="amp-modal-close" onClick={() => setNotificationsPanelOpen(false)} aria-label="Затвори">
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {notificationsLoading ? (
                <p className="amp-empty amp-empty--modal">Зареждане...</p>
              ) : notifications.length === 0 ? (
                <p className="amp-empty amp-empty--modal">Няма известия</p>
              ) : (
                <div className="amp-member-notifications-list">
                  {notifications.map((notif) => (
                    <article
                      key={notif.id}
                      className={`amp-member-notification-item${notif.readAt ? "" : " amp-member-notification-item--unread"}`}
                    >
                      <div className="amp-member-notification-head">
                        <h3>{notif.title}</h3>
                        {!notif.readAt ? <span className="amp-member-notification-new" aria-label="Ново" /> : null}
                      </div>
                      <p>{notif.body}</p>
                      <div className="amp-member-notification-meta">
                        {typeof notif.teamGroup === "number" ? <span>Набор: {notif.teamGroup}</span> : null}
                        {Array.isArray(notif.trainingGroups) && notif.trainingGroups.length > 0 ? (
                          <span>Сборен отбор: {notif.trainingGroups.map((group) => group.name).join(", ")}</span>
                        ) : null}
                      </div>
                      <time dateTime={notif.sentAt}>
                        {new Date(notif.sentAt).toLocaleDateString("bg-BG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConfirmDeleteModal({
  member,
  onCancel,
  onConfirm,
  isDeleting,
  error,
}: {
  member: Member;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error: string;
}) {
  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isDeleting ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди премахване</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да премахнеш <strong>{member.fullName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            грачът ще бъде маркиран като неактивен.
          </p>

          {error && <p className="amp-confirm-error">{error}</p>}

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Премахване..." : "Премахни"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Player Card ── */
function PlayerCard({
  member,
  onClick,
  actionMode = "profile",
  isActionLoading = false,
  onReactivate,
  isDeleteLoading = false,
  onPermanentDelete,
  coachGroupName,
}: {
  member: Member;
  onClick: () => void;
  actionMode?: "profile" | "reactivate";
  isActionLoading?: boolean;
  onReactivate?: () => void;
  isDeleteLoading?: boolean;
  onPermanentDelete?: () => void;
  coachGroupName?: string | null;
}) {
  const router = useRouter();
  const s = getStatusMeta(member.status);
  const initial = member.fullName.trim().charAt(0).toUpperCase() || "?";
  const needsAction = member.status === "overdue" || member.status === "warning";
  const cardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "";

  return (
    <div className="pc-card" onClick={onClick}>
      <div className="pc-shimmer" aria-hidden="true" />
      <div className="pc-content">
        {/* Avatar */}
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt={member.fullName} className="pc-avatar pc-avatar--img" />
        ) : (
          <div className="pc-avatar" style={{ color: s.color, background: s.bg, borderColor: s.border }}>
            <span className="pc-avatar-letter">{initial}</span>
          </div>
        )}

        {/* Name + badge */}
        <div className="pc-info">
          <div className="pc-name-container">
            {member.fullName.split(' ').map((part, index) => (
              <span key={index} className="pc-name-row">{part}</span>
            ))}
          </div>
          <div className="pc-badges">
            <span className="amp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
              {s.label}
            </span>
            {coachGroupName && (
              <span className="amp-badge" style={{ color: "#6366f1", background: "#ede9fe", border: "1px solid #c4b5fd", fontSize: "0.7rem" }}>
                {coachGroupName}
              </span>
            )}
          </div>
        </div>

        <div className="pc-actions">
          {actionMode === "profile" && cardCode && (
            <button
              type="button"
              className="pc-profile-btn"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/member/${encodeURIComponent(cardCode)}`);
              }}
            >
              профил
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

function InactivePlayersModal({
  members,
  isReactivating,
  reactivatingMemberId,
  isDeletingPermanent,
  deletingPermanentMemberId,
  error,
  onClose,
  onSelectMember,
  onReactivate,
  onPermanentDelete,
}: {
  members: Member[];
  isReactivating: boolean;
  reactivatingMemberId: string | null;
  isDeletingPermanent: boolean;
  deletingPermanentMemberId: string | null;
  error: string;
  onClose: () => void;
  onSelectMember: (member: Member) => void;
  onReactivate: (member: Member) => void;
  onPermanentDelete: (member: Member) => void;
}) {
  return (
    <div className="amp-overlay" onClick={onClose}>
      <div className="amp-modal amp-modal--inactive" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Неактивни играчи</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори">
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          {error && <p className="amp-confirm-error">{error}</p>}
          {members.length === 0 ? (
            <p className="amp-empty amp-empty--modal">Няма неактивни играчи</p>
          ) : (
            <div className="amp-cards">
              {members.map((member) => (
                <PlayerCard
                  key={member.id}
                  member={member}
                  onClick={() => onSelectMember(member)}
                  actionMode="reactivate"
                  isActionLoading={isReactivating && reactivatingMemberId === member.id}
                  onReactivate={() => onReactivate(member)}
                  isDeleteLoading={isDeletingPermanent && deletingPermanentMemberId === member.id}
                  onPermanentDelete={() => onPermanentDelete(member)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmPermanentDeleteModal({
  member,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  member: Member;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isDeleting ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди изтриване завинаги</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да изтриеш завинаги <strong>{member.fullName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            Това действие е необратимо и ще премахне играча и свързаните данни.
          </p>

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Изтриване..." : "Изтрий завинаги"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteTeamModal({
  teamName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  teamName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isDeleting ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди изтриване на отбор</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да изтриеш <strong>{teamName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            Това действие е необратимо и ще изтрие всички играчи, снимки, плащания, карти и свързани записи.
          </p>

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Изтриване..." : "Изтрий отбора"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportFromSheetsModal({
  clubId,
  onClose,
  onImported,
}: {
  clubId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<ImportStep>("browse");
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [driveItems, setDriveItems] = useState<{ folders: DriveItem[]; sheets: DriveItem[] } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<DriveItem | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedPlayerRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  // Auto-load root folder on mount
  useEffect(() => {
    void loadDriveFolder("root");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDriveFolder(folderId: string) {
    setDriveLoading(true);
    setDriveError("");
    try {
      const res = await fetch(`/api/admin/google/drive?folderId=${encodeURIComponent(folderId)}`);
      const data = (await res.json().catch(() => ({}))) as { folders?: DriveItem[]; sheets?: DriveItem[]; error?: string };
      if (!res.ok) {
        setDriveError(data.error ?? "Грешка при зареждане на Drive.");
        return;
      }
      setDriveItems({ folders: data.folders ?? [], sheets: data.sheets ?? [] });
    } catch {
      setDriveError("Грешка при свързване.");
    } finally {
      setDriveLoading(false);
    }
  }

  function navigateIntoFolder(folder: DriveItem) {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    void loadDriveFolder(folder.id);
  }

  function navigateToStackIndex(index: number) {
    const newStack = folderStack.slice(0, index);
    setFolderStack(newStack);
    const folderId = newStack.length > 0 ? newStack[newStack.length - 1].id : "root";
    void loadDriveFolder(folderId);
  }

  async function selectSheet(sheet: DriveItem) {
    setSelectedSheet(sheet);
    setPreviewLoading(true);
    setPreviewError("");
    setStep("preview");
    try {
      const res = await fetch(
        `/api/admin/members/import-sheets?spreadsheetId=${encodeURIComponent(sheet.id)}`,
      );
      const data = (await res.json()) as { rows?: ParsedPlayerRow[]; error?: string };
      if (!res.ok) {
        setPreviewError(data.error ?? "Грешка при четене на таблицата.");
        return;
      }
      setPreviewRows(data.rows ?? []);
    } catch {
      setPreviewError("Грешка при свързване.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runImport() {
    if (!selectedSheet) return;
    setStep("importing");
    setImportError("");
    try {
      const res = await fetch("/api/admin/members/import-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId: selectedSheet.id, clubId }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        setImportError(data.error ?? "Грешката при импортиране.");
        setStep("preview");
        return;
      }
      setImportResult(data);
      setStep("results");
      onImported();
    } catch {
      setImportError("Грешка при свързване.");
      setStep("preview");
    }
  }

  const validRowCount = previewRows.filter((r) => !r.warning || r.birthDateIso).length;

  return (
    <div className="amp-overlay" onClick={step === "importing" ? undefined : onClose}>
      <div className="amp-modal amp-modal--import-sheets" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Импорт от Google Sheets</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори" disabled={step === "importing"}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">

          {/* ── Browse step ── */}
          {step === "browse" && (
            <div className="amp-import-browse">
              {/* Breadcrumb */}
              <div className="amp-drive-breadcrumb">
                <button
                  className="amp-drive-crumb"
                  onClick={() => navigateToStackIndex(0)}
                  type="button"
                >
                  My Drive
                </button>
                {folderStack.map((folder, idx) => (
                  <span key={folder.id} className="amp-drive-crumb-sep">
                    <span className="amp-drive-crumb-arrow">›</span>
                    <button
                      className="amp-drive-crumb"
                      onClick={() => navigateToStackIndex(idx + 1)}
                      type="button"
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {driveError && <p className="amp-confirm-error" style={{ margin: "8px 0" }}>{driveError}</p>}

              {driveLoading ? (
                <div className="amp-import-loading">
                  <SpinnerIcon size={20} />
                  <span>Зареждане...</span>
                </div>
              ) : (
                <div className="amp-drive-list">
                  {(!driveItems || (driveItems.folders.length === 0 && driveItems.sheets.length === 0)) && (
                    <p className="amp-empty" style={{ padding: "16px 0" }}>Няма папки или таблици тук.</p>
                  )}
                  {driveItems?.folders.map((folder) => (
                    <button
                      key={folder.id}
                      className="amp-drive-item amp-drive-item--folder"
                      onClick={() => navigateIntoFolder(folder)}
                      type="button"
                    >
                      <FolderIcon />
                      <span>{folder.name}</span>
                    </button>
                  ))}
                  {driveItems?.sheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      className="amp-drive-item amp-drive-item--sheet"
                      onClick={() => void selectSheet(sheet)}
                      type="button"
                    >
                      <SheetFileIcon />
                      <span>{sheet.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Preview step ── */}
          {step === "preview" && (
            <div className="amp-import-preview">
              <p className="amp-import-sheet-name">
                <SheetFileIcon />
                <strong>{selectedSheet?.name}</strong>
              </p>

              {previewLoading && (
                <div className="amp-import-loading">
                  <SpinnerIcon size={20} />
                  <span>Четене на таблицата...</span>
                </div>
              )}

              {previewError && <p className="amp-confirm-error">{previewError}</p>}

              {!previewLoading && !previewError && previewRows.length === 0 && (
                <p className="amp-empty">Не са намерени редове с данни.</p>
              )}

              {!previewLoading && !previewError && previewRows.length > 0 && (
                <>
                  <p className="amp-import-row-count">
                    {validRowCount} от {previewRows.length} реда ще бъдат импортирани
                    {previewRows.some((r) => r.warning) && (
                      <span className="amp-import-warn-count"> · {previewRows.filter((r) => r.warning).length} с предупреждения</span>
                    )}
                  </p>
                  <div className="amp-preview-table-wrap">
                    <table className="amp-preview-table">
                      <thead>
                        <tr>
                          <th>Ime</th>
                          <th>Роден</th>
                          <th>№</th>
                          <th>Отбор</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr key={row.rowIndex} className={row.warning ? "amp-preview-row--warn" : ""}>
                            <td>{row.fullName}</td>
                            <td>{row.birthDateIso ? new Date(row.birthDateIso).toLocaleDateString("bg-BG") : <span className="amp-preview-missing">{row.warning ?? "—"}</span>}</td>
                            <td>{row.jerseyNumber ?? "—"}</td>
                            <td>{row.teamGroup ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importError && <p className="amp-confirm-error" style={{ marginTop: 8 }}>{importError}</p>}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button
                  className="amp-btn amp-btn--ghost"
                  type="button"
                  onClick={() => { setStep("browse"); setPreviewError(""); setImportError(""); }}
                >
                  Назад
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={() => void runImport()}
                  disabled={previewLoading || validRowCount === 0}
                >
                  Импортирай {validRowCount > 0 ? `${validRowCount} играча` : ""}
                </button>
              </div>
            </div>
          )}

          {/* ── Importing step ── */}
          {step === "importing" && (
            <div className="amp-import-loading amp-import-loading--center">
              <SpinnerIcon size={28} />
              <span>Импортиране...</span>
            </div>
          )}

          {/* ── Results step ── */}
          {step === "results" && importResult && (
            <div className="amp-import-results">
              <div className="amp-import-result-stats">
                <div className="amp-import-stat amp-import-stat--created">
                  <span className="amp-import-stat-num">{importResult.created}</span>
                  <span className="amp-import-stat-lbl">Добавени</span>
                </div>
                <div className="amp-import-stat amp-import-stat--skipped">
                  <span className="amp-import-stat-num">{importResult.skipped}</span>
                  <span className="amp-import-stat-lbl">Пропуснати</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="amp-import-errors">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setErrorsExpanded((v) => !v)}
                  >
                    {errorsExpanded ? "▲" : "▼"} {importResult.errors.length} грешки
                  </button>
                  {errorsExpanded && (
                    <ul className="amp-import-errors-list">
                      {importResult.errors.map((e) => (
                        <li key={e.row}>
                          <span className="amp-import-err-row">Ред {e.row}</span> {e.name} — {e.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button className="amp-btn amp-btn--primary" type="button" onClick={onClose}>
                  Затвори
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ── Import Photos From Drive Modal ── */

function ImportPhotosFromDriveModal({
  clubId,
  onClose,
  onImported,
}: {
  clubId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<PhotoImportStep>("browse");
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [driveItems, setDriveItems] = useState<{ folders: DriveItem[]; sheets: DriveItem[]; images: DriveItem[] } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [importResult, setImportResult] = useState<PhotoImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [detailsExpanded, setDetailsExpanded] = useState<"unmatched" | "ambiguous" | "failed" | null>(null);

  useEffect(() => {
    void loadDriveFolder("root");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDriveFolder(folderId: string) {
    setDriveLoading(true);
    setDriveError("");
    try {
      const res = await fetch(`/api/admin/google/drive?folderId=${encodeURIComponent(folderId)}&mode=photos`);
      const data = (await res.json().catch(() => ({}))) as { folders?: DriveItem[]; sheets?: DriveItem[]; images?: DriveItem[]; error?: string };
      if (!res.ok) {
        setDriveError(data.error ?? "Грешка при зареждане на Drive.");
        return;
      }
      setDriveItems({ folders: data.folders ?? [], sheets: [], images: data.images ?? [] });
    } catch {
      setDriveError("Грешка при свързване.");
    } finally {
      setDriveLoading(false);
    }
  }

  function navigateIntoFolder(folder: DriveItem) {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    void loadDriveFolder(folder.id);
  }

  function navigateToStackIndex(index: number) {
    const newStack = folderStack.slice(0, index);
    setFolderStack(newStack);
    const folderId = newStack.length > 0 ? newStack[newStack.length - 1].id : "root";
    void loadDriveFolder(folderId);
  }

  function selectCurrentFolder() {
    if (folderStack.length === 0) return;
    const current = folderStack[folderStack.length - 1];
    setSelectedFolder(current);
    setStep("confirm");
  }

  async function runImport() {
    if (!selectedFolder) return;
    setStep("importing");
    setImportError("");
    try {
      const res = await fetch("/api/admin/members/import-drive-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: selectedFolder.id, clubId, overwrite }),
      });
      const data = (await res.json()) as PhotoImportResult & { error?: string };
      if (!res.ok) {
        setImportError(data.error ?? "Грешка при импортиране.");
        setStep("confirm");
        return;
      }
      setImportResult(data);
      setStep("results");
      onImported();
    } catch {
      setImportError("Грешка при свързване.");
      setStep("confirm");
    }
  }

  return (
    <div className="amp-overlay" onClick={step === "importing" ? undefined : onClose}>
      <div className="amp-modal amp-modal--import-sheets" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Импорт на снимки от Google Drive</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори" disabled={step === "importing"}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">

          {/* ── Browse step ── */}
          {step === "browse" && (
            <div className="amp-import-browse">
              <div className="amp-drive-breadcrumb">
                <button
                  className="amp-drive-crumb"
                  onClick={() => navigateToStackIndex(0)}
                  type="button"
                >
                  My Drive
                </button>
                {folderStack.map((folder, idx) => (
                  <span key={folder.id} className="amp-drive-crumb-sep">
                    <span className="amp-drive-crumb-arrow">›</span>
                    <button
                      className="amp-drive-crumb"
                      onClick={() => navigateToStackIndex(idx + 1)}
                      type="button"
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {driveError && <p className="amp-confirm-error" style={{ margin: "8px 0" }}>{driveError}</p>}

              {driveLoading ? (
                <div className="amp-import-loading">
                  <SpinnerIcon size={20} />
                  <span>Зареждане...</span>
                </div>
              ) : (
                <div className="amp-drive-list">
                  {(!driveItems || (driveItems.folders.length === 0 && driveItems.images.length === 0)) && (
                    <p className="amp-empty" style={{ padding: "16px 0" }}>Няма папки или снимки тук.</p>
                  )}
                  {driveItems?.folders.map((folder) => (
                    <button
                      key={folder.id}
                      className="amp-drive-item amp-drive-item--folder"
                      onClick={() => navigateIntoFolder(folder)}
                      type="button"
                    >
                      <FolderIcon />
                      <span>{folder.name}</span>
                    </button>
                  ))}
                  {driveItems?.images.map((img) => (
                    <div
                      key={img.id}
                      className="amp-drive-item amp-drive-item--file"
                    >
                      <PhotoImportIcon size={14} />
                      <span>{img.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={selectCurrentFolder}
                  disabled={folderStack.length === 0 || driveLoading}
                >
                  Избери тази папка
                </button>
              </div>
            </div>
          )}

          {/* ── Confirm step ── */}
          {step === "confirm" && selectedFolder && (
            <div className="amp-import-preview">
              <p className="amp-import-folder-name">
                <FolderIcon />
                <strong>{selectedFolder.name}</strong>
              </p>
              <p className="amp-import-confirm-hint">
                Снимките в тази папка ще бъдат съпоставени с играчите по име на файл.
              </p>
              <label className="amp-import-overwrite-label">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                Презапиши съществуващи снимки
              </label>

              {importError && <p className="amp-confirm-error" style={{ marginTop: 8 }}>{importError}</p>}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button
                  className="amp-btn amp-btn--ghost"
                  type="button"
                  onClick={() => { setStep("browse"); setImportError(""); }}
                >
                  Назад
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={() => void runImport()}
                >
                  Импортирай снимките
                </button>
              </div>
            </div>
          )}

          {/* ── Importing step ── */}
          {step === "importing" && (
            <div className="amp-import-loading amp-import-loading--center">
              <SpinnerIcon size={28} />
              <span>Импортиране на снимки...</span>
            </div>
          )}

          {/* ── Results step ── */}
          {step === "results" && importResult && (
            <div className="amp-import-results">
              <div className="amp-import-result-stats amp-import-result-stats--wrap">
                <div className="amp-import-stat amp-import-stat--created">
                  <span className="amp-import-stat-num">{importResult.updated}</span>
                  <span className="amp-import-stat-lbl">Обновени</span>
                </div>
                <div className="amp-import-stat amp-import-stat--skipped">
                  <span className="amp-import-stat-num">{importResult.skippedExisting}</span>
                  <span className="amp-import-stat-lbl">Пропуснати</span>
                </div>
                <div className="amp-import-stat amp-import-stat--warning">
                  <span className="amp-import-stat-num">{importResult.unmatched}</span>
                  <span className="amp-import-stat-lbl">Несъвпадащи</span>
                </div>
                {importResult.failedUploads > 0 && (
                  <div className="amp-import-stat amp-import-stat--error">
                    <span className="amp-import-stat-num">{importResult.failedUploads}</span>
                    <span className="amp-import-stat-lbl">Грешки</span>
                  </div>
                )}
              </div>

              {importResult.details.unmatchedFiles.length > 0 && (
                <div className="amp-import-errors amp-import-errors--warning">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setDetailsExpanded((v) => v === "unmatched" ? null : "unmatched")}
                  >
                    {detailsExpanded === "unmatched" ? "▲" : "▼"} {importResult.details.unmatchedFiles.length} несъвпадащи файла
                  </button>
                  {detailsExpanded === "unmatched" && (
                    <ul className="amp-import-errors-list">
                      {importResult.details.unmatchedFiles.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {importResult.details.ambiguousFiles.length > 0 && (
                <div className="amp-import-errors amp-import-errors--warning">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setDetailsExpanded((v) => v === "ambiguous" ? null : "ambiguous")}
                  >
                    {detailsExpanded === "ambiguous" ? "▲" : "▼"} {importResult.details.ambiguousFiles.length} двусмислени файла
                  </button>
                  {detailsExpanded === "ambiguous" && (
                    <ul className="amp-import-errors-list">
                      {importResult.details.ambiguousFiles.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {importResult.details.failedFiles.length > 0 && (
                <div className="amp-import-errors">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setDetailsExpanded((v) => v === "failed" ? null : "failed")}
                  >
                    {detailsExpanded === "failed" ? "▲" : "▼"} {importResult.details.failedFiles.length} неуспешни качвания
                  </button>
                  {detailsExpanded === "failed" && (
                    <ul className="amp-import-errors-list">
                      {importResult.details.failedFiles.map((f) => (
                        <li key={f.fileName}>
                          <span className="amp-import-err-row">{f.fileName}</span> — {f.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button className="amp-btn amp-btn--primary" type="button" onClick={onClose}>
                  Затвори
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteTrainingGroupModal({
  groupName,
  isCustomGroup,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  groupName: string;
  isCustomGroup: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const subject = isCustomGroup ? "група" : "сборен отбор";
  const subjectWithArticle = isCustomGroup ? "групата" : "сборния отбор";
  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isDeleting ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">{`Потвърди изтриване на ${subject}`}</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да изтриеш <strong>{groupName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            {`Това действие е необратимо и ще премахне ${subjectWithArticle} и свързаните тренировъчни дни.`}
          </p>

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Изтриване..." : `Изтрий ${subjectWithArticle}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmNewCardModal({
  member,
  onCancel,
  onConfirm,
  isAssigning,
}: {
  member: Member;
  onCancel: () => void;
  onConfirm: () => void;
  isAssigning: boolean;
}) {
  const currentCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.cards[0]?.cardCode ||
    "Няма активна карта";

  return (
    <div className="amp-overlay amp-overlay--confirm" onClick={isAssigning ? undefined : onCancel}>
      <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди нова карта</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isAssigning}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да генерираш нова карта за <strong>{member.fullName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            Текущата активна карта <strong>{currentCardCode}</strong> ще бъде автоматично деактивирана.
          </p>

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isAssigning}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--primary" onClick={onConfirm} disabled={isAssigning}>
              {isAssigning ? "Генериране..." : "Генерирай нова карта"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  AttendanceDashboard,
  ReportsDialog,
  MemberDetailModal,
  ConfirmDeleteModal,
  PlayerCard,
  InactivePlayersModal,
  ConfirmPermanentDeleteModal,
  ConfirmDeleteTeamModal,
  ImportFromSheetsModal,
  ImportPhotosFromDriveModal,
  ConfirmDeleteTrainingGroupModal,
  ConfirmNewCardModal,
};

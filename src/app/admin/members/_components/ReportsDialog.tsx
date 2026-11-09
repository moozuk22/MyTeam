"use client";

import { useEffect, useState } from "react";
import { buildYearlyPaymentReport, formatRecordedPaymentAmounts } from "@/lib/yearlyPaymentReport";
import { type ReportKind, type ReportPlayer } from "../_types/members-page-types";
import { MONTHS } from "../_utils/members-page-utils";
import { CalendarIcon, ChartColumnIcon, ChevronDownIcon, CircleAlertIcon, PrinterIcon, TrendingUpIcon, UsersIcon, XIcon } from "./members-page-icons";
import { sortByName } from "../_utils/members-page-utils";

export function ReportsDialog({
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

  const now = new Date();
  const [month, setMonth] = useState(MONTHS[now.getMonth()] ?? MONTHS[0]);
  const [year, setYear] = useState(String(Math.max(2026, now.getFullYear())));
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [players, setPlayers] = useState<ReportPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachGroupsList, setCoachGroupsList] = useState<Array<{ id: string; name: string }>>([]);
  const [filterCoachGroupId, setFilterCoachGroupId] = useState(coachGroupId);
  const [customTrainingGroupsList, setCustomTrainingGroupsList] = useState<Array<{ id: string; name: string }>>([]);
  const [filterCustomGroupId, setFilterCustomGroupId] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [playerMenuOpen, setPlayerMenuOpen] = useState(false);
  const [activePlayerOption, setActivePlayerOption] = useState(0);

  useEffect(() => {
    if (!clubId) return;
    const fetchCoachGroups = async () => {
      try {
        const res = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups`, { cache: "no-store" });
        if (!res.ok) return;
        const payload: unknown = await res.json();
        const cgs = Array.isArray(payload)
          ? payload
            .map((item) => {
              const r = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
              return { id: String(r.id ?? ""), name: String(r.name ?? "").trim() };
            })
            .filter((g) => g.id && g.name)
          : [];
        setCoachGroupsList(sortByName(cgs));
      } catch {
        // silent
      }
    };
    void fetchCoachGroups();
  }, [clubId]);

  useEffect(() => {
    if (!filterCoachGroupId) {
      setCustomTrainingGroupsList([]);
      setFilterCustomGroupId("");
      return;
    }
    const fetchCustomGroups = async () => {
      try {
        const res = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups?coachGroupId=${encodeURIComponent(filterCoachGroupId)}`,
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
        setCustomTrainingGroupsList(sortByName(groups));
        setFilterCustomGroupId("");
      } catch {
        // silent
      }
    };
    void fetchCustomGroups();
  }, [clubId, filterCoachGroupId]);

  useEffect(() => {
    let cancelled = false;
    setSelectedPlayerId("");
    setPlayerSearch("");
    const fetchPlayers = async () => {
      setLoading(true);
      setPlayers([]);
      try {
        const search = new URLSearchParams();
        if (clubId) {
          search.set("clubId", clubId);
        }
        if (filterCoachGroupId) {
          search.set("coachGroupId", filterCoachGroupId);
        }
        if (filterCustomGroupId) {
          search.set("customGroupId", filterCustomGroupId);
        }
        search.set("includeAllPaymentWaivers", "true");
        const endpoint = search.size ? `/api/admin/members?${search.toString()}` : "/api/admin/members";
        const response = await fetch(endpoint, { cache: "no-store" });
        if (cancelled) return;
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
                  amount: logRaw.amount == null ? null : String(logRaw.amount),
                  currency: String(logRaw.currency ?? "EUR"),
                };
              })
              : [];

            return {
              id: String(raw.id ?? ""),
              fullName: String(raw.fullName ?? ""),
              teamGroup: typeof raw.teamGroup === "number" ? raw.teamGroup : null,
              paymentAmount: raw.paymentAmount === null || raw.paymentAmount === undefined ? null : String(raw.paymentAmount),
              firstBillingMonth: raw.firstBillingMonth ? String(raw.firstBillingMonth) : null,
              paymentWorkflow: typeof raw.club === "object" && raw.club !== null
                ? String((raw.club as Record<string, unknown>).paymentWorkflow ?? "calendar_month")
                : "calendar_month",
              paymentLogs,
              paymentWaivers: Array.isArray(raw.paymentWaivers)
                ? raw.paymentWaivers.map((waiver) => ({
                    waivedFor: String(
                      typeof waiver === "object" && waiver !== null
                        ? (waiver as Record<string, unknown>).waivedFor ?? ""
                        : "",
                    ),
                  }))
                : [],
              isActive: raw.isActive === false ? false : true,
            };
          })
          : [];
        if (!cancelled) setPlayers(normalizedPlayers);
      } catch (error) {
        console.error("Error fetching report players:", error);
        if (!cancelled) setPlayers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchPlayers();
    return () => { cancelled = true; };
  }, [clubId, filterCoachGroupId, filterCustomGroupId]);

  const years = Array.from(
    { length: Math.max(1, now.getFullYear() - 2026 + 2) },
    (_, idx) => String(2026 + idx),
  );

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

  const normalizePlayerName = (name: string) =>
    name.normalize("NFC").toLocaleLowerCase("bg-BG").trim().replace(/\s+/g, " ");
  const searchTerms = normalizePlayerName(playerSearch).split(" ").filter(Boolean);
  const matchingPlayers = sortByName(
    players.filter((player) =>
      searchTerms.every((term) => normalizePlayerName(player.fullName).includes(term)),
    ).map((player) => ({ ...player, name: player.fullName })),
  );
  const reportPlayers = matchingPlayers.filter((player) =>
    !selectedPlayerId || player.id === selectedPlayerId,
  );

  const monthlyPlayers = reportPlayers.filter((player) =>
    !player.paymentWaivers.some(({ waivedFor }) => {
      const waivedDate = new Date(waivedFor);
      return waivedDate.getUTCMonth() === selectedMonthIdx &&
        waivedDate.getUTCFullYear() === selectedYear;
    }),
  );

  const rows = monthlyPlayers.map((player) => {
    const paidDate = getPaymentDateForMonth(player);
    return {
      id: player.id,
      name: player.fullName,
      group: player.teamGroup,
      amount: formatRecordedPaymentAmounts(player.paymentLogs.filter((log) => {
        const period = new Date(log.paidFor);
        const paidAt = new Date(log.paidAt);
        return period.getUTCFullYear() === selectedYear && period.getUTCMonth() === selectedMonthIdx &&
          !Number.isNaN(paidAt.getTime()) && paidAt <= now;
      })),
      date: paidDate ?? "—",
      paid: Boolean(paidDate),
      isActive: player.isActive !== false,
    };
  });

  const rowsYearly = reportPlayers.map((player) => {
    return {
      id: player.id,
      name: player.fullName,
      isActive: player.isActive !== false,
      ...buildYearlyPaymentReport(player, selectedYear, now),
    };
  });

  const paidCount = rows.filter((row) => row.paid).length;
  const total = rows.length;
  const pct = total > 0 ? Math.round((paidCount / total) * 100) : 0;
  const missing = total - paidCount;

  const filtered = rows.filter((row) => {
    if (statusFilter === "paid") return row.paid;
    if (statusFilter === "unpaid") return !row.paid;
    return true;
  });

  const filteredYearly = rowsYearly.filter((row) => {
    if (statusFilter === "paid") return row.status === "paid";
    if (statusFilter === "unpaid") return row.status === "unpaid";
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
    const yearly = kind === "yearly";
    const paid = yearly ? rowsYearly.reduce((sum, row) => sum + row.paidDueCount, 0) : paidCount;
    const totalRows = yearly ? rowsYearly.reduce((sum, row) => sum + row.dueCount, 0) : rows.length;
    const percent = totalRows > 0 ? Math.round((paid / totalRows) * 100) : 0;
    const unpaid = totalRows - paid;
    const periodTitle = kind === "monthly" ? `${month} ${year}` : `Година ${year}`;
    const activeGroupName = coachGroupsList.find((g) => g.id === filterCoachGroupId)?.name ?? coachGroupName ?? "текущата група";
    const activeCustomGroupName = customTrainingGroupsList.find((g) => g.id === filterCustomGroupId)?.name ?? "";
    const scopeTitle = filterCoachGroupId
      ? activeCustomGroupName
        ? `Треньор: ${activeGroupName} — Треньорска група: ${activeCustomGroupName}`
        : `Треньор: ${activeGroupName}`
      : "";

    if (typeof window === "undefined") return;

    const monthLabels = { paid: "Платено", unpaid: "Неплатено", exempt: "Освободен", not_due: "Не се дължи" };
    const yearlyStatusLabels = { paid: "Всички дължими такси са платени", unpaid: "Има неплатени такси", not_due: "Няма дължими такси", activity: "Платежна активност" };
    const tableRowsHtml = yearly
      ? filteredYearly.length > 0 ? filteredYearly.map((row, idx) => `
          <tr><td>${idx + 1}</td><td>${escapeHtml(row.name)}${row.isActive ? "" : " (неактивен)"}</td>
          ${row.months.map((month) => `<td>${!row.calendarBilling && month.status === "not_due" ? "—" : monthLabels[month.status]}${month.paidAt ? `<br><strong>${escapeHtml(month.amountLabel)}</strong><br><small>${escapeHtml(month.paidAt.toLocaleDateString("bg-BG", { timeZone: "Europe/Sofia" }))}</small>` : ""}</td>`).join("")}
          <td>${row.calendarBilling ? `${row.paidDueCount} / ${row.dueCount}` : "—"}</td>
          <td>${row.calendarBilling ? row.missingCount : "—"}</td><td>${escapeHtml(row.totalAmountLabel)}</td><td>${yearlyStatusLabels[row.status]}</td></tr>
        `).join("") : `<tr><td colspan="18" style="text-align:center;">Няма данни за избраните филтри.</td></tr>`
      : filtered.length > 0
      ? filtered
        .map((row, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${escapeHtml(row.name)}</td>
              <td>${escapeHtml(row.amount)}</td>
              <td>${escapeHtml(row.date)}</td>
              <td>${row.paid ? "Платено" : "Неплатено"}</td>
            </tr>
          `)
        .join("")
      : `<tr><td colspan="5" style="text-align:center;color:#6b7280;">Няма данни за избраните филтри.</td></tr>`;

    const fullHtml = `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${kind === "monthly" ? "Месечен отчет" : "Годишен отчет"} — ${escapeHtml(periodTitle)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; padding: 24px; margin: 0; }
    .pt { display: flex; gap: 8px; margin: 0 0 16px; }
    .pt button { padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
    .pt-p { background: #111827; color: #fff; border: none; }
    .pt-c { background: #f3f4f6; border: 1px solid #d1d5db; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e5e7eb; padding: 7px 8px; text-align: left; }
    th { background: #f9fafb; }
    ${yearly ? "table { font-size: 9px; } th, td { padding: 4px; }" : ""}
    @media print { .pt { display: none; } @page { ${yearly ? "size: A3 landscape;" : ""} margin: 10mm; } }
  </style>
</head>
<body>
  <div class="pt">
    <button class="pt-c" onclick="window.close()">✕ Затвори</button>
    <button class="pt-p" onclick="window.print()">🖨 Принтирай</button>
  </div>
  <div style="font-size:22px;font-weight:700;margin:0 0 4px;">${kind === "monthly" ? "Месечен отчет" : "Годишен отчет"}</div>
  <p style="margin:0 0 14px;color:#6b7280;font-size:13px;">Период: ${escapeHtml(periodTitle)}</p>
  ${scopeTitle ? `<p style="margin:0 0 14px;color:#6b7280;font-size:13px;">${escapeHtml(scopeTitle)}</p>` : ""}
  ${yearly ? `<p style="font-size:12px;">Към ${escapeHtml(now.toLocaleDateString("bg-BG", { timeZone: "Europe/Sofia" }))}. Платени / дължими месечни такси; бъдещите месеци, освобождаванията и месеците преди началото на таксуване не участват в събираемостта. Предплатените месеци са показани, но участват в събираемостта, когато станат дължими. Филтър: ${statusFilter === "all" ? "Всички" : statusFilter === "paid" ? "Всички дължими такси са платени" : "Има неплатени такси"}. Обобщението обхваща всички избрани играчи преди филтъра за статус.</p>
  <p style="font-size:12px;">Сумите са записаните при плащане стойности, а не текущата такса на играча. Старите плащания без записана сума са обозначени като неизвестни и не се приемат за нула. Общите суми обхващат показаната година по платения период, включително предплатените месеци. За таксуване извън календарни месеци се показва само платежна активност, без оценка на задълженията. Историческите промени в членството и групите не са налични; използват се текущите играчи и групи.</p>` : ""}
  <div style="display:flex;gap:12px;margin:0 0 16px;flex-wrap:wrap;">
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:13px;min-width:140px;">${yearly ? "Платени / дължими такси" : "Платили"}: <strong>${paid}</strong> / ${totalRows}</div>
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:13px;min-width:140px;">Събираемост: <strong>${yearly && totalRows === 0 ? "—" : `${percent}%`}</strong></div>
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:13px;min-width:140px;">${yearly ? "Неплатени такси" : "Неплатили"}: <strong>${unpaid}</strong></div>
  </div>
  <table>
    <thead>
      ${yearly ? `<tr><th>#</th><th>Име</th>${MONTHS.map((name) => `<th>${escapeHtml(name)}</th>`).join("")}<th>Платени / дължими</th><th>Неплатени</th><th>Общо платено</th><th>Статус</th></tr>` : "<tr><th>#</th><th>Име</th><th>Платена сума</th><th>Дата на плащане</th><th>Статус</th></tr>"}
    </thead>
    <tbody>${tableRowsHtml}</tbody>
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
      <div className="rd-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="rd-close" onClick={onClose} aria-label="Затвори">
          <XIcon />
        </button>

        <div className="rd-header">
          <h2 className="rd-title">
            <ChartColumnIcon size={20} />
            Център за отчети
          </h2>
        </div>

        <div className="rd-player-filters">
          <div
            className="rd-field rd-field--grow rd-player-combobox"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setPlayerMenuOpen(false);
            }}
          >
            <label className="rd-label" htmlFor="rd-player-search">Играч</label>
            <div className="rd-select-wrap">
              <input
                id="rd-player-search"
                className="rd-select rd-player-search"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={playerMenuOpen}
                aria-controls="rd-player-options"
                aria-activedescendant={playerMenuOpen ? `rd-player-option-${activePlayerOption}` : undefined}
                autoComplete="off"
                placeholder={loading ? "Зареждане…" : "Всички играчи — търсете по име…"}
                value={playerSearch}
                disabled={loading}
                onFocus={() => {
                  setPlayerMenuOpen(true);
                  setActivePlayerOption(0);
                }}
                onClick={() => setPlayerMenuOpen(true)}
                onChange={(e) => {
                  setPlayerSearch(e.target.value);
                  setSelectedPlayerId("");
                  setPlayerMenuOpen(true);
                  setActivePlayerOption(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setPlayerMenuOpen(false);
                  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setPlayerMenuOpen(true);
                    const next = Math.max(0, Math.min(matchingPlayers.length,
                      activePlayerOption + (e.key === "ArrowDown" ? 1 : -1)));
                    setActivePlayerOption(next);
                    document.getElementById(`rd-player-option-${next}`)?.scrollIntoView({ block: "nearest" });
                  } else if (e.key === "Enter" && playerMenuOpen) {
                    e.preventDefault();
                    const player = matchingPlayers[activePlayerOption - 1];
                    setSelectedPlayerId(player?.id ?? "");
                    setPlayerSearch(player?.fullName ?? "");
                    setPlayerMenuOpen(false);
                  }
                }}
              />
              <ChevronDownIcon />
            </div>
            {playerMenuOpen && (
              <div id="rd-player-options" className="rd-player-options" role="listbox" aria-label="Играчи от групата">
                <div
                  id="rd-player-option-0"
                  role="option"
                  aria-selected={!selectedPlayerId}
                  className={`rd-player-option${activePlayerOption === 0 ? " active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelectedPlayerId("");
                    setPlayerSearch("");
                    setPlayerMenuOpen(false);
                  }}
                >Всички играчи</div>
                {matchingPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    id={`rd-player-option-${index + 1}`}
                    role="option"
                    aria-selected={selectedPlayerId === player.id}
                    className={`rd-player-option${activePlayerOption === index + 1 ? " active" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedPlayerId(player.id);
                      setPlayerSearch(player.fullName);
                      setPlayerMenuOpen(false);
                    }}
                  >{player.fullName}</div>
                ))}
                {matchingPlayers.length === 0 && (
                  <div className="rd-player-no-results">Няма играчи с това име.</div>
                )}
              </div>
            )}
          </div>
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

          {!coachGroupId && (
            <>
              <div className="rd-field rd-field--grow">
                <label className="rd-label">Треньор</label>
                <div className="rd-select-wrap">
                  <select
                    className="rd-select"
                    value={filterCoachGroupId}
                    onChange={(e) => setFilterCoachGroupId(e.target.value)}
                  >
                    <option value="">Всички</option>
                    {coachGroupsList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>
              {filterCoachGroupId && customTrainingGroupsList.length > 0 && (
                <div className="rd-field">
                  <label className="rd-label">Треньорска група</label>
                  <div className="rd-select-wrap">
                    <select
                      className="rd-select rd-select--w140"
                      value={filterCustomGroupId}
                      onChange={(e) => setFilterCustomGroupId(e.target.value)}
                    >
                      <option value="">Всички</option>
                      {customTrainingGroupsList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <ChevronDownIcon />
                  </div>
                </div>
              )}
            </>
          )}

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
                <th>Дата на плащане</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="rd-empty-row">Зареждане...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="rd-empty-row">Няма състезатели за избраните филтри.</td>
                </tr>
              )}
              {!loading && filtered.map((row, i) => (
                <tr key={row.id}>
                  <td className="rd-td-muted">{i + 1}</td>
                  <td>{row.name}</td>
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
          <button className="rd-footer-btn" disabled={loading} onClick={() => printReport("monthly")}>
            <PrinterIcon />
            Генерирай месечен отчет
          </button>
          <button className="rd-footer-btn" disabled={loading} onClick={() => printReport("yearly")}>
            <CalendarIcon />
            Генерирай годишен отчет
          </button>
        </div>
      </div>
    </div>
  );
}

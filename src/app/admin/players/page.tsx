"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

const ClubLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M60 2 L115 20 L115 85 Q115 120 60 138 Q5 120 5 85 L5 20 Z" fill="#1a5c1a" stroke="#32cd32" strokeWidth="3" />
    <path d="M60 8 L109 24 L109 83 Q109 114 60 132 Q11 114 11 83 L11 24 Z" fill="#0d3d0d" />
    <rect x="15" y="18" width="90" height="22" rx="2" fill="#1a5c1a" />
    <rect x="20" y="44" width="16" height="40" fill="#ffffff" />
    <rect x="36" y="44" width="16" height="40" fill="#32cd32" />
    <rect x="52" y="44" width="16" height="40" fill="#ffffff" />
    <rect x="68" y="44" width="16" height="40" fill="#32cd32" />
    <rect x="84" y="44" width="16" height="40" fill="#ffffff" />
    <circle cx="60" cy="64" r="14" fill="#1a5c1a" stroke="#32cd32" strokeWidth="1.5" />
    <circle cx="60" cy="64" r="10" fill="none" stroke="#ffffff" strokeWidth="1" />
    <rect x="15" y="88" width="90" height="20" rx="2" fill="#1a5c1a" />
    <text x="60" y="122" textAnchor="middle" fill="#32cd32" fontSize="14" fontWeight="800" fontFamily="Arial, sans-serif">1961</text>
  </svg>
);

const ChartColumnIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

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

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <path d="M16 3.128a4 4 0 0 1 0 7.744" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 7h6v6" />
    <path d="m22 7-8.5 8.5-5-5L2 17" />
  </svg>
);

const CircleAlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

const PrinterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

const MONTHS = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];

interface ClubRow {
  id: string;
  name: string;
  slug: string;
  emblemUrl?: string | null;
}

interface ReportPaymentLog {
  id: string;
  paidAt: string;
}

interface ReportPlayer {
  id: string;
  fullName: string;
  teamGroup: number | null;
  paymentLogs: ReportPaymentLog[];
}

function ReportsDialog({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const [month, setMonth] = useState(MONTHS[now.getMonth()] ?? MONTHS[0]);
  const [year, setYear] = useState(String(Math.max(2026, now.getFullYear())));
  const [group, setGroup] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [players, setPlayers] = useState<ReportPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/admin/members", { cache: "no-store" });
        if (!response.ok) {
          setPlayers([]);
          return;
        }
        const data = (await response.json()) as ReportPlayer[];
        setPlayers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching report players:", error);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchPlayers();
  }, []);

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

  const getPaymentDateForPeriod = (player: ReportPlayer): string | null => {
    let latestDate: Date | null = null;

    for (const log of player.paymentLogs ?? []) {
      const paidAtDate = new Date(log.paidAt);
      if (Number.isNaN(paidAtDate.getTime())) {
        continue;
      }
      if (paidAtDate.getMonth() !== selectedMonthIdx || paidAtDate.getFullYear() !== selectedYear) {
        continue;
      }
      if (!latestDate || paidAtDate > latestDate) {
        latestDate = paidAtDate;
      }
    }

    return latestDate ? latestDate.toLocaleDateString("bg-BG") : null;
  };

  const groupFiltered = players.filter((player) => {
    if (group === "all") {
      return true;
    }
    return String(player.teamGroup ?? "") === group;
  });

  const rows = groupFiltered.map((player) => {
    const paidDate = getPaymentDateForPeriod(player);
    return {
      id: player.id,
      name: player.fullName,
      group: player.teamGroup,
      date: paidDate ?? "—",
      paid: Boolean(paidDate),
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
          <button className="rd-footer-btn" onClick={() => window.print()}>
            <PrinterIcon />
            Генерирай месечен отчет
          </button>
          <button className="rd-footer-btn" onClick={() => window.print()}>
            <CalendarIcon />
            Генерирай годишен отчет
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPlayersPage() {
  const router = useRouter();
  const [reportsOpen, setReportsOpen] = useState(false);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);

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

  return (
    <main className="mp-page">
      <div className="mp-dot-grid" aria-hidden="true" />

      <div className="mp-inner">
        <div className="mp-header">
          <h1 className="mp-title">Списък играчи</h1>
          <p className="mp-subtitle">Търсене, филтриране и ръчно отбелязване на плащания</p>
          <div className="mp-title-line" />
        </div>

        <button className="mp-reports-btn" onClick={() => setReportsOpen(true)}>
          <ChartColumnIcon />
          Център за отчети
        </button>

        <div className="mp-demo-box">
          <p className="mp-demo-label">DEMO ACTIONS</p>
          <div className="mp-demo-actions">
            <button className="mp-demo-btn mp-demo-btn--yellow">
              <BellIcon />
              Симулирай Напомняне (25-то число)
            </button>
            <button className="mp-demo-btn mp-demo-btn--red">
              <TriangleAlertIcon />
              Симулирай Просрочие (1-во число)
            </button>
          </div>
        </div>

        <div className="mp-teams-section">
          <h2 className="mp-teams-title">Изберете отбор</h2>
          <div className="mp-teams-grid">
            {clubsLoading && (
              <div className="mp-team-empty">Зареждане на отборите...</div>
            )}

            {!clubsLoading && clubs.map((club) => (
              <button
                key={club.id}
                type="button"
                className="mp-team-card"
                onClick={() => router.push(`/admin/members?clubId=${club.id}`)}
              >
                <div className="mp-team-card-content">
                  <div className="mp-team-logo-wrap">
                    {club.emblemUrl ? (
                      <img src={club.emblemUrl} alt={club.name} className="mp-team-logo mp-team-logo--img" />
                    ) : (
                      <ClubLogo className="mp-team-logo" />
                    )}
                  </div>
                  <div className="mp-team-info">
                    <h3 className="mp-team-name">{club.name}</h3>
                    <p className="mp-team-slug">{club.slug}</p>
                  </div>
                  <ChevronRightIcon />
                </div>
              </button>
            ))}

            {!clubsLoading && clubs.length === 0 && (
              <div className="mp-team-empty">Няма добавени отбори.</div>
            )}
          </div>
        </div>
      </div>

      {reportsOpen && <ReportsDialog onClose={() => setReportsOpen(false)} />}
    </main>
  );
}

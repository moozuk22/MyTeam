"use client";
import { useState } from "react";
import "./page.css";

/* ── Club Logo ── */
const ClubLogo = ({ className = "" }) => (
  <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M60 2 L115 20 L115 85 Q115 120 60 138 Q5 120 5 85 L5 20 Z" fill="#1a5c1a" stroke="#32cd32" strokeWidth="3"/>
    <path d="M60 8 L109 24 L109 83 Q109 114 60 132 Q11 114 11 83 L11 24 Z" fill="#0d3d0d"/>
    <rect x="15" y="18" width="90" height="22" rx="2" fill="#1a5c1a"/>
    <text x="60" y="33" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="Arial, sans-serif">ФК ВИХЪР</text>
    <rect x="20" y="44" width="16" height="40" fill="#ffffff"/>
    <rect x="36" y="44" width="16" height="40" fill="#32cd32"/>
    <rect x="52" y="44" width="16" height="40" fill="#ffffff"/>
    <rect x="68" y="44" width="16" height="40" fill="#32cd32"/>
    <rect x="84" y="44" width="16" height="40" fill="#ffffff"/>
    <circle cx="60" cy="64" r="14" fill="#1a5c1a" stroke="#32cd32" strokeWidth="1.5"/>
    <circle cx="60" cy="64" r="10" fill="none" stroke="#ffffff" strokeWidth="1"/>
    <text x="60" y="68" textAnchor="middle" fill="#ffffff" fontSize="12">⚽</text>
    <rect x="15" y="88" width="90" height="20" rx="2" fill="#1a5c1a"/>
    <text x="60" y="102" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="700" fontFamily="Arial, sans-serif">ВОЙВОДИНОВО</text>
    <text x="60" y="122" textAnchor="middle" fill="#32cd32" fontSize="14" fontWeight="800" fontFamily="Arial, sans-serif">1961</text>
  </svg>
);

/* ── Icons ── */
const ChartColumnIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
  </svg>
);
const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.268 21a2 2 0 0 0 3.464 0"/>
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
  </svg>
);
const TriangleAlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
    <path d="M12 9v4"/><path d="M12 17h.01"/>
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <path d="M16 3.128a4 4 0 0 1 0 7.744"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <circle cx="9" cy="7" r="4"/>
  </svg>
);
const TrendingUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>
  </svg>
);
const CircleAlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" x2="12" y1="8" y2="12"/>
    <line x1="12" x2="12.01" y1="16" y2="16"/>
  </svg>
);
const PrinterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/>
    <rect x="6" y="14" width="12" height="8" rx="1"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4"/><path d="M16 2v4"/>
    <rect width="18" height="18" x="3" y="4" rx="2"/>
    <path d="M3 10h18"/>
  </svg>
);

/* ── Player data ── */
const PLAYERS = [
  { id: 1,  name: "Алекс Гърдев",          group: 2017, date: "—", paid: false },
  { id: 2,  name: "Александър Вълчев",      group: 2021, date: "—", paid: false },
  { id: 3,  name: "Андрей Андреев",         group: 2013, date: "—", paid: false },
  { id: 4,  name: "Божидар Арбов",          group: 2019, date: "—", paid: false },
  { id: 5,  name: "Божидар Нечев",          group: 2017, date: "—", paid: false },
  { id: 6,  name: "Георги Видков",          group: 2017, date: "—", paid: false },
  { id: 7,  name: "Георги Тодовичин",       group: 2015, date: "—", paid: false },
  { id: 8,  name: "Данимир Спасов",         group: 2018, date: "—", paid: false },
  { id: 9,  name: "Димитър Бофиров",        group: 2019, date: "—", paid: false },
  { id: 10, name: "Димитър Ефтимов",        group: 2014, date: "—", paid: false },
  { id: 11, name: "Димитър Колев",          group: 2015, date: "—", paid: false },
  { id: 12, name: "Димитър Найденов",       group: 2014, date: "—", paid: false },
  { id: 13, name: "Емануел Кисьов",         group: 2014, date: "—", paid: false },
  { id: 14, name: "Емил Йорданов",          group: 2018, date: "—", paid: false },
  { id: 15, name: "Захари Господинов",      group: 2020, date: "—", paid: false },
  { id: 16, name: "Ивайло Чокойски",        group: 2020, date: "—", paid: false },
  { id: 17, name: "Йоан Митев",             group: 2018, date: "—", paid: false },
  { id: 18, name: "Костадин Танев",         group: 2021, date: "—", paid: false },
  { id: 19, name: "Кристиан Каламов",       group: 2020, date: "—", paid: false },
  { id: 20, name: "Лъчезар Русев",          group: 2021, date: "—", paid: false },
  { id: 21, name: "Мартин Христев",         group: 2012, date: "—", paid: false },
  { id: 22, name: "Матео Чакракчиев",       group: 2021, date: "—", paid: false },
  { id: 23, name: "Михаил Ковашки",         group: 2016, date: "—", paid: false },
  { id: 24, name: "Николай Добринов",       group: 2014, date: "—", paid: false },
  { id: 25, name: "Николай Митев",          group: 2014, date: "—", paid: false },
  { id: 26, name: "Петко Делов",            group: 2020, date: "—", paid: false },
  { id: 27, name: "Петко Димитров",         group: 2016, date: "—", paid: false },
  { id: 28, name: "Петьо Асърджийски",      group: 2012, date: "—", paid: false },
  { id: 29, name: "Пламен Политов",         group: 2020, date: "—", paid: false },
  { id: 30, name: "Стоян Воденичаров",      group: 2012, date: "—", paid: false },
  { id: 31, name: "Стоян Иванов",           group: 2012, date: "—", paid: false },
  { id: 32, name: "Теодор Димов",           group: 2019, date: "—", paid: false },
];

const MONTHS = ["Януари","Февруари","Март","Април","Май","Юни","Юли","Август","Септември","Октомври","Ноември","Декември"];
const GROUPS = [...new Set(PLAYERS.map(p => p.group))].sort((a,b) => b-a);

/* ── Reports Dialog ── */
function ReportsDialog({ onClose }) {
  const [month, setMonth]       = useState("Март");
  const [year, setYear]         = useState("2026");
  const [group, setGroup]       = useState("Всички");
  const [statusFilter, setStatusFilter] = useState("all");

  const paidCount = PLAYERS.filter(p => p.paid).length;
  const total     = PLAYERS.length;
  const pct       = total > 0 ? Math.round((paidCount / total) * 100) : 0;
  const missing   = total - paidCount;

  const filtered = PLAYERS.filter(p => {
    if (group !== "Всички" && p.group !== Number(group)) return false;
    if (statusFilter === "paid" && !p.paid) return false;
    if (statusFilter === "unpaid" && p.paid) return false;
    return true;
  });

  return (
    <div className="rd-overlay" onClick={onClose}>
      <div className="rd-dialog" onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button className="rd-close" onClick={onClose} aria-label="Затвори"><XIcon/></button>

        {/* Header */}
        <div className="rd-header">
          <h2 className="rd-title">
            <ChartColumnIcon size={20}/>
            Център за отчети
          </h2>
        </div>

        {/* Filters row */}
        <div className="rd-filters">
          <div className="rd-filters-left">
            <div className="rd-field">
              <label className="rd-label">Месец</label>
              <div className="rd-select-wrap">
                <select className="rd-select rd-select--w140" value={month} onChange={e => setMonth(e.target.value)}>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <ChevronDownIcon/>
              </div>
            </div>
            <div className="rd-field">
              <label className="rd-label">Година</label>
              <div className="rd-select-wrap">
                <select className="rd-select rd-select--w100" value={year} onChange={e => setYear(e.target.value)}>
                  {["2024","2025","2026"].map(y => <option key={y}>{y}</option>)}
                </select>
                <ChevronDownIcon/>
              </div>
            </div>
          </div>

          <div className="rd-field">
            <label className="rd-label">Набор</label>
            <div className="rd-select-wrap">
              <select className="rd-select rd-select--w120" value={group} onChange={e => setGroup(e.target.value)}>
                <option>Всички</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <ChevronDownIcon/>
            </div>
          </div>

          <div className="rd-field">
            <label className="rd-label">Статус</label>
            <div className="rd-seg">
              <button className={`rd-seg-btn${statusFilter==="all" ? " active" : ""}`} onClick={() => setStatusFilter("all")}>Всички</button>
              <button className={`rd-seg-btn${statusFilter==="paid" ? " active" : ""}`} onClick={() => setStatusFilter("paid")}>Платили</button>
              <button className={`rd-seg-btn${statusFilter==="unpaid" ? " active" : ""}`} onClick={() => setStatusFilter("unpaid")}>Неплатили</button>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="rd-stats">
          <div className="rd-stat">
            <div className="rd-stat-label"><UsersIcon/>Общо събрани такси</div>
            <div className="rd-stat-num rd-stat-num--green">
              {paidCount}<span className="rd-stat-denom">/ {total}</span>
            </div>
          </div>
          <div className="rd-stat">
            <div className="rd-stat-label"><TrendingUpIcon/>Процент събираемост</div>
            <div className="rd-stat-num rd-stat-num--red">{pct}%</div>
          </div>
          <div className="rd-stat">
            <div className="rd-stat-label"><CircleAlertIcon/>Липсващи плащания</div>
            <div className="rd-stat-num rd-stat-num--red">{missing}</div>
          </div>
        </div>

        {/* Table */}
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
              {filtered.map((p, i) => (
                <tr key={p.id}>
                  <td className="rd-td-muted">{i + 1}</td>
                  <td>{p.name}</td>
                  <td className="rd-td-dim">{p.group}</td>
                  <td className="rd-td-dim">{p.date}</td>
                  <td>
                    <span className={`rd-badge ${p.paid ? "rd-badge--paid" : "rd-badge--unpaid"}`}>
                      {p.paid ? "Платено" : "Неплатено"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer buttons */}
        <div className="rd-footer">
          <button className="rd-footer-btn" onClick={() => window.print()}>
            <PrinterIcon/>
            Генерирай месечен отчет
          </button>
          <button className="rd-footer-btn" onClick={() => window.print()}>
            <CalendarIcon/>
            Генерирай годишен отчет
          </button>
        </div>

      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function AdminPlayersPage() {
  const [reportsOpen, setReportsOpen] = useState(false);

  return (
    <main className="mp-page">
      <div className="mp-dot-grid" aria-hidden="true"/>

      <div className="mp-inner">

        {/* Header */}
        <div className="mp-header">
          <h1 className="mp-title">Списък играчи</h1>
          <p className="mp-subtitle">Търсене, филтриране и ръчно отбелязване на плащания</p>
          <div className="mp-title-line"/>
        </div>

        {/* Reports button */}
        <button className="mp-reports-btn" onClick={() => setReportsOpen(true)}>
          <ChartColumnIcon/>
          Център за отчети
        </button>

        {/* Demo actions */}
        <div className="mp-demo-box">
          <p className="mp-demo-label">DEMO ACTIONS</p>
          <div className="mp-demo-actions">
            <button className="mp-demo-btn mp-demo-btn--yellow">
              <BellIcon/>
              Симулирай Напомняне (25-то число)
            </button>
            <button className="mp-demo-btn mp-demo-btn--red">
              <TriangleAlertIcon/>
              Симулирай Просрочие (1-во число)
            </button>
          </div>
        </div>

        {/* Team selector */}
        <div className="mp-teams-section">
          <h2 className="mp-teams-title">Изберете отбор</h2>
          <div className="mp-teams-grid">
            <div className="mp-team-card">
              <div className="mp-team-card-content">
                <div className="mp-team-logo-wrap">
                  <ClubLogo className="mp-team-logo"/>
                </div>
                <div className="mp-team-info">
                  <h3 className="mp-team-name">ФК Вихър Войводиново</h3>
                  <p className="mp-team-slug">vihar</p>
                </div>
                <ChevronRightIcon/>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Reports Dialog */}
      {reportsOpen && <ReportsDialog onClose={() => setReportsOpen(false)}/>}
    </main>
  );
}
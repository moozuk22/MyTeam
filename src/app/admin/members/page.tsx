"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

/* ── Icons ── */
const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>
  </svg>
);
const CircleCheckBigIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="M12 5v14"/>
  </svg>
);

/* ── Status helpers ── */
const getStatusMeta = (status) => {
  if (status === "paid") return {
    label: "Платено",
    color: "#32cd32",
    bg: "rgba(50,205,50,0.2)",
    border: "rgba(50,205,50,0.3)",
    cls: "badge--paid",
  };
  if (status === "warning") return {
    label: "Напомняне",
    color: "#ffd700",
    bg: "rgba(255,215,0,0.2)",
    border: "rgba(255,215,0,0.3)",
    cls: "badge--reminder",
  };
  return {
    label: "Просрочено",
    color: "#ff4d4d",
    bg: "rgba(255,77,77,0.2)",
    border: "rgba(255,77,77,0.3)",
    cls: "badge--overdue",
  };
};

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "rgba(255,255,255,0.4)" }}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "rgba(255,255,255,0.4)" }}>
    <path d="M8 2v4"/><path d="M16 2v4"/>
    <rect width="18" height="18" x="3" y="4" rx="2"/>
    <path d="M3 10h18"/>
  </svg>
);
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);
const ReceiptIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
    <path d="M12 17.5v-11"/>
  </svg>
);

/* ── Member Detail Modal ── */
function MemberDetailModal({ member, onClose }) {
  const s = getStatusMeta(member.status);
  const [historyOpen, setHistoryOpen] = useState(false);

  const paymentHistory = [...(member.paymentLogs ?? [])].sort(
    (a, b) => new Date(b.paidAt) - new Date(a.paidAt)
  );
  const lastPayment = paymentHistory[0];

  return (
    <div className="amp-overlay" onClick={onClose}>
      <div className="amp-modal" onClick={e => e.stopPropagation()}>

        {/* green tint */}
        <div className="amp-modal-tint" aria-hidden="true"/>

        {/* Title */}
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Статистика - {member.fullName}</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори">
            <XIcon/>
          </button>
        </h2>

        <div className="amp-modal-body">

          {/* Info card — 2-col grid */}
          <div className="amp-info-card">

            {/* Row 1 col 1: Име */}
            <div className="amp-info-cell">
              <UserIcon/>
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

            {/* Row 3 full: Последно плащане */}
            <div className="amp-info-cell amp-info-cell--full">
              <CalendarIcon/>
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
              <span className={`amp-acc-chevron${historyOpen ? " open" : ""}`}><ChevronDownIcon/></span>
            </button>
            <div className={`amp-acc-body${historyOpen ? " open" : ""}`}>
              <div className="amp-acc-inner">
                {paymentHistory.length === 0 ? (
                  <div className="amp-acc-empty">
                    <ReceiptIcon/>
                    <p>Все още няма регистрирани плащания</p>
                  </div>
                ) : (
                  <div className="amp-acc-list">
                    {paymentHistory.map(p => (
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

        </div>
      </div>
    </div>
  );
}

/* ── Player Card ── */
function PlayerCard({ member, onClick }) {
  const s = getStatusMeta(member.status);
  const initial = member.fullName.trim().charAt(0).toUpperCase() || "?";
  const needsAction = member.status === "overdue" || member.status === "warning";

  return (
    <div className="pc-card" onClick={onClick}>
      <div className="pc-shimmer" aria-hidden="true"/>
      <div className="pc-content">
        {/* Avatar */}
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt={member.fullName} className="pc-avatar pc-avatar--img"/>
        ) : (
          <div className="pc-avatar" style={{ color: s.color, background: s.bg, borderColor: s.border }}>
            <span className="pc-avatar-letter">{initial}</span>
          </div>
        )}

        {/* Name + badge */}
        <div className="pc-info">
          <span className="pc-name">{member.fullName}</span>
          <div className="pc-badges">
            <span className="amp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
              {s.label}
            </span>
          </div>
        </div>

        {/* Right: check icon for paid, nothing for others (clicking opens modal) */}
        {!needsAction && (
          <span style={{ color: "#32cd32", flexShrink: 0 }}>
            <CircleCheckBigIcon size={24}/>
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function AdminMembersPage() {
  const router = useRouter();
  const [members, setMembers]                   = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [searchTerm, setSearchTerm]             = useState("");
  const [selectedGroup, setSelectedGroup]       = useState("all");
  const [selectedMember, setSelectedMember]     = useState(null);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/members");
        if (res.ok) {
          const data = await res.json();
          const normalized = data.map((item) => {
            const fullName = String(item.fullName ?? "").trim();
            const cards = Array.isArray(item.cards) ? item.cards : [];
            const activeCard = cards.find(c => c.isActive);
            const nfcTagId = activeCard?.cardCode ?? cards[0]?.cardCode ?? "";
            const paymentLogs = Array.isArray(item.paymentLogs) ? item.paymentLogs : [];
            return {
              id: String(item.id ?? ""),
              fullName,
              nfcTagId,
              status: item.status ?? "paid",
              teamGroup: item.teamGroup ?? null,
              jerseyNumber: item.jerseyNumber ?? null,
              avatarUrl: item.avatarUrl ?? null,
              lastPaymentDate: item.lastPaymentDate ?? null,
              club: item.club ?? undefined,
              paymentLogs,
              cards,
            };
          });
          setMembers(normalized);
        }
      } catch (err) {
        console.error("Error fetching members:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  /* ── Derived ── */
  const groupOptions = [...new Set(
    members.map(m => m.teamGroup).filter(g => g !== null)
  )].sort((a, b) => b - a);

  const filtered = members.filter(m => {
    const matchGroup = selectedGroup === "all" || String(m.teamGroup) === selectedGroup;
    if (!matchGroup) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.jerseyNumber ?? "").toLowerCase().includes(q) ||
      m.cards.some(c => c.cardCode.toLowerCase().includes(q)) ||
      (m.club?.name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="amp-page">
      <div className="amp-dot-grid" aria-hidden="true"/>

      <div className="amp-inner">

        {/* ── Page header ── */}
        <div className="amp-header">
          <h1 className="amp-title">Списък играчи</h1>
          <p className="amp-subtitle">Търсене, филтриране и ръчно отбелязване на плащания</p>
          <div className="amp-title-line"/>
        </div>

        {/* ── Nav row ── */}
        <div className="amp-nav-row">
          <div className="amp-nav-left">
            <button className="amp-back-btn" onClick={() => router.back()}>
              <ArrowLeftIcon/>
              Назад към отбори
            </button>
            <button className="amp-add-btn" onClick={() => router.push("/admin/members/add")}>
              <PlusIcon/>
              Добави играч
            </button>
          </div>
          <div className="amp-club-info">
            <div className="amp-club-icon">🏆</div>
            <h2 className="amp-club-name">ФК Вихър Войводиново</h2>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="amp-content">

          {/* Group filter pills */}
          <div className="amp-pills">
            <button
              className={`amp-pill${selectedGroup === "all" ? " amp-pill--active" : ""}`}
              onClick={() => setSelectedGroup("all")}
            >
              Всички
            </button>
            {groupOptions.map(g => (
              <button
                key={g}
                className={`amp-pill${selectedGroup === String(g) ? " amp-pill--active" : ""}`}
                onClick={() => setSelectedGroup(String(g))}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="amp-search-wrap">
            <SearchIcon/>
            <input
              className="amp-search"
              type="text"
              placeholder="Търси по име или номер..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="amp-search-clear" onClick={() => setSearchTerm("")}>
                <XIcon/>
              </button>
            )}
          </div>

          {/* Cards */}
          {loading ? (
            <div className="amp-loading">
              <div className="amp-spinner"/>
            </div>
          ) : (
            <div className="amp-cards">
              {filtered.map(m => (
                <PlayerCard key={m.id} member={m} onClick={() => setSelectedMember(m)}/>
              ))}
              {filtered.length === 0 && (
                <p className="amp-empty">Няма намерени играчи</p>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Detail modal */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </main>
  );
}
"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "./page.css";

type PlayerStatus = "paid" | "warning" | "overdue";

interface PaymentLog {
  id: string;
  paidFor: string;
  paidAt: string;
}

interface MemberCard {
  cardCode: string;
  isActive: boolean;
}

interface MemberClub {
  id: string;
  name: string;
}

interface Member {
  id: string;
  fullName: string;
  nfcTagId: string;
  status: PlayerStatus;
  teamGroup: number | null;
  jerseyNumber: string | null;
  avatarUrl: string | null;
  lastPaymentDate: string | null;
  club?: MemberClub;
  paymentLogs: PaymentLog[];
  cards: MemberCard[];
}

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
  border: string;
  cls: string;
}

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
const CircleCheckBigIcon = ({ size = 24 }: { size?: number }) => (
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
const getStatusMeta = (status: PlayerStatus): StatusMeta => {
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
function MemberDetailModal({
  member,
  onClose,
  onRequestDelete,
}: {
  member: Member;
  onClose: () => void;
  onRequestDelete: (member: Member) => void;
}) {
  const s = getStatusMeta(member.status);
  const [historyOpen, setHistoryOpen] = useState(false);

  const paymentHistory = [...(member.paymentLogs ?? [])].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
  const lastPayment = paymentHistory[0];
  const activeCardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "Няма активна карта";

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

            <div className="amp-info-cell">
              <span className="amp-lbl">Активна карта:</span>
              <span className="amp-val">{activeCardCode}</span>
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
            <button
              className="amp-btn amp-btn--danger"
              onClick={() => onRequestDelete(member)}
            >
              Изтрий играч
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Player Card ── */
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
        <div className="amp-modal-tint" aria-hidden="true"/>
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Потвърди изтриване</span>
          <button className="amp-modal-close" onClick={onCancel} aria-label="Затвори" disabled={isDeleting}>
            <XIcon/>
          </button>
        </h2>

        <div className="amp-modal-body">
          <p className="amp-confirm-text">
            Сигурен ли си, че искаш да изтриеш <strong>{member.fullName}</strong>?
          </p>
          <p className="amp-confirm-subtext">
            Tова действие ще изтрие играча перманентно и не може да бъде отменено.
          </p>

          {error && <p className="amp-confirm-error">{error}</p>}

          <div className="amp-modal-actions">
            <button className="amp-btn amp-btn--ghost" onClick={onCancel} disabled={isDeleting}>
              Отказ
            </button>
            <button className="amp-btn amp-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Изтриване..." : "Изтрий"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ member, onClick }: { member: Member; onClick: () => void }) {
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

        <div className="pc-actions">
          {cardCode && (
            <button
              type="button"
              className="pc-profile-btn"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/member/${encodeURIComponent(cardCode)}`);
              }}
            >
              виж профил
            </button>
          )}

          {/* Right: check icon for paid, nothing for others (clicking opens modal) */}
          {!needsAction && (
            <span style={{ color: "#32cd32", flexShrink: 0 }}>
              <CircleCheckBigIcon size={24}/>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
function AdminMembersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId") ?? "";
  const [members, setMembers]                   = useState<Member[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [searchTerm, setSearchTerm]             = useState("");
  const [selectedGroup, setSelectedGroup]       = useState("all");
  const [selectedMember, setSelectedMember]     = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete]     = useState<Member | null>(null);
  const [deleteError, setDeleteError]           = useState("");
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [clubName, setClubName]                 = useState("Всички отбори");

  const handleDeleteMember = async () => {
    if (!memberToDelete || isDeletingMember) return;

    setIsDeletingMember(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/admin/members/${memberToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let message = "Неуспешно изтриване на играч.";
        try {
          const data = await response.json();
          if (typeof data?.error === "string" && data.error.trim()) {
            message = data.error.trim();
          }
        } catch {
          // Keep generic message when response body is not JSON.
        }
        setDeleteError(message);
        return;
      }

      setMembers((prev) => prev.filter((member) => member.id !== memberToDelete.id));
      setSelectedMember((prev) => (prev?.id === memberToDelete.id ? null : prev));
      setMemberToDelete(null);
    } catch (error) {
      console.error("Error deleting member:", error);
      setDeleteError("Възникна грешка при изтриване на играч.");
    } finally {
      setIsDeletingMember(false);
    }
  };

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const endpoint = clubId
          ? `/api/admin/members?clubId=${encodeURIComponent(clubId)}`
          : "/api/admin/members";
        const res = await fetch(endpoint);
        if (res.status === 404 && clubId) {
          router.replace("/404");
          return;
        }
        if (res.ok) {
          const data: unknown = await res.json();
          const rawItems = Array.isArray(data) ? data : [];
          const normalized: Member[] = rawItems.map((item: any) => {
            const fullName = String(item.fullName ?? "").trim();
            const cards: MemberCard[] = Array.isArray(item.cards)
              ? item.cards.map((card: any) => ({
                  cardCode: String(card?.cardCode ?? ""),
                  isActive: Boolean(card?.isActive),
                }))
              : [];
            const activeCard = cards.find((c) => c.isActive);
            const nfcTagId = activeCard?.cardCode ?? cards[0]?.cardCode ?? "";
            const paymentLogs: PaymentLog[] = Array.isArray(item.paymentLogs)
              ? item.paymentLogs.map((log: any) => ({
                  id: String(log?.id ?? ""),
                  paidFor: String(log?.paidFor ?? ""),
                  paidAt: String(log?.paidAt ?? ""),
                }))
              : [];
            const rawStatus = item.status;
            const status: PlayerStatus =
              rawStatus === "paid" || rawStatus === "warning" || rawStatus === "overdue"
                ? rawStatus
                : "paid";
            return {
              id: String(item.id ?? ""),
              fullName,
              nfcTagId,
              status,
              teamGroup: typeof item.teamGroup === "number" ? item.teamGroup : null,
              jerseyNumber: item.jerseyNumber ? String(item.jerseyNumber) : null,
              avatarUrl: item.avatarUrl ? String(item.avatarUrl) : item.imageUrl ? String(item.imageUrl) : null,
              lastPaymentDate: item.lastPaymentDate ? String(item.lastPaymentDate) : null,
              club: item.club
                ? {
                    id: String(item.club.id ?? ""),
                    name: String(item.club.name ?? ""),
                  }
                : undefined,
              paymentLogs,
              cards,
            };
          });
          setMembers(normalized);
          if (!clubId) {
            setClubName("Всички отбори");
          } else {
            const nameFromMembers = normalized[0]?.club?.name;
            if (nameFromMembers) {
              setClubName(nameFromMembers);
            } else {
              setClubName("Отбор");
            }
          }
        }
      } catch (err) {
        console.error("Error fetching members:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchClubName = async () => {
      if (!clubId) {
        setClubName("Всички отбори");
        return;
      }

      try {
        const response = await fetch("/api/admin/clubs", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const clubs: unknown = await response.json();
        const selectedClub = Array.isArray(clubs)
          ? clubs.find((club: any) => String(club?.id) === clubId)
          : null;
        if (selectedClub?.name) {
          setClubName(String(selectedClub.name));
        }
      } catch (err) {
        console.error("Error fetching clubs:", err);
      }
    };

    fetchMembers();
    void fetchClubName();
  }, [clubId, router]);

  /* ── Derived ── */
  const groupOptions = [...new Set(
    members.map((m) => m.teamGroup).filter((g): g is number => g !== null)
  )].sort((a, b) => b - a);

  const filtered = members.filter((m) => {
    const matchGroup = selectedGroup === "all" || String(m.teamGroup) === selectedGroup;
    if (!matchGroup) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.jerseyNumber ?? "").toLowerCase().includes(q) ||
      m.cards.some((c) => c.cardCode.toLowerCase().includes(q)) ||
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
            <button className="amp-back-btn" onClick={() => router.push("/admin/players")}>
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
            <h2 className="amp-club-name">{clubName}</h2>
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
            {groupOptions.map((g) => (
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
              onChange={(e) => setSearchTerm(e.target.value)}
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
              {filtered.map((m) => (
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
          onRequestDelete={(member) => {
            setDeleteError("");
            setMemberToDelete(member);
          }}
        />
      )}
      {memberToDelete && (
        <ConfirmDeleteModal
          member={memberToDelete}
          onCancel={() => {
            if (!isDeletingMember) {
              setDeleteError("");
              setMemberToDelete(null);
            }
          }}
          onConfirm={handleDeleteMember}
          isDeleting={isDeletingMember}
          error={deleteError}
        />
      )}
    </main>
  );
}

export default function AdminMembersPage() {
  return (
    <Suspense fallback={<main className="amp-page" />}>
      <AdminMembersPageContent />
    </Suspense>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Card {
  id: string;
  cardCode: string;
  isActive: boolean;
}

interface Member {
  id: string;
  fullName: string;
  nfcTagId: string;
  status: "paid" | "warning" | "overdue";
  teamGroup: number | null;
  jerseyNumber: string | null;
  avatarUrl: string | null;
  lastPaymentDate: string | null;
  club?: {
    id: string;
    name: string;
    slug: string;
  };
  paymentLogs: Array<{
    id: string;
    paidFor: string;
    paidAt: string;
    recordedBy: string;
  }>;
  firstName: string;
  secondName: string;
  visitsTotal: number;
  visitsUsed: number;
  cards: Card[];
}

interface Question {
  id: string;
  text?: string;
  question?: string;
  createdAt: string;
  isActive: boolean;
  answersCount?: number;
}

interface QuestionAnswer {
  id: string;
  answer: string;
  member: {
    firstName: string;
    secondName: string;
  };
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeamGroup, setSelectedTeamGroup] = useState<"all" | string>("all");
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [selectedMemberDetails, setSelectedMemberDetails] = useState<Member | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);
  const [selectedQuestionAnswers, setSelectedQuestionAnswers] = useState<Question | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([]);
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(false);
  const [view, setView] = useState<'members' | 'questions'>('members');
  const [questions, setQuestions] = useState<Question[]>([]);
  const router = useRouter();

  const fetchMembers = async (showLoader = true) => {
    if (showLoader) {
      setIsMembersLoading(true);
    }

    try {
      const response = await fetch("/api/admin/members");
      if (response.ok) {
        const data = await response.json();
        const normalizedMembers: Member[] = (data as Array<Record<string, unknown>>).map((item) => {
          const fullName = String(item.fullName ?? "").trim();
          const parts = fullName.split(/\s+/).filter(Boolean);
          const firstName = parts[0] ?? fullName;
          const secondName = parts.slice(1).join(" ");
          const cards = Array.isArray(item.cards)
            ? (item.cards as Card[])
            : [];
          const activeCard = cards.find((card) => card.isActive);
          const nfcTagId = activeCard?.cardCode ?? cards[0]?.cardCode ?? "";
          const paymentLogs = Array.isArray(item.paymentLogs)
            ? (item.paymentLogs as Member["paymentLogs"])
            : [];

          return {
            id: String(item.id ?? ""),
            fullName,
            nfcTagId,
            status: (item.status as Member["status"]) ?? "paid",
            teamGroup: (item.teamGroup as number | null) ?? null,
            jerseyNumber: (item.jerseyNumber as string | null) ?? null,
            avatarUrl: (item.avatarUrl as string | null) ?? null,
            lastPaymentDate: (item.lastPaymentDate as string | null) ?? null,
            club: (item.club as Member["club"]) ?? undefined,
            paymentLogs,
            firstName,
            secondName,
            visitsTotal: paymentLogs.length,
            visitsUsed: 0,
            cards,
          };
        });
        setMembers(normalizedMembers);
      }
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      if (showLoader) {
        setIsMembersLoading(false);
      }
    }
  };

  const fetchQuestions = async (showLoader = true) => {
    if (showLoader) {
      setIsQuestionsLoading(true);
    }

    try {
      const response = await fetch("/api/admin/questions");
      if (response.ok) {
        const data = await response.json();
        setQuestions(data);
      }
    } catch (err) {
      console.error("Error fetching questions:", err);
    } finally {
      if (showLoader) {
        setIsQuestionsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (view === 'members') {
      fetchMembers();
    } else {
      fetchQuestions();
    }
  }, [view]);

  useEffect(() => {
    if (view !== "questions") return;

    const eventSource = new EventSource("/api/admin/questions/events");
    eventSource.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string };
        if (payload.type === "questions-updated") {
          await fetchQuestions(false);
        }
      } catch (err) {
        console.error("Admin questions SSE parse error:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [view]);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/members/${deletingMember.id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setMembers(members.filter(m => m.id !== deletingMember.id));
        setDeletingMember(null);
      } else {
        alert("Грешка при изтриване на член.");
      }
    } catch (err) {
      console.error("Error deleting member:", err);
      alert("Грешка при изтриване на член.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deletingQuestion) return;

    setIsDeletingQuestion(true);
    try {
      const response = await fetch(`/api/admin/questions/${deletingQuestion.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setQuestions(questions.filter((q) => q.id !== deletingQuestion.id));
        setDeletingQuestion(null);
      } else {
        alert("Грешка при изтриване на въпрос.");
      }
    } catch (err) {
      console.error("Error deleting question:", err);
      alert("Грешка при изтриване на въпрос.");
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  const handleViewAnswers = async (question: Question) => {
    setSelectedQuestionAnswers(question);
    setQuestionAnswers([]);
    setIsLoadingAnswers(true);

    try {
      const response = await fetch(`/api/admin/questions/${question.id}/answers`, {
        cache: "no-store",
      });

      if (!response.ok) {
        alert("Грешка при зареждане на отговорите.");
        return;
      }

      const data: { answers: QuestionAnswer[] } = await response.json();
      setQuestionAnswers(data.answers ?? []);
    } catch (err) {
      console.error("Error fetching question answers:", err);
      alert("Грешка при зареждане на отговорите.");
    } finally {
      setIsLoadingAnswers(false);
    }
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const teamGroupOptions = Array.from(
    new Set(
      members
        .map((member) => member.teamGroup)
        .filter((group): group is number => group !== null)
    )
  ).sort((a, b) => a - b);

  const getStatusMeta = (status: Member["status"]) => {
    if (status === "paid") {
      return {
        label: "Платено",
        color: "#22c55e",
        badgeBackground: "rgba(34, 197, 94, 0.16)",
        badgeBorder: "rgba(34, 197, 94, 0.42)",
      };
    }
    if (status === "warning") {
      return {
        label: "Напомняне",
        color: "#eab308",
        badgeBackground: "rgba(234, 179, 8, 0.16)",
        badgeBorder: "rgba(234, 179, 8, 0.42)",
      };
    }
    return {
      label: "Просрочено",
      color: "#ef4444",
      badgeBackground: "rgba(239, 68, 68, 0.16)",
      badgeBorder: "rgba(239, 68, 68, 0.42)",
    };
  };

  const filteredMembers = members.filter((member) => {
    const matchesGroup =
      selectedTeamGroup === "all" || String(member.teamGroup ?? "") === selectedTeamGroup;

    if (!matchesGroup) return false;
    if (!normalizedSearchTerm) return true;

    const fullName = member.fullName.toLowerCase();
    const idMatch = member.id.toLowerCase().includes(normalizedSearchTerm);
    const nameMatch = fullName.includes(normalizedSearchTerm);
    const jerseyMatch = (member.jerseyNumber ?? "").toLowerCase().includes(normalizedSearchTerm);
    const cardMatch = member.cards.some((card) =>
      card.cardCode.toLowerCase().includes(normalizedSearchTerm)
    );
    const clubMatch = (member.club?.name ?? "").toLowerCase().includes(normalizedSearchTerm);

    return idMatch || nameMatch || jerseyMatch || cardMatch || clubMatch;
  });

  return (
    <div className="container p-6 fade-in">
      <div className="flex-col flex items-center text-center mb-8">
        
        <h1 className="text-gold mb-2" style={{ fontSize: '2rem', fontWeight: '600' }}>
          Администраторски панел
        </h1>
      </div>

      <div className="flex justify-center gap-4 mb-8">
        <button 
          onClick={() => router.push("/admin/members/add")}
          className="btn btn-primary"
        >
          Добави член
        </button>
        <button
          onClick={() => router.push("/admin/notifications")}
          className="btn btn-primary"
        >
          Изпрати известие
        </button>
        <button 
          onClick={() => router.push("/admin/questions/add")}
          className="btn btn-primary"
        >
          Добави въпрос
        </button>
        <button 
          onClick={handleLogout}
          className="btn btn-secondary"
        >
          Изход
        </button>
      </div>

      {/* View Toggle Buttons */}
      <div className="flex justify-center gap-4 mb-8">
        <button 
          onClick={() => setView('members')}
          style={{
            background: 'none',
            border: 'none',
            color: view === 'members' ? 'var(--accent-gold)' : 'var(--text-secondary)',
            borderBottom: view === 'members' ? '3px solid var(--accent-gold-color)' : '3px solid transparent',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            padding: '12px 24px',
            borderRadius: '8px',
            letterSpacing: '0.5px',
            textShadow: view === 'members' ? '0 0 4px rgba(212, 175, 55, 0.3)' : 'none',
            transform: 'scale(1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.textShadow = '0 0 6px rgba(212, 175, 55, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.textShadow = view === 'members' ? '0 0 4px rgba(212, 175, 55, 0.3)' : 'none';
          }}
        >
          Членове
        </button>
        <span style={{ 
          color: 'var(--accent-gold-color)', 
          fontSize: '22px', 
          fontWeight: '700', 
          margin: '0 8px',
          verticalAlign: 'middle',
          textShadow: '0 0 6px rgba(212, 175, 55, 0.4)',
          transition: 'all 0.3s ease'
        }}>|</span>
        <button 
          onClick={() => setView('questions')}
          style={{
            background: 'none',
            border: 'none',
            color: view === 'questions' ? 'var(--accent-gold)' : 'var(--text-secondary)',
            borderBottom: view === 'questions' ? '3px solid var(--accent-gold-color)' : '3px solid transparent',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            padding: '12px 24px',
            borderRadius: '8px',
            letterSpacing: '0.5px',
            textShadow: view === 'questions' ? '0 0 4px rgba(212, 175, 55, 0.3)' : 'none',
            transform: 'scale(1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.textShadow = '0 0 6px rgba(212, 175, 55, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.textShadow = view === 'questions' ? '0 0 4px rgba(212, 175, 55, 0.3)' : 'none';
          }}
        >
          Въпроси
        </button>
      </div>

      {/* Members Grid */}
      {false && view === 'members' && (
        <div className="space-y-6">
          <div className="mb-6 flex justify-center">
            <div style={{ width: "100%", maxWidth: "560px", padding: "20px"}}>
              <div style={{ position: "relative" }}>
              <input
                type="text"
                className="input w-full"
                style={{ paddingRight: "44px" }}
                placeholder="Търси член по име, ID или карта"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchTerm("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "28px",
                    height: "28px",
                    borderRadius: "999px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    fontSize: "16px",
                    lineHeight: 1,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  X
                </button>
              )}
            </div>
          </div>
          </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isMembersLoading ? (
            <div
              className="col-span-full flex items-center justify-center"
              style={{ minHeight: "260px" }}
            >
              <div className="loading"></div>
            </div>
          ) : (
            filteredMembers.map((member) => (
            <div key={member.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-gold mb-1" style={{ fontSize: '1.2rem' }}>
                    {member.fullName}
                  </h3>
                  <p className="text-muted" style={{ fontSize: '0.9rem' }}>ID: {member.id}</p>
                </div>
              </div>

              <div className="visit-info mb-6">
                <div className="visit-item">
                  <span className="visit-number">{member.nfcTagId}</span>
                  <div className="visit-label">Общо</div>
                </div>
                <div className="visit-item">
                  <span className="visit-number">{member.club?.name ?? "-"}</span>
                  <div className="visit-label">Използвани</div>
                </div>
                <div className="visit-item">
                  <span className="visit-number text-gold">
                    {member.status}
                  </span>
                  <div className="visit-label">Остават</div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-secondary text-sm mb-2">
                  Карти: {member.cards.length === 0 && <span className="text-muted">няма карти</span>}
                  {member.cards.map((card, idx) => (
                    <span key={card.id} style={{
                      color: card.isActive ? '#4caf50' : '#f44336'
                    }}>
                      {card.cardCode}{idx < member.cards.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </p>
                {member.cards.length > 0 && (
                  <div className="flex gap-4 text-xs text-muted" style={{ marginTop: "8px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ 
                        width: "8px", 
                        height: "8px", 
                        borderRadius: "50%", 
                        backgroundColor: "#4caf50" 
                      }}></span>
                      Активна
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ 
                        width: "8px", 
                        height: "8px", 
                        borderRadius: "50%", 
                        backgroundColor: "#f44336" 
                      }}></span>
                      Неактивна
                    </span>
                  </div>
                )}
                {/* <div className="flex flex-wrap gap-1">
                  {member.cards.map((card) => (
                    <span key={card.id} className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      card.isActive 
                        ? 'bg-green-900 text-green-200' 
                        : 'bg-red-900 text-red-200'
                    }`}>
                      {card.cardCode}: {card.isActive ? 'Активна' : 'Неактивна'}
                    </span>
                  ))}
                </div> */}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    const activeCard = member.cards.find((card) => card.isActive);
                    if (activeCard) {
                      router.push(`/member/${activeCard.cardCode}`);
                    } else {
                      alert("Този член няма активна карта.");
                    }
                  }}
                  className="btn btn-primary w-full"
                >
                  Виж профил
                </button>
                <button
                  onClick={() => router.push(`/admin/members/${member.id}/edit`)}
                  className="btn btn-secondary w-full"
                >
                  Edit
                </button>
                <button 
                  onClick={() => setDeletingMember(member)}
                  className="btn btn-error w-full"
                >
                  Изтрий член
                </button>
              </div>
            </div>
            ))
          )}
          {!isMembersLoading && filteredMembers.length === 0 && (
            <div className="col-span-full text-center">
              <div className="alert alert-warning">
                <strong>Няма намерени членове</strong>
                <p className="mt-2 mb-0">Все още няма добавени членове в системата.</p>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {view === "members" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedTeamGroup("all")}
              className="btn"
              style={{
                minWidth: "96px",
                background:
                  selectedTeamGroup === "all"
                    ? "linear-gradient(135deg, #34d399, #22c55e)"
                    : "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                color: selectedTeamGroup === "all" ? "#032011" : "var(--text-secondary)",
                fontWeight: 700,
              }}
            >
              Всички
            </button>
            {teamGroupOptions.map((group) => {
              const isActive = selectedTeamGroup === String(group);
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => setSelectedTeamGroup(String(group))}
                  className="btn"
                  style={{
                    minWidth: "96px",
                    background: isActive
                      ? "linear-gradient(135deg, #34d399, #22c55e)"
                      : "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    color: isActive ? "#032011" : "var(--text-secondary)",
                    fontWeight: 700,
                  }}
                >
                  {group}
                </button>
              );
            })}
          </div>

          <div style={{ position: "relative" }}>
            <input
              type="text"
              className="input w-full"
              style={{ paddingRight: "44px" }}
              placeholder="Търси по име или номер..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "28px",
                  height: "28px",
                  borderRadius: "999px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                  fontSize: "16px",
                  lineHeight: 1,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                X
              </button>
            )}
          </div>

          <div className="space-y-4">
            {isMembersLoading ? (
              <div className="col-span-full flex items-center justify-center" style={{ minHeight: "260px" }}>
                <div className="loading"></div>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const statusMeta = getStatusMeta(member.status);
                const initials = member.fullName.trim().charAt(0).toUpperCase() || "?";
                const activeCard = member.cards.find((card) => card.isActive);

                return (
                  <div
                    key={member.id}
                    className="card"
                    onClick={() => setSelectedMemberDetails(member)}
                    style={{
                      border: `1px solid ${statusMeta.badgeBorder}`,
                      background:
                        "linear-gradient(90deg, rgba(27, 27, 28, 0.95), rgba(18, 18, 18, 0.88), rgba(27, 27, 28, 0.95))",
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.fullName}
                            style={{
                              width: "56px",
                              height: "56px",
                              borderRadius: "999px",
                              objectFit: "cover",
                              border: `2px solid ${statusMeta.badgeBorder}`,
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "56px",
                              height: "56px",
                              borderRadius: "999px",
                              background: statusMeta.badgeBackground,
                              border: `2px solid ${statusMeta.badgeBorder}`,
                              color: statusMeta.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: "1.3rem",
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-gold mb-0" style={{ fontSize: "1.6rem", lineHeight: 1.15 }}>
                              {member.fullName}
                            </h3>
                            <span
                              style={{
                                padding: "4px 12px",
                                borderRadius: "999px",
                                fontSize: "0.9rem",
                                fontWeight: 700,
                                color: statusMeta.color,
                                background: statusMeta.badgeBackground,
                                border: `1px solid ${statusMeta.badgeBorder}`,
                              }}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          <p className="text-muted mt-2 mb-0" style={{ fontSize: "0.9rem" }}>
                            № {member.jerseyNumber ?? "-"} | Група {member.teamGroup ?? "-"} | Карта {activeCard?.cardCode ?? "-"}
                          </p>
                        </div>
                      </div>
                      <span
                        style={{
                          padding: "10px 16px",
                          borderRadius: "12px",
                          fontSize: "1rem",
                          fontWeight: 800,
                          color: "#041209",
                          background:
                            member.status === "paid"
                              ? "linear-gradient(135deg, #34d399, #22c55e)"
                              : member.status === "warning"
                                ? "linear-gradient(135deg, #fde047, #facc15)"
                                : "linear-gradient(135deg, #f87171, #ef4444)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeCard) {
                            router.push(`/member/${activeCard.cardCode}`);
                          } else {
                            alert("Този играч няма активна карта.");
                          }
                        }}
                        className="btn btn-primary w-full"
                      >
                        Виж профил
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/members/${member.id}/edit`);
                        }}
                        className="btn btn-secondary w-full"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingMember(member);
                        }}
                        className="btn btn-error w-full"
                      >
                        Изтрий
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {!isMembersLoading && filteredMembers.length === 0 && (
              <div className="text-center">
                <div className="alert alert-warning">
                  <strong>Няма намерени играчи</strong>
                  <p className="mt-2 mb-0">Промени търсенето или Team Group филтъра.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Questions Grid */}
      {view === 'questions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isQuestionsLoading ? (
            <div
              className="col-span-full flex items-center justify-center"
              style={{ minHeight: "260px" }}
            >
              <div className="loading"></div>
            </div>
          ) : (
            questions.map((question, index) => (
              <div key={question.id || index} className="card">
                <div className="mb-4">
                  <h3 className="text-gold mb-2" style={{ fontSize: '1rem', fontWeight: '600' }}>
                    Въпрос #{questions.length - index}
                  </h3>
                  <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {new Date(question.createdAt).toLocaleDateString('bg-BG')}
                  </p>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '8px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: question.isActive ? '#bbf7d0' : '#fecaca',
                      background: question.isActive ? 'rgba(22, 101, 52, 0.45)' : 'rgba(127, 29, 29, 0.45)',
                      border: `1px solid ${question.isActive ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 68, 68, 0.55)'}`,
                    }}
                  >
                    {question.isActive ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
                
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  minHeight: '80px'
                }}>
                  {question.text || question.question}
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleViewAnswers(question)}
                    className="btn btn-primary w-full"
                  >
                    Виж отговори ({question.answersCount ?? 0})
                  </button>
                  <button
                    onClick={() => router.push(`/admin/questions/${question.id}/edit`)}
                    className="btn btn-secondary w-full"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingQuestion(question)}
                    className="btn btn-error w-full"
                  >
                    Изтрий
                  </button>
                </div>
              </div>
            ))
          )}
          {!isQuestionsLoading && questions.length === 0 && (
            <div className="col-span-full text-center">
              <div className="alert alert-warning">
                <strong>Няма намерени въпроси</strong>
                <p className="mt-2 mb-0">Все още няма добавени въпроси в системата.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedMemberDetails && (
        <div className="modal-overlay" onClick={() => setSelectedMemberDetails(null)}>
          <div
            className="modal-content fade-in"
            style={{ maxWidth: "680px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const statusMeta = getStatusMeta(selectedMemberDetails.status);
              const paymentHistory = [...selectedMemberDetails.paymentLogs].sort(
                (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
              );
              const lastPayment = paymentHistory[0];

              return (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-gold" style={{ fontSize: "1.8rem", margin: 0 }}>
                      Статистика - {selectedMemberDetails.fullName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberDetails(null)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--text-secondary)",
                        fontSize: "2rem",
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div
                    style={{
                      border: `1px solid ${statusMeta.badgeBorder}`,
                      borderRadius: "20px",
                      padding: "24px",
                      background:
                        "linear-gradient(90deg, rgba(27, 27, 28, 0.95), rgba(18, 18, 18, 0.88), rgba(27, 27, 28, 0.95))",
                    }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <p className="text-muted mb-1">Име</p>
                        <p style={{ fontSize: "1.7rem", fontWeight: 700, margin: 0 }}>
                          {selectedMemberDetails.fullName}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted mb-1">Набор</p>
                        <p style={{ fontSize: "1.7rem", fontWeight: 700, margin: 0 }}>
                          {selectedMemberDetails.teamGroup ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted mb-1">Статус</p>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 14px",
                            borderRadius: "999px",
                            fontSize: "1rem",
                            fontWeight: 800,
                            color: statusMeta.color,
                            background: statusMeta.badgeBackground,
                            border: `1px solid ${statusMeta.badgeBorder}`,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <div>
                        <p className="text-muted mb-1">Последно плащане</p>
                        <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                          {lastPayment
                            ? new Date(lastPayment.paidAt).toLocaleDateString("bg-BG")
                            : "Няма плащания"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <details
                    style={{
                      marginTop: "16px",
                      border: "1px solid var(--border-color)",
                      borderRadius: "16px",
                      background: "rgba(0,0,0,0.35)",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        padding: "16px 18px",
                        fontWeight: 800,
                        letterSpacing: "0.4px",
                      }}
                    >
                      История на плащанията
                    </summary>
                    <div style={{ padding: "0 18px 16px 18px" }}>
                      {paymentHistory.length === 0 ? (
                        <p className="text-muted mb-0">Няма записани плащания за този играч.</p>
                      ) : (
                        <div className="space-y-2">
                          {paymentHistory.map((payment) => (
                            <div
                              key={payment.id}
                              style={{
                                border: "1px solid var(--border-color)",
                                borderRadius: "10px",
                                padding: "10px 12px",
                                background: "rgba(17, 17, 17, 0.8)",
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{payment.paidFor}</div>
                              <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                                {new Date(payment.paidAt).toLocaleString("bg-BG")}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {deletingMember && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <h3 className="text-gold mb-4">Потвърждение</h3>
            <p className="mb-6">
              Сигурни ли сте, че искате да изтриете член <br />
              <strong>{deletingMember.firstName} {deletingMember.secondName}</strong>?
              <br />
              <span className="text-error" style={{ fontSize: '0.85rem' }}>
                Това действие е необратимо и ще изтрие и свързаната карта.
              </span>
            </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => setDeletingMember(null)}
                className="btn btn-secondary px-6"
                disabled={isDeleting}
              >
                Отказ
              </button>
              <button 
                onClick={handleDelete}
                className="btn btn-error px-6"
                disabled={isDeleting}
              >
                {isDeleting ? "Изтриване..." : "Изтрий"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingQuestion && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <h3 className="text-gold mb-4">Потвърждение</h3>
            <p className="mb-6">
              Сигурни ли сте, че искате да изтриете този въпрос?
              <br />
              <strong>{deletingQuestion.text || deletingQuestion.question || "Въпрос"}</strong>
              <br />
              <span className="text-error" style={{ fontSize: "0.85rem" }}>
                Това действие е необратимо.
              </span>
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setDeletingQuestion(null)}
                className="btn btn-secondary px-6"
                disabled={isDeletingQuestion}
              >
                Отказ
              </button>
              <button
                onClick={handleDeleteQuestion}
                className="btn btn-error px-6"
                disabled={isDeletingQuestion}
              >
                {isDeletingQuestion ? "Изтриване..." : "Изтрий"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedQuestionAnswers && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 className="text-gold mb-4">Отговори за въпрос</h3>
            <div className="mb-4" style={{ 
              background: 'var(--bg-secondary)', 
              padding: '16px', 
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <p style={{ fontSize: '16px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                {selectedQuestionAnswers.text || selectedQuestionAnswers.question || "Въпрос"}
              </p>
            </div>
            
            <div className="mb-6">
              <h4 style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                {questionAnswers.length} отговора:
              </h4>
              
              {isLoadingAnswers ? (
                <div className="flex flex-col items-center justify-center" style={{ minHeight: '140px' }}>
                  <div className="loading mb-3"></div>
                  <p className="text-secondary">Зареждане на отговорите...</p>
                </div>
              ) : questionAnswers.length === 0 ? (
                <div className="alert alert-warning">
                  Все още няма отговори за този въпрос.
                </div>
              ) : (
                <div style={{ 
                  maxHeight: '300px', 
                  overflow: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary)'
                }}>
                  {questionAnswers.map((item: QuestionAnswer, index: number) => (
                    <div key={item.id} style={{ 
                      padding: '12px 16px',
                      borderBottom: index < questionAnswers.length - 1 ? '1px solid var(--border-color)' : 'none',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--accent-gold-color)' }}>
                        {item.member.firstName && item.member.secondName 
                          ? `${item.member.firstName} ${item.member.secondName}` 
                          : item.member.firstName || item.member.secondName}
                      </div>
                      <div style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>{item.answer}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setSelectedQuestionAnswers(null)}
                className="btn btn-secondary px-6"
              >
                Затвори
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


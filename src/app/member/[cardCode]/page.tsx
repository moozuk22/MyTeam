"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

interface MemberProfile {
  id: string;
  cardCode: string;
  name: string;
  jerseyNumber?: string | null;
  birthDate?: string | null;
  isActive?: boolean;
  team_group?: number | null;
  status?: "paid" | "warning" | "overdue";
  last_payment_date?: string | null;
  notifications?: Array<{
    id: string;
    title: string;
    sentAt: string;
  }>;
}

const SPEED_LINES = [8, 16, 24, 33, 42, 54, 65, 76, 85, 93];

const ClubLogo = () => (
  <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
    <path d="M60 2 L115 20 L115 85 Q115 120 60 138 Q5 120 5 85 L5 20 Z" fill="#1a5c1a" stroke="#32cd32" strokeWidth="3" />
    <path d="M60 8 L109 24 L109 83 Q109 114 60 132 Q11 114 11 83 L11 24 Z" fill="#0d3d0d" />
    <rect x="15" y="18" width="90" height="22" rx="2" fill="#1a5c1a" />
    <text x="60" y="33" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="Arial, sans-serif">ФК ВИХЪР</text>
    <rect x="20" y="44" width="16" height="40" fill="#ffffff" />
    <rect x="36" y="44" width="16" height="40" fill="#32cd32" />
    <rect x="52" y="44" width="16" height="40" fill="#ffffff" />
    <rect x="68" y="44" width="16" height="40" fill="#32cd32" />
    <rect x="84" y="44" width="16" height="40" fill="#ffffff" />
    <circle cx="60" cy="64" r="14" fill="#1a5c1a" stroke="#32cd32" strokeWidth="1.5" />
    <circle cx="60" cy="64" r="10" fill="none" stroke="#ffffff" strokeWidth="1" />
    <text x="60" y="68" textAnchor="middle" fill="#ffffff" fontSize="12">⚽</text>
    <rect x="15" y="88" width="90" height="20" rx="2" fill="#1a5c1a" />
    <text x="60" y="102" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="700" fontFamily="Arial, sans-serif">ВОЙВОДИНОВО</text>
    <text x="60" y="122" textAnchor="middle" fill="#32cd32" fontSize="14" fontWeight="800" fontFamily="Arial, sans-serif">1961</text>
  </svg>
);

const STATUS_MAP = {
  paid: { label: "ТАКСА: ПЛАТЕНА", cls: "green glow" },
  warning: { label: "ПРЕДСТОЯЩО ПЛАЩАНЕ", cls: "yellow glow-yellow" },
  overdue: { label: "ТАКСА: ДЪЛЖИМА", cls: "red glow-red" },
} as const;

const ShareIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v13" />
    <path d="m16 6-4-4-4 4" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export default function MemberCardPage({
  params,
}: {
  params: Promise<{ cardCode: string }>;
}) {
  const { cardCode } = use(params);
  const router = useRouter();

  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);

  useEffect(() => {
    const fetchMember = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/members/${cardCode}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          setMember(null);
          setError("Профилът не е намерен.");
          return;
        }
        const data = (await response.json()) as MemberProfile;
        setMember(data);
      } catch (e) {
        console.error("Failed to fetch member:", e);
        setError("Възникна грешка при зареждане.");
      } finally {
        setLoading(false);
      }
    };

    void fetchMember();
  }, [cardCode]);

  const statusKey = member?.status ?? "paid";
  const status = STATUS_MAP[statusKey];
  const lastPaymentText = member?.last_payment_date
    ? new Date(member.last_payment_date).toLocaleDateString("bg-BG")
    : "Няма плащане";
  const birthDateText = member?.birthDate
    ? new Date(member.birthDate).toLocaleDateString("bg-BG")
    : "-";

  if (loading) {
    return (
      <main className="page-bg">
        <div className="page-inner">
          <div className="card-shell">
            <div className="card-body">
              <p style={{ color: "rgba(255,255,255,0.7)", textAlign: "center" }}>Зареждане...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !member) {
    return (
      <main className="page-bg">
        <div className="page-inner">
          <div className="card-shell">
            <div className="card-body" style={{ gap: "12px" }}>
              <p style={{ color: "#e03535", textAlign: "center", margin: 0 }}>{error ?? "Профилът не е намерен."}</p>
              <button className="add-btn" onClick={() => router.push("/admin/members")}>
                Назад
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg">
      <div className="page-inner">
        <div className="card-shell">
          <div className="speed-lines-layer" aria-hidden="true">
            {SPEED_LINES.map((left, i) => (
              <div
                key={i}
                className="speed-line"
                style={{
                  left: `${left}%`,
                  width: i % 3 === 0 ? "3px" : "2px",
                  opacity: 0.06 + (i % 3) * 0.03,
                  filter: `blur(${i % 2 === 0 ? 1 : 3}px)`,
                }}
              />
            ))}
            <div className="speed-line speed-line--wide" style={{ left: "18%" }} />
            <div className="speed-line speed-line--wide2" style={{ left: "70%" }} />
          </div>
          <div className="vignette" aria-hidden="true" />

          <div className="card-body">
            <div className="header">
              <div className="header-logo"><ClubLogo /></div>
              <div className="header-center">
                <h1 className="card-title">КЛУБНА КАРТА <span>2026</span></h1>
                <p className="card-subtitle">ФК Вихър Войводиново</p>
              </div>
              <div className="shield">
                <svg viewBox="0 0 50 56" fill="none" className="shield-bg">
                  <path d="M25 2 L47 12 L47 35 Q47 50 25 54 Q3 50 3 35 L3 12 Z" fill="rgba(50,205,50,0.1)" stroke="#32cd32" strokeWidth="2.5" />
                </svg>
                <span className="shield-num">
                  {member.jerseyNumber ? `№${member.jerseyNumber}` : "\u2116 3"}
                </span>
              </div>
            </div>

            <div className="divider" />

            <div className="central">
              <div className="photo-wrap">
                <div className="photo-inner">
                  <span className="photo-letter">
                    {(member.name?.trim()?.charAt(0) || "?").toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="divider divider--short" />
              <div className="info-rows">
                <div className="info-row">
                  <span className="info-lbl">Име:</span>
                  <span className="info-val">{member.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Роден:</span>
                  <span className="info-val">{birthDateText}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Набор:</span>
                  <span className="info-val green">{member.team_group ?? "-"}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Статус:</span>
                  <span className={`info-val ${status.cls}`}>{status.label}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Последно плащане:</span>
                  <span className="info-val">{lastPaymentText}</span>
                </div>
              </div>
            </div>

            <div className="divider divider--mt" />
          </div>
        </div>

        <div className="below-card">
          <button className="add-btn" onClick={() => setInstructionsOpen((v) => !v)}>
            <ShareIcon size={16} />
            Добавете към начален екран
          </button>

          <p className="hint-text">
            За да активирате известията на iPhone, натиснете бутона Share и изберете &ldquo;Добавяне към начален екран&rdquo;.
          </p>

          {instructionsOpen && (
            <div className="instr-box">
              <button className="instr-close" onClick={() => setInstructionsOpen(false)} aria-label="Затвори">
                <XIcon />
              </button>
              <p className="instr-heading">Как да активирате известия на iPhone:</p>
              <ol className="instr-list">
                <li>
                  <span className="step-badge">1</span>
                  <span>Натиснете бутона <ShareIcon size={14} /> <strong>Share</strong> в долната лента на Safari</span>
                </li>
                <li>
                  <span className="step-badge">2</span>
                  <span>Превъртете надолу и изберете <PlusIcon /> <strong>&ldquo;Добавяне към начален екран&rdquo;</strong></span>
                </li>
                <li>
                  <span className="step-badge">3</span>
                  <span>Отворете приложението от началния екран и натиснете <strong>&ldquo;Активиране на известия&rdquo;</strong></span>
                </li>
              </ol>
            </div>
          )}
        </div>

        <p className="push-hint">Получавайте push известия дори когато браузърът е затворен.</p>

        <div className="accordion" style={{ marginTop: "14px" }}>
          <button className="accordion-btn" onClick={() => setAccordionOpen((v) => !v)}>
            <span>История на плащания<span className="acc-count"> ({member.notifications?.length ?? 0})</span></span>
            <svg className={`chevron${accordionOpen ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div className={`acc-body${accordionOpen ? " acc-body--open" : ""}`}>
            <div className="acc-inner">
              <div className="acc-scroll">
                <div className="payment-list">
                  {member.notifications && member.notifications.length > 0 ? (
                    member.notifications.map((item) => (
                      <div className="payment-row" key={item.id}>
                        <div className="payment-info">
                          <p className="p-month">{item.title}</p>
                          <p className="p-date">{new Date(item.sentAt).toLocaleDateString("bg-BG")}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="payment-row">
                      <div className="payment-info">
                        <p className="p-month">Няма налична история.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

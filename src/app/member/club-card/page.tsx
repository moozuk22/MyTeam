"use client";
import { useState } from "react";
import "./page.css";

const ClubLogo = () => (
  <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
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

const SPEED_LINES = [8, 16, 24, 33, 42, 54, 65, 76, 85, 93];

// status: "paid" | "upcoming" | "overdue"
const PLAYER = {
  name: "Георги Петров",
  born: "25.07.2018",
  group: "2018",
  status: "paid", // change to "upcoming" or "overdue" to see variants
  lastPayment: "01.03.2026",
};

const STATUS_MAP = {
  paid:     { label: "ТАКСА: ПЛАТЕНА",       cls: "green glow" },
  upcoming: { label: "ПРЕДСТОЯЩО ПЛАЩАНЕ",   cls: "yellow glow-yellow" },
  overdue:  { label: "ТАКСА: ДЪЛЖИМА",       cls: "red glow-red" },
};

const payments = [
  { month: "Март 2026",     date: "01.03.2026" },
  { month: "Март 2026",     date: "01.03.2026" },
  { month: "Февруари 2026", date: "26.02.2026" },
  { month: "Февруари 2026", date: "25.02.2026" },
  { month: "Февруари 2026", date: "24.02.2026" },
  { month: "Февруари 2026", date: "23.02.2026" },
  { month: "Януари 2026",   date: "31.01.2026" },
  { month: "Януари 2026",   date: "15.01.2026" },
  { month: "Декември 2025", date: "20.12.2025" },
];

/* ── Icons ── */
const ShareIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v13"/><path d="m16 6-4-4-4 4"/>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="M12 5v14"/>
  </svg>
);
const XIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);
const FileTextIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
    <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
    <path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
  </svg>
);
const PrinterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/>
    <rect x="6" y="14" width="12" height="8" rx="1"/>
  </svg>
);

/* ── Receipt Modal ── */
function ReceiptModal({ payment, onClose }) {
  const handlePrint = () => window.print();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} id="receipt-modal">
        <button className="modal-close" onClick={onClose} aria-label="Затвори">
          <XIcon size={16}/>
        </button>

        <div className="receipt-content">
          <div className="receipt-header">
            <h2 className="receipt-club">ФК Вихър Войводиново</h2>
            <p className="receipt-subtitle">Разписка за членски внос</p>
          </div>

          <hr className="receipt-divider"/>

          <div className="receipt-rows">
            <div className="receipt-row">
              <span className="receipt-lbl">Играч:</span>
              <span className="receipt-val">{PLAYER.name}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-lbl">Период:</span>
              <span className="receipt-val">{payment.month}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-lbl">Дата на плащане:</span>
              <span className="receipt-val">{payment.date}</span>
            </div>
          </div>

          <hr className="receipt-divider"/>

          <div className="receipt-stamp-wrap">
            <div className="receipt-stamp">
              <span>ПЛАТЕНО</span>
            </div>
          </div>
        </div>

        <div className="receipt-actions">
          <button className="receipt-print-btn" onClick={handlePrint}>
            <PrinterIcon/>
            Принтирай / Запази
          </button>
          <button className="receipt-close-btn" onClick={onClose}>
            <XIcon size={14}/>
            Затвори
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function ClubCardPage() {
  const [accordionOpen, setAccordionOpen]     = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [receipt, setReceipt]                 = useState(null); // payment obj or null

  const status = STATUS_MAP[PLAYER.status];

  return (
    <main className="page-bg">
      <div className="page-inner">

        {/* ── Card ── */}
        <div className="card-shell">
          <div className="speed-lines-layer" aria-hidden="true">
            {SPEED_LINES.map((left, i) => (
              <div key={i} className="speed-line" style={{
                left: `${left}%`,
                width: i % 3 === 0 ? "3px" : "2px",
                opacity: 0.06 + (i % 3) * 0.03,
                filter: `blur(${i % 2 === 0 ? 1 : 3}px)`,
              }}/>
            ))}
            <div className="speed-line speed-line--wide" style={{ left: "18%" }}/>
            <div className="speed-line speed-line--wide2" style={{ left: "70%" }}/>
          </div>
          <div className="vignette" aria-hidden="true"/>

          <div className="card-body">
            <div className="header">
              <div className="header-logo"><ClubLogo /></div>
              <div className="header-center">
                <h1 className="card-title">КЛУБНА КАРТА <span>2026</span></h1>
                <p className="card-subtitle">ФК Вихър Войводиново</p>
              </div>
              <div className="shield">
                <svg viewBox="0 0 50 56" fill="none" className="shield-bg">
                  <path d="M25 2 L47 12 L47 35 Q47 50 25 54 Q3 50 3 35 L3 12 Z" fill="rgba(50,205,50,0.1)" stroke="#32cd32" strokeWidth="2.5"/>
                </svg>
                <span className="shield-num">№3</span>
              </div>
            </div>

            <div className="divider"/>

            <div className="central">
              <div className="photo-wrap">
                <div className="photo-inner">
                  <span className="photo-letter">Г</span>
                </div>
              </div>
              <div className="divider divider--short"/>
              <div className="info-rows">
                <div className="info-row">
                  <span className="info-lbl">Име:</span>
                  <span className="info-val">{PLAYER.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Роден:</span>
                  <span className="info-val">{PLAYER.born}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Набор:</span>
                  <span className="info-val green">{PLAYER.group}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Статус:</span>
                  <span className={`info-val ${status.cls}`}>{status.label}</span>
                </div>
                <div className="info-row">
                  <span className="info-lbl">Последно плащане:</span>
                  <span className="info-val">{PLAYER.lastPayment}</span>
                </div>
              </div>
            </div>

            <div className="divider divider--mt"/>
          </div>
        </div>

        {/* ── Below card ── */}
        <div className="below-card">
          <button className="add-btn" onClick={() => setInstructionsOpen(v => !v)}>
            <ShareIcon size={16}/>
            Добавете към начален екран
          </button>

          <p className="hint-text">
            За да активирате известията на iPhone, натиснете бутона Share и изберете &ldquo;Добавяне към начален екран&rdquo;.
          </p>

          {instructionsOpen && (
            <div className="instr-box">
              <button className="instr-close" onClick={() => setInstructionsOpen(false)} aria-label="Затвори">
                <XIcon/>
              </button>
              <p className="instr-heading">Как да активирате известия на iPhone:</p>
              <ol className="instr-list">
                <li>
                  <span className="step-badge">1</span>
                  <span>Натиснете бутона <ShareIcon size={14}/> <strong>Share</strong> в долната лента на Safari</span>
                </li>
                <li>
                  <span className="step-badge">2</span>
                  <span>Превъртете надолу и изберете <PlusIcon/> <strong>&ldquo;Добавяне към начален екран&rdquo;</strong></span>
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

        {/* ── Accordion ── */}
        <div className="accordion">
          <button className="accordion-btn" onClick={() => setAccordionOpen(v => !v)}>
            <span>История на плащанията<span className="acc-count"> ({payments.length})</span></span>
            <svg className={`chevron${accordionOpen ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          <div className={`acc-body${accordionOpen ? " acc-body--open" : ""}`}>
            <div className="acc-inner">
              <div className="acc-scroll">
                <div className="payment-list">
                  {payments.map((p, i) => (
                    <div className="payment-row" key={i}>
                      <div className="payment-info">
                        <p className="p-month">{p.month}</p>
                        <p className="p-date">{p.date}</p>
                      </div>
                      <button className="receipt-btn" onClick={() => setReceipt(p)}>
                        <FileTextIcon/>
                        Разписка
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Receipt Modal ── */}
      {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)}/>}

    </main>
  );
}
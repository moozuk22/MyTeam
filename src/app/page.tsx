"use client";

import { useEffect, useRef } from "react";
import "./page.css";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    type P = {
      x: number; y: number; r: number;
      dx: number; dy: number;
      alpha: number; da: number;
      type: number;
    };

    const W = canvas.width;
    const H = canvas.height;

    const particles: P[] = Array.from({ length: 140 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.2,
      dx: (Math.random() - 0.5) * 0.16,
      dy: (Math.random() - 0.5) * 0.16,
      alpha: Math.random() * 0.9,
      da: (Math.random() - 0.5) * 0.007,
      type: Math.floor(Math.random() * 3),
    }));

    const COLORS = [
      (a: number) => `rgba(149,211,174,${a})`,
      (a: number) => `rgba(217,243,216,${a * 0.7})`,
      (a: number) => `rgba(180,223,177,${a * 0.8})`,
    ];

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[p.type](Math.max(0, Math.min(0.9, p.alpha)));
        ctx.fill();
        p.x += p.dx; p.y += p.dy; p.alpha += p.da;
        if (p.alpha <= 0 || p.alpha >= 0.90) p.da *= -1;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <main className="page">
      <div className="bg-base" />
      <div className="bg-spots" />
      <div className="bg-pitch" />
      <canvas ref={canvasRef} className="particles-canvas" />

      <div className="content">

        {/* ── HERO ROW ── */}
        <div className="hero-row">

          {/* CLUB CARD */}
          <div className="club-card">
            <div className="card-player">
              <img src="./footballer.png" alt="Footballer" />
            </div>
            <div className="club-card-inner">
              <span className="card-label">Клубна карта 2026</span>
              <div className="card-team-name">My Team</div>
              <div>
                <div className="card-member-label">Иmе:</div>
                <div className="card-member-name">Moozuk</div>
              </div>
              <div className="card-number">№ 88888888</div>
            </div>
          </div>

          {/* PHONE */}
          <div className="phone">
            <div className="phone-notch" />
            <div className="phone-status-bar">
              <span>▲▲</span>
              <BatterySVG />
            </div>
            <div className="phone-screen">
              <div className="phone-top-bar">
                <span className="phone-back-arrow">‹</span>
                <BellSVG />
              </div>
              <div className="phone-player-area">
                <img src="./footballer-phone.jpg" alt="" />
              </div>
              <div className="phone-name">Moozuk</div>
              {/* <div className="phone-stats-row">
                <span className="phone-stat"><ClockSVG />&nbsp;5.9ТТ.Ш</span>
                <div className="phone-stat-divider" />
                <span className="phone-stat">NV5</span>
              </div> */}
              <div className="status-btn">
                {/* <span className="status-btn-label">STATUS</span> */}
                <span className="status-btn-text">ПЛАТЕНО</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── FEATURE CARDS ── */}
        <div className="features-row">
          <div className="feature-card">
            <div className="feature-icon"><PieSVG /></div>
            <span className="feature-label">Лесно<br />проследяване</span>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><ShieldSVG /></div>
            <span className="feature-label">Повишена<br />сигурност</span>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><OrgSVG /></div>
            <span className="feature-label">По-добра<br />организация</span>
          </div>
        </div>

        {/* ── HEADLINE ── */}
        <div className="headline-wrap">
          <span className="headline-1">БЪДЕЩЕТО</span>
          <span className="headline-2">НА ВАШИЯ КЛУБ</span>
        </div>

        {/* ── POWERED BY ── */}
        <div className="powered-by">
          <span className="powered-by-italic">powered by</span>
          <MoozukSVG />
          <span className="powered-by-brand">Moozuk22 OS</span>
        </div>

      </div>
    </main>
  );
}

/* ────────────────────────────────────────────
   FOOTBALLER SILHOUETTE — kicking pose with #10
   Two variants: "card" (smaller area) and "phone"
──────────────────────────────────────────── */
function FootballerSVG({ variant }: { variant: "card" | "phone" }) {
  const isPhone = variant === "phone";
  const glowColor1 = isPhone ? "#7c3aed" : "#8b5cf6";
  const glowColor2 = isPhone ? "#4c1d95" : "#5b21b6";

  return (
    <svg
      viewBox="0 0 100 180"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMax meet"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <radialGradient id={`fg-${variant}`} cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor={glowColor1} stopOpacity="1" />
          <stop offset="55%" stopColor={glowColor2} stopOpacity="0.88" />
          <stop offset="100%" stopColor="#1e0a40" stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id={`bg-glow-${variant}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={glowColor1} stopOpacity="0.55" />
          <stop offset="100%" stopColor={glowColor2} stopOpacity="0" />
        </radialGradient>
        <filter id={`blur-${variant}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Ambient glow behind player */}
      <ellipse cx="50" cy="110" rx="44" ry="70"
        fill={`url(#bg-glow-${variant})`} />

      {/* ── Silhouette path — full kicking figure ── */}
      <g fill={`url(#fg-${variant})`} filter={`url(#blur-${variant})`}>

        {/* HEAD */}
        <ellipse cx="50" cy="16" rx="9.5" ry="10.5" />

        {/* NECK */}
        <rect x="46.5" y="25" width="7" height="7" rx="2.5" />

        {/* TORSO — slightly angled forward */}
        <path d="M37,32 C34,34 33,46 34,58 L67,58 C68,46 66,34 63,32 Z" />

        {/* #10 on shirt */}
        <text
          x="50" y="50"
          textAnchor="middle"
          fontSize="10"
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
          fill="rgba(255,255,255,0.82)"
          style={{ filter: "drop-shadow(0 0 4px rgba(200,180,255,0.9))" }}
        >10</text>

        {/* LEFT ARM — swung back for balance */}
        <path d="M37,36 C30,39 22,36 16,28" fill="none"
          stroke={`url(#fg-${variant})`} strokeWidth="9" strokeLinecap="round" />
        <ellipse cx="14" cy="26" rx="5" ry="5" />

        {/* RIGHT ARM — extended forward */}
        <path d="M63,36 C70,39 78,44 84,50" fill="none"
          stroke={`url(#fg-${variant})`} strokeWidth="9" strokeLinecap="round" />
        <ellipse cx="86" cy="51" rx="5" ry="5" />

        {/* LEFT LEG — planted, weight-bearing */}
        {/* Upper */}
        <path d="M41,58 C39,72 38,86 37,100" fill="none"
          stroke={`url(#fg-${variant})`} strokeWidth="12" strokeLinecap="round" />
        {/* Lower */}
        <path d="M37,100 C36,112 36,122 37,132" fill="none"
          stroke={`url(#fg-${variant})`} strokeWidth="10" strokeLinecap="round" />
        {/* Boot */}
        <ellipse cx="35" cy="135" rx="10" ry="5.5" />

        {/* RIGHT LEG — kicking, lifted and extended */}
        {/* Upper — swings forward-up */}
        <path d="M59,58 C63,68 72,76 82,82" fill="none"
          stroke={`url(#fg-${variant})`} strokeWidth="12" strokeLinecap="round" />
        {/* Lower — bent back */}
        <path d="M82,82 C88,88 92,96 88,104" fill="none"
          stroke={`url(#fg-${variant})`} strokeWidth="10" strokeLinecap="round" />
        {/* Boot — pointed at ball */}
        <ellipse cx="86" cy="107" rx="9" ry="5" transform="rotate(-25 86 107)" />

        {/* BALL on ground near left foot */}
        <circle cx="22" cy="148" r="12" />
        {/* Ball detail */}
        <path d="M22,137 L28,142 L26,149 L18,149 L16,142 Z"
          fill="rgba(0,0,0,0.20)" />
        <circle cx="22" cy="148" r="12" fill="none"
          stroke="rgba(220,200,255,0.22)" strokeWidth="1" />
      </g>

      {/* Top edge glow highlight */}
      <ellipse cx="50" cy="16" rx="9.5" ry="10.5"
        fill="none" stroke="rgba(200,180,255,0.35)" strokeWidth="1" />
    </svg>
  );
}

function PieSVG() {
  return (
    <svg viewBox="0 0 54 54" width="54" height="54" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pie-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#95d3ae" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2d5038" stopOpacity="0"    />
        </radialGradient>
      </defs>
      <circle cx="27" cy="27" r="25" fill="url(#pie-bg)" />
      <path d="M27,27 L27,5 A22,22 0 1,1 6.2,36 Z" fill="rgba(48,120,68,0.92)" />
      <path d="M27,27 L6.2,36 A22,22 0 0,1 27,5 Z" fill="rgba(149,211,100,0.90)" />
      <line x1="27" y1="27" x2="27"  y2="5"  stroke="rgba(4,10,6,0.88)" strokeWidth="2" />
      <line x1="27" y1="27" x2="6.2" y2="36" stroke="rgba(4,10,6,0.88)" strokeWidth="2" />
      <circle cx="27" cy="27" r="8" fill="rgba(8,10,20,0.95)" />
      <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(149,211,174,0.14)" strokeWidth="1" />
    </svg>
  );
}

function ShieldSVG() {
  return (
    <svg viewBox="0 0 54 54" width="54" height="54" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sh-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#95d3ae" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#2d5038" stopOpacity="0"    />
        </radialGradient>
      </defs>
      <circle cx="27" cy="27" r="25" fill="url(#sh-bg)" />
      <path d="M27,8 L43,14.5 L43,29 C43,40 35,47.5 27,49.5 C19,47.5 11,40 11,29 L11,14.5 Z"
        fill="rgba(20,55,28,0.18)" stroke="rgba(149,211,120,0.78)"
        strokeWidth="1.8" strokeLinejoin="round" />
      <polyline points="18,28 24,35.5 37,21" fill="none"
        stroke="rgba(180,223,100,0.96)" strokeWidth="3.0"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OrgSVG() {
  return (
    <svg viewBox="0 0 54 54" width="54" height="54" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="org-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#95d3ae" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#2d5038" stopOpacity="0"    />
        </radialGradient>
      </defs>
      <circle cx="27" cy="27" r="25" fill="url(#org-bg)" />
      <line x1="27" y1="20" x2="27" y2="31" stroke="rgba(149,211,120,0.66)" strokeWidth="1.5" />
      <line x1="13" y1="31" x2="41" y2="31" stroke="rgba(149,211,120,0.66)" strokeWidth="1.5" />
      <line x1="13" y1="31" x2="13" y2="38" stroke="rgba(149,211,120,0.66)" strokeWidth="1.5" />
      <line x1="27" y1="31" x2="27" y2="38" stroke="rgba(149,211,120,0.66)" strokeWidth="1.5" />
      <line x1="41" y1="31" x2="41" y2="38" stroke="rgba(149,211,120,0.66)" strokeWidth="1.5" />
      <circle cx="27" cy="13.5" r="5"   fill="rgba(149,211,140,0.88)" />
      <circle cx="27" cy="13.5" r="2.8" fill="rgba(7,10,18,0.88)" />
      {([13, 27, 41] as number[]).map((x) => (
        <g key={x}>
          <circle cx={x} cy="44" r="5"   fill="rgba(110,175,110,0.84)" />
          <circle cx={x} cy="44" r="2.8" fill="rgba(7,10,18,0.88)" />
        </g>
      ))}
    </svg>
  );
}

function ClockSVG() {
  return (
    <svg viewBox="0 0 12 12" width="9" height="9" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="5" fill="none" stroke="rgba(149,211,174,0.60)" strokeWidth="1.2" />
      <line x1="6" y1="3" x2="6" y2="6"     stroke="rgba(149,211,174,0.85)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6" y1="6" x2="8.5" y2="7.5" stroke="rgba(149,211,174,0.85)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function BatterySVG() {
  return (
    <svg viewBox="0 0 14 8" width="14" height="8" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="11" height="7" rx="1.5"
        fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="0.8" />
      <rect x="11.5" y="2.5" width="2" height="3" rx="0.5" fill="rgba(255,255,255,0.28)" />
      <rect x="1.5"  y="1.5" width="7.5" height="5" rx="0.8" fill="rgba(149,211,174,0.60)" />
    </svg>
  );
}

function BellSVG() {
  return (
    <svg className="phone-bell" viewBox="0 0 14 16" width="12" height="14" xmlns="http://www.w3.org/2000/svg">
      <path d="M7,1 C7,1 11,3 11,8 L11,10 L13,12 L1,12 L3,10 L3,8 C3,3 7,1 7,1 Z"
        fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.1" strokeLinejoin="round" />
      <line x1="5.5" y1="13" x2="8.5" y2="13"
        stroke="rgba(255,255,255,0.30)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function MoozukSVG() {
  return (
    <svg viewBox="0 0 28 28" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M14,2.5 L24,8 L24,20 L14,25.5 L4,20 L4,8 Z"
        fill="none" stroke="rgba(180,223,177,0.40)" strokeWidth="1.5" />
      <path d="M9,10.5 L14,14.5 L19,10.5 M14,14.5 L14,19.5"
        fill="none" stroke="rgba(180,223,177,0.75)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
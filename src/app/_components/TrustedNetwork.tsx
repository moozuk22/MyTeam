"use client";

import type { CSSProperties, RefObject } from "react";
import type { LandingClub } from "../_utils/landing-content";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Globe } from "lucide-react";
import { B, CLUBS } from "../_utils/landing-content";
import { StadiumCanvas } from "./StadiumCanvas";
import { HoloPanel } from "./HoloPanel";

export function TrustedNetwork({ contactRef }: { contactRef: RefObject<HTMLElement | null> }) {
  const sectionRef = useRef<HTMLElement>(null);
  const zoomValRef = useRef<HTMLSpanElement>(null);
  const zoomProgressRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<LandingClub | null>(null);
  const [scrollProg, setScrollProg] = useState(0);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handler = () => {
      setIsMobileView(window.innerWidth <= 768);
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const prog = Math.max(0, Math.min(1, 1 - rect.top / window.innerHeight));
      setScrollProg(prog);
    };
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);

  const scrollToContact = () => {
    contactRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section ref={sectionRef} id="Клубове" className="trusted-network-section">
      <div className="network-grid-bg" />
      <div className="network-fade-top" />
      <div className="network-fade-bottom" />

      <div className="network-header">
        <div className="network-tag">
          <Globe size={12} color={B} />
          <span className="network-tag-text">Trusted Network Map</span>
        </div>
        <h2 className="network-title">
          Клубовете, които <span className="hero-title-highlight">ни вярват</span>
        </h2>
        <p className="network-subtitle">Присъединете се към националната мрежа от дигитални спортни организации.</p>
      </div>

      <div className="network-canvas-zone">
        <div className="network-canvas-wrapper">
          <StadiumCanvas
            selectedId={selected?.id}
            onSelect={setSelected}
            scrollProgress={scrollProg}
            zoomValRef={zoomValRef}
            zoomProgressRef={zoomProgressRef}
          />

          {selected && <HoloPanel club={selected} onClose={() => setSelected(null)} />}

          <div className="zoom-bar-container" style={{ right: "15px" }}>
            <span className="zoom-label">Zoom</span>
            <div className="zoom-track">
              <div ref={zoomProgressRef} className="zoom-progress" />
            </div>
            <span ref={zoomValRef} className="zoom-value">0%</span>
          </div>

          <div className="live-indicator">
            <div className="live-dot" />
            <span className="live-text">LIVE — {isMobileView ? "10" : "16"} КЛУБА ОНЛАЙН</span>
          </div>

          {["tl", "tr", "bl", "br"].map(k => (
            <div key={k} className={`hud-corner hud-${k}`} />
          ))}
        </div>

        <div className="club-chip-strip">
          {CLUBS.filter(c => !(isMobileView && c.showMobile === false)).map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(prev => prev?.id === c.id ? null : c)}
              className={`club-chip ${selected?.id === c.id ? "chip-active" : ""}`}
              style={{ "--club-color": c.color } as CSSProperties}
            >
              <div className="chip-dot" style={{ background: c.color }} />
              <span className="chip-name">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="cta-network-container">
        <div className="cta-network-card">
          <div className="placeholder-bubble-wrapper">
            <div className="placeholder-bubble">?</div>
            <div className="orbit-ring" />
          </div>

          <div className="cta-text-wrapper">
            <div className="cta-title">ВАШИЯТ КЛУБ ТУК?</div>
            <div className="cta-subtitle">Присъединете се към мрежата от водещи клубове</div>
          </div>

          <button onClick={scrollToContact} className="cta-btn">
            ЗАЯВЕТЕ СВОЕТО МЯСТО <ArrowRight size={16} />
          </button>

          <div className="network-stats-row">
            {[["8", "клуба"], ["1 850+", "атлети"], ["95%", "avg такси"]].map(([v, l]) => (
              <div key={l} className="network-stat-col">
                <div className="stat-v">{v}</div>
                <div className="stat-l">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

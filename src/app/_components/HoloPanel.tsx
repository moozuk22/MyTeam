"use client";

import type { LandingClub } from "../_utils/landing-content";

import { useState, useEffect } from "react";
import { Users, X, Calendar, MapPin, TrendingUp, Activity } from "lucide-react";
import { G } from "../_utils/landing-content";

export function HoloPanel({ club, onClose }: { club: LandingClub; onClose: () => void }) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVis(true), 20);
    return () => clearTimeout(t);
  }, []);
  const stats = [
    { icon: Users, label: "Athletes Count", value: club.athletes, unit: "", color: G },
    { icon: Activity, label: "Status", value: "Smart Access", unit: "Active", color: G },
    { icon: Calendar, label: "Member since", value: club.months, unit: "months", color: "#FFD700" },
    { icon: TrendingUp, label: "Collection Rate", value: `${club.fees}%`, unit: "", color: "#FF6B9D" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%,-50%) scale(${vis ? 1 : 0.72})`,
        opacity: vis ? 1 : 0,
        transition: "all .38s cubic-bezier(.16,1,.3,1)",
        zIndex: 20,
        width: "min(390px,92vw)",
        pointerEvents: "all"
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg,${club.color}1A,rgba(0,212,255,.07))`,
          border: `1px solid ${club.color}55`,
          borderRadius: 20,
          padding: "26px 26px 22px",
          backdropFilter: "blur(20px)",
          boxShadow: `0 0 70px ${club.color}22,0 40px 80px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06)`,
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: `linear-gradient(90deg,transparent,${club.color}99,transparent)`,
            animation: "scanAcross 2s linear infinite"
          }}
        />
        {[["tl", "top", "left"], ["tr", "top", "right"], ["bl", "bottom", "left"], ["br", "bottom", "right"]].map(([k, tb, lr]) => (
          <div
            key={k}
            style={{
              position: "absolute",
              [tb]: 8,
              [lr]: 8,
              width: 14,
              height: 14,
              borderTop: tb === "top" ? `2px solid ${club.color}` : "none",
              borderBottom: tb === "bottom" ? `2px solid ${club.color}` : "none",
              borderLeft: lr === "left" ? `2px solid ${club.color}` : "none",
              borderRight: lr === "right" ? `2px solid ${club.color}` : "none"
            }}
          />
        ))}

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: `${club.color}20`,
                border: `2px solid ${club.color}55`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Exo 2',sans-serif",
                fontWeight: 900,
                fontSize: 18,
                color: club.color,
                boxShadow: `0 0 22px ${club.color}35`
              }}
            >
              {club.abbr}
            </div>
            <div>
              <div className="logo-brand">{club.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                <MapPin size={11} color="rgba(255,255,255,.4)" />
                <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                  {club.city} · {club.sport}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 8,
              padding: 7,
              cursor: "pointer",
              color: "rgba(255,255,255,.5)",
              display: "flex",
              transition: "all .2s"
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#fff"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,.5)"}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.07)",
                  borderRadius: 12,
                  padding: "13px 15px",
                  transform: vis ? "none" : "translateY(18px)",
                  opacity: vis ? 1 : 0,
                  transition: `all .38s cubic-bezier(.16,1,.3,1) ${i * .07}s`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                  <Icon size={12} color={s.color} />
                  <span
                    style={{
                      fontFamily: "'Exo 2',sans-serif",
                      fontSize: 10,
                      color: "rgba(255,255,255,.35)",
                      textTransform: "uppercase",
                      letterSpacing: 1
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Exo 2',sans-serif",
                    fontWeight: 900,
                    fontSize: 22,
                    color: s.color,
                    lineHeight: 1
                  }}
                >
                  {s.value}
                </div>
                {s.unit && (
                  <div className="v-sub-green" style={{ fontSize: 11, fontWeight: 700, color: "var(--neon-green)", marginTop: 4 }}>
                    {s.unit}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 13px",
            background: `${G}0B`,
            border: `1px solid ${G}22`,
            borderRadius: 10
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: G,
              boxShadow: `0 0 8px ${G}`,
              animation: "glowPulse 1.5s infinite"
            }}
          />
          <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 12, color: G, fontWeight: 600 }}>
            MyTeam — Онлайн и активен
          </span>
        </div>
      </div>
    </div>
  );
}

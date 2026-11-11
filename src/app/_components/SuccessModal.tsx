"use client";

import { useEffect } from "react";

export function SuccessModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  return (
    <div className="popup-overlay" style={{ zIndex: 10000, position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onClick={onClose}>
      <div className="popup-card success-popup" onClick={e => e.stopPropagation()} style={{
        textAlign: "center",
        padding: "24px",
        border: "1px solid rgba(57, 255, 20, 0.2)",
        maxWidth: 400,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}>
        <div style={{ marginBottom: 0 }}>
          <img
            src="/myteam-logo.webp"
            alt="MyTeam Logo"
            style={{ height: 36, margin: "0 auto" }}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <h2 className="popup-title" style={{ fontSize: 20, marginBottom: 4, fontFamily: "var(--serif-font)" }}>Заявката е приета!</h2>
          <p className="popup-desc" style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.7)",
            margin: "0 auto"
          }}>
            Успешна заявка! Ще се свържем с Вас до 24 часа. <br />
            <strong>Кратко демо на системата:</strong>
          </p>
        </div>

        <div style={{
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
          background: "#000",
          boxShadow: "0 0 25px rgba(57, 255, 20, 0.12)",
          border: "1px solid rgba(255,255,255,0.05)"
        }}>
          <video
            src="/demo.mp4"
            controls
            autoPlay
            muted
            playsInline
            style={{ width: "100%", display: "block" }}
          />
        </div>

        <button onClick={onClose} className="popup-action-btn" style={{
          width: "100%",
          height: 44,
          fontSize: 13,
          fontWeight: 800,
          background: "var(--neon-green)",
          backgroundImage: "linear-gradient(135deg, var(--neon-green), #20C020)",
          color: "#000",
          borderRadius: 8,
          boxShadow: "0 8px 15px rgba(57, 255, 20, 0.2)",
          marginTop: 2
        }}>
          РАЗБРАХ
        </button>
      </div>
    </div>
  );
}

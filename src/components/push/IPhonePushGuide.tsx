"use client";

import { useState } from "react";

const ShareIcon = ({
  color = "currentColor",
  size = 20,
}: {
  color?: string;
  size?: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "inline", verticalAlign: "middle" }}
  >
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);
const stepCircleStyle: React.CSSProperties = {
  minWidth: "26px",
  height: "26px",
  borderRadius: "50%",
  background:
    "linear-gradient(135deg, rgb(201, 168, 76), rgb(232, 201, 109), rgb(201, 168, 76))",
  color: "#1a1a1a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "700",
  fontSize: "13px",
  flexShrink: 0,
};
export function IPhonePushGuide() {
  const [showIphoneGuide, setShowIphoneGuide] = useState(false);
  return (
    <div style={{ marginTop: "8px" }}>
      {/* Add to Home Screen button */}
      <button
        type="button"
        onClick={() => setShowIphoneGuide((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          padding: "14px 20px",
          background:
            "linear-gradient(135deg, rgb(201, 168, 76), rgb(232, 201, 109), rgb(201, 168, 76))",
          border: "none",
          borderRadius: "10px",
          color: "#1a1a1a",
          fontWeight: "700",
          fontSize: "15px",
          cursor: "pointer",
          letterSpacing: "0.3px",
        }}
      >
        <ShareIcon color="#1a1a1a" size={20} />
        Добавете към начален екран
      </button>

      {/* Expandable instructions */}
      {showIphoneGuide && (
        <div
          style={{
            marginTop: "8px",
            background: "#1e1e1e",
            border: "1px solid rgb(201, 168, 76)",
            borderRadius: "12px",
            padding: "18px 16px",
            position: "relative",
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setShowIphoneGuide(false)}
            style={{
              position: "absolute",
              top: "10px",
              right: "12px",
              background: "none",
              border: "none",
              color: "rgb(201, 168, 76)",
              fontSize: "20px",
              cursor: "pointer",
              lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            ×
          </button>

          <p
            style={{
              color: "rgb(201, 168, 76)",
              fontWeight: "600",
              marginBottom: "14px",
              marginTop: 0,
              fontSize: "14px",
            }}
          >
            Как да активирате известия на iPhone:
          </p>

          {/* Step 1 */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <span style={stepCircleStyle}>1</span>
            <span
              style={{ color: "#e0e0e0", fontSize: "14px", lineHeight: "1.5" }}
            >
              Натиснете бутона <ShareIcon color="rgb(201, 168, 76)" size={16} />{" "}
              <strong style={{ color: "rgb(201, 168, 76)" }}>Share</strong> в
              долната лента на Safari
            </span>
          </div>

          {/* Step 2 */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <span style={stepCircleStyle}>2</span>
            <span
              style={{ color: "#e0e0e0", fontSize: "14px", lineHeight: "1.5" }}
            >
              Превъртете надолу и изберете{" "}
              <strong style={{ color: "rgb(201, 168, 76)" }}>
                &quot;+ Добавяне към начален екран&quot;
              </strong>
            </span>
          </div>

          {/* Step 3 */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <span style={stepCircleStyle}>3</span>
            <span
              style={{ color: "#e0e0e0", fontSize: "14px", lineHeight: "1.5" }}
            >
              Отворете приложението от началния екран и натиснете{" "}
              <strong style={{ color: "rgb(201, 168, 76)" }}>
                &quot;Активиране на известия&quot;
              </strong>
            </span>
          </div>

          <p
            style={{
              color: "#888",
              fontSize: "12px",
              marginTop: "14px",
              marginBottom: 0,
              textAlign: "center",
            }}
          >
            Получавайте push известия дори когато браузърът е затворен.
          </p>
        </div>
      )}
    </div>
  );
}

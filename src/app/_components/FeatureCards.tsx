"use client";

import type { CSSProperties } from "react";
import type { LandingFeature } from "../_utils/landing-content";

import { X, Zap, Lock } from "lucide-react";

export function FeatureCard({ feature, active, onClick }: { feature: LandingFeature; active: boolean; onClick: () => void }) {
  const isSub = feature.requiresSub;
  const isLocked = isSub && !active;
  const Icon = feature.icon;

  return (
    <div
      className={`feature-card ${isLocked ? "card-locked" : ""}`}
      onClick={isLocked ? undefined : onClick}
      style={{ "--feat-color": feature.color } as CSSProperties}
    >
      <div className="card-icon-wrapper">
        <Icon size={26} className="card-icon" />
      </div>

      <div className="card-content">
        <div className="card-title">{feature.title}</div>
        <p className="card-desc">{feature.short}</p>
        <div className="card-footer">
          {isSub && (
            <div className={`sub-tag-wrapper ${isLocked ? "tag-locked" : "tag-active"}`}>
              {isLocked ? <Lock size={12} /> : <Zap size={12} />}
              <span>{isLocked ? "С АБОНАМЕНТ" : "АБОНАМЕНТ"}</span>
            </div>
          )}
          <span className="card-learn-more">Научете повече →</span>
        </div>
      </div>

      {isLocked && <div className="card-lock-overlay" />}
    </div>
  );
}

export function FeaturePopup({ feature, onClose }: { feature: LandingFeature; onClose: () => void }) {
  const Icon = feature.icon;
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={e => e.stopPropagation()} style={{ "--feat-color": feature.color } as CSSProperties}>
        <button onClick={onClose} className="popup-close-btn"><X size={20} /></button>
        <div className="popup-header">
          <div className="popup-icon-wrapper"><Icon size={32} className="popup-icon" /></div>
          <div className="popup-title-group">
            <h2 className="popup-title">{feature.title}</h2>
            <div className="popup-tag">System Feature • Moozuk22</div>
          </div>
        </div>

        <div className="popup-body">
          <p className="popup-desc">{feature.details}</p>
          <div className="popup-benefits">
            {feature.benefits.map((b, i) => (
              <div key={i} className="benefit-item">
                <div className="benefit-dot" />
                <span className="benefit-text">{b}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="popup-action-btn">РАЗБРАХ</button>
      </div>
    </div>
  );
}

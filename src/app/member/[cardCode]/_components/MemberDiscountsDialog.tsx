"use client";

import { type CSSProperties } from "react";
import { type MemberProfile } from "../_types/member-types";

type Props = {
  allDiscountsModalOpen: boolean;
  setAllDiscountsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  member: MemberProfile;
  setActiveDiscount: React.Dispatch<
    React.SetStateAction<{
      id: string;
      name: string;
      logoUrl: string | null;
      badgeText: string | null;
      code: string | null;
      storeUrl: string | null;
      terms: string[];
      themeColor?: string | null;
      validUntil?: string | null;
    } | null>
  >;
  trackDiscount: (
    partner: string,
    action: "view" | "copy" | "link_click",
  ) => void;
};

export function MemberDiscountsDialog({
  allDiscountsModalOpen,
  setAllDiscountsModalOpen,
  member,
  setActiveDiscount,
  trackDiscount,
}: Props) {
  return (
    <>
      {allDiscountsModalOpen && (
        <div
          className="pm-overlay sd-overlay"
          onClick={() => setAllDiscountsModalOpen(false)}
        >
          <div
            className="sd-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: "24px 20px" }}
          >
            <button
              className="pm-close sd-modal-close"
              onClick={() => setAllDiscountsModalOpen(false)}
              aria-label="Затвори"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="sd-modal-header" style={{ marginBottom: "16px" }}>
              <div className="sd-modal-title-wrap">
                <p
                  className="sd-modal-eyebrow"
                  style={{ color: "rgb(201, 168, 76)" }}
                >
                  Партньорска програма
                </p>
                <h2 className="sd-modal-title">Всички оферти</h2>
              </div>
            </div>

            <div
              className="sd-modal-divider"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(201, 168, 76, 0.5), transparent)",
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                overflowY: "auto",
                maxHeight: "60vh",
                padding: "20px 30px 30px",
              }}
            >
              {member.discounts &&
                member.discounts.map((discount, idx) => {
                  const fallbackColors = [
                    "#ff4d4d",
                    "#c9a84c",
                    "#3498db",
                    "#2ecc71",
                    "#9b59b6",
                    "#e67e22",
                  ];
                  const themeColor = (
                    discount.themeColor ||
                    fallbackColors[idx % fallbackColors.length]
                  ).startsWith("#")
                    ? discount.themeColor ||
                      fallbackColors[idx % fallbackColors.length]
                    : `#${discount.themeColor || fallbackColors[idx % fallbackColors.length]}`;

                  return (
                    <div
                      key={discount.id}
                      className="sd-discount-btn"
                      onClick={() => {
                        setAllDiscountsModalOpen(false);
                        setActiveDiscount(discount);
                        trackDiscount(discount.name, "view");
                      }}
                      role="button"
                      tabIndex={0}
                      style={
                        {
                          marginTop: 0,
                          "--theme-color-main": themeColor,
                          "--theme-color-shadow": `${themeColor}99`,
                          "--theme-color-border": `${themeColor}cc`,
                        } as CSSProperties &
                          Record<
                            | "--theme-color-main"
                            | "--theme-color-shadow"
                            | "--theme-color-border",
                            string
                          >
                      }
                    >
                      <div className="sd-discount-logo-wrap">
                        <img
                          src={discount.logoUrl || "/placeholder.webp"}
                          alt={discount.name}
                          className="sd-discount-logo"
                        />
                      </div>
                      <span className="sd-discount-label">{discount.name}</span>
                      {discount.badgeText && (
                        <span
                          className="sd-discount-badge"
                          style={{
                            background: themeColor,
                          }}
                        >
                          {/^-\d+%$/.test(discount.badgeText) ? (
                            discount.badgeText
                          ) : (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

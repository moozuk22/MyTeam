"use client";

type Props = {
  activeDiscount: {
    id: string;
    name: string;
    logoUrl: string | null;
    badgeText: string | null;
    code: string | null;
    storeUrl: string | null;
    terms: string[];
    themeColor?: string | null;
    validUntil?: string | null;
  } | null;
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
  activeDiscountCodeCopied: boolean;
  setActiveDiscountCodeCopied: React.Dispatch<React.SetStateAction<boolean>>;
  trackDiscount: (
    partner: string,
    action: "view" | "copy" | "link_click",
  ) => void;
};

export function MemberDiscountDialog({
  activeDiscount,
  setActiveDiscount,
  activeDiscountCodeCopied,
  setActiveDiscountCodeCopied,
  trackDiscount,
}: Props) {
  return (
    <>
      {activeDiscount && (
        <div
          className="pm-overlay sd-overlay"
          onClick={() => setActiveDiscount(null)}
        >
          <div
            className="sd-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: `0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}26`,
              border: `1px solid ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}33`,
            }}
          >
            <button
              className="pm-close sd-modal-close"
              onClick={() => setActiveDiscount(null)}
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

            {/* Header */}
            <div className="sd-modal-header">
              {activeDiscount.logoUrl && (
                <img
                  src={activeDiscount.logoUrl}
                  alt={activeDiscount.name}
                  className="sd-modal-logo"
                />
              )}
              <div className="sd-modal-title-wrap">
                <p
                  className="sd-modal-eyebrow"
                  style={{
                    color: (activeDiscount.themeColor || "#ff4d4d").startsWith(
                      "#",
                    )
                      ? activeDiscount.themeColor || "#ff4d4d"
                      : `#${activeDiscount.themeColor || "ff4d4d"}`,
                  }}
                >
                  Партньорска програма
                </p>
                <h2 className="sd-modal-title">{activeDiscount.name}</h2>
                {activeDiscount.validUntil && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.5)",
                      marginTop: "4px",
                      fontWeight: 500,
                    }}
                  >
                    Важи до:{" "}
                    {new Date(activeDiscount.validUntil).toLocaleDateString(
                      "bg-BG",
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="sd-modal-divider" />

            {/* Discount highlights */}
            {activeDiscount.badgeText && (
              <div className="sd-highlights">
                <div
                  className="sd-highlight"
                  style={{
                    background: `${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}1a`,
                    border: `1px solid ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}33`,
                  }}
                >
                  <span
                    className="sd-highlight-value"
                    style={{
                      color: (
                        activeDiscount.themeColor || "#ff4d4d"
                      ).startsWith("#")
                        ? activeDiscount.themeColor || "#ff4d4d"
                        : `#${activeDiscount.themeColor || "ff4d4d"}`,
                    }}
                  >
                    {activeDiscount.badgeText}
                  </span>
                  {/^-\d+%$/.test(activeDiscount.badgeText ?? "") && (
                    <span
                      className="sd-highlight-label"
                      style={{
                        color: (
                          activeDiscount.themeColor || "#ff4d4d"
                        ).startsWith("#")
                          ? activeDiscount.themeColor || "#ff4d4d"
                          : `#${activeDiscount.themeColor || "ff4d4d"}`,
                      }}
                    >
                      отстъпка
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Code + validity — tap to copy */}
            {activeDiscount.code && (
              <button
                className={`sd-code-row${activeDiscountCodeCopied ? " sd-code-row--copied" : ""}`}
                type="button"
                style={
                  activeDiscountCodeCopied
                    ? {
                        background: `${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}26`,
                        borderColor: (
                          activeDiscount.themeColor || "#ff4d4d"
                        ).startsWith("#")
                          ? activeDiscount.themeColor || "#ff4d4d"
                          : `#${activeDiscount.themeColor || "ff4d4d"}`,
                        color: (
                          activeDiscount.themeColor || "#ff4d4d"
                        ).startsWith("#")
                          ? activeDiscount.themeColor || "#ff4d4d"
                          : `#${activeDiscount.themeColor || "ff4d4d"}`,
                      }
                    : {}
                }
                onClick={() => {
                  void navigator.clipboard
                    .writeText(activeDiscount.code!)
                    .then(() => {
                      setActiveDiscountCodeCopied(true);
                      trackDiscount(activeDiscount.name, "copy");
                      setTimeout(
                        () => setActiveDiscountCodeCopied(false),
                        2000,
                      );
                    });
                }}
                aria-label={`Копирай код ${activeDiscount.code}`}
              >
                <span
                  className="sd-code-lbl"
                  style={
                    activeDiscountCodeCopied
                      ? {
                          color: (
                            activeDiscount.themeColor || "#ff4d4d"
                          ).startsWith("#")
                            ? activeDiscount.themeColor || "#ff4d4d"
                            : `#${activeDiscount.themeColor || "ff4d4d"}`,
                        }
                      : {}
                  }
                >
                  {activeDiscountCodeCopied ? "Копирано!" : "Код:"}
                </span>
                <span
                  className="sd-code"
                  style={{
                    color: activeDiscountCodeCopied
                      ? (activeDiscount.themeColor || "#ff4d4d").startsWith("#")
                        ? activeDiscount.themeColor || "#ff4d4d"
                        : `#${activeDiscount.themeColor || "ff4d4d"}`
                      : activeDiscount.themeColor === "#ffffff"
                        ? "#fff"
                        : (activeDiscount.themeColor || "#ff4d4d").startsWith(
                              "#",
                            )
                          ? activeDiscount.themeColor || "#ff4d4d"
                          : `#${activeDiscount.themeColor || "ff4d4d"}`,
                  }}
                >
                  {activeDiscountCodeCopied ? "✓" : activeDiscount.code}
                </span>
                {!activeDiscountCodeCopied && (
                  <svg
                    className="sd-copy-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      color: (
                        activeDiscount.themeColor || "#ff4d4d"
                      ).startsWith("#")
                        ? activeDiscount.themeColor || "#ff4d4d"
                        : `#${activeDiscount.themeColor || "ff4d4d"}`,
                    }}
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            )}

            {activeDiscount.storeUrl && (
              <div style={{ marginTop: "16px" }}>
                <a
                  href={activeDiscount.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sd-store-link-btn"
                  onClick={() =>
                    trackDiscount(activeDiscount.name, "link_click")
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    background: `linear-gradient(135deg, ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}33 0%, ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}1a 100%)`,
                    border: `1px solid ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}4d`,
                    color: (activeDiscount.themeColor || "#ff4d4d").startsWith(
                      "#",
                    )
                      ? activeDiscount.themeColor || "#ff4d4d"
                      : `#${activeDiscount.themeColor || "ff4d4d"}`,
                    padding: "14px",
                    borderRadius: "12px",
                    textDecoration: "none",
                    fontSize: "15px",
                    fontWeight: 700,
                    transition: "all 0.2s ease",
                    width: "100%",
                    boxSizing: "border-box",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}4d 0%, ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}33 100%)`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = `0 6px 20px ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}26`;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}33 0%, ${(activeDiscount.themeColor || "#ff4d4d").startsWith("#") ? activeDiscount.themeColor || "#ff4d4d" : `#${activeDiscount.themeColor || "ff4d4d"}`}1a 100%)`;
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 15px rgba(0,0,0,0.1)";
                  }}
                >
                  Пазарувай онлайн
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
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            )}

            {activeDiscount.terms && activeDiscount.terms.length > 0 && (
              <>
                <div className="sd-modal-divider" />
                <div className="sd-terms">
                  <p className="sd-terms-title">Условия</p>
                  <ul className="sd-terms-list">
                    {activeDiscount.terms.map((term, i) => (
                      <li key={i}>{term}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

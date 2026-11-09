"use client";

import { XIcon } from "./members-page-icons";
import { type ClubSettings } from "../_hooks/useClubSettings";

type ClubRulesDialogProps = {
  clubSettings: Pick<
    ClubSettings,
    | "rulesModalOpen"
    | "rulesUploading"
    | "rulesDeletingId"
    | "setRulesModalOpen"
    | "rulesLoading"
    | "rulesDocs"
    | "handleRulesDelete"
    | "handleRulesUpload"
    | "rulesError"
  >;
  isAdmin: boolean;
  isCoach: boolean;
  clubId: string;
};

export function ClubRulesDialog({ clubSettings, isAdmin, isCoach, clubId }: ClubRulesDialogProps) {
  const {
    rulesModalOpen,
    rulesUploading,
    rulesDeletingId,
    setRulesModalOpen,
    rulesLoading,
    rulesDocs,
    handleRulesDelete,
    handleRulesUpload,
    rulesError,
  } = clubSettings;
  return (
    <>
      {rulesModalOpen && (isAdmin || isCoach) && clubId && (
        <div
          className="amp-overlay"
          onClick={() => {
            if (!rulesUploading && !rulesDeletingId) setRulesModalOpen(false);
          }}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Правилник</span>
              <button
                className="amp-modal-close"
                onClick={() => setRulesModalOpen(false)}
                aria-label="Затвори"
                disabled={rulesUploading || !!rulesDeletingId}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {rulesLoading ? (
                <p className="amp-payment-workflow-note">Зареждане...</p>
              ) : (
                <>
                  {rulesDocs.length > 0 && (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}
                    >
                      {rulesDocs.map((doc) => (
                        <div key={doc.id} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <a
                            href={`/api/admin/clubs/${encodeURIComponent(clubId)}/rules/${encodeURIComponent(doc.id)}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="amp-btn amp-btn--primary"
                            style={{
                              flex: 1,
                              textAlign: "center",
                              textDecoration: "none",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {doc.name}
                          </a>
                          <button
                            className="amp-btn amp-btn--danger"
                            type="button"
                            onClick={() => void handleRulesDelete(doc.id)}
                            disabled={!!rulesDeletingId || rulesUploading}
                            style={{ flexShrink: 0 }}
                          >
                            {rulesDeletingId === doc.id ? "..." : "Изтрий"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {rulesDocs.length === 0 && !rulesUploading && (
                    <p className="amp-payment-workflow-note" style={{ marginBottom: "8px" }}>
                      Няма качени документи.
                    </p>
                  )}
                  <label
                    className={`amp-btn amp-btn--ghost`}
                    style={{
                      display: "block",
                      textAlign: "center",
                      cursor: rulesUploading ? "default" : "pointer",
                    }}
                  >
                    {rulesUploading ? "Качване..." : "Качи PDF"}
                    <input
                      type="file"
                      accept="application/pdf"
                      style={{ display: "none" }}
                      onChange={(e) => void handleRulesUpload(e)}
                      disabled={rulesUploading || !!rulesDeletingId}
                    />
                  </label>
                </>
              )}
              {rulesError && (
                <p className="amp-confirm-error" style={{ marginTop: "8px" }}>
                  {rulesError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

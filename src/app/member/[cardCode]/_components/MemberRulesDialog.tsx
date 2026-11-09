"use client";

import { type MemberProfile } from "../_types/member-types";

type Props = {
  rulesOpen: boolean;
  setRulesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  member: MemberProfile;
  normalizedCardCode: string;
};

export function MemberRulesDialog({
  rulesOpen,
  setRulesOpen,
  member,
  normalizedCardCode,
}: Props) {
  return (
    <>
      {rulesOpen && (
        <div className="pm-overlay" onClick={() => setRulesOpen(false)}>
          <div
            className="pm-modal rules-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="pm-close"
              onClick={() => setRulesOpen(false)}
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
            <h2 className="rules-modal-title">Правилници</h2>
            <div className="rules-modal-list">
              {member.clubRulesDocuments!.map((doc) => (
                <a
                  key={doc.id}
                  href={`/api/members/${normalizedCardCode}/rules/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rules-modal-item"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{doc.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

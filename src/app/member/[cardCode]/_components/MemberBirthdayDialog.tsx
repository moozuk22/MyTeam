"use client";

import { type MemberProfile } from "../_types/member-types";

type Props = {
  birthdayCardOpen: boolean;
  member: MemberProfile;
  setBirthdayCardOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function MemberBirthdayDialog({
  birthdayCardOpen,
  member,
  setBirthdayCardOpen,
}: Props) {
  return (
    <>
      {birthdayCardOpen && member && (
        <div
          className="birthday-card-overlay"
          onClick={() => setBirthdayCardOpen(false)}
        >
          <div className="birthday-confetti-container" aria-hidden="true">
            <span className="bcp bcp1" />
            <span className="bcp bcp2" />
            <span className="bcp bcp3" />
            <span className="bcp bcp4" />
            <span className="bcp bcp5" />
            <span className="bcp bcp6" />
            <span className="bcp bcp7" />
            <span className="bcp bcp8" />
            <span className="bcp bcp9" />
            <span className="bcp bcp10" />
            <span className="bcp bcp11" />
            <span className="bcp bcp12" />
            <span className="bcp bcp13" />
            <span className="bcp bcp14" />
            <span className="bcp bcp15" />
            <span className="bcp bcp16" />
          </div>
          <div className="birthday-fw-container" aria-hidden="true">
            <span className="fw fw1">
              <span className="fw-t" />
              <span className="fw-b" />
            </span>
            <span className="fw fw2">
              <span className="fw-t" />
              <span className="fw-b" />
            </span>
            <span className="fw fw3">
              <span className="fw-t" />
              <span className="fw-b" />
            </span>
            <span className="fw fw4">
              <span className="fw-t" />
              <span className="fw-b" />
            </span>
          </div>
          <div
            className="birthday-card-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="birthday-card-close"
              onClick={() => setBirthdayCardOpen(false)}
              aria-label="Затвори"
            >
              ×
            </button>

            <div className="birthday-card-sparkles" aria-hidden="true">
              <span className="birthday-sparkle s1">✦</span>
              <span className="birthday-sparkle s2">✦</span>
              <span className="birthday-sparkle s3">✦</span>
              <span className="birthday-sparkle s4">✦</span>
              <span className="birthday-sparkle s5">✦</span>
              <span className="birthday-sparkle s6">✦</span>
            </div>

            {member.clubLogoUrl && (
              <img
                src={member.clubLogoUrl}
                alt={member.clubName ?? "Клуб"}
                className="birthday-card-club-logo"
              />
            )}

            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.name}
                className="birthday-card-avatar"
              />
            ) : (
              <div className="birthday-card-avatar birthday-card-avatar-placeholder">
                {member.name.charAt(0).toUpperCase()}
              </div>
            )}

            <p className="birthday-card-emoji">🎂</p>
            <h2 className="birthday-card-heading">Честит рожден ден!</h2>
            <p className="birthday-card-name">{member.name}</p>

            {member.birthDate && (
              <p className="birthday-card-date">
                {new Date(member.birthDate).toLocaleDateString("bg-BG", {
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                })}
              </p>
            )}

            <p className="birthday-card-wish">
              Пожелаваме ти здраве, щастие и много победи! 🏆
            </p>
          </div>
        </div>
      )}
    </>
  );
}

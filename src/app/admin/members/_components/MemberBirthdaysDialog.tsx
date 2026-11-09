"use client";

import type * as React from "react";
import { XIcon } from "./members-page-icons";
import { TRAINING_WEEKDAY_SHORT_BG } from "../_utils/members-page-utils";
import { type Member } from "../_types/members-page-types";
import { type MemberBirthdays } from "../_hooks/useMemberBirthdays";

type MemberBirthdaysDialogProps = {
  memberBirthdays: Pick<
    MemberBirthdays,
    | "birthdayDate"
    | "setBirthdayDate"
    | "birthdayMembers"
    | "setFacebookBirthday"
    | "birthdayTodayIso"
    | "changeBirthdayMonth"
    | "birthdayCalendarMonths"
    | "birthdaysByDay"
    | "selectedBirthdayDate"
    | "setSelectedBirthdayDate"
    | "birthdayResultsRef"
    | "selectedBirthdayMembers"
  >;
  selectedMember: Member | null;
  coachGroupId: string;
  currentCoachGroupName: string;
  clubName: string;
  isAdmin: boolean;
  isCoach: boolean;
  clubId: string;
  setSelectedMember: React.Dispatch<React.SetStateAction<Member | null>>;
};

export function MemberBirthdaysDialog({
  memberBirthdays,
  selectedMember,
  coachGroupId,
  currentCoachGroupName,
  clubName,
  isAdmin,
  isCoach,
  clubId,
  setSelectedMember,
}: MemberBirthdaysDialogProps) {
  const {
    birthdayDate,
    setBirthdayDate,
    birthdayMembers,
    setFacebookBirthday,
    birthdayTodayIso,
    changeBirthdayMonth,
    birthdayCalendarMonths,
    birthdaysByDay,
    selectedBirthdayDate,
    setSelectedBirthdayDate,
    birthdayResultsRef,
    selectedBirthdayMembers,
  } = memberBirthdays;
  return (
    <>
      {birthdayDate && (
        <div
          className="amp-overlay amp-overlay--confirm"
          style={selectedMember ? { zIndex: 99 } : undefined}
          inert={!!selectedMember}
          aria-hidden={selectedMember ? true : undefined}
          onClick={() => setBirthdayDate(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setBirthdayDate(null);
          }}
        >
          <div
            className="amp-modal amp-modal--confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="birthday-list-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title" id="birthday-list-title">
              <span className="amp-modal-title-gradient">Рожденици</span>
              <button
                className="amp-modal-close"
                type="button"
                autoFocus
                onClick={() => setBirthdayDate(null)}
                aria-label="Затвори"
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <p>
                {coachGroupId ? currentCoachGroupName : clubName} ·{" "}
                {birthdayDate.split("-").reverse().join(".")}
              </p>
              {(isAdmin || isCoach) && (
                <p>
                  <a
                    className="amp-btn amp-btn--ghost"
                    href={`/admin/members/facebook?clubId=${encodeURIComponent(clubId)}`}
                  >
                    Facebook страница на клуба
                  </a>
                </p>
              )}
              <h3>Рожденици днес</h3>
              {birthdayMembers.length === 0 ? (
                <p className="amp-empty amp-empty--modal">
                  {coachGroupId ? "Днес няма рожденици в тази група." : "Днес няма рожденици в клуба."}
                </p>
              ) : (
                <ul>
                  {birthdayMembers.map((member) => (
                    <li key={member.id}>
                      <button
                        className="amp-btn amp-btn--ghost"
                        type="button"
                        onClick={() => {
                          setBirthdayDate(null);
                          setSelectedMember(member);
                        }}
                      >
                        🎂 {member.fullName}
                      </button>
                      {isAdmin && (
                        <button
                          className="amp-birthday-facebook-btn"
                          type="button"
                          onClick={() => setFacebookBirthday({ member, date: birthdayTodayIso })}
                        >
                          Поздрави във Facebook
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <section className="amp-birthday-calendar" aria-label="Календар на рождените дни">
                <div className="amp-birthday-calendar-nav">
                  <button
                    className="amp-btn amp-btn--ghost"
                    type="button"
                    aria-label="Предишен месец"
                    onClick={() => changeBirthdayMonth(-1)}
                  >
                    ‹
                  </button>
                  <span aria-live="polite">{birthdayCalendarMonths[0]?.label}</span>
                  <button
                    className="amp-btn amp-btn--ghost"
                    type="button"
                    aria-label="Следващ месец"
                    onClick={() => changeBirthdayMonth(1)}
                  >
                    ›
                  </button>
                </div>
                <div className="amp-training-calendar">
                  {birthdayCalendarMonths.map((month) => (
                    <div key={month.key} className="amp-training-month">
                      <div className="amp-training-weekdays-row">
                        {TRAINING_WEEKDAY_SHORT_BG.map((weekday) => (
                          <span key={weekday} className="amp-training-weekday-cell">
                            {weekday}
                          </span>
                        ))}
                      </div>
                      <div className="amp-training-month-grid">
                        {month.cells.map((date, index) => {
                          if (!date)
                            return (
                              <span
                                key={`empty-${index}`}
                                className="amp-training-calendar-cell amp-training-calendar-cell--empty"
                                aria-hidden="true"
                              />
                            );
                          const players = birthdaysByDay.get(date.slice(5)) ?? [];
                          return (
                            <button
                              key={date}
                              type="button"
                              className={`amp-training-date-btn amp-birthday-day${players.length ? " amp-birthday-day--marked" : ""}${date < birthdayTodayIso ? " amp-birthday-day--past" : ""}${date === birthdayTodayIso ? " amp-training-date-btn--today" : ""}${date === selectedBirthdayDate ? " amp-birthday-day--selected" : ""}`}
                              aria-label={`${date.split("-").reverse().join(".")}: ${players.length ? players.map((player) => player.fullName).join(", ") : "Няма рожденици"}`}
                              aria-current={date === birthdayTodayIso ? "date" : undefined}
                              aria-pressed={date === selectedBirthdayDate}
                              onClick={() => {
                                setSelectedBirthdayDate(date);
                                if (players.length > 0) {
                                  window.requestAnimationFrame(() => {
                                    birthdayResultsRef.current?.scrollIntoView({
                                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                                        ? "instant"
                                        : "smooth",
                                      block: "nearest",
                                    });
                                  });
                                }
                              }}
                            >
                              <span className="amp-training-day-number">{Number(date.slice(8))}</span>
                              {date === birthdayTodayIso && (
                                <span className="amp-training-day-meta">Днес</span>
                              )}
                              {players.length > 0 && (
                                <span className="amp-training-day-meta">🎂 {players.length}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedBirthdayDate && (
                  <section
                    ref={birthdayResultsRef}
                    className="amp-birthday-results"
                    aria-live="polite"
                    aria-labelledby="birthday-results-heading"
                  >
                    <div className="amp-birthday-results-header">
                      <span className="amp-birthday-results-icon" aria-hidden="true">
                        🎂
                      </span>
                      <div className="amp-birthday-results-heading">
                        <span className="amp-birthday-results-label">Рожденици на</span>
                        <h3 id="birthday-results-heading">
                          {selectedBirthdayDate.split("-").reverse().join(".")}
                        </h3>
                      </div>
                      <span className="amp-birthday-results-count">
                        {selectedBirthdayMembers.length}{" "}
                        {selectedBirthdayMembers.length === 1 ? "състезател" : "състезатели"}
                      </span>
                    </div>
                    {selectedBirthdayMembers.length ? (
                      <ul className="amp-birthday-player-list">
                        {selectedBirthdayMembers.map((member) => (
                          <li key={member.id}>
                            <button
                              className="amp-birthday-player"
                              type="button"
                              onClick={() => setSelectedMember(member)}
                            >
                              <span className="amp-birthday-player-avatar" aria-hidden="true">
                                {member.fullName
                                  .trim()
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((name) => name[0])
                                  .join("")}
                                {member.avatarUrl && (
                                  // Player avatars use the existing Cloudinary thumbnail URL.
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={member.avatarUrl}
                                    src={member.avatarUrl}
                                    alt=""
                                    width={40}
                                    height={40}
                                    loading="lazy"
                                    onError={(event) => {
                                      event.currentTarget.style.display = "none";
                                    }}
                                  />
                                )}
                              </span>
                              <span className="amp-birthday-player-details">
                                <span className="amp-birthday-player-name">{member.fullName}</span>
                                <span className="amp-birthday-player-hint">Виж състезателя</span>
                              </span>
                              <span className="amp-birthday-player-arrow" aria-hidden="true">
                                ›
                              </span>
                            </button>
                            {isAdmin && (
                              <button
                                className="amp-birthday-facebook-btn"
                                type="button"
                                onClick={() => setFacebookBirthday({ member, date: selectedBirthdayDate })}
                              >
                                Поздрави във Facebook
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="amp-birthday-results-empty">Няма рожденици на тази дата.</p>
                    )}
                  </section>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

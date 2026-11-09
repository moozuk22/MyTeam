"use client";

import { useState, useRef } from "react";
import { buildCalendarMonths } from "../_utils/members-page-utils";
import { type Member } from "../_types/members-page-types";

type MemberBirthdaysOptions = {
  members: Member[];
  coachGroupId: string;
};

export function useMemberBirthdays({ members, coachGroupId }: MemberBirthdaysOptions) {
  const [birthdayDate, setBirthdayDate] = useState<string | null>(null);

  const [birthdayMonth, setBirthdayMonth] = useState("");

  const [birthdayTodayIso, setBirthdayTodayIso] = useState("");

  const [selectedBirthdayDate, setSelectedBirthdayDate] = useState<string | null>(null);

  const birthdayResultsRef = useRef<HTMLElement>(null);

  const [facebookBirthday, setFacebookBirthday] = useState<{ member: Member; date: string } | null>(null);

  const birthdaysByDay = new Map<string, Member[]>();

  for (const member of members) {
    if (!member.isActive || !member.birthDate) continue;
    if (coachGroupId && !member.coachGroupIds.includes(coachGroupId)) continue;
    const birthDate = new Date(member.birthDate);
    if (Number.isNaN(birthDate.getTime())) continue;
    const monthDay = `${String(birthDate.getUTCMonth() + 1).padStart(2, "0")}-${String(birthDate.getUTCDate()).padStart(2, "0")}`;
    const players = birthdaysByDay.get(monthDay) ?? [];
    players.push(member);
    birthdaysByDay.set(monthDay, players);
  }

  for (const players of birthdaysByDay.values())
    players.sort((a, b) => a.fullName.localeCompare(b.fullName, "bg"));

  const birthdayMembers = birthdaysByDay.get(birthdayDate ?? "") ?? [];

  const birthdayCalendarMonths = birthdayMonth ? buildCalendarMonths([`${birthdayMonth}-01`]) : [];

  const selectedBirthdayMembers = birthdaysByDay.get(selectedBirthdayDate?.slice(5) ?? "") ?? [];

  const changeBirthdayMonth = (offset: number) => {
    const [year, month] = birthdayMonth.split("-").map(Number);
    setBirthdayMonth(new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7));
    setSelectedBirthdayDate(null);
  };

  return {
    birthdayDate,
    setBirthdayDate,
    setBirthdayMonth,
    birthdayTodayIso,
    setBirthdayTodayIso,
    selectedBirthdayDate,
    setSelectedBirthdayDate,
    birthdayResultsRef,
    facebookBirthday,
    setFacebookBirthday,
    birthdaysByDay,
    birthdayMembers,
    birthdayCalendarMonths,
    selectedBirthdayMembers,
    changeBirthdayMonth,
  };
}

export type MemberBirthdays = ReturnType<typeof useMemberBirthdays>;

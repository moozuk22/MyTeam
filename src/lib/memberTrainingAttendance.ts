type Session = { id?: string; scopeKey?: string };

export function buildMemberTrainingAttendanceRequest(
  day: { date: string; sessions: Session[] },
  selected: Session | null,
  action: "attend" | "optOut",
  reason?: { reasonCode: string; reasonText: string | null },
) {
  const session = selected ?? (day.sessions.length === 1 ? day.sessions[0] : null);
  if (day.sessions.length > 1 && !session?.id && !session?.scopeKey?.startsWith("custom_group:")) {
    throw new Error("Изберете конкретна тренировка. Презаредете страницата и опитайте отново.");
  }
  return {
    trainingDate: day.date,
    ...(session?.id ? { trainingSessionId: session.id } : session?.scopeKey?.startsWith("custom_group:") ? { trainingScopeKey: session.scopeKey } : {}),
    ...(action === "optOut" ? { reasonCode: reason?.reasonCode ?? "", reasonText: reason?.reasonText ?? "" } : {}),
  };
}

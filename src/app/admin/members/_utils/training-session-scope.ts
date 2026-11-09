export function customTrainingGroupCoachScopeKey(coachGroupIdFromUrl: string): string | null {
  const trimmed = coachGroupIdFromUrl.trim();
  return trimmed || null;
}

export function getScopeKeyFromSessionId(sessionId: string): string | null {
  if (sessionId.startsWith("coach-"))
    return `coach_group:${sessionId.slice(6, 42)}:session:${sessionId.slice(43)}`;
  const customMatch = sessionId.match(/^\d{4}-\d{2}-\d{2}-custom-(.+)$/);
  if (customMatch) return `custom_group:${customMatch[1]}`;
  const teamMatch = sessionId.match(/^\d{4}-\d{2}-\d{2}-team-(\d+)$/);
  if (teamMatch) return `team_group:${teamMatch[1]}`;
  return null;
}

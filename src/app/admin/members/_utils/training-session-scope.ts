import type { Schedule2Group } from "../_components/Schedule2";

export function customTrainingGroupCoachScopeKey(coachGroupIdFromUrl: string): string | null {
  const trimmed = coachGroupIdFromUrl.trim();
  return trimmed || null;
}

export function getScopeKeyFromSessionId(sessionId: string): string | null {
  const custom = parseSchedule2CustomSession(sessionId);
  if (custom) return `custom_group:${custom.groupId}${custom.sessionId ? `:session:${custom.sessionId}` : ""}`;
  if (sessionId.startsWith("coach-"))
    return `coach_group:${sessionId.slice(6, 42)}:session:${sessionId.slice(43)}`;
  const teamMatch = sessionId.match(/^\d{4}-\d{2}-\d{2}-team-(\d+)$/);
  if (teamMatch) return `team_group:${teamMatch[1]}`;
  return null;
}

export function parseSchedule2CustomSession(id: string) {
  const occurrence = /^custom-session-([0-9a-f-]{36})-([0-9a-f-]{36})$/i.exec(id);
  if (occurrence) return { groupId: occurrence[1], sessionId: occurrence[2] };
  const legacy = /^\d{4}-\d{2}-\d{2}-custom-(.+)$/.exec(id);
  return legacy ? { groupId: legacy[1], sessionId: null } : null;
}

export function schedule2CustomSessionsUrl(clubId: string, groupId: string) {
  return `/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups/${encodeURIComponent(groupId)}/schedule2-sessions`;
}
export type Schedule2TrainingTarget = {
  group: Schedule2Group;
  date?: string;
  edit?: {
    sessionId: string | null;
    time: string | null;
    duration: number;
    fieldId: string | null;
    fieldPieceIds: string[];
  };
};

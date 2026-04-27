interface PresenceEntry {
  clubId: string;
  clubName: string;
  active: boolean;
  connectedAt: Date;
  lastUpdatedAt: Date;
}

const presenceMap = new Map<string, PresenceEntry>();

export function setPresence(clubId: string, clubName: string, active: boolean): void {
  const now = new Date();
  const existing = presenceMap.get(clubId);
  presenceMap.set(clubId, {
    clubId,
    clubName,
    active,
    connectedAt: active && !existing?.active ? now : (existing?.connectedAt ?? now),
    lastUpdatedAt: now,
  });
}

export function getRawPresence(clubId: string): PresenceEntry | undefined {
  return presenceMap.get(clubId);
}

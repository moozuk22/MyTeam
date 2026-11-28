import type { AdminSessionPayload } from "@/lib/adminAuth";

// Clubs whose coaches may use the new schedule view (Schedule 2) as well as admins.
// What a coach may change there is still limited by `trainingWriteAccess.ts`.
const SCHEDULE2_COACH_CLUB_IDS = new Set<string>([
  "4fed63dd-fbe2-42e8-a8bc-c7036496a3e5",
]);

export function canUseSchedule2(session: Pick<AdminSessionPayload, "roles"> | null | undefined, clubId: string): boolean {
  if (!session) return false;
  if (session.roles.includes("admin")) return true;
  return session.roles.includes("coach") && SCHEDULE2_COACH_CLUB_IDS.has(clubId.trim().toLowerCase());
}

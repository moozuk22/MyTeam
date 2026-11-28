import type { AdminSessionPayload } from "@/lib/adminAuth";

// Admins and coaches may use the new schedule view (Schedule 2) in every club.
// What a coach may change there is still limited by `trainingWriteAccess.ts`.
export function canUseSchedule2(session: Pick<AdminSessionPayload, "roles"> | null | undefined, clubId: string): boolean {
  if (!session || !clubId.trim()) return false;
  return session.roles.includes("admin") || session.roles.includes("coach");
}

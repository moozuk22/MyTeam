import { NextResponse } from "next/server";
import type { AdminSessionPayload } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

// Coaches share one password, so the coach page they work on identifies them.
// The page URL (sent by the browser as Referer) decides what a coach may change:
// - no `coachGroupId` (main page): view only;
// - `coachGroupId=<id>` (coach page): only that coach group's trainings.
// Admins may change all trainings.
export type TrainingWriteAccess =
  | { kind: "admin" }
  | { kind: "coach"; coachGroupId: string }
  | { kind: "readOnly" };

export type TrainingWriteTarget =
  | { type: "coachGroup"; id: string }
  | { type: "customGroup"; id: string }
  | { type: "clubWide" };

type AccessDb = {
  coachGroup: { findFirst(args: { where: { id: string; clubId: string }; select: { id: true } }): Promise<{ id: string } | null> };
  clubCustomTrainingGroup: {
    findFirst(args: { where: { id: string; clubId: string; coachGroupId: string }; select: { id: true } }): Promise<{ id: string } | null>;
  };
  trainingSession: {
    findFirst(args: { where: { id: string; clubId: string }; select: { scopeType: true; scopeId: true } }): Promise<{ scopeType: string; scopeId: string | null } | null>;
  };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TRAINING_VIEW_ONLY_ERROR = "Можете само да преглеждате графика. Отворете страницата на вашата група, за да променяте тренировките.";
export const TRAINING_OTHER_GROUP_ERROR = "Можете да променяте само тренировките на вашата група.";

export function pageCoachGroupId(request: Pick<Request, "headers">): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const value = new URL(referer).searchParams.get("coachGroupId")?.trim() ?? "";
    return UUID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function getTrainingWriteAccess(
  session: Pick<AdminSessionPayload, "roles">,
  request: Pick<Request, "headers">,
): TrainingWriteAccess {
  if (session.roles.includes("admin")) return { kind: "admin" };
  const coachGroupId = pageCoachGroupId(request);
  return coachGroupId ? { kind: "coach", coachGroupId } : { kind: "readOnly" };
}

export async function trainingTargetForSession(
  clubId: string,
  trainingSessionId: string,
  db: AccessDb = prisma as unknown as AccessDb,
): Promise<TrainingWriteTarget | null> {
  if (!UUID_PATTERN.test(trainingSessionId)) return null;
  const row = await db.trainingSession.findFirst({
    where: { id: trainingSessionId, clubId },
    select: { scopeType: true, scopeId: true },
  });
  if (!row) return null;
  if ((row.scopeType === "coachGroup" || row.scopeType === "customGroup") && row.scopeId) {
    return { type: row.scopeType, id: row.scopeId };
  }
  return { type: "clubWide" };
}

/**
 * Resolves the trainings a request body points to: a stored session, a custom
 * group, or (for team-group, training-group and club trainings) the whole club.
 */
export async function trainingTargetFromBody(
  clubId: string,
  body: { trainingSessionId?: unknown; customTrainingGroupId?: unknown },
  db: AccessDb = prisma as unknown as AccessDb,
): Promise<TrainingWriteTarget> {
  if (body.trainingSessionId) {
    return (await trainingTargetForSession(clubId, String(body.trainingSessionId), db)) ?? { type: "clubWide" };
  }
  const customTrainingGroupId = String(body.customTrainingGroupId ?? "").trim();
  return customTrainingGroupId ? { type: "customGroup", id: customTrainingGroupId } : { type: "clubWide" };
}

/** Resolves limited-event scope keys such as `custom_group:<id>:session:<id>`. */
export function trainingTargetFromScopeKey(scopeKey: string): TrainingWriteTarget {
  const [type, id] = scopeKey.split(":");
  if (type === "custom_group" && id) return { type: "customGroup", id };
  if (type === "coach_group" && id) return { type: "coachGroup", id };
  return { type: "clubWide" };
}

async function canWrite(
  access: TrainingWriteAccess,
  clubId: string,
  target: TrainingWriteTarget,
  db: AccessDb,
): Promise<boolean> {
  if (access.kind === "admin") return true;
  if (access.kind === "readOnly" || target.type === "clubWide") return false;
  if (target.type === "coachGroup") {
    if (target.id !== access.coachGroupId) return false;
    return Boolean(await db.coachGroup.findFirst({ where: { id: target.id, clubId }, select: { id: true } }));
  }
  if (!UUID_PATTERN.test(target.id)) return false;
  return Boolean(await db.clubCustomTrainingGroup.findFirst({
    where: { id: target.id, clubId, coachGroupId: access.coachGroupId },
    select: { id: true },
  }));
}

/** Returns a 403 response when the session may not change the target trainings. */
export async function denyTrainingWrite(
  session: Pick<AdminSessionPayload, "roles">,
  request: Pick<Request, "headers">,
  clubId: string,
  target: TrainingWriteTarget,
  db: AccessDb = prisma as unknown as AccessDb,
): Promise<NextResponse | null> {
  const access = getTrainingWriteAccess(session, request);
  if (await canWrite(access, clubId, target, db)) return null;
  return NextResponse.json(
    { error: access.kind === "readOnly" ? TRAINING_VIEW_ONLY_ERROR : TRAINING_OTHER_GROUP_ERROR },
    { status: 403 },
  );
}

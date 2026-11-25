import { trainingPlanCapabilities } from "@/lib/trainingPlanSubscriptions";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, type AdminSessionPayload } from "@/lib/adminAuth";
import { hasTrustedOrigin } from "@/lib/requestOrigin";
import { TRAINING_UUID_PATTERN as UUID_RE } from "@/lib/trainingPlans";
import { prisma } from "@/lib/db";

export { UUID_RE };
export function findTrainingPlanCoachGroup(clubId: string, coachGroupId: unknown) {
  if (typeof coachGroupId !== "string" || !UUID_RE.test(coachGroupId)) return null;
  return prisma.coachGroup.findFirst({
    where: { id: coachGroupId, clubId },
    select: { id: true, name: true },
  });
}

export function canAccessTrainingClub(
  session: AdminSessionPayload,
  clubId: string,
) {
  return (
    session.roles.includes("admin") ||
    (session.roles.includes("coach") &&
      (!session.defaultClubId || session.defaultClubId === clubId))
  );
}
export async function authorizeTraining(
  request: NextRequest,
  clubId: string,
  requiredAccess: "read" | "save" = "read",
) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session)
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  if (!UUID_RE.test(clubId))
    return NextResponse.json({ error: "Невалиден клуб." }, { status: 400 });
  if (!canAccessTrainingClub(session, clubId))
    return NextResponse.json(
      { error: "Нямате достъп до този клуб." },
      { status: 403 },
    );
  const write = !["GET", "HEAD"].includes(request.method);
  if (write && !hasTrustedOrigin(request))
    return NextResponse.json(
      { error: "Невалиден източник на заявката." },
      { status: 403 },
    );
  // Each write needs the subscription, also a delete or a category change.
  if (requiredAccess === "save" || write) {
    const access = await trainingPlanCapabilities(clubId, session.roles);
    if (!access.canSave) return NextResponse.json(
      { error: "За запазване е необходим активен абонамент за планове за тренировки." },
      { status: 403 },
    );
  }
  return session;
}
